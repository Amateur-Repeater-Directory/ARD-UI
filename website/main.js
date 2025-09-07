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

import { AppState } from './js/appState.js';

import { restProvider } from './js/providers/restProvider.js';
import { localProvider } from './js/providers/localProvider.js';

import { MapService } from './js/services/mapService.js';
import { GeoMappingService } from './js/services/geoMappingService.js';
import { HomeLocationService } from './js/services/homeLocationService.js';
import { UnitsService } from './js/services/unitsService.js';
import { ToolbarService } from './js/services/toolbarService.js';
import { UtilitiesService } from './js/services/utilitiesService.js';
import { LosService } from './js/services/losService.js';
import { RadioService } from './js/services/radioService.js';
import { RadioLosService } from './js/services/radioLosService.js';

import { DlgLogin } from './js/dialogs/dlgLogin.js';
import { DlgRegister } from './js/dialogs/dlgRegister.js';
import { DlgRepeaterContext } from './js/dialogs/dlgRepeaterContext.js';
import { DlgAddHomeLocation } from './js/dialogs/dlgAddHomeLocation.js';
import { DlgResetPassword } from './js/dialogs/dlgResetPassword.js';
import { DlgAddEditRepeater } from './js/dialogs/dlgAddEditRepeater.js';
import { ForgotPasswordDialog } from './js/dialogs/dlgForgotPassword.js';

// 1️⃣ BOOT GUARD
if (window.__APP_BOOTED__) {
    console.warn('Duplicate main.js load — ignoring');
    throw new Error('duplicate main.js load');
}
window.__APP_BOOTED__ = true;

AppState.bootstrap({
    services: {
        restApi: restProvider,
        localApi: localProvider,
        losService: LosService,
        utilitiesService: UtilitiesService,
        geoMappingService: GeoMappingService,
        homeLocationService: HomeLocationService,
        unitsService: UnitsService,
        mapService: MapService,
        radioService: RadioService,
        toolbarService: new ToolbarService(),
        dlgRepeaterContext: new DlgRepeaterContext(),
        dlgLogin: new DlgLogin(),
        dlgResetPassword: new DlgResetPassword(),
        dlgAddHomeLocation: new DlgAddHomeLocation(),
        dlgRegister: new DlgRegister(),
        dlgAddEditRepeater: new DlgAddEditRepeater(),
        dlgForgotPassword: new ForgotPasswordDialog()
    },
    icons: MapService.createMarkerIcons(),
    searchDistance: 30,
    mapStyle: 'light',
    withTiles: true
});

let suppressHomeLocationChange = false;

window.closeLeafletPopup = function (el, event) {
    if (event) {
        event.preventDefault();
        event.stopPropagation();
    }
    const popup = el.closest('.leaflet-popup');
    if (popup) {
        AppState.getMap().closePopup();
    }
};

// ========================================================================
// Initial settings and map creation
// ========================================================================
AppState.setIsAuthenticated(await AppState.services.restApi.isAuthenticated());
AppState.api().suspendSettingsUpdates();

let settings = await AppState.api().mapSettings_Get();
AppState.setSettings(settings);

// Create Leaflet map early (empty), layers/markers added in initMap
let map = L.map('map', {
    center: new L.LatLng(settings.centerLat, settings.centerLong),
    zoom: settings.zoomLevel,
    maxZoom: 18,
    doubleClickZoom: false,  // reserve dblclick/double-tap for your dialog
    tap: true,               // let Leaflet synthesize dblclick from double-tap
    tapTolerance: 45         // small drift between taps on phones
});

// You must go through AppState always
settings = null;

AppState.setMap(map);
AppState.getMap().addLayer(AppState.getTileLayer());

// ===============================
//  Global UI & Map Logic
// ===============================
let clusterRadius = 30;

function initMap(
    repeaters,
    homeLocations,
    repeaterConnections,
    activeRepeaters
) {
    AppState.setMasterRepeaters(repeaters);
    AppState.setFilteredRepeaters(repeaters.slice(0));
    AppState.setRepeaterConnections(repeaterConnections);

    if (homeLocations) {
        AppState.setHomeLocations(homeLocations);
    }

    // Hookup Repeater Connections
    if (repeaterConnections && repeaterConnections.length > 0) {

        // 1) Index connections by repeaterId (O(M))
        const byRepeater = repeaterConnections.reduce((map, rc) => {
            if (!map.has(rc.repeaterId)) map.set(rc.repeaterId, []);
            map.get(rc.repeaterId).push(rc);
            return map;
        }, new Map());

        // 2) Apply to each repeater (O(N))
        for (const repeater of repeaters) {
            const conns = byRepeater.get(repeater.repeaterId);
            if (conns?.length) {
                repeater.setConnections(conns);
            }
        }
    }

    // Marker cluster setup
    let markers = L.markerClusterGroup({
        chunkedLoading: true,
        spiderfyOnMaxZoom: true,
        showCoverageOnHover: false,
        zoomToBoundsOnClick: false,
        spiderfyDistanceMultiplier: 1.25,
        maxClusterRadius: clusterRadius,              // <- looser/tighter clustering
        disableClusteringAtZoom: AppState.getMap().getMaxZoom() + 1 // <- never auto-disable (keeps twins clustered)
    });

    markers.on('clusterclick', e => e.layer.spiderfy());

    AppState.getMap().addLayer(markers);
    AppState.setMarkers(markers);

    const locateCtl = L.control.locate({
        position: 'topright',
        setView: 'once',
        flyTo: true,
        drawMarker: false,
        drawCircle: false,
        showCompass: false,
        showPopup: false,
        icon: 'bi bi-crosshair',
        clickBehavior: {
            inView: 'setView',
            inViewNotFollowing: 'setView',
            outOfView: 'setView'
        },
        locateOptions: {
            enableHighAccuracy: true,
            maximumAge: 0,
            timeout: 12000,
            watch: false
        }
    }).addTo(AppState.getMap());
    MapService.bindLocateOpensHomeDialog(locateCtl);

    // Build geojson from filtered repeaters
    const geojson = {
        type: 'FeatureCollection',
        features: AppState.getFilteredRepeaters().map((r) => ({
            type: 'Feature',
            geometry: { type: 'Point', coordinates: r.toLongLat() },
            properties: r,
        })),
    };

    // Use the already-decided AppState.getLocationId() (set earlier in setup)
    const currentLocId = AppState.getLocationId();

    L.geoJSON(geojson, {
        pointToLayer: (data, latlng) => {
            const repeater = data.properties;

            const { canPing, canReceive, canTransmit } =
                repeater.getRepeaterConnectionStatus(currentLocId);

            const marker = L.marker(latlng, {
                icon: MapService.getAppropriateMarkerIcon(
                    repeater,
                    canPing,
                    canReceive,
                    canTransmit
                ),
                title: `${repeater.callsign} : ${repeater.outputFrequency.toFixed(5)}`,
                contextmenu: true,
                contextmenuWidth: 200,
                contextmenuInheritItems: false,
                riseOnHover: true,
                contextmenuItems: [
                    { text: 'Simulate NET', callback: () => alert('Coming Soon ...') },
                ],
            });

            marker.on('click', () => {

                MapService.clearSelectedMarker();
                AppState.setRepeater(marker.repeater);

                AppState.services.toolbarService.onRepeaterClick(
                    marker.repeater,
                    AppState.getLocationId()
                );
                MapService.selectMarker(marker);
            });

            // We still have local copies, no need to hit AppState
            marker.repeater = repeater;
            repeater.marker = marker;

            markers.addLayer(marker);
            return marker;
        },
    });

    const map = AppState.getMap();

    // Debounce single-tap so it won't fire on a dblclick/double-tap
    let clickTimer = null;
    const CLICK_DELAY = 275; // ~Leaflet dblclick window

    map.on('click', () => {
        //   UtilitiesService.displayToast('warning','A verification email has been sent to you …');

        if (clickTimer) clearTimeout(clickTimer);
        clickTimer = setTimeout(() => {
            clickTimer = null;
            MapService.clearSelectedMarker();
        }, CLICK_DELAY);
    });

    map.on('dblclick', () => {
        if (clickTimer) { clearTimeout(clickTimer); clickTimer = null; }
    });


    bindHomeLocations();

    AppState.getMap().on('moveend', function () {
        let currentLatLong = AppState.getMap().getCenter();
        AppState.setCenter(currentLatLong.lat, currentLatLong.lng);
        AppState.api().mapSettings_Changed(AppState.getSettings(), 'move-end');
    });

    AppState.getMap().on('zoomend', function () {
        let currentLatLong = AppState.getMap().getCenter();
        AppState.setCenter(currentLatLong.lat, currentLatLong.lng);
        AppState.setZoomLevel(AppState.getMap().getZoom());
        AppState.api().mapSettings_Changed(AppState.getSettings(), 'zoom-end');
    });
}

function bindHomeLocations(selectedId) {
    const select = document.getElementById('citySelect');
    select.innerHTML = '';

    const fragment = document.createDocumentFragment();
    AppState.getHomeLocations().forEach(({ locationId, name }) => {
        const opt = document.createElement('option');
        opt.value = String(locationId);
        opt.textContent = name;
        if (selectedId != null && String(locationId) === String(selectedId)) {
            opt.selected = true; // select during bind to avoid races
        }
        fragment.appendChild(opt);
    });
    select.appendChild(fragment);
}

async function applySettingsOnStartup() {
    const settings = AppState.getSettings();
    const toolbar = AppState.services.toolbarService;

    // Theme & map style
    toolbar.setTheme(settings.theme);
    toolbar.setMapStyle(settings.mapStyle);
    toolbar.updateThemeButton();
    toolbar.updateMapButton();

    AppState.setCenter(settings.centerLat, settings.centerLong);

    toolbar.setShowRxRange(settings.showRxRange);
    toolbar.setShowPingRange(settings.showPingRange);
    toolbar.setShowTxRange(settings.showTxRange);

    // Ensure the select reflects chosen location id (options already bound)
    suppressHomeLocationChange = true;
    bindHomeLocations(settings.locationId);
    const select = document.getElementById('citySelect');
    select.value = String(settings.locationId);
    suppressHomeLocationChange = false;

    // Paint for current location without fly
    await HomeLocationService.setHomeLocation(settings.locationId, false);
}

// Mobile toolbar spacing fix
function adjustToolbar() {
    const rightBlock = document.querySelector(
        '.toolbar .d-flex.align-items-center.ms-auto'
    );
    if (!rightBlock) return;
    if (window.innerWidth < 576) rightBlock.classList.remove('ms-auto');
    else if (!rightBlock.classList.contains('ms-auto'))
        rightBlock.classList.add('ms-auto');
}

window.addEventListener('resize', adjustToolbar);
adjustToolbar();

// Sidebar resize logic
const sidebar = document.getElementById('sidebar');
const toggleBtn = document.getElementById('toggleSidebar');
const dragHandle = document.getElementById('dragHandle');

toggleBtn?.addEventListener('click', () => {
    const hidden = sidebar.classList.toggle('hidden');
    dragHandle.style.display = hidden ? 'none' : 'block';
    document.activeElement.blur();
    setTimeout(() => AppState.getMap().invalidateSize(), 10);
});

let isDraggingWidth = false;
dragHandle?.addEventListener('mousedown', () => {
    isDraggingWidth = true;
    document.body.style.cursor = 'ew-resize';
});
window.addEventListener('mousemove', (e) => {
    if (!isDraggingWidth) return;
    const newWidth = window.innerWidth - e.clientX;
    if (newWidth > 150 && newWidth < window.innerWidth * 0.9) {
        sidebar.style.width = newWidth + 'px';
        AppState.getMap().invalidateSize();
    }
});
window.addEventListener('mouseup', () => {
    isDraggingWidth = false;
    document.body.style.cursor = 'default';
});

// City select change
document.getElementById('citySelect').addEventListener('change', async (e) => {
    if (suppressHomeLocationChange) return;

    const locationId = String(e.target.value);
    if (!locationId) return;

    await HomeLocationService.setHomeLocation(locationId, true);
});

// Filter modal height
function calcFilterModalHeight() {
    const tabContent = document.querySelector('#filterModal .tab-content');
    if (!tabContent) return;
    let max = 0;
    tabContent.querySelectorAll('.tab-pane').forEach((p) => {
        const wasShow = p.classList.contains('show');
        const wasActive = p.classList.contains('active');
        p.classList.add('show', 'active');
        p.style.position = 'absolute';
        p.style.visibility = 'hidden';

        max = Math.max(max, p.offsetHeight);

        p.style.position = '';
        p.style.visibility = '';
        if (!wasShow) p.classList.remove('show');
        if (!wasActive) p.classList.remove('active');
    });
    tabContent.style.minHeight = max + 'px';
}

document
    .getElementById('filterModal')
    ?.addEventListener('shown.bs.modal', calcFilterModalHeight);
window.addEventListener('resize', calcFilterModalHeight);
document
    .querySelectorAll('#filterModal [data-bs-toggle="tab"]')
    .forEach((btn) => {
        btn.addEventListener('shown.bs.tab', calcFilterModalHeight);
    });

// Call this right after you create the Leaflet map
function enableAddHomeByMap(map) {
    const cameFromControl = (e) =>
        !!(e.originalEvent && e.originalEvent.target.closest('.leaflet-control'));

    map.on('dblclick', (e) => {
        if (cameFromControl(e)) return;
        if (e.originalEvent) L.DomEvent.stop(e.originalEvent);
        AppState.services.dlgAddHomeLocation.showAddHomeLocModal(e.latlng.lat, e.latlng.lng);
    });

    map.on('contextmenu', (e) => {
        if (e.originalEvent) L.DomEvent.stop(e.originalEvent); // prevent default + stop bubbling

        // Clear accidental selection (some Android builds leave a range active)
        try { window.getSelection?.()?.removeAllRanges?.(); } catch { }

        AppState.services.dlgAddHomeLocation.showAddHomeLocModal(e.latlng.lat, e.latlng.lng);
    });

    // IMPORTANT: no map.on('click') here
}

// =======================
// STARTUP
// =======================
async function startApp() {
    try {
        AppState.services.toolbarService.initListeners();

        AppState.services.toolbarService.updateMapButton();
        AppState.services.toolbarService.updateThemeButton();

        AppState.services.dlgLogin.initListeners();
        AppState.services.dlgAddHomeLocation.initListeners();
        AppState.services.dlgRepeaterContext.initListeners();
        AppState.services.dlgForgotPassword.initListeners();
        AppState.services.dlgRegister.initListeners();
        AppState.services.dlgResetPassword.initListeners();
        AppState.services.dlgAddEditRepeater.initListeners();

        if (AppState.getIsAuthenticated()) {
            document.querySelector('#LoginLogoutButton').textContent = 'Logout';
        } else {
            document.querySelector('#LoginLogoutButton').textContent = 'Login';
        }

        const [repeaters, homeLocs, repeaterConns, activeRep] =
            await Promise.all([
                AppState.api().repeaters_GetAll(),
                AppState.api().homeLocations_GetAll(),
                AppState.api().repeaterConnections_GetAll(),
                AppState.api().repeatersActive_GetByAccount(),
            ]);

        initMap(repeaters, homeLocs, repeaterConns, activeRep);
        await applySettingsOnStartup(homeLocs);

        AppState.api().resumeSettingsUpdates();

        enableAddHomeByMap(AppState.getMap());

        setTimeout(() => {
            const found = UtilitiesService.getResetTokenFromUrl();
            if (found) {
                AppState.services.dlgResetPassword.showDialog(found.token);
            }
        }, 1000);


    } catch (err) {
        console.error('Error during setup:', err);
    } finally {
        // no-op
    }
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', startApp, { once: true });
} else {
    startApp();
}
