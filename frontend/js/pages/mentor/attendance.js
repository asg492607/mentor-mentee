import { getUserProfile } from '/js/auth.js';
import { createSidebar } from '/js/components/sidebar.js';
import { createHeader } from '/js/components/header.js';
import { showToast } from '/js/components/toast.js';
import { ClassService } from '/js/services.js';
import { AcademicStudentService, AttendanceService } from '/js/services/academic-service.js';
import { parseImportFile } from '/js/excel-import.js';
import { escapeHtml } from '/js/utils.js';

const aliases = {
  enrollmentNumber: ['enrollmentnumber', 'enrollmentno', 'enrollment', 'rollno', 'rollnumber', 'studentid'],
  status: ['status', 'attendance', 'presentabsent'],
  name: ['name', 'studentname']
};
const keyOf = value => {
  const key = String(value || '').toLowerCase().replace(/[^a-z0-9]/g, '');
  return Object.entries(aliases).find(([, options]) => options.includes(key))?.[0] || key;
};

function downloadAttendanceTemplate() {
  const csv = 'enrollmentNumber,status\nSTU001,Present\nSTU002,Absent\n';
  const link = document.createElement('a');
  link.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
  link.download = 'class-attendance-import-template.csv';
  link.click();
  URL.revokeObjectURL(link.href);
}

function renderAttendanceAnalysis(students, records) {
  const perStudent = new Map();
  const perMonth = new Map();
  const sessions = new Set();
  let presentCount = 0;
  records.forEach(record => {
    const sessionKey = record.sessionId || `${record.date || ''}_${record.period || ''}`;
    if (sessionKey) sessions.add(sessionKey);
    if (record.present === true) presentCount++;
    const student = perStudent.get(record.studentId) || { records: 0, present: 0 };
    student.records++;
    if (record.present === true) student.present++;
    perStudent.set(record.studentId, student);
    const monthKey = String(record.date || '').slice(0, 7);
    if (!/^\d{4}-\d{2}$/.test(monthKey)) return;
    const month = perMonth.get(monthKey) || { records: 0, present: 0, sessions: new Set() };
    month.records++;
    if (record.present === true) month.present++;
    if (sessionKey) month.sessions.add(sessionKey);
    perMonth.set(monthKey, month);
  });
  const recordedStudents = students.filter(student => perStudent.has(student.id));
  const attendanceRate = records.length ? Math.round(presentCount / records.length * 1000) / 10 : null;
  const frStudents = recordedStudents.map(student => {
    const totals = perStudent.get(student.id);
    return { ...student, sessions: totals.records, attendance: Math.round(totals.present / totals.records * 1000) / 10 };
  }).filter(student => student.attendance <= 40).sort((a, b) => a.attendance - b.attendance);
  const monthKeys = Array.from({ length: 6 }, (_, index) => {
    const date = new Date();
    date.setDate(1);
    date.setMonth(date.getMonth() - 5 + index);
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
  });
  return `
    <div class="card" style="padding:20px;margin-bottom:18px;">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:12px;flex-wrap:wrap;margin-bottom:14px;">
        <div><h3 style="margin:0;">Class attendance analysis</h3><p style="margin:4px 0 0;color:var(--text-muted);font-size:.8rem;">Calculated from saved class register records. FR is attendance at or below 40%.</p></div>
        <span class="badge ${frStudents.length ? 'badge-danger' : 'badge-success'}">${frStudents.length} FR students</span>
      </div>
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(155px,1fr));gap:10px;margin-bottom:16px;">
        <div style="padding:12px;border:1px solid var(--border);border-radius:10px;"><div style="font-size:.72rem;color:var(--text-muted);">Class attendance rate</div><strong style="font-size:1.2rem;">${attendanceRate === null ? '—' : `${attendanceRate}%`}</strong><div style="font-size:.72rem;color:var(--text-muted);">${presentCount}/${records.length} student-session marks present</div></div>
        <div style="padding:12px;border:1px solid var(--border);border-radius:10px;"><div style="font-size:.72rem;color:var(--text-muted);">Recorded coverage</div><strong style="font-size:1.2rem;">${recordedStudents.length}/${students.length}</strong><div style="font-size:.72rem;color:var(--text-muted);">students with at least one record</div></div>
        <div style="padding:12px;border:1px solid var(--border);border-radius:10px;"><div style="font-size:.72rem;color:var(--text-muted);">Register sessions</div><strong style="font-size:1.2rem;">${sessions.size}</strong><div style="font-size:.72rem;color:var(--text-muted);">unique saved class sessions</div></div>
        <div style="padding:12px;border:1px solid var(--border);border-radius:10px;"><div style="font-size:.72rem;color:var(--text-muted);">Absent marks</div><strong style="font-size:1.2rem;color:${records.length - presentCount ? 'var(--warning)' : 'var(--success)'};">${records.length - presentCount}</strong><div style="font-size:.72rem;color:var(--text-muted);">across recorded sessions</div></div>
      </div>
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:20px;">
        <div><h4 style="font-size:.84rem;margin:0 0 8px;">Monthly trend</h4>${records.length ? `<table class="data-table"><thead><tr><th>Month</th><th>Sessions</th><th>Attendance</th></tr></thead><tbody>${monthKeys.map(key => {
          const month = perMonth.get(key);
          const percent = month?.records ? Math.round(month.present / month.records * 1000) / 10 : null;
          const label = new Date(`${key}-01T00:00:00`).toLocaleDateString('en-IN', { month: 'short', year: 'numeric' });
          return `<tr><td>${escapeHtml(label)}</td><td>${month?.sessions.size || 0}</td><td>${percent === null ? '—' : `<strong style="color:${percent <= 40 ? 'var(--danger)' : percent < 75 ? 'var(--warning)' : 'var(--success)'};">${percent}%</strong>`}</td></tr>`;
        }).join('')}</tbody></table>` : '<p style="font-size:.8rem;color:var(--text-muted);">No previous class attendance has been saved yet.</p>'}</div>
        <div><h4 style="font-size:.84rem;margin:0 0 8px;">FR follow-up</h4>${frStudents.length ? `<table class="data-table"><thead><tr><th>Student</th><th>Sessions</th><th>Attendance</th></tr></thead><tbody>${frStudents.slice(0, 8).map(student => `<tr><td>${escapeHtml(student.name || 'Student')}<div style="font-size:.72rem;color:var(--text-muted);">${escapeHtml(student.enrollmentNumber || '')}</div></td><td>${student.sessions}</td><td><span class="badge badge-danger">${student.attendance}%</span></td></tr>`).join('')}</tbody></table>` : '<p style="font-size:.8rem;color:var(--text-muted);">No students are at or below 40% based on recorded registers.</p>'}</div>
      </div>
    </div>`;
}

export async function render(container) {
  const user = getUserProfile();
  container.innerHTML = `
    <div class="dashboard-layout fade-in">
      ${createSidebar(user.role, '/mentor/attendance')}
      <div class="main-content">
        ${createHeader('Class Attendance', user)}
        <div class="page-content"><div class="dashboard-container">
          <div class="card" style="padding:22px;margin-bottom:18px;background:linear-gradient(135deg,rgba(16,185,129,.12),var(--bg-card));">
            <span class="badge badge-success">CLASS TEACHER</span><h2 style="margin:10px 0 4px;">Record attendance</h2>
            <p style="margin:0;color:var(--text-secondary);">Choose an assigned class and mark the register. Attendance percentages update on student and mentor dashboards after saving.</p>
          </div>
          <div id="attendance-content" class="card" style="padding:22px;"><div class="spinner"></div></div>
        </div></div>
      </div>
    </div>`;
  const wrap = container.querySelector('#attendance-content');
  try {
    const classes = await ClassService.getByTeacher(user.id || user.uid);
    if (!classes.length) {
      wrap.innerHTML = `<div class="empty-state" style="padding:28px;"><h3>No class assigned</h3><p>Ask an administrator to assign you as class teacher for a class under Institutions &amp; Departments.</p></div>`;
      return;
    }
    const today = new Date();
    const localDate = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    wrap.innerHTML = `
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:12px;margin-bottom:18px;">
        <div class="form-group" style="margin:0;"><label class="form-label">Class</label><select id="attendance-class" class="form-select">${classes.map(item => `<option value="${escapeHtml(item.id)}">${escapeHtml(item.className)} · ${escapeHtml(item.department || '')}</option>`).join('')}</select></div>
        <div class="form-group" style="margin:0;"><label class="form-label">Date</label><input id="attendance-date" type="date" class="form-input" value="${localDate}"></div>
        <div class="form-group" style="margin:0;"><label class="form-label">Session / period</label><input id="attendance-period" class="form-input" placeholder="Daily / Period 1" required></div>
      </div>
      <div style="display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;margin-bottom:14px;">
        <div><label class="form-label" for="attendance-file">Import attendance from CSV or Excel</label><div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;"><input id="attendance-file" type="file" accept=".csv,.xlsx,.xls" class="form-input" style="max-width:350px;"><button id="download-attendance-template" class="btn btn-secondary btn-sm">Download template</button><button id="apply-attendance-file" class="btn btn-primary btn-sm" disabled>Apply preview</button></div><small style="color:var(--text-muted);">Columns: enrollmentNumber, status (Present / Absent). Preview and confirm before changing the register.</small></div>
        <span id="attendance-count" class="badge badge-info"></span>
      </div>
      <div id="attendance-file-preview" style="margin-bottom:14px;"></div>
      <div id="attendance-analysis"></div>
      <div id="attendance-roster"><div class="spinner"></div></div>
      <div style="display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap;margin-top:16px;">
        <button id="mark-all-present" class="btn btn-secondary btn-sm">Mark everyone present</button>
        <button id="save-attendance" class="btn btn-primary">Save attendance</button>
      </div>`;

    let roster = [];
    let attendanceImportRows = [];
    const classSelect = wrap.querySelector('#attendance-class');
    const rosterWrap = wrap.querySelector('#attendance-roster');
    const importPreview = wrap.querySelector('#attendance-file-preview');
    const applyImport = wrap.querySelector('#apply-attendance-file');
    const renderImportPreview = () => {
      const ready = attendanceImportRows.filter(row => !row.error && !row.applied);
      const skipped = attendanceImportRows.filter(row => row.error);
      applyImport.disabled = ready.length === 0;
      importPreview.innerHTML = attendanceImportRows.length
        ? `<p style="margin:0 0 8px;font-size:.8rem;color:var(--text-secondary);">${ready.length} ready · ${attendanceImportRows.filter(row => row.applied).length} applied · ${skipped.length} skipped</p><div style="max-height:240px;overflow:auto;"><table class="data-table"><thead><tr><th>Enrollment</th><th>Student</th><th>Attendance</th><th>Status</th></tr></thead><tbody>${attendanceImportRows.slice(0, 200).map(row => `<tr><td>${escapeHtml(row.enrollmentNumber || '—')}</td><td>${escapeHtml(row.student?.name || '—')}</td><td>${row.present ? 'Present' : 'Absent'}</td><td><span class="badge ${row.applied ? 'badge-success' : row.error ? 'badge-danger' : 'badge-info'}">${escapeHtml(row.applied ? 'Applied' : row.error || 'Ready')}</span></td></tr>`).join('')}</tbody></table></div>${attendanceImportRows.length > 200 ? `<small style="color:var(--text-muted);">Showing 200 of ${attendanceImportRows.length} rows.</small>` : ''}`
        : '';
    };
    const drawRoster = () => {
      const present = roster.filter(student => student.present).length;
      wrap.querySelector('#attendance-count').textContent = `${present} present · ${roster.length - present} absent · ${roster.length} total`;
      rosterWrap.innerHTML = roster.length ? `<div style="max-height:480px;overflow:auto;"><table class="data-table"><thead><tr><th>Student</th><th>Enrollment</th><th>Year</th><th>Admission</th><th>Academic standing</th><th>Present</th></tr></thead><tbody>${roster.map(student => { const yearDown = student.yearDown === true || String(student.academicStanding || '').toUpperCase() === 'YEAR_DOWN'; const provisional = String(student.admissionStatus || '').toUpperCase() === 'PROVISIONAL'; return `<tr><td>${escapeHtml(student.name || 'Student')}</td><td>${escapeHtml(student.enrollmentNumber || '—')}</td><td>${escapeHtml(student.yearLabel || student.year || '—')}</td><td>${provisional ? '<span class="badge badge-warning">Provisional</span>' : 'Admitted'}</td><td><span class="badge ${yearDown ? 'badge-warning' : 'badge-muted'}">${yearDown ? 'Repeating year' : 'Current'}</span></td><td><label style="display:flex;align-items:center;gap:8px;"><input class="attendance-toggle" data-id="${escapeHtml(student.id)}" type="checkbox" ${student.present ? 'checked' : ''}><span>${student.present ? 'Present' : 'Absent'}</span></label></td></tr>`; }).join('')}</tbody></table></div>` : '<div class="empty-state"><h3>No students found for this class</h3><p>Check the students’ department and class assignments.</p></div>';
      rosterWrap.querySelectorAll('.attendance-toggle').forEach(input => input.addEventListener('change', () => {
        const student = roster.find(item => item.id === input.dataset.id);
        if (student) student.present = input.checked;
        const label = input.nextElementSibling;
        if (label) label.textContent = input.checked ? 'Present' : 'Absent';
        const count = roster.filter(item => item.present).length;
        wrap.querySelector('#attendance-count').textContent = `${count} present · ${roster.length - count} absent · ${roster.length} total`;
      }));
    };
    const loadClass = async () => {
      const selected = classes.find(item => item.id === classSelect.value);
      rosterWrap.innerHTML = '<div class="spinner"></div>';
      const [students, records] = await Promise.all([
        AcademicStudentService.getByClass(selected),
        AttendanceService.getByClass(selected.id)
      ]);
      roster = students.map(student => ({ ...student, present: false }));
      wrap.querySelector('#attendance-analysis').innerHTML = renderAttendanceAnalysis(students, records);
      drawRoster();
    };
    classSelect.addEventListener('change', () => {
      attendanceImportRows = [];
      renderImportPreview();
      wrap.querySelector('#attendance-file').value = '';
      loadClass().catch(error => showToast(error.message, 'error'));
    });
    await loadClass();

    wrap.querySelector('#mark-all-present').addEventListener('click', () => {
      roster = roster.map(student => ({ ...student, present: true }));
      drawRoster();
    });
    wrap.querySelector('#download-attendance-template').addEventListener('click', downloadAttendanceTemplate);
    wrap.querySelector('#attendance-file').addEventListener('change', async event => {
      attendanceImportRows = [];
      renderImportPreview();
      const file = event.target.files?.[0];
      if (!file) return;
      try {
        const matrix = await parseImportFile(file);
        if (matrix.length < 2) throw new Error('The attendance file has no student rows.');
        const headers = matrix[0].map(keyOf);
        if (!headers.includes('enrollmentNumber') || !headers.includes('status')) throw new Error('The file must include enrollmentNumber and status columns.');
        const seen = new Set();
        const duplicateEnrollments = new Set();
        attendanceImportRows = matrix.slice(1).map(cells => {
          const row = {};
          headers.forEach((header, index) => { row[header] = String(cells[index] ?? '').trim(); });
          const enrollmentNumber = String(row.enrollmentNumber || '').trim();
          const enrollmentKey = enrollmentNumber.toLowerCase();
          if (seen.has(enrollmentKey)) duplicateEnrollments.add(enrollmentKey);
          seen.add(enrollmentKey);
          const normalizedStatus = String(row.status || '').trim();
          const validStatus = /^(present|absent|p|a|yes|no|1|0|true|false)$/i.test(normalizedStatus);
          const student = roster.find(item => String(item.enrollmentNumber || '').trim().toLowerCase() === enrollmentKey);
          return {
            enrollmentNumber,
            student,
            present: /^(present|p|yes|1|true)$/i.test(normalizedStatus),
            error: !enrollmentNumber ? 'Enrollment number is required' : !validStatus ? 'Status must be Present or Absent' : !student ? 'Student is not in the selected class' : '',
            applied: false
          };
        });
        attendanceImportRows.forEach(row => {
          if (duplicateEnrollments.has(row.enrollmentNumber.toLowerCase())) row.error = 'Enrollment appears more than once in file';
        });
        renderImportPreview();
      } catch (error) { showToast(error.message || 'Could not read attendance file.', 'error'); }
    });
    applyImport.addEventListener('click', () => {
      const statuses = new Map(attendanceImportRows.filter(row => !row.error && !row.applied).map(row => [row.student.id, row.present]));
      roster = roster.map(student => statuses.has(student.id) ? { ...student, present: statuses.get(student.id) } : student);
      attendanceImportRows.forEach(row => { if (!row.error && !row.applied) row.applied = true; });
      drawRoster();
      renderImportPreview();
      showToast(`Applied ${statuses.size} attendance row(s) to the register.`, 'success');
    });
    wrap.querySelector('#save-attendance').addEventListener('click', async event => {
      const button = event.currentTarget;
      if (!roster.length) return showToast('There are no students to save.', 'warning');
      button.disabled = true;
      button.textContent = 'Saving…';
      try {
        const classInfo = classes.find(item => item.id === classSelect.value);
        await AttendanceService.saveSession({
          classInfo,
          date: wrap.querySelector('#attendance-date').value,
          period: wrap.querySelector('#attendance-period').value,
          students: roster,
          actor: user
        });
        showToast('Attendance saved and student summaries updated.', 'success');
        await loadClass().catch(error => console.warn('Could not refresh class attendance analysis:', error));
      } catch (error) { showToast(error.message || 'Could not save attendance.', 'error'); }
      finally { button.disabled = false; button.textContent = 'Save attendance'; }
    });
  } catch (error) {
    wrap.innerHTML = `<div class="empty-state"><h3 style="color:var(--danger);">Could not load attendance</h3><p>${escapeHtml(error.message || '')}</p></div>`;
  }
}
