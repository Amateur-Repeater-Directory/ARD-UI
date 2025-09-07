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

export class DlgResetPassword {

	constructor() {
		// Modal and form selectors
		this.modalSelector = '#resetPasswordModal';
		this.formSelector = '#resetPasswordForm';
		this.passwordSelector = '#newPassword';
		this.confirmSelector = '#confirmPassword';
		this.tokenSelector = '#token';
		this.token = '';
	}

	initListeners() {
		// Elements
		const form = document.querySelector(this.formSelector);

		// Primary: handle form submit
		form.addEventListener('submit', (e) => {
			e.preventDefault();
			this._handleSubmit(form);
		});
	}

	showDialog(token) {

		this.token = token;

		let modalEl = document.querySelector(this.modalSelector);
		let form = document.querySelector(this.formSelector);
		form.reset(); // clears both password inputs
		UtilitiesService.clearModalValidation(modalEl);

		form.elements.token.value = token || '';

		// Focus first field after the modal is visible
		modalEl.addEventListener('shown.bs.modal', () => {
			form.elements.newPassword.focus();
		}, { once: true });

		// Open (re-use existing instance if present)
		const modal = bootstrap.Modal.getOrCreateInstance(modalEl);
		modal.show();
	}

	async _handleSubmit() {

		let password = document.getElementById('newPassword');
		let newPasswordFeedback = document.getElementById('newPasswordFeedback');
		let confirm = document.getElementById('confirmPassword');
		let confirmPasswordFeedback = document.getElementById('confirmPasswordFeedback');

		UtilitiesService.clearInputControlError(password, newPasswordFeedback);
		UtilitiesService.clearInputControlError(confirm, confirmPasswordFeedback);

		let isError = false;

		if (!UtilitiesService.validatePassword(password.value)) {
			UtilitiesService.setInputControlError(password, newPasswordFeedback, 'Please enter a valid password');
			isError = true;
		} else {
			UtilitiesService.clearInputControlError(password, newPasswordFeedback);
		}

		if (!UtilitiesService.validatePassword(confirm.value)) {
			UtilitiesService.setInputControlError(confirm, confirmPasswordFeedback, 'Please enter a valid password');
			isError = true;
		} else {
			UtilitiesService.clearInputControlError(confirm, confirmPasswordFeedback);
		}

		if (isError === false && (password.value.trim() !== confirm.value.trim())) {
			UtilitiesService.setInputControlError(confirm, confirmPasswordFeedback, 'Passwords must match');
			isError = true;
		}

		if (isError === true) return false;

		UtilitiesService.clearInputControlError(password, newPasswordFeedback);
		UtilitiesService.clearInputControlError(confirm, confirmPasswordFeedback);

		var theData = {
			token: this.token,
			password: password.value,
			confirmPassword: confirm.value
		}

		const res = await fetch('/accounts/ResetPassword', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json;charset=UTF-8' },
			body: JSON.stringify(theData)
		});

		document.location.href = '/';
	}
}