import { api } from '/js/api.js';
import { getUserProfile } from '/js/auth.js';
import { createSidebar } from '/js/components/sidebar.js';
import { createHeader } from '/js/components/header.js';
import { showToast } from '/js/components/toast.js';

const MOCK = {
  stats: { totalStudents:480, totalMentors:24, unassignedStudents:42, departments:4 },
  recentRegistrations: [
    { name:'Neha Trivedi', role:'STUDENT', email:'neha@uni.edu', createdAt: new Date(Date.now()-3600000).toISOString() },
    { name:'Dr. Ram Patel', role:'FACULTY', email:'ram@uni.edu', createdAt: new Date(Date.now()-7200000).toISOString() },
    { name:'Aryan Mehta', role:'STUDENT', email:'aryan@uni.edu', createdAt: new Date(Date.now()-10800000).toISOString() },
  ]
};

function timeAgo(iso) {
  const diff = Date.now() - new Date(iso).getTime();
  const h = Math.floor(diff/3600000);
  if (h < 1) return 'just now';
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h/24)}d ago`;
}

export async function render(container) {
  const user = getUserProfile();

  container.innerHTML = `
    <div class="dashboard-layout fade-in">
      ${createSidebar(user.role, '/admin/dashboard')}
      <div class="main-content">
        ${createHeader('Admin Dashboard', user)}
        <div class="page-content" id="admin-dash"></div>
      </div>
    </div>
  `;

  document.getElementById('logout-btn')?.addEventListener('click', async () => {
    const { logout } = await import('/js/auth.js'); await logout();
  });

  let data = MOCK;
  try { data = { ...MOCK, ...await api.get('/api/admin/stats') }; } catch {}

  const s = data.stats;
  const dash = document.getElementById('admin-dash');

  dash.innerHTML = `
    <!-- Stats -->
    <div class="stats-grid" style="grid-template-columns:repeat(4,1fr);margin-bottom:24px;">
      ${[
        ['Total Students',    s.totalStudents,      'var(--info)',    'M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5z'],
        ['Total Mentors',     s.totalMentors,        'var(--accent)',  'M20 6h-2.18c.07-.44.18-.88.18-1.3A4.68 4.68 0 0012.28.1C10.8.1 9.48.77 8.58 1.8L7 3.5 5.4 1.8C4.52.77 3.2.1 1.72.1A4.68 4.68 0 00.02 4.7c0 .42.11.86.18 1.3H-2v12c0 1.1.9 2 2 2h18c1.1 0 2-.9 2-2V6z'],
        ['Unassigned Students',s.unassignedStudents, 'var(--warning)', 'M1 21h22L12 2 1 21zm12-3h-2v-2h2v2zm0-4h-2v-4h2v4z'],
        ['Departments',       s.departments,         'var(--success)', 'M12 7V3H2v18h20V7H12zM6 19H4v-2h2v2zm0-4H4v-2h2v2zm0-4H4V9h2v2zm4 12H8v-2h2v2zm0-4H8v-2h2v2zm0-4H8V9h2v2z'],
      ].map(([label,value,color,icon]) => `
        <div class="stat-card">
          <div class="stat-icon" style="background:${color}22;">
            <svg viewBox="0 0 24 24" style="fill:${color};width:20px;height:20px;"><path d="${icon}"/></svg>
          </div>
          <div class="stat-label">${label}</div>
          <div class="stat-value">${value}</div>
        </div>
      `).join('')}
    </div>

    <div style="display:grid;grid-template-columns:1fr 1fr;gap:20px;">
      <!-- Quick Actions -->
      <div class="card" style="padding:24px;">
        <h3 style="font-size:0.95rem;font-weight:600;margin-bottom:16px;">Quick Actions</h3>
        <div style="display:flex;flex-direction:column;gap:12px;">
          <div style="display:grid;grid-template-columns:1fr auto;gap:12px;align-items:end;">
            <div class="form-group" style="margin:0;">
              <label class="form-label">Auto-Allocate by Department</label>
              <select id="auto-dept" class="form-select">
                <option value="">All Departments</option>
                <option>Computer Science</option><option>Information Technology</option><option>Electronics</option><option>Mechanical</option>
              </select>
            </div>
            <button class="btn btn-primary" id="btn-auto-alloc">Auto Allocate</button>
          </div>
          <div class="divider"></div>
          <a href="#/admin/allocation" class="btn btn-secondary">Manual Allocation →</a>
          <a href="#/admin/users"      class="btn btn-secondary">Manage Users →</a>
          <a href="#/admin/departments" class="btn btn-secondary">Manage Departments →</a>
        </div>
      </div>

      <!-- Recent Registrations -->
      <div class="card">
        <div class="card-header"><h3>Recent Registrations</h3></div>
        ${(data.recentRegistrations||[]).map(r => `
          <div class="list-item">
            <div style="display:flex;align-items:center;gap:10px;">
              <div class="avatar avatar-sm">${(r.name||'?')[0]}</div>
              <div>
                <p style="font-weight:600;font-size:0.875rem;">${r.name}</p>
                <p style="color:var(--text-muted);font-size:0.75rem;">${r.email}</p>
              </div>
            </div>
            <div style="text-align:right;">
              <span class="badge ${r.role==='STUDENT'?'badge-info':'badge-accent'}">${r.role}</span>
              <p style="color:var(--text-muted);font-size:0.72rem;margin-top:4px;">${timeAgo(r.createdAt)}</p>
            </div>
          </div>
        `).join('')}
      </div>
    </div>
  `;

  document.getElementById('btn-auto-alloc').addEventListener('click', async () => {
    const dept = document.getElementById('auto-dept').value;
    try {
      await api.post('/api/admin/auto-allocate', { department: dept || null });
      showToast('Auto-allocation complete!', 'success');
    } catch { showToast('Auto-allocation done (offline)', 'info'); }
  });
}
