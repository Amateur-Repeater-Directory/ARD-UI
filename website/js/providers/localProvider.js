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
import { Repeater } from '../models/Repeater.js'; // adjust path if needed
import { UtilitiesService } from '../services/utilitiesService.js';

// ─── Local Storage Namespace ──────────────────────────────────────────────────
const NS = 'ARD:v5:'; // bumped from v1 → v2

const LOCAL_ACCOUNT_ID = '00000000-0000-0000-0000-000000000001'; // fixed local account

const K = {
    HOME_LOCATIONS: NS + 'homeLocations',
    SETTINGS: NS + 'mapSettings',
    REPEATER_CONNS: NS + 'repeaterConnections',
    ACTIVE: NS + 'repeatersActive',
};

// ─── Safe JSON helpers ────────────────────────────────────────────────────────
function read(key, fallback) {
    try {
        const raw = localStorage.getItem(key);
        if (raw == null) return fallback;
        return JSON.parse(raw);
    } catch {
        return fallback;
    }
}
function write(key, value) {
    try {
        localStorage.setItem(key, JSON.stringify(value));
        return true;
    } catch {
        return false;
    }
}
function remove(key) {
    try {
        localStorage.removeItem(key);
    } catch { }
}

// RepeaterConnection helpers (all lowercase fields)
const rcKey = ({ repeaterId, locationId }) =>
    `${LOCAL_ACCOUNT_ID}::${repeaterId}::${locationId}`;
const rcList = () => read(K.REPEATER_CONNS, []);
const rcWrite = (list) => write(K.REPEATER_CONNS, list);

// RepeatersActive helpers
const raList = () => read(K.ACTIVE, []);
const raWrite = (list) => write(K.ACTIVE, list);

export class LocalProvider {
    constructor() {
        this.sendSettingsUpdates = true; // public flag; UI can flip
        this.#purge('ARD:v1:');
        this.#purge('ARD:v2:');
        this.#purge('ARD:v3:');
        this.#purge('ARD:v4:');
        this._seedLocal();
    }

    #purge(version) {
        try {
            const keysToDelete = [];
            for (let i = 0; i < localStorage.length; i++) {
                const key = localStorage.key(i);
                if (!key) continue;
                if (key.startsWith(version)) keysToDelete.push(key);
            }
            keysToDelete.forEach((k) => localStorage.removeItem(k));
        } catch (_) {
            /* ignore */
        }
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

    async mapSettings_Get() {
        return read(K.SETTINGS, {
            ignoreUpdates: false,
            SourceOfEvent: 'bootstrap',
        });
    }

    async mapSettings_Changed(settings, source) {
        if (!this.sendSettingsUpdates) return true;
        const prev = read(K.SETTINGS, {});
        write(K.SETTINGS, { ...prev, ...settings, SourceOfEvent: source });
        return true;
    }

    async repeaters_GetAll() {
        const arr = await wretch('/data/master_list.json').get().json();
        return Array.isArray(arr) ? arr.map((o) => Repeater.fromJson(o)) : [];
    }

    async repeater_Update(repeater) {

    }

    async homeLocations_GetAll() {
        const list = read(K.HOME_LOCATIONS, []);
        return [...list].sort((a, b) =>
            (a.name ?? '').trim().localeCompare(
                (b.name ?? '').trim(),
                undefined,
                { sensitivity: 'base', numeric: true } // case-insensitive, natural sort
            )
        );
    }

    async homeLocation_Exists(name) {
        const target = (name ?? '').trim().toLowerCase();
        if (!target) return false;

        const items = await this.homeLocations_GetAll();
        return items.some(
            (loc) =>
                String(loc.name || '')
                    .trim()
                    .toLowerCase() === target
        );
    }

    async homeLocation_GetById(locationId) {
        const id = String(locationId);
        if (!id) return null;
        const list = read(K.HOME_LOCATIONS, []);
        return list.find((h) => String(h.locationId) === id) ?? null;
    }

    async homeLocation_Add(data) {
        const loc = {
            ...data,
            // CHANGED: use GUIDs (was random int)
            locationId: data.locationId ?? UtilitiesService.guid(),
            name: data.name,
            latitude: data.latitude,
            longitude: data.longitude,
            accountId: LOCAL_ACCOUNT_ID,
        };
        const list = read(K.HOME_LOCATIONS, []);
        list.push(loc);
        write(K.HOME_LOCATIONS, list);
        return loc;
    }

    async homeLocation_Delete(locationId) {
        const list = read(K.HOME_LOCATIONS, []);
        const mine = list.filter((h) => h.accountId === LOCAL_ACCOUNT_ID);
        if (mine.length <= 1)
            return { ok: false, message: 'Cannot delete your only Location' };
        const after = list.filter(
            (h) => !(h.locationId === locationId && h.accountId === LOCAL_ACCOUNT_ID)
        );
        write(K.HOME_LOCATIONS, after);

        // also clean repeater connections tied to that location
        const rc = rcList().filter((x) => x.locationId !== locationId);
        rcWrite(rc);

        // update settings current location if it pointed at the deleted one
        const s = read(K.SETTINGS, null);
        if (s && s.locationId === locationId) {
            const newDefault = after.find((h) => h.accountId === LOCAL_ACCOUNT_ID);
            if (newDefault) {
                s.locationId = newDefault.locationId;
                write(K.SETTINGS, s);
            }
        }

        return { ok: true };
    }

    async repeaterConnections_GetAll() {
        return rcList()
            .filter((x) => x.accountId === LOCAL_ACCOUNT_ID)
            .map(({ key, ...row }) => row);
    }

    async repeaterConnection_Get(repeaterId, locationId) {
        const list = rcList();
        const key = rcKey({ accountId: LOCAL_ACCOUNT_ID, repeaterId, locationId });
        return list.find((x) => x.key === key) ?? null;
    }

    async repeaterConnection_Ensure(ids) {
        const list = rcList();
        const key = rcKey(ids);
        let idx = list.findIndex((x) => x.key === key);

        if (idx < 0) {
            list.push({
                key,
                repeaterConnectionId: UtilitiesService.guid(),
                repeaterId: ids.repeaterId,
                locationId: ids.locationId,
                accountId: LOCAL_ACCOUNT_ID,
                canPing: false,
                canReceive: false,
                canTransmit: false,
            });
            rcWrite(list);
            idx = list.length - 1;
        }
        return list[idx];
    }

    async repeaterConnection_ToggleCanPing(conn) {
        this.repeaterConnection_Ensure(conn);
        const list = rcList();
        const key = rcKey(conn);
        const idx = list.findIndex((x) => x.key === key);
        if (idx >= 0) {
            list[idx].canPing = !!conn.canPing;
            rcWrite(list);
        }
        return true;
    }

    async repeaterConnection_ToggleCanReceive(conn) {
        this.repeaterConnection_Ensure(conn);
        const list = rcList();
        const key = rcKey(conn);
        const idx = list.findIndex((x) => x.key === key);
        if (idx >= 0) {
            list[idx].canReceive = !!conn.canReceive;
            rcWrite(list);
        }
        return true;
    }

    async repeaterConnection_ToggleCanTransmit(conn) {
        this.repeaterConnection_Ensure(conn);
        const list = rcList();
        const key = rcKey(conn);
        const idx = list.findIndex((x) => x.key === key);
        if (idx >= 0) {
            list[idx].canTransmit = !!conn.canTransmit;
            rcWrite(list);
        }
        return true;
    }

    async repeaterConnection_Delete(ids) {
        const list = rcList();
        const key = rcKey(ids);
        const filtered = list.filter((x) => x.key !== key);
        rcWrite(filtered);
        return { ok: true };
    }

    // ────────────────────────────────────────────────────────────────────────────
    // Repeaters Active (presence)
    // ────────────────────────────────────────────────────────────────────────────
    async repeatersActive_GetByAccount() {
        return raList().filter(
            (x) => (x.accountId ?? LOCAL_ACCOUNT_ID) === LOCAL_ACCOUNT_ID
        );
    }

    async repeatersActive_GetAll() {
        return raList();
    }

    async repeatersActive_WhoIsOnline(repeaterId) {
        const rid = String(repeaterId);
        return raList().filter((x) => String(x.repeaterId) === rid);
    }

    async repeatersActive_Add(data) {
        const list = raList();
        list.push({
            ...data,
            id: UtilitiesService.guid(),
            accountId: LOCAL_ACCOUNT_ID,
        });
        raWrite(list);
        return true;
    }

    async repeatersActive_Remove(match) {
        const filtered = raList().filter((x) => {
            const a = String(x.repeaterId) === String(match.repeaterId);
            const b = String(x.locationId) === String(match.locationId);
            return !(a && b); // both match → remove only when BOTH match
        });
        raWrite(filtered);
        return { ok: true };
    }

    // ******************************************************************************
    // END ITERFACE METHODS
    // ******************************************************************************

    // ────────────────────────────────────────────────────────────────────────────
    // Internals
    // ────────────────────────────────────────────────────────────────────────────
    _seedLocal() {
        // Home Locations
        if (!localStorage.getItem(K.HOME_LOCATIONS)) {
            const seedHomeLocations = [
                {
                    locationId: UtilitiesService.guid(),
                    name: 'Tampa, Florida',
                    latitude: 27.9929861345086,
                    longitude: -82.4043273925781,
                    elevation: 0,
                    accountId: LOCAL_ACCOUNT_ID,
                },
                {
                    locationId: UtilitiesService.guid(),
                    name: 'Miami, Florida',
                    latitude: 25.76221987524872,
                    longitude: -80.1939026820551,
                    elevation: 0,
                    accountId: LOCAL_ACCOUNT_ID,
                },
                {
                    locationId: UtilitiesService.guid(),
                    name: 'Tin Cup, Colorado',
                    latitude: 38.755339053713584,
                    longitude: -106.47979356664052,
                    elevation: 0,
                    accountId: LOCAL_ACCOUNT_ID,
                }
            ];
            write(K.HOME_LOCATIONS, seedHomeLocations);
        }

        // Settings
        if (!localStorage.getItem(K.SETTINGS)) {
            // point to the first seed location’s GUID
            const seeds = read(K.HOME_LOCATIONS, []);
            const defaultLocId = seeds?.[0]?.locationId ?? UtilitiesService.guid();

            const seedSettings = {
                id: 1,
                analogOnly: false,
                openOnly: false,
                zoomLevel: 8,
                locationId: defaultLocId,
                bands: '2m,70cm',
                modes: null,
                emergencyNets: null,
                centerLat: 27.9929861345086,
                centerLong: -82.4043273925781,
                showProperties: false,
                theme: 'light',
                mapStyle: 'light',
                showRxRange: true,
                showTxRange: true,
                showPingRange: true,
            };
            write(K.SETTINGS, seedSettings);
        }
    }
}

// Export class + singleton instance (so call sites can keep using localProvider.*)
export const localProvider = new LocalProvider();
