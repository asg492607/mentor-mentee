import { api } from '/js/api.js';
import { getUserProfile } from '/js/auth.js';
import { createSidebar } from '/js/components/sidebar.js';
import { createHeader } from '/js/components/header.js';

const MOCK_USERS = [
  { id:'u1', name:'Ravi Kumar',   email:'ravi@uni.edu',   role:'STUDENT', department:'Computer Science', status:'active' },
  { id:'u2', name:'Priya Singh',  email:'priya@uni.edu',  role:'STUDENT', department:'Computer Science', status:'active' },
  { id:'u3', name:'Dr. Shah',     email:'shah@uni.edu',   role:'FACULTY', department:'Computer Science', status:'active' },
  { id:'u4', name:'Dr. Gupta',    email:'gupta@uni.edu',  role:'FACULTY', department:'Computer Science', status:'active' },
  { id:'u5', name:'Dr. HOD',      email:'hod@uni.edu',    role:'HOD',     department:'Computer Science', status:'active' },
  { id:'u6', name:'Dean Singh',   email:'dean@uni.edu',   role:'DEAN',    department:'All', status:'active' },
];

function roleBadge(r) {
  const map = {STUDENT:'badge-info',FACULTY:'badge-accent',HOD:'badge-warning',DEAN:'badge-danger',ADMIN:'badge-muted'};
  return `<span class="badge ${map[r]||'badge-muted'}">${r}</span>`;
}

export async function render(container) {
  const user = getUserProfile();
  let users = MOCK_USERS;
  let search = '';
  let filterRole = 'ALL';

  container.innerHTML = `
    <div class="dashboard-layout fade-in">
      ${createSidebar(user.role, '/admin/users')}
      <div class="main-content">
        ${createHeader('User Management', user)}
        <div class="page-content">
          <div style="display:flex;gap:12px;margin-bottom:20px;flex-wrap:wrap;">
            <div class="search-box" style="flex:1;min-width:200px;">
              <svg width="16" height="16" viewBox="0 0 24 24"><path d="M15.5 14h-.79l-.28-.27C15.41 12.59 16 11.11 16 9.5 16 5.91 13.09 3 9.5 3S3 5.91 3 9.5 5.91 16 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z"/></svg>
              <input type="text" id="user-search" placeholder="Search by name or email...">
            </div>
            ${['ALL','STUDENT','FACULTY','HOD','DEAN'].map((r,i) =>
              `<button class="btn btn-sm ${i===0?'btn-primary':'btn-secondary'} role-filter" data-role="${r}">${r}</button>`
            ).join('')}
          </div>
          <div class="card" id="users-table"></div>
        </div>
      </div>
    </div>
  `;

  document.getElementById('logout-btn')?.addEventListener('click', async () => {
    const { logout } = await import('/js/auth.js'); await logout();
  });

  try {
    const [s, f] = await Promise.allSettled([api.get('/api/admin/students'), api.get('/api/admin/faculty')]);
    users = [
      ...(s.status === 'fulfilled' ? s.value : []),
      ...(f.status === 'fulfilled' ? f.value : []),
    ];
    if (!users.length) users = MOCK_USERS;
  } catch {}

  function renderTable() {
    const wrap = document.getElementById('users-table');
    let list = users;
    if (filterRole !== 'ALL') list = list.filter(u => u.role === filterRole);
    if (search) list = list.filter(u => u.name.toLowerCase().includes(search) || u.email.toLowerCase().includes(search));

    if (!list.length) {
      wrap.innerHTML = `<div class="empty-state"><h3>No users found</h3></div>`;
      return;
    }

    wrap.innerHTML = `
      <table class="data-table">
        <thead><tr><th>User</th><th>Email</th><th>Role</th><th>Department</th><th>Status</th></tr></thead>
        <tbody>
          ${list.map(u => `
            <tr>
              <td>
                <div style="display:flex;align-items:center;gap:10px;">
                  <div class="avatar avatar-sm">${(u.name||'?')[0]}</div>
                  <span style="font-weight:600;font-size:0.875rem;">${u.name}</span>
                </div>
              </td>
              <td style="color:var(--text-secondary);font-size:0.825rem;">${u.email}</td>
              <td>${roleBadge(u.role)}</td>
              <td style="font-size:0.825rem;">${u.department||'—'}</td>
              <td><span class="badge ${u.status==='active'?'badge-success':'badge-muted'}">${u.status||'active'}</span></td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    `;
  }

  document.getElementById('user-search').addEventListener('input', e => { search = e.target.value.toLowerCase(); renderTable(); });
  document.querySelectorAll('.role-filter').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.role-filter').forEach(b => b.className = 'btn btn-sm btn-secondary role-filter');
      btn.className = 'btn btn-sm btn-primary role-filter';
      filterRole = btn.dataset.role;
      renderTable();
    });
  });

  renderTable();
}
