/*
  Amateur Repeater Directory
  Copyright (c) 2025 Amateur Repeater Directory Contributors

  This source code is licensed under the Apache License, Version 2.0 (Apache-2.0).
  You may not use this file except in compliance with the License.
  You may obtain a copy of the License at:

      http://www.apache.org/licenses/LICENSE-2.0

  Unless required by applicable law or agreed to in writing, software
  distributed under the License is distributed on an 'AS IS' BASIS,
  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
  See the License for the specific language governing permissions and
  limitations under the License.

  Data files included in the ARD-RepeaterList GitHub repository are
  licensed under the Creative Commons CC0 1.0 Universal (CC0-1.0) 
  Public Domain Dedication.

  To view a copy of this license, visit:

      https://creativecommons.org/publicdomain/zero/1.0/
*/

import { AppState } from '../appState.js';
import { UtilitiesService } from './utilitiesService.js';
import { Repeater } from '../models/Repeater.js';

/**
 * Service for selecting and drawing repeater distance/range information.
 * Uses AppState for all state access — no window.ARD references.
 */
export class GeoMappingService {

  /** @type {{type:'ping'|'rx'|'tx', color:string, layer:L.Layer|null}[]} */
  static #rangeLayers = [
    // ping: vivid amber (was pale gold)
    { type: 'ping', color: 'rgba(255,160,0,0.95)', layer: null },   // #FFA000

    // rx: electric blue (deeper than Bootstrap primary)
    { type: 'rx', color: 'rgba(0,122,255,0.95)', layer: null },   // #007AFF

    // tx: vivid emerald
    { type: 'tx', color: 'rgba(0,185,90,0.95)', layer: null },    // #00B95A
  ];

  // ---------- selection ----------

  /** @returns {string[]} Array of Repeater.TransientId */
  static selectRepeaterIdsWithinCircle() {
    const radius = Number(AppState.getSearchDistance()) * 1609.34; // meters
    const reps = AppState.getFilteredRepeaters();
    const base = AppState.getLocation();
    if (!base) return [];

    const baseLL = L.latLng(base.latitude, base.longitude);
    return reps
      .filter(
        (r) =>
          baseLL.distanceTo(new L.LatLng(r.latitude, r.longitude)) <= radius
      )
      .map((r) => r.TransientId);
  }

  /** @param {number} [distancePad=0]  miles; @returns {Repeater[]} */
  static selectRepeatersWithinCircle(distancePad = 0) {
    const searchRange =
      Number(AppState.getSearchDistance()) + Number(distancePad);
    const radius = searchRange * 1609.34;
    const reps = AppState.getFilteredRepeaters();
    const base = AppState.getLocation();
    if (!base) return [];

    const baseLL = L.latLng(base.latitude, base.longitude);
    return reps.filter(
      (r) => baseLL.distanceTo(new L.LatLng(r.latitude, r.longitude)) <= radius
    );
  }

  // ---------- distances ----------

  /** @param {Repeater} repeater @returns {string} */
  static distanceFromBase(repeater) {
    const base = AppState.getLocation();
    if (!base) return 'Distance: -- miles';

    const meters = this.getDistanceBetweenPoints(
      [base.latitude, base.longitude],
      [repeater.latitude, repeater.longitude]
    );
    const miles = (meters * 3.2808399) / 5280;
    return `Distance: ${miles.toFixed(2)} miles`;
  }

  /** @param {Repeater} repeater @returns {string} miles */
  static distanceFromBaseInMiles(repeater) {
    const base = AppState.getLocation();
    if (!base || !repeater) return '0.00';

    // Get meters and coerce to a number in case the helper returns a string
    const metersRaw = this.getDistanceBetweenPoints(
      [Number(base.latitude), Number(base.longitude)],
      [Number(repeater.latitude), Number(repeater.longitude)]
    );
    const meters = Number(metersRaw);
    if (!Number.isFinite(meters)) return '0.00';

    // Convert meters -> miles
    const miles = meters / 1609.344;
    return miles.toFixed(2); // keep string to avoid breaking existing call sites
  }

  /** @returns {string} kilometers (e.g. '1.23') */
  static distanceFromBaseInKilometers([φ1, λ1], [φ2, λ2]) {
    const meters = this.getDistanceBetweenPoints([φ1, λ1], [φ2, λ2]);
    return (meters / 1000).toFixed(2);
  }

  /** Haversine distance in meters. */
  static getDistanceBetweenPoints([φ1, λ1], [φ2, λ2]) {
    const toRad = (θ) => (θ * Math.PI) / 180;
    const Δφ = toRad(φ2 - φ1);
    const Δλ = toRad(λ2 - λ1);
    const a =
      Math.sin(Δφ / 2) ** 2 +
      Math.cos(toRad(φ1)) * Math.cos(toRad(φ2)) * Math.sin(Δλ / 2) ** 2;
    const c = 2 * Math.asin(Math.sqrt(a));
    return 6371e3 * c; // meters
  }

  // ---------- furthest-distance calc ----------

  /**
   * Calculates furthest distances and updates the homeMarker popup if anything changed.
   * @returns {boolean} true if any distance changed
   */
  static setFurthestDistanceFromHome() {
    const reps = AppState.getFilteredRepeaters();
    const locationId = AppState.getLocationId();
    const base = AppState.getLocation();
    if (!reps?.length || !base) return false;

    const distances = { ping: 0, receive: 0, transmit: 0 };
    let changed = false;

    // reset tracked values
    AppState.setCanPingDistance(0);
    AppState.setCanReceiveDistance(0);
    AppState.setCanTransmitDistance(0);

    for (const repeater of reps) {
      const { canPing, canReceive, canTransmit } =
        repeater.getRepeaterConnectionStatus(locationId);

      if (!canPing && !canReceive && !canTransmit) continue;

      const miles = Math.max(0, Number(this.distanceFromBaseInMiles(repeater)));

      if (canPing && !canTransmit && miles > distances.ping) {
        distances.ping = miles;
        AppState.setCanPingDistance(miles);
        changed = true;
      }
      if (canReceive && !canTransmit && miles > distances.receive) {
        distances.receive = miles;
        AppState.setCanReceiveDistance(miles);
        changed = true;
      }
      if (canTransmit && miles > distances.transmit) {
        distances.transmit = miles;
        AppState.setCanTransmitDistance(miles);
        changed = true;
      }
    }

    if (changed) {
      const { receive, ping, transmit } = distances;
      const homeMarker = AppState.getHomeMarker();
      if (homeMarker) {
        homeMarker.bindPopup(
          `<div style='font-family: monospace; text-align:right;'>
            <strong>&nbsp;&nbsp;RX: </strong>${receive.toFixed(2)} miles<br/>
            <strong>PING: </strong>${ping.toFixed(2)} miles<br/>
            <strong>&nbsp;&nbsp;TX: </strong>${transmit.toFixed(2)} miles
          </div>`
        );
      }
    }

    return changed;
  }

  // ---------- circles ----------

  /**
   * Draw or remove a range circle of given type.
   * @param {boolean} on
   * @param {'ping'|'rx'|'tx'} type
   */
  static async drawRangeCircle(on, type) {
    await UtilitiesService.waitForMicrotasks();

    const map = AppState.getMap();
    const base = AppState.getLocation();
    if (!map || !base) return;

    const entry = this.#rangeLayers.find((e) => e.type === type);

    // remove existing
    if (entry?.layer) {
      map.removeLayer(entry.layer);
      entry.layer = null;
    }

    // recompute distances
    this.setFurthestDistanceFromHome();
    if (on === false) return;

    const dist = {
      ping: AppState.getCanPingDistance(),
      rx: AppState.getCanReceiveDistance(),
      tx: AppState.getCanTransmitDistance(),
    }[type];

    const coords = [base.latitude, base.longitude];
    const radius = Number(dist) * 1609.34;

    entry.layer = L.circle(coords, radius, {
      color: entry.color,
      fillOpacity: 0.2,
      opacity: 0.6,
      stroke: true,
    }).addTo(map);
  }

  /** @param {'ping'|'rx'|'tx'} type */
  static async refreshRangeCircle(type) {
    await UtilitiesService.waitForMicrotasks();

    const map = AppState.getMap();
    const base = AppState.getLocation();
    if (!map || !base) return;

    const entry = this.#rangeLayers.find((e) => e.type === type);
    if (!entry?.layer) return;

    map.removeLayer(entry.layer);
    entry.layer = null;

    this.setFurthestDistanceFromHome();

    const dist = {
      ping: AppState.getCanPingDistance(),
      rx: AppState.getCanReceiveDistance(),
      tx: AppState.getCanTransmitDistance(),
    }[type];

    const coords = [base.latitude, baselongitude];
    const radius = Number(dist) * 1609.34;

    entry.layer = L.circle(coords, radius, {
      color: entry.color,
      fillOpacity: 0.2,
      opacity: 0.6,
      stroke: true,
      className: 'range-neon',
    }).addTo(map);
  }

  /** Remove all range circles from the map. */
  static clearRangeCircles() {
    const map = AppState.getMap();
    if (!map) return;

    this.#rangeLayers.forEach((e) => {
      if (e.layer) {
        map.removeLayer(e.layer);
        e.layer = null;
      }
    });
  }

  // ---------- validators ----------

  static isLatitude(lat) {
    return Number.isFinite(lat) && Math.abs(lat) <= 90;
  }
  static isLongitude(lon) {
    return Number.isFinite(lon) && Math.abs(lon) <= 180;
  }
}
