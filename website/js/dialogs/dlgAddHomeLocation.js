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
import { HomeLocationService } from '../services/homeLocationService.js';
import { UtilitiesService } from '../services/utilitiesService.js';

export class DlgAddHomeLocation {

    byId(id) { return document.getElementById(id); }

    /**
     * Open and prefill from map; keep validators simple (Bootstrap handles required).
     */
    showAddHomeLocModal(lat, lng) {
        const modalEl = this.byId('dlgAddHomeLoc');
        const form = this.byId('formAddHomeLoc');
        const nameInput = this.byId('hlName');
        const nameFeedback = this.byId('hlName-feedback');
        const latInput = this.byId('hlLat');
        const lngInput = this.byId('hlLng');
        if (!modalEl || !form || !nameInput || !latInput || !lngInput) return;

        // Reset form and validation state per open
        form.reset();
        form.classList.remove('was-validated');
        nameInput.setCustomValidity('');
        if (nameFeedback) nameFeedback.textContent = 'Please enter a unique name.';

        // Prefill coords (from map) and clear name
        nameInput.value = '';
        latInput.value = Number(lat).toFixed(14);
        lngInput.value = Number(lng).toFixed(14);

        // Focus name when shown
        modalEl.addEventListener('shown.bs.modal', () => nameInput.focus(), { once: true });

        // Show
        bootstrap.Modal.getOrCreateInstance(modalEl, { backdrop: 'static' }).show();

        nameInput.focus();
    }

    _validateField(ctrlId, feedbackId, validator, errorMessage) {
        const ctrl = this.byId(ctrlId);
        const feedback = this.byId(feedbackId);
        if (!ctrl || !feedback) return false;

        if (!validator(ctrl.value)) {
            UtilitiesService.setInputControlError(ctrl, feedback, errorMessage);
            return false;
        } else {
            UtilitiesService.clearInputControlError(ctrl, feedback);
            return true;
        }
    }

    /**
     * Submit handler (Bootstrap validation + async uniqueness check).
     * Hides modal on success.
     */
    async onSubmit() {

        // Safe numeric parser
        const num = (id, digits, defaultValue = '') => {
            const el = this.byId(id);
            if (!el) return null;
            const val = el.value.trim();
            if (val === '') return defaultValue;
            const parsed = parseFloat(val);
            if (isNaN(parsed)) return null;
            return digits != null ? parseFloat(parsed.toFixed(digits)) : parsed;
        };

        const modalEl = this.byId('dlgAddHomeLoc');
        const form = this.byId('formAddHomeLoc');
        const nameInput = this.byId('hlName');
        const nameFeedback = this.byId('hlName-feedback');
        const latInput = this.byId('hlLat');
        const lngInput = this.byId('hlLng');

        if (!modalEl || !form || !nameInput || !latInput || !lngInput) return false;

        // Uniqueness check
        const name = nameInput.value.trim();

        let hasError = false;

        if (!UtilitiesService.validateLocationName(nameInput.value)) {
            UtilitiesService.setInputControlError(nameInput, nameFeedback, 'Location Name is required');
            hasError = true;
        } else {
            UtilitiesService.clearInputControlError(nameInput, nameFeedback);
        }

        const exists = await AppState.api().homeLocation_Exists(name);
        if (exists) {
            UtilitiesService.setInputControlError(nameInput, nameFeedback, `Location '${name}' already exists`);
            hasError = true;
        }

        if (!this._validateField('hlAgl', 'hlAgl-feedback',
            UtilitiesService.validateAboveGroundLevel, 'Invalid Antenna Height')) {
            hasError = true;
        }

        if (hasError) return;

        // Save
        try {
            const newLocation = await HomeLocationService.addHomeLocation({
                locationId: UtilitiesService.guid(),
                name,
                AboveGroundLevel: num('hlAgl', 2, 0.00),
                latitude: latInput.value,
                longitude: lngInput.value,
            });
            if (!newLocation) return false;

            UtilitiesService.displayToast('success', `Home location set to '${name}'`);
            bootstrap.Modal.getOrCreateInstance(modalEl)?.hide();
            form.reset();
            return true;
        } catch (err) {
            return false;
        }
    }

    /**
     * Wire the form once (same pattern as your ForgotPassword dialog).
     */
    initListeners() {
        const modalEl = this.byId('dlgAddHomeLoc');
        const form = this.byId('formAddHomeLoc');
        const nameInput = this.byId('hlName');
        const nameFeedback = this.byId('hlName-feedback');
        const agl = this.byId('hlAgl');

        if (!modalEl || !form || !nameInput) return;

        form.onsubmit = async (e) => {
            e.preventDefault();
            const ok = await this.onSubmit();
            // hiding is handled inside onSubmit on success
        };

        const attachNumericSanitizerNoDecimal = (inp) => {
            if (!inp) return;
            inp.addEventListener('input', () => {
                let v = inp.value.replace(/[^0-9]/g, '');
                inp.value = v;
            });
        };
        [agl].forEach(attachNumericSanitizerNoDecimal);

        // Clear custom validity when user edits the name
        nameInput.addEventListener('input', () => {
            nameInput.setCustomValidity('');
            if (nameFeedback) nameFeedback.textContent = 'Please enter a unique name.';
        });
    }
}
