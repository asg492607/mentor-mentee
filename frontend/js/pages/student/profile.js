import { getUserProfile } from '/js/auth.js';
import { createSidebar } from '/js/components/sidebar.js';
import { createHeader } from '/js/components/header.js';
import { showToast } from '/js/components/toast.js';
import { StudentService, StatsService } from '/js/services.js';
import { escapeHtml } from '/js/utils.js';
import { t } from '/js/i18n.js';

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
  try {
    profile = await StudentService.get(user.id) || { ...user };
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
          <div class="form-group">
            <label class="form-label">${t('profile.cgpa', 'Current CGPA')}</label>
            <input type="number" id="p-cgpa" class="form-input" value="${profile.cgpa || ''}" step="0.01" min="0" max="10">
          </div>
          <div class="form-group">
            <label class="form-label">${t('profile.attendance', 'Attendance')} (%)</label>
            <input type="number" id="p-att" class="form-input" value="${profile.attendance || ''}" min="0" max="100">
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

  document.getElementById('btn-save')?.addEventListener('click', async () => {
    const cgpa       = parseFloat(document.getElementById('p-cgpa').value) || 0;
    const attendance = parseFloat(document.getElementById('p-att').value) || 0;
    const updates = {
      name:       document.getElementById('p-name').value.trim(),
      cgpa,
      attendance,
      interests:  document.getElementById('p-interests').value.trim(),
      skills:     document.getElementById('p-skills').value.trim(),
      careerGoal: document.getElementById('p-career').value.trim(),
      ...StatsService.computeRisk({ cgpa, attendance })
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
