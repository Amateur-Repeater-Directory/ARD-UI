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

import { UtilitiesService } from '../services/utilitiesService.js';

export class ForgotPasswordDialog {

    static async onSubmit() {
        const modal = document.getElementById('forgotModal');
        const form = document.getElementById('forgotForm');
        if (!modal || !form) return false;

        let emailInput = document.querySelector('#forgot-email');
        let emailFeedback = document.querySelector('#forgot-email-feedback');

        let isError = false;

        if (!UtilitiesService.validateEmail(emailInput.value)) {
            UtilitiesService.setInputControlError(emailInput, emailFeedback, 'Email is invalid');
            isError = true;
        } else {
            UtilitiesService.clearInputControlError(emailInput, emailFeedback);
        }

        if (isError) return false;

        try {
            const resp = await fetch('accounts/ForgotPassword', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json;charset=UTF-8' },
                body: JSON.stringify({ email: emailInput.value.trim() })
            });
            const data = await resp.json().catch(() => ({}));
            if (resp.ok) {
                window.jwt = data?.jwtToken ?? window.jwt; // preserve old behavior
                UtilitiesService.displayToast('success', 'Password reminder email sent ...');
                return true;
            }
            return false;
        } catch (err) {
            UtilitiesService.displayToast('error', 'ForgotPassword error');
            return false;
        }
    }

    /**
     * Wire up all DOM event listeners. Call after DOMContentLoaded.
     */
    initListeners() {
        const modal = document.getElementById('forgotModal');
        const form = document.getElementById('forgotForm');
        if (!modal || !form) return;

        form.reset();

        form.onsubmit = async (e) => {
            e.preventDefault();
            const ok = await ForgotPasswordDialog.onSubmit();
            if (ok) bootstrap.Modal.getOrCreateInstance(modal)?.hide();
        };
    }
}
