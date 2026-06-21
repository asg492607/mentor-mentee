import { getUserProfile } from '/js/auth.js';
import { createSidebar } from '/js/components/sidebar.js';
import { createHeader } from '/js/components/header.js';
import { showToast } from '/js/components/toast.js';
import { StudentService, FacultyService, DepartmentService, AllocationService, IssueService } from '/js/services.js';

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
        <div class="page-content" id="admin-content">
          <div style="display:flex;justify-content:center;padding:60px;"><div class="spinner"></div></div>
        </div>
      </div>
    </div>
  `;

  try {
    const [students, faculty, depts, issues] = await Promise.all([
      StudentService.getAll(),
      FacultyService.getAll(),
      DepartmentService.getAll(),
      IssueService.getAll()
    ]);

    const unassigned = students.filter(s => !s.mentorId).length;
    const recent = [...students, ...faculty]
      .filter(u => u.createdAt)
      .sort((a,b) => new Date(b.createdAt) - new Date(a.createdAt))
      .slice(0, 6)
      .map(u => ({ ...u, role: u.cgpa !== undefined ? 'STUDENT' : 'FACULTY' }));

    const content = document.getElementById('admin-content');
    content.innerHTML = `
      <div class="stats-grid" style="grid-template-columns:repeat(4,1fr);margin-bottom:24px;">
        ${[
          ['Total Students',     students.length, 'var(--info)',   'M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5z'],
          ['Total Mentors',      faculty.length,  'var(--accent)', 'M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z'],
          ['Unassigned',         unassigned,      'var(--warning)','M1 21h22L12 2 1 21zm12-3h-2v-2h2v2zm0-4h-2v-4h2v4z'],
          ['Departments',        depts.length,    'var(--success)','M12 7V3H2v18h20V7H12zM6 19H4v-2h2v2zm0-4H4v-2h2v2zm0-4H4V9h2v2z'],
        ].map(([l,v,c,i]) => `
          <div class="stat-card">
            <div class="stat-icon" style="background:${c}22;"><svg viewBox="0 0 24 24" style="fill:${c};width:20px;height:20px;"><path d="${i}"/></svg></div>
            <div class="stat-label">${l}</div>
            <div class="stat-value">${v}</div>
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
                  ${depts.map(d => `<option value="${d.name}">${d.name}</option>`).join('')}
                </select>
              </div>
              <button class="btn btn-primary" id="btn-auto-alloc">Auto Allocate</button>
            </div>
            <div class="divider"></div>
            <a href="#/admin/allocation"  class="btn btn-secondary">Manual Allocation →</a>
            <a href="#/admin/users"       class="btn btn-secondary">Manage Users →</a>
            <a href="#/admin/departments" class="btn btn-secondary">Manage Departments →</a>
            <button id="btn-dash-download-template" class="btn btn-secondary" style="text-align:left;display:flex;justify-content:flex-start;align-items:center;">⬇️ Download CSV Registration Template</button>
          </div>
        </div>

        <!-- Recent Registrations -->
        <div class="card">
          <div class="card-header"><h3>Recent Registrations</h3></div>
          ${recent.length === 0
            ? '<p style="padding:20px;color:var(--text-muted);">No registrations yet.</p>'
            : recent.map(u => `
              <div class="list-item">
                <div style="display:flex;align-items:center;gap:10px;">
                  <div class="avatar avatar-sm">${(u.name||'?')[0]}</div>
                  <div>
                    <p style="font-weight:600;font-size:0.875rem;">${u.name||'—'}</p>
                    <p style="color:var(--text-muted);font-size:0.75rem;">${u.email||''}</p>
                  </div>
                </div>
                <div style="text-align:right;">
                  <span class="badge ${u.role==='STUDENT'?'badge-info':'badge-accent'}">${u.role}</span>
                  <p style="color:var(--text-muted);font-size:0.72rem;margin-top:4px;">${u.createdAt ? timeAgo(u.createdAt) : '—'}</p>
                </div>
              </div>
            `).join('')
          }
        </div>
      </div>
    `;

    document.getElementById('btn-auto-alloc').addEventListener('click', async () => {
      const dept = document.getElementById('auto-dept').value || null;
      const btn = document.getElementById('btn-auto-alloc');
      btn.disabled = true; btn.textContent = 'Allocating...';
      try {
        const results = await AllocationService.autoAllocate(dept);
        showToast(`Auto-allocated ${results.length} student(s)!`, 'success');
      } catch (err) { showToast('Error: ' + err.message, 'error'); }
      finally { btn.disabled = false; btn.textContent = 'Auto Allocate'; }
    });

    document.getElementById('btn-dash-download-template').addEventListener('click', () => {
      const csvContent = "role,name,email,password,department,class,year,enrollmentNumber\nSTUDENT,John Doe,john@example.com,pass123,Computer Science,A,2,EN1001\nFACULTY,Dr. Smith,smith@example.com,pass123,Computer Science,,,EMP001\n";
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement("a");
      const url = URL.createObjectURL(blob);
      link.setAttribute("href", url);
      link.setAttribute("download", "User_Registration_Template.csv");
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    });

  } catch (err) {
    (container.querySelector('#admin-content') || {}).innerHTML = `<div class="empty-state"><h3 style="color:var(--danger);">Error: ${err.message}</h3></div>`;
  }
}

