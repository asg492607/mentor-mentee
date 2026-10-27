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
    const classes = (await ClassService.getAll()).filter(item => item.classTeacherId === (user.id || user.uid));
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
        <div class="form-group" style="margin:0;"><label class="form-label">Session / period (optional)</label><input id="attendance-period" class="form-input" placeholder="Morning / Period 1"></div>
      </div>
      <div style="display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;margin-bottom:14px;">
        <div><label class="form-label" for="attendance-file">Apply attendance from a file</label><input id="attendance-file" type="file" accept=".csv,.xlsx,.xls" class="form-input" style="max-width:420px;"><small style="color:var(--text-muted);">Columns: enrollmentNumber, status (Present / Absent)</small></div>
        <span id="attendance-count" class="badge badge-info"></span>
      </div>
      <div id="attendance-roster"><div class="spinner"></div></div>
      <div style="display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap;margin-top:16px;">
        <button id="mark-all-present" class="btn btn-secondary btn-sm">Mark everyone present</button>
        <button id="save-attendance" class="btn btn-primary">Save attendance</button>
      </div>`;

    let roster = [];
    const classSelect = wrap.querySelector('#attendance-class');
    const rosterWrap = wrap.querySelector('#attendance-roster');
    const drawRoster = () => {
      const present = roster.filter(student => student.present).length;
      wrap.querySelector('#attendance-count').textContent = `${present} present · ${roster.length - present} absent · ${roster.length} total`;
      rosterWrap.innerHTML = roster.length ? `<div style="max-height:480px;overflow:auto;"><table class="data-table"><thead><tr><th>Student</th><th>Enrollment</th><th>Year</th><th>Present</th></tr></thead><tbody>${roster.map(student => `<tr><td>${escapeHtml(student.name || 'Student')}</td><td>${escapeHtml(student.enrollmentNumber || '—')}</td><td>${escapeHtml(student.yearLabel || student.year || '—')}</td><td><label style="display:flex;align-items:center;gap:8px;"><input class="attendance-toggle" data-id="${escapeHtml(student.id)}" type="checkbox" ${student.present ? 'checked' : ''}><span>${student.present ? 'Present' : 'Absent'}</span></label></td></tr>`).join('')}</tbody></table></div>` : '<div class="empty-state"><h3>No students found for this class</h3><p>Check the students’ department and class assignments.</p></div>';
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
      const students = await AcademicStudentService.getByClass(selected);
      roster = students.map(student => ({ ...student, present: true }));
      drawRoster();
    };
    classSelect.addEventListener('change', () => loadClass().catch(error => showToast(error.message, 'error')));
    await loadClass();

    wrap.querySelector('#mark-all-present').addEventListener('click', () => {
      roster = roster.map(student => ({ ...student, present: true }));
      drawRoster();
    });
    wrap.querySelector('#attendance-file').addEventListener('change', async event => {
      const file = event.target.files?.[0];
      if (!file) return;
      try {
        const matrix = await parseImportFile(file);
        const headers = matrix[0].map(keyOf);
        const statuses = new Map();
        matrix.slice(1).forEach(cells => {
          const row = {};
          headers.forEach((header, index) => { row[header] = String(cells[index] ?? '').trim(); });
          if (row.enrollmentNumber && /^(present|absent|p|a|yes|no|1|0|true|false)$/i.test(row.status || '')) {
            statuses.set(row.enrollmentNumber.toLowerCase(), /^(present|p|yes|1|true)$/i.test(row.status));
          }
        });
        let matched = 0;
        roster = roster.map(student => {
          const enrollment = String(student.enrollmentNumber || '').toLowerCase();
          if (!statuses.has(enrollment)) return student;
          matched++;
          return { ...student, present: statuses.get(enrollment) };
        });
        drawRoster();
        showToast(`Applied ${matched} attendance row(s) to this class.`, 'success');
      } catch (error) { showToast(error.message || 'Could not read attendance file.', 'error'); }
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
      } catch (error) { showToast(error.message || 'Could not save attendance.', 'error'); }
      finally { button.disabled = false; button.textContent = 'Save attendance'; }
    });
  } catch (error) {
    wrap.innerHTML = `<div class="empty-state"><h3 style="color:var(--danger);">Could not load attendance</h3><p>${escapeHtml(error.message || '')}</p></div>`;
  }
}
