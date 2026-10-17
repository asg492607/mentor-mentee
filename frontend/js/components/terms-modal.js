/**
 * @fileoverview Reusable Terms & Conditions, Privacy Policy & Security Disclaimer Modal & Checkbox
 * @module terms-modal
 */
import { t } from '../i18n.js';
import { hideModal } from './modal.js';

/**
 * Returns the HTML string for the Terms & Privacy Agreement checkbox
 * with clickable triggers for the terms modal and liability disclaimer summary.
 * 
 * @param {Object} options
 * @param {string} [options.id='terms-agree']
 * @param {boolean} [options.required=true]
 * @param {string} [options.extraClass='']
 * @returns {string}
 */
export function renderTermsCheckbox({ id = 'terms-agree', required = true, extraClass = '' } = {}) {
  const reqAttr = required ? 'required' : '';
  const prefix = t('auth.terms_agreement_prefix', 'I have read and agree to the');
  const termsLabel = t('auth.terms_conditions', 'Terms & Conditions');
  const andLabel = t('auth.and', '&');
  const privacyLabel = t('auth.privacy_policy', 'Privacy Policy');
  const disclaimerText = t(
    'auth.liability_disclaimer_short',
    'Security Disclaimer: In the event of cyber attacks, unauthorized breaches, zero-day exploits, or data leaks perpetrated by malicious third parties, Lumina and the institution are not liable; the individual or entity committing such acts bears sole legal responsibility.'
  );

  return `
    <div class="terms-agreement-card ${extraClass}">
      <label class="terms-agreement-label" for="${id}">
        <input type="checkbox" id="${id}" class="terms-checkbox-input" ${reqAttr}>
        <div class="terms-agreement-text">
          <span>${prefix} 
            <button type="button" class="terms-link-btn open-terms-modal-btn" data-tab="terms">${termsLabel}</button> 
            ${andLabel} 
            <button type="button" class="terms-link-btn open-terms-modal-btn" data-tab="privacy">${privacyLabel}</button>.
          </span>
          <div class="terms-disclaimer-notice">
            <i class="ph ph-shield-warning"></i>
            <div>
              <strong>${t('auth.important_notice', 'Important Liability Disclaimer')}:</strong> 
              ${disclaimerText} 
              <button type="button" class="terms-link-btn open-terms-modal-btn" data-tab="security" style="display:inline-block;margin-left:4px;">
                ${t('auth.read_full_disclaimer', 'Read Full Terms →')}
              </button>
            </div>
          </div>
        </div>
      </label>
    </div>
  `;
}

/**
 * Shows the Terms, Privacy & Security Disclaimer modal with tabs
 * @param {string} [initialTab='security'] - 'security' | 'terms' | 'privacy'
 * @param {Function} [onAccept=null] - Optional callback when user clicks "I Understand & Accept"
 */
export function showTermsModal(initialTab = 'security', onAccept = null) {
  const root = document.getElementById('modal-root');
  if (!root) return;

  const modalHtml = `
    <div class="modal-overlay" id="terms-modal-overlay">
      <div class="modal" style="max-width: 680px; width: 95%;">
        <div class="modal-header">
          <div style="display:flex;align-items:center;gap:10px;">
            <div style="width:34px;height:34px;border-radius:8px;background:var(--accent-light);display:flex;align-items:center;justify-content:center;color:var(--accent);">
              <i class="ph ph-shield-check" style="font-size:1.25rem;"></i>
            </div>
            <div>
              <h3 style="margin:0;font-size:1.1rem;font-weight:700;">
                ${t('auth.terms_modal_title', 'Terms of Service, Privacy Policy & Security Disclaimer')}
              </h3>
              <p style="margin:0;font-size:0.75rem;color:var(--text-muted);">
                MIT-ADT University Lumina Mentorship Platform
              </p>
            </div>
          </div>
          <button class="modal-close" id="terms-modal-close" aria-label="Close modal">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </div>

        <!-- Navigation Tabs -->
        <div class="terms-modal-tabs">
          <button type="button" class="terms-modal-tab-btn ${initialTab === 'security' ? 'active' : ''}" data-target="tab-security">
            <i class="ph ph-shield-warning" style="margin-right:4px;"></i>
            ${t('auth.tab_security', 'Cybersecurity & Liability Disclaimer')}
          </button>
          <button type="button" class="terms-modal-tab-btn ${initialTab === 'terms' ? 'active' : ''}" data-target="tab-terms">
            <i class="ph ph-file-text" style="margin-right:4px;"></i>
            ${t('auth.tab_terms', 'Terms & Conditions')}
          </button>
          <button type="button" class="terms-modal-tab-btn ${initialTab === 'privacy' ? 'active' : ''}" data-target="tab-privacy">
            <i class="ph ph-lock-key" style="margin-right:4px;"></i>
            ${t('auth.tab_privacy', 'Privacy Policy')}
          </button>
        </div>

        <div class="modal-body" style="padding:0;overflow:hidden;">
          
          <!-- TAB 1: Cybersecurity & Breach Liability Disclaimer -->
          <div class="terms-modal-tab-pane ${initialTab === 'security' ? 'active' : ''}" id="tab-security">
            <div class="terms-alert-card">
              <div class="terms-clause-title">
                <i class="ph ph-warning-octagon" style="font-size:1.15rem;"></i>
                Non-Liability for Cyber Attacks & Security Breaches
              </div>
              <p style="margin:0;font-size:0.84rem;line-height:1.55;">
                <strong>IMPORTANT NOTICE:</strong> In the event that this application, its connected databases, or hosting infrastructure suffers a security breach, data leak, unauthorized intrusion, ransomware attack, zero-day exploit, or malicious tampering by external hackers, bad actors, or hostile third parties, <strong>Lumina and the institution (MIT-ADT University) are NOT liable or responsible for any resulting damages, loss, or data exposure.</strong>
              </p>
            </div>

            <div class="terms-clause-box">
              <div class="terms-clause-title">
                <i class="ph ph-gavel"></i>
                Sole Liability of Perpetrators & Malicious Hackers
              </div>
              <p style="margin:0 0 8px 0;">
                The individual, group, or organization executing the cyber attack, unauthorized access, intrusion, interception, or exfiltration of data—or anyone using such compromised data to harm or exploit users—bears <strong>100% sole civil, criminal, and financial liability</strong>.
              </p>
              <p style="margin:0;font-size:0.8rem;color:var(--text-muted);">
                Any unlawful attempt to attack, deface, or compromise the system is punishable under applicable cybersecurity laws, including Section 43, 66, and 66F of the Information Technology Act, 2000, and other relevant criminal codes. All unauthorized access attempts are logged and will be handed over to legal authorities.
              </p>
            </div>

            <div class="terms-clause-box">
              <div class="terms-clause-title">
                <i class="ph ph-key"></i>
                User Credential & Password Safeguards
              </div>
              <p style="margin:0 0 8px 0;">
                Every user (student, faculty, mentor, HOD, and administrator) is strictly required to protect their login credentials. Never disclose your password to anyone. Lumina administrators will never ask for your password.
              </p>
              <p style="margin:0;font-size:0.8rem;color:var(--text-muted);">
                Any unauthorized access occurring as a result of credential sharing, weak passwords, or compromised personal devices is the personal responsibility of the user.
              </p>
            </div>

            <div class="terms-clause-box">
              <div class="terms-clause-title">
                <i class="ph ph-shield-check"></i>
                Institutional Good Faith & Security Measures
              </div>
              <p style="margin:0;">
                The platform utilizes role-based access control, secure HTTP-only session cookies, server-side claim verification, and encrypted network transmission. Systems are maintained with standard engineering diligence for educational mentorship.
              </p>
            </div>
          </div>

          <!-- TAB 2: Terms & Conditions -->
          <div class="terms-modal-tab-pane ${initialTab === 'terms' ? 'active' : ''}" id="tab-terms">
            <div class="terms-clause-box">
              <div class="terms-clause-title">
                <i class="ph ph-check-circle"></i>
                1. Acceptance of Terms
              </div>
              <p style="margin:0;">
                By signing in or registering for a Lumina account, you agree to comply with and be bound by these Terms of Service. If you do not agree with any part of these terms, you must not use or access the portal.
              </p>
            </div>

            <div class="terms-clause-box">
              <div class="terms-clause-title">
                <i class="ph ph-identification-badge"></i>
                2. Academic & Mentorship Purpose
              </div>
              <p style="margin:0;">
                Lumina is designed exclusively for educational administration, student mentorship records, booklet compliance, grievance resolution, and academic meetings. Commercial use, unauthorized data harvesting, or automated scraping is strictly prohibited.
              </p>
            </div>

            <div class="terms-clause-box">
              <div class="terms-clause-title">
                <i class="ph ph-prohibit"></i>
                3. Prohibited Conduct
              </div>
              <ul style="margin:6px 0 0 18px;padding:0;font-size:0.84rem;">
                <li>Attempting to bypass role-based security boundaries or access unauthorized student records.</li>
                <li>Conducting denial of service, vulnerability scanning, or automated probing against system endpoints.</li>
                <li>Submitting fraudulent, malicious, or impersonated identity documents, PRNs, or employee IDs.</li>
                <li>Harassment, bullying, or abusive behavior in meetings, chats, or grievance submissions.</li>
              </ul>
            </div>

            <div class="terms-clause-box">
              <div class="terms-clause-title">
                <i class="ph ph-clock-counter-clockwise"></i>
                4. Account Approval & Suspension
              </div>
              <p style="margin:0;">
                All self-registered student and faculty accounts are subject to administrative review and approval by assigned mentors and department heads. The institution reserves the right to suspend or terminate accounts that breach institutional guidelines.
              </p>
            </div>
          </div>

          <!-- TAB 3: Privacy Policy -->
          <div class="terms-modal-tab-pane ${initialTab === 'privacy' ? 'active' : ''}" id="tab-privacy">
            <div class="terms-clause-box">
              <div class="terms-clause-title">
                <i class="ph ph-database"></i>
                1. Data Collected
              </div>
              <p style="margin:0;">
                Lumina collects only information required for academic guidance: student name, official university email, enrollment PRN number, department, class, academic milestones, attendance, meeting logs, and student grievance submissions.
              </p>
            </div>

            <div class="terms-clause-box">
              <div class="terms-clause-title">
                <i class="ph ph-eye"></i>
                2. How Data Is Used & Shared
              </div>
              <p style="margin:0 0 8px 0;">
                Your data is accessible strictly to authorized academic personnel: your assigned faculty mentor, Department Head (HOD), Dean, and administrative staff based on verified roles.
              </p>
              <p style="margin:0;font-weight:600;color:var(--text-primary);">
                We do NOT sell, rent, monetize, or disclose your personal data to commercial third parties, ad networks, or data brokers.
              </p>
            </div>

            <div class="terms-clause-box">
              <div class="terms-clause-title">
                <i class="ph ph-trash"></i>
                3. Data Retention & Academic Records
              </div>
              <p style="margin:0;">
                Mentorship booklets and meeting records are maintained during the student's active enrollment for statutory compliance (NAAC, NIRF, AICTE) and are archived in accordance with university record policies.
              </p>
            </div>
          </div>

        </div>

        <div class="modal-footer" style="padding:14px 22px;border-top:1px solid var(--border);display:flex;justify-content:space-between;align-items:center;">
          <span style="font-size:0.75rem;color:var(--text-muted);">
            ${t('auth.last_updated', 'Last Updated')}: October 2026
          </span>
          <div style="display:flex;gap:10px;">
            <button type="button" class="btn btn-secondary btn-sm" id="terms-modal-cancel">
              ${t('common.close', 'Close')}
            </button>
            <button type="button" class="btn btn-primary btn-sm" id="terms-modal-accept">
              <i class="ph ph-check" style="margin-right:4px;"></i>
              ${t('auth.accept_terms_btn', 'I Understand & Accept')}
            </button>
          </div>
        </div>
      </div>
    </div>
  `;

  root.innerHTML = modalHtml;

  const overlay = document.getElementById('terms-modal-overlay');
  const closeBtn = document.getElementById('terms-modal-close');
  const cancelBtn = document.getElementById('terms-modal-cancel');
  const acceptBtn = document.getElementById('terms-modal-accept');
  const tabBtns = root.querySelectorAll('.terms-modal-tab-btn');
  const tabPanes = root.querySelectorAll('.terms-modal-tab-pane');

  const close = () => {
    hideModal();
  };

  closeBtn?.addEventListener('click', close);
  cancelBtn?.addEventListener('click', close);
  overlay?.addEventListener('click', (e) => {
    if (e.target === overlay) close();
  });

  acceptBtn?.addEventListener('click', () => {
    close();
    if (typeof onAccept === 'function') {
      onAccept();
    }
  });

  // Tab switching
  tabBtns.forEach((btn) => {
    btn.addEventListener('click', () => {
      const targetId = btn.dataset.target;
      tabBtns.forEach((b) => b.classList.remove('active'));
      tabPanes.forEach((p) => p.classList.remove('active'));

      btn.classList.add('active');
      const targetPane = document.getElementById(targetId);
      if (targetPane) targetPane.classList.add('active');
    });
  });

  // Esc key handler
  const escapeHandler = (e) => {
    if (e.key === 'Escape') {
      close();
      document.removeEventListener('keydown', escapeHandler);
    }
  };
  document.addEventListener('keydown', escapeHandler);
}

/**
 * Initializes click handlers for elements with `.open-terms-modal-btn` inside a container.
 * When the user clicks "I Understand & Accept" in the modal, the checkbox is automatically checked.
 * 
 * @param {HTMLElement} container
 * @param {string} [checkboxId='terms-agree']
 */
export function initTermsTriggers(container, checkboxId = 'terms-agree') {
  if (!container) return;

  const triggerButtons = container.querySelectorAll('.open-terms-modal-btn');
  triggerButtons.forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      const tab = btn.dataset.tab || 'security';
      showTermsModal(tab, () => {
        const checkbox = document.getElementById(checkboxId);
        if (checkbox) {
          checkbox.checked = true;
          // Trigger change event for listeners
          checkbox.dispatchEvent(new Event('change', { bubbles: true }));
        }
      });
    });
  });
}
