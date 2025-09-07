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

import { RepeaterConnection } from './RepeaterConnection.js';

/**
 * @class Repeater
 * @description Represents an amateur radio repeater.
 */

export class Repeater {
    // Explicit public fields (for IntelliSense / documentation)
    repeaterId;
    outputFrequency;
    inputFrequency;
    offset;
    offsetSign;
    band;
    toneMode;
    ctcssTx;
    ctcssRx;
    isCrossTone;
    callsign;
    latitude;
    longitude;
    state;
    county;
    nearestCity;
    notes;
    isLatLongPrecise;
    isOperational;
    isOpen;
    isCoordinated;
    ares;
    races;
    skywarn;
    createdDate;
    updatedDate;
    hasLatLongError;
    elevation;
    aboveGroundLevel;

    // container for RepeaterConnection instances
    #repeaterConnections = [];
    // lookup map for quick access by locationId
    #connectionsByLocation = new Map();

    /**
     * @param {object} data Raw object parsed from JSON
     */
    constructor(data) {

        if (!data) return;

        this.repeaterId = data.repeaterId;
        this.outputFrequency = data.outputFrequency;
        this.inputFrequency = data.inputFrequency;
        this.offset = data.offset;
        this.offsetSign = data.offsetSign;
        this.band = data.band;
        this.toneMode = data.toneMode;
        this.ctcssTx = data.ctcssTx;
        this.ctcssRx = data.ctcssRx;
        this.isCrossTone = data.isCrossTone;
        this.callsign = data.callsign;
        this.latitude = data.latitude;
        this.longitude = data.longitude;
        this.state = data.state;
        this.county = data.county;
        this.nearestCity = data.nearestCity?.trim() ?? '';
        this.notes = data.notes;
        this.isLatLongPrecise = data.isLatLongPrecise;
        this.isOperational = data.isOperational;
        this.isOpen = data.isOpen;
        this.isCoordinated = data.isCoordinated;
        this.ares = data.ares;
        this.races = data.races;
        this.skywarn = data.skywarn;
        this.createdDate = new Date(data.createdDate);
        this.updatedDate = new Date(data.updatedDate);
        this.hasLatLongError = data.hasLatLongError;
        this.elevation = data.elevation;
        this.aboveGroundLevel = Math.max(0, data.aboveGroundLevel === undefined ? 0 : data.aboveGroundLevel);
    }


    /**
     * Deserialize a JSON string or object into a Repeater instance.
     * @param {string|object} input JSON string or already-parsed object.
     * @returns {Repeater}
     */
    static fromJson(input) {
        const obj = typeof input === 'string'
            ? JSON.parse(input)
            : input;
        return new Repeater(obj);
    }

    toLatLong() {
        return [this.latitude, this.longitude];
    }

    /**
     * Leaflet wants coords in long/lat
     * @returns
     */
    toLongLat() {
        return [this.longitude, this.latitude];
    }

    /**
      * @returns {Repeater} a deep copy of this instance
      */
    clone() {
        // deep‐clone this instance, preserving Date, Map, Set, etc. when possible
        const copy =
            typeof structuredClone === 'function'
                ? structuredClone(this)
                : JSON.parse(JSON.stringify(this));

        // then rebuild a proper Repeater from the raw data
        return Repeater.fromJson(copy);
    }


    /**
   * Bulk‐set connections after you fetch them separately.
   * @param {Array<object>|Array<RepeaterConnection>} arr
   */
    setConnections(arr) {
        // normalize raw objects into instances
        this.#repeaterConnections = arr.map(item =>
            item instanceof RepeaterConnection
                ? item
                : RepeaterConnection.fromJson(item)
        );

        // rebuild the lookup map
        this.#connectionsByLocation = new Map(
            this.#repeaterConnections.map(rc => [rc.locationId, rc])
        );
    }

    /**
     * Add a single connection (raw or instance) to this repeater.
     * @param {object|RepeaterConnection} item
     */
    addConnection(item) {
        const rc = item instanceof RepeaterConnection
            ? item
            : RepeaterConnection.fromJson(item);

        this.#repeaterConnections.push(rc);
        this.#connectionsByLocation.set(rc.locationId, rc);
    }

    /**
     * Ensure a RepeaterConnection exists for this repeater + location,
     * create & store one if missing, then return it.
     */
    ensureConnectionExists(locationId) {
        // Try to fetch an existing connection
        let connection = this.#connectionsByLocation.get(locationId);
        if (connection) {
            return connection;
        }

        // Otherwise, create a new one with explicit assignments
        connection = new RepeaterConnection();
        connection.canPing = false;
        connection.canReceive = false;
        connection.canTransmit = false;
        connection.repeaterId = this.repeaterId;
        connection.locationId = locationId;

        // Store in both the array and the map
        this.#repeaterConnections.push(connection);
        this.#connectionsByLocation.set(locationId, connection);

        return connection;
    }

    /**
     * Get the connection for a given locationId.
     * @param {number} locationId
     * @returns {RepeaterConnection|undefined}
     */
    getConnection(locationId) {
        return this.#connectionsByLocation.get(locationId);
    }

    /**
     * Example instance method: returns 'City, State'
     * @returns {string}
     */
    getFullLocation() {
        return `${this.nearestCity}, ${this.state}`;
    }

    /**
     * Returns the connection capabilities for a given repeater.
     * @param {string|number} locationId – the ID of the repeater/location
     * @returns {{ canPing: boolean, canReceive: boolean, canTransmit: boolean }}
     */
    getRepeaterConnectionStatus(locationId) {
        const status = this.getConnection(locationId);
        return {
            canPing: status?.canPing ?? false,
            canReceive: status?.canReceive ?? false,
            canTransmit: status?.canTransmit ?? false
        };
    }
}