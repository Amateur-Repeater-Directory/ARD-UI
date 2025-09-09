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

import { AppState } from '../appState.js';
import { GeoMappingService } from '../services/geoMappingService.js';
import { ToolbarService } from '../services/toolbarService.js';
import { MapService } from '../services/mapService.js';
import { UtilitiesService } from '../services/utilitiesService.js';
import { LosService } from '../services/losService.js';

export class DlgRepeaterContext {
    /**
     * @param {string} modalSelector CSS selector for the modal container
     */
    constructor(modalSelector = '#repeaterContextModal') {
        this.modalSelector = modalSelector;
        this.toolbarService = new ToolbarService();
    }

    async _lineOfSightClicked(e) {
        const homeLoc = AppState.getLocation();
        const rptr = AppState.getRepeater();

        const home = {
            id: homeLoc.locationId,
            lat: Number(homeLoc.latitude),
            lng: Number(homeLoc.longitude),
            elevation: Number(homeLoc.elevation),
            agl: Number(homeLoc.aboveGroundLevel) || 1.5
        };

        const repeater = {
            id: rptr.repeaterId,
            lat: Number(rptr.latitude),
            lng: Number(rptr.longitude),
            elevation: Number(rptr.elevation),
            agl: Number(rptr.aboveGroundLevel) || 15
        };

        try {
            if (!AppState.getIsAuthenticated()) {
                UtilitiesService.displayToast('warning', 'You must be logged in to use the Line-of-Sight feature.');
                return;
            }

            // Server compute (returns summary + profile points)
            const losData = await LosService.computeLos(home, repeater, {
                stepMeters: 200,
                freqMHz: Number(rptr.outputFrequency),
                kFactor: (4 / 3),
                fresnelFraction: 0.4
            });

            // Distance for subtitle
            const miles = Number(GeoMappingService.distanceFromBaseInMiles(rptr));

            const charts = await LosService.showLosChart(losData, miles, {
                tickCount: 8,
                callsign: rptr.callsign,
                homeAglM: Number(homeLoc.aboveGroundLevel),
                rptAglM: Number(rptr.aboveGroundLevel),
                freqMHz: Number(rptr.outputFrequency),
                kFactor: losData.summary.kFactor,
                fresnelFraction: losData.summary.fresnelFraction
            });

            document.getElementById('losModal')
                ?.addEventListener('shown.bs.tab', (e) => {
                    const t = e.target.getAttribute('data-bs-target');
                    if (t === '#los-view-a' && window._losChartA?.resize) window._losChartA.resize();
                    if (t === '#los-view-b' && window._losChartB?.resize) window._losChartB.resize();
                });

        } catch (err) {
            if (err.status && err.status === 401) {
                UtilitiesService.displayToast('warning', 'You must be logged in to use the Line-of-Sight feature.');
            }
            alert('LOS failed: ' + (err.message || err));
        }
    }


    /**
     * Wire up all DOM event listeners. Call after DOMContentLoaded.
     */
    initListeners() {
        // Query elements now that the DOM is ready
        this.modalEl = document.querySelector(this.modalSelector);
        this.btnClose = this.modalEl.querySelector('.btn-close');
        this.txOption = this.modalEl.querySelector('#txOption');
        this.rxOption = this.modalEl.querySelector('#rxOption');
        this.pingOption = this.modalEl.querySelector('#pingOption');
        this.toggleBtn = this.modalEl.querySelector('#toggleOnlineBtn');
        this.advancedBtn = this.modalEl.querySelector('#repeaterModalAdvancedBtn');

        // Close button hides the modal
        this.btnClose.addEventListener('click', () => {
            bootstrap.Modal.getOrCreateInstance(this.modalEl, {
                backdrop: false, keyboard: true, focus: false
            }).hide();
        });

        // Transmit toggle
        this.txOption.addEventListener('change', () => this._onTransmitToggle());
        // Receive toggle
        this.rxOption.addEventListener('change', () => this._onReceiveToggle());
        // Ping toggle
        this.pingOption.addEventListener('change', () => this._onPingToggle());

        // Online pulsate toggle
        this.toggleBtn.addEventListener('click', () => this._onToggleOnline());

        this.advancedBtn.addEventListener('click', () => {
            UtilitiesService.displayToast('info', 'Feature coming soon ...');
        });

        this.modalEl.addEventListener('hidden.bs.modal', () => this._onClose());

        // assuming services.los is your LosService/LosClient instance
        document.getElementById('btnlineOfSight').addEventListener('click', async (e) => {
            const btn = e.currentTarget;
            btn.disabled = true;

            try {
                await this._lineOfSightClicked(e);
            } catch (err) {
                console.error(err);
                alert('LOS failed: ' + (err.message || err));
            } finally {
                btn.disabled = false;
            }
        });
    }

    _onClose() {
        MapService.clearSelectedMarker();
    }

    // Private: ensure a connection object exists for current repeater & location
    _ensureConnection() {
        const repeater = AppState.getRepeater();
        const locationId = AppState.getLocationId();

        return repeater.ensureConnectionExists(locationId);
    }

    // Private: update the map marker icon after toggles
    _updateIcon() {
        const repeater = AppState.getRepeater();
        const marker = repeater.marker;
        const { canPing, canReceive, canTransmit } =
            repeater.getRepeaterConnectionStatus(AppState.getLocationId());

        const icon = MapService.getAppropriateMarkerIcon(
            repeater, canPing, canReceive, canTransmit
        );
        marker.options.icon = icon;
        marker.refreshIconOptions(icon, true);
    }

    _onTransmitToggle() {
        const conn = this._ensureConnection();

        if (this.txOption.checked) {
            this.pingOption.checked = true;
            this.rxOption.checked = true;
        }
        conn.canReceive = this.rxOption.checked;
        conn.canPing = this.pingOption.checked;
        conn.canTransmit = this.txOption.checked;
        this._updateIcon();

        AppState.api().repeaterConnection_ToggleCanTransmit(conn);
        GeoMappingService.drawRangeCircle(this.toolbarService.isShowTxRangeOn(), 'tx');
    }

    _onReceiveToggle() {
        const conn = this._ensureConnection();

        if (this.txOption.checked && this.pingOption.checked) {
            this.txOption.checked = false;
            conn.canTransmit = false;
        }

        conn.canReceive = this.rxOption.checked;
        this._updateIcon();

        // Save to provider (local or rest)
        AppState.api().repeaterConnection_ToggleCanReceive(conn);
        GeoMappingService.drawRangeCircle(this.toolbarService.isShowRxRangeOn(), 'rx');
    }

    _onPingToggle() {
        const conn = this._ensureConnection();

        if (this.txOption.checked && this.rxOption.checked) {
            this.txOption.checked = false;
            conn.canTransmit = false;
        }

        conn.canPing = this.pingOption.checked;
        this._updateIcon();

        // Save to provider (local or rest)
        AppState.api().repeaterConnection_ToggleCanPing(conn);
        GeoMappingService.drawRangeCircle(this.toolbarService.isShowPingRangeOn(), 'ping');
    }

    _onToggleOnline() {
        const active = this.toggleBtn.classList.toggle('pulsate');
        if (active) {
            this.pingOption.checked = true;
            this.rxOption.checked = true;
            this.txOption.checked = true;
        }
    }
}