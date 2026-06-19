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
      ${createSidebar(user.role, '/admin/users')}
      <div class="main-content">
        ${createHeader('User Management', user)}
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
            <button class="btn btn-primary btn-sm" id="btn-add-user">+ Add User</button>
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
    document.getElementById('users-wrap').innerHTML = `<div class="empty-state"><h3 style="color:var(--danger);">Error: ${err.message}</h3></div>`;
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
                    ${u.rollNumber ? `<p style="color:var(--text-muted);font-size:0.75rem;">${u.rollNumber}</p>` : ''}
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
                ${!u.isApproved ? `<button class="btn btn-xs btn-primary btn-approve" data-id="${u.id}" data-role="${u.role}">Approve</button>` : `<span class="text-muted" style="font-size:0.75rem;">—</span>`}
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

  const modal = document.getElementById('add-user-modal');
  document.getElementById('btn-add-user').addEventListener('click', () => modal.style.display = 'flex');
  document.getElementById('close-user-modal').addEventListener('click', () => modal.style.display = 'none');
  document.getElementById('cancel-user-modal').addEventListener('click', () => modal.style.display = 'none');

  const roleSel = document.getElementById('new-user-role');
  const deptGroup = document.getElementById('admin-dept-group');
  const deptLabel = document.getElementById('admin-dept-label');
  const deptSel = document.getElementById('new-user-dept');
  const stuFields = document.getElementById('admin-student-fields');
  const classSel = document.getElementById('new-user-class');
  let allDepts = [];

  import('/js/services.js').then(async ({ DepartmentService, ClassService }) => {
    try {
      allDepts = await DepartmentService.getAll();
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
    deptSel.innerHTML = '<option value="">Select ' + (isSec ? 'Section' : 'Department') + '</option>' +
      allDepts.filter(d => isSec ? d.type === 'Section' : d.type !== 'Section').map(d => `<option value="${d.name}">${d.name}</option>`).join('');
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
}
