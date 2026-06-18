import { getUserProfile } from '/js/auth.js';
import { createSidebar } from '/js/components/sidebar.js';
import { createHeader } from '/js/components/header.js';
import { showToast } from '/js/components/toast.js';

function getSetting(key, def) {
  const v = localStorage.getItem(`mentoros_${key}`);
  return v !== null ? JSON.parse(v) : def;
}

function setSetting(key, val) {
  localStorage.setItem(`mentoros_${key}`, JSON.stringify(val));
}

export async function render(container) {
  const user = getUserProfile();

  container.innerHTML = `
    <div class="dashboard-layout fade-in">
      ${createSidebar(user.role, '/admin/settings')}
      <div class="main-content">
        ${createHeader('Platform Settings', user)}
        <div class="page-content">
          <div style="max-width:640px;display:flex;flex-direction:column;gap:20px;">

            <!-- General Settings -->
            <div class="card" style="padding:24px;">
              <h3 style="font-size:0.95rem;font-weight:600;margin-bottom:20px;">General Settings</h3>

              <div class="form-group">
                <label class="form-label">Max Students Per Mentor</label>
                <input type="number" id="setting-max-students" class="form-input" value="${getSetting('maxStudents',20)}" min="1" max="50" style="max-width:160px;">
                <p style="font-size:0.78rem;color:var(--text-muted);margin-top:6px;">Default capacity for each mentor</p>
              </div>

              <div class="divider"></div>

              <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px;">
                <div>
                  <p style="font-weight:500;font-size:0.875rem;">Auto-Allocation</p>
                  <p style="color:var(--text-muted);font-size:0.78rem;">Automatically assign mentors to new students</p>
                </div>
                <label style="position:relative;display:inline-block;width:44px;height:24px;cursor:pointer;">
                  <input type="checkbox" id="setting-auto-alloc" ${getSetting('autoAlloc',true)?'checked':''} style="opacity:0;width:0;height:0;">
                  <span id="toggle-auto" style="position:absolute;inset:0;background:${getSetting('autoAlloc',true)?'var(--accent)':'var(--bg-glass-hover)'};border-radius:24px;transition:0.2s;">
                    <span style="position:absolute;left:${getSetting('autoAlloc',true)?'22':'2'}px;top:2px;width:20px;height:20px;background:white;border-radius:50%;transition:0.2s;"></span>
                  </span>
                </label>
              </div>

              <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:20px;">
                <div>
                  <p style="font-weight:500;font-size:0.875rem;">Email Notifications</p>
                  <p style="color:var(--text-muted);font-size:0.78rem;">Send email notifications for meetings and issues</p>
                </div>
                <label style="position:relative;display:inline-block;width:44px;height:24px;cursor:pointer;">
                  <input type="checkbox" id="setting-email-notif" ${getSetting('emailNotif',false)?'checked':''} style="opacity:0;width:0;height:0;">
                  <span id="toggle-email" style="position:absolute;inset:0;background:${getSetting('emailNotif',false)?'var(--accent)':'var(--bg-glass-hover)'};border-radius:24px;transition:0.2s;">
                    <span style="position:absolute;left:${getSetting('emailNotif',false)?'22':'2'}px;top:2px;width:20px;height:20px;background:white;border-radius:50%;transition:0.2s;"></span>
                  </span>
                </label>
              </div>

              <button class="btn btn-primary" id="btn-save-settings">Save Settings</button>
            </div>

            <!-- Theme -->
            <div class="card" style="padding:24px;">
              <h3 style="font-size:0.95rem;font-weight:600;margin-bottom:16px;">Appearance</h3>
              <div style="display:flex;gap:12px;">
                <button class="btn ${document.documentElement.getAttribute('data-theme')==='dark'?'btn-primary':'btn-secondary'}" id="theme-dark">🌙 Dark Mode</button>
                <button class="btn ${document.documentElement.getAttribute('data-theme')==='light'?'btn-primary':'btn-secondary'}" id="theme-light">☀️ Light Mode</button>
              </div>
            </div>

            <!-- Danger Zone -->
            <div class="card" style="padding:24px;border-color:var(--danger);">
              <h3 style="font-size:0.95rem;font-weight:600;color:var(--danger);margin-bottom:8px;">⚠ Danger Zone</h3>
              <p style="color:var(--text-secondary);font-size:0.875rem;margin-bottom:16px;">These actions are irreversible. Please proceed with caution.</p>
              <button class="btn btn-danger" id="btn-reset-alloc">Reset All Allocations</button>
            </div>

          </div>
        </div>
      </div>
    </div>
  `;

  document.getElementById('logout-btn')?.addEventListener('click', async () => {
    const { logout } = await import('/js/auth.js'); await logout();
  });

  // Toggle helpers
  function wireToggle(checkId, spanId, key) {
    const chk  = document.getElementById(checkId);
    const span = document.getElementById(spanId);
    chk.addEventListener('change', () => {
      const v = chk.checked;
      setSetting(key, v);
      span.style.background = v ? 'var(--accent)' : 'var(--bg-glass-hover)';
      span.children[0].style.left = v ? '22px' : '2px';
    });
  }

  wireToggle('setting-auto-alloc', 'toggle-auto',  'autoAlloc');
  wireToggle('setting-email-notif','toggle-email', 'emailNotif');

  document.getElementById('btn-save-settings').addEventListener('click', () => {
    setSetting('maxStudents', parseInt(document.getElementById('setting-max-students').value) || 20);
    showToast('Settings saved!', 'success');
  });

  document.getElementById('btn-reset-alloc').addEventListener('click', () => {
    if (confirm('Are you sure you want to reset ALL mentor allocations? This cannot be undone.')) {
      showToast('Allocations reset (offline mode)', 'warning');
    }
  });

  document.getElementById('theme-dark').addEventListener('click', () => {
    document.documentElement.setAttribute('data-theme','dark');
    localStorage.setItem('theme','dark');
    document.getElementById('theme-dark').className = 'btn btn-primary';
    document.getElementById('theme-light').className = 'btn btn-secondary';
    showToast('Dark mode enabled', 'info');
  });

  document.getElementById('theme-light').addEventListener('click', () => {
    document.documentElement.setAttribute('data-theme','light');
    localStorage.setItem('theme','light');
    document.getElementById('theme-light').className = 'btn btn-primary';
    document.getElementById('theme-dark').className  = 'btn btn-secondary';
    showToast('Light mode enabled', 'info');
  });
}
