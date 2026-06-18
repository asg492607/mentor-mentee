import { api } from '/js/api.js';
import { getUserProfile } from '/js/auth.js';
import { createSidebar } from '/js/components/sidebar.js';
import { createHeader } from '/js/components/header.js';
import { showToast } from '/js/components/toast.js';

const MOCK = [
  { id:'s1', name:'Arun Mehta',  rollNumber:'CS2103', mentor:'Dr. Shah',  cgpa:5.1, attendance:61, openIssues:2, missedMeetings:3, riskLevel:'HIGH',   riskScore:85 },
  { id:'s2', name:'Kiran Patel', rollNumber:'CS2105', mentor:'Dr. Gupta', cgpa:5.8, attendance:68, openIssues:1, missedMeetings:2, riskLevel:'HIGH',   riskScore:72 },
  { id:'s3', name:'Dev Nair',    rollNumber:'CS2108', mentor:'Dr. Shah',  cgpa:6.0, attendance:70, openIssues:1, missedMeetings:1, riskLevel:'HIGH',   riskScore:65 },
  { id:'s4', name:'Raj Kumar',   rollNumber:'CS2110', mentor:'Dr. Sharma',cgpa:6.5, attendance:74, openIssues:0, missedMeetings:2, riskLevel:'MEDIUM', riskScore:48 },
  { id:'s5', name:'Priya Nair',  rollNumber:'CS2112', mentor:'Dr. Gupta', cgpa:7.0, attendance:78, openIssues:0, missedMeetings:1, riskLevel:'MEDIUM', riskScore:35 },
];

function riskBadge(r) {
  const map = {HIGH:'badge-danger',MEDIUM:'badge-warning',LOW:'badge-success'};
  return `<span class="badge ${map[r]||'badge-muted'}">${r}</span>`;
}

export async function render(container) {
  const user = getUserProfile();
  let students = MOCK;
  let filter = 'ALL';
  let search = '';

  container.innerHTML = `
    <div class="dashboard-layout fade-in">
      ${createSidebar(user.role, '/hod/risk-students')}
      <div class="main-content">
        ${createHeader('Risk Students', user)}
        <div class="page-content">
          <div style="display:flex;gap:12px;margin-bottom:20px;flex-wrap:wrap;">
            <div class="search-box" style="flex:1;min-width:200px;">
              <svg width="16" height="16" viewBox="0 0 24 24"><path d="M15.5 14h-.79l-.28-.27C15.41 12.59 16 11.11 16 9.5 16 5.91 13.09 3 9.5 3S3 5.91 3 9.5 5.91 16 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z"/></svg>
              <input type="text" id="risk-search" placeholder="Search students...">
            </div>
            ${['ALL','HIGH','MEDIUM','LOW'].map((r,i) =>
              `<button class="btn btn-sm ${i===0?'btn-primary':'btn-secondary'} risk-f" data-r="${r}">${r}</button>`
            ).join('')}
          </div>
          <div class="card" id="risk-table-wrap"></div>
        </div>
      </div>
    </div>
  `;

  document.getElementById('logout-btn')?.addEventListener('click', async () => {
    const { logout } = await import('/js/auth.js'); await logout();
  });

  try { students = await api.get('/api/hod/risk-students'); } catch {}

  // Sort by riskScore desc
  students.sort((a,b) => (b.riskScore||0) - (a.riskScore||0));

  function renderTable() {
    const wrap = document.getElementById('risk-table-wrap');
    let list = students;
    if (filter !== 'ALL') list = list.filter(s => s.riskLevel === filter);
    if (search) list = list.filter(s => s.name.toLowerCase().includes(search) || (s.rollNumber||'').toLowerCase().includes(search));

    if (!list.length) {
      wrap.innerHTML = `<div class="empty-state"><h3>No students found</h3></div>`;
      return;
    }

    wrap.innerHTML = `
      <table class="data-table">
        <thead><tr><th>#</th><th>Student</th><th>Mentor</th><th>CGPA</th><th>Attendance</th><th>Missed Meetings</th><th>Open Issues</th><th>Risk Score</th><th>Risk Level</th></tr></thead>
        <tbody>
          ${list.map((s,i) => `
            <tr>
              <td style="color:var(--text-muted);">${i+1}</td>
              <td>
                <p style="font-weight:600;font-size:0.875rem;">${s.name}</p>
                <p style="color:var(--text-muted);font-size:0.75rem;">${s.rollNumber}</p>
              </td>
              <td style="font-size:0.825rem;">${s.mentor||'—'}</td>
              <td>${s.cgpa}</td>
              <td>
                <div style="display:flex;align-items:center;gap:8px;">
                  <div style="flex:1;"><div class="progress-bar-wrap"><div class="progress-bar-fill ${(s.attendance||0)<75?'fill-danger':'fill-warning'}" style="width:${s.attendance||0}%"></div></div></div>
                  <span style="font-size:0.78rem;color:var(--text-muted);width:36px;">${s.attendance||0}%</span>
                </div>
              </td>
              <td>${s.missedMeetings||0}</td>
              <td>${s.openIssues||0}</td>
              <td>
                <div style="display:flex;align-items:center;gap:6px;">
                  <span style="font-weight:700;color:${(s.riskScore||0)>70?'var(--danger)':(s.riskScore||0)>40?'var(--warning)':'var(--success)'};">${s.riskScore||0}</span>
                  <span style="color:var(--text-muted);font-size:0.75rem;">/100</span>
                </div>
              </td>
              <td>${riskBadge(s.riskLevel)}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    `;
  }

  document.getElementById('risk-search').addEventListener('input', e => { search = e.target.value.toLowerCase(); renderTable(); });
  document.querySelectorAll('.risk-f').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.risk-f').forEach(b => b.className = 'btn btn-sm btn-secondary risk-f');
      btn.className = 'btn btn-sm btn-primary risk-f';
      filter = btn.dataset.r;
      renderTable();
    });
  });

  renderTable();
}
