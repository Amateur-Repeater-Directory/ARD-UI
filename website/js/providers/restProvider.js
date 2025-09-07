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

import wretch from 'https://cdn.skypack.dev/wretch/dist/bundle/wretch.all.min.mjs';
import { Repeater } from '../models/Repeater.js';
import { RepeaterConnection } from '../models/RepeaterConnection.js';
import { HomeLocation } from '../models/HomeLocation.js';
import { AppState } from '../appState.js';

const bearer = 'Bearer ';
const token = 'token';

export class RestProvider {
    constructor() {
        this.base = '/api/'; // change later when you flip to live endpoints
        this.sendSettingsUpdates = true; // public flag; UI can flip
        this.settingsChangedCount = 0;
    }

    #path(path) {
        return this.base + path;
    }

    // ******************************************************************************
    // BEGIN ITERFACE METHODS
    // ******************************************************************************
    suspendSettingsUpdates() {
        this.sendSettingsUpdates = false;
    }
    resumeSettingsUpdates() {
        this.sendSettingsUpdates = true;
    }

    async isAuthenticated() {
        try {
            return await wretch(this.#path('heartbeat/isAuthenticated'))
                .auth(`Bearer ${localStorage.getItem(token)}`)
                .post({})
                .notFound(() => null)
                .error(405, (error, request) => {
                    return false;
                })
                .unauthorized(() => {
                    return false;
                })
                .forbidden(() => {
                    return false;
                })
                .json();
        } catch {
            return false;
        }
    }

    async mapSettings_Get(data) {
        return await wretch(this.#path('mapSettings/get'))
            .auth(`Bearer ${localStorage.getItem(token)}`)
            .get()
            .notFound(() => null)
            .unauthorized(() => {
                this._forbidden();
                throw new Error('401');
            })
            .forbidden(() => {
                this._forbidden();
                throw new Error('403');
            })
            .json();
    }

    async mapSettings_Changed(settings, source) {
        // keep your counter logic (non-blocking refresh every 30th change)
        this.settingsChangedCount = (this.settingsChangedCount || 0) + 1;

        if (this.settingsChangedCount % 30 === 0) {

            // Fire & forget refresh (no await)
            await wretch('accounts/RefreshToken')
                .post(null) // no body
                .json((res) => {
                    localStorage.setItem(token, res.jwtToken);
                    let tok = localStorage.getItem(token)
                    if (tok !== res.jwtToken) {
                        alert('damn !!!');
                    }
                });

        }

        if (this.sendSettingsUpdates === false) {
            return;
        }

        // preserve your SourceOfEvent addition
        settings = { ...settings, SourceOfEvent: source };

        await wretch(this.#path('mapSettings/update'))
            .auth(`Bearer ${localStorage.getItem(token)}`)
            .post(settings) // ?source=...
            .json();

        console.info('MapSettings - ' + source);

    }

    //async repeaters_GetAll() {
    //    return await wretch('/data/master_list.json')
    //        .auth(`Bearer ${localStorage.getItem(token)}`)
    //        .get()
    //        .notFound(() => null)
    //        .unauthorized(() => {
    //            this._forbidden();
    //            throw new Error('401');
    //        })
    //        .forbidden(() => {
    //            this._forbidden();
    //            throw new Error('403');
    //        })
    //        .json((json) => json.map((o) => Repeater.fromJson(o)));
    //}

    async repeaters_GetAll() {
        return await wretch(this.#path('repeaters/getAll'))
            .auth(`Bearer ${localStorage.getItem(token)}`)
            .get()
            .notFound(() => null)
            .unauthorized(() => {
                this._forbidden();
                throw new Error('401');
            })
            .forbidden(() => {
                this._forbidden();
                throw new Error('403');
            })
            .json((json) => json.map((o) => Repeater.fromJson(o)));
    }

    async repeater_Update(repeater) {
        return await wretch(this.#path('repeaters/update'))
            .auth(`Bearer ${localStorage.getItem(token)}`)
            .put(repeater)
            .notFound(() => null)
            .unauthorized(() => {
                this._forbidden();
                throw new Error('401');
            })
            .forbidden(() => {
                this._forbidden();
                throw new Error('403');
            })
            .json((json) => Repeater.fromJson(json));
    }

    async repeater_Add(repeater) {
        return await wretch(this.#path('repeaters/add'))
            .auth(`Bearer ${localStorage.getItem(token)}`)
            .post(repeater)
            .notFound(() => null)
            .unauthorized(() => {
                this._forbidden();
                throw new Error('401');
            })
            .forbidden(() => {
                this._forbidden();
                throw new Error('403');
            })
            .json((json) => Repeater.fromJson(json));
    }

    async homeLocations_GetAll() {
        return await wretch(this.#path('homeLocation/getAll'))
            .auth(`Bearer ${localStorage.getItem(token)}`)
            .get()
            .notFound(() => null) // translate 404 → null
            .unauthorized(() => {
                this._forbidden();
                throw new Error('401');
            })
            .forbidden(() => {
                this._forbidden();
                throw new Error('403');
            })
            .json((json) => json.map((o) => HomeLocation.fromJson(o)));
    }

    async homeLocation_Exists(name) {
        return await wretch(this.#path('homeLocation/exists'))
            .auth(`Bearer ${localStorage.getItem(token)}`)
            .query({ name })
            .get()
            .notFound(() => null) // translate 404 → null
            .unauthorized(() => {
                this._forbidden();
                throw new Error('401');
            })
            .forbidden(() => {
                this._forbidden();
                throw new Error('403');
            })
            .json();
    }

    async homeLocation_GetById(locationId) {
        return await wretch(this.#path('homeLocation/getById'))
            .auth(`Bearer ${localStorage.getItem(token)}`)
            .query({ locationId })
            .get()
            .notFound(() => null) // translate 404 → null
            .unauthorized(() => {
                this._forbidden();
                throw new Error('401');
            })
            .forbidden(() => {
                this._forbidden();
                throw new Error('403');
            })
            .json((json) => HomeLocation.fromJson(json));
    }

    async homeLocation_Add(data) {
        return await wretch(this.#path('homeLocation/add'))
            .auth(`Bearer ${localStorage.getItem(token)}`)
            .post(data)
            .notFound(() => null) // translate 404 → null
            .unauthorized(() => {
                this._forbidden();
                throw new Error('401');
            })
            .forbidden(() => {
                this._forbidden();
                throw new Error('403');
            })
            .json();
    }

    async homeLocation_Delete(locationId) {

        const arr = await wretch(this.#path('homeLocation/delete'))
            .auth(`Bearer ${localStorage.getItem(token)}`)
            .post({ LocationId: locationId })
            .notFound(() => null) // translate 404 → null
            .unauthorized(() => {
                this._forbidden();
                throw new Error('401');
            })
            .forbidden(() => {
                this._forbidden();
                throw new Error('403');
            })
            .json();
    }

    async repeaterConnections_GetAll() {
        return await wretch(this.#path('repeaterConnection/getAll'))
            .auth(`Bearer ${localStorage.getItem(token)}`)
            .get()
            .notFound(() => null) // translate 404 → null
            .unauthorized(() => {
                this._forbidden();
                throw new Error('401');
            })
            .forbidden(() => {
                this._forbidden();
                throw new Error('403');
            })
            .json((json) => json.map((o) => RepeaterConnection.fromJson(o)));
    }

    async repeaterConnection_ToggleCanPing(data) {
        return wretch(this.#path('repeaterConnection/toggleCanPing'))
            .auth(`Bearer ${localStorage.getItem(token)}`)
            .post(data)
            .notFound(() => null) // translate 404 → null
            .unauthorized(() => {
                this._forbidden();
                throw new Error('401');
            })
            .forbidden(() => {
                this._forbidden();
                throw new Error('403');
            })
            .json();
    }

    async repeaterConnection_ToggleCanReceive(data) {
        return wretch(this.#path('repeaterConnection/toggleCanReceive'))
            .auth(`Bearer ${localStorage.getItem(token)}`)
            .post(data)
            .notFound(() => null) // translate 404 → null
            .unauthorized(() => {
                this._forbidden();
                throw new Error('401');
            })
            .forbidden(() => {
                this._forbidden();
                throw new Error('403');
            })
            .json();
    }

    async repeaterConnection_ToggleCanTransmit(data) {
        return wretch(this.#path('repeaterConnection/toggleCanTransmit'))
            .auth(`Bearer ${localStorage.getItem(token)}`)
            .post(data)
            .notFound(() => null) // translate 404 → null
            .unauthorized(() => {
                this._forbidden();
                throw new Error('401');
            })
            .forbidden(() => {
                this._forbidden();
                throw new Error('403');
            })
            .json();
    }

    async repeaterConnection_ClearStatus(data) {
        return wretch(this.#path('repeaterConnection/clearStatus'))
            .auth(`Bearer ${localStorage.getItem(token)}`)
            .post(data)
            .notFound(() => null) // translate 404 → null
            .unauthorized(() => {
                this._forbidden();
                throw new Error('401');
            })
            .forbidden(() => {
                this._forbidden();
                throw new Error('403');
            })
            .json();
    }

    async repeatersActive_GetByAccount() {
        return [];
    }

    async elevation_computeLineOfSight(payload) {
        return await wretch(this.#path('elevation/computeLineOfSight'))
            .auth(`Bearer ${localStorage.getItem(token)}`)
            .post(payload)
            .notFound(() => null)
            .unauthorized(() => {
                this._forbidden();
                throw new Error('401');
            })
            .forbidden(() => {
                this._forbidden();
                throw new Error('403');
            })
            .json();
    }

    // ******************************************************************************
    // END ITERFACE METHODS
    // ******************************************************************************

    _forbidden() {
        localStorage.removeItem('token');
        document.location.href = '/';
    }

    // ******************************************************************************
    // END ITERFACE METHODS
    // ******************************************************************************
}

// Export singleton instance for app wiring
export const restProvider = new RestProvider();
