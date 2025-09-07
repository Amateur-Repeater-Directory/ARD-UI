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

import { Settings } from './models/Settings.js';

const _defaultRoot = () => (window.ard = window.ard || {});
let _root = _defaultRoot;

function setRoot(fn) {
    if (typeof fn !== 'function') throw new Error('AppState.setRoot expects a function');
    _root = fn;
}
function root() { return _root(); }
function ensure(obj, prop, init) {
    if (!Object.prototype.hasOwnProperty.call(obj, prop) || obj[prop] == null) obj[prop] = init;
    return obj[prop];
}

export const AppState = {
    setRoot,
    _root: root,

    // ──────────────────────────────
    // Plugin bay
    // ──────────────────────────────
    get services() {
        return ensure(root(), 'services', {
            api: null,
            utilities: null,
            geoMapping: null,
            toolbar: null,
            dlgRepeaterContext: null,
            dlgLogin: null,
        });
    },
    registerService(name, instance) { this.services[name] = instance; },
    getService(name) { return this.services[name]; },
    unregisterService(name) { delete this.services[name]; },
    hasService(name) { return Object.prototype.hasOwnProperty.call(this.services, name) && this.services[name] != null; },

    api() {
        return this.getIsAuthenticated() ? this.services.restApi : this.services.localApi;
    },

    // ──────────────────────────────
    // Core state (mirrors into settings where applicable)
    // ──────────────────────────────
    getIsAuthenticated: () => !!root().isAuthenticated,
    setIsAuthenticated(v) { root().isAuthenticated = !!v; },

    getMap: () => root().map ?? null,
    setMap(m) { root().map = m ?? null; },

    getMarkers: () => root().markers ?? null,
    setMarkers(m) { root().markers = m ?? null; },

    getSettings: () => root().settings ?? null,
    setSettings(s) {
        root().settings = s ?? null;
        if (!s) return;

        // Fan-out: hydrate individual fields from settings
        const locId = s.locationId;
        if (locId != null) this.setLocationId(locId);

        if (s.mapStyle != null) this.setMapStyle(s.mapStyle);
        if (s.theme != null) this.setTheme(s.theme);

        if (s.zoomLevel != null) this.setZoomLevel(s.zoomLevel);

        if (s.centerLat != null && s.centerLong != null) this.setCenter(s.centerLat, s.centerLong);

        if (s.showRxRange != null) this.setShowRxRange(!!s.showRxRange);
        if (s.showTxRange != null) this.setShowTxRange(!!s.showTxRange);
        if (s.showPingRange != null) this.setShowPingRange(!!s.showPingRange);

        if (s.searchDistance != null) this.setSearchDistance(s.searchDistance);
    },

    getHomeMarker: () => root().homeMarker ?? null,
    setHomeMarker(m) { root().homeMarker = m ?? null; },

    getHomeLocations: () => root().homeLocations ?? [],
    setHomeLocations(arr) { root().homeLocations = Array.isArray(arr) ? arr : []; },

    getLocation: () => root().location ?? null,
    setLocation(loc) { root().location = loc ?? null; },

    getLocationId: () => root().locationId ?? 0,
    setLocationId(id) {
        root().locationId = id;
        if (root().settings) root().settings.locationId = id;
    },

    getTileLayer: () => root().tileLayer ?? null,
    setTileLayer(layer) { root().tileLayer = layer ?? null; },

    getMapStyle: () => root().mapStyle ?? 'light',
    setMapStyle(style) {
        root().mapStyle = style;
        if (root().settings) root().settings.mapStyle = style;
    },

    getPreviousMapStyle: () => root().previousMapStyle ?? 'light',
    setPreviousMapStyle(style) { root().previousMapStyle = style; },

    getTheme: () => root().theme ?? 'light',
    setTheme(theme) {
        root().theme = theme ?? 'light';
        if (root().settings) root().settings.theme = root().theme;
    },

    getStopClusteringAt: () => Number(root().stopClusteringAt ?? 9),
    setStopClusteringAt(n) {
        root().stopClusteringAt = Number(n);
        if (root().settings) root().settings.stopClusteringAt = root().stopClusteringAt;
    },

    getZoomLevel: () => Number(root().zoomLevel ?? 8),
    setZoomLevel(z) {
        root().zoomLevel = Number(z);
        if (root().settings) root().settings.zoomLevel = root().zoomLevel;
    },

    getCenterLat: () => Number(root().centerLat ?? 0),
    getCenterLong: () => Number(root().centerLong ?? 0),
    setCenter(lat, lng) {
        root().centerLat = Number(lat);
        root().centerLong = Number(lng);
        if (root().settings) {
            root().settings.centerLat = root().centerLat;
            root().settings.centerLong = root().centerLong;
        }
    },

    getIs3DActive: () => !!root().is3DActive,
    setIs3DActive(v) { root().is3DActive = !!v; },

    // Range toggles
    getShowRxRange: () => !!root().showRxRange,
    setShowRxRange(v) {
        root().showRxRange = !!v;
        if (root().settings) root().settings.showRxRange = root().showRxRange;
    },
    getShowTxRange: () => !!root().showTxRange,
    setShowTxRange(v) {
        root().showTxRange = !!v;
        if (root().settings) root().settings.showTxRange = root().showTxRange;
    },
    getShowPingRange: () => !!root().showPingRange,
    setShowPingRange(v) {
        root().showPingRange = !!v;
        if (root().settings) root().settings.showPingRange = root().showPingRange;
    },

    // Data
    getMasterRepeaters: () => root().masterRepeaters ?? [],
    setMasterRepeaters(arr) { root().masterRepeaters = Array.isArray(arr) ? arr : []; },

    getFilteredRepeaters: () => root().filteredRepeaters ?? [],
    setFilteredRepeaters(arr) { root().filteredRepeaters = Array.isArray(arr) ? arr : []; },

    getRepeaterConnections: () => root().repeaterConnections ?? null,
    setRepeaterConnections(v) { root().repeaterConnections = v ?? null; },

    getSearchDistance: () => Number(root().searchDistance ?? 30),
    setSearchDistance(n) {
        root().searchDistance = Number(n);
        if (root().settings) root().settings.searchDistance = root().searchDistance;
    },

    getIcons: () => root().icons ?? null,
    setIcons(i) { root().icons = i ?? null; },

    getRepeater: () => root().repeater ?? null,
    setRepeater(r) { root().repeater = r ?? null; },

    getCanReceiveDistance: () => Number(root().canReceiveDistance ?? 0),
    setCanReceiveDistance(n) { root().canReceiveDistance = Number(n); },

    getCanPingDistance: () => Number(root().canPingDistance ?? 0),
    setCanPingDistance(n) { root().canPingDistance = Number(n); },

    getCanTransmitDistance: () => Number(root().canTransmitDistance ?? 0),
    setCanTransmitDistance(n) { root().canTransmitDistance = Number(n); },

    getLocationLatLong: () => root().locationLatLong ?? null,
    setLocationLatLong(latlng) { root().locationLatLong = latlng ?? null; },

    getMenuItemChecked: () => root().menuItemChecked ?? '/img/icon-checkmark.png',
    setMenuItemChecked(p) { root().menuItemChecked = p; },

    getMenuItemUnchecked: () => root().menuItemUnchecked ?? '/img/icon-checkmark-u.png',
    setMenuItemUnchecked(p) { root().menuItemUnchecked = p; },

    getLightTiles: () => root().lightTiles ?? null,
    setLightTiles(t) { root().lightTiles = t ?? null; },

    getTopoTiles: () => root().topoTiles ?? null,
    setTopoTiles(t) { root().topoTiles = t ?? null; },

    // ──────────────────────────────
    // Bootstrap
    // ──────────────────────────────
    bootstrap(cfg = {}) {
        const {
            services = {},
            icons = null,
            searchDistance = 30,
            mapStyle = 'light',
            withTiles = true,
        } = cfg;

        for (const [name, instance] of Object.entries(services)) {
            this.registerService(name, instance);
        }

        this.setIsAuthenticated(false);
        this.setMap(null);
        this.setMarkers(null);

        // always initialize settings
        this.setSettings(Settings.defaults());

        this.setHomeMarker(null);
        this.setHomeLocations([]);
        this.setMasterRepeaters([]);
        this.setFilteredRepeaters([]);
        this.setRepeaterConnections(null);
        this.setSearchDistance(searchDistance);
        this.setIcons(icons);
        this.setRepeater(null);

        this.setCanReceiveDistance(0);
        this.setCanPingDistance(0);
        this.setCanTransmitDistance(0);

        this.setLocationId(0);
        this.setLocation(null);
        this.setMapStyle(mapStyle);
        this.setPreviousMapStyle(mapStyle);
        this.setIs3DActive(false);

        this.setMenuItemChecked('/img/icon-checkmark.png');
        this.setMenuItemUnchecked('/img/icon-checkmark-u.png');

        if (withTiles && typeof L !== 'undefined' && L?.tileLayer) {
            const lightTiles = L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
                attribution: '&copy; OpenStreetMap contributors',
                maxZoom: 18,
            });
            const topoTiles = L.tileLayer('https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png', {
                attribution: '&copy; OpenTopoMap contributors',
                maxZoom: 18,
            });

            this.setLightTiles(lightTiles);
            this.setTopoTiles(topoTiles);
            this.setTileLayer(lightTiles);
        } else {
            this.setLightTiles(null);
            this.setTopoTiles(null);
            this.setTileLayer(null);
        }
    },
};
