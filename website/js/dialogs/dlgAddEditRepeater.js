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
import { UtilitiesService } from '../services/utilitiesService.js';
import { UnitsService } from '../services/unitsService.js';
import { RadioService } from '../services/radioService.js';
import { Repeater } from '../models/Repeater.js';

export class DlgAddEditRepeater {

    calcEditRepeaterModalHeight() {
        const tabContent = document.querySelector('#rptrAddEdit_nameModal .tab-content');
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

    showEditRepeaterModal(repeater) {
        const modalEl = document.getElementById('rptrAddEdit_nameModal');
        const form = document.getElementById('rptrAddEdit_nameForm');
        if (!modalEl || !form) return;

        // Reset form and validation state per open
        form.reset();
        form.classList.remove('was-validated');

        // Focus when shown
        const outputFreq = document.getElementById('rptrAddEdit_outputFrequency');
        if (outputFreq) {
            modalEl.addEventListener('shown.bs.modal', () => outputFreq.focus(), { once: true });
        }

        this.bindRepeaterToDialog(repeater);

        // Show
        bootstrap.Modal.getOrCreateInstance(modalEl, { backdrop: 'static' }).show();
    }

    showAddRepeaterModal(latitude, longitude) { // params kept for signature compatibility
        const modalEl = document.getElementById('rptrAddEdit_nameModal');
        const form = document.getElementById('rptrAddEdit_nameForm');
        if (!modalEl || !form) return;

        form.reset();
        form.classList.remove('was-validated');

        const outputFreq = document.getElementById('rptrAddEdit_outputFrequency');
        if (outputFreq) {
            modalEl.addEventListener('shown.bs.modal', () => outputFreq.focus(), { once: true });
        }

        this.bindRepeaterToDialog(new Repeater());

        bootstrap.Modal.getOrCreateInstance(modalEl, { backdrop: 'static' }).show();
    }

    /**
     * Bind a Repeater instance to the Add/Edit Repeater dialog controls.
     * @param {Repeater} repeater
     */
    bindRepeaterToDialog(repeater) {
        if (!repeater) return;

        // Safe number formatter
        const fmt = (val, digits) => (val != null && !isNaN(val) ? Number(val).toFixed(digits) : '');

        const byId = (id) => document.getElementById(id); // simple local helper (not jQuery)

        byId('rptrAddEdit_repeaterId').value = repeater.repeaterId ?? '00000000-0000-0000-0000-000000000000';

        // Callsign
        byId('rptrAddEdit_callsign').value = repeater.callsign ?? '';

        // Frequencies (6 decimals)
        byId('rptrAddEdit_outputFrequency').value = fmt(repeater.outputFrequency, 6);
        byId('rptrAddEdit_inputFrequency').value = fmt(repeater.inputFrequency, 6);

        // Offset (6 decimals)
        byId('rptrAddEdit_offset').value = fmt(repeater.offset, 6);

        // Duplex (offset sign select)
        byId('rptrAddEdit_duplex').value = repeater.offsetSign ?? '';

        // Band (read-only text)
        byId('rptrAddEdit_band').value = repeater.band ?? '';

        // Tone mode
        byId('rptrAddEdit_toneMode').value = repeater.toneMode ?? '';

        // CTCSS (1 decimal place)
        byId('rptrAddEdit_ctcssTx').value = fmt(repeater.ctcssTx, 1);
        byId('rptrAddEdit_ctcssRx').value = fmt(repeater.ctcssRx, 1);

        // Mapping tab
        byId('rptrAddEdit_lat').value = fmt(repeater.latitude, 7);
        byId('rptrAddEdit_lng').value = fmt(repeater.longitude, 7);

        byId('rptrAddEdit_state').value = repeater.state ?? '';
        byId('rptrAddEdit_county').value = repeater.county ?? '';
        byId('rptrAddEdit_nearestCity').value = repeater.nearestCity ?? '';

        // Above Ground Level (2 decimals)
        const agl = repeater.aboveGroundLevel ?? 0;
        byId('rptrAddEdit_aboveGroundLevel').value =
            agl > 0 ? UnitsService.toImperialElevationValue(agl) : 5;

        byId('rptrAddEdit_aboveGroundLevelPrecise').checked = !!repeater.IsAboveGroundLevelPrecise;

        // Switches
        byId('rptrAddEdit_precise').checked = !!repeater.isLatLongPrecise;
        byId('rptrAddEdit_guess').checked = !!repeater.hasLatLongError;

        // --- Information tab ---
        byId('rptrAddEdit_isOperational').checked = !!repeater.isOperational;
        byId('rptrAddEdit_isOpen').checked = !!repeater.isOpen;
        byId('rptrAddEdit_isCoordinated').checked = !!repeater.isCoordinated;

        byId('rptrAddEdit_ares').checked = !!repeater.ares;
        byId('rptrAddEdit_races').checked = !!repeater.races;
        byId('rptrAddEdit_skywarn').checked = !!repeater.skywarn;

        byId('rptrAddEdit_notes').value = repeater.notes ?? '';

        byId('rptrAddEdit_createdDate').value = repeater.createdDate
            ? new Date(repeater.createdDate).toLocaleString()
            : '';
        byId('rptrAddEdit_updatedDate').value = repeater.updatedDate
            ? new Date(repeater.updatedDate).toLocaleString()
            : '';

        // Custom logic
        if (repeater.offsetSign === '-' || repeater.offsetSign === '+') {
            byId('rptrAddEdit_offset').disabled = false;
        }
    }


    gatherRepeaterFromDialog() {
        const byId = (id) => document.getElementById(id);

        // Safe numeric parser
        const num = (id, digits, defaultValue = '') => {
            const el = byId(id);
            if (!el) return null;
            const val = el.value.trim();
            if (val === '') return defaultValue;
            const parsed = parseFloat(val);
            if (isNaN(parsed)) return null;
            return digits != null ? parseFloat(parsed.toFixed(digits)) : parsed;
        };

        const repeater = {};

        // Properties that are calculated Server Side
        repeater.state = '';
        repeater.county = '';
        repeater.nearestCity = '';
        repeater.elevation = 0;

        // required but ignored server side
        repeater.createdDate = new Date().toISOString();
        repeater.updatedDate = new Date().toISOString();

        repeater.repeaterId = byId('rptrAddEdit_repeaterId')?.value || null;

        // Callsign
        repeater.callsign = byId('rptrAddEdit_callsign')?.value.trim() || null;

        // Frequencies
        repeater.outputFrequency = num('rptrAddEdit_outputFrequency', 6);
        repeater.inputFrequency = num('rptrAddEdit_inputFrequency', 6);

        // Offset
        repeater.offset = num('rptrAddEdit_offset', 6);

        // Duplex sign
        repeater.offsetSign = byId('rptrAddEdit_duplex')?.value || null;

        // Band
        repeater.band = byId('rptrAddEdit_band')?.value || null;

        // Tone mode
        repeater.toneMode = byId('rptrAddEdit_toneMode')?.value || null;

        // CTCSS
        repeater.ctcssTx = num('rptrAddEdit_ctcssTx', 1, 0.00);
        repeater.ctcssRx = num('rptrAddEdit_ctcssRx', 1, 0.00);

        // Mapping tab
        repeater.latitude = num('rptrAddEdit_lat', 7);
        repeater.longitude = num('rptrAddEdit_lng', 7);

        // Above Ground Level
        repeater.aboveGroundLevel = num('rptrAddEdit_aboveGroundLevel', 2, 0.00);
        repeater.aboveGroundLevel = UnitsService.toMetricElevationValue(repeater.aboveGroundLevel, 2);

        repeater.IsAboveGroundLevelPrecise = byId('rptrAddEdit_aboveGroundLevelPrecise')?.checked || false;

        // Switches
        repeater.isLatLongPrecise = byId('rptrAddEdit_precise')?.checked || false;
        repeater.hasLatLongError = byId('rptrAddEdit_guess')?.checked || false;

        // --- Information tab ---
        repeater.isOperational = byId('rptrAddEdit_isOperational')?.checked || false;
        repeater.isOpen = byId('rptrAddEdit_isOpen')?.checked || false;
        repeater.isCoordinated = byId('rptrAddEdit_isCoordinated')?.checked || false;

        repeater.ares = byId('rptrAddEdit_ares')?.checked || false;
        repeater.races = byId('rptrAddEdit_races')?.checked || false;
        repeater.skywarn = byId('rptrAddEdit_skywarn')?.checked || false;

        repeater.notes = byId('rptrAddEdit_notes')?.value?.trim() || null;

        return repeater;
    }

    _validateField(ctrlId, feedbackId, validator, errorMessage) {
        const ctrl = document.getElementById(ctrlId);
        const feedback = document.getElementById(feedbackId);
        if (!ctrl || !feedback) return false;

        if (!validator(ctrl.value)) {
            UtilitiesService.setInputControlError(ctrl, feedback, errorMessage);
            return false;
        } else {
            UtilitiesService.clearInputControlError(ctrl, feedback);
            return true;
        }
    }

    _isValidationIssue(repeater) {
        let isError = false;

        if (!this._validateField('rptrAddEdit_callsign', 'rptrAddEdit_callsignFeedback',
            UtilitiesService.validateCallsign, 'Callsign is invalid.')) isError = true;

        if (!this._validateField('rptrAddEdit_outputFrequency', 'rptrAddEdit_outputFrequencyFeedback',
            UtilitiesService.validateFrequency, 'Frequency is invalid.')) isError = true;

        if (!this._validateField('rptrAddEdit_inputFrequency', 'rptrAddEdit_inputFrequencyFeedback',
            UtilitiesService.validateFrequency, 'Frequency is invalid.')) isError = true;

        if (!this._validateField('rptrAddEdit_aboveGroundLevel', 'rptrAddEdit_aboveGroundLevelFeedback',
            UtilitiesService.validateAboveGroundLevel, 'Above Ground Level must be 0–2000 ft.')) isError = true;

        if (!this._validateField('rptrAddEdit_offset', 'rptrAddEdit_offsetFeedback',
            UtilitiesService.validateOffset, 'Offset must be between 0 and 20.')) isError = true;

        if (!this._validateField('rptrAddEdit_lat', 'rptrAddEdit_latFeedback',
            UtilitiesService.validateLatitude, 'Latitude must be between -90 and 90.')) isError = true;

        if (!this._validateField('rptrAddEdit_lng', 'rptrAddEdit_lngFeedback',
            UtilitiesService.validateLongitude, 'Longitude must be between -180 and 180.')) isError = true;

        return isError;
    }

    initListeners() {
        const duplexSelect = document.getElementById('rptrAddEdit_duplex');
        const outputFreq = document.getElementById('rptrAddEdit_outputFrequency');
        const offset = document.getElementById('rptrAddEdit_offset');
        const inputFreq = document.getElementById('rptrAddEdit_inputFrequency');
        const band = document.getElementById('rptrAddEdit_band');
        const tx = document.getElementById('rptrAddEdit_ctcssTx');
        const rx = document.getElementById('rptrAddEdit_ctcssRx');
        const form = document.getElementById('rptrAddEdit_nameForm');

        const lat = document.getElementById('rptrAddEdit_lat');
        const lng = document.getElementById('rptrAddEdit_lng');
        const stateEl = document.getElementById('rptrAddEdit_state');
        const countyEl = document.getElementById('rptrAddEdit_county');
        const nearestCityEl = document.getElementById('rptrAddEdit_nearestCity');

        const editBtn = document.getElementById('btnEditRepeater');
        if (editBtn) {
            editBtn.addEventListener('click', () => {
                const repeater = AppState.getRepeater();
                if (repeater) {
                    this.calcEditRepeaterModalHeight();
                    this.showEditRepeaterModal(repeater);
                }
            });
        }

        const addBtn = document.getElementById('btnAddRepeater');
        if (addBtn) {
            addBtn.addEventListener('click', () => {
                this.calcEditRepeaterModalHeight();
                this.showAddRepeaterModal();
            });
        }

        // Run once at startup
        document.addEventListener('hidden.bs.modal', (event) => {
            const modalEl = event.target; // the .modal that just hid

            // (A) Clear validation state for any forms inside this modal
            modalEl.querySelectorAll('form').forEach((form) => {
                form.reset();
                form.classList.remove('was-validated');

                form.querySelectorAll('.is-invalid, .is-valid').forEach((el) => {
                    el.classList.remove('is-invalid', 'is-valid');
                    el.removeAttribute('aria-invalid');
                });

                form.querySelectorAll('.invalid-feedback, .valid-feedback').forEach((fb) => {
                    fb.textContent = '';
                    fb.classList.remove('d-block');
                });
            });

            // (B) Dispose Bootstrap instance (equivalent to $(this).removeData('bs.modal'))
            const instance = bootstrap.Modal.getInstance(modalEl);
            if (instance) instance.dispose();
        });


        // Populate CTCSS lists if not already populated (assumes first option is blank)
        const ctcssList = RadioService.ctcssList; // [undefined, 67.0, 69.3, ...]

        // Populates a <select> with a blank first option, then the tones.
        // Safe to call multiple times (won’t duplicate if already populated).
        const addOptions = (sel) => {
            if (!sel) return;
            if (sel.options.length > 1) return; // already populated (you keep this guard)

            for (const val of ctcssList) {
                const opt = document.createElement('option');
                if (val == null) {
                    // First blank entry
                    opt.value = '';
                    opt.textContent = '';
                } else {
                    const txt = Number(val).toFixed(1); // 100 -> "100.0"
                    opt.value = txt;
                    opt.textContent = txt;
                }
                sel.appendChild(opt);
            }
        };

        addOptions(tx);
        addOptions(rx);

        // Duplex/offset/input logic
        if (offset) offset.disabled = true;
        if (inputFreq) inputFreq.disabled = true;

        const calculateInputFrequency = () => {
            if (!outputFreq || !inputFreq || !duplexSelect) return;
            const out = parseFloat(outputFreq.value);
            const off = parseFloat(offset?.value);
            const val = duplexSelect.value;

            if (!Number.isNaN(out) && !Number.isNaN(off) && (val === '+' || val === '-')) {
                const sign = (val === '-') ? -1 : 1;
                inputFreq.value = (out + sign * off).toFixed(6);
            } else if (!Number.isNaN(out) && val !== 'Split' && inputFreq) {
                // Track output if no split and no offset available
                inputFreq.value = out.toFixed(6);
            }
        };

        if (duplexSelect) {
            duplexSelect.addEventListener('change', () => {
                if (!outputFreq || !offset || !inputFreq) return;

                const out = parseFloat(outputFreq.value);
                if (Number.isNaN(out)) return;

                const val = duplexSelect.value;

                if (val === '-' || val === '+') {
                    offset.disabled = false;
                    inputFreq.disabled = true;
                    calculateInputFrequency();
                } else if (val === 'Split') {
                    offset.disabled = true;
                    offset.value = '';
                    inputFreq.disabled = false;
                    inputFreq.value = '';
                    inputFreq.focus();
                } else {
                    offset.disabled = true;
                    offset.value = '';
                    inputFreq.disabled = true;
                    inputFreq.value = out.toFixed(6);
                }
            });
        }

        if (outputFreq) {
            outputFreq.addEventListener('blur', () => {
                const val = parseFloat(outputFreq.value);
                if (!Number.isNaN(val)) {
                    outputFreq.value = val.toFixed(6);
                    if (band) band.value = RadioService.bandFromFrequency(val) ?? '';

                    // Set defaults if blank
                    if (duplexSelect && duplexSelect.value === '' && offset && offset.value === '') {
                        const sign = RadioService.chooseDefaultSign(outputFreq.value);
                        if (sign === '+' || sign === '-') {
                            duplexSelect.value = sign;
                            offset.disabled = false;
                        }
                        const offsetValue = RadioService.chooseDefaultOffset(outputFreq.value);
                        if (offsetValue != null) {
                            offset.value = Number(offsetValue).toFixed(6);
                        }
                    }
                } else if (band) {
                    band.value = '';
                }

                // Keep input frequency in sync
                calculateInputFrequency();
            });
        }

        if (offset) {
            offset.addEventListener('blur', () => {
                calculateInputFrequency();
            });
        }

        // Numeric sanitization (freqs/offsets)
        const attachNumericSanitizer = (inp) => {
            if (!inp) return;
            inp.addEventListener('input', () => {
                let v = inp.value.replace(/[^0-9.]/g, '');
                const parts = v.split('.');
                if (parts.length > 2) v = parts[0] + '.' + parts.slice(1).join('');
                inp.value = v;
            });
        };
        [outputFreq, offset, inputFreq].forEach(attachNumericSanitizer);

        // Lat/Lng sanitization
        const attachLatLngSanitizer = (inp) => {
            if (!inp) return;
            inp.addEventListener('input', () => {
                let v = inp.value.replace(/[^0-9.-]/g, '');

                // only keep the first "-" at the start
                const minusIndex = v.indexOf('-');
                if (minusIndex > 0) {
                    v = v.replace(/-/g, '');
                    v = '-' + v;
                }

                // only keep one decimal point
                const parts = v.split('.');
                if (parts.length > 2) {
                    v = parts[0] + '.' + parts.slice(1).join('');
                }

                inp.value = v;
            });
        };
        [lat, lng].forEach(attachLatLngSanitizer);

        // Trigger lookup on blur (clears derived fields here)
        const latitudeLongitudeChanged = () => {
            if (stateEl) stateEl.value = '';
            if (countyEl) countyEl.value = '';
            if (nearestCityEl) nearestCityEl.value = '';
        };

        if (lat) lat.addEventListener('blur', () => {
            if (lat.value && lng?.value) latitudeLongitudeChanged();
        });

        if (lng) lng.addEventListener('blur', () => {
            if (lat?.value && lng.value) latitudeLongitudeChanged();
        });

        // Validation
        if (form) {
            form.addEventListener('submit', async (e) => {

                e.preventDefault();
                e.stopPropagation();

                if (!AppState.getIsAuthenticated()) {
                    UtilitiesService.displayToast('warning', 'You must be logged in to use this feature.');
                    return;
                }

                const repeater = this.gatherRepeaterFromDialog();

                if (!this._isValidationIssue(repeater)) {

                    if (repeater.repeaterId === '00000000-0000-0000-0000-000000000000') {
                        await AppState.api().repeater_Add(repeater);
                    } else {
                        await AppState.api().repeater_Update(repeater);
                    }
                    // Optionally: close modal / toast here
                }
            });
        }

        // Initialize Bootstrap tooltips
        const tooltipTriggerList = document.querySelectorAll('[data-bs-toggle="tooltip"]');
        tooltipTriggerList.forEach((el) => {
            new bootstrap.Tooltip(el, { delay: { show: 800, hide: 100 }, trigger: 'hover focus' });
        });
    }
}
