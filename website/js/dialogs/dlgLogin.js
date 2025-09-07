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

export class DlgLogin {
    constructor() {
        // Selectors
        this.modalSelector = '#loginModal';
        this.formSelector = '#loginForm';
        this.emailSelector = '#login-email';
        this.emailFeedbackSelector = '#login-email-feedback';
        this.passwordSelector = '#login-password';
        this.passwordFeedbackSelector = '#login-password-feedback';
        this.registerModalSel = '#registerModal';
    }

    /** Call after DOMContentLoaded */
    initListeners() {

        // Cache elements
        this.loginModalEl = document.querySelector(this.modalSelector);
        this.loginForm = document.querySelector(this.formSelector);
        this.emailInput = document.querySelector(this.emailSelector);
        this.emailFeedback = document.querySelector(this.emailFeedbackSelector);
        this.passwordInput = document.querySelector(this.passwordSelector);
        this.passwordFeedback = document.querySelector(this.passwordFeedbackSelector);

        // Login/Logout toggle
        document.getElementById('LoginLogoutButton')?.addEventListener('click', () => this.loginLogout());

        // Form submit
        this.loginForm?.addEventListener('submit', (e) => {
            e.preventDefault();
            this._handleSubmit();
        });

        // Optional explicit button (keeps things in sync if present)
        this.loginForm?.querySelector('button[type="submit"]')?.addEventListener('click', (e) => {
            // form.requestSubmit() would re-trigger submit; no-op needed here
        });

        // 'Create Account' link inside login modal
        document.getElementById('link-create-account')?.addEventListener('click', (e) => {
            e.preventDefault();
            const lm = bootstrap.Modal.getOrCreateInstance(this.loginModalEl);
            this.loginModalEl.addEventListener('hidden.bs.modal', () => {
                const regEl = document.querySelector(this.registerModalSel);
                regEl?.querySelector('form')?.reset();
                UtilitiesService.clearModalValidation(regEl);
                bootstrap.Modal.getOrCreateInstance(regEl).show();
            }, { once: true });
            lm.hide();
        });

        // 'Forgot Password' link inside login modal
        document.getElementById('link-forgot')?.addEventListener('click', (e) => {
            e.preventDefault();
            const lm = bootstrap.Modal.getOrCreateInstance(this.loginModalEl);
            this.loginModalEl.addEventListener('hidden.bs.modal', () => {
                const forgotEl = document.getElementById('forgotModal');
                forgotEl?.querySelector('form')?.reset();
                UtilitiesService.clearModalValidation(forgotEl);
                bootstrap.Modal.getOrCreateInstance(forgotEl).show();
            }, { once: true });
            lm.hide();
        });

        // Optional external button to jump directly to register
        document.querySelector('#btn-show-register')?.addEventListener('click', () => this.onShowRegisterDialog());
    }

    /** Show login modal, or POST logout if already authenticated */
    loginLogout() {
        if (!AppState.getIsAuthenticated()) {
            this.onShowDialog();
            return;
        }
        // Log out
        fetch('/accounts/logout', { method: 'POST', headers: { 'Content-Type': 'application/json;charset=UTF-8' } })
            .catch(() => {/* ignore */ })
            .finally(() => {
                localStorage.removeItem('token');
                document.location.href = '/';
            });
    }

    /** Display the login modal */
    onShowDialog() {
        // Reset form and visuals
        this.loginForm.reset();
        UtilitiesService.clearModalValidation(this.loginModalEl);

        const modal = bootstrap.Modal.getOrCreateInstance(this.loginModalEl);
        this.loginModalEl.addEventListener('shown.bs.modal', () => {
            this.emailInput?.focus();
        }, { once: true });
        modal.show();
    }

    /** Handle login submit; single-flight + proper invalid UI */
    async _handleSubmit() {

        let isError = false;

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

        if (isError) return false;

        try {
            const res = await fetch('accounts/authenticate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json;charset=UTF-8' },
                body: JSON.stringify({ email: this.emailInput.value, password: this.passwordInput.value })
            });

            if (res.ok) {
                const data = await res.json();
                localStorage.setItem('token', data.jwtToken);
                this.loginForm.reset();
                AppState.api().suspendSettingsUpdates();
                document.location.href = '/';
            } else {
                // Try to surface server message
                let msg = 'Login failed.';
                try { msg = (await res.json())?.message || msg; } catch { }
                UtilitiesService.displayToast('error', msg);
            }
        } catch (err) {
            UtilitiesService.displayToast('error', 'Login failed.');
        } finally {

        }
    }
}
