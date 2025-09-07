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

export class DlgRegister {
    constructor() { }

    /**
     * Set up event listeners; call after DOMContentLoaded
     */
    initListeners() {
        this.modalEl = document.getElementById('registerModal');
        this.modal = bootstrap.Modal.getOrCreateInstance(this.modalEl);

        this.usernameInput = document.getElementById('reg-username');
        this.usernameFeedback = document.getElementById('reg-username-feedback');
        this.emailInput = document.getElementById('reg-email');
        this.emailFeedback = document.getElementById('reg-email-feedback');
        this.passwordInput = document.getElementById('reg-password');
        this.passwordFeedback = document.getElementById('reg-password-feedback');
        this.confirmInput = document.getElementById('reg-confirm');
        this.confirmFeedback = document.getElementById('reg-confirm-feedback');
        this.termsCheckbox = document.getElementById('reg-terms');
        this.termsCheckboxFeedback = document.getElementById('reg-terms-feedback');

        const regForm = document.getElementById('registerForm');

        regForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const ok = await this.handleSubmit(e);
            if (ok) this.modal.hide();
        });

        this.modalEl.addEventListener('hidden.bs.modal', () => regForm.reset());
    }

    /**
     * Validates & submits the form. To be wired to the form's submit event.
     */
    async handleSubmit(event) {
        event.preventDefault();
        let isError = false;

        // username
        if (!UtilitiesService.validateUserName(this.usernameInput.value)) {
            UtilitiesService.setInputControlError(this.usernameInput, this.usernameFeedback, 'Username is invalid');
            isError = true;
        } else {
            UtilitiesService.clearInputControlError(this.usernameInput, this.usernameFeedback);
        }

        // email
        if (!UtilitiesService.validateEmail(this.emailInput.value)) {
            UtilitiesService.setInputControlError(this.emailInput, this.emailFeedback, 'Email is invalid');
            isError = true;
        } else {
            UtilitiesService.clearInputControlError(this.emailInput, this.emailFeedback);
        }

        // password
        if (!UtilitiesService.validatePassword(this.passwordInput.value)) {
            UtilitiesService.setInputControlError(this.passwordInput, this.passwordFeedback, 'Password is invalid');
            isError = true;
        } else {
            UtilitiesService.clearInputControlError(this.passwordInput, this.passwordFeedback);
        }

        // confirm password
        if (!UtilitiesService.validatePassword(this.confirmInput.value)) {
            UtilitiesService.setInputControlError(this.confirmInput, this.confirmFeedback, 'Confirm Password is invalid');
            isError = true;
        } else {
            UtilitiesService.clearInputControlError(this.confirmInput, this.confirmFeedback);
        }

        // match check
        if (isError === false && (this.passwordInput.value !== this.confirmInput.value)) {
            UtilitiesService.setInputControlError(this.confirmInput, this.confirmFeedback, 'Passwords must match');
            isError = true;
        }

        // terms
        if (!this.termsCheckbox.checked) {
            UtilitiesService.setInputControlError(this.termsCheckbox, this.termsCheckboxFeedback, 'You must accept the Terms and Conditions to continue');
            isError = true;
        } else {
            UtilitiesService.clearInputControlError(this.termsCheckbox, this.termsCheckboxFeedback);
        }

        if (isError) return false;

        // prepare payload
        const payload = {
            username: this.usernameInput.value,
            email: this.emailInput.value,
            password: this.passwordInput.value,
            confirmPassword: this.confirmInput.value,
            acceptTerms: this.termsCheckbox.checked,
        };

        try {
            const res = await fetch('accounts/Register', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json;charset=UTF-8' },
                body: JSON.stringify(payload),
            });

            if (res.ok) {
                UtilitiesService.displayToast(
                    'success',
                    'A verification email has been sent to you …',
                    8000
                );
                this.modal.hide();
                return true;
            } else {
                const { message } = await res.json();
                UtilitiesService.displayToast('error', message || 'Registration failed');
                return false;
            }
        } catch {
            UtilitiesService.displayToast('error', 'Registration failed');
            return false;
        }

        return false;
    }
}
