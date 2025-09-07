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

// GeoMappingService.js
import { AppState } from '../appState.js';
import { MapService } from '../services/mapService.js';
import { UtilitiesService } from '../services/utilitiesService.js';

/**
 * Service for selecting and drawing repeater distance/range information.
 * Uses AppState for all state access — no window.ARD references.
 */
export class HomeLocationService {

    static async addHomeLocation(homeLocation) {

        if (await AppState.api().homeLocation_Exists(homeLocation.name)) {
            UtilitiesService.displayToast('error', 'A location with this name already exists');
            return false;
        }

        var updatedLocation = await AppState.api().homeLocation_Add(homeLocation);
        await HomeLocationService.populateHomeLocationSelect(updatedLocation.locationId);
        await HomeLocationService.setHomeLocation(updatedLocation.locationId, true);
        return updatedLocation;
    }

    static async deleteHomeLocation(locationId) {

        if (AppState.getHomeLocations().length === 1) {
            UtilitiesService.displayToast('error', 'Cannot delete your only Location');
            return;
        }

        await AppState.api().homeLocation_Delete(locationId);
        let homeLocations = AppState.getHomeLocations();
        homeLocations.splice(homeLocations.findIndex(item => item.locationId === locationId), 1);
        AppState.setHomeLocations(homeLocations);
        await HomeLocationService.populateHomeLocationSelect();
        await HomeLocationService.setHomeLocation(homeLocations[0].locationId, true);
    }

    static async setHomeLocation(locationId, flyTo) {

        const geoSvc = AppState.services.geoMappingService;
        const toolbar = AppState.services.toolbarService;
        const map = AppState.getMap();
        const icons = AppState.getIcons();
        const locations = AppState.getHomeLocations();

        if (!geoSvc || !map || !locations?.length) return;

        geoSvc.clearRangeCircles();

        const loc = await AppState.api().homeLocation_GetById(locationId);
        if (!loc) return;

        AppState.setLocation(loc);
        AppState.setLocationId(loc.locationId);
        AppState.setLocationLatLong(L.latLng(loc.latitude, loc.longitude));

        // remove existing home marker if present
        const existing = AppState.getHomeMarker();
        if (existing && map.hasLayer(existing)) {
            map.removeLayer(existing);
        }

        // add new home marker
        const marker = L.marker([loc.latitude, loc.longitude], {
            icon: icons?.baseIcon,
            zIndexOffset: 999,
            contextmenu: true,
            contextmenuWidth: 200,
            contextmenuInheritItems: false,
            contextmenuItems: [
                {
                    text: 'Delete Location', callback: async () => {
                        HomeLocationService.deleteHomeLocation(loc.locationId);
                    }
                }
            ],
        }).addTo(map);

        marker.alt = loc.name;
        AppState.setHomeMarker(marker);

        function callback() {
            // Set icons based on this location (use setIcon to repaint)
            const markers = AppState.getMarkers();
            AppState.getFilteredRepeaters().forEach(repeater => {
                const { canPing, canReceive, canTransmit } =
                    repeater.getRepeaterConnectionStatus(loc.locationId);

                const newIcon = MapService.getAppropriateMarkerIcon(
                    repeater, canPing, canReceive, canTransmit
                );

                repeater.marker?.setIcon?.(newIcon);
            });

            // redraw ranges
            geoSvc.drawRangeCircle(toolbar.isShowRxRangeOn(), 'rx');
            geoSvc.drawRangeCircle(toolbar.isShowPingRangeOn(), 'ping');
            geoSvc.drawRangeCircle(toolbar.isShowTxRangeOn(), 'tx');

            // refresh clusters after bulk icon changes (if available)
            AppState.getMarkers()?.refreshClusters?.();

            AppState.api().mapSettings_Changed(AppState.getSettings(), 'HomeLocation');
        }

        if (!flyTo) {
            callback();
        } else {
            // fly & then repaint
            await MapService.flyToWithDelayedMarkers(map, [loc.latitude, loc.longitude], 1, callback);
        }
    }

    static async populateHomeLocationSelect(selectedId = null) {
        const el = document.getElementById('citySelect');
        if (!el) return; // guard: element not present yet

        const list = await AppState.api().homeLocations_GetAll();
        list.sort((a, b) => (a.name || '').localeCompare(b.name || '', undefined, { sensitivity: 'base' }));

        el.innerHTML = '';
        for (const h of list) {
            const opt = document.createElement('option');
            opt.value = String(h.locationId);
            opt.textContent = h.name;
            el.appendChild(opt);
        }
        if (selectedId != null) el.value = String(selectedId);
    }

}