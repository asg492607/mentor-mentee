import { api } from '/js/api.js';
import { getUserProfile } from '/js/auth.js';
import { createSidebar } from '/js/components/sidebar.js';
import { createHeader } from '/js/components/header.js';
import { showToast } from '/js/components/toast.js';

const MOCK_STUDENTS = [
  { id:'s1', name:'Ravi Kumar',   rollNumber:'CS2101', department:'Computer Science', year:2, cgpa:7.2, attendance:82, riskLevel:'MEDIUM', email:'ravi@uni.edu', mentorId:'me' },
  { id:'s2', name:'Priya Singh',  rollNumber:'CS2102', department:'Computer Science', year:3, cgpa:8.9, attendance:91, riskLevel:'LOW',    email:'priya@uni.edu', mentorId:'me' },
  { id:'s3', name:'Arun Mehta',   rollNumber:'CS2103', department:'Computer Science', year:2, cgpa:5.1, attendance:61, riskLevel:'HIGH',   email:'arun@uni.edu', mentorId:'me' },
  { id:'s4', name:'Neha Joshi',   rollNumber:'CS2104', department:'Computer Science', year:4, cgpa:9.1, attendance:95, riskLevel:'LOW',    email:'neha@uni.edu', mentorId:'me' },
  { id:'s5', name:'Kiran Patel',  rollNumber:'CS2105', department:'Computer Science', year:1, cgpa:6.3, attendance:74, riskLevel:'MEDIUM', email:'kiran@uni.edu', mentorId:'me' },
];

function riskBadge(r) {
  const cls = {HIGH:'badge-danger',MEDIUM:'badge-warning',LOW:'badge-success'}[r]||'badge-muted';
  return `<span class="badge ${cls}">${r||'N/A'}</span>`;
}

export async function render(container) {
  const user = getUserProfile();
  let students = MOCK_STUDENTS;
  let searchTerm = '';
  let filterRisk = 'ALL';

  container.innerHTML = `
    <div class="dashboard-layout fade-in">
      ${createSidebar(user.role, '/mentor/students')}
      <div class="main-content">
        ${createHeader('My Students', user)}
        <div class="page-content">
          <!-- Filters -->
          <div style="display:flex;gap:12px;margin-bottom:20px;flex-wrap:wrap;">
            <div class="search-box" style="flex:1;min-width:200px;">
              <svg width="16" height="16" viewBox="0 0 24 24"><path d="M15.5 14h-.79l-.28-.27C15.41 12.59 16 11.11 16 9.5 16 5.91 13.09 3 9.5 3S3 5.91 3 9.5 5.91 16 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z"/></svg>
              <input type="text" id="search-students" placeholder="Search by name or roll number...">
            </div>
            ${['ALL','HIGH','MEDIUM','LOW'].map((r,i) =>
              `<button class="btn btn-sm ${i===0?'btn-primary':'btn-secondary'} risk-filter" data-risk="${r}">${r}</button>`
            ).join('')}
          </div>

          <!-- Table -->
          <div class="card">
            <div id="students-table-wrap"></div>
          </div>

          <!-- Student Detail Panel -->
          <div id="student-detail" style="display:none;" class="card" style="margin-top:16px;padding:24px;"></div>
        </div>
      </div>
    </div>
  `;

  document.getElementById('logout-btn')?.addEventListener('click', async () => {
    const { logout } = await import('/js/auth.js'); await logout();
  });

  try { students = await api.get('/api/mentor/students'); } catch {}

  function renderTable() {
    const wrap = document.getElementById('students-table-wrap');
    let filtered = students;
    if (searchTerm) filtered = filtered.filter(s => s.name.toLowerCase().includes(searchTerm) || (s.rollNumber||'').toLowerCase().includes(searchTerm));
    if (filterRisk !== 'ALL') filtered = filtered.filter(s => s.riskLevel === filterRisk);

    if (!filtered.length) {
      wrap.innerHTML = `<div class="empty-state"><svg viewBox="0 0 24 24"><path d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5z"/></svg><h3>No students found</h3><p>Adjust your search or filter.</p></div>`;
      return;
    }

    wrap.innerHTML = `
      <table class="data-table">
        <thead><tr>
          <th>Student</th><th>Dept</th><th>Year</th><th>CGPA</th><th>Attendance</th><th>Risk</th><th>Actions</th>
        </tr></thead>
        <tbody>
          ${filtered.map(s => `
            <tr>
              <td>
                <div style="display:flex;align-items:center;gap:10px;">
                  <div class="avatar avatar-sm" style="font-size:0.7rem;">${(s.name||'?')[0]}</div>
                  <div>
                    <p style="font-weight:600;font-size:0.875rem;">${s.name}</p>
                    <p style="color:var(--text-muted);font-size:0.75rem;">${s.rollNumber||''}</p>
                  </div>
                </div>
              </td>
              <td style="font-size:0.825rem;">${s.department||'—'}</td>
              <td>Y${s.year||'?'}</td>
              <td>${s.cgpa||'—'}</td>
              <td>
                <div style="display:flex;align-items:center;gap:8px;">
                  <div style="flex:1;max-width:60px;"><div class="progress-bar-wrap"><div class="progress-bar-fill ${(s.attendance||0)<75?'fill-danger':(s.attendance||0)<85?'fill-warning':'fill-success'}" style="width:${s.attendance||0}%"></div></div></div>
                  <span style="font-size:0.78rem;color:var(--text-muted);">${s.attendance||0}%</span>
                </div>
              </td>
              <td>${riskBadge(s.riskLevel)}</td>
              <td>
                <button class="btn btn-xs btn-secondary view-student-btn" data-id="${s.id}">View</button>
              </td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    `;

    document.querySelectorAll('.view-student-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const s = students.find(x => x.id === btn.dataset.id);
        const panel = document.getElementById('student-detail');
        panel.style.display = 'block';
        panel.style.marginTop = '16px';
        panel.style.padding = '24px';
        panel.innerHTML = `
          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px;">
            <h3 style="font-size:1rem;font-weight:600;margin:0;">${s.name} — Details</h3>
            <button class="btn btn-sm btn-secondary" onclick="document.getElementById('student-detail').style.display='none'">✕ Close</button>
          </div>
          <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:12px;">
            ${[['Email',s.email||'—'],['Roll No',s.rollNumber||'—'],['Department',s.department||'—'],['Year',`Year ${s.year||'?'}`],['CGPA',s.cgpa||'—'],['Attendance',`${s.attendance||0}%`]].map(([l,v])=>`
              <div style="background:var(--bg-secondary);border-radius:var(--radius-md);padding:12px;">
                <p style="font-size:0.72rem;color:var(--text-muted);margin-bottom:4px;">${l}</p>
                <p style="font-weight:600;font-size:0.875rem;">${v}</p>
              </div>
            `).join('')}
          </div>
          <div style="margin-top:12px;display:flex;gap:8px;">
            ${riskBadge(s.riskLevel)}
            <span style="font-size:0.825rem;color:var(--text-secondary);">Risk Level</span>
          </div>
        `;
        panel.scrollIntoView({ behavior: 'smooth' });
      });
    });
  }

  document.getElementById('search-students').addEventListener('input', e => {
    searchTerm = e.target.value.toLowerCase();
    renderTable();
  });

  document.querySelectorAll('.risk-filter').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.risk-filter').forEach(b => b.className = 'btn btn-sm btn-secondary risk-filter');
      btn.className = 'btn btn-sm btn-primary risk-filter';
      filterRisk = btn.dataset.risk;
      renderTable();
    });
  });

  renderTable();
}
