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

/**
 * @class HomeLocation
 * @description Represents a user’s saved home location.
 */
export class HomeLocation {
    // Explicit public fields for IntelliSense / documentation
    locationId;
    name;
    latitude;
    longitude;
    elevation;
    aboveGroundLevel;


    /**
     * @param {object} data Raw object parsed from JSON or returned by an API.
     * @param {number} data.locationId
     * @param {string} data.accountId   GUID string
     * @param {string} data.name        up to 100 chars
     * @param {number|string} data.latitude
     * @param {number|string} data.longitude
     * @param {number|string} data.elevation
     * @param {number|string} data.aboveGroundLevel
     */
    constructor(data) {
        this.locationId = data.locationId;
        this.name = data.name;
        this.latitude = typeof data.latitude === 'string'
            ? parseFloat(data.latitude)
            : data.latitude;
        this.longitude = typeof data.longitude === 'string'
            ? parseFloat(data.longitude)
            : data.longitude;
        this.elevation = typeof data.elevation === 'string'
            ? parseFloat(data.elevation)
            : data.elevation;
        this.aboveGroundLevel = typeof data.aboveGroundLevel === 'string'
            ? parseFloat(data.aboveGroundLevel)
            : data.aboveGroundLevel;
    }

    /**
     * Deserialize from a JSON string or plain object.
     * @param {string|object} input JSON string or already-parsed object.
     * @returns {HomeLocation}
     */
    static fromJson(input) {
        const obj = typeof input === 'string'
            ? JSON.parse(input)
            : input;
        return new HomeLocation(obj);
    }

    /**
     * Example instance method: returns a [lat, lng] tuple.
     * @returns {[number, number]}
     */
    toLatLng() {
        return [this.latitude, this.longitude];
    }
}

