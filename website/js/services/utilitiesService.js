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
import { RadioService } from './radioService.js';

/**
 * A collection of utility methods for the ARD application.
 */
export class UtilitiesService {

	static hasValue(value) {
		return value !== undefined && value !== null && value !== '';
	}

	static guid() {
		const c = typeof globalThis !== 'undefined' && globalThis.crypto;
		if (c && typeof c.randomUUID === 'function') {
			return c.randomUUID();
		}
		return `g_${Date.now()}_${Math.random().toString(16).slice(2)}`;
	}

	// ------ BOOTSTRAP 5 TOAST ------
	static displayToast(kind, message, displayTime = 3500) {
		const toastEl = document.getElementById('dynamicToast');
		const toastBody = toastEl.querySelector('.toast-body');

		// Map kinds → theme-aware tones
		const tones = {
			success: { bg: 'var(--bs-success-bg-subtle)', fg: 'var(--bs-success-text-emphasis)', border: 'var(--bs-success-border-subtle)', caption: 'Success' },
			error: { bg: 'var(--bs-danger-bg-subtle)', fg: 'var(--bs-danger-text-emphasis)', border: 'var(--bs-danger-border-subtle)', caption: 'Error' },
			danger: { bg: 'var(--bs-danger-bg-subtle)', fg: 'var(--bs-danger-text-emphasis)', border: 'var(--bs-danger-border-subtle)', caption: 'Danger' },
			warning: { bg: 'var(--bs-warning-bg-subtle)', fg: 'var(--bs-warning-text-emphasis)', border: 'var(--bs-warning-border-subtle)', caption: 'Warning' },
			info: { bg: 'var(--bs-info-bg-subtle)', fg: 'var(--bs-info-text-emphasis)', border: 'var(--bs-info-border-subtle)', caption: 'Information' },
			primary: { bg: 'var(--bs-primary-bg-subtle)', fg: 'var(--bs-primary-text-emphasis)', border: 'var(--bs-primary-border-subtle)', caption: 'Alert' }
		};
		const tone = tones[(kind || '').toLowerCase()] || tones.primary;

		// Clear previous inline vars
		['--bs-toast-bg', '--bs-toast-color', '--bs-toast-border-color', '--bs-toast-header-bg', '--bs-toast-header-color']
			.forEach(v => toastEl.style.removeProperty(v));

		// Apply tone via CSS variables (works in dark/light)
		toastEl.style.setProperty('--bs-toast-bg', tone.bg);
		toastEl.style.setProperty('--bs-toast-color', tone.fg);
		toastEl.style.setProperty('--bs-toast-border-color', tone.border);
		toastEl.style.setProperty('--bs-toast-header-bg', tone.bg);
		toastEl.style.setProperty('--bs-toast-header-color', tone.fg);

		// Set caption and message
		const captionEl =
			toastEl.querySelector('#toast-caption') ||
			toastEl.querySelector('.toast-header .me-auto'); // fallback
		if (captionEl) captionEl.textContent = tone.caption;

		toastBody.textContent = message;

		// Show with delay (recreate to honor per-call delay)
		const prev = bootstrap.Toast.getInstance(toastEl);
		if (prev) prev.dispose();
		const toast = new bootstrap.Toast(toastEl, { delay: displayTime });
		toast.show();
	}


	// ------ ASYNC UTIL ------
	static waitForMicrotasks() {
		return new Promise(resolve => queueMicrotask(resolve));
	}

	// ------ FORM VALIDATORS ------
	static validatePassword(value) {

		if (value === undefined || value === null) return false;

		if (value.length < 8) return false;

		// At least one lower
		if (!value.match(/(.*[a-z].*)/)) {
			return false;
		}

		// At least one upper
		if (!value.match(/(.*[A-Z].*)/)) {
			return false;
		}

		// At least one number
		if (!value.match(/(.*[0-9].*)/)) {
			return false;
		}

		// At least one special character
		if (!value.match(/[!@#$%^&*?]+/)) {
			return false;
		}

		return true;
	}

	static validatePasswordWithMessage(value) {
		if (value === undefined || value === null || value.length === 0) return [false, null];

		if (!UtilitiesService.validatePassword(value)) {
			return [false, 'Password: 8 characters minimum, Contain at least 1 uppper case, 1 lower case, 1 number, and 1 special character !@#$%^&*?$'];
		}
		return [true, ''];
	}

	static validateEmail(value) {
		if (value === undefined || value === null || value.length === 0) return false;

		if (!value.match(/^[A-Z0-9a-z._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,64}$/)) {
			return false;
		}
		return true;
	}

	static validateEmailWithMessage(value) {
		if (value === undefined || value === null || value.length === 0) return [false, null];

		if (!UtilitiesService.validateEmail(value)) {
			return [false, 'Invalid Email Address Format'];
		}
		return [true, ''];
	}

	static validateUserName(value) {

		if (value === undefined || value === null || value.length === 0) return false;

		if (value.length < 3 || value.length > 30) return false;

		if (!value.match(/^[a-zA-Z0-9]+$/)) {
			return false;
		}

		return true;
	}

	static validateFrequency(value) {
		return RadioService.bandFromFrequency(value) !== null;
	}

	static validateOffset(val) {
		// Empty means "not required" → pass
		if (val == null || val === '') return true;

		const num = Number(val);
		// If it's not a number at all, fail
		if (!Number.isFinite(num)) return false;

		// If it's a number but out of acceptable range, fail
		if (num <= 0 || num > 20) return false;

		// Otherwise, valid
		return true;
	}

	static validateAboveGroundLevel(val) {
		// Allow empty / not required
		if (val == null || val === '') return true;

		const num = Number(val);

		// Must be a finite number
		if (!Number.isFinite(num)) return false;

		// Must be within 0–2000 feet
		if (num < 0 || num > 2000) return false;

		return true;
	}

	static validateLatitude(val) {
		if (val == null || val === '') return false;

		const num = Number(val);
		if (!Number.isFinite(num)) return false;

		// Latitude range: -90 to +90
		return num >= -90 && num <= 90;
	}

	static validateLongitude(val) {
		if (val == null || val === '') return false;

		const num = Number(val);
		if (!Number.isFinite(num)) return false;

		// Longitude range: -180 to +180
		return num >= -180 && num <= 180;
	}

	static validateCallsign(val) {
		// Required: must be non-empty
		if (!val) return false;

		// Normalize to uppercase
		const cs = val.toUpperCase();

		// Only A–Z and 0–9 allowed
		const pattern = /^[A-Z0-9]+$/;
		return pattern.test(cs);
	}

	static validateLocationName(value) {

		if (value === undefined || value === null || value.length === 0) return false;

		if (value.length < 1 || value.length > 50) return false;

		return true;
	}

	static validateUserNameWithMessage(value) {

		if (value === undefined || value === null || value.length === 0) return [false, null];

		if (!UtilitiesService.validateUserName(value)) {
			return [false, 'Invalid Username - Must be between 3 and 30 characters in length, Letter and Numbers only'];
		}
		return [true, ''];
	}

	static setInputControlError(input, feedback, message) {
		UtilitiesService.clearInputControlError(input, feedback);
		input.classList.add('is-invalid');
		feedback.textContent = message;
	}

	static clearInputControlError(input, feedback) {
		input.classList.remove('is-invalid');
		feedback.textContent = '';
	}

	static clearModalValidation(modalEl) {
		modalEl.querySelectorAll('form').forEach(f => f.classList.remove('was-validated'));
		modalEl.querySelectorAll('.is-invalid, .is-valid').forEach(el => {
			el.classList.remove('is-invalid', 'is-valid');
			el.removeAttribute('aria-invalid');
		});
		// If you ever toggled feedback visibility manually:
		modalEl.querySelectorAll('.invalid-feedback, .valid-feedback')
			.forEach(el => el.classList.remove('d-block'));
	}



	static getCookieValue(name) {
		for (let cookie of cookieArray) {
			let [cookieName, cookieValue] = cookie.trim().split('=');
			if (cookieName === name) {
				return cookieValue;
			}
		}
		return null; // or undefined, depending on your requirements
	}

	static getResetTokenFromUrl() {
		const url = new URL(window.location.href);
		// Check query
		const queryToken = url.searchParams.get('password-reset');
		if (queryToken)
			return {
				action: 'password-reset',
				token: queryToken,
				source: 'query'
			};

		// Check hash as key=value or raw token
		const h = window.location.hash.replace(/^#/, '');
		if (!h) return null;

		// If hash is like reset=TOKEN or other params
		const params = new URLSearchParams(h.includes('=') ? h : 'password-reset=' + h);
		const hashToken = params.get('password-reset');
		if (hashToken)
			return {
				action: 'password-reset',
				token: hashToken,
				source: 'hash'
			};

		return null;
	}

	/**
 * Returns the amateur radio band name based on the input frequency in MHz.
 * @param {number} frequency - The frequency in MHz.
 * @returns {string|null} The band name, or null if no band matches.
 */
	//static bandFromFrequency(frequency) {
	//	if (frequency >= 135.7 && frequency <= 137.8) return '2,200m';
	//	if (frequency >= 472.0 && frequency <= 479.0) return '630m';
	//	if (frequency >= 1.800 && frequency <= 2.000) return '160m';
	//	if (frequency >= 3.500 && frequency <= 4.000) return '80m';
	//	if (frequency >= 7.000 && frequency <= 7.300) return '40m';     
	//	if (frequency >= 10.100 && frequency <= 10.150) return '30m';
	//	if (frequency >= 14.000 && frequency <= 14.350) return '20m';
	//	if (frequency >= 18.068 && frequency <= 18.168) return '17m';
	//	if (frequency >= 21.000 && frequency <= 21.450) return '15m';
	//	if (frequency >= 24.890 && frequency <= 24.990) return '12m';   
	//	if (frequency >= 28.000 && frequency <= 29.700) return '10m';
	//	if (frequency >= 50.000 && frequency <= 54.000) return '6m';
	//	if (frequency >= 222.000 && frequency <= 225.000) return '1.25m'; 
	//	if (frequency >= 144.000 && frequency <= 148.000) return '2m';
	//	if (frequency >= 420.000 && frequency <= 450.000) return '70cm';
	//	if (frequency >= 902.000 && frequency <= 928.000) return '33cm';
	//	if (frequency >= 1240.000 && frequency <= 1300.000) return '23cm';

	//	return null;
	//}

}
