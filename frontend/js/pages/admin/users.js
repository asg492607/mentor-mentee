import { getUserProfile } from '/js/auth.js';
import { createSidebar } from '/js/components/sidebar.js';
import { createHeader } from '/js/components/header.js';
import { StudentService, FacultyService, AdminService } from '/js/services.js';
import { showToast } from '/js/components/toast.js';
import { parseImportFile, isRowObjectEmpty } from '/js/excel-import.js';

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
              <button class="btn btn-secondary btn-sm" id="btn-export-students" title="Export Students CSV (Email & Password/Mobile)">📤 Export Students</button>
              <button class="btn btn-secondary btn-sm" id="btn-export-teachers" title="Export Teachers CSV (Email & Password/Mobile)">📤 Export Teachers</button>
              <button class="btn btn-secondary btn-sm" id="btn-open-bulk-import">📁 Bulk Import</button>
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

    document.querySelectorAll('.btn-view-profile').forEach(btn =>
      btn.addEventListener('click', (e) => {
        if (window.openUserProfile) window.openUserProfile(e.target.dataset.id);
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
            <input type="file" id="bulk-file-input" accept=".csv, .xlsx, .xls" style="display:none;">
          </div>

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
      deptSel.addEventListener('change', async () => {
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
  roleSel.addEventListener('change', () => {
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
  document.getElementById('admin-add-user-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = document.getElementById('submit-new-user');
    btn.disabled = true; btn.textContent = 'Creating…';
    try {
      const role = roleSel.value;
      const data = {
        role,
        name:       document.getElementById('new-user-name').value.trim(),
        email:      document.getElementById('new-user-email').value.trim(),
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

      const { AdminService, FacultyService: FacSvc } = await import('/js/services.js');
      const newUser = await AdminService.createUser(data);

      // Increment mentor's student count if one was chosen
      if (role === 'STUDENT' && data.mentorId) {
        try {
          const mentor = await FacSvc.get(data.mentorId);
          await FacSvc.update(data.mentorId, {
            assignedStudentCount: (mentor?.assignedStudentCount || 0) + 1
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

  if (btnOpenBulk) {
    btnOpenBulk.addEventListener('click', () => {
      bulkModal.style.display = 'flex';
    });
  }

  closeBulk.addEventListener('click', () => { bulkModal.style.display = 'none'; resetBulkModal(); });
  cancelBulk.addEventListener('click', () => { bulkModal.style.display = 'none'; resetBulkModal(); });

  document.querySelectorAll('.bulk-role-tab').forEach(tab => {
    tab.addEventListener('click', (e) => {
      document.querySelectorAll('.bulk-role-tab').forEach(t => t.className = 'btn btn-sm btn-secondary bulk-role-tab');
      e.target.className = 'btn btn-sm btn-primary bulk-role-tab';
      selectedBulkRole = e.target.dataset.role;
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
  dropZone.addEventListener('click', () => fileInput.click());
  dropZone.addEventListener('dragover', (e) => { e.preventDefault(); dropZone.style.borderColor = 'var(--accent)'; });
  dropZone.addEventListener('dragleave', () => { dropZone.style.borderColor = 'var(--border)'; });
  dropZone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropZone.style.borderColor = 'var(--border)';
    if (e.dataTransfer.files.length) {
      fileInput.files = e.dataTransfer.files;
      handleFileSelected(e.dataTransfer.files[0]);
    }
  });

  fileInput.addEventListener('change', (e) => {
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
        <td><strong>${row.name || '—'}</strong></td>
        <td>${row.enrollmentNumber || '—'}</td>
        <td>${row.email || '—'}</td>
        <td>${row.mobileNumber || '—'}</td>
        <td>${row.department || '—'}</td>
        <td>${roleBadge(activeRole)}</td>
        <td>
          <span class="badge ${isReady ? 'badge-success' : isDup ? 'badge-warning' : 'badge-danger'}">
            ${isReady ? 'Ready' : row.errorMsg}
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

  btnExecuteBulk.addEventListener('click', async () => {
    const validRows = parsedRows.filter(r => r.status === 'Ready');
    if (!validRows.length) return;

    btnExecuteBulk.disabled = true;
    btnExecuteBulk.innerHTML = '<div class="spinner" style="width:16px;height:16px;border-width:2px;"></div> Importing...';

    // Show Progress Bar
    const progressModalHtml = `
      <div id="bulk-progress-modal" class="modal-backdrop" style="display:flex;z-index:10000;background:rgba(0,0,0,0.6);">
        <div class="modal" style="max-width:420px;text-align:center;padding:24px;">
          <h3 style="margin-bottom:8px;">Importing Users...</h3>
          <p style="font-size:0.875rem;color:var(--text-secondary);margin-bottom:16px;" id="progress-status-text">Processing (0 / ${validRows.length})...</p>
          <div class="progress-bar-wrap" style="height:12px;margin-bottom:16px;background:var(--bg-secondary);border-radius:6px;overflow:hidden;">
            <div class="progress-bar-fill fill-accent" id="progress-bar-fill" style="width:0%;height:100%;background:var(--accent);transition:width 0.2s;"></div>
          </div>
          <p style="font-size:0.75rem;color:var(--text-muted);">Email = Username | Mobile = Password. Duplicates are skipped automatically.</p>
        </div>
      </div>
    `;
    document.body.insertAdjacentHTML('beforeend', progressModalHtml);
    const progressModal = document.getElementById('bulk-progress-modal');
    const statusText = document.getElementById('progress-status-text');
    const barFill = document.getElementById('progress-bar-fill');

    let successCount = 0;
    let duplicateCount = 0;
    let failCount = 0;

    const { AdminService } = await import('/js/services.js');
    const existingEmailsInDb = new Set(allUsers.map(u => (u.email || '').toLowerCase().trim()).filter(Boolean));

    for (let i = 0; i < validRows.length; i++) {
      const row = validRows[i];
      const targetRole = selectedBulkRole === 'AUTO' ? row.role : selectedBulkRole;
      const cleanEmail = (row.email || '').toLowerCase().trim();

      if (existingEmailsInDb.has(cleanEmail)) {
        console.log(`Skipping duplicate account: ${cleanEmail}`);
        duplicateCount++;
        continue;
      }

      try {
        const payload = {
          role: targetRole,
          name: row.name,
          email: row.email,
          password: row.mobileNumber, // Mobile number as password
          mobileNumber: row.mobileNumber,
          department: row.department || null,
          enrollmentNumber: row.enrollmentNumber,
          employeeId: row.enrollmentNumber,
          class: row.class,
          year: row.year,
          designation: row.designation
        };

        const newUser = await AdminService.createUser(payload);
        allUsers.unshift({ ...newUser, isApproved: true, status: 'approved' });
        existingEmailsInDb.add(cleanEmail);
        successCount++;
      } catch (err) {
        console.error(`Failed to import user ${row.email}:`, err);
        if (err.code === 'auth/email-already-in-use' || String(err.message || '').includes('already in use')) {
          duplicateCount++;
        } else {
          failCount++;
        }
      }

      const processed = i + 1;
      const percent = Math.round((processed / validRows.length) * 100);
      if (statusText) statusText.textContent = `Processing (${processed} / ${validRows.length})...`;
      if (barFill) barFill.style.width = `${percent}%`;

      if (processed % 5 === 0) {
        await new Promise(r => setTimeout(r, 0));
      }
    }

    progressModal?.remove();
    bulkModal.style.display = 'none';
    resetBulkModal();
    btnExecuteBulk.disabled = false;
    btnExecuteBulk.textContent = 'Import Users';

    const msg = `Bulk Import Finished! ${successCount} accounts created successfully. ${duplicateCount ? duplicateCount + ' duplicates skipped. ' : ''}${failCount ? failCount + ' failed.' : ''}`;
    showToast(msg, successCount > 0 ? 'success' : 'info');
    if (successCount > 0) {
      renderTable();
    }
  });
}

