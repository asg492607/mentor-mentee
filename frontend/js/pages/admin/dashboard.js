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
    const { collection, getDocs } = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js');
    const { db } = await import('/js/firebase-init.js');
    const { BookletService } = await import('/js/services.js');

    const [students, faculty, depts, issues, bookletSnap] = await Promise.all([
      StudentService.getAll(),
      FacultyService.getAll(),
      DepartmentService.getAll(),
      IssueService.getAll(),
      getDocs(collection(db, 'booklets')).catch(() => ({ docs: [] }))
    ]);

    // Deduplicate students by email in UI display
    const uniqueStudentMap = new Map();
    students.forEach(s => {
      const key = (s.email || s.enrollmentNumber || s.id).toLowerCase().trim();
      if (!uniqueStudentMap.has(key)) uniqueStudentMap.set(key, s);
    });
    const uniqueStudents = Array.from(uniqueStudentMap.values());

    // Filter faculty into roles — HODs/DEANs/ADMINs are NOT counted as mentors!
    const mentorsOnly = faculty.filter(f => {
      const r = (f.role || 'FACULTY').toUpperCase();
      return r === 'FACULTY' || r === 'MENTOR';
    });
    const hodsOnly   = faculty.filter(f => (f.role || '').toUpperCase() === 'HOD');
    const deansOnly  = faculty.filter(f => (f.role || '').toUpperCase() === 'DEAN');
    const adminsOnly = faculty.filter(f => (f.role || '').toUpperCase() === 'ADMIN');

    // Count how many students have filled at least 25% of their booklet
    let filledBookletCount = 0;
    bookletSnap.docs.forEach(d => {
      const pct = BookletService.calculateCompletion(d.data());
      if (pct >= 25) filledBookletCount++;
    });

    const unassigned = uniqueStudents.filter(s => !s.mentorId).length;

    // Deduplicate recent registrations
    const uniqueUserMap = new Map();
    [...students, ...faculty].forEach(u => {
      const key = (u.email || u.enrollmentNumber || u.employeeId || u.id).toLowerCase().trim();
      if (!uniqueUserMap.has(key)) uniqueUserMap.set(key, u);
    });

    const recent = Array.from(uniqueUserMap.values())
      .filter(u => u.createdAt)
      .sort((a,b) => new Date(b.createdAt) - new Date(a.createdAt))
      .slice(0, 6)
      .map(u => ({ ...u, role: u.cgpa !== undefined ? 'STUDENT' : (u.role || 'FACULTY') }));
    const totalAllUsers = uniqueStudents.length + faculty.length;

    const content = document.getElementById('admin-content');
    content.innerHTML = `
      <div class="dashboard-container">
        <!-- Main Key Metrics -->
        <div class="stats-grid" style="grid-template-columns:repeat(5,1fr);margin-bottom:20px;">
        ${[
          ['Total Users (All)',  totalAllUsers,         'linear-gradient(135deg,#6c47ff,#a855f7)', 'M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z'],
          ['Total Students',     uniqueStudents.length, 'var(--info)',   'M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5z'],
          ['Total Mentors',      mentorsOnly.length,    'var(--accent)', 'M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z'],
          ['Unassigned',         unassigned,            'var(--warning)','M1 21h22L12 2 1 21zm12-3h-2v-2h2v2zm0-4h-2v-4h2v4z'],
          ['Departments',        depts.length,          'var(--success)','M12 7V3H2v18h20V7H12zM6 19H4v-2h2v2zm0-4H4v-2h2v2zm0-4H4V9h2v2z'],
        ].map(([l,v,c,i]) => `
          <div class="stat-card">
            <div class="stat-icon" style="background:${c.includes('gradient') ? '#6c47ff22' : c + '22'};"><svg viewBox="0 0 24 24" style="fill:${c.includes('gradient') ? '#6c47ff' : c};width:20px;height:20px;"><path d="${i}"/></svg></div>
            <div class="stat-label">${l}</div>
            <div class="stat-value" style="${c.includes('gradient') ? 'background:linear-gradient(135deg,#6c47ff,#a855f7);-webkit-background-clip:text;-webkit-text-fill-color:transparent;' : ''}">${v}</div>
          </div>
        `).join('')}
      </div>

      <!-- User Breakdown & Booklet Completion Card -->
      <div class="card" style="padding:20px;margin-bottom:24px;background:var(--bg-secondary);border:1px solid var(--border);">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px;flex-wrap:wrap;gap:10px;">
          <div>
            <h3 style="margin:0;font-size:0.95rem;font-weight:700;display:flex;align-items:center;gap:10px;">
              👥 Platform Users &amp; Booklet Status Breakdown
              <span class="badge badge-accent" style="font-size:0.75rem;padding:4px 10px;font-weight:700;background:linear-gradient(135deg,#6c47ff,#a855f7);color:#fff;">
                Grand Total: ${totalAllUsers} Registered Users
              </span>
            </h3>
            <p style="margin:4px 0 0 0;font-size:0.78rem;color:var(--text-muted);">
              Counts of active accounts by role and student booklet filing status. HODs/Deans are excluded from Mentor count.
            </p>
          </div>
          <a href="#/admin/users" class="btn btn-xs btn-secondary">Manage All Users →</a>
        </div>
        <div style="display:grid;grid-template-columns:repeat(5,1fr);gap:12px;">
          <div style="background:var(--bg-primary);padding:12px;border-radius:10px;border:1px solid var(--border);">
            <div style="font-size:0.72rem;color:var(--text-muted);font-weight:700;text-transform:uppercase;">Students</div>
            <div style="font-size:1.3rem;font-weight:800;color:var(--info);margin-top:2px;">${uniqueStudents.length}</div>
            <div style="font-size:0.72rem;color:var(--success);margin-top:4px;font-weight:600;">
              📑 ${filledBookletCount} filled (≥25%)
            </div>
          </div>
          <div style="background:var(--bg-primary);padding:12px;border-radius:10px;border:1px solid var(--border);">
            <div style="font-size:0.72rem;color:var(--text-muted);font-weight:700;text-transform:uppercase;">Mentors / Faculty</div>
            <div style="font-size:1.3rem;font-weight:800;color:var(--accent);margin-top:2px;">${mentorsOnly.length}</div>
            <div style="font-size:0.72rem;color:var(--text-muted);margin-top:4px;">Teaching Faculty</div>
          </div>
          <div style="background:var(--bg-primary);padding:12px;border-radius:10px;border:1px solid var(--border);">
            <div style="font-size:0.72rem;color:var(--text-muted);font-weight:700;text-transform:uppercase;">HODs</div>
            <div style="font-size:1.3rem;font-weight:800;color:var(--warning);margin-top:2px;">${hodsOnly.length}</div>
            <div style="font-size:0.72rem;color:var(--text-muted);margin-top:4px;">Dept Heads</div>
          </div>
          <div style="background:var(--bg-primary);padding:12px;border-radius:10px;border:1px solid var(--border);">
            <div style="font-size:0.72rem;color:var(--text-muted);font-weight:700;text-transform:uppercase;">Deans</div>
            <div style="font-size:1.3rem;font-weight:800;color:var(--danger);margin-top:2px;">${deansOnly.length}</div>
            <div style="font-size:0.72rem;color:var(--text-muted);margin-top:4px;">Academic Deans</div>
          </div>
          <div style="background:var(--bg-primary);padding:12px;border-radius:10px;border:1px solid var(--border);">
            <div style="font-size:0.72rem;color:var(--text-muted);font-weight:700;text-transform:uppercase;">Admins</div>
            <div style="font-size:1.3rem;font-weight:800;color:var(--success);margin-top:2px;">${adminsOnly.length}</div>
            <div style="font-size:0.72rem;color:var(--text-muted);margin-top:4px;">System Admin</div>
          </div>
        </div>
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
            <a href="#/admin/users?assign=true" class="btn btn-accent" style="background:linear-gradient(135deg,#6c47ff,#a855f7);color:#fff;border:none;font-weight:600;">🔗 Assign Mentors via Sheet (Excel/CSV) →</a>
            <button id="btn-dash-open-multi-class-mentors" class="btn btn-secondary" style="text-align:left;display:flex;align-items:center;gap:8px;background:rgba(108,71,255,0.08);border-color:var(--accent);color:var(--accent);font-weight:600;"><i class="ph ph-users-three" style="font-size:1.1rem;color:var(--accent);"></i> 👥 Multi-Class Mentors Directory &amp; Report →</button>
            <a href="#/admin/allocation"  class="btn btn-secondary">Manual Allocation →</a>
            <a href="#/admin/users"       class="btn btn-secondary">Manage Users →</a>
            <a href="#/admin/departments" class="btn btn-secondary">Manage Departments →</a>
            <button id="btn-clean-duplicates-dash" class="btn btn-secondary" style="text-align:left;display:flex;align-items:center;gap:8px;color:var(--warning);border-color:var(--warning)88;">🧹 Clean Duplicate Database Records</button>
            <a href="#/admin/settings" class="btn btn-secondary" style="text-align:left;display:flex;align-items:center;gap:8px;color:#ef4444;border-color:rgba(239,68,68,0.4);">🐞 Manage Web Issues &amp; Bug Reports (Admin Only) →</a>
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

      <!-- ===== Reports & Downloads Section ===== -->
      <div class="card" style="margin-top:24px;padding:0;overflow:hidden;border:1px solid var(--border);">
        <div style="display:flex;justify-content:space-between;align-items:center;padding:18px 24px;border-bottom:1px solid var(--border);background:linear-gradient(135deg,rgba(108,71,255,0.08),rgba(168,85,247,0.05));">
          <div>
            <h3 style="margin:0;font-size:1rem;font-weight:700;display:flex;align-items:center;gap:10px;">
              📊 Reports &amp; Downloads
              <span class="badge badge-accent" style="font-size:0.7rem;padding:3px 8px;background:linear-gradient(135deg,#6c47ff,#a855f7);color:#fff;">Export Center</span>
            </h3>
            <p style="margin:4px 0 0;font-size:0.78rem;color:var(--text-muted);">Generate and download official reports in PDF or Excel format</p>
          </div>
        </div>

        <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:0;border-bottom:1px solid var(--border);">

          <!-- Mentor-Student Allocation Report -->
          <div style="padding:20px 24px;border-right:1px solid var(--border);">
            <div style="display:flex;align-items:center;gap:10px;margin-bottom:8px;">
              <div style="width:36px;height:36px;border-radius:10px;background:rgba(16,185,129,0.15);display:flex;align-items:center;justify-content:center;">
                <svg viewBox="0 0 24 24" style="width:18px;height:18px;fill:#10b981;"><path d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z"/></svg>
              </div>
              <div>
                <div style="font-size:0.875rem;font-weight:700;">Mentor-Student Allocation</div>
                <div style="font-size:0.72rem;color:var(--text-muted);">Full classwise allocation list</div>
              </div>
            </div>
            <div style="display:flex;gap:8px;margin-top:12px;">
              <button id="btn-rpt-alloc-excel" class="btn btn-sm btn-secondary" style="flex:1;display:flex;align-items:center;justify-content:center;gap:6px;font-size:0.78rem;">
                <i class="ph ph-file-xls" style="color:#10b981;font-size:1rem;"></i> Excel
              </button>
              <button id="btn-rpt-alloc-pdf" class="btn btn-sm btn-secondary" style="flex:1;display:flex;align-items:center;justify-content:center;gap:6px;font-size:0.78rem;">
                <i class="ph ph-file-pdf" style="color:#ef4444;font-size:1rem;"></i> PDF
              </button>
            </div>
          </div>

          <!-- Student Booklet Report -->
          <div style="padding:20px 24px;border-right:1px solid var(--border);">
            <div style="display:flex;align-items:center;gap:10px;margin-bottom:8px;">
              <div style="width:36px;height:36px;border-radius:10px;background:rgba(59,130,246,0.15);display:flex;align-items:center;justify-content:center;">
                <svg viewBox="0 0 24 24" style="width:18px;height:18px;fill:#3b82f6;"><path d="M18 2H6c-1.1 0-2 .9-2 2v16c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zM6 4h5v8l-2.5-1.5L6 12V4z"/></svg>
              </div>
              <div>
                <div style="font-size:0.875rem;font-weight:700;">Student Booklet Report</div>
                <div style="font-size:0.72rem;color:var(--text-muted);">Booklet completion &amp; academic data</div>
              </div>
            </div>
            <div style="display:flex;gap:8px;margin-top:12px;">
              <button id="btn-rpt-booklet-excel" class="btn btn-sm btn-secondary" style="flex:1;display:flex;align-items:center;justify-content:center;gap:6px;font-size:0.78rem;">
                <i class="ph ph-file-xls" style="color:#10b981;font-size:1rem;"></i> Excel
              </button>
              <button id="btn-rpt-booklet-pdf" class="btn btn-sm btn-secondary" style="flex:1;display:flex;align-items:center;justify-content:center;gap:6px;font-size:0.78rem;">
                <i class="ph ph-file-pdf" style="color:#ef4444;font-size:1rem;"></i> PDF
              </button>
            </div>
          </div>

          <!-- CSV Template Download -->
          <div style="padding:20px 24px;">
            <div style="display:flex;align-items:center;gap:10px;margin-bottom:8px;">
              <div style="width:36px;height:36px;border-radius:10px;background:rgba(245,158,11,0.15);display:flex;align-items:center;justify-content:center;">
                <svg viewBox="0 0 24 24" style="width:18px;height:18px;fill:#f59e0b;"><path d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z"/></svg>
              </div>
              <div>
                <div style="font-size:0.875rem;font-weight:700;">CSV Templates</div>
                <div style="font-size:0.72rem;color:var(--text-muted);">Bulk registration import templates</div>
              </div>
            </div>
            <div style="display:flex;gap:8px;margin-top:12px;flex-direction:column;">
              <button id="btn-rpt-csv-students" class="btn btn-sm btn-secondary" style="display:flex;align-items:center;justify-content:center;gap:6px;font-size:0.78rem;">
                ⬇️ Student Registration CSV
              </button>
              <button id="btn-rpt-csv-faculty" class="btn btn-sm btn-secondary" style="display:flex;align-items:center;justify-content:center;gap:6px;font-size:0.78rem;">
                ⬇️ Faculty Registration CSV
              </button>
            </div>
          </div>
        </div>

        <!-- Download Status Bar -->
        <div style="padding:12px 24px;background:rgba(0,0,0,0.04);display:flex;align-items:center;gap:12px;flex-wrap:wrap;">
          <span style="font-size:0.75rem;color:var(--text-muted);">💡 Tip: Excel reports include multiple sheets — allocation list, per-mentor breakdowns, and summary statistics.</span>
          <button id="btn-export-dash-excel" class="btn btn-xs btn-secondary" style="margin-left:auto;display:flex;align-items:center;gap:6px;">
            <i class="ph ph-file-xls" style="font-size:1rem;color:var(--success);"></i> Quick Export Excel
          </button>
          <button id="btn-export-dash-pdf" class="btn btn-xs btn-secondary" style="display:flex;align-items:center;gap:6px;">
            <i class="ph ph-file-pdf" style="font-size:1rem;color:var(--danger);"></i> Quick Export PDF
          </button>
        </div>
      </div>
    `;


    document.getElementById('btn-dash-open-multi-class-mentors')?.addEventListener('click', async () => {
      const { openMultiClassMentorsModal } = await import('/js/components/multi-class-mentors-modal.js');
      await openMultiClassMentorsModal();
    });

    document.getElementById('btn-clean-duplicates-dash')?.addEventListener('click', () => {
      window.location.hash = '#/admin/settings';
      setTimeout(() => {
        const scanBtn = document.getElementById('btn-scan-duplicates');
        if (scanBtn) scanBtn.click();
      }, 300);
    });

    document.getElementById('btn-auto-alloc').addEventListener('click', async () => {
      const dept = document.getElementById('auto-dept').value || null;
      if (!confirm(`Are you sure you want to auto-allocate unassigned students${dept ? ` in the ${dept} department` : ''}? This action cannot be easily undone.`)) return;
      const btn = document.getElementById('btn-auto-alloc');
      btn.disabled = true; btn.textContent = 'Allocating...';
      try {
        const results = await AllocationService.autoAllocate(dept);
        showToast(`Auto-allocated ${results.length} student(s)!`, 'success');
      } catch (err) { showToast('Error: ' + err.message, 'error'); }
      finally { btn.disabled = false; btn.textContent = 'Auto Allocate'; }
    });

    document.getElementById('btn-export-dash-excel')?.addEventListener('click', async () => {
      const { exportMentorStudentReport } = await import('/js/report-export.js');
      await exportMentorStudentReport('excel');
    });

    document.getElementById('btn-export-dash-pdf')?.addEventListener('click', async () => {
      const { exportMentorStudentReport } = await import('/js/report-export.js');
      await exportMentorStudentReport('pdf');
    });

    document.getElementById('btn-dash-download-template').addEventListener('click', () => {
      const csvContent = "role,name,email,password,department,class,enrollmentNumber\nSTUDENT,John Doe,john@example.com,pass123,Computer Science,A,EN1001\nFACULTY,Dr. Smith,smith@example.com,pass123,Computer Science,,EMP001\n";
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

    // ===== New Reports & Downloads Section Listeners =====

    // Allocation Report: Excel
    document.getElementById('btn-rpt-alloc-excel')?.addEventListener('click', async () => {
      const { exportMentorStudentReport } = await import('/js/report-export.js');
      await exportMentorStudentReport('excel');
    });

    // Allocation Report: PDF
    document.getElementById('btn-rpt-alloc-pdf')?.addEventListener('click', async () => {
      const { exportMentorStudentReport } = await import('/js/report-export.js');
      await exportMentorStudentReport('pdf');
    });

    // Booklet Report: Excel
    document.getElementById('btn-rpt-booklet-excel')?.addEventListener('click', async () => {
      showToast('Preparing booklet report (Excel)...', 'info');
      try {
        const { exportMentorStudentReport } = await import('/js/report-export.js');
        await exportMentorStudentReport('excel');
      } catch (e) { showToast('Failed: ' + e.message, 'error'); }
    });

    // Booklet Report: PDF
    document.getElementById('btn-rpt-booklet-pdf')?.addEventListener('click', async () => {
      showToast('Preparing booklet report (PDF)...', 'info');
      try {
        const { exportMentorStudentReport } = await import('/js/report-export.js');
        await exportMentorStudentReport('pdf');
      } catch (e) { showToast('Failed: ' + e.message, 'error'); }
    });

    // Student CSV template download
    document.getElementById('btn-rpt-csv-students')?.addEventListener('click', () => {
      const csv = "role,name,email,password,department,class,enrollmentNumber\n" +
        "STUDENT,John Doe,john.doe@university.edu,pass123,Computer Science,TY-A,EN2024001\n" +
        "STUDENT,Jane Smith,jane.smith@university.edu,pass123,Computer Science,TY-B,EN2024002\n";
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = 'Student_Registration_Template.csv';
      a.click();
      showToast('Student CSV template downloaded!', 'success');
    });

    // Faculty CSV template download
    document.getElementById('btn-rpt-csv-faculty')?.addEventListener('click', () => {
      const csv = "role,name,email,password,department,employeeId,designation\n" +
        "FACULTY,Dr. A. Sharma,a.sharma@university.edu,pass123,Computer Science,EMP001,Associate Professor\n" +
        "HOD,Dr. B. Patel,b.patel@university.edu,pass123,Computer Science,EMP002,Head of Department\n";
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = 'Faculty_Registration_Template.csv';
      a.click();
      showToast('Faculty CSV template downloaded!', 'success');
    });

  } catch (err) {
    (container.querySelector('#admin-content') || {}).innerHTML = `<div class="empty-state"><h3 style="color:var(--danger);">Error: ${err.message}</h3></div>`;
  }
}

