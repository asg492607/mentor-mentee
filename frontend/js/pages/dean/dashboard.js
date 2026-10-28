// Dean — Executive Dashboard
// High-level institutional metrics, cross-department mentoring stats, and alerts.
import { getUserProfile } from '/js/auth.js';
import { createSidebar } from '/js/components/sidebar.js';
import { createHeader } from '/js/components/header.js';
import { StatsService, FacultyService } from '/js/services.js';
import { showToast } from '/js/components/toast.js';
import { exportMentorStudentReport, exportSingleMentorReport } from '/js/report-export.js';
import { escapeHtml } from '/js/utils.js';
import { AttendanceInterventionService } from '/js/services/academic-service.js';

function riskBadge(r) {
  const cls = {HIGH:'badge-danger',MEDIUM:'badge-warning',LOW:'badge-success'}[r]||'badge-muted';
  return `<span class="badge ${cls}">${r||'N/A'}</span>`;
}

const normalized = value => String(value || '').trim().toLowerCase();

function findDepartmentKey(record, departments, map) {
  if (record.departmentId && map.has(record.departmentId)) return record.departmentId;
  const name = normalized(record.department);
  if (!name) return null;
  let matches = departments.filter(department => normalized(department.name) === name);
  if (record.schoolId) matches = matches.filter(department => department.schoolId === record.schoolId);
  else if (record.schoolName) matches = matches.filter(department => normalized(department.schoolName) === normalized(record.schoolName));
  return matches.length === 1 ? matches[0].id : null;
}

function makeDepartmentRow(key, department = {}) {
  return {
    key, name: department.name || 'Unlinked department', school: department.schoolName || '—',
    students: 0, mentors: 0, highRisk: 0, fr: 0, slow: 0, openIssues: 0,
    cgpaSum: 0, cgpaCount: 0, marksSum: 0, marksCount: 0, attendanceSum: 0, attendanceCount: 0
  };
}

export async function render(container) {
  const user = getUserProfile();

  container.innerHTML = `
    <div class="dashboard-layout fade-in">
      ${createSidebar(user.role, '/dean/dashboard')}
      <div class="main-content">
        ${createHeader('Dean Dashboard', user)}
        <div class="page-content" id="dean-content">
          <div style="display:flex;justify-content:center;padding:60px;"><div class="spinner"></div></div>
        </div>
      </div>
    </div>
  `;

  try {
    const data = await StatsService.getInstitutionStats();
    const { totalStudents = 0, totalFaculty = 0, totalDepartments = 0, totalSchools = 0, pendingStudentApprovals = 0, highRiskStudents = 0, openIssues = 0, totalIssues = 0, students = [], faculty = [], issues = [], meetings = [], depts = [], lowAttendanceStudents = [], learnerCounts = {}, cohortAnalysis = {} } = data;

    // Department comparisons use department IDs first, then an unambiguous name + school match.
    const deptMap = new Map();
    (depts || []).forEach(department => deptMap.set(department.id, makeDepartmentRow(department.id, department)));
    const addToDepartment = (record, field, amount = 1) => {
      let key = findDepartmentKey(record, depts, deptMap);
      if (!key) {
        const name = String(record.department || '').trim();
        const schoolId = String(record.schoolId || '');
        const legacyKey = `legacy:${schoolId}:${normalized(name)}`;
        if (!name) return null;
        if (!deptMap.has(legacyKey)) deptMap.set(legacyKey, makeDepartmentRow(legacyKey, { name, schoolName: record.schoolName }));
        key = legacyKey;
      }
      const row = deptMap.get(key);
      if (field) row[field] += amount;
      return row;
    };
    (students || []).forEach(student => {
      const row = addToDepartment(student, 'students');
      if (!row) return;
      if (student.riskLevel === 'HIGH') row.highRisk++;
      if (student.learnerLevel === 'SLOW') row.slow++;
      const attendance = student.attendance === null || student.attendance === undefined || student.attendance === '' ? NaN : Number(student.attendance);
      const hasAttendance = Number(student.attendanceSessions) > 0 || attendance > 0 || ['LOW', 'BELOW_TARGET', 'ON_TRACK'].includes(String(student.attendanceStatus || '').toUpperCase());
      if (hasAttendance && Number.isFinite(attendance) && attendance >= 0 && attendance <= 100) {
        row.attendanceSum += attendance;
        row.attendanceCount++;
        if (attendance <= 40) row.fr++;
      }
      const marks = student.latestSubjectAverage === null || student.latestSubjectAverage === undefined || student.latestSubjectAverage === '' ? NaN : Number(student.latestSubjectAverage);
      if (Number.isFinite(marks) && marks >= 0 && marks <= 100) { row.marksSum += marks; row.marksCount++; }
      const cgpa = Number(student.cgpa);
      if (Number.isFinite(cgpa) && cgpa > 0 && cgpa <= 10) { row.cgpaSum += cgpa; row.cgpaCount++; }
    });
    (faculty || []).filter(record => ['FACULTY', 'MENTOR'].includes(String(record.role || '').toUpperCase()) && record.isApproved !== false && !['PENDING', 'REJECTED', 'DISABLED'].includes(String(record.status || '').toUpperCase())).forEach(record => addToDepartment(record, 'mentors'));
    (issues || []).filter(issue => !['RESOLVED', 'CLOSED'].includes(String(issue.status || '').toUpperCase())).forEach(issue => addToDepartment(issue, 'openIssues'));
    const deptRows = [...deptMap.values()].map(row => ({
      ...row,
      avgCGPA: row.cgpaCount ? (row.cgpaSum / row.cgpaCount).toFixed(2) : '—',
      avgMarks: row.marksCount ? `${(row.marksSum / row.marksCount).toFixed(1)}%` : '—',
      avgAttendance: row.attendanceCount ? `${(row.attendanceSum / row.attendanceCount).toFixed(1)}%` : '—'
    })).sort((a, b) => b.fr - a.fr || b.highRisk - a.highRisk || b.students - a.students);

    // Monthly meeting request volume, based on each meeting's creation timestamp.
    const now = new Date();
    const monthPeriods = Array.from({length:6}, (_,i) => {
      const d = new Date(now.getFullYear(), now.getMonth()-5+i, 1);
      return { key: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`, label: d.toLocaleString('en-IN',{month:'short'}) };
    });
    const meetingsByMonth = new Map(monthPeriods.map(month => [month.key, 0]));
    meetings.forEach(meeting => {
      const date = new Date(meeting.createdAt || meeting.scheduledAt || '');
      if (!Number.isNaN(date.getTime())) {
        const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        if (meetingsByMonth.has(key)) meetingsByMonth.set(key, meetingsByMonth.get(key) + 1);
      }
    });
    const meetingMax = Math.max(1, ...meetingsByMonth.values());
    const institutionAnalysis = cohortAnalysis.total === undefined ? StatsService.summarizeStudents(students) : cohortAnalysis;
    const completedMeetingCount = meetings.filter(meeting => String(meeting.status || '').toUpperCase() === 'COMPLETED').length;
    const scheduledMeetingCount = meetings.filter(meeting => ['APPROVED', 'SCHEDULED', 'ONGOING', 'IN_PROGRESS'].includes(String(meeting.status || '').toUpperCase())).length;
    const activeInterventionIds = new Set(meetings.filter(meeting => meeting.attendanceIntervention === true && ['REQUESTED', 'APPROVED', 'SCHEDULED', 'ONGOING', 'IN_PROGRESS'].includes(String(meeting.status || '').toUpperCase())).map(meeting => meeting.studentId));
    const frWithMeeting = lowAttendanceStudents.filter(student => activeInterventionIds.has(student.id)).length;
    const pendingHods = faculty.filter(member => String(member.role || '').toUpperCase() === 'HOD' && (String(member.status || '').toUpperCase() === 'PENDING' || member.isApproved === false));

    const dash = container.querySelector('#dean-content');
    if (!dash) return;
    dash.innerHTML = `
      <div class="dashboard-container">
        <!-- Quick Actions Bar -->
        <div style="display:flex; gap:12px; margin-bottom:20px; flex-wrap:wrap;">
          <a href="#/dean/reports" class="btn btn-sm btn-primary" style="display:flex; align-items:center; gap:6px; border-radius:20px; font-weight:600;">
            <i class="ph ph-chart-bar" style="font-size:1.1rem;"></i> Mentor Reports
          </a>
          <a href="#/dean/analytics" class="btn btn-sm btn-secondary" style="display:flex; align-items:center; gap:6px; border-radius:20px; font-weight:600;">
            <i class="ph ph-chart-line-up" style="font-size:1.1rem; color:var(--accent);"></i> Institution Analytics
          </a>
          <a href="#/dean/escalations" class="btn btn-sm btn-secondary" style="display:flex; align-items:center; gap:6px; border-radius:20px; font-weight:600;">
            <i class="ph ph-siren" style="font-size:1.1rem; color:var(--warning);"></i> Escalations
          </a>
        </div>

        <div class="stats-grid" style="grid-template-columns:repeat(auto-fit,minmax(145px,1fr));margin-bottom:24px;">
        ${[
          ['Students',     totalStudents,    'var(--info)',   'M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5z'],
          ['Faculty',      totalFaculty,     'var(--accent)', 'M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z'],
          ['Departments',  totalDepartments, 'var(--success)','M12 7V3H2v18h20V7H12zM6 19H4v-2h2v2zm0-4H4v-2h2v2zm0-4H4V9h2v2z'],
          ['Schools',      totalSchools,     'var(--info)',   'M3 21h18V7l-9-4-9 4v14zm4-2v-3h3v3H7zm0-5v-3h3v3H7zm7 5v-3h3v3h-3zm0-5v-3h3v3h-3z'],
          ['High Risk',    highRiskStudents, 'var(--danger)', 'M1 21h22L12 2 1 21zm12-3h-2v-2h2v2zm0-4h-2v-4h2v4z'],
          ['Open Issues',  openIssues,       'var(--warning)','M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z'],
          ['Pending Admissions', pendingStudentApprovals, 'var(--warning)', 'M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z'],
          ['Total Issues', totalIssues,    'var(--info)',   'M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zM9 17H7v-7h2v7zm4 0h-2V7h2v10zm4 0h-2v-4h2v4z'],
        ].map(([l,v,c,i]) => `
          <div class="stat-card">
            <div class="stat-icon" style="background:${c}22;"><svg viewBox="0 0 24 24" style="fill:${c};width:18px;height:18px;"><path d="${i}"/></svg></div>
            <div class="stat-label">${l}</div>
            <div class="stat-value" style="font-size:1.5rem;">${v}</div>
          </div>
        `).join('')}
      </div>

      <div class="card" style="padding:18px 20px;margin-bottom:20px;">
        <div style="display:flex;justify-content:space-between;gap:12px;align-items:center;flex-wrap:wrap;">
          <div><h3 style="margin:0 0 4px;">Institution academic health</h3><p style="margin:0;color:var(--text-muted);font-size:.82rem;">Latest subject marks and recorded attendance. Averages show their data coverage.</p></div>
          <div style="display:flex;gap:8px;flex-wrap:wrap;">
            <span class="badge badge-danger">Slow · ${Number(learnerCounts.SLOW) || 0}</span>
            <span class="badge badge-warning">Medium · ${Number(learnerCounts.MEDIUM) || 0}</span>
            <span class="badge badge-success">Advanced · ${Number(learnerCounts.ADVANCED) || 0}</span>
          </div>
        </div>
        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:10px;margin-top:14px;">
          <div style="padding:12px;background:var(--bg-secondary);border-radius:10px;"><div style="font-size:.72rem;color:var(--text-muted);">Mean subject marks</div><strong style="font-size:1.15rem;">${institutionAnalysis.averageSubjectMarks === null ? '—' : `${institutionAnalysis.averageSubjectMarks}%`}</strong><div style="font-size:.72rem;color:var(--text-muted);">${institutionAnalysis.marksAssessed}/${totalStudents} students assessed</div></div>
          <div style="padding:12px;background:var(--bg-secondary);border-radius:10px;"><div style="font-size:.72rem;color:var(--text-muted);">Mean attendance</div><strong style="font-size:1.15rem;">${institutionAnalysis.averageAttendance === null ? '—' : `${institutionAnalysis.averageAttendance}%`}</strong><div style="font-size:.72rem;color:var(--text-muted);">${institutionAnalysis.attendanceRecorded}/${totalStudents} have records</div></div>
          <div style="padding:12px;background:var(--bg-secondary);border-radius:10px;"><div style="font-size:.72rem;color:var(--text-muted);">FR cases with open meeting</div><strong style="font-size:1.15rem;">${frWithMeeting}/${lowAttendanceStudents.length}</strong><div style="font-size:.72rem;color:var(--text-muted);">${Math.max(0, lowAttendanceStudents.length - frWithMeeting)} need meeting follow-up</div></div>
        </div>
      </div>

      <div class="card" style="margin-bottom:20px;">
        <div class="card-header"><div><h3>FR students — low attendance (≤40%)</h3><p style="margin:4px 0 0;color:var(--text-muted);font-size:.8rem;">Request a special attendance support meeting with the assigned mentor.</p></div><span class="badge badge-danger">${lowAttendanceStudents.length} students</span></div>
        ${lowAttendanceStudents.length ? `<div style="overflow:auto;"><table class="data-table"><thead><tr><th>Student</th><th>Department</th><th>Attendance</th><th>Latest marks</th><th>Learner band</th><th>Follow-up</th></tr></thead><tbody>${lowAttendanceStudents.map(student => `<tr><td><strong>${escapeHtml(student.name || 'Student')}</strong><div style="font-size:.75rem;color:var(--text-muted);">${escapeHtml(student.enrollmentNumber || '')}</div></td><td>${escapeHtml(student.department || '—')}</td><td><span class="badge badge-danger">FR · ${Math.max(0, Number(student.attendance) || 0)}%</span></td><td>${student.latestSubjectAverage === null || student.latestSubjectAverage === undefined ? '—' : `${escapeHtml(student.latestSubjectAverage)}%`}</td><td>${escapeHtml(student.learnerLevel || 'Not assessed')}</td><td><button class="btn btn-xs btn-primary dean-fr-meeting" data-student-id="${escapeHtml(student.id)}">Special meeting</button></td></tr>`).join('')}</tbody></table></div>` : '<p style="padding:20px;color:var(--text-muted);">No FR students with recorded attendance currently.</p>'}
      </div>

      <div class="card" style="padding:20px;margin-bottom:20px;">
        <div style="display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap;margin-bottom:12px;"><div><h3 style="margin:0;">Meeting activity</h3><p style="margin:4px 0 0;color:var(--text-muted);font-size:.8rem;">Requests created in the last six months; latest statuses shown alongside.</p></div><div style="display:flex;gap:6px;flex-wrap:wrap;"><span class="badge badge-info">${meetings.length} total</span><span class="badge badge-warning">${meetings.filter(meeting => meeting.status === 'REQUESTED').length} requested</span><span class="badge badge-primary">${scheduledMeetingCount} scheduled / active</span><span class="badge badge-success">${completedMeetingCount} completed</span></div></div>
        ${meetings.length ? `<div style="display:grid;grid-template-columns:repeat(6,minmax(36px,1fr));gap:10px;align-items:end;height:112px;padding:6px 4px 0;">${monthPeriods.map(month => { const count = meetingsByMonth.get(month.key) || 0; const height = count ? Math.max(8, Math.round(count / meetingMax * 82)) : 3; return `<div title="${month.label}: ${count} requests" style="display:flex;flex-direction:column;align-items:center;justify-content:flex-end;height:100%;gap:5px;"><span style="font-size:.7rem;color:var(--text-secondary);">${count}</span><div style="width:min(100%,44px);height:${height}px;background:var(--accent);border-radius:6px 6px 2px 2px;"></div><span style="font-size:.68rem;color:var(--text-muted);">${month.label}</span></div>`; }).join('')}</div>` : '<p style="margin:0;color:var(--text-muted);font-size:.8rem;">No meeting records are available for this period.</p>'}
      </div>

      <div style="display:grid;grid-template-columns:1fr 1fr;gap:20px;margin-bottom:20px;">
        <!-- Chart -->
        <div class="card" style="padding:20px;">
          <h3 style="font-size:0.95rem;font-weight:600;margin-bottom:16px;">Risk Distribution</h3>
          <div style="height:200px;"><canvas id="dean-risk-chart"></canvas></div>
        </div>
        <!-- Dept Risk bars -->
        <div class="card" style="padding:20px;">
          <h3 style="font-size:0.95rem;font-weight:600;margin-bottom:16px;">High Risk by Department</h3>
          ${deptRows.length === 0
            ? '<p style="color:var(--text-muted);">No departments configured.</p>'
            : deptRows.map(d => `
              <div style="display:flex;align-items:center;gap:10px;margin-bottom:10px;">
                <span style="flex:1;font-size:0.825rem;color:var(--text-secondary);">${escapeHtml(d.name)}${d.school !== '—' ? `<small style="display:block;color:var(--text-muted);">${escapeHtml(d.school)}</small>` : ''}</span>
                <div style="width:120px;" class="progress-bar-wrap">
                  <div class="progress-bar-fill ${d.highRisk>10?'fill-danger':d.highRisk>5?'fill-warning':'fill-success'}" style="width:${d.students>0?Math.min(100,(d.highRisk/d.students)*100):0}%"></div>
                </div>
                <span style="font-size:0.78rem;font-weight:600;width:28px;text-align:right;color:${d.highRisk>5?'var(--danger)':d.highRisk>2?'var(--warning)':'var(--success)'};">${d.highRisk}</span>
              </div>
            `).join('')
          }
        </div>
      </div>

      </div>

      <!-- Approvals Queue -->
      <div class="card" style="margin-bottom:20px;">
        <div class="card-header"><h3>Pending HOD Approvals</h3></div>
        ${pendingHods.length === 0
          ? '<p style="padding:20px;color:var(--text-muted);">No pending approvals.</p>'
          : `<table class="data-table">
              <thead><tr><th>Name</th><th>Email</th><th>Department</th><th>Action</th></tr></thead>
              <tbody>
                ${pendingHods.map(f => `
                  <tr>
                    <td><strong>${f.name}</strong></td>
                    <td>${f.email}</td>
                    <td>${f.department||'—'}</td>
                    <td><button class="btn btn-xs btn-primary btn-approve" data-id="${f.id}">Approve</button></td>
                  </tr>
                `).join('')}
              </tbody>
             </table>`
        }
      </div>

      <!-- At Risk Students Table -->
      <div class="card" style="margin-bottom:20px;">
        <div class="card-header"><h3>High Risk Students</h3></div>
        ${students.filter(s => s.riskLevel === 'HIGH').length === 0
          ? '<p style="padding:20px;color:var(--text-muted);">No high risk students currently.</p>'
          : `<table class="data-table">
              <thead><tr><th>Name</th><th>Department</th><th>CGPA</th><th>Actions</th></tr></thead>
              <tbody>
                ${students.filter(s => s.riskLevel === 'HIGH').map(s => `
                  <tr>
                    <td><strong>${s.name || '—'}</strong></td>
                    <td>${s.department || '—'}</td>
                    <td>${s.cgpa || '—'}</td>
                    <td>
                      <a href="#/mentor/booklet?studentId=${s.id}" class="btn btn-xs btn-primary">Booklet</a>
                    </td>
                  </tr>
                `).join('')}
              </tbody>
             </table>`
        }
      </div>

      <!-- Department Table -->
      <div class="card">
        <div class="card-header"><h3>School and Department Overview</h3></div>
        <div style="overflow:auto;"><table class="data-table">
          <thead><tr><th>Department</th><th>School</th><th>Students</th><th>Mentors</th><th>Avg marks</th><th>Avg attendance</th><th>FR</th><th>Slow band</th><th>High risk</th><th>Open issues</th></tr></thead>
          <tbody>
            ${deptRows.map(d => `
              <tr>
                <td style="font-weight:600;">${escapeHtml(d.name)}</td>
                <td>${escapeHtml(d.school)}</td>
                <td>${d.students}</td>
                <td>${d.mentors}</td>
                <td>${d.avgMarks}${d.marksCount ? ` <span style="font-size:.7rem;color:var(--text-muted);">(${d.marksCount})</span>` : ''}</td>
                <td>${d.avgAttendance}${d.attendanceCount ? ` <span style="font-size:.7rem;color:var(--text-muted);">(${d.attendanceCount})</span>` : ''}</td>
                <td><span class="badge ${d.fr?'badge-danger':'badge-success'}">${d.fr}</span></td>
                <td>${d.slow}</td>
                <td><span class="badge ${d.highRisk>10?'badge-danger':d.highRisk>5?'badge-warning':'badge-success'}">${d.highRisk}</span></td>
                <td><span class="badge ${d.openIssues>5?'badge-danger':d.openIssues>2?'badge-warning':'badge-success'}">${d.openIssues}</span></td>
              </tr>
            `).join('')}
          </tbody>
        </table></div>
      </div>

      <!-- ===== Dean Reports & Downloads Section ===== -->
      <div class="card" style="margin-top:20px;padding:0;overflow:hidden;border:1px solid var(--border);">
        <div style="display:flex;justify-content:space-between;align-items:center;padding:16px 20px;border-bottom:1px solid var(--border);background:linear-gradient(135deg,rgba(108,71,255,0.07),rgba(168,85,247,0.04));">
          <div>
            <h3 style="margin:0;font-size:0.95rem;font-weight:700;display:flex;align-items:center;gap:8px;">
              📊 Institution Reports
              <span class="badge badge-accent" style="font-size:0.68rem;padding:2px 7px;">Export Center</span>
            </h3>
            <p style="margin:3px 0 0;font-size:0.78rem;color:var(--text-muted);">Download institution-wide mentor allocation reports</p>
          </div>
          <div style="display:flex;gap:10px;">
            <button id="btn-dean-dash-excel" class="btn btn-sm btn-secondary" style="display:flex;align-items:center;gap:6px;">
              <i class="ph ph-file-xls" style="font-size:1rem;color:var(--success);"></i> Master Excel
            </button>
            <button id="btn-dean-dash-pdf" class="btn btn-sm btn-secondary" style="display:flex;align-items:center;gap:6px;">
              <i class="ph ph-file-pdf" style="font-size:1rem;color:var(--danger);"></i> Master PDF
            </button>
            <a href="#/dean/reports" class="btn btn-sm btn-primary" style="display:flex;align-items:center;gap:6px;font-weight:600;">
              <i class="ph ph-chart-bar"></i> Full Reports →
            </a>
          </div>
        </div>
        <div style="padding:14px 20px;display:flex;gap:12px;align-items:center;flex-wrap:wrap;">
          <i class="ph ph-lightbulb" style="color:var(--accent);"></i>
          <span style="font-size:0.8rem;color:var(--text-muted);">Master reports include all departments — classwise allocation list, mentor summary, and class-wise breakdown sheets. For per-mentor reports, visit <a href="#/dean/reports" style="color:var(--accent);font-weight:600;">Full Reports</a>.</span>
        </div>
      </div>

    </div>
  `;

    container.querySelectorAll('.btn-approve').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const id = e.currentTarget?.dataset?.id || e.target.closest('.btn-approve')?.dataset?.id;
        if (!id) return;
        btn.disabled = true; btn.textContent = '...';
        try {
          await FacultyService.approve(id);
          showToast('HOD approved successfully!', 'success');
          setTimeout(() => render(container), 1000); // refresh page
        } catch (err) {
          showToast(err.message, 'error');
          btn.disabled = false; btn.textContent = 'Approve';
        }
      });
    });

    container.querySelectorAll('.dean-fr-meeting').forEach(button => {
      button.addEventListener('click', async () => {
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
    });

    // Dean Dashboard Report Buttons
    container.querySelector('#btn-dean-dash-excel')?.addEventListener('click', async () => {
      await exportMentorStudentReport('excel');
    });
    container.querySelector('#btn-dean-dash-pdf')?.addEventListener('click', async () => {
      await exportMentorStudentReport('pdf');
    });

    if (window.Chart && students.length) {
      const riskCounts = data.riskCounts || institutionAnalysis.riskCounts;

      const canvas = container.querySelector('#dean-risk-chart');
      if (canvas) {
        if (activeDeanChart) activeDeanChart.destroy();
        activeDeanChart = new window.Chart(canvas.getContext('2d'), {
          type: 'doughnut',
          data: {
            labels: ['High Risk', 'Medium Risk', 'Low Risk', 'Not Assessed'],
            datasets: [{ data: [riskCounts.HIGH, riskCounts.MEDIUM, riskCounts.LOW, riskCounts.NOT_ASSESSED], backgroundColor:['#f87171','#fbbf24','#34d399','#94a3b8'], borderWidth:0 }]
          },
          options: {
            responsive:true, maintainAspectRatio:false, cutout:'65%',
            plugins:{ legend:{ position:'right', labels:{color: '#475569',font:{size:11}} } }
          }
        });
      }
    }

  } catch (err) {
    const content = container.querySelector('#dean-content');
    if (content) content.innerHTML = `<div class="empty-state"><h3 style="color:var(--danger);">Error: ${err.message}</h3></div>`;
  }
}

let activeDeanChart = null;

export function teardown() {
  if (activeDeanChart && typeof activeDeanChart.destroy === 'function') {
    activeDeanChart.destroy();
    activeDeanChart = null;
  }
}

