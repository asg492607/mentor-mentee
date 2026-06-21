import { getUserProfile } from '/js/auth.js';
import { createSidebar } from '/js/components/sidebar.js';
import { createHeader } from '/js/components/header.js';
import { StudentService, StatsService } from '/js/services.js';

function riskBadge(r) {
  const cls = {HIGH:'badge-danger',MEDIUM:'badge-warning',LOW:'badge-success'}[r]||'badge-muted';
  return `<span class="badge ${cls}">${r||'N/A'}</span>`;
}

export async function render(container) {
  const user = getUserProfile();

  container.innerHTML = `
    <div class="dashboard-layout fade-in">
      ${createSidebar(user.role, '/hod/risk-students')}
      <div class="main-content">
        ${createHeader('Risk Students', user)}
        <div class="page-content">
          <div style="display:flex;gap:12px;margin-bottom:20px;flex-wrap:wrap;">
            <div class="search-box" style="flex:1;min-width:200px;">
              <svg width="16" height="16" viewBox="0 0 24 24"><path d="M15.5 14h-.79l-.28-.27C15.41 12.59 16 11.11 16 9.5 16 5.91 13.09 3 9.5 3S3 5.91 3 9.5 5.91 16 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z"/></svg>
              <input type="text" id="rs-search" placeholder="Search students...">
            </div>
            ${['ALL','HIGH','MEDIUM','LOW'].map((r,i) =>
              `<button class="btn btn-sm ${i===0?'btn-primary':'btn-secondary'} rf" data-r="${r}">${r}</button>`
            ).join('')}
          </div>
          <div class="card" id="rs-table">
            <div style="display:flex;justify-content:center;padding:60px;"><div class="spinner"></div></div>
          </div>
        </div>
      </div>
    </div>
  `;

  let students = [];
  let search   = '';
  let filter   = 'ALL';

  try {
    let raw = await StudentService.getByDepartment(user.department);
    // Compute missing risk
    students = raw.map(s => s.riskLevel ? s : { ...s, ...StatsService.computeRisk(s) });
    // Sort by riskScore desc
    students.sort((a,b) => (b.riskScore||0) - (a.riskScore||0));
  } catch (err) {
    (container.querySelector('#rs-table') || {}).innerHTML = `<div class="empty-state"><h3 style="color:var(--danger);">Error: ${err.message}</h3></div>`;
    return;
  }

  function renderTable() {
    const wrap = document.getElementById('rs-table');
    let list = students;
    if (filter !== 'ALL') list = list.filter(s => s.riskLevel === filter);
    if (search) list = list.filter(s => s.name?.toLowerCase().includes(search) || s.rollNumber?.toLowerCase().includes(search));

    if (!list.length) {
      wrap.innerHTML = `<div class="empty-state" style="padding:48px;"><h3>No students match filter</h3></div>`;
      return;
    }

    wrap.innerHTML = `
      <table class="data-table">
        <thead><tr><th>#</th><th>Student</th><th>CGPA</th><th>Attendance</th><th>Open Issues</th><th>Risk Score</th><th>Level</th></tr></thead>
        <tbody>
          ${list.map((s,i) => `
            <tr>
              <td style="color:var(--text-muted);">${i+1}</td>
              <td>
                <p style="font-weight:600;font-size:0.875rem;">${s.name}</p>
                <p style="color:var(--text-muted);font-size:0.75rem;">${s.rollNumber||''}</p>
              </td>
              <td style="font-weight:600;color:${(s.cgpa||0)<6?'var(--danger)':(s.cgpa||0)<7?'var(--warning)':'inherit'};">${s.cgpa||'—'}</td>
              <td>
                <div style="display:flex;align-items:center;gap:8px;">
                  <div style="flex:1;max-width:60px;" class="progress-bar-wrap">
                    <div class="progress-bar-fill ${(s.attendance||0)<75?'fill-danger':'fill-warning'}" style="width:${s.attendance||0}%"></div>
                  </div>
                  <span style="font-size:0.78rem;color:var(--text-muted);">${s.attendance||0}%</span>
                </div>
              </td>
              <td>${s.openIssueCount||0}</td>
              <td><span style="font-weight:700;font-size:1rem;color:${(s.riskScore||0)>60?'var(--danger)':(s.riskScore||0)>30?'var(--warning)':'var(--success)'};">${s.riskScore||0}</span><span style="color:var(--text-muted);font-size:0.75rem;">/100</span></td>
              <td>${riskBadge(s.riskLevel)}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    `;
  }

  document.getElementById('rs-search').addEventListener('input', e => { search = e.target.value.toLowerCase(); renderTable(); });
  document.querySelectorAll('.rf').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.rf').forEach(b => b.className = 'btn btn-sm btn-secondary rf');
      btn.className = 'btn btn-sm btn-primary rf';
      filter = btn.dataset.r; renderTable();
    });
  });

  renderTable();
}

