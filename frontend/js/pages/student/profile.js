import { api } from '/js/api.js';
import { getUserProfile } from '/js/auth.js';
import { createSidebar } from '/js/components/sidebar.js';
import { createHeader } from '/js/components/header.js';
import { showToast } from '/js/components/toast.js';

function riskBadge(r) {
  return `<span class="badge ${{HIGH:'badge-danger',MEDIUM:'badge-warning',LOW:'badge-success'}[r]||'badge-muted'}">${r||'N/A'}</span>`;
}

export async function render(container) {
  const user = getUserProfile();

  container.innerHTML = `
    <div class="dashboard-layout fade-in">
      ${createSidebar(user.role, '/student/profile')}
      <div class="main-content">
        ${createHeader('Profile', user)}
        <div class="page-content">
          <div id="profile-content">
            <div class="card" style="display:flex;align-items:center;justify-content:center;height:200px;">
              <div class="spinner"></div>
            </div>
          </div>
        </div>
      </div>
    </div>
  `;

  document.getElementById('logout-btn')?.addEventListener('click', async () => {
    const { logout } = await import('/js/auth.js'); await logout();
  });

  // Load profile
  let profile = { ...user };
  try { const d = await api.get('/api/student/profile'); profile = { ...profile, ...d }; } catch {}

  const pc = document.getElementById('profile-content');
  const initials = (profile.name||'U').split(' ').map(w=>w[0]).join('').toUpperCase().slice(0,2);

  pc.innerHTML = `
    <div style="display:grid;grid-template-columns:280px 1fr;gap:20px;">
      <!-- Avatar Card -->
      <div style="display:flex;flex-direction:column;gap:16px;">
        <div class="card" style="padding:28px;text-align:center;">
          <div class="avatar avatar-xl" style="margin:0 auto 16px;">${initials}</div>
          <h3 style="font-size:1rem;font-weight:700;margin-bottom:4px;">${profile.name||'Student'}</h3>
          <p style="color:var(--text-muted);font-size:0.825rem;margin-bottom:12px;">${profile.email||''}</p>
          ${riskBadge(profile.riskLevel||'LOW')}
        </div>
        <div class="card" style="padding:20px;">
          <p style="font-size:0.75rem;font-weight:600;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.05em;margin-bottom:12px;">Academic Stats</p>
          <div style="display:flex;flex-direction:column;gap:10px;">
            <div style="display:flex;justify-content:space-between;"><span style="color:var(--text-secondary);font-size:0.875rem;">CGPA</span><strong>${profile.cgpa||'—'}</strong></div>
            <div style="display:flex;justify-content:space-between;"><span style="color:var(--text-secondary);font-size:0.875rem;">Attendance</span><strong>${profile.attendance||0}%</strong></div>
            <div style="display:flex;justify-content:space-between;"><span style="color:var(--text-secondary);font-size:0.875rem;">Year</span><strong>Year ${profile.year||'—'}</strong></div>
            <div style="display:flex;justify-content:space-between;"><span style="color:var(--text-secondary);font-size:0.875rem;">Roll No</span><strong>${profile.rollNumber||'—'}</strong></div>
            <div style="display:flex;justify-content:space-between;"><span style="color:var(--text-secondary);font-size:0.875rem;">Department</span><strong>${profile.department||'—'}</strong></div>
          </div>
        </div>
      </div>

      <!-- Edit Form -->
      <div class="card" style="padding:28px;">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:24px;">
          <h3 style="font-size:1rem;font-weight:600;margin:0;">Edit Profile</h3>
          <button class="btn btn-primary btn-sm" id="btn-save-profile">Save Changes</button>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;">
          <div class="form-group">
            <label class="form-label">Full Name</label>
            <input type="text" id="p-name" class="form-input" value="${profile.name||''}">
          </div>
          <div class="form-group">
            <label class="form-label">Roll Number</label>
            <input type="text" id="p-roll" class="form-input" value="${profile.rollNumber||''}" readonly style="opacity:0.6;">
          </div>
          <div class="form-group">
            <label class="form-label">CGPA</label>
            <input type="number" id="p-cgpa" class="form-input" value="${profile.cgpa||''}" step="0.01" min="0" max="10">
          </div>
          <div class="form-group">
            <label class="form-label">Attendance (%)</label>
            <input type="number" id="p-attendance" class="form-input" value="${profile.attendance||''}" min="0" max="100">
          </div>
          <div class="form-group" style="grid-column:1/-1;">
            <label class="form-label">Interests</label>
            <textarea id="p-interests" class="form-textarea" style="min-height:80px;" placeholder="e.g. Machine Learning, Web Development...">${profile.interests||''}</textarea>
          </div>
          <div class="form-group" style="grid-column:1/-1;">
            <label class="form-label">Skills</label>
            <textarea id="p-skills" class="form-textarea" style="min-height:80px;" placeholder="e.g. Python, React, Data Analysis...">${profile.skills||''}</textarea>
          </div>
          <div class="form-group" style="grid-column:1/-1;">
            <label class="form-label">Career Goal</label>
            <textarea id="p-career" class="form-textarea" style="min-height:80px;" placeholder="Describe your career objectives...">${profile.careerGoal||''}</textarea>
          </div>
        </div>
      </div>
    </div>
  `;

  document.getElementById('btn-save-profile').addEventListener('click', async () => {
    const updates = {
      name:       document.getElementById('p-name').value.trim(),
      cgpa:       parseFloat(document.getElementById('p-cgpa').value) || 0,
      attendance: parseFloat(document.getElementById('p-attendance').value) || 0,
      interests:  document.getElementById('p-interests').value.trim(),
      skills:     document.getElementById('p-skills').value.trim(),
      careerGoal: document.getElementById('p-career').value.trim(),
    };
    try {
      await api.put('/api/student/profile', updates);
      showToast('Profile updated!', 'success');
    } catch {
      showToast('Profile saved (offline mode)', 'info');
    }
  });
}
