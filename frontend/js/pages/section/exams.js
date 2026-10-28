import { getUserProfile } from '/js/auth.js';
import { createSidebar } from '/js/components/sidebar.js';
import { createHeader } from '/js/components/header.js';
import { showToast } from '/js/components/toast.js';
import { StudentService } from '/js/services.js';
import { AcademicConfigService, ResultService, semesterCountForCourse, semesterNumber, yearLabel } from '/js/services/academic-service.js';
import { parseImportFile } from '/js/excel-import.js';
import { escapeHtml } from '/js/utils.js';

const aliases = {
  enrollmentNumber: ['enrollmentnumber', 'enrollmentno', 'enrollment', 'rollno', 'rollnumber', 'studentid'],
  semester: ['semester', 'sem', 'term'],
  sgpa: ['sgpa', 'semestergradepointaverage'],
  cgpa: ['cgpa', 'cumulativegpa'],
  backlogs: ['backlogs', 'backlog', 'kt', 'kts'],
  examName: ['examname', 'exam', 'resulttype'],
  academicYear: ['academicyear', 'session'],
  subject: ['subject', 'subjectname', 'coursecode'],
  marks: ['marks', 'score', 'marksobtained'],
  grade: ['grade', 'lettergrade']
};
const keyOf = value => {
  const key = String(value || '').toLowerCase().replace(/[^a-z0-9]/g, '');
  return Object.entries(aliases).find(([, options]) => options.includes(key))?.[0] || key;
};

function template() {
  const csv = 'enrollmentNumber,semester,sgpa,cgpa,backlogs,examName,academicYear,subject,marks,grade\nSTU001,Semester 1,8.2,8.2,0,End Semester,2026-27,Mathematics,82,A\n';
  const link = document.createElement('a');
  link.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
  link.download = 'semester-results-template.csv';
  link.click();
  URL.revokeObjectURL(link.href);
}

export async function render(container) {
  const user = getUserProfile();
  const [allStudents, config] = await Promise.all([
    StudentService.getAllFresh().catch(() => []),
    AcademicConfigService.get().catch(() => ({ activeAcademicYear: '' }))
  ]);
  let rowsToImport = [];
  container.innerHTML = `
    <div class="dashboard-layout fade-in">
      ${createSidebar(user.role, '/section/dashboard', user.department)}
      <div class="main-content">
        ${createHeader('Examination Results', user)}
        <div class="page-content"><div class="dashboard-container">
          <div class="card" style="padding:24px;margin-bottom:20px;background:linear-gradient(135deg,rgba(99,102,241,.12),var(--bg-card));">
            <span class="badge badge-accent">EXAM SECTION</span><h2 style="margin:10px 0 4px;">Publish semester results</h2>
            <p style="margin:0;color:var(--text-secondary);">Upload results by enrollment number. Each configured course year contains two six-month semesters; results outside the course duration are rejected.</p>
          </div>
          <div class="stats-grid" style="grid-template-columns:repeat(auto-fit,minmax(180px,1fr));margin-bottom:20px;">
            <div class="stat-card"><div class="stat-label">Students</div><div class="stat-value">${allStudents.length}</div></div>
            <div class="stat-card"><div class="stat-label">Active academic year</div><div class="stat-value" style="font-size:1.2rem;">${escapeHtml(config.activeAcademicYear || 'Not configured')}</div></div>
            <div class="stat-card"><div class="stat-label">Courses configured</div><div class="stat-value">${(config.courses || []).length}</div></div>
          </div>
          <div class="card" style="padding:22px;">
            <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:16px;flex-wrap:wrap;margin-bottom:16px;">
              <div><h3 style="margin:0;">Upload results file</h3><p style="margin:5px 0 0;color:var(--text-secondary);font-size:.84rem;">Required: enrollment number and semester, plus at least one result metric or subject row. Subject marks are retained; GPA is only updated when supplied.</p></div>
              <button class="btn btn-secondary btn-sm" id="download-result-template">Download template</button>
            </div>
            <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:12px;max-width:700px;margin-bottom:14px;">
              <div class="form-group" style="margin:0;"><label class="form-label">Exam / result label</label><input class="form-input" id="exam-name" placeholder="End Semester Examination"></div>
              <div class="form-group" style="margin:0;"><label class="form-label">Academic year</label><input class="form-input" id="result-academic-year" value="${escapeHtml(config.activeAcademicYear || '')}" placeholder="2026-27"></div>
            </div>
            <input type="file" id="results-file" accept=".csv,.xlsx,.xls" class="form-input" style="max-width:480px;">
            <div id="results-preview" style="margin-top:16px;"></div>
            <div style="display:flex;justify-content:flex-end;margin-top:14px;"><button class="btn btn-primary" id="publish-results" disabled>Publish ready results</button></div>
          </div>
        </div></div>
      </div>
    </div>`;
  container.querySelector('#download-result-template').addEventListener('click', template);
  const fileInput = container.querySelector('#results-file');
  const preview = container.querySelector('#results-preview');
  const publish = container.querySelector('#publish-results');
  fileInput.addEventListener('change', async () => {
    rowsToImport = [];
    publish.disabled = true;
    try {
      const matrix = await parseImportFile(fileInput.files[0]);
      if (!matrix || matrix.length < 2) throw new Error('The file has no result rows.');
      const headers = matrix[0].map(keyOf);
      const students = new Map(allStudents.map(student => [String(student.enrollmentNumberNormalized || student.enrollmentNumber || '').trim().toLowerCase(), student]));
      const groups = new Map();
      matrix.slice(1).forEach(cells => {
        const row = {};
        headers.forEach((header, index) => { row[header] = String(cells[index] ?? '').trim(); });
        if (!row.enrollmentNumber || !row.semester) return;
        const groupKey = [row.enrollmentNumber.toLowerCase(), row.semester.toLowerCase(), row.academicYear || '', row.examName || ''].join('|');
        if (!groups.has(groupKey)) groups.set(groupKey, { ...row, subjects: [] });
        const group = groups.get(groupKey);
        if (row.subject || row.marks || row.grade) group.subjects.push({ name: row.subject || '', marks: row.marks === '' ? null : Number(row.marks), grade: row.grade || '' });
        if (row.sgpa !== '') group.sgpa = row.sgpa;
        if (row.cgpa !== '') group.cgpa = row.cgpa;
        if (row.backlogs !== '') group.backlogs = row.backlogs;
      });
      rowsToImport = [...groups.values()].map(row => {
        const student = students.get(row.enrollmentNumber.toLowerCase());
        let error = '';
        const semesterIndex = semesterNumber(row.semester);
        const semesterLimit = student ? semesterCountForCourse(student, config.courses || []) : 0;
        if (!student) error = 'Enrollment not found';
        else if (!semesterIndex) error = 'Semester must be a number or Roman numeral';
        else if (!semesterLimit) error = 'Course duration is not configured';
        else if (semesterIndex > semesterLimit) error = `Semester ${semesterIndex} exceeds this course limit of ${semesterLimit}`;
        else if (![row.sgpa, row.cgpa, row.backlogs].some(value => value !== '' && value !== undefined) && !row.subjects.length) error = 'No result data';
        else if (row.sgpa && (!Number.isFinite(Number(row.sgpa)) || Number(row.sgpa) < 0 || Number(row.sgpa) > 10)) error = 'SGPA must be from 0 to 10';
        else if (row.cgpa && (!Number.isFinite(Number(row.cgpa)) || Number(row.cgpa) < 0 || Number(row.cgpa) > 10)) error = 'CGPA must be from 0 to 10';
        else if (row.backlogs !== '' && row.backlogs !== undefined && (!Number.isInteger(Number(row.backlogs)) || Number(row.backlogs) < 0)) error = 'Backlogs must be a non-negative whole number';
        else if (row.subjects.some(subject => subject.marks !== null && (!Number.isFinite(subject.marks) || subject.marks < 0 || subject.marks > 100))) error = 'Subject marks must be from 0 to 100';
        return { ...row, student, error };
      });
      const ready = rowsToImport.filter(row => !row.error).length;
      preview.innerHTML = `<p style="margin:0 0 8px;font-weight:600;">${ready} ready · ${rowsToImport.length - ready} skipped</p><div style="max-height:320px;overflow:auto;"><table class="data-table"><thead><tr><th>Student</th><th>Course / Year</th><th>Semester</th><th>SGPA</th><th>CGPA</th><th>Backlogs</th><th>Status</th></tr></thead><tbody>${rowsToImport.map(row => `<tr><td>${escapeHtml(row.student?.name || row.enrollmentNumber)}</td><td>${escapeHtml(row.student?.course || row.student?.program || '—')} · ${escapeHtml(yearLabel(row.student?.year, row.student?.durationYears) || '—')}</td><td>${escapeHtml(row.semester)}</td><td>${escapeHtml(row.sgpa || '—')}</td><td>${escapeHtml(row.cgpa || '—')}</td><td>${escapeHtml(row.backlogs || '—')}</td><td><span class="badge ${row.error ? 'badge-warning' : 'badge-success'}">${escapeHtml(row.error || 'Ready')}</span></td></tr>`).join('')}</tbody></table></div>`;
      publish.disabled = ready === 0;
    } catch (error) {
      preview.innerHTML = `<p class="text-danger">${escapeHtml(error.message || 'Could not read file.')}</p>`;
      showToast(error.message || 'Could not read file.', 'error');
    }
  });
  publish.addEventListener('click', async () => {
    const ready = rowsToImport.filter(row => !row.error);
    if (!ready.length) return;
    publish.disabled = true;
    let saved = 0;
    let failed = 0;
    const examName = container.querySelector('#exam-name').value.trim();
    const academicYear = container.querySelector('#result-academic-year').value.trim() || config.activeAcademicYear || '';
    for (const row of ready) {
      try {
        await ResultService.save({
          student: row.student, semester: row.semester, examName: row.examName || examName,
          academicYear: row.academicYear || academicYear, sgpa: row.sgpa, cgpa: row.cgpa,
          backlogs: row.backlogs, subjects: row.subjects, uploadedBy: user.id || user.uid
        });
        saved++;
      } catch (error) { row.error = error.message || 'Save failed'; failed++; }
    }
    publish.disabled = false;
    showToast(`${saved} result record(s) published${failed ? `, ${failed} failed` : ''}.`, saved ? 'success' : 'error');
  });
}
