import { api } from '/js/api.js';

let controlSequence = 0;

function normalizedPhone(value) {
  const raw = String(value || '').trim().replace(/[\s()-]/g, '');
  if (/^\+[1-9]\d{7,14}$/.test(raw)) return raw;
  if (/^[6-9]\d{9}$/.test(raw)) return `+91${raw}`;
  return null;
}

/** Adds an on-demand SMS code flow to one editable phone input. */
export class PhoneOtpController {
  constructor(input, { scope, field, currentVerified = false } = {}) {
    this.input = input;
    this.scope = scope;
    this.field = field;
    this.initialValue = String(input?.value || '').trim();
    this.currentVerified = currentVerified;
    this.verifiedPhone = null;
    this.pendingPhone = null;
    this.otpApp = null;
    this.otpAuth = null;
    this.otpVerifier = null;
    this.confirmation = null;
    this.id = ++controlSequence;
    this.buildControls(currentVerified);
  }

  buildControls(currentVerified) {
    if (!this.input) return;
    const controls = document.createElement('div');
    controls.className = 'phone-otp-controls';
    controls.innerHTML = `
      <button type="button" class="btn btn-secondary btn-sm" data-phone-send>Send code</button>
      <span class="phone-otp-status" data-phone-status role="status">${currentVerified ? 'Number verified' : this.initialValue ? 'Verify if you change this number' : 'Enter a number to verify it'}</span>
      ${this.initialValue ? '<button type="button" class="btn btn-ghost btn-sm" data-phone-remove>Remove</button>' : ''}
      <div class="phone-otp-code-row" data-phone-code-row hidden>
        <input type="text" class="form-input" data-phone-code inputmode="numeric" autocomplete="one-time-code" maxlength="8" placeholder="SMS code" aria-label="SMS verification code">
        <button type="button" class="btn btn-primary btn-sm" data-phone-verify>Verify</button>
      </div>
      <div data-phone-recaptcha aria-hidden="true"></div>
    `;
    this.input.insertAdjacentElement('afterend', controls);
    this.controls = controls;
    this.status = controls.querySelector('[data-phone-status]');
    this.codeRow = controls.querySelector('[data-phone-code-row]');
    this.codeInput = controls.querySelector('[data-phone-code]');
    this.sendButton = controls.querySelector('[data-phone-send]');
    this.removeButton = controls.querySelector('[data-phone-remove]');
    this.verifyButton = controls.querySelector('[data-phone-verify]');
    this.recaptchaElement = controls.querySelector('[data-phone-recaptcha]');
    this.sendButton.addEventListener('click', () => this.sendCode());
    this.removeButton?.addEventListener('click', () => this.removeNumber());
    this.verifyButton.addEventListener('click', () => this.verifyCode());
    this.input.addEventListener('input', () => {
      const current = String(this.input.value || '').trim();
      if (this.pendingPhone && current !== this.pendingPhone) {
        this.clearSession();
        this.codeRow.hidden = true;
        this.setStatus('Number changed. Send a new code.');
      } else if (!current) {
        this.setStatus(this.initialValue ? 'This number will be removed when saved.' : 'Enter a number to verify it');
      } else if (current === this.initialValue) {
        this.setStatus(this.currentVerified ? 'Number verified' : this.initialValue ? 'Verify if you change this number' : 'Enter a number to verify it');
      } else if (this.verifiedPhone && normalizedPhone(current) === this.verifiedPhone) {
        this.setStatus('Number verified');
      } else {
        this.setStatus('Verify this new number before saving.');
      }
    });
    window.addEventListener('pagehide', () => this.clearSession(), { once: true });
    window.addEventListener('hashchange', () => this.clearSession(), { once: true });
  }

  setStatus(message, isError = false) {
    if (!this.status) return;
    this.status.textContent = message;
    this.status.dataset.state = isError ? 'error' : 'info';
  }

  async clearSession() {
    try { this.otpVerifier?.clear(); } catch (_) {}
    if (this.otpAuth) {
      const { signOut } = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js');
      await signOut(this.otpAuth).catch(() => {});
    }
    if (this.otpApp) {
      const { deleteApp } = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js');
      await deleteApp(this.otpApp).catch(() => {});
    }
    this.otpApp = this.otpAuth = this.otpVerifier = this.confirmation = null;
    this.pendingPhone = null;
    this.confirmedProofToken = null;
  }

  async sendCode() {
    const phone = normalizedPhone(this.input.value);
    if (!phone) {
      this.setStatus('Enter a valid number, such as +919876543210.', true);
      return;
    }
    this.input.value = phone;
    if (this.verifiedPhone === phone) {
      this.setStatus('This number is verified.');
      return;
    }
    this.sendButton.disabled = true;
    this.setStatus('Sending code…');
    try {
      await this.clearSession();
      const { firebaseConfig } = await import('/js/firebase-init.js');
      const { initializeApp } = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js');
      const { getAuth, RecaptchaVerifier, signInWithPhoneNumber } = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js');
      this.otpApp = initializeApp(firebaseConfig, `phone-otp-${this.id}-${Date.now()}`);
      this.otpAuth = getAuth(this.otpApp);
      this.otpVerifier = new RecaptchaVerifier(this.otpAuth, this.recaptchaElement, { size: 'invisible' });
      this.confirmation = await signInWithPhoneNumber(this.otpAuth, phone, this.otpVerifier);
      this.pendingPhone = phone;
      this.codeRow.hidden = false;
      this.codeInput.focus();
      this.setStatus(`Code sent to ${phone}.`);
    } catch (error) {
      await this.clearSession();
      this.setStatus(error.message || 'Could not send a code. Check Firebase Phone Authentication settings.', true);
    } finally {
      this.sendButton.disabled = false;
    }
  }

  async verifyCode() {
    const phone = normalizedPhone(this.input.value);
    const code = String(this.codeInput.value || '').trim();
    if (!this.confirmation || !phone || phone !== this.pendingPhone || !code) {
      this.setStatus('Send a code to this number and enter it here.', true);
      return;
    }
    this.verifyButton.disabled = true;
    this.setStatus('Verifying…');
    try {
      const result = this.confirmedProofToken ? null : await this.confirmation.confirm(code);
      const phoneProofToken = this.confirmedProofToken || await result.user.getIdToken(true);
      this.confirmedProofToken = phoneProofToken;
      await api.post('/profile/phone/verify', {
        scope: this.scope,
        field: this.field,
        phone,
        phoneProofToken
      });
      this.verifiedPhone = phone;
      this.initialValue = phone;
      this.currentVerified = true;
      this.codeRow.hidden = true;
      this.codeInput.value = '';
      this.setStatus('Number verified and saved.');
      await this.clearSession();
    } catch (error) {
      this.setStatus(error.message || 'Code invalid or expired. Request a new one.', true);
    } finally {
      this.verifyButton.disabled = false;
    }
  }

  isVerifiedForCurrentValue() {
    const value = String(this.input?.value || '').trim();
    if (!value) return true;
    if (value === this.initialValue || (normalizedPhone(value) && normalizedPhone(value) === normalizedPhone(this.initialValue))) return true;
    return normalizedPhone(value) === this.verifiedPhone;
  }

  dispose() {
    this.clearSession();
    this.controls?.remove();
  }

  async removeNumber() {
    if (!this.initialValue || !confirm('Remove this phone number?')) return;
    this.removeButton.disabled = true;
    try {
      await api.post('/profile/phone/verify', { scope: this.scope, field: this.field, phone: '', phoneProofToken: '' });
      await this.clearSession();
      this.input.value = '';
      this.initialValue = '';
      this.currentVerified = false;
      this.verifiedPhone = null;
      this.codeRow.hidden = true;
      this.setStatus('Phone number removed.');
      this.removeButton.remove();
    } catch (error) {
      this.setStatus(error.message || 'Could not remove this number.', true);
      this.removeButton.disabled = false;
    }
  }

  async saveIfCleared() {
    if (String(this.input?.value || '').trim() || !this.initialValue) return;
    await api.post('/profile/phone/verify', {
      scope: this.scope,
      field: this.field,
      phone: '',
      phoneProofToken: ''
    });
    this.initialValue = '';
    this.currentVerified = false;
    this.verifiedPhone = null;
    this.removeButton?.remove();
    this.setStatus('Phone number removed.');
  }
}
