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

/**
 * Service for selecting and drawing repeater distance/range information.
 * Uses AppState for all state access — no window.ARD references.
 */
export class MapService {

    static #lastBouncing = null;

    static selectMarker(marker) {
        // stop previous

        MapService.clearSelectedMarker();

        L.Marker.setBouncingOptions({
            bounceHeight: 14,
            contractHeight: 10,
            bounceSpeed: 20,
            contractSpeed: 58,
            elastic: true,
            exclusive: true,  // auto-stop any other bouncing marker
            shadowAngle: null // disable plugin's fake shadow
        });
        marker.bounce();

        MapService.#lastBouncing = marker;
    }

    static clearSelectedMarker() {
        if (MapService.#lastBouncing) {
            MapService.#lastBouncing.stopBouncing();
        }
    }

    static getAppropriateMarkerIcon(repeater, canPing, canReceive, canTransmit) {
        const icons = AppState.getIcons();
        if (!icons) return null;
        if (repeater.OperationalStatus === 'Off-air') return icons.inactiveIcon;
        if (canTransmit) return icons.transmitIcon;
        if (canPing && canReceive && !canTransmit) return icons.pingReceiveIcon;
        if (canPing) return icons.pingIcon;
        if (canReceive) return icons.receiveIcon;
        return icons.normalIcon;
    }


    static async flyToWithDelayedMarkers(map, targetLatLng, durationSeconds, fnCallback) {

        const affectedMarkers = [];

        const zoom = map.getZoom();

        // 1. Hide markers (leave them in place)
        map.eachLayer(layer => {
            if (layer instanceof L.Marker && layer.setOpacity) {
                affectedMarkers.push(layer);
                layer.setOpacity(0);
            }
        });

        // 2. Start the fly animation
        map.flyTo(targetLatLng, zoom, {
            duration: durationSeconds,
            animate: true
        });

        // 3. After animation finishes, restore marker opacity and repaint
        setTimeout(() => {
            affectedMarkers.forEach(layer => {
                layer.setOpacity(1);
            });
            fnCallback();
        }, durationSeconds * 1000);
    }

    static createMarkerIcons() {
        return {
            simplexIcon: baseCreateIcon('/img/marker-icon-2x-violet.png', ''),
            pingIcon: baseCreateIcon('/img/marker-icon-2x-yellow.png', ''),
            pingReceiveIcon: baseCreateIcon('/img/marker-icon-2x-blueyellow.png', ''),
            receiveIcon: baseCreateIcon('/img/marker-icon-2x-blue.png', ''),
            transmitIcon: baseCreateIcon('/img/marker-icon-2x-green.png', ''),
            baseIcon: baseCreateIcon('/img/marker-icon-2x-red.png', ''),
            normalIcon: baseCreateIcon('/img/marker-icon-2x-grey.png', ''),
            inactiveIcon: baseCreateIcon('/img/marker-icon-2x-grey-inactive.png', ''),
            ragChewIcon: baseCreateIcon('/img/marker-icon-2x-orange.png', 'blinking'),
        };

        function baseCreateIcon(img, className) {
            return new L.Icon({
                iconUrl: img,
                className: className,
                shadowUrl: '/img/marker-shadow.png',
                iconSize: [25, 41],
                iconAnchor: [12, 41],
                popupAnchor: [1, -34],
                shadowSize: [41, 41],
                html: '<span class="pulse"></span>',
            });
        }
    }

    static bindLocateOpensHomeDialog(lc) {
        const map = AppState.getMap();
        if (!map || !map._leaflet_id) return;
        if (!lc || typeof lc.stop !== 'function') return; // require the control

        if (map.__locateHomeDialogWired) return;
        map.__locateHomeDialogWired = true;

        let locating = false;
        let guardTimer = null;
        let lastTarget = null; // from locationfound if/when it fires

        function isLocationWithinTwoMiles(targetLatLng) {
            let TWO_MILES_M = 3219;
            const homes = AppState.getHomeLocations();
            for (const h of homes) {
                if (L.latLng(h.latitude, h.longitude).distanceTo(targetLatLng) <= TWO_MILES_M) return true;
            }
            return false;
        }

        map.on('locateactivate', () => {
            locating = true;
            lastTarget = null;
            armGuard();

            // Catch the immediate flyTo (cached) or the animated flyTo (fresh fix)
            map.once('moveend', () => {

                const center = map.getCenter();
                const target = lastTarget || center; // prefer GPS fix if we got it

                if (isLocationWithinTwoMiles(target)) {
                    locating = false;
                    clearGuard();
                    return;
                }

                // distance guard if we did get a fix
                if (!lastTarget || center.distanceTo(lastTarget) <= 50) {
                    AppState.services.dlgAddHomeLocation.showAddHomeLocModal(target.lat, target.lng);
                }

                // optional: belt-and-suspenders stop
                queueMicrotask(() => {
                    try { lc.stop(); } catch { }
                    try { lc.stopFollowing?.(); } catch { }
                    try { map.stopLocate?.(); } catch { }
                });

                locating = false; // consume the cycle
                clearGuard();
            });
        });

        map.on('locationerror', () => { locating = false; clearGuard(); });

        // May arrive before or after moveend; we’ll use it if available
        map.on('locationfound', (e) => {
            const lat = e.latitude ?? e.latlng?.lat;
            const lng = e.longitude ?? e.latlng?.lng;
            if (lat != null && lng != null) {
                lastTarget = L.latLng(lat, lng);
            }
        });

        function armGuard() {
            clearGuard();
            // if moveend never comes (edge cases), disarm after 5s
            guardTimer = setTimeout(() => { locating = false; }, 5000);
        }
        function clearGuard() {
            if (guardTimer) { clearTimeout(guardTimer); guardTimer = null; }
        }
    }
}