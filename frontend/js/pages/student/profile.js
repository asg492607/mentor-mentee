import { getUserProfile } from '/js/auth.js';
import { createSidebar } from '/js/components/sidebar.js';
import { createHeader } from '/js/components/header.js';
import { showToast } from '/js/components/toast.js';
import { StudentService, StatsService } from '/js/services.js';

function riskBadge(r) {
  const cls = {HIGH:'badge-danger',MEDIUM:'badge-warning',LOW:'badge-success'}[r] || 'badge-muted';
  return `<span class="badge ${cls}">${r||'N/A'}</span>`;
}

export async function render(container) {
  const user = getUserProfile();

  container.innerHTML = `
    <div class="dashboard-layout fade-in">
      ${createSidebar(user.role, '/student/profile')}
      <div class="main-content">
        ${createHeader('Profile', user)}
        <div class="page-content" id="profile-wrap">
          <div style="display:flex;justify-content:center;padding:60px;"><div class="spinner"></div></div>
        </div>
      </div>
    </div>
  `;

  let profile = {};
  try {
    profile = await StudentService.get(user.id) || { ...user };
  } catch {
    profile = { ...user };
  }

  const risk = StatsService.computeRisk(profile);
  const initials = (profile.name || 'S').split(' ').map(w=>w[0]).join('').toUpperCase().slice(0,2);

  (container.querySelector('#profile-wrap') || {}).innerHTML = `
    <div style="display:grid;grid-template-columns:280px 1fr;gap:20px;">
      <!-- Left: Identity Card -->
      <div style="display:flex;flex-direction:column;gap:16px;">
        <div class="card" style="padding:28px;text-align:center;">
          <div class="avatar avatar-xl" style="margin:0 auto 16px;">${initials}</div>
          <h3 style="font-size:1rem;font-weight:700;margin-bottom:4px;">${profile.name || 'Student'}</h3>
          <p style="color:var(--text-muted);font-size:0.825rem;margin-bottom:12px;">${profile.email || ''}</p>
          ${riskBadge(profile.riskLevel || risk.riskLevel)}
          <p style="color:var(--text-muted);font-size:0.75rem;margin-top:8px;">Risk Score: ${profile.riskScore || risk.riskScore}/100</p>
        </div>
        <div class="card" style="padding:20px;">
          <p style="font-size:0.72rem;font-weight:600;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.05em;margin-bottom:12px;">Academic Info</p>
          ${[
            ['Enrollment Number', profile.enrollmentNumber || '—'],
            ['Department',  profile.department || '—'],
            ['Year',        profile.year ? `Year ${profile.year}` : '—'],
            ['CGPA',        profile.cgpa || '—'],
            ['Attendance',  (profile.attendance || 0) + '%'],
          ].map(([l,v]) => `
            <div style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid var(--border);">
              <span style="color:var(--text-secondary);font-size:0.825rem;">${l}</span>
              <strong style="font-size:0.875rem;">${v}</strong>
            </div>
          `).join('')}
        </div>
      </div>

      <!-- Right: Edit Form -->
      <div class="card" style="padding:28px;">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:24px;">
          <h3 style="font-size:1rem;font-weight:600;margin:0;">Edit Profile</h3>
          <button class="btn btn-primary btn-sm" id="btn-save">Save Changes</button>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;">
          <div class="form-group">
            <label class="form-label">Full Name</label>
            <input type="text" id="p-name" class="form-input" value="${profile.name || ''}">
          </div>
          <div class="form-group">
            <label class="form-label">Enrollment Number</label>
            <input type="text" id="p-roll" class="form-input" value="${profile.enrollmentNumber || ''}" readonly style="opacity:0.6;">
          </div>
          <div class="form-group">
            <label class="form-label">CGPA</label>
            <input type="number" id="p-cgpa" class="form-input" value="${profile.cgpa || ''}" step="0.01" min="0" max="10">
          </div>
          <div class="form-group">
            <label class="form-label">Attendance (%)</label>
            <input type="number" id="p-att" class="form-input" value="${profile.attendance || ''}" min="0" max="100">
          </div>
          <div class="form-group" style="grid-column:1/-1;">
            <label class="form-label">Interests</label>
            <textarea id="p-interests" class="form-textarea" style="min-height:80px;" placeholder="e.g. Machine Learning, Web Development...">${profile.interests || ''}</textarea>
          </div>
          <div class="form-group" style="grid-column:1/-1;">
            <label class="form-label">Skills</label>
            <textarea id="p-skills" class="form-textarea" style="min-height:80px;" placeholder="e.g. Python, React, Data Analysis...">${profile.skills || ''}</textarea>
          </div>
          <div class="form-group" style="grid-column:1/-1;">
            <label class="form-label">Career Goal</label>
            <textarea id="p-career" class="form-textarea" style="min-height:80px;" placeholder="Describe your career objectives...">${profile.careerGoal || ''}</textarea>
          </div>
        </div>
      </div>
    </div>
  `;

  document.getElementById('btn-save').addEventListener('click', async () => {
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
    btn.disabled = true;
    try {
      await StudentService.update(user.id, updates);
      // Update local cache
      Object.assign(profile, updates);
      showToast('Profile updated!', 'success');
    } catch (err) {
      showToast('Error: ' + err.message, 'error');
    } finally {
      btn.disabled = false;
    }
  });
}

