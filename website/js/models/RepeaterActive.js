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
 * @class RepeaterActive
 * @description Represents an active binding between an account and a repeater,
 *              with an expiration datetime.
 */
export class RepeaterActive {
    // Explicit public fields for IntelliSense / documentation
    accountId;
    repeaterId;
    deactivateOn;

    /**
     * @param {object} data Raw object parsed from JSON or returned by an API.
     * @param {string} data.AccountId      GUID string
     * @param {string} data.RepeaterId     GUID string
     * @param {string|Date} data.DeactivateOn  ISO datetime string or Date
     */
    constructor(data) {
        this.accountId = data.AccountId;
        this.repeaterId = data.RepeaterId;
        this.deactivateOn = data.DeactivateOn instanceof Date
            ? data.DeactivateOn
            : new Date(data.DeactivateOn);
    }

    /**
     * Deserialize from a JSON string or plain object.
     * @param {string|object} input JSON text or already-parsed object.
     * @returns {RepeaterActive}
     */
    static fromJson(input) {
        const obj = typeof input === 'string'
            ? JSON.parse(input)
            : input;
        return new RepeaterActive(obj);
    }

    /**
     * Check whether this binding is still active as of now.
     * @returns {boolean}
     */
    isActive() {
        return new Date() < this.deactivateOn;
    }
}