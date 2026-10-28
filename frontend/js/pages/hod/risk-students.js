// HOD — At-Risk Students
// Tracks students flagged with low attendance, academic difficulty, or critical issues.
import { getUserProfile } from '/js/auth.js';
import { createSidebar } from '/js/components/sidebar.js';
import { createHeader } from '/js/components/header.js';
import { StudentService, StatsService } from '/js/services.js';
import { departmentScope, escapeHtml } from '/js/utils.js';
import { getAttendanceStatus, AttendanceInterventionService } from '/js/services/academic-service.js';
import { showToast } from '/js/components/toast.js';

function riskBadge(r) {
  const cls = {HIGH:'badge-danger',MEDIUM:'badge-warning',LOW:'badge-success'}[r]||'badge-muted';
  return `<span class="badge ${cls}">${escapeHtml(r||'N/A')}</span>`;
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
              <svg width="16" height="16" viewBox="0 0 24 24"><path d="M15.5 14h-.79l-.28-.27A6.471 6.471 0 0 0 16 9.5 6.5 6.5 0 1 0 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z"/></svg>
              <input type="text" id="rs-search" placeholder="Search students...">
            </div>
            ${['ALL','FR','HIGH','MEDIUM','LOW'].map((r,i) =>
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
    let raw = await StudentService.getByDepartment(departmentScope(user));
    // Compute missing risk
    students = raw.map(s => s.riskLevel ? s : { ...s, ...StatsService.computeRisk(s) });
    // Sort by riskScore desc
    students.sort((a,b) => (b.riskScore||0) - (a.riskScore||0));
  } catch (err) {
    (container.querySelector('#rs-table') || {}).innerHTML = `<div class="empty-state"><h3 style="color:var(--danger);">Error: ${err.message}</h3></div>`;
    return;
  }

  function renderTable() {
    const wrap = container.querySelector('#rs-table');
    let list = students;
    if (filter === 'FR') list = list.filter(s => getAttendanceStatus(s).isLow);
    else if (filter !== 'ALL') list = list.filter(s => s.riskLevel === filter);
    if (search) list = list.filter(s => s.name?.toLowerCase().includes(search) || s.enrollmentNumber?.toLowerCase().includes(search));

    if (!list.length) {
      wrap.innerHTML = `<div class="empty-state" style="padding:48px;"><h3>No students match filter</h3></div>`;
      return;
    }

    wrap.innerHTML = `
      <table class="data-table">
        <thead><tr><th>#</th><th>Student</th><th>CGPA</th><th>Attendance</th><th>Latest marks</th><th>Learner band</th><th>Open Issues</th><th>Risk Score</th><th>Level</th><th>Follow-up</th></tr></thead>
        <tbody>
          ${list.map((s,i) => {
            const attendanceStatus = getAttendanceStatus(s);
            const attendance = Math.min(100, Math.max(0, Number(s.attendance) || 0));
            const cgpa = Number(s.cgpa) || 0;
            const riskScore = Math.min(100, Math.max(0, Number(s.riskScore) || 0));
            return `
            <tr>
              <td style="color:var(--text-muted);">${i+1}</td>
              <td>
                <p style="font-weight:600;font-size:0.875rem;">${escapeHtml(s.name || 'Student')}</p>
                <p style="color:var(--text-muted);font-size:0.75rem;">${escapeHtml(s.enrollmentNumber||'')}</p>
              </td>
              <td style="font-weight:600;color:${cgpa<6?'var(--danger)':cgpa<7?'var(--warning)':'inherit'};">${escapeHtml(s.cgpa||'—')}</td>
              <td>
                <div style="display:flex;align-items:center;gap:8px;">
                  <div style="flex:1;max-width:60px;" class="progress-bar-wrap">
                    <div class="progress-bar-fill ${attendanceStatus.isLow ? 'fill-danger' : attendanceStatus.key === 'BELOW_TARGET' ? 'fill-warning' : attendanceStatus.key === 'NOT_RECORDED' ? 'fill-muted' : 'fill-success'}" style="width:${attendance}%"></div>
                  </div>
                  <span style="font-size:0.78rem;color:var(--text-muted);">${attendanceStatus.key === 'NOT_RECORDED' ? 'Not recorded' : `${attendance}%`}${attendanceStatus.isLow ? ' · Low' : attendanceStatus.key === 'BELOW_TARGET' ? ' · Below target' : ''}</span>
                </div>
              </td>
              <td>${s.latestSubjectAverage === null || s.latestSubjectAverage === undefined ? '—' : `${escapeHtml(s.latestSubjectAverage)}%`}</td>
              <td><span class="badge ${s.learnerLevel === 'SLOW' ? 'badge-danger' : s.learnerLevel === 'MEDIUM' ? 'badge-warning' : s.learnerLevel === 'ADVANCED' ? 'badge-success' : 'badge-muted'}">${escapeHtml(s.learnerLevel || 'Not assessed')}</span></td>
              <td>${Number(s.openIssuesCount ?? s.openIssueCount) || 0}</td>
              <td><span style="font-weight:700;font-size:1rem;color:${riskScore>60?'var(--danger)':riskScore>30?'var(--warning)':'var(--success)'};">${riskScore}</span><span style="color:var(--text-muted);font-size:0.75rem;">/100</span></td>
              <td>${riskBadge(s.riskLevel)}</td>
              <td>${attendanceStatus.isLow ? `<button class="btn btn-xs btn-primary rs-fr-meeting" data-student-id="${escapeHtml(s.id)}">Special meeting</button>` : '—'}</td>
            </tr>
          `; }).join('')}
        </tbody>
      </table>
    `;
  }

  container.querySelector('#rs-table').addEventListener('click', async event => {
    const button = event.target.closest('.rs-fr-meeting');
    if (!button) return;
    button.disabled = true;
    try {
      const result = await AttendanceInterventionService.requestMeeting(button.dataset.studentId);
      button.textContent = result.created ? 'Requested' : 'Already requested';
      showToast(result.created ? 'Special FR attendance meeting requested.' : 'An open FR attendance meeting already exists.', result.created ? 'success' : 'info');
    } catch (error) {
      showToast(error.message || 'Could not request the special meeting.', 'error');
      button.disabled = false;
    }
  });

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


