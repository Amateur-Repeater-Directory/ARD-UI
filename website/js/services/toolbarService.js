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

// toolbarSvc.js
import { AppState } from '../appState.js';
import { GeoMappingService } from './geoMappingService.js';
import { Repeater } from '../models/Repeater.js';

/**
 * Service to handle toolbar interactions: map/theme toggles and range buttons.
 */
export class ToolbarService {

    constructor() {
        this.created = false;
        this.modal = null;
        // no more this.ARD = window.ard;
    }

    // Update the map-toggle button icon
    updateMapButton() {
        const icon = document.querySelector('#btn-map-toggle i');
        if (!icon) return;
        icon.className = this.isMapDark() ? 'bi bi-moon-stars' : 'bi bi-sun';
    }

    // Update the theme-toggle button icon
    updateThemeButton() {
        const icon = document.querySelector('#btn-theme-toggle i');
        if (!icon) return;
        icon.className = this.isThemeDark() ? 'bi bi-moon-stars' : 'bi bi-sun';
    }

    // Toggle between 3D/topo mode and normal map styles
    toggle3D() {
        const btn3D = document.getElementById('btn-3d');
        const btnMapToggle = document.getElementById('btn-map-toggle');

        const is3D = !AppState.getIs3DActive();
        AppState.setIs3DActive(is3D);

        if (is3D) {
            AppState.setPreviousMapStyle(AppState.getMapStyle());
            this.setMapStyle('topo');
            btn3D?.classList.add('active');
            if (btnMapToggle) btnMapToggle.disabled = true;
        } else {
            btn3D?.classList.remove('active');
            if (btnMapToggle) btnMapToggle.disabled = false;
            this.setMapStyle(AppState.getPreviousMapStyle());
        }
    }

    // Change the map tile layer and theme class
    setMapStyle(style) {
        const map = AppState.getMap();
        const currentLayer = AppState.getTileLayer();
        if (currentLayer && map) {
            map.removeLayer(currentLayer);
        }

        const mapContainer = document.getElementById('map');
        mapContainer?.classList.remove('leaflet-dark-mode');

        AppState.setMapStyle(style);

        let nextLayer = null;
        if (style === 'light') {
            nextLayer = AppState.getLightTiles();
        } else if (style === 'dark') {
            nextLayer = AppState.getLightTiles(); // same tiles, dark CSS class
            mapContainer?.classList.add('leaflet-dark-mode');
        } else {
            // 'topo'
            nextLayer = AppState.getTopoTiles();
        }

        AppState.setTileLayer(nextLayer);
        if (map && nextLayer) {
            map.addLayer(nextLayer);
        }

        AppState.setMapStyle(style);
        AppState.api().mapSettings_Changed(AppState.getSettings(), 'setMapStyle');
    }

    isShowRxRangeOn() { return this.isToggleOn('btn-rx'); }
    isShowPingRangeOn() { return this.isToggleOn('btn-ping'); }
    isShowTxRangeOn() { return this.isToggleOn('btn-tx'); }

    // for real <button data-bs-toggle='button'>
    setShowRxRange(isOn) {
        const btn = document.getElementById('btn-rx');
        if (!btn) return;
        const on = !!isOn;
        btn.classList.toggle('active', on);
        btn.setAttribute('aria-pressed', String(on));
    }
    setShowPingRange(isOn) {
        const btn = document.getElementById('btn-ping');
        if (!btn) return;
        const on = !!isOn;
        btn.classList.toggle('active', on);
        btn.setAttribute('aria-pressed', String(on));
    }
    setShowTxRange(isOn) {
        const btn = document.getElementById('btn-tx');
        if (!btn) return;
        const on = !!isOn;
        btn.classList.toggle('active', on);
        btn.setAttribute('aria-pressed', String(on));
    }

    // Helpers for theme and map checks
    isMapDark() {
        return AppState.getMapStyle() === 'dark';
    }

    isThemeDark() {
        return document.documentElement.getAttribute('data-bs-theme') === 'dark';
    }

    setTheme(mode) {
        document.documentElement.setAttribute('data-bs-theme', mode);
        AppState.setTheme(mode);
        AppState.api().mapSettings_Changed(AppState.getSettings(), 'setTheme');
    }

    wireRxButton() {
        const btn = document.getElementById('btn-rx');
        if (!btn) return;

        btn.addEventListener('click', () => {
            const isOn = btn.classList.contains('active');

            AppState.setShowRxRange(isOn);
            AppState.services.geoMappingService.drawRangeCircle(isOn, 'rx');
            AppState.api().mapSettings_Changed(AppState.getSettings(), 'toggle-btn-rx');

            btn.blur();
        });
    }

    wirePingButton() {
        const btn = document.getElementById('btn-ping');
        if (!btn) return;

        btn.addEventListener('click', () => {
            const isOn = btn.classList.contains('active');

            AppState.setShowPingRange(isOn);
            AppState.services.geoMappingService.drawRangeCircle(isOn, 'ping');
            AppState.api().mapSettings_Changed(AppState.getSettings(), 'toggle-btn-ping');

            btn.blur();
        });
    }

    wireTxButton() {
        const btn = document.getElementById('btn-tx');
        if (!btn) return;

        btn.addEventListener('click', () => {
            const isOn = btn.classList.contains('active');

            AppState.setShowTxRange(isOn);
            AppState.services.geoMappingService.drawRangeCircle(isOn, 'tx');
            AppState.api().mapSettings_Changed(AppState.getSettings(), 'toggle-btn-tx');

            btn.blur();
        });
    }


    setToggleButton(id, on) {
        const btn = document.getElementById(id);
        if (!btn) return;
        btn.classList.toggle('active', !!on);
        btn.setAttribute('aria-pressed', String(!!on)); // keep a11y in sync
    }

    isToggleOn(id) {
        return !!document.getElementById(id)?.classList.contains('active');
    }

    // Attach event listeners to toolbar buttons
    initListeners() {
        this.modalEl = document.querySelector('#repeaterContextModal');
        this.btnClose = this.modalEl?.querySelector('.btn-close');
        this.toggleBtn = this.modalEl?.querySelector('#toggleOnlineBtn');

        document.getElementById('btn-map-toggle')?.addEventListener('click', () => {
            this.setMapStyle(this.isMapDark() ? 'light' : 'dark');
            this.updateMapButton();
            document.activeElement?.blur();
        });

        document.getElementById('btn-theme-toggle')?.addEventListener('click', () => {
            this.setTheme(this.isThemeDark() ? 'light' : 'dark');
            this.updateThemeButton();
            document.activeElement?.blur();
        });

        document.getElementById('btn-3d')?.addEventListener('click', () => {
            this.toggle3D();
            document.activeElement?.blur();
        });

        document.getElementById('btn-rx')?.addEventListener('click', function () {
            const isActive = this.checked;

            AppState.setShowRxRange(isActive);
            AppState.services.geoMappingService.drawRangeCircle(isActive, 'rx');
            AppState.api().mapSettings_Changed(AppState.getSettings(), 'toggle-btn-rx');
        });

        this.wireRxButton();
        this.wirePingButton();
        this.wireTxButton();

        // Cluster zoom stop control
        document.getElementById('clusterZoom')?.addEventListener('change', (e) => {
            const stopClusteringAt = parseInt(e.target.value, 10);
            if (!isNaN(stopClusteringAt)) {
                const markers = AppState.getMarkers();
                const map = AppState.getMap();

                if (markers) {
                    markers.options.disableClusteringAtZoom = stopClusteringAt;
                }

                if (map) {
                    map.eachLayer((layer) => {
                        if (layer instanceof L.TileLayer) layer.redraw();
                    });
                    this._updateDisableClusteringAtZoom(map, stopClusteringAt);
                }

                AppState.setStopClusteringAt(stopClusteringAt);
                AppState.api().mapSettings_Changed(AppState.getSettings(), 'stopClusteringAt');
            }
        });
    }

    turnOffDrawRangeButtons() {
        document.querySelectorAll('.btn-check').forEach(cb => {
            cb.checked = false;
            cb.dispatchEvent(new Event('change'));
        });
    }

    turnOnDrawRangeButtons() {
        document.querySelectorAll('.btn-check').forEach(cb => {
            cb.checked = true;
            cb.dispatchEvent(new Event('change'));
        });
    }

    updatePropertiesWindow(repeater) {
        let units = AppState.services.unitsService;

        const propertyFormatters = {
            callsign: rep => rep.callsign,
            band: rep => rep.band,
            outputFrequency: rep => rep.outputFrequency.toFixed(5),
            inputFrequency: rep => rep.inputFrequency.toFixed(5),
            offset: rep => `${rep.offsetSign} ${Math.abs(rep.offset).toFixed(3)}`,
            toneMode: rep => rep.toneMode,
            ctcssTx: rep => rep.ctcssTx?.toFixed(2) ?? '',
            ctcssRx: rep => rep.ctcssRx?.toFixed(2) ?? '',
            isCrossTone: rep => rep.isCrossTone ? 'Yes' : 'No',
            latitude: rep => rep.latitude.toFixed(4),
            longitude: rep => rep.longitude.toFixed(4),
            elevation: rep => units.toImperialElevation(rep.elevation),
            aboveGroundLevel: rep => units.toImperialElevation(rep.aboveGroundLevel),
            isLatLongPrecise: rep => rep.isLatLongPrecise ? 'Yes' : 'No',
            state: rep => rep.state,
            county: rep => rep.county,
            nearestCity: rep => rep.nearestCity,
            isOperational: rep => rep.isOperational ? 'Yes' : 'No',
            isOpen: rep => rep.isOpen ? 'Yes' : 'No',
            isCoordinated: rep => rep.isCoordinated ? 'Yes' : 'No',
            isSkywarn: rep => rep.isSkywarn ? 'Yes' : 'No',
            isAres: rep => rep.isAres ? 'Yes' : 'No',
            isRaces: rep => rep.isRaces ? 'Yes' : 'No',
            hasLocationError: rep => rep.hasLocationError ? 'Yes' : 'No',
        };

        document.querySelectorAll('td[data-field]').forEach(td => {
            const field = td.dataset.field;
            const formatter = propertyFormatters[field];
            let value;
            if (formatter) {
                value = formatter(repeater);
            } else {
                value = repeater[field] != null ? repeater[field].toString() : '';
            }
            td.textContent = value;
        });
    }

    onRepeaterClick(repeater, locationId) {
        // Populate fields
        document.getElementById('rcd-callsign').textContent = repeater.callsign;
        document.getElementById('rcd-frequency').textContent = repeater.outputFrequency.toFixed(5);
        document.getElementById('rcd-location').textContent = `${repeater.nearestCity}, ${repeater.state}`;

        const { canPing, canReceive, canTransmit } = repeater.getRepeaterConnectionStatus(locationId);
        document.getElementById('pingOption').checked = canPing;
        document.getElementById('rxOption').checked = canReceive;
        document.getElementById('txOption').checked = canTransmit;

        // Create modal only once
        if (!this.created) {
            // Reset checkboxes & pulsate
            this.modalEl.querySelectorAll('.btn-check').forEach(cb => cb.checked = false);
            this.toggleBtn.classList.remove('pulsate');

            // Make dialog draggable
            this._makeModalDraggable();

            // Instantiate Bootstrap modal
            this.modal = new bootstrap.Modal(this.modalEl, {
                backdrop: false,
                keyboard: true,
                focus: false
            });

            const dialog = this.modalEl.querySelector('.modal-dialog');

            const y = Math.round(window.innerHeight * 0.16666);  // 1/6th in px
            dialog.style.position = 'fixed';
            dialog.style.left = '1rem';
            dialog.style.top = y + 'px';
            dialog.style.transform = 'none';
            dialog.style.margin = '0';

            this.created = true;
        }

        // Show existing modal
        this.modal = bootstrap.Modal.getOrCreateInstance(this.modalEl, {
            backdrop: false, keyboard: true, focus: false
        });
        this.modal.show();

        // Optionally update other UI
        this.updatePropertiesWindow(repeater);
    }

    _makeModalDraggable() {
        const dialog = this.modalEl.querySelector('.modal-dialog');
        const header = this.modalEl.querySelector('.modal-header');
        let dragging = false, startX, startY, origX, origY;

        const onStart = (x, y) => {
            dragging = true;
            startX = x; startY = y;
            const rect = dialog.getBoundingClientRect(); origX = rect.left; origY = rect.top;
            document.body.style.userSelect = 'none';
            dialog.style.position = 'absolute';
            dialog.style.left = origX + 'px';
            dialog.style.top = origY + 'px';
        };

        const onMove = (x, y) => {
            if (!dragging) return;
            dialog.style.left = origX + (x - startX) + 'px';
            dialog.style.top = origY + (y - startY) + 'px';
        };

        const onEnd = () => {
            dragging = false;
            document.body.style.userSelect = '';
        };

        header.addEventListener('mousedown', e => onStart(e.clientX, e.clientY));
        document.addEventListener('mousemove', e => onMove(e.clientX, e.clientY));
        document.addEventListener('mouseup', onEnd);

        header.addEventListener('touchstart', e => {
            if (e.target.closest('.btn-close')) return;
            if (e.target.closest('.bi-gear')) return;
            const t = e.touches[0]; onStart(t.clientX, t.clientY);
        }, { passive: false });
        document.addEventListener('touchmove', e => {
            const t = e.touches[0]; onMove(t.clientX, t.clientY);
        }, { passive: false });
        document.addEventListener('touchend', onEnd);
    }
}
