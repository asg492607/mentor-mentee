import { getUserProfile } from '/js/auth.js';
import { createSidebar } from '/js/components/sidebar.js';
import { createHeader } from '/js/components/header.js';
import { StudentService } from '/js/services.js';
import { AttendanceService, ResultService, yearLabel, getAttendanceStatus } from '/js/services/academic-service.js';
import { escapeHtml } from '/js/utils.js';

const dateLabel = value => value ? new Date(`${value}T00:00:00`).toLocaleDateString('en-IN', { dateStyle: 'medium' }) : '—';

export async function render(container) {
  const user = getUserProfile();
  container.innerHTML = `
    <div class="dashboard-layout fade-in">
      ${createSidebar(user.role, '/student/academics')}
      <div class="main-content">
        ${createHeader('Academic Record', user)}
        <div class="page-content"><div id="academic-record" class="dashboard-container"><div class="spinner"></div></div></div>
      </div>
    </div>`;
  const wrap = container.querySelector('#academic-record');
  try {
    const [profile, results, attendance] = await Promise.all([
      StudentService.getFresh(user.id || user.uid),
      ResultService.getByStudent(user.id || user.uid),
      AttendanceService.getByStudent(user.id || user.uid)
    ]);
    const student = profile || user;
    const present = attendance.filter(record => record.present).length;
    const rate = attendance.length ? Math.round((present / attendance.length) * 1000) / 10 : Number(student.attendance || 0);
    const attendanceStatus = getAttendanceStatus({ ...student, attendance: rate, attendanceSessions: attendance.length });
    wrap.innerHTML = `
      <div class="card" style="padding:22px;margin-bottom:18px;background:linear-gradient(135deg,var(--accent-light),var(--bg-card));">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:14px;flex-wrap:wrap;"><div><span class="badge badge-accent">${escapeHtml(student.academicYear || 'ACADEMIC RECORD')}</span><h2 style="margin:10px 0 4px;">${escapeHtml(student.course || student.program || student.department || 'Student')}</h2><p style="margin:0;color:var(--text-secondary);">${escapeHtml(student.yearLabel || yearLabel(student.year, student.durationYears) || 'Year not set')} · ${escapeHtml(student.class || 'Class not assigned')} · ${escapeHtml(student.enrollmentNumber || '')}</p></div><a href="#/student/profile" class="btn btn-secondary btn-sm">Update profile</a></div>
      </div>
      <div class="stats-grid" style="grid-template-columns:repeat(auto-fit,minmax(150px,1fr));margin-bottom:18px;">
        <div class="stat-card"><div class="stat-label">Attendance</div><div class="stat-value">${rate}%</div><span class="badge ${attendanceStatus.badgeClass}" style="display:inline-flex;margin-top:6px;">${attendanceStatus.label}</span>${attendanceStatus.isLow ? '<small style="display:block;margin-top:5px;color:var(--danger);">At or below 40%</small>' : ''}</div>
        <div class="stat-card"><div class="stat-label">Latest SGPA</div><div class="stat-value">${student.latestSGPA ?? '—'}</div></div>
        <div class="stat-card"><div class="stat-label">CGPA</div><div class="stat-value">${student.cgpa ?? '—'}</div></div>
        <div class="stat-card"><div class="stat-label">Backlogs</div><div class="stat-value">${student.backlogs ?? '—'}</div></div>
      </div>
      <div class="card" style="margin-bottom:18px;"><div class="card-header"><h3>Semester results</h3><p class="card-subtitle">${results.length} published record(s)</p></div>
        ${results.length ? `<div style="overflow:auto;"><table class="data-table"><thead><tr><th>Semester</th><th>Exam</th><th>Academic year</th><th>SGPA</th><th>CGPA</th><th>Backlogs</th><th>Subjects</th></tr></thead><tbody>${results.map(result => `<tr><td>${escapeHtml(result.semester || '—')}</td><td>${escapeHtml(result.examName || '—')}</td><td>${escapeHtml(result.academicYear || '—')}</td><td>${escapeHtml(result.sgpa ?? '—')}</td><td>${escapeHtml(result.cgpa ?? '—')}</td><td>${escapeHtml(result.backlogs ?? '—')}</td><td>${(result.subjects || []).map(subject => `${escapeHtml(subject.name || 'Subject')}${subject.marks !== null ? `: ${escapeHtml(subject.marks)}` : ''}${subject.grade ? ` (${escapeHtml(subject.grade)})` : ''}`).join('<br>') || '—'}</td></tr>`).join('')}</tbody></table></div>` : '<div class="empty-state" style="padding:30px;"><h3>No results published yet</h3><p>Your exam section will add semester records here.</p></div>'}
      </div>
      <div class="card"><div class="card-header"><h3>Attendance register</h3><p class="card-subtitle">${present} present of ${attendance.length} recorded sessions</p></div>
        ${attendance.length ? `<div style="overflow:auto;"><table class="data-table"><thead><tr><th>Date</th><th>Class</th><th>Session</th><th>Status</th></tr></thead><tbody>${attendance.map(record => `<tr><td>${dateLabel(record.date)}</td><td>${escapeHtml(record.className || '—')}</td><td>${escapeHtml(record.period || '—')}</td><td><span class="badge ${record.present ? 'badge-success' : 'badge-danger'}">${record.present ? 'Present' : 'Absent'}</span></td></tr>`).join('')}</tbody></table></div>` : '<div class="empty-state" style="padding:30px;"><h3>No attendance recorded yet</h3></div>'}
      </div>`;
  } catch (error) {
    wrap.innerHTML = `<div class="empty-state"><h3 style="color:var(--danger);">Could not load academic records</h3><p>${escapeHtml(error.message || '')}</p></div>`;
  }
}
