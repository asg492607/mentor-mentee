// Student — Profile Page
// Profile details, emergency contacts, and personal information updates.
import { getUserProfile } from '/js/auth.js';
import { createSidebar } from '/js/components/sidebar.js';
import { createHeader } from '/js/components/header.js';
import { showToast } from '/js/components/toast.js';
import { StudentService, StatsService } from '/js/services.js';
import { escapeHtml } from '/js/utils.js';
import { t } from '/js/i18n.js';
import { AttendanceService, ResultService } from '/js/services/academic-service.js';

function riskBadge(r) {
  const cls = { HIGH: 'badge-danger', MEDIUM: 'badge-warning', LOW: 'badge-success' }[r] || 'badge-muted';
  const label = t('status.' + String(r).toLowerCase(), r || 'N/A');
  return `<span class="badge ${cls}">${escapeHtml(label)}</span>`;
}

export async function render(container) {
  const user = getUserProfile();

  container.innerHTML = `
    <div class="dashboard-layout fade-in">
      ${createSidebar(user.role, '/student/profile')}
      <div class="main-content">
        ${createHeader(t('profile.title', 'Student Profile & Academic Dossier'), user)}
        <div class="page-content" id="profile-wrap">
          <div style="display:flex;justify-content:center;padding:60px;"><div class="spinner"></div></div>
        </div>
      </div>
    </div>
  `;

  let profile = {};
  let mentorName = '—';
  let coMentorName = '—';
  let semesterResults = [];
  let monthlyAttendance = [];
  try {
    profile = await StudentService.getFresh(user.id) || { ...user };
    [semesterResults, monthlyAttendance] = await Promise.all([
      ResultService.getByStudent(user.id).catch(() => []),
      AttendanceService.getMonthlyByStudent(user.id).catch(() => [])
    ]);
    const { FacultyService } = await import('/js/services.js');
    if (profile.mentorId) {
      const m1 = await FacultyService.get(profile.mentorId).catch(() => null);
      if (m1) mentorName = m1.name;
    }
    if (profile.secondaryMentorId) {
      const m2 = await FacultyService.get(profile.secondaryMentorId).catch(() => null);
      if (m2) coMentorName = m2.name;
    }
  } catch {
    profile = { ...user };
  }

  const risk = StatsService.computeRisk(profile);
  const resultRows = semesterResults.flatMap(result => {
    const subjects = Array.isArray(result.subjects) ? result.subjects : [];
    return subjects.length ? subjects.map(subject => ({ result, subject })) : [{ result, subject: {} }];
  });
  const initials = escapeHtml((profile.name || 'S').split(' ').map(w=>w[0]).join('').toUpperCase().slice(0,2));

  const contentWrap = container.querySelector('#profile-wrap');
  if (!contentWrap) return;

  contentWrap.innerHTML = `
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:24px;">
      
      <!-- Left: Identity Card -->
      <div style="display:flex;flex-direction:column;gap:18px;">
        <div class="card" style="padding:32px 24px;text-align:center;position:relative;overflow:hidden;">
          <div style="width:76px;height:76px;border-radius:22px;background:linear-gradient(135deg,#6c47ff,#a855f7);color:#fff;display:flex;align-items:center;justify-content:center;font-size:1.8rem;font-weight:800;margin:0 auto 16px;box-shadow:0 8px 20px rgba(108,71,255,0.3);">
            ${initials}
          </div>
          <h3 style="font-size:1.15rem;font-weight:800;margin-bottom:4px;color:var(--text-primary);">${escapeHtml(profile.name || 'Student')}</h3>
          <p style="color:var(--text-secondary);font-size:0.84rem;margin-bottom:14px;">${escapeHtml(profile.email || '')}</p>
          <div style="display:inline-block;margin-bottom:8px;">
            ${riskBadge(profile.riskLevel || risk.riskLevel)}
          </div>
          <p style="color:var(--text-muted);font-size:0.78rem;margin:0;">${t('profile.risk_score', 'Risk Score')}: <strong>${profile.riskScore || risk.riskScore}/100</strong></p>
        </div>

        <div class="card" style="padding:22px;">
          <p style="font-size:0.75rem;font-weight:700;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.06em;margin-bottom:14px;">
            ${t('dash.academic_overview', 'Academic Dossier')}
          </p>
          ${[
            [t('profile.prn', 'PRN / Enrollment'), profile.enrollmentNumber || '—'],
            [t('profile.department', 'Department'), profile.department || '—'],
            [t('profile.class', 'Class / Div'), profile.class ? `Class ${profile.class}` : '—'],
            [t('profile.primary_mentor', 'Primary Mentor'), mentorName],
            [t('profile.co_mentor', 'Co-Mentor'), coMentorName],
            [t('profile.cgpa', 'Current CGPA'), profile.cgpa || '—'],
            [t('profile.attendance', 'Attendance'), (profile.attendance || 0) + '%'],
          ].map(([l,v]) => `
            <div style="display:flex;justify-content:space-between;align-items:center;padding:10px 0;border-bottom:1px solid var(--border);">
              <span style="color:var(--text-secondary);font-size:0.84rem;">${escapeHtml(l)}</span>
              <strong style="font-size:0.88rem;color:var(--text-primary);">${escapeHtml(String(v))}</strong>
            </div>
          `).join('')}
        </div>
      </div>

      <!-- Right: Edit Form Card -->
      <div class="card" style="padding:28px;">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:24px;padding-bottom:14px;border-bottom:1px solid var(--border);">
          <div>
            <h3 style="font-size:1.1rem;font-weight:700;margin:0 0 2px 0;color:var(--text-primary);">${t('common.edit', 'Edit Profile')}</h3>
            <p style="font-size:0.8rem;color:var(--text-muted);margin:0;">Keep your academic milestones and interests up to date.</p>
          </div>
          <button class="btn btn-primary btn-sm" id="btn-save" style="display:inline-flex;align-items:center;gap:6px;padding:8px 18px;border-radius:10px;font-weight:600;">
            <i class="ph ph-floppy-disk"></i> ${t('common.save', 'Save Changes')}
          </button>
        </div>

        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:18px;">
          <div class="form-group">
            <label class="form-label">${t('register.full_name', 'Full Name')}</label>
            <input type="text" id="p-name" class="form-input" value="${escapeHtml(profile.name || '')}">
          </div>
          <div class="form-group">
            <label class="form-label">${t('profile.prn', 'Enrollment / PRN')}</label>
            <input type="text" id="p-roll" class="form-input" value="${escapeHtml(profile.enrollmentNumber || '')}" readonly style="opacity:0.65;cursor:not-allowed;">
          </div>
          <div class="form-group" style="grid-column:1/-1;">
            <label class="form-label">Areas of Academic Interest</label>
            <textarea id="p-interests" class="form-textarea" style="min-height:80px;" placeholder="e.g. Machine Learning, Cloud Computing, Cybersecurity...">${escapeHtml(profile.interests || '')}</textarea>
          </div>
          <div class="form-group" style="grid-column:1/-1;">
            <label class="form-label">Technical &amp; Soft Skills</label>
            <textarea id="p-skills" class="form-textarea" style="min-height:80px;" placeholder="e.g. Python, React, Data Analysis, Leadership...">${escapeHtml(profile.skills || '')}</textarea>
          </div>
          <div class="form-group" style="grid-column:1/-1;">
            <label class="form-label">Career Objectives &amp; Aspirations</label>
            <textarea id="p-career" class="form-textarea" style="min-height:80px;" placeholder="Describe your career goals for higher studies or industry...">${escapeHtml(profile.careerGoal || '')}</textarea>
          </div>
        </div>
      </div>

    </div>
  `;

  contentWrap.insertAdjacentHTML('beforeend', `
    <div class="card" style="margin-top:24px;padding:24px;">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:12px;flex-wrap:wrap;margin-bottom:16px;">
        <div><h3 style="margin:0;">Marks and monthly attendance</h3><p style="margin:4px 0 0;color:var(--text-muted);font-size:.82rem;">Exam Section results and class register records.</p></div>
        <span class="badge ${profile.learnerLevel === 'SLOW' ? 'badge-danger' : profile.learnerLevel === 'MEDIUM' ? 'badge-warning' : profile.learnerLevel === 'ADVANCED' ? 'badge-success' : 'badge-muted'}">${profile.learnerLevel === 'NOT_ASSESSED' || !profile.learnerLevel ? 'Learner level not assessed' : `${escapeHtml(profile.learnerLevel)} learner`}</span>
      </div>
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(300px,1fr));gap:20px;">
        <div><h4 style="margin:0 0 10px;">Semester marks</h4>${resultRows.length ? `<div style="overflow:auto;max-height:360px;"><table class="data-table"><thead><tr><th>Semester</th><th>Subject</th><th>Marks</th><th>Grade</th><th>SGPA</th></tr></thead><tbody>${resultRows.map(({ result, subject }) => `<tr><td>${escapeHtml(result.semester || '—')}</td><td>${escapeHtml(subject.name || result.examName || 'Semester summary')}</td><td>${subject.marks === null || subject.marks === undefined ? '—' : `${escapeHtml(subject.marks)}%`}</td><td>${escapeHtml(subject.grade || '—')}</td><td>${escapeHtml(result.sgpa ?? '—')}</td></tr>`).join('')}</tbody></table></div>` : '<p style="color:var(--text-muted);">No exam results have been published yet.</p>'}</div>
        <div><h4 style="margin:0 0 10px;">Monthly attendance</h4>${monthlyAttendance.length ? `<div style="overflow:auto;max-height:360px;"><table class="data-table"><thead><tr><th>Month</th><th>Sessions</th><th>Present</th><th>Attendance</th></tr></thead><tbody>${monthlyAttendance.slice(0, 12).map(month => `<tr><td>${escapeHtml(new Date(`${month.month}-01T00:00:00`).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' }))}</td><td>${month.sessions}</td><td>${month.present}</td><td><strong style="color:${month.attendance <= 40 ? 'var(--danger)' : 'inherit'};">${month.attendance}%</strong>${month.attendance <= 40 ? ' <span class="badge badge-danger">FR</span>' : ''}</td></tr>`).join('')}</tbody></table></div>` : '<p style="color:var(--text-muted);">No monthly attendance records are available yet.</p>'}</div>
      </div>
    </div>
    <div class="card" style="margin-top:20px;padding:24px;">
      <div style="display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap;margin-bottom:8px;">
        <div><h3 style="margin:0;">Parent / guardian phone</h3><p style="margin:4px 0 0;color:var(--text-muted);font-size:.82rem;">Verify the number with an SMS code. The profile will only save a verified number.</p></div>
        <span id="parent-phone-status" class="badge ${profile.parentPhoneVerified ? 'badge-success' : 'badge-muted'}">${profile.parentPhoneVerified ? 'Verified' : 'Not verified'}</span>
      </div>
      <div style="display:flex;gap:10px;align-items:flex-end;flex-wrap:wrap;">
        <div class="form-group" style="margin:0;flex:1;min-width:240px;"><label class="form-label" for="parent-phone">Phone number (international format)</label><input id="parent-phone" type="tel" class="form-input" value="${escapeHtml(profile.parentPhone || '')}" placeholder="+919876543210" autocomplete="tel"></div>
        <button id="parent-phone-send" class="btn btn-secondary" type="button">Send OTP</button>
      </div>
      <div id="parent-phone-code-wrap" style="display:none;gap:10px;align-items:flex-end;flex-wrap:wrap;margin-top:12px;">
        <div class="form-group" style="margin:0;flex:1;min-width:180px;"><label class="form-label" for="parent-phone-code">SMS verification code</label><input id="parent-phone-code" type="text" class="form-input" inputmode="numeric" autocomplete="one-time-code" maxlength="8" placeholder="Enter code"></div>
        <button id="parent-phone-verify" class="btn btn-primary" type="button">Verify and save</button>
      </div>
      <div id="parent-phone-recaptcha" aria-hidden="true"></div>
      <p id="parent-phone-message" role="status" style="margin:10px 0 0;color:var(--text-muted);font-size:.82rem;"></p>
    </div>
  `);

  let otpApp = null;
  let otpAuth = null;
  let otpVerifier = null;
  let otpConfirmation = null;
  let otpPhone = '';
  async function clearOtpSession() {
    try { otpVerifier?.clear(); } catch (_) {}
    if (otpAuth) {
      const { signOut } = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js');
      await signOut(otpAuth).catch(() => {});
    }
    if (otpApp) {
      const { deleteApp } = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js');
      await deleteApp(otpApp).catch(() => {});
    }
    otpApp = otpAuth = otpVerifier = otpConfirmation = null;
    otpPhone = '';
  }
  const parentPhoneInput = contentWrap.querySelector('#parent-phone');
  const parentPhoneMessage = contentWrap.querySelector('#parent-phone-message');
  contentWrap.querySelector('#parent-phone-send')?.addEventListener('click', async event => {
    const button = event.currentTarget;
    const phone = parentPhoneInput.value.trim();
    if (!/^\+[1-9]\d{7,14}$/.test(phone)) {
      parentPhoneMessage.textContent = 'Enter a valid international phone number, for example +919876543210.';
      return;
    }
    button.disabled = true;
    parentPhoneMessage.textContent = 'Sending verification code…';
    try {
      await clearOtpSession();
      const { firebaseConfig } = await import('/js/firebase-init.js');
      const { initializeApp } = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js');
      const { getAuth, RecaptchaVerifier, signInWithPhoneNumber } = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js');
      otpApp = initializeApp(firebaseConfig, `parent-phone-${Date.now()}`);
      otpAuth = getAuth(otpApp);
      otpVerifier = new RecaptchaVerifier(otpAuth, contentWrap.querySelector('#parent-phone-recaptcha'), { size: 'invisible' });
      otpConfirmation = await signInWithPhoneNumber(otpAuth, phone, otpVerifier);
      otpPhone = phone;
      contentWrap.querySelector('#parent-phone-code-wrap').style.display = 'flex';
      parentPhoneMessage.textContent = `A code was sent to ${phone}.`;
    } catch (error) {
      await clearOtpSession();
      parentPhoneMessage.textContent = error.message || 'Could not send the code. Check Firebase Phone Authentication and try again.';
    } finally { button.disabled = false; }
  });
  contentWrap.querySelector('#parent-phone-verify')?.addEventListener('click', async event => {
    const button = event.currentTarget;
    const code = contentWrap.querySelector('#parent-phone-code').value.trim();
    if (!otpConfirmation || otpPhone !== parentPhoneInput.value.trim() || !code) {
      parentPhoneMessage.textContent = 'Send a code to this number and enter it before verifying.';
      return;
    }
    button.disabled = true;
    parentPhoneMessage.textContent = 'Verifying number…';
    try {
      const result = await otpConfirmation.confirm(code);
      const phoneProofToken = await result.user.getIdToken(true);
      const { api } = await import('/js/api.js');
      const saved = await api.post('/student/profile/parent-phone/verify', { parentPhone: otpPhone, phoneProofToken });
      const refreshed = await StudentService.getFresh(user.id).catch(() => null);
      Object.assign(profile, refreshed || saved);
      contentWrap.querySelector('#parent-phone-status').className = 'badge badge-success';
      contentWrap.querySelector('#parent-phone-status').textContent = 'Verified';
      parentPhoneMessage.textContent = 'Parent / guardian number verified and saved.';
      await clearOtpSession();
      contentWrap.querySelector('#parent-phone-code-wrap').style.display = 'none';
    } catch (error) {
      parentPhoneMessage.textContent = error.message || 'The code was invalid or expired. Request another code.';
    } finally { button.disabled = false; }
  });

  document.getElementById('btn-save')?.addEventListener('click', async () => {
    const updates = {
      name:       document.getElementById('p-name').value.trim(),
      interests:  document.getElementById('p-interests').value.trim(),
      skills:     document.getElementById('p-skills').value.trim(),
      careerGoal: document.getElementById('p-career').value.trim()
    };
    const btn = document.getElementById('btn-save');
    if (btn) btn.disabled = true;
    try {
      await StudentService.update(user.id, updates);
      Object.assign(profile, updates);
      showToast(t('common.save', 'Profile updated successfully!'), 'success');
    } catch (err) {
      showToast('Error: ' + err.message, 'error');
    } finally {
      if (btn) btn.disabled = false;
    }
  });
}

