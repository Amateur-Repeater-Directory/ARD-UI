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
 * @class RepeaterConnection
 * @description Represents a link between a repeater, a location, and an account,
 *              with permissions for ping, receive, and transmit.
 */
export class RepeaterConnection {
    // Explicit public fields (for IntelliSense & documentation)
    repeaterConnectionId;
    repeaterId;
    locationId;
    canPing;
    canReceive;
    canTransmit;

    /**
     * @param {object} data Raw object (e.g. parsed from JSON) with exactly these properties:
     *   - RepeaterConnectionId: string (GUID)
     *   - RepeaterId:           string (GUID)
     *   - LocationId:           string (GUID)
     *   - AccountId:            string (GUID)
     *   - CanPing:              boolean
     *   - CanReceive:           boolean
     *   - CanTransmit:          boolean
     */
    constructor(data) {
        if (data) {
            this.repeaterConnectionId = data.repeaterConnectionId;
            this.repeaterId = data.repeaterId;
            this.locationId = data.locationId;
            this.canPing = !!data.canPing;
            this.canReceive = !!data.canReceive;
            this.canTransmit = !!data.canTransmit;
        }
    }


    /**
     * Deserialize a JSON string or plain object into a RepeaterConnection instance.
     * @param {string|object} input JSON text or already-parsed object.
     * @returns {RepeaterConnection}
     */
    static fromJson(input) {
        const obj = typeof input === 'string'
            ? JSON.parse(input)
            : input;
        return new RepeaterConnection(obj);
    }

    /**
     * Example instance method: returns a summary of capabilities on this Repeater.
     * @returns const { canPing, canReceive, canTransmit }
     */
    getRepeaterConnectionStatus() {
        return {
            canPing: this.canPing ?? false,
            canReceive: this.canReceive ?? false,
            canTransmit: this.canTransmit ?? false
        };
    }
}