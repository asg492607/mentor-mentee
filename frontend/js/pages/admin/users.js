import { getUserProfile } from '/js/auth.js';
import { createSidebar } from '/js/components/sidebar.js';
import { createHeader } from '/js/components/header.js';
import { StudentService, FacultyService, AdminService, DepartmentService } from '/js/services.js';
import { showToast } from '/js/components/toast.js';
import { parseImportFile, isRowObjectEmpty } from '/js/excel-import.js';
import { escapeHtml } from '/js/utils.js';

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
            <div style="display:flex;gap:8px;flex-wrap:wrap;">
              ${user.role === 'ADMIN' ? `
              <button class="btn btn-secondary btn-sm" id="btn-open-multi-class-mentors-users" title="View &amp; Export Mentors for Selected Classes">👥 Mentors by Class</button>
              <button class="btn btn-secondary btn-sm" id="btn-export-students" title="Export Students CSV (Email & Password/Mobile)">📤 Export Students</button>
              <button class="btn btn-secondary btn-sm" id="btn-export-teachers" title="Export Teachers CSV (Email & Password/Mobile)">📤 Export Teachers</button>
              <button class="btn btn-secondary btn-sm" id="btn-open-bulk-import">📁 Bulk Import</button>
              <button class="btn btn-accent btn-sm" id="btn-open-assign-mentor" style="background:linear-gradient(135deg,#6c47ff,#a855f7);color:#fff;border:none;">🔗 Assign Mentors</button>
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
  let currentPage = 1;
  const pageSize = 20;

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

    const totalPages = Math.ceil(list.length / pageSize) || 1;
    if (currentPage > totalPages) currentPage = totalPages;
    if (currentPage < 1) currentPage = 1;

    const startIndex = (currentPage - 1) * pageSize;
    const endIndex = Math.min(startIndex + pageSize, list.length);
    const visibleList = list.slice(startIndex, endIndex);

    wrap.innerHTML = `
      <table class="data-table">
        <thead><tr><th>User</th><th>Email</th><th>Role</th><th>Department</th><th>Status</th><th>Actions</th></tr></thead>
        <tbody>
          ${visibleList.map(u => `
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
                ${(u.role||'').toUpperCase() === 'STUDENT' && u.mentorId ? `<button class="btn btn-xs btn-secondary btn-unassign-mentor" style="margin-left:4px;" data-id="${u.id}" data-name="${(u.name||'').replace(/"/g,'&quot;')}" title="Unassign Mentor">Unassign</button>` : ''}
                ${user.role === 'ADMIN' ? `<button class="btn btn-xs btn-danger btn-delete-user" style="margin-left:4px;" data-id="${u.id}" data-name="${(u.name||'').replace(/"/g,'&quot;')}" data-role="${u.role}">Delete</button>` : ''}
              </td>
            </tr>
          `).join('')}
        </tbody>
      </table>

      <!-- Pagination Footer -->
      <div style="display:flex;justify-content:space-between;align-items:center;padding:16px;border-top:1px solid var(--border);flex-wrap:wrap;gap:12px;">
        <span style="font-size:0.85rem;color:var(--text-secondary);">
          Showing ${startIndex + 1}–${endIndex} of ${list.length} users
        </span>
        <div style="display:flex;align-items:center;gap:8px;">
          <button class="btn btn-xs btn-secondary" id="btn-prev-page" ${currentPage === 1 ? 'disabled' : ''}>← Previous</button>
          <span style="font-size:0.85rem;font-weight:600;padding:0 4px;">Page ${currentPage} of ${totalPages}</span>
          <button class="btn btn-xs btn-secondary" id="btn-next-page" ${currentPage === totalPages ? 'disabled' : ''}>Next →</button>
        </div>
      </div>
    `;

    document.getElementById('btn-prev-page')?.addEventListener('click', () => {
      if (currentPage > 1) { currentPage--; renderTable(); }
    });

    document.getElementById('btn-next-page')?.addEventListener('click', () => {
      if (currentPage < totalPages) { currentPage++; renderTable(); }
    });

    document.querySelectorAll('.btn-approve').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const id = e.currentTarget?.dataset?.id || e.target.closest('.btn-approve')?.dataset?.id;
        const role = e.currentTarget?.dataset?.role || e.target.closest('.btn-approve')?.dataset?.role;
        if (!id) return;
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

    document.querySelectorAll('.btn-view-profile').forEach(btn =>
      btn.addEventListener('click', (e) => {
        const id = e.currentTarget?.dataset?.id || e.target.closest('.btn-view-profile')?.dataset?.id;
        if (id && window.openUserProfile) window.openUserProfile(id);
      })
    );

    document.querySelectorAll('.btn-unassign-mentor').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const id = e.currentTarget.dataset.id;
        const name = e.currentTarget.dataset.name;
        if (!confirm(`Unassign mentor from "${name}"? Their assignedStudentCount will be decremented.`)) return;
        btn.disabled = true; btn.textContent = '...';
        try {
          const { StudentService } = await import('/js/services.js');
          await StudentService.unassignMentor(id);
          showToast('Mentor unassigned successfully.', 'success');
          const u = allUsers.find(x => x.id === id);
          if (u) u.mentorId = null;
          renderTable();
        } catch (err) {
          showToast('Failed: ' + err.message, 'error');
          btn.disabled = false; btn.textContent = 'Unassign';
        }
      });
    });

    document.querySelectorAll('.btn-delete-user').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const id = e.currentTarget.dataset.id;
        const name = e.currentTarget.dataset.name;
        const role = (e.currentTarget.dataset.role || '').toUpperCase();
        if (!confirm(`Permanently delete "${name}"? This cannot be undone.\n\nNote: Their Firebase Auth account will NOT be deleted automatically.`)) return;
        btn.disabled = true; btn.textContent = '...';
        try {
          if (role === 'STUDENT') {
            const { StudentService } = await import('/js/services.js');
            await StudentService.deleteStudent(id);
          } else {
            const { api } = await import('/js/api.js');
            await api.delete(`/admin/users/${id}`);
          }
          showToast(`"${name}" deleted successfully.`, 'success');
          allUsers = allUsers.filter(x => x.id !== id);
          renderTable();
        } catch (err) {
          showToast('Failed: ' + err.message, 'error');
          btn.disabled = false; btn.textContent = 'Delete';
        }
      });
    });
  }

  const searchInput = container.querySelector('#user-search');
  if (searchInput) {
    searchInput.addEventListener('input', e => { search = e.target.value.toLowerCase(); renderTable(); });
  }
  container.querySelectorAll('.role-f').forEach(btn => {
    btn.addEventListener('click', () => {
      container.querySelectorAll('.role-f').forEach(b => b.className = 'btn btn-sm btn-secondary role-f');
      btn.className = 'btn btn-sm btn-primary role-f';
      roleFilter = btn.dataset.r; renderTable();
    });
  });

  container.querySelector('#btn-open-multi-class-mentors-users')?.addEventListener('click', async () => {
    const { openMultiClassMentorsModal } = await import('/js/components/multi-class-mentors-modal.js');
    await openMultiClassMentorsModal();
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
                <label class="form-label">Email (Username)</label>
                <input type="email" id="new-user-email" class="form-input" required>
              </div>
              <div class="form-group">
                <label class="form-label">Password / Mobile</label>
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
                  <label class="form-label">Class <span style="color:var(--text-muted);font-weight:400;">(optional)</span></label>
                  <select id="new-user-class" class="form-select" disabled>
                    <option value="">Select Department First</option>
                  </select>
                </div>
                <div class="form-group">
                  <label class="form-label">Year <span style="color:var(--text-muted);font-weight:400;">(optional)</span></label>
                  <select id="new-user-year" class="form-select">
                    <option value="">Select Year</option>
                    <option value="1">First Year</option>
                    <option value="2">Second Year</option>
                    <option value="3">Third Year</option>
                    <option value="4">Fourth Year</option>
                  </select>
                </div>
                <div class="form-group" style="grid-column: 1 / -1;">
                  <label class="form-label">Assign Mentor <span style="color:var(--text-muted);font-weight:400;">(optional)</span></label>
                  <select id="new-user-mentor" class="form-select" disabled>
                    <option value="">Select Department First</option>
                  </select>
                  <p style="font-size:0.75rem;color:var(--text-muted);margin-top:4px;">Only faculty from the selected department are shown.</p>
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

  // Bulk Import Modal HTML
  const bulkModalHtml = `
    <div id="bulk-import-modal" class="modal-backdrop" style="display:none;z-index:9999;">
      <div class="modal" style="max-width:800px;width:95%;">
        <div class="modal-header">
          <div>
            <h3 style="margin:0;">Bulk Import Users (Students & Teachers)</h3>
            <p style="font-size:0.8rem;color:var(--text-muted);margin-top:2px;">
              Email address will be used as the <strong>Username</strong>. Mobile number will be used as the <strong>Password</strong>.
            </p>
          </div>
          <button class="btn btn-ghost btn-sm" id="close-bulk-modal">✕</button>
        </div>
        <div class="modal-body" style="padding-top:12px;">
          <!-- Controls Header -->
          <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:12px;margin-bottom:16px;background:var(--bg-secondary);padding:14px;border-radius:8px;">
            <div style="display:flex;align-items:center;gap:8px;">
              <span style="font-size:0.85rem;font-weight:600;color:var(--text-secondary);">Target Role:</span>
              <button class="btn btn-sm btn-primary bulk-role-tab" data-role="STUDENT">Students</button>
              <button class="btn btn-sm btn-secondary bulk-role-tab" data-role="FACULTY">Teachers / Faculty</button>
              <button class="btn btn-sm btn-secondary bulk-role-tab" data-role="AUTO">Auto-detect from File</button>
            </div>
            <div style="display:flex;gap:8px;">
              <button class="btn btn-xs btn-secondary" id="btn-dl-student-tpl">⬇️ Student Template</button>
              <button class="btn btn-xs btn-secondary" id="btn-dl-teacher-tpl">⬇️ Teacher Template</button>
            </div>
          </div>

          <!-- File Upload Zone -->
          <div id="bulk-drop-zone" style="border:2px dashed var(--border);border-radius:8px;padding:28px 16px;text-align:center;background:var(--bg-primary);margin-bottom:16px;cursor:pointer;transition:border-color 0.2s;">
            <p style="font-size:1.5rem;margin-bottom:4px;">📁</p>
            <p style="font-weight:600;margin-bottom:4px;font-size:0.95rem;" id="drop-zone-label">Click or Drag & Drop your CSV or Excel file (.csv, .xlsx, .xls) here</p>
            <p style="font-size:0.75rem;color:var(--text-muted);margin:0;">
              Expected columns: <code>Name</code>, <code>Enrollment Number</code>, <code>Email Address</code>, <code>Mobile Number</code>, <code>Department</code>
            </p>
          </div>
          <input type="file" id="bulk-file-input" accept=".csv, .xlsx, .xls" style="display:none;">

          <!-- Preview Table Area -->
          <div id="bulk-preview-wrap" style="display:none;margin-top:16px;">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
              <h4 style="margin:0;font-size:0.9rem;">File Data Preview (<span id="preview-total-count">0</span> records)</h4>
              <span id="preview-validation-badge" class="badge badge-info">Validating...</span>
            </div>
            <div style="max-height:220px;overflow-y:auto;border:1px solid var(--border);border-radius:6px;background:var(--bg-primary);">
              <table class="data-table" style="font-size:0.8rem;">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Enrollment / Emp ID</th>
                    <th>Email Address (Username)</th>
                    <th>Mobile (Password)</th>
                    <th>Department</th>
                    <th>Role</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody id="bulk-preview-tbody"></tbody>
              </table>
            </div>
          </div>
        </div>

        <div class="modal-footer mt-4" style="border-top:1px solid var(--border);padding-top:16px;display:flex;justify-content:space-between;align-items:center;">
          <span style="font-size:0.75rem;color:var(--text-muted);">Users created will be marked as approved automatically.</span>
          <div style="display:flex;gap:8px;">
            <button type="button" class="btn btn-secondary btn-sm" id="cancel-bulk-modal">Cancel</button>
            <button type="button" class="btn btn-primary btn-sm" id="btn-execute-bulk" disabled>Import Users</button>
          </div>
        </div>
      </div>
    </div>
  `;
  container.insertAdjacentHTML('beforeend', bulkModalHtml);

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
  const btnAddUser = document.getElementById('btn-add-user');
  if (btnAddUser && modal) {
      btnAddUser.addEventListener('click', () => modal.style.display = 'flex');
  }
  document.getElementById('close-user-modal')?.addEventListener('click', () => { if (modal) modal.style.display = 'none'; });
  document.getElementById('cancel-user-modal')?.addEventListener('click', () => { if (modal) modal.style.display = 'none'; });

  const viewModal = document.getElementById('view-profile-modal');
  document.getElementById('close-view-profile-modal')?.addEventListener('click', () => { if (viewModal) viewModal.style.display = 'none'; });
  
  window.openUserProfile = (userId) => {
     const u = allUsers.find(x => x.id === userId);
     if (!u) return;
     const isStudent = (u.role || '').toUpperCase() === 'STUDENT';
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
          ${u.mobileNumber ? `
          <div style="background:var(--bg-secondary);padding:12px;border-radius:8px;grid-column:1/-1;">
            <p style="font-size:0.75rem;color:var(--text-muted);margin:0;">Mobile Number</p>
            <p style="font-weight:600;margin:0;">${u.mobileNumber}</p>
          </div>` : ''}
          ${isStudent ? `
          <div style="background:var(--bg-secondary);padding:12px;border-radius:8px;">
            <p style="font-size:0.75rem;color:var(--text-muted);margin:0;">Enrollment / Year / Class</p>
            <p style="font-weight:600;margin:0;">${u.enrollmentNumber||'—'} / Y${u.year||'?'} / ${u.class||'?'}</p>
          </div>
          <div style="background:var(--bg-secondary);padding:12px;border-radius:8px;">
            <p style="font-size:0.75rem;color:var(--text-muted);margin:0;">CGPA / Attendance</p>
            <p style="font-weight:600;margin:0;">${u.cgpa||'—'} / ${u.attendance||0}%</p>
          </div>
          <div style="background:var(--bg-secondary);padding:12px;border-radius:8px;grid-column:1/-1;">
            <p style="font-size:0.75rem;color:var(--text-muted);margin:0;">Assigned Mentor ID</p>
            <p style="font-weight:600;margin:0;">${u.mentorId || '— (Unassigned)'}</p>
          </div>
          ` : `
          <div style="background:var(--bg-secondary);padding:12px;border-radius:8px;grid-column:1/-1;">
            <p style="font-size:0.75rem;color:var(--text-muted);margin:0;">Employee ID / Designation</p>
            <p style="font-weight:600;margin:0;">${u.employeeId||'—'} (${u.designation||'Faculty'})</p>
          </div>
          `}
        </div>

        ${user.role === 'ADMIN' ? `
        <div style="display:flex;gap:8px;padding-top:12px;border-top:1px solid var(--border);flex-wrap:wrap;">
          ${isStudent && u.mentorId ? `<button class="btn btn-sm btn-secondary" id="modal-btn-unassign" data-id="${u.id}" data-name="${(u.name||'').replace(/"/g,'&quot;')}">Unassign Mentor</button>` : ''}
          <button class="btn btn-sm btn-danger" id="modal-btn-delete" data-id="${u.id}" data-name="${(u.name||'').replace(/"/g,'&quot;')}" data-role="${u.role}" style="margin-left:auto;">🗑 Delete User</button>
        </div>` : ''}
     `;
     viewModal.style.display = 'flex';

     // Bind modal action buttons
     document.getElementById('modal-btn-unassign')?.addEventListener('click', async (e) => {
       const id = e.currentTarget.dataset.id;
       const name = e.currentTarget.dataset.name;
       if (!confirm(`Unassign mentor from "${name}"?`)) return;
       e.currentTarget.disabled = true; e.currentTarget.textContent = '...';
       try {
         await StudentService.unassignMentor(id);
         showToast('Mentor unassigned successfully.', 'success');
         const userData = allUsers.find(x => x.id === id);
         if (userData) userData.mentorId = null;
         viewModal.style.display = 'none';
         renderTable();
       } catch (err) { showToast('Failed: ' + err.message, 'error'); }
     });

     document.getElementById('modal-btn-delete')?.addEventListener('click', async (e) => {
       const id = e.currentTarget.dataset.id;
       const name = e.currentTarget.dataset.name;
       const role = (e.currentTarget.dataset.role || '').toUpperCase();
       if (!confirm(`Permanently delete "${name}"? This cannot be undone.\n\nNote: Their Firebase Auth account will NOT be deleted automatically.`)) return;
       e.currentTarget.disabled = true; e.currentTarget.textContent = '...';
       try {
         if (role === 'STUDENT') {
           await StudentService.deleteStudent(id);
         } else {
           const { api } = await import('/js/api.js');
           await api.delete(`/admin/users/${id}`);
         }
         showToast(`"${name}" deleted successfully.`, 'success');
         allUsers = allUsers.filter(x => x.id !== id);
         viewModal.style.display = 'none';
         renderTable();
       } catch (err) { showToast('Failed: ' + err.message, 'error'); }
     });
  };


  const roleSel   = document.getElementById('new-user-role');
  const deptGroup = document.getElementById('admin-dept-group');
  const deptLabel = document.getElementById('admin-dept-label');
  const deptSel   = document.getElementById('new-user-dept');
  const stuFields = document.getElementById('admin-student-fields');
  const classSel  = document.getElementById('new-user-class');
  const mentorSel = document.getElementById('new-user-mentor');
  let allDepts    = [];
  let allSections = [];

  // ── Load departments & sections, then wire dept → class/mentor chain ──────
  (async () => {
    try {
      const { DepartmentService, ClassService, SettingsService, FacultyService } =
        await import('/js/services.js');

      [allDepts, allSections] = await Promise.all([
        DepartmentService.getAll(),
        SettingsService.getSections()
      ]);

      // Populate dept dropdown initially (role starts as STUDENT)
      populateAdminDepts('Academic');

      // Show student sub-fields immediately since default role = STUDENT
      stuFields.style.display = 'grid';

      // ── dept change → load classes & mentors ──────────────────────────────
      deptSel?.addEventListener('change', async () => {
        if (!deptSel || !roleSel || !classSel || !mentorSel) return;
        const dept = deptSel.value;
        const role = roleSel.value;

        // Reset
        classSel.innerHTML  = '<option value="">— Select Class —</option>';
        classSel.disabled   = true;
        mentorSel.innerHTML = '<option value="">— No Mentor (assign later) —</option>';
        mentorSel.disabled  = true;

        if (!dept || role !== 'STUDENT') return;

        // Show loading state
        classSel.innerHTML  = '<option value="">Loading classes…</option>';
        mentorSel.innerHTML = '<option value="">Loading mentors…</option>';

        const [classes, faculty] = await Promise.all([
          ClassService.getByDepartment(dept),
          FacultyService.getByDepartment(dept)
        ]);

        // Classes
        if (!classes.length) {
          classSel.innerHTML = '<option value="">No classes in this department</option>';
        } else {
          classSel.disabled  = false;
          classSel.innerHTML = '<option value="">— Select Class (optional) —</option>' +
            classes.map(c => `<option value="${c.className}">Class ${c.className}</option>`).join('');
        }

        // Mentors — only FACULTY / MENTOR role
        const mentors = faculty.filter(f => f.role === 'FACULTY' || f.role === 'MENTOR');
        if (!mentors.length) {
          mentorSel.innerHTML = '<option value="">No faculty in this department</option>';
        } else {
          mentorSel.disabled  = false;
          mentorSel.innerHTML = '<option value="">— No Mentor (assign later) —</option>' +
            mentors.map(m =>
              `<option value="${m.id}">${m.name} (${m.assignedStudentCount || 0}/${m.maxStudents || 20} students)</option>`
            ).join('');
        }
      });

    } catch (e) {
      console.error('Add-user form init failed:', e);
    }
  })();

  function populateAdminDepts(typeStr) {
    if (!deptSel) return;
    const isSec = typeStr === 'Section';
    if (isSec) {
      deptSel.innerHTML = '<option value="">Select Section</option>' +
        allSections.map(s => `<option value="${s}">${s}</option>`).join('');
    } else {
      deptSel.innerHTML = '<option value="">Select Department</option>' +
        allDepts.map(d => `<option value="${d.name}">${d.name}</option>`).join('');
    }
  }

  // ── Role change → show/hide student sub-fields ───────────────────────────
  roleSel?.addEventListener('change', () => {
    if (!roleSel || !classSel || !mentorSel || !deptSel || !deptGroup || !stuFields || !deptLabel) return;
    const val = roleSel.value;

    // Reset class + mentor whenever role changes
    classSel.innerHTML  = '<option value="">Select Department First</option>';
    classSel.disabled   = true;
    mentorSel.innerHTML = '<option value="">Select Department First</option>';
    mentorSel.disabled  = true;
    deptSel.value       = '';

    if (val === 'DEAN' || val === 'ADMIN') {
      deptGroup.style.display = 'none';
      stuFields.style.display = 'none';
      deptSel.required        = false;
    } else {
      deptGroup.style.display = 'block';
      deptSel.required        = true;
      if (val === 'STUDENT') {
        stuFields.style.display = 'grid';
        deptLabel.textContent   = 'Department';
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

  // ── Form submit ───────────────────────────────────────────────────────────
  let _submitting = false; // guard against double-submit
  document.getElementById('admin-add-user-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (_submitting) return; // prevent double-submit
    _submitting = true;
    const btn = document.getElementById('submit-new-user');
    btn.disabled = true; btn.textContent = 'Creating…';
    try {
      const role = roleSel.value;
      const emailInput = document.getElementById('new-user-email').value.trim().toLowerCase();

      // Pre-check: does this email already exist in our loaded user list?
      const alreadyExists = allUsers.some(u => (u.email || '').toLowerCase().trim() === emailInput);
      if (alreadyExists) {
        showToast('This email is already registered in the system.', 'error');
        _submitting = false;
        btn.disabled = false; btn.textContent = 'Create User';
        return;
      }

      const data = {
        role,
        name:       document.getElementById('new-user-name').value.trim(),
        email:      emailInput,
        password:   document.getElementById('new-user-password').value,
        department: (role === 'DEAN' || role === 'ADMIN')
                      ? null
                      : deptSel.value || null
      };
      if (role === 'STUDENT') {
        data.class    = classSel.value  || null;
        data.year     = parseInt(document.getElementById('new-user-year').value) || null;
        data.mentorId = mentorSel.value || null;
      }

      const { AdminService: AdmSvc, FacultyService: FacSvc } = await import('/js/services.js');
      const newUser = await AdmSvc.createUser(data);

      // Increment mentor's student count atomically if one was chosen
      if (role === 'STUDENT' && data.mentorId) {
        try {
          // Use Firestore atomic increment to avoid stale-read race conditions
          const { db: firestoreDb } = await import('/js/firebase-init.js');
          const { doc: fsDoc, updateDoc: fsUpdate, increment: fsIncrement } =
            await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js');
          await fsUpdate(fsDoc(firestoreDb, 'faculty', data.mentorId), {
            assignedStudentCount: fsIncrement(1)
          });
        } catch (assignErr) {
          console.warn('Mentor count increment failed:', assignErr.message);
        }
      }

      showToast('User created successfully!', 'success');
      modal.style.display = 'none';
      e.target.reset();

      // Reset dependent dropdowns after form reset
      classSel.innerHTML  = '<option value="">Select Department First</option>';
      classSel.disabled   = true;
      mentorSel.innerHTML = '<option value="">Select Department First</option>';
      mentorSel.disabled  = true;
      stuFields.style.display = 'grid'; // keep student fields visible (STUDENT is default)

      allUsers.unshift({ ...newUser, mentorId: data.mentorId || null, isApproved: true, status: 'approved' });
      renderTable();
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      _submitting = false;
      btn.disabled = false; btn.textContent = 'Create User';
    }
  });


  // --- ENHANCED BULK IMPORT LOGIC ---

  const bulkModal = document.getElementById('bulk-import-modal');
  const btnOpenBulk = document.getElementById('btn-open-bulk-import');
  const closeBulk = document.getElementById('close-bulk-modal');
  const cancelBulk = document.getElementById('cancel-bulk-modal');
  const dropZone = document.getElementById('bulk-drop-zone');
  const fileInput = document.getElementById('bulk-file-input');
  const dropLabel = document.getElementById('drop-zone-label');
  const previewWrap = document.getElementById('bulk-preview-wrap');
  const previewTbody = document.getElementById('bulk-preview-tbody');
  const previewTotalCount = document.getElementById('preview-total-count');
  const previewBadge = document.getElementById('preview-validation-badge');
  const btnExecuteBulk = document.getElementById('btn-execute-bulk');

  let selectedBulkRole = 'STUDENT';
  let parsedRows = [];

  if (btnOpenBulk && bulkModal) {
    btnOpenBulk.addEventListener('click', () => {
      bulkModal.style.display = 'flex';
    });
  }

  closeBulk?.addEventListener('click', () => { if (bulkModal) bulkModal.style.display = 'none'; resetBulkModal(); });
  cancelBulk?.addEventListener('click', () => { if (bulkModal) bulkModal.style.display = 'none'; resetBulkModal(); });

  document.querySelectorAll('.bulk-role-tab').forEach(tab => {
    tab.addEventListener('click', (e) => {
      const targetBtn = e.currentTarget || e.target.closest('.bulk-role-tab');
      document.querySelectorAll('.bulk-role-tab').forEach(t => t.className = 'btn btn-sm btn-secondary bulk-role-tab');
      if (targetBtn) {
        targetBtn.className = 'btn btn-sm btn-primary bulk-role-tab';
        selectedBulkRole = targetBtn.dataset.role;
      }
      if (parsedRows.length > 0) {
        renderPreview();
      }
    });
  });

  // Template downloads
  document.getElementById('btn-dl-student-tpl')?.addEventListener('click', () => {
    const csvContent = "Name,Enrollment Number,Email Address,Mobile Number,Department,Class\nRahul Sharma,EN2024001,rahul.sharma@university.edu,9876543210,Computer Science,A\nPriya Patel,EN2024002,priya.patel@university.edu,9876543211,Computer Science,B\n";
    downloadCSV(csvContent, "Student_Bulk_Import_Template.csv");
  });

  document.getElementById('btn-dl-teacher-tpl')?.addEventListener('click', () => {
    const csvContent = "Name,Employee ID,Email Address,Mobile Number,Department,Designation\nDr. Anjali Mehta,EMP1001,anjali.mehta@university.edu,9123456789,Computer Science,Assistant Professor\nProf. Suresh Kumar,EMP1002,suresh.kumar@university.edu,9123456780,Information Technology,Associate Professor\n";
    downloadCSV(csvContent, "Teacher_Bulk_Import_Template.csv");
  });

  function downloadCSV(content, filename) {
    const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", filename);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  function escapeCSVVal(val) {
    if (val === null || val === undefined) return '';
    const str = String(val).replace(/"/g, '""');
    if (str.includes(',') || str.includes('\n') || str.includes('"')) {
      return `"${str}"`;
    }
    return str;
  }

  // --- EXPORT LOGIC ---
  const btnExportStudents = document.getElementById('btn-export-students');
  const btnExportTeachers = document.getElementById('btn-export-teachers');

  if (btnExportStudents) {
    btnExportStudents.addEventListener('click', () => {
      const studentList = allUsers.filter(u => (u.role || '').toUpperCase() === 'STUDENT');
      if (!studentList.length) {
        showToast('No student accounts found to export.', 'warning');
        return;
      }

      let csv = 'Name,Enrollment Number,Email Address (Username),Mobile Number (Password),Department,Class,Year,Status\n';
      studentList.forEach((s) => {
        csv += [
          escapeCSVVal(s.name || ''),
          escapeCSVVal(s.enrollmentNumber || ''),
          escapeCSVVal(s.email || ''),
          escapeCSVVal(s.mobileNumber || ''),
          escapeCSVVal(s.department || ''),
          escapeCSVVal(s.class || ''),
          escapeCSVVal(s.year || ''),
          escapeCSVVal(s.isApproved ? 'Approved' : 'Pending')
        ].join(',') + '\n';
      });

      const fileName = `Students_Export_Credentials_${new Date().toISOString().slice(0,10)}.csv`;
      downloadCSV(csv, fileName);
      showToast(`Exported ${studentList.length} students to ${fileName}`, 'success');
    });
  }

  if (btnExportTeachers) {
    btnExportTeachers.addEventListener('click', () => {
      const teacherList = allUsers.filter(u => (u.role || '').toUpperCase() !== 'STUDENT');
      if (!teacherList.length) {
        showToast('No teacher/staff accounts found to export.', 'warning');
        return;
      }

      let csv = 'Name,Employee ID,Email Address (Username),Mobile Number (Password),Department,Designation,Role,Status\n';
      teacherList.forEach((t) => {
        csv += [
          escapeCSVVal(t.name || ''),
          escapeCSVVal(t.employeeId || ''),
          escapeCSVVal(t.email || ''),
          escapeCSVVal(t.mobileNumber || ''),
          escapeCSVVal(t.department || ''),
          escapeCSVVal(t.designation || ''),
          escapeCSVVal(t.role || 'FACULTY'),
          escapeCSVVal(t.isApproved ? 'Approved' : 'Pending')
        ].join(',') + '\n';
      });

      const fileName = `Teachers_Export_Credentials_${new Date().toISOString().slice(0,10)}.csv`;
      downloadCSV(csv, fileName);
      showToast(`Exported ${teacherList.length} teachers/staff to ${fileName}`, 'success');
    });
  }

  function resetBulkModal() {
    fileInput.value = '';
    dropLabel.textContent = 'Click or Drag & Drop your CSV or Excel file (.csv, .xlsx, .xls) here';
    previewWrap.style.display = 'none';
    previewTbody.innerHTML = '';
    parsedRows = [];
    btnExecuteBulk.disabled = true;
  }

  // Drag and drop setup
  dropZone?.addEventListener('click', () => {
    fileInput?.click();
  });
  dropZone?.addEventListener('dragover', (e) => { e.preventDefault(); if (dropZone) dropZone.style.borderColor = 'var(--accent)'; });
  dropZone?.addEventListener('dragleave', () => { if (dropZone) dropZone.style.borderColor = 'var(--border)'; });
  dropZone?.addEventListener('drop', (e) => {
    e.preventDefault();
    if (dropZone) dropZone.style.borderColor = 'var(--border)';
    if (e.dataTransfer.files.length) {
      if (fileInput) fileInput.files = e.dataTransfer.files;
      handleFileSelected(e.dataTransfer.files[0]);
    }
  });

  fileInput?.addEventListener('change', (e) => {
    if (e.target.files.length) {
      handleFileSelected(e.target.files[0]);
    }
  });

  function parseCSVLine(lineStr) {
    const res = [];
    let cur = '';
    let inQ = false;
    for (let i = 0; i < lineStr.length; i++) {
      const c = lineStr[i];
      if (c === '"') { inQ = !inQ; }
      else if (c === ',' && !inQ) { res.push(cur.trim()); cur = ''; }
      else { cur += c; }
    }
    res.push(cur.trim());
    return res;
  }

  function normalizeHeaderKey(raw) {
    const h = String(raw || '').toLowerCase().replace(/[^a-z0-9]/g, '');
    if (['sr', 'srno', 'serialnumber', 'sno', 'sn'].includes(h)) return 'sr';
    if (['name', 'fullname', 'studentname', 'teachername', 'facultyname'].includes(h)) return 'name';
    if (['enrollmentnumber', 'enrollmentno', 'enrollment', 'rollno', 'rollnumber', 'employeeid', 'empid', 'id'].includes(h)) return 'enrollmentNumber';
    if (['emailaddress', 'email', 'username', 'useremail'].includes(h)) return 'email';
    if (['mobilenumber', 'numbermobile', 'mobile', 'phone', 'contact', 'mobileno', 'phonenumber'].includes(h)) return 'mobileNumber';
    if (['department', 'dept', 'branch'].includes(h)) return 'department';
    if (['role', 'usertype', 'type'].includes(h)) return 'role';
    if (['class', 'section'].includes(h)) return 'class';
    if (['year', 'stdyear'].includes(h)) return 'year';
    if (['designation', 'post'].includes(h)) return 'designation';
    return h;
  }

  async function handleFileSelected(file) {
    if (!file) return;
    dropLabel.textContent = `Selected: ${file.name}`;

    try {
      const rowsMatrix = await parseImportFile(file);
      if (!rowsMatrix || rowsMatrix.length <= 1) {
        showToast('File is empty or missing data rows.', 'warning');
        resetBulkModal();
        return;
      }

      const rawHeaders = rowsMatrix[0].map(h => String(h || '').trim());
      const mappedHeaders = rawHeaders.map(h => normalizeHeaderKey(h));

      // Build existing email/ID sets for duplicate detection
      const existingEmails = new Set(allUsers.map(u => (u.email || '').toLowerCase().trim()).filter(Boolean));
      const existingIds = new Set(allUsers.map(u => (u.enrollmentNumber || u.employeeId || '').toLowerCase().trim()).filter(Boolean));
      const seenFileEmails = new Set();
      const seenFileIds = new Set();

      parsedRows = [];
      for (let i = 1; i < rowsMatrix.length; i++) {
        const cols = rowsMatrix[i].map(c => String(c !== null && c !== undefined ? c : '').trim());
        const rowData = {};
        mappedHeaders.forEach((key, idx) => {
          rowData[key] = cols[idx] || '';
        });

        // Strictly skip row if completely empty or missing all user fields
        if (isRowObjectEmpty(rowData)) {
          continue;
        }

        const nameVal = rowData.name || '';
        const emailVal = rowData.email || '';
        const mobileVal = rowData.mobileNumber || '';
        const deptVal = rowData.department || '';
        const enrollVal = rowData.enrollmentNumber || '';
        const roleVal = (rowData.role || selectedBulkRole).toUpperCase();
        const normEmail = emailVal.toLowerCase().trim();
        const normEnroll = enrollVal.toLowerCase().trim();

        let status = 'Ready';
        let errorMsg = '';

        if (!emailVal) {
          status = 'Invalid'; errorMsg = 'Missing Email';
        } else if (!emailVal.includes('@')) {
          status = 'Invalid'; errorMsg = 'Invalid Email format';
        } else if (!mobileVal) {
          status = 'Invalid'; errorMsg = 'Missing Mobile Number';
        } else if (!nameVal) {
          status = 'Invalid'; errorMsg = 'Missing Name';
        } else if (existingEmails.has(normEmail) || seenFileEmails.has(normEmail)) {
          status = 'Duplicate'; errorMsg = 'Duplicate Email (Skipped)';
        } else if (normEnroll && (existingIds.has(normEnroll) || seenFileIds.has(normEnroll))) {
          status = 'Duplicate'; errorMsg = 'Duplicate ID (Skipped)';
        }

        if (status === 'Ready') {
          seenFileEmails.add(normEmail);
          if (normEnroll) seenFileIds.add(normEnroll);
        }

        parsedRows.push({
          sr: String(parsedRows.length + 1),
          name: nameVal,
          enrollmentNumber: enrollVal,
          email: emailVal,
          mobileNumber: mobileVal,
          department: deptVal,
          role: roleVal,
          class: rowData.class || null,
          year: (rowData.year && !isNaN(parseInt(rowData.year))) ? parseInt(rowData.year) : null,
          designation: rowData.designation || null,
          status,
          errorMsg
        });
      }

      if (parsedRows.length === 0) {
        showToast('No valid data rows found in file (empty rows skipped).', 'warning');
        resetBulkModal();
        return;
      }

      renderPreview();
    } catch (err) {
      console.error('File import parsing error:', err);
      showToast(err.message || 'Error parsing file', 'error');
      resetBulkModal();
    }
  }

  function renderPreview() {
    previewTbody.innerHTML = '';
    previewTotalCount.textContent = parsedRows.length;
    let validCount = 0;
    let dupCount = 0;

    parsedRows.forEach((row) => {
      const activeRole = selectedBulkRole === 'AUTO' ? row.role : selectedBulkRole;
      const isReady = row.status === 'Ready';
      const isDup = row.status === 'Duplicate';
      if (isReady) validCount++;
      if (isDup) dupCount++;

      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td><strong>${escapeHtml(row.name || '—')}</strong></td>
        <td>${escapeHtml(row.enrollmentNumber || '—')}</td>
        <td>${escapeHtml(row.email || '—')}</td>
        <td>${escapeHtml(row.mobileNumber || '—')}</td>
        <td>${escapeHtml(row.department || '—')}</td>
        <td>${roleBadge(activeRole)}</td>
        <td>
          <span class="badge ${isReady ? 'badge-success' : isDup ? 'badge-warning' : 'badge-danger'}">
            ${isReady ? 'Ready' : escapeHtml(row.errorMsg || 'Invalid')}
          </span>
        </td>
      `;
      previewTbody.appendChild(tr);
    });

    previewWrap.style.display = 'block';
    if (validCount === parsedRows.length) {
      previewBadge.className = 'badge badge-success';
      previewBadge.textContent = `All ${validCount} records ready to import`;
      btnExecuteBulk.disabled = false;
    } else if (validCount > 0) {
      previewBadge.className = 'badge badge-warning';
      previewBadge.textContent = `${validCount} ready, ${dupCount} duplicates to skip`;
      btnExecuteBulk.disabled = false;
    } else {
      previewBadge.className = 'badge badge-danger';
      previewBadge.textContent = `0 new records (${dupCount} duplicates/invalid)`;
      btnExecuteBulk.disabled = true;
    }
  }

  btnExecuteBulk?.addEventListener('click', async () => {
    const validRows = parsedRows.filter(r => r.status === 'Ready');
    if (!validRows.length) return;

    btnExecuteBulk.disabled = true;
    btnExecuteBulk.innerHTML = '<div class="spinner" style="width:16px;height:16px;border-width:2px;"></div> Importing...';

    // Show Progress Bar
    const progressModalHtml = `
      <div id="bulk-progress-modal" class="modal-backdrop" style="display:flex;z-index:10000;background:rgba(0,0,0,0.6);">
        <div class="modal" style="max-width:420px;text-align:center;padding:28px;">
          <h3 style="margin-bottom:8px;">Importing Users...</h3>
          <p style="font-size:0.875rem;color:var(--text-secondary);margin-bottom:6px;" id="progress-status-text">
            Starting…
          </p>
          <p style="font-size:0.8rem;color:var(--text-muted);margin-bottom:14px;" id="progress-detail-text">&nbsp;</p>
          <div style="height:14px;margin-bottom:14px;background:var(--bg-secondary);border-radius:7px;overflow:hidden;box-shadow:inset 0 1px 3px rgba(0,0,0,0.15);">
            <div id="progress-bar-fill"
              style="height:100%;width:0%;background:linear-gradient(90deg,var(--accent),#a855f7);border-radius:7px;transition:width 0.15s ease;"></div>
          </div>
          <div style="display:flex;justify-content:space-between;font-size:0.72rem;color:var(--text-muted);margin-bottom:12px;">
            <span id="progress-success-label" style="color:var(--success);">✓ 0 created</span>
            <span id="progress-skip-label"    style="color:var(--warning);">⊘ 0 skipped</span>
            <span id="progress-fail-label"    style="color:var(--danger);">✗ 0 failed</span>
          </div>
          <p style="font-size:0.72rem;color:var(--text-muted);">Email = Username | Mobile = Password</p>
        </div>
      </div>
    `;
    document.body.insertAdjacentHTML('beforeend', progressModalHtml);
    const progressModal   = document.getElementById('bulk-progress-modal');
    const statusText      = document.getElementById('progress-status-text');
    const detailText      = document.getElementById('progress-detail-text');
    const barFill         = document.getElementById('progress-bar-fill');
    const successLabel    = document.getElementById('progress-success-label');
    const skipLabel       = document.getElementById('progress-skip-label');
    const failLabel       = document.getElementById('progress-fail-label');

    // Helper: yield a paint frame so the browser redraws before the next heavy call
    const frame = () => new Promise(resolve => requestAnimationFrame(resolve));

    function updateProgress(processed, total, successCount, duplicateCount, failCount, currentEmail) {
      const percent = Math.round((processed / total) * 100);
      if (barFill)      barFill.style.width     = `${percent}%`;
      if (statusText)   statusText.textContent   = `Processing ${processed} of ${total} (${percent}%)`;
      if (detailText)   detailText.textContent   = currentEmail ? `↳ ${currentEmail}` : '';
      if (successLabel) successLabel.textContent = `✓ ${successCount} created`;
      if (skipLabel)    skipLabel.textContent    = `⊘ ${duplicateCount} skipped`;
      if (failLabel)    failLabel.textContent    = `✗ ${failCount} failed`;
    }

    let successCount   = 0;
    let duplicateCount = 0;
    let failCount      = 0;
    const total        = validRows.length;

    const { AdminService } = await import('/js/services.js');
    const existingEmailsInDb = new Set(allUsers.map(u => (u.email || '').toLowerCase().trim()).filter(Boolean));

    for (let i = 0; i < validRows.length; i++) {
      const row = validRows[i];
      const targetRole = selectedBulkRole === 'AUTO' ? row.role : selectedBulkRole;
      const cleanEmail = (row.email || '').toLowerCase().trim();

      // Update + repaint BEFORE doing heavy work so user sees progress immediately
      updateProgress(i, total, successCount, duplicateCount, failCount, cleanEmail);
      await frame(); // give browser a repaint frame

      if (existingEmailsInDb.has(cleanEmail)) {
        duplicateCount++;
        updateProgress(i + 1, total, successCount, duplicateCount, failCount, cleanEmail);
        await frame();
        continue;
      }

      try {
        let deptVal = (row.department || '').trim();
        // Normalize common variants like CSE-CORE / CSE Core to official "BTech CSE - Core"
        if (/^(CSE-CORE|CSE CORE|BTECH CSE CORE|B\.TECH CSE CORE)$/i.test(deptVal)) {
          deptVal = 'BTech CSE - Core';
        }

        const classVal = (row.class || '').trim();

        const payload = {
          role:             targetRole,
          name:             row.name,
          email:            row.email,
          password:         row.mobileNumber,
          mobileNumber:     row.mobileNumber,
          department:       deptVal || null,
          enrollmentNumber: row.enrollmentNumber,
          employeeId:       row.enrollmentNumber,
          class:            classVal || null,
          year:             row.year,
          designation:      row.designation
        };

        const newUser = await AdminService.createUser(payload);

        // Auto-create class if it doesn't exist yet for this department
        if (classVal && deptVal) {
          try {
            const { ClassService } = await import('/js/services.js');
            const existingClasses = await ClassService.getByDepartment(deptVal);
            if (!existingClasses.some(c => (c.className || '').toLowerCase() === classVal.toLowerCase())) {
              await ClassService.create({ department: deptVal, className: classVal });
            }
          } catch (cErr) {
            console.warn('Auto class creation warning during import:', cErr);
          }
        }

        allUsers.unshift({ ...newUser, isApproved: true, status: 'approved' });
        existingEmailsInDb.add(cleanEmail);
        successCount++;
      } catch (err) {
        console.error(`Failed to import user ${row.email}:`, err);
        if (err.code === 'auth/email-already-in-use' || String(err.message || '').includes('already in use') || String(err.message || '').includes('already registered')) {
          duplicateCount++;
        } else {
          failCount++;
        }
      }

      // Update after the call resolves
      updateProgress(i + 1, total, successCount, duplicateCount, failCount, '');
      await frame();
    }

    // Final state: show 100%
    updateProgress(total, total, successCount, duplicateCount, failCount, '');
    if (statusText) statusText.textContent = 'Done! Finalising…';
    await frame();

    progressModal?.remove();
    bulkModal.style.display = 'none';
    resetBulkModal();
    btnExecuteBulk.disabled = false;
    btnExecuteBulk.textContent = 'Import Users';

    const msg = `Bulk Import Finished! ${successCount} account(s) created.${duplicateCount ? ` ${duplicateCount} duplicate(s) skipped.` : ''}${failCount ? ` ${failCount} failed.` : ''}`;
    showToast(msg, successCount > 0 ? 'success' : 'info');
    if (successCount > 0) {
      renderTable();
    }
  });



  // ════════════════════════════════════════════════════════════════════════
  // ASSIGN MENTOR & AUTO-REGISTER FROM CLASS REGISTER SHEET
  // ════════════════════════════════════════════════════════════════════════

  const assignModalHtml = `
    <div id="assign-mentor-modal" class="modal-backdrop" style="display:none;z-index:9999;">
      <div class="modal" style="max-width:1050px;width:98%;">
        <div class="modal-header" style="background:linear-gradient(135deg,#6c47ff22,#a855f722);border-bottom:1px solid #6c47ff44;">
          <div>
            <h3 style="margin:0;display:flex;align-items:center;gap:8px;">
              <span>🔗</span> Assign Mentors &amp; Auto-Register from Sheet
            </h3>
            <p style="font-size:0.8rem;color:var(--text-muted);margin-top:3px;">
              Upload any Class Register CSV / Excel sheet (.csv, .xlsx, .xls). Unregistered students will be <strong>automatically registered</strong> with their contact, class, father's contact, and specialization, and assigned to their designated mentor.
            </p>
          </div>
          <button class="btn btn-ghost btn-sm" id="close-assign-modal">✕</button>
        </div>
        <div class="modal-body" style="padding-top:14px;max-height:75vh;overflow-y:auto;">

          <!-- Drop Zone -->
          <div id="assign-drop-zone" style="border:2px dashed #6c47ff88;border-radius:10px;padding:22px 16px;text-align:center;background:var(--bg-primary);margin-bottom:14px;cursor:pointer;transition:border-color 0.2s;">
            <p style="font-size:1.6rem;margin-bottom:4px;">📑</p>
            <p style="font-weight:600;font-size:0.95rem;" id="assign-drop-label">Click or Drag &amp; Drop Class Register sheet here (.csv, .xlsx, .xls)</p>
            <p style="font-size:0.75rem;color:var(--text-muted);margin:6px 0 0;">
              Recognized columns: <code>Enrollment No</code> &nbsp;·&nbsp; <code>Name of Student</code> &nbsp;·&nbsp; <code>Roll No &amp; Batch</code> &nbsp;·&nbsp; <code>Student Contact</code> &nbsp;·&nbsp; <code>Email</code> &nbsp;·&nbsp; <code>Father's Contact</code> &nbsp;·&nbsp; <code>Specialization</code> &nbsp;·&nbsp; <code>Mentor Name</code>
            </p>
          </div>
          <input type="file" id="assign-file-input" accept=".csv,.xlsx,.xls" style="display:none;">

          <!-- Department Mapping & Confirmation Section -->
          <div id="assign-dept-section" style="display:none;background:var(--bg-secondary);border:1px solid #6c47ff44;border-radius:8px;padding:14px 16px;margin-bottom:14px;">
            <div style="display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:10px;flex-wrap:wrap;">
              <h4 style="margin:0;font-size:0.88rem;display:flex;align-items:center;gap:6px;color:var(--text-primary);">
                <span>🏛️</span> Department Assignment &amp; Confirmation
              </h4>
              <span style="font-size:0.75rem;color:var(--text-muted);">Please verify which system department students should belong to:</span>
            </div>
            <div id="assign-dept-mapping-list" style="display:flex;flex-direction:column;gap:8px;"></div>
          </div>

          <!-- Stats bar -->
          <div id="assign-stats-bar" style="display:none;margin-bottom:12px;gap:8px;flex-wrap:wrap;align-items:center;">
            <span id="assign-stat-new"      class="badge badge-accent"  style="font-size:0.8rem;background:linear-gradient(135deg,#a855f7,#ec4899);color:#fff;border:none;">✨ 0 new to register &amp; assign</span>
            <span id="assign-stat-matched"  class="badge badge-success" style="font-size:0.8rem;">🔗 0 existing to assign</span>
            <span id="assign-stat-already"  class="badge badge-info"    style="font-size:0.8rem;">ℹ 0 already assigned</span>
            <span id="assign-stat-nomentor" class="badge badge-warning" style="font-size:0.8rem;">⚠ 0 mentor not found</span>
            <span id="assign-stat-total"    class="badge badge-muted"   style="font-size:0.8rem;">0 total rows</span>
          </div>

          <!-- Preview Table -->
          <div id="assign-preview-wrap" style="display:none;">
            <div style="max-height:340px;overflow-y:auto;border:1px solid var(--border);border-radius:8px;background:var(--bg-primary);">
              <table class="data-table" style="font-size:0.8rem;">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Student Name (Sheet)</th>
                    <th>Enrollment No</th>
                    <th>Contact &amp; Email</th>
                    <th>Father's Contact</th>
                    <th>Batch / Roll</th>
                    <th>Assigned Dept</th>
                    <th>Matched Mentor</th>
                    <th>Action Status</th>
                  </tr>
                </thead>
                <tbody id="assign-preview-tbody"></tbody>
              </table>
            </div>
          </div>

        </div>
        <div class="modal-footer" style="border-top:1px solid var(--border);padding-top:14px;display:flex;justify-content:space-between;align-items:center;gap:8px;flex-wrap:wrap;">
          <span style="font-size:0.75rem;color:var(--text-muted);">New students will be auto-created in Firebase with their class register credentials (Username = Email, Password = Mobile/Enrollment).</span>
          <div style="display:flex;gap:8px;align-items:center;">
            <label style="font-size:0.8rem;display:flex;align-items:center;gap:6px;cursor:pointer;">
              <input type="checkbox" id="assign-override-chk"> Override existing mentor assignments
            </label>
            <button type="button" class="btn btn-secondary btn-sm" id="cancel-assign-modal">Cancel</button>
            <button type="button" class="btn btn-sm" id="btn-execute-assign" disabled
              style="background:linear-gradient(135deg,#6c47ff,#a855f7);color:#fff;border:none;">🔗 Auto-Register &amp; Assign Mentors</button>
          </div>
        </div>
      </div>
    </div>
  `;
  container.insertAdjacentHTML('beforeend', assignModalHtml);

  // ── Modal elements ───────────────────────────────────────────────────
  const assignModal = document.getElementById('assign-mentor-modal');
  const btnOpenAssign = document.getElementById('btn-open-assign-mentor');
  const closeAssign = document.getElementById('close-assign-modal');
  const cancelAssign = document.getElementById('cancel-assign-modal');
  const assignDropZone = document.getElementById('assign-drop-zone');
  const assignFileInput = document.getElementById('assign-file-input');
  const assignDropLabel = document.getElementById('assign-drop-label');
  const assignDeptSection = document.getElementById('assign-dept-section');
  const assignDeptMappingList = document.getElementById('assign-dept-mapping-list');
  const assignPreviewWrap = document.getElementById('assign-preview-wrap');
  const assignPreviewTbody = document.getElementById('assign-preview-tbody');
  const assignStatsBar = document.getElementById('assign-stats-bar');
  const btnExecuteAssign = document.getElementById('btn-execute-assign');
  const assignOverrideChk = document.getElementById('assign-override-chk');

  let assignRows = []; // parsed + resolved rows
  let sheetSpecializations = []; // distinct specialization strings found in sheet
  let deptMapping = {}; // { [specName]: targetDeptName }
  let allSystemDepartments = []; // list of department objects from DB

  function resetAssignModal() {
    assignFileInput.value = '';
    assignDropLabel.textContent = 'Click or Drag & Drop Class Register sheet here (.csv, .xlsx, .xls)';
    assignDeptSection.style.display = 'none';
    assignDeptMappingList.innerHTML = '';
    assignPreviewWrap.style.display = 'none';
    assignStatsBar.style.display = 'none';
    assignPreviewTbody.innerHTML = '';
    assignRows = [];
    sheetSpecializations = [];
    deptMapping = {};
    btnExecuteAssign.disabled = true;
  }

  if (btnOpenAssign && assignModal) {
    btnOpenAssign.addEventListener('click', () => { assignModal.style.display = 'flex'; });
  }
  if ((window.location.hash.includes('assign=true') || window.location.hash.includes('assign-mentor')) && assignModal) {
    assignModal.style.display = 'flex';
  }
  closeAssign?.addEventListener('click', () => { if (assignModal) assignModal.style.display = 'none'; resetAssignModal(); });
  cancelAssign?.addEventListener('click', () => { if (assignModal) assignModal.style.display = 'none'; resetAssignModal(); });

  assignDropZone?.addEventListener('click', () => {
    assignFileInput?.click();
  });
  assignDropZone?.addEventListener('dragover', (e) => { e.preventDefault(); if (assignDropZone) assignDropZone.style.borderColor = '#a855f7'; });
  assignDropZone?.addEventListener('dragleave', () => { if (assignDropZone) assignDropZone.style.borderColor = '#6c47ff88'; });
  assignDropZone?.addEventListener('drop', (e) => {
    e.preventDefault();
    if (assignDropZone) assignDropZone.style.borderColor = '#6c47ff88';
    if (e.dataTransfer.files.length) handleAssignFile(e.dataTransfer.files[0]);
  });
  assignFileInput?.addEventListener('change', (e) => {
    if (e.target.files.length) handleAssignFile(e.target.files[0]);
  });

  // ── Normalize column header for class register & assignment sheets ───
  function normalizeAssignHeader(raw) {
    const h = String(raw || '').toLowerCase().replace(/[^a-z0-9]/g, '');
    // Student name
    if (['nameofstudent','studentname','name','fullname','stdname','sname','student'].includes(h)) return 'studentName';
    // Enrollment / Roll number / ID
    if (['enrollmentnumber','enrollmentno','enrollment','enroll','regno','registrationno','id','empid'].includes(h)) return 'enrollmentNo';
    // Roll no & Batch combined (e.g. "1-A")
    if (['rollnobatch','rollnoandbatch','rollandbatch','classbatch','rollbatch'].includes(h)) return 'rollNoBatch';
    // Practical Batch (e.g. "A")
    if (['practicalbatch','pbatch','pracbatch','labgroup','group'].includes(h)) return 'practicalBatch';
    // Roll number standalone (e.g. "1")
    if (['rollno','rollnumber','rollnum','roll'].includes(h)) return 'rollNo';
    // Batch / Class / Section / Division (e.g. "Batch-A", "Class A")
    if (['batch','class','section','division','div','sec'].includes(h)) return 'batch';
    // Student contact / phone
    if (['studentcontactno','studentcontact','contactno','mobilenumber','mobile','phone','studentphone','phonenumber','studentmobilenumber','studentcontactnumber','contact','studentcontactno'].includes(h)) return 'mobileNumber';
    // Student Email
    if (['studentemailid','studentemail','emailaddress','email','mailid','mail','useremail','username','studentmail'].includes(h)) return 'email';
    // Father's / Parent Contact
    if (['fatherscontactno','fathercontactno','fathercontact','fatherphone','parentcontact','parentphone','fathercontactnumber','fatherscontact','fatherphonem','parentscontactno','parentcontactno'].includes(h)) return 'fatherContact';
    // Specialization / Department / Branch / Stream
    if (['specialization','spec','branch','department','dept','stream','program','course'].includes(h)) return 'specialization';
    // Mentor / Teacher name
    if (['mentorname','teachername','facultyname','guidename','assignedmentor','mentor','teacher','faculty','assignedto','mentorfacultynumber'].includes(h)) return 'mentorName';
    // SR
    if (['sr','srno','sno','serialnumber','no'].includes(h)) return 'sr';
    return h;
  }

  // ── Parse file and resolve matches ────────────────────────────────────
  async function handleAssignFile(file) {
    if (!file) return;
    assignDropLabel.textContent = `⏳ Parsing: ${file.name}…`;
    btnExecuteAssign.disabled = true;

    try {
      const rowsMatrix = await parseImportFile(file);
      if (!rowsMatrix || rowsMatrix.length <= 1) {
        showToast('File is empty or has no data rows.', 'warning');
        assignDropLabel.textContent = 'Click or Drag & Drop Class Register sheet here (.csv, .xlsx, .xls)';
        return;
      }

      const rawHeaders = rowsMatrix[0].map(h => String(h || '').trim());
      const mappedHeaders = rawHeaders.map(h => normalizeAssignHeader(h));

      // Validate required columns exist
      const hasMentor = mappedHeaders.includes('mentorName');
      const hasEnroll = mappedHeaders.includes('enrollmentNo');
      const hasStuName = mappedHeaders.includes('studentName');

      if (!hasMentor) {
        showToast('Could not find a Mentor Name / Teacher Name column in this file.', 'error');
        assignDropLabel.textContent = 'Click or Drag & Drop Class Register sheet here (.csv, .xlsx, .xls)';
        return;
      }
      if (!hasEnroll && !hasStuName) {
        showToast('Could not find Student Name or Enrollment Number column in this file.', 'error');
        assignDropLabel.textContent = 'Click or Drag & Drop Class Register sheet here (.csv, .xlsx, .xls)';
        return;
      }

      assignDropLabel.textContent = `⏳ Loading student, faculty & department data…`;

      // Load all students, faculty, and departments
      const [allStudents, allFaculty, depts] = await Promise.all([
        StudentService.getAll(),
        FacultyService.getAll(),
        DepartmentService.getAll()
      ]);

      allSystemDepartments = depts || [];

      // Extract all unique department names present across system
      const knownDeptNames = new Set();
      allSystemDepartments.forEach(d => { if (d.name) knownDeptNames.add(d.name.trim()); });
      allStudents.forEach(s => { if (s.department) knownDeptNames.add(s.department.trim()); });
      allFaculty.forEach(f => { if (f.department) knownDeptNames.add(f.department.trim()); });
      if (!knownDeptNames.size) knownDeptNames.add('Computer Engineering');

      // Build lookup maps
      // Students: enrollment (lowercase) → student object
      const studentByEnroll = new Map();
      // Students: normalized name (lowercase trimmed) → student object (fallback)
      const studentByName = new Map();
      allStudents.forEach(s => {
        const en = (s.enrollmentNumber || '').toLowerCase().trim();
        if (en) studentByEnroll.set(en, s);
        const nm = (s.name || '').toLowerCase().replace(/\s+/g, ' ').trim();
        if (nm) studentByName.set(nm, s);
      });

      // Helper to strip honorifics & extra spaces from names for comparison
      function cleanPersonName(raw) {
        if (!raw) return '';
        return String(raw)
          .toLowerCase()
          .replace(/\b(dr|prof|mr|mrs|ms|er|doc|professor|doctor)\b\.?/gi, '')
          .replace(/[^a-z0-9\s]/gi, ' ')
          .replace(/\s+/g, ' ')
          .trim();
      }

      // Faculty: normalized name → faculty object
      const facultyByName = new Map();
      const cleanedFacultyList = [];
      allFaculty.forEach(f => {
        const rawNm = (f.name || '').toLowerCase().replace(/\s+/g, ' ').trim();
        const cleanNm = cleanPersonName(f.name);
        if (rawNm) facultyByName.set(rawNm, f);
        if (cleanNm) {
          facultyByName.set(cleanNm, f);
          cleanedFacultyList.push({ cleanNm, rawNm, obj: f });
        }
      });

      function findMentorMatch(searchName) {
        if (!searchName) return null;
        const norm = searchName.toLowerCase().replace(/\s+/g, ' ').trim();
        const clean = cleanPersonName(searchName);

        // 1. Direct match
        if (facultyByName.has(norm)) return facultyByName.get(norm);
        if (clean && facultyByName.has(clean)) return facultyByName.get(clean);

        // 2. Partial substring match
        for (const item of cleanedFacultyList) {
          if (clean && item.cleanNm && (item.cleanNm.includes(clean) || clean.includes(item.cleanNm))) {
            return item.obj;
          }
        }

        // 3. Word token overlap match (e.g. "Suresh Kumar" matches "Suresh V. Kumar")
        if (clean) {
          const cleanTokens = clean.split(' ').filter(t => t.length > 1);
          if (cleanTokens.length > 0) {
            for (const item of cleanedFacultyList) {
              const facTokens = item.cleanNm.split(' ').filter(t => t.length > 1);
              const matches = cleanTokens.filter(t => facTokens.includes(t));
              if (matches.length >= Math.min(2, cleanTokens.length)) {
                return item.obj;
              }
            }
          }
        }
        return null;
      }

      // Parse rows with Forward-Fill support for Mentor Names
      assignRows = [];
      let lastSeenMentorName = '';
      const rawSpecCounts = new Map(); // spec string -> count of students

      const seenSheetKeys = new Set();

      for (let i = 1; i < rowsMatrix.length; i++) {
        const cols = rowsMatrix[i].map(c => String(c !== null && c !== undefined ? c : '').trim());
        const rowData = {};
        mappedHeaders.forEach((key, idx) => { rowData[key] = cols[idx] || ''; });

        const rawStudentName = rowData.studentName || '';
        const rawEnroll = rowData.enrollmentNo || '';
        let rawMentorName = rowData.mentorName || '';
        const rawEmail = rowData.email || '';
        const rawMobile = rowData.mobileNumber || '';
        const rawFatherContact = rowData.fatherContact || '';
        const rawSpec = rowData.specialization || '';
        const rawBatch = rowData.batch || '';
        const rawPracticalBatch = rowData.practicalBatch || '';
        const rawRollNo = rowData.rollNo || '';
        const rawRollNoBatch = rowData.rollNoBatch || '';

        // Skip completely empty rows
        if (!rawStudentName && !rawEnroll && !rawMentorName) continue;

        // In-sheet deduplication: prevent identical student rows in the same uploaded workbook
        const normKey = (rawEnroll || rawEmail || rawStudentName).toLowerCase().trim();
        if (normKey && seenSheetKeys.has(normKey)) {
          continue; // Skip duplicate row within same sheet
        }
        if (normKey) seenSheetKeys.add(normKey);

        // Track specialization count
        const specKey = rawSpec || 'Not Specified';
        rawSpecCounts.set(specKey, (rawSpecCounts.get(specKey) || 0) + 1);

        // FORWARD-FILL: If mentor name is empty on this row but we have a student, reuse last seen mentor name!
        if (!rawMentorName && (rawStudentName || rawEnroll) && lastSeenMentorName) {
          rawMentorName = lastSeenMentorName;
        } else if (rawMentorName) {
          lastSeenMentorName = rawMentorName;
        }

        // Match student: prefer enrollment number
        let matchedStudent = null;
        const normEnroll = rawEnroll.toLowerCase().trim();
        if (normEnroll) matchedStudent = studentByEnroll.get(normEnroll) || null;
        // Fallback: match by name
        if (!matchedStudent && rawStudentName) {
          const normName = cleanPersonName(rawStudentName);
          if (normName) {
            matchedStudent = studentByName.get(normName) || null;
            if (!matchedStudent) {
              for (const [sNm, sObj] of studentByName.entries()) {
                if (cleanPersonName(sNm) === normName) {
                  matchedStudent = sObj;
                  break;
                }
              }
            }
          }
        }

        // Match mentor using robust resolver
        let matchedMentor = findMentorMatch(rawMentorName);

        // Determine status
        let status = 'READY_NEW';
        if (!matchedMentor) {
          status = 'NO_MENTOR';
        } else if (matchedStudent) {
          if (matchedStudent.mentorId && matchedStudent.mentorId === matchedMentor.id) {
            status = 'ALREADY';
          } else {
            status = 'READY_EXISTING';
          }
        } else {
          status = 'READY_NEW';
        }

        assignRows.push({
          sr: i,
          rawStudentName,
          rawEnroll,
          rawMentorName,
          rawEmail,
          rawMobile,
          rawFatherContact,
          rawSpec,
          rawBatch,
          rawPracticalBatch,
          rawRollNo,
          rawRollNoBatch,
          matchedStudent,
          matchedMentor,
          status
        });
      }

      if (assignRows.length === 0) {
        showToast('No data rows found in file.', 'warning');
        assignDropLabel.textContent = 'Click or Drag & Drop Class Register sheet here (.csv, .xlsx, .xls)';
        return;
      }

      // Build department mapping configuration
      sheetSpecializations = Array.from(rawSpecCounts.keys());
      deptMapping = {};

      const existingDeptList = Array.from(knownDeptNames);

      sheetSpecializations.forEach(spec => {
        if (spec === 'Not Specified') {
          // If not specified, default to first available department or mentor's department
          deptMapping[spec] = existingDeptList[0] || 'Computer Engineering';
          return;
        }

        // Check if there is an exact or close match in existing departments
        const cleanSpec = spec.toLowerCase().replace(/[^a-z0-9]/g, '');
        let bestMatch = null;

        for (const deptName of existingDeptList) {
          const cleanDept = deptName.toLowerCase().replace(/[^a-z0-9]/g, '');
          if (cleanDept === cleanSpec || cleanDept.includes(cleanSpec) || cleanSpec.includes(cleanDept)) {
            bestMatch = deptName;
            break;
          }
        }

        // Also check if CSE/Computer specialization maps to Computer Engineering / CS
        if (!bestMatch) {
          if (cleanSpec.includes('cse') || cleanSpec.includes('comp') || cleanSpec.includes('cs')) {
            bestMatch = existingDeptList.find(d => /comp|cse|it/i.test(d));
          } else if (cleanSpec.includes('mech')) {
            bestMatch = existingDeptList.find(d => /mech/i.test(d));
          } else if (cleanSpec.includes('civil')) {
            bestMatch = existingDeptList.find(d => /civil/i.test(d));
          } else if (cleanSpec.includes('elect')) {
            bestMatch = existingDeptList.find(d => /elect/i.test(d));
          }
        }

        deptMapping[spec] = bestMatch || spec; // If no match, default to the specialization itself
      });

      renderDeptMappingUI(rawSpecCounts, existingDeptList);
      assignDropLabel.textContent = `✅ Loaded: ${file.name} (${assignRows.length} students)`;
      renderAssignPreview();

    } catch (err) {
      console.error('Assign-mentor parse error:', err);
      showToast(err.message || 'Error parsing file', 'error');
      assignDropLabel.textContent = 'Click or Drag & Drop Class Register sheet here (.csv, .xlsx, .xls)';
    }
  }

  // ── Render Department Mapping Card ────────────────────────────────────
  function renderDeptMappingUI(specCounts, existingDeptList) {
    assignDeptMappingList.innerHTML = '';

    sheetSpecializations.forEach(spec => {
      const count = specCounts.get(spec) || 0;
      const currentSelected = deptMapping[spec] || spec;

      const isUnspecified = spec === 'Not Specified';
      const specLabel = isUnspecified ? 'Students without Specialization' : spec;

      // Build options list
      let optionsHtml = '';

      // 1. Existing system departments
      existingDeptList.forEach(deptName => {
        const isSelected = currentSelected === deptName;
        optionsHtml += `<option value="${deptName}" ${isSelected ? 'selected' : ''}>🏛️ ${deptName}</option>`;
      });

      // 2. Option to inherit each student's mentor's department
      optionsHtml += `<option value="USE_MENTOR_DEPT" ${currentSelected === 'USE_MENTOR_DEPT' ? 'selected' : ''}>👤 Inherit Mentor's Department</option>`;

      // 3. Option to create as new department if spec is not already in existingDeptList
      if (!isUnspecified && !existingDeptList.includes(spec)) {
        const isSelected = currentSelected === spec;
        optionsHtml += `<option value="__NEW__:${spec}" ${isSelected ? 'selected' : ''}>➕ Create as new department: "${spec}"</option>`;
      }

      const rowDiv = document.createElement('div');
      rowDiv.style.cssText = 'display:flex;align-items:center;justify-content:space-between;gap:12px;background:var(--bg-primary);padding:10px 14px;border-radius:6px;border:1px solid var(--border);flex-wrap:wrap;';
      rowDiv.innerHTML = `
        <div style="display:flex;align-items:center;gap:8px;">
          <span style="font-weight:600;font-size:0.875rem;color:var(--text-primary);">${specLabel}</span>
          <span class="badge badge-accent" style="font-size:0.75rem;">${count} student${count !== 1 ? 's' : ''}</span>
        </div>
        <div style="display:flex;align-items:center;gap:10px;">
          <label style="font-size:0.78rem;color:var(--text-muted);font-weight:500;">Assign to Department:</label>
          <select class="form-select assign-dept-select" data-spec="${encodeURIComponent(spec)}" style="font-size:0.82rem;padding:5px 10px;min-width:240px;border-color:#6c47ff88;">
            ${optionsHtml}
          </select>
        </div>
      `;
      assignDeptMappingList.appendChild(rowDiv);
    });

    // Wire up change events
    assignDeptMappingList.querySelectorAll('.assign-dept-select').forEach(sel => {
      sel.addEventListener('change', (e) => {
        const targetSpec = decodeURIComponent(e.target.dataset.spec);
        let val = e.target.value;
        if (val.startsWith('__NEW__:')) {
          val = val.replace('__NEW__:', '');
        }
        deptMapping[targetSpec] = val;
        renderAssignPreview();
      });
    });

    assignDeptSection.style.display = 'block';
  }

  // ── Helper to resolve effective target department for a row ───────────
  function getRowTargetDepartment(row) {
    const specKey = row.rawSpec || 'Not Specified';
    const mapped = deptMapping[specKey];
    if (mapped === 'USE_MENTOR_DEPT') {
      return row.matchedMentor?.department || row.rawSpec || 'General';
    }
    return mapped || row.rawSpec || row.matchedMentor?.department || 'General';
  }

  // ── Render preview table ──────────────────────────────────────────────
  function renderAssignPreview() {
    const overrideExisting = assignOverrideChk.checked;
    assignPreviewTbody.innerHTML = '';

    let countNew = 0, countExisting = 0, countAlready = 0, countNoMentor = 0;

    assignRows.forEach((row, idx) => {
      const targetDept = getRowTargetDepartment(row);

      // Determine effective status
      let effectiveStatus = row.status;
      if (row.status === 'ALREADY' && overrideExisting && row.matchedMentor) {
        effectiveStatus = 'READY_EXISTING';
      }

      if (effectiveStatus === 'READY_NEW') countNew++;
      else if (effectiveStatus === 'READY_EXISTING') countExisting++;
      else if (effectiveStatus === 'ALREADY') countAlready++;
      else if (effectiveStatus === 'NO_MENTOR') countNoMentor++;

      const statusBadge = {
        READY_NEW:      `<span class="badge" style="background:linear-gradient(135deg,#a855f7,#ec4899);color:#fff;border:none;">✨ Auto-Register &amp; Assign</span>`,
        READY_EXISTING: `<span class="badge badge-success">🔗 Assign Existing</span>`,
        ALREADY:        `<span class="badge badge-info">ℹ Already Assigned (Skip)</span>`,
        NO_MENTOR:      `<span class="badge badge-warning">⚠ Mentor Not Found</span>`
      }[effectiveStatus] || `<span class="badge badge-muted">?</span>`;

      // Student contact info
      const contactInfo = `
        <div style="font-size:0.75rem;">
          ${row.rawMobile ? `<span title="Student Mobile">📱 ${escapeHtml(row.rawMobile)}</span><br>` : ''}
          ${row.rawEmail ? `<span style="color:var(--text-muted);" title="Student Email">✉ ${escapeHtml(row.rawEmail)}</span>` : '<span style="color:var(--text-muted);font-style:italic;">Email will be auto-generated</span>'}
        </div>
      `;

      // Batch / Roll info
      const batchInfo = [
        row.rawBatch ? `Batch: ${escapeHtml(row.rawBatch)}` : '',
        row.rawPracticalBatch ? `Prac: ${escapeHtml(row.rawPracticalBatch)}` : '',
        row.rawRollNo ? `Roll: ${escapeHtml(row.rawRollNo)}` : '',
        row.rawRollNoBatch ? `(${escapeHtml(row.rawRollNoBatch)})` : ''
      ].filter(Boolean).join(' · ') || '—';

      // Department badge with difference indicator if mentor dept is different
      const mentorDept = row.matchedMentor?.department || '';
      const isDeptDiff = mentorDept && targetDept && mentorDept.toLowerCase() !== targetDept.toLowerCase();

      const deptCell = `
        <div>
          <span class="badge badge-secondary" style="font-weight:600;font-size:0.75rem;">🏛️ ${escapeHtml(targetDept)}</span>
          ${isDeptDiff ? `<br><span style="color:var(--warning,#f59e0b);font-size:0.7rem;" title="Mentor belongs to ${escapeHtml(mentorDept)}">⚠ Mentor in ${escapeHtml(mentorDept)}</span>` : ''}
        </div>
      `;

      // Mentor info
      const mentorCell = row.matchedMentor
        ? `<div>
             <span style="color:var(--success,#22c55e);font-weight:600;">${escapeHtml(row.matchedMentor.name || '—')}</span>
             <br><span style="color:var(--text-muted);font-size:0.72rem;">${escapeHtml(row.matchedMentor.department || '')}</span>
           </div>`
        : (row.rawMentorName
            ? `<span style="color:var(--warning,#f59e0b);font-size:0.8rem;">⚠ "${escapeHtml(row.rawMentorName)}" (Not found)</span>`
            : `<span style="color:var(--text-muted);">—</span>`);

      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td style="color:var(--text-muted);">${escapeHtml(String(row.sr))}</td>
        <td>
          <strong>${escapeHtml(row.rawStudentName || '—')}</strong>
          ${row.matchedStudent ? `<span class="badge badge-info" style="font-size:0.65rem;margin-left:4px;">Existing</span>` : `<span class="badge badge-accent" style="font-size:0.65rem;margin-left:4px;">New</span>`}
        </td>
        <td style="font-family:monospace;font-size:0.78rem;color:var(--text-secondary);">${escapeHtml(row.rawEnroll || '—')}</td>
        <td>${contactInfo}</td>
        <td style="font-size:0.78rem;">${row.rawFatherContact ? `👨 <strong>${escapeHtml(row.rawFatherContact)}</strong>` : '<span style="color:var(--text-muted);">—</span>'}</td>
        <td style="font-size:0.75rem;color:var(--text-secondary);">${batchInfo}</td>
        <td>${deptCell}</td>
        <td>${mentorCell}</td>
        <td>${statusBadge}</td>
      `;
      assignPreviewTbody.appendChild(tr);
    });

    // Update stats bar
    const statNewEl = document.getElementById('assign-stat-new');
    const statMatchedEl = document.getElementById('assign-stat-matched');
    const statAlreadyEl = document.getElementById('assign-stat-already');
    const statNoMentorEl = document.getElementById('assign-stat-nomentor');
    const statTotalEl = document.getElementById('assign-stat-total');

    if (statNewEl) statNewEl.textContent = `✨ ${countNew} new to register & assign`;
    if (statMatchedEl) statMatchedEl.textContent = `🔗 ${countExisting} existing to assign`;
    if (statAlreadyEl) statAlreadyEl.textContent = `ℹ ${countAlready} already assigned`;
    if (statNoMentorEl) statNoMentorEl.textContent = `⚠ ${countNoMentor} mentor not found`;
    if (statTotalEl) statTotalEl.textContent = `${assignRows.length} total rows`;

    assignStatsBar.style.display = 'flex';
    assignPreviewWrap.style.display = 'block';

    const totalToProcess = countNew + countExisting;
    btnExecuteAssign.disabled = totalToProcess === 0;
  }

  // Re-render preview when override checkbox changes
  assignOverrideChk?.addEventListener('change', () => {
    if (assignRows.length > 0) renderAssignPreview();
  });

  // ── Execute assignment & auto-registration ────────────────────────────
  btnExecuteAssign?.addEventListener('click', async () => {
    const overrideExisting = assignOverrideChk.checked;

    // Collect rows to process
    const toProcess = assignRows.filter(row => {
      if (!row.matchedMentor) return false;
      if (row.status === 'READY_NEW') return true;
      if (row.status === 'READY_EXISTING') return true;
      if (row.status === 'ALREADY' && overrideExisting) return true;
      return false;
    });

    if (!toProcess.length) {
      showToast('No valid students to register or assign.', 'info');
      return;
    }

    btnExecuteAssign.disabled = true;
    btnExecuteAssign.innerHTML = '<div class="spinner" style="width:14px;height:14px;border-width:2px;"></div> Processing…';

    // Show Progress Modal
    const progressHtml = `
      <div id="assign-progress-modal" class="modal-backdrop" style="display:flex;z-index:10000;background:rgba(0,0,0,0.7);">
        <div class="modal" style="max-width:440px;text-align:center;padding:28px;">
          <h3 style="margin-bottom:6px;">🔗 Processing Class Register…</h3>
          <p style="font-size:0.875rem;color:var(--text-secondary);margin-bottom:4px;" id="assign-prog-text">Starting…</p>
          <p style="font-size:0.8rem;color:var(--text-muted);margin-bottom:14px;" id="assign-prog-detail">&nbsp;</p>
          <div style="height:12px;background:var(--bg-secondary);border-radius:6px;overflow:hidden;margin-bottom:12px;">
            <div id="assign-prog-bar" style="height:100%;width:0%;background:linear-gradient(90deg,#6c47ff,#a855f7);transition:width 0.15s ease;"></div>
          </div>
          <div style="display:flex;justify-content:space-between;font-size:0.75rem;color:var(--text-muted);">
            <span id="assign-prog-new-cnt" style="color:var(--accent);">✨ 0 registered</span>
            <span id="assign-prog-exist-cnt" style="color:var(--success);">🔗 0 assigned</span>
            <span id="assign-prog-fail-cnt" style="color:var(--danger);">✗ 0 failed</span>
          </div>
        </div>
      </div>
    `;
    document.body.insertAdjacentHTML('beforeend', progressHtml);
    const progText = document.getElementById('assign-prog-text');
    const progDetail = document.getElementById('assign-prog-detail');
    const progBar = document.getElementById('assign-prog-bar');
    const progNewCnt = document.getElementById('assign-prog-new-cnt');
    const progExistCnt = document.getElementById('assign-prog-exist-cnt');
    const progFailCnt = document.getElementById('assign-prog-fail-cnt');

    let newRegisteredCount = 0;
    let existingAssignedCount = 0;
    let failCount = 0;

    // Check if any mapped departments need to be created in Firestore
    const existingDeptNames = new Set(allSystemDepartments.map(d => (d.name || '').toLowerCase().trim()));
    for (const spec of sheetSpecializations) {
      const targetDept = deptMapping[spec];
      if (targetDept && targetDept !== 'USE_MENTOR_DEPT' && !existingDeptNames.has(targetDept.toLowerCase().trim())) {
        try {
          await DepartmentService.create({
            name: targetDept,
            code: targetDept.replace(/[^A-Z0-9]/gi, '').slice(0, 6).toUpperCase(),
            type: 'Academic',
            hodName: ''
          });
          existingDeptNames.add(targetDept.toLowerCase().trim());
        } catch (dErr) {
          console.warn('Could not create department doc:', dErr);
        }
      }
    }

    const { AdminService, StudentService } = await import('/js/services.js');

    for (let i = 0; i < toProcess.length; i++) {
      const row = toProcess[i];
      const targetDept = getRowTargetDepartment(row);
      const studentName = row.rawStudentName || row.rawEnroll || 'Student';

      const pct = Math.round(((i + 1) / toProcess.length) * 100);
      if (progText) progText.textContent = `Processing ${i + 1} of ${toProcess.length} (${pct}%)`;
      if (progDetail) progDetail.textContent = `↳ ${studentName} → ${row.matchedMentor.name}`;
      if (progBar) progBar.style.width = `${pct}%`;

      try {
        if (row.matchedStudent) {
          // EXISTING STUDENT: Assign or reassign mentor
          if (row.matchedStudent.mentorId && row.matchedStudent.mentorId !== row.matchedMentor.id) {
            await StudentService.reassignMentor(
              row.matchedStudent.id,
              row.matchedMentor.id,
              'Admin (Class Register Import)',
              'Reassigned via Class Register Import'
            );
          } else {
            await StudentService.assignMentor(
              row.matchedStudent.id,
              row.matchedMentor.id,
              'Admin (Class Register Import)',
              'BULK_SHEET'
            );
          }

          // Also update department if student had none
          if (!row.matchedStudent.department && targetDept) {
            try {
              await StudentService.update(row.matchedStudent.id, { department: targetDept });
            } catch (_) {}
          }

          // Update local cache
          const cached = allUsers.find(u => u.id === row.matchedStudent.id);
          if (cached) {
            cached.mentorId = row.matchedMentor.id;
            if (targetDept && !cached.department) cached.department = targetDept;
          }

          existingAssignedCount++;
          if (progExistCnt) progExistCnt.textContent = `🔗 ${existingAssignedCount} assigned`;

        } else {
          // NEW STUDENT: Auto-register student with all class register details + assign mentor
          let cleanEmail = (row.rawEmail || '').toLowerCase().trim();
          if (!cleanEmail || !cleanEmail.includes('@')) {
            const cleanEnroll = (row.rawEnroll || '').toLowerCase().replace(/[^a-z0-9]/g, '');
            cleanEmail = cleanEnroll ? `${cleanEnroll}@university.edu` : `student.${Date.now()}.${i}@university.edu`;
          }

          let cleanMobile = (row.rawMobile || '').replace(/[^0-9]/g, '').trim();
          if (!cleanMobile) cleanMobile = '9876543210';
          const pass = cleanMobile.length >= 6 ? cleanMobile : ((row.rawEnroll || '123456').padEnd(6, '0'));

          const newProfile = await AdminService.createUser({
            role: 'STUDENT',
            name: row.rawStudentName || row.rawEnroll,
            email: cleanEmail,
            mobileNumber: cleanMobile,
            password: pass,
            enrollmentNumber: row.rawEnroll,
            department: targetDept,
            specialization: row.rawSpec || targetDept,
            class: row.rawBatch || row.rawPracticalBatch || row.rawRollNoBatch || '',
            rollNumber: row.rawRollNo || '',
            batch: row.rawBatch || '',
            practicalBatch: row.rawPracticalBatch || '',
            fatherContact: row.rawFatherContact || '',
            mentorId: row.matchedMentor.id,
            allocatedBy: 'Admin (Class Register Import)',
            allocationType: 'BULK_SHEET'
          });

          if (newProfile) {
            allUsers.unshift({ ...newProfile, role: 'STUDENT' });
          }

          newRegisteredCount++;
          if (progNewCnt) progNewCnt.textContent = `✨ ${newRegisteredCount} registered`;
        }

      } catch (err) {
        console.error(`Failed for student "${studentName}":`, err);
        failCount++;
        if (progFailCnt) progFailCnt.textContent = `✗ ${failCount} failed`;
      }

      if ((i + 1) % 4 === 0) await new Promise(r => setTimeout(r, 0));
    }

    document.getElementById('assign-progress-modal')?.remove();
    assignModal.style.display = 'none';
    resetAssignModal();
    btnExecuteAssign.disabled = false;
    btnExecuteAssign.innerHTML = '🔗 Auto-Register &amp; Assign Mentors';

    const totalSuccess = newRegisteredCount + existingAssignedCount;
    const msg = `Done! ${newRegisteredCount} new students registered & assigned, ${existingAssignedCount} existing students updated.${failCount ? ` (${failCount} failed)` : ''}`;
    showToast(msg, totalSuccess > 0 ? 'success' : 'error');

    if (totalSuccess > 0) {
      renderTable();
    }
  });

}

