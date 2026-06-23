import { getUserProfile } from '/js/auth.js';
import { createSidebar } from '/js/components/sidebar.js';
import { createHeader } from '/js/components/header.js';
import { StudentService, FacultyService, AdminService } from '/js/services.js';
import { showToast } from '/js/components/toast.js';

function roleBadge(r) {
  const cls = {STUDENT:'badge-info',FACULTY:'badge-accent',HOD:'badge-warning',DEAN:'badge-danger',ADMIN:'badge-muted'}[r]||'badge-muted';
  return `<span class="badge ${cls}">${r}</span>`;
}

export async function render(container) {
  const user = getUserProfile();

  container.innerHTML = `
    <div class="dashboard-layout fade-in">
      ${createSidebar(user.role, window.location.hash.slice(1).split('?')[0] || '/admin/users')}
      <div class="main-content">
        ${createHeader('Institution Directory', user)}
        <div class="page-content">
          <div style="display:flex;gap:12px;margin-bottom:20px;flex-wrap:wrap;justify-content:space-between;align-items:center;">
            <div style="display:flex;gap:12px;flex:1;min-width:300px;flex-wrap:wrap;">
              <div class="search-box" style="flex:1;min-width:200px;">
                <svg width="16" height="16" viewBox="0 0 24 24"><path d="M15.5 14h-.79l-.28-.27C15.41 12.59 16 11.11 16 9.5 16 5.91 13.09 3 9.5 3S3 5.91 3 9.5 5.91 16 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z"/></svg>
                <input type="text" id="user-search" placeholder="Search by name or email...">
              </div>
              ${['ALL','STUDENT','FACULTY','HOD','DEAN','SECTION_HEAD','ADMIN'].map((r,i) =>
                `<button class="btn btn-sm ${i===0?'btn-primary':'btn-secondary'} role-f" data-r="${r}">${r}</button>`
              ).join('')}
            </div>
            <div style="display:flex;gap:8px;">
              ${user.role === 'ADMIN' ? `
              <button class="btn btn-secondary btn-sm" id="btn-download-template" title="Download CSV Template">⬇️ Template</button>
              <label class="btn btn-secondary btn-sm" style="cursor:pointer;margin:0;">
                📁 Bulk Import (CSV)
                <input type="file" id="csv-upload" accept=".csv" style="display:none;">
              </label>
              <button class="btn btn-primary btn-sm" id="btn-add-user">+ Add User</button>
              ` : ''}
            </div>
          </div>
          <div class="card" id="users-wrap">
            <div style="display:flex;justify-content:center;padding:60px;"><div class="spinner"></div></div>
          </div>
        </div>
      </div>
    </div>
  `;

  let allUsers = [];
  let search   = '';
  let roleFilter = 'ALL';

  try {
    const [students, faculty] = await Promise.all([
      StudentService.getAll(),
      FacultyService.getAll()
    ]);
    allUsers = [
      ...students.map(s => ({ ...s, role: s.role || 'STUDENT' })),
      ...faculty.map(f  => ({ ...f, role: f.role || 'FACULTY' }))
    ];
  } catch (err) {
    (container.querySelector('#users-wrap') || {}).innerHTML = `<div class="empty-state"><h3 style="color:var(--danger);">Error: ${err.message}</h3></div>`;
    return;
  }

  function renderTable() {
    const wrap = document.getElementById('users-wrap');
    let list = allUsers;
    if (roleFilter !== 'ALL') list = list.filter(u => (u.role||'').toUpperCase() === roleFilter);
    if (search) list = list.filter(u => u.name?.toLowerCase().includes(search) || u.email?.toLowerCase().includes(search));

    if (!list.length) {
      wrap.innerHTML = `<div class="empty-state" style="padding:48px;"><h3>No users found</h3></div>`;
      return;
    }

    wrap.innerHTML = `
      <table class="data-table">
        <thead><tr><th>User</th><th>Email</th><th>Role</th><th>Department</th><th>Status</th><th>Actions</th></tr></thead>
        <tbody>
          ${list.map(u => `
            <tr>
              <td>
                <div style="display:flex;align-items:center;gap:10px;">
                  <div class="avatar avatar-sm">${(u.name||'?')[0]}</div>
                  <div>
                    <p style="font-weight:600;font-size:0.875rem;">${u.name||'—'}</p>
                    ${u.enrollmentNumber ? `<p style="color:var(--text-muted);font-size:0.75rem;">${u.enrollmentNumber}</p>` : ''}
                  </div>
                </div>
              </td>
              <td style="color:var(--text-secondary);font-size:0.825rem;">${u.email||'—'}</td>
              <td>${roleBadge((u.role||'STUDENT').toUpperCase())}</td>
              <td style="font-size:0.825rem;">${u.department||'—'}</td>
              <td>
                <span class="badge ${u.isApproved?'badge-success':'badge-warning'}">
                  ${u.isApproved?'Approved':'Pending'}
                </span>
              </td>
              <td>
                <button class="btn btn-xs btn-secondary btn-view-profile" data-id="${u.id}">View</button>
                ${(u.role||'').toUpperCase() === 'STUDENT' ? `<a href="#/mentor/booklet?studentId=${u.id}" class="btn btn-xs btn-primary" style="margin-left:4px;">Booklet</a>` : ''}
                ${!u.isApproved ? `<button class="btn btn-xs btn-primary btn-approve" style="margin-left:4px;" data-id="${u.id}" data-role="${u.role}">Approve</button>` : ''}
              </td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    `;

    document.querySelectorAll('.btn-approve').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const id = e.target.dataset.id;
        const role = e.target.dataset.role;
        btn.disabled = true;
        btn.textContent = '...';
        try {
          if (role === 'STUDENT') await StudentService.approve(id);
          else await FacultyService.approve(id);
          showToast('User approved successfully!', 'success');
          // Update local state and re-render
          const user = allUsers.find(u => u.id === id);
          if (user) { user.isApproved = true; user.status = 'approved'; }
          renderTable();
        } catch (err) {
          showToast('Failed to approve user: ' + err.message, 'error');
          btn.disabled = false;
          btn.textContent = 'Approve';
        }
      });
    });

    document.querySelectorAll('.btn-view-profile').forEach(btn => {
      btn.addEventListener('click', (e) => {
         if (window.openUserProfile) window.openUserProfile(e.target.dataset.id);
      });
    });
  }

  document.getElementById('user-search').addEventListener('input', e => { search = e.target.value.toLowerCase(); renderTable(); });
  document.querySelectorAll('.role-f').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.role-f').forEach(b => b.className = 'btn btn-sm btn-secondary role-f');
      btn.className = 'btn btn-sm btn-primary role-f';
      roleFilter = btn.dataset.r; renderTable();
    });
  });

  renderTable();

  // Modal logic
  const modalHtml = `
    <div id="add-user-modal" class="modal-backdrop" style="display:none;z-index:9999;">
      <div class="modal">
        <div class="modal-header">
          <h3>Register New User</h3>
          <button class="btn btn-ghost btn-sm" id="close-user-modal">✕</button>
        </div>
        <div class="modal-body">
          <form id="admin-add-user-form">
            <div class="grid" style="grid-template-columns: 1fr 1fr; gap: 16px;">
              <div class="form-group" style="grid-column: 1 / -1;">
                <label class="form-label">Role</label>
                <select id="new-user-role" class="form-select" required>
                  <option value="STUDENT">Student</option>
                  <option value="FACULTY">Faculty</option>
                  <option value="HOD">HOD</option>
                  <option value="DEAN">Dean</option>
                  <option value="SECTION_HEAD">Section Head</option>
                  <option value="ADMIN">Admin</option>
                </select>
              </div>
              <div class="form-group" style="grid-column: 1 / -1;">
                <label class="form-label">Full Name</label>
                <input type="text" id="new-user-name" class="form-input" required>
              </div>
              <div class="form-group">
                <label class="form-label">Email</label>
                <input type="email" id="new-user-email" class="form-input" required>
              </div>
              <div class="form-group">
                <label class="form-label">Password</label>
                <input type="password" id="new-user-password" class="form-input" required minlength="6">
              </div>
            </div>
            <div id="dynamic-fields-container" style="margin-top:16px;">
              <div class="form-group" id="admin-dept-group">
                <label class="form-label" id="admin-dept-label">Department</label>
                <select id="new-user-dept" class="form-select dynamic-dept">
                  <option value="">Loading...</option>
                </select>
              </div>
              <div id="admin-student-fields" style="display:none; grid-template-columns: 1fr 1fr; gap: 16px;">
                <div class="form-group">
                  <label class="form-label">Class</label>
                  <select id="new-user-class" class="form-select" disabled>
                    <option value="">Select Department First</option>
                  </select>
                </div>
                <div class="form-group">
                  <label class="form-label">Year</label>
                  <select id="new-user-year" class="form-select">
                    <option value="">Select Year</option>
                    <option value="1">First Year</option>
                    <option value="2">Second Year</option>
                    <option value="3">Third Year</option>
                    <option value="4">Fourth Year</option>
                  </select>
                </div>
              </div>
            </div>
            <div class="modal-footer mt-4" style="border:none;padding:0;margin-top:24px;justify-content:flex-end;">
              <button type="button" class="btn btn-secondary" id="cancel-user-modal">Cancel</button>
              <button type="submit" class="btn btn-primary" id="submit-new-user">Create User</button>
            </div>
          </form>
        </div>
      </div>
    </div>
  `;
  container.insertAdjacentHTML('beforeend', modalHtml);

  const viewProfileHtml = `
    <div id="view-profile-modal" class="modal-backdrop" style="display:none;z-index:9999;">
      <div class="modal" style="max-width:500px;">
        <div class="modal-header">
          <h3>User Profile</h3>
          <button class="btn btn-ghost btn-sm" id="close-view-profile-modal">✕</button>
        </div>
        <div class="modal-body" id="view-profile-body" style="max-height:60vh;overflow-y:auto;line-height:1.6;">
          Loading...
        </div>
      </div>
    </div>
  `;
  container.insertAdjacentHTML('beforeend', viewProfileHtml);

  const modal = document.getElementById('add-user-modal');
  if (document.getElementById('btn-add-user')) {
      document.getElementById('btn-add-user').addEventListener('click', () => modal.style.display = 'flex');
  }
  document.getElementById('close-user-modal').addEventListener('click', () => modal.style.display = 'none');
  document.getElementById('cancel-user-modal').addEventListener('click', () => modal.style.display = 'none');

  const viewModal = document.getElementById('view-profile-modal');
  document.getElementById('close-view-profile-modal').addEventListener('click', () => viewModal.style.display = 'none');
  
  window.openUserProfile = (userId) => {
     const u = allUsers.find(x => x.id === userId);
     if (!u) return;
     document.getElementById('view-profile-body').innerHTML = `
        <div style="display:flex;align-items:center;gap:16px;margin-bottom:20px;">
          <div class="avatar avatar-lg">${(u.name||'?')[0]}</div>
          <div>
            <h2 style="font-size:1.25rem;margin:0;">${u.name||'Unknown'}</h2>
            <p style="color:var(--text-muted);font-size:0.875rem;">${u.email||'—'}</p>
          </div>
        </div>
        
        <div class="grid" style="grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom:16px;">
          <div style="background:var(--bg-secondary);padding:12px;border-radius:8px;">
            <p style="font-size:0.75rem;color:var(--text-muted);margin:0;">Role</p>
            <p style="font-weight:600;margin:0;">${u.role||'—'}</p>
          </div>
          <div style="background:var(--bg-secondary);padding:12px;border-radius:8px;">
            <p style="font-size:0.75rem;color:var(--text-muted);margin:0;">Department</p>
            <p style="font-weight:600;margin:0;">${u.department||'—'}</p>
          </div>
          ${u.role === 'STUDENT' ? `
          <div style="background:var(--bg-secondary);padding:12px;border-radius:8px;">
            <p style="font-size:0.75rem;color:var(--text-muted);margin:0;">Enrollment / Year / Class</p>
            <p style="font-weight:600;margin:0;">${u.enrollmentNumber||'—'} / Y${u.year||'?'} / ${u.class||'?'}</p>
          </div>
          <div style="background:var(--bg-secondary);padding:12px;border-radius:8px;">
            <p style="font-size:0.75rem;color:var(--text-muted);margin:0;">CGPA / Attendance</p>
            <p style="font-weight:600;margin:0;">${u.cgpa||'—'} / ${u.attendance||0}%</p>
          </div>
          <div style="background:var(--bg-secondary);padding:12px;border-radius:8px;grid-column:1/-1;">
            <p style="font-size:0.75rem;color:var(--text-muted);margin:0;">Career Goal</p>
            <p style="font-weight:600;margin:0;">${u.careerGoal||'Not specified'}</p>
          </div>
          <div style="background:var(--bg-secondary);padding:12px;border-radius:8px;grid-column:1/-1;">
            <p style="font-size:0.75rem;color:var(--text-muted);margin:0;">Interests</p>
            <div style="display:flex;gap:4px;flex-wrap:wrap;margin-top:4px;">
              ${(u.interests||[]).length ? u.interests.map(i=>`<span class="badge badge-info">${i}</span>`).join('') : '<span class="text-muted">None</span>'}
            </div>
          </div>
          <div style="background:var(--bg-secondary);padding:12px;border-radius:8px;grid-column:1/-1;">
            <p style="font-size:0.75rem;color:var(--text-muted);margin:0;">Skills</p>
            <div style="display:flex;gap:4px;flex-wrap:wrap;margin-top:4px;">
              ${(u.skills||[]).length ? u.skills.map(s=>`<span class="badge badge-accent">${s}</span>`).join('') : '<span class="text-muted">None</span>'}
            </div>
          </div>
          ` : `
          <div style="background:var(--bg-secondary);padding:12px;border-radius:8px;grid-column:1/-1;">
            <p style="font-size:0.75rem;color:var(--text-muted);margin:0;">Designation</p>
            <p style="font-weight:600;margin:0;">${u.designation||'Not specified'}</p>
          </div>
          `}
        </div>
     `;
     viewModal.style.display = 'flex';
  };

  const roleSel = document.getElementById('new-user-role');
  const deptGroup = document.getElementById('admin-dept-group');
  const deptLabel = document.getElementById('admin-dept-label');
  const deptSel = document.getElementById('new-user-dept');
  const stuFields = document.getElementById('admin-student-fields');
  const classSel = document.getElementById('new-user-class');
  let allDepts = [];
  let allSections = [];

  import('/js/services.js').then(async ({ DepartmentService, ClassService, SettingsService }) => {
    try {
      [allDepts, allSections] = await Promise.all([
        DepartmentService.getAll(),
        SettingsService.getSections()
      ]);
      populateAdminDepts('Academic');
      
      deptSel.addEventListener('change', async (e) => {
        if (roleSel.value !== 'STUDENT') return;
        const dept = e.target.value;
        classSel.innerHTML = '<option value="">Select Class</option>';
        if (!dept) { classSel.disabled = true; return; }
        classSel.disabled = true; classSel.innerHTML = '<option value="">Loading...</option>';
        const classes = await ClassService.getByDepartment(dept);
        if (!classes.length) { classSel.innerHTML = '<option value="">No classes found</option>'; }
        else {
          classSel.disabled = false;
          classSel.innerHTML = '<option value="">Select Class</option>' + classes.map(c => `<option value="${c.className}">Class ${c.className}</option>`).join('');
        }
      });
    } catch(e) { console.error(e); }
  });

  function populateAdminDepts(typeStr) {
    const isSec = typeStr === 'Section';
    if (isSec) {
      deptSel.innerHTML = '<option value="">Select Section</option>' + 
        allSections.map(s => `<option value="${s}">${s}</option>`).join('');
    } else {
      deptSel.innerHTML = '<option value="">Select Department</option>' +
        allDepts.map(d => `<option value="${d.name}">${d.name}</option>`).join('');
    }
  }

  roleSel.addEventListener('change', (e) => {
    const val = e.target.value;
    if (val === 'DEAN' || val === 'ADMIN') {
      deptGroup.style.display = 'none';
      stuFields.style.display = 'none';
      deptSel.required = false;
    } else {
      deptGroup.style.display = 'block';
      deptSel.required = true;
      if (val === 'STUDENT') {
        stuFields.style.display = 'grid';
        deptLabel.textContent = 'Department';
        populateAdminDepts('Academic');
      } else {
        stuFields.style.display = 'none';
        if (val === 'SECTION_HEAD') {
          deptLabel.textContent = 'Section';
          populateAdminDepts('Section');
        } else {
          deptLabel.textContent = 'Department';
          populateAdminDepts('Academic');
        }
      }
    }
  });

  document.getElementById('admin-add-user-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = document.getElementById('submit-new-user');
    btn.disabled = true; btn.textContent = 'Creating...';
    try {
      const role = document.getElementById('new-user-role').value;
      const data = {
        role,
        name: document.getElementById('new-user-name').value,
        email: document.getElementById('new-user-email').value,
        password: document.getElementById('new-user-password').value,
        department: (role === 'DEAN' || role === 'ADMIN') ? null : document.getElementById('new-user-dept').value || null
      };
      if (role === 'STUDENT') {
        data.class = document.getElementById('new-user-class').value || null;
        data.year = parseInt(document.getElementById('new-user-year').value) || null;
      }
      
      // Need to modify AdminService.createUser to accept class and year in services.js, wait I'll pass it in data and modify services later
      const { AdminService } = await import('/js/services.js');
      const newUser = await AdminService.createUser(data);
      showToast('User created successfully!', 'success');
      modal.style.display = 'none';
      e.target.reset();
      
      allUsers.unshift({ ...newUser, isApproved: true, status: 'approved' });
      renderTable();
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      btn.disabled = false; btn.textContent = 'Create User';
    }
  });

  // --- Bulk CSV Upload Logic ---

  if (document.getElementById('btn-download-template')) {
    document.getElementById('btn-download-template').addEventListener('click', () => {
    const csvContent = "role,name,email,password,department,class,year,enrollmentNumber\nSTUDENT,John Doe,john@example.com,pass123,Computer Science,A,2,EN1001\nFACULTY,Dr. Smith,smith@example.com,pass123,Computer Science,,,EMP001\n";
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
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
  }

  if (document.getElementById('csv-upload')) {
    document.getElementById('csv-upload').addEventListener('change', async (e) => {
      const file = e.target.files[0];
      if (!file) return;

      if (!confirm(`Are you sure you want to bulk import users from ${file.name}?`)) {
        e.target.value = '';
        return;
      }

      const reader = new FileReader();
      reader.onload = async (event) => {
        const text = event.target.result;
        const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);
        if (lines.length <= 1) {
          showToast('CSV is empty or only contains headers', 'warning');
          return;
        }

        // headers: role, name, email, password, department, class, year, enrollmentNumber
        const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
        
        const expected = ['role', 'name', 'email', 'password'];
        for (const req of expected) {
          if (!headers.includes(req)) {
            showToast(`Invalid CSV format. Missing required column: ${req}`, 'error');
            return;
          }
        }

        showToast(`Processing ${lines.length - 1} users. Please wait...`, 'info');
        let successCount = 0;
        let failCount = 0;

        const { AdminService } = await import('/js/services.js');

        for (let i = 1; i < lines.length; i++) {
          try {
            // Naive CSV split (fails on commas inside quotes, but acceptable for this usecase)
            const cols = lines[i].split(',').map(c => c.trim());
            const row = {};
            headers.forEach((h, idx) => { row[h] = cols[idx] || ''; });

            if (!row.role || !row.email || !row.password) {
              console.warn(`Row ${i} missing required fields.`);
              failCount++;
              continue;
            }

            const role = row.role.toUpperCase();
            const data = {
              role,
              name: row.name,
              email: row.email,
              password: row.password,
              department: (role === 'DEAN' || role === 'ADMIN') ? null : (row.department || null)
            };

            if (role === 'STUDENT') {
              data.class = row.class || null;
              data.year = parseInt(row.year) || null;
              data.enrollmentNumber = row.enrollmentnumber || row.employeeid || null;
            } else {
              data.employeeId = row.employeeid || row.enrollmentnumber || null;
            }

            const newUser = await AdminService.createUser(data);
            allUsers.unshift({ ...newUser, isApproved: true, status: 'approved' });
            successCount++;
          } catch (err) {
            console.error(`Failed to create user at row ${i}:`, err);
            failCount++;
          }
        }

        e.target.value = ''; // Reset input
        showToast(`Bulk Import Complete. ${successCount} successful, ${failCount} failed.`, successCount > 0 ? 'success' : 'warning');
        if (successCount > 0) { renderTable(); }
      };

      reader.readAsText(file);
    });
  }
}
