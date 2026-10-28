import { getUserProfile } from '/js/auth.js';
import { createSidebar } from '/js/components/sidebar.js';
import { createHeader } from '/js/components/header.js';
import { showToast } from '/js/components/toast.js';
import { showModal } from '/js/components/modal.js';
import { StudentService } from '/js/services.js';
import { api } from '/js/api.js';
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

function resultTimestamp(value) {
  if (value?.toDate) return value.toDate().getTime();
  if (Number.isFinite(value?.seconds)) return value.seconds * 1000;
  const parsed = Date.parse(String(value || ''));
  return Number.isFinite(parsed) ? parsed : 0;
}

function resultAcademicYear(result) {
  const match = String(result?.academicYear || '').match(/(?:19|20)\d{2}/);
  if (match) return Number(match[0]);
  const timestamp = resultTimestamp(result?.updatedAt);
  return timestamp ? new Date(timestamp).getFullYear() : 0;
}

function summarizeResults(results, students) {
  const activeStudents = students.filter(student => !['PENDING', 'REJECTED', 'DISABLED', 'SUSPENDED'].includes(String(student.status || '').toUpperCase()) && student.isApproved !== false);
  const studentById = new Map(activeStudents.map(student => [student.id, student]));
  const latestByStudent = new Map();
  results.forEach(result => {
    if (!studentById.has(result.studentId)) return;
    const current = latestByStudent.get(result.studentId);
    const semester = Number(result.semesterNumber) || 0;
    const currentSemester = Number(current?.semesterNumber) || 0;
    const year = resultAcademicYear(result);
    const currentYear = resultAcademicYear(current);
    if (!current || year > currentYear || (year === currentYear && semester > currentSemester) || (year === currentYear && semester === currentSemester && resultTimestamp(result.updatedAt) > resultTimestamp(current.updatedAt))) {
      latestByStudent.set(result.studentId, result);
    }
  });
  const learners = [...latestByStudent.values()].map(result => {
    const marks = (Array.isArray(result.subjects) ? result.subjects : [])
      .map(subject => subject?.marks === null || subject?.marks === undefined || subject?.marks === '' ? null : Number(subject.marks))
      .filter(mark => Number.isFinite(mark) && mark >= 0 && mark <= 100);
    const average = marks.length ? marks.reduce((sum, mark) => sum + mark, 0) / marks.length : null;
    const band = average === null ? 'NOT_ASSESSED' : average < 50 ? 'SLOW' : average < 75 ? 'MEDIUM' : 'ADVANCED';
    return { result, student: studentById.get(result.studentId), average, band };
  });
  const assessed = learners.filter(item => item.average !== null);
  const averages = assessed.map(item => item.average);
  const bands = { SLOW: 0, MEDIUM: 0, ADVANCED: 0, NOT_ASSESSED: 0 };
  learners.forEach(item => { bands[item.band]++; });
  const cohorts = new Map();
  learners.forEach(item => {
    const course = String(item.student.course || item.student.program || 'Course not set');
    const semester = Number(item.result.semesterNumber) || item.result.semester || '—';
    const key = `${course.toLowerCase()}|${semester}`;
    const cohort = cohorts.get(key) || { course, semester: String(item.result.semester || `Semester ${semester}`), students: 0, assessed: 0, marksTotal: 0, slow: 0, medium: 0, advanced: 0 };
    cohort.students++;
    if (item.average !== null) { cohort.assessed++; cohort.marksTotal += item.average; }
    if (item.band === 'SLOW') cohort.slow++;
    if (item.band === 'MEDIUM') cohort.medium++;
    if (item.band === 'ADVANCED') cohort.advanced++;
    cohorts.set(key, cohort);
  });
  return {
    activeStudentCount: activeStudents.length,
    recordCount: results.filter(result => studentById.has(result.studentId)).length,
    latestLearnerCount: learners.length,
    assessedCount: assessed.length,
    averageMarks: averages.length ? averages.reduce((sum, value) => sum + value, 0) / averages.length : null,
    bands,
    cohorts: [...cohorts.values()].map(cohort => ({ ...cohort, averageMarks: cohort.assessed ? cohort.marksTotal / cohort.assessed : null }))
      .sort((a, b) => (b.students - a.students) || a.course.localeCompare(b.course))
  };
}

function isYearDown(student) {
  return Boolean(student && (student.yearDown === true || String(student.academicStanding || '').toUpperCase() === 'YEAR_DOWN'));
}

const progressionAliases = {
  enrollmentNumber: ['enrollmentnumber', 'enrollmentno', 'enrollment', 'rollno', 'rollnumber', 'studentid'],
  decision: ['decision', 'result', 'standing', 'progression', 'action'],
  targetYear: ['targetyear', 'newyear', 'year'],
  academicYear: ['academicyear', 'session'],
  reason: ['reason', 'decisionreason', 'remarks', 'notes']
};
const progressionKey = value => {
  const key = String(value || '').toLowerCase().replace(/[^a-z0-9]/g, '');
  return Object.entries(progressionAliases).find(([, aliases]) => aliases.includes(key))?.[0] || key;
};

function downloadProgressionTemplate() {
  const csv = 'enrollmentNumber,decision,targetYear,academicYear,reason\nSTU001,YEAR_DOWN,2,2026-27,Repeat decision approved by Exam Section\nSTU002,PROGRESS,3,2026-27,Eligible to progress after result review\n';
  const link = document.createElement('a');
  link.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
  link.download = 'exam-progression-decisions-template.csv';
  link.click();
  URL.revokeObjectURL(link.href);
}

function openProgressionDecision(student, config, action, onSaved) {
  const year = Number(student.year) || 1;
  const course = (config.courses || []).find(item => String(item.name || '').trim().toLowerCase() === String(student.course || student.program || '').trim().toLowerCase());
  const duration = Number(student.durationYears || course?.durationYears) || 1;
  const clearRepeat = action === 'CLEAR';
  const targetYear = clearRepeat && year < duration ? year + 1 : year;
  const yearOptions = Array.from({ length: duration }, (_, index) => index + 1).map(value => `<option value="${value}" ${value === targetYear ? 'selected' : ''}>${escapeHtml(yearLabel(value, duration) || `Year ${value}`)}${value === year ? ' (current)' : ''}</option>`).join('');
  showModal({
    title: clearRepeat ? 'Clear year-down decision' : 'Record year-down decision',
    size: 'md',
    confirmText: clearRepeat ? 'Save progression' : 'Confirm year down',
    content: `<p style="margin:0 0 12px;color:var(--text-secondary);">${escapeHtml(student.name || 'Student')} · ${escapeHtml(student.course || student.program || 'Course')} · currently ${escapeHtml(student.yearLabel || yearLabel(year, duration) || `Year ${year}`)} · ${Number(student.backlogs) || 0} backlog(s).</p><p style="font-size:.8rem;color:var(--text-muted);margin:0 0 14px;">Backlogs are a review signal. Record a year-down only when the Exam Section's progression decision requires the student to repeat.</p>${clearRepeat ? `<div class="form-group"><label class="form-label" for="progression-target-year">Year after clearing repeat</label><select id="progression-target-year" class="form-select">${yearOptions}</select></div>` : ''}<div class="form-group" style="margin-bottom:0;"><label class="form-label" for="progression-reason">Exam decision / reason</label><textarea id="progression-reason" class="form-input" maxlength="500" rows="3" placeholder="Required for the academic record"></textarea></div>`,
    onConfirm: async close => {
      const button = document.getElementById('custom-modal-confirm');
      const reason = document.getElementById('progression-reason').value.trim();
      if (!reason) return showToast('Enter the exam decision reason.', 'warning');
      button.disabled = true;
      try {
        const payload = {
          academicStanding: clearRepeat ? 'CURRENT' : 'YEAR_DOWN',
          academicYear: config.activeAcademicYear || student.academicYear || '',
          reason
        };
        if (clearRepeat) payload.year = Number(document.getElementById('progression-target-year').value);
        const updated = await api.put(`/admissions/students/${encodeURIComponent(student.id)}/lifecycle`, payload);
        Object.assign(student, updated);
        showToast(clearRepeat ? 'Academic progression updated.' : 'Student marked to repeat the same year.', 'success');
        close();
        onSaved();
      } catch (error) {
        showToast(error.message || 'Could not save the academic progression decision.', 'error');
      } finally {
        if (document.getElementById('custom-modal-confirm')) button.disabled = false;
      }
    }
  });
}

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
  const [allStudents, config, results] = await Promise.all([
    StudentService.getAllFresh().catch(() => []),
    AcademicConfigService.get().catch(() => ({ activeAcademicYear: '', courses: [] })),
    ResultService.getAll().catch(error => { console.warn('Published results could not be loaded for analysis:', error); return []; })
  ]);
  const analysis = summarizeResults(results, allStudents);
  const activeStudents = allStudents.filter(student => !['PENDING', 'REJECTED', 'DISABLED', 'SUSPENDED'].includes(String(student.status || '').toUpperCase()) && student.isApproved !== false);
  const progressionCandidates = activeStudents.filter(student => Number(student.backlogs) > 0 || isYearDown(student));
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
          <div class="card" style="padding:22px;margin-bottom:20px;">
            <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:16px;flex-wrap:wrap;margin-bottom:14px;"><div><h3 style="margin:0;">Result coverage and learner analysis</h3><p style="margin:5px 0 0;color:var(--text-secondary);font-size:.84rem;">Latest semester result per active student. Marks bands use subject marks only: slow &lt;50, medium 50–74, advanced ≥75.</p></div><span class="badge badge-info">${analysis.latestLearnerCount}/${analysis.activeStudentCount} students have results</span></div>
            <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:10px;margin-bottom:14px;">
              <div class="stat-card"><div class="stat-label">Published result records</div><div class="stat-value">${analysis.recordCount}</div></div>
              <div class="stat-card"><div class="stat-label">Latest results with marks</div><div class="stat-value">${analysis.assessedCount}<span style="font-size:.72rem;color:var(--text-muted);"> / ${analysis.latestLearnerCount}</span></div></div>
              <div class="stat-card"><div class="stat-label">Mean latest subject marks</div><div class="stat-value">${analysis.averageMarks === null ? '—' : `${analysis.averageMarks.toFixed(1)}%`}</div></div>
              <div class="stat-card"><div class="stat-label">Slow / medium / advanced</div><div class="stat-value" style="font-size:1.15rem;">${analysis.bands.SLOW} / ${analysis.bands.MEDIUM} / ${analysis.bands.ADVANCED}</div><div style="font-size:.72rem;color:var(--text-muted);">${analysis.bands.NOT_ASSESSED} latest results lack subject marks</div></div>
            </div>
            ${analysis.cohorts.length ? `<div style="overflow:auto;"><table class="data-table"><thead><tr><th>Course</th><th>Latest semester</th><th>Students</th><th>Mean marks</th><th>Slow</th><th>Medium</th><th>Advanced</th></tr></thead><tbody>${analysis.cohorts.slice(0, 12).map(cohort => `<tr><td>${escapeHtml(cohort.course)}</td><td>${escapeHtml(cohort.semester)}</td><td>${cohort.students}</td><td>${cohort.averageMarks === null ? '—' : `${cohort.averageMarks.toFixed(1)}%`}<span style="font-size:.7rem;color:var(--text-muted);"> (${cohort.assessed} assessed)</span></td><td>${cohort.slow}</td><td>${cohort.medium}</td><td>${cohort.advanced}</td></tr>`).join('')}</tbody></table></div>` : '<p style="margin:0;color:var(--text-muted);font-size:.84rem;">No active student results have been published yet.</p>'}
          </div>
          <div class="card" style="padding:22px;margin-bottom:20px;">
            <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:14px;flex-wrap:wrap;margin-bottom:12px;"><div><h3 style="margin:0;">Academic progression decisions</h3><p style="margin:5px 0 0;color:var(--text-secondary);font-size:.84rem;">Review students with backlogs and record the formal decision to repeat or progress. A backlog alone does not automatically mark a student year down.</p></div><span id="progression-candidate-count" class="badge ${progressionCandidates.length ? 'badge-warning' : 'badge-success'}">${progressionCandidates.length} need review / already repeating</span></div>
            <div id="exam-progression-queue"></div>
            <div style="border-top:1px solid var(--border);margin-top:16px;padding-top:16px;">
              <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:12px;flex-wrap:wrap;margin-bottom:8px;"><div><h4 style="margin:0;">Bulk progression decisions</h4><p style="margin:4px 0 0;color:var(--text-muted);font-size:.78rem;">Upload official Exam Section decisions by enrollment number. A reason is required for every row.</p></div><button id="download-progression-template" class="btn btn-secondary btn-sm">Download template</button></div>
              <p style="margin:0 0 10px;color:var(--text-muted);font-size:.76rem;">Columns: enrollmentNumber, decision (YEAR_DOWN or PROGRESS), targetYear, academicYear, reason. YEAR_DOWN must keep the current year; PROGRESS can advance or clear a repeat.</p>
              <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;"><input type="file" id="progression-file" accept=".csv,.xlsx,.xls" class="form-input" style="max-width:380px;"><button id="import-progression" class="btn btn-primary" disabled>Save ready decisions</button></div>
              <div id="progression-import-preview" style="margin-top:12px;"></div>
            </div>
          </div>
          <div class="stats-grid" style="grid-template-columns:repeat(auto-fit,minmax(180px,1fr));margin-bottom:20px;">
            <div class="stat-card"><div class="stat-label">Active students</div><div class="stat-value">${analysis.activeStudentCount}</div></div>
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
  const progressionWrap = container.querySelector('#exam-progression-queue');
  const renderProgressionQueue = () => {
    const candidates = activeStudents.filter(student => Number(student.backlogs) > 0 || isYearDown(student));
    const countBadge = container.querySelector('#progression-candidate-count');
    if (countBadge) {
      countBadge.className = `badge ${candidates.length ? 'badge-warning' : 'badge-success'}`;
      countBadge.textContent = `${candidates.length} need review / already repeating`;
    }
    progressionWrap.innerHTML = candidates.length ? `<div style="overflow:auto;"><table class="data-table"><thead><tr><th>Student</th><th>Course / year</th><th>Backlogs</th><th>Standing</th><th>Exam decision</th></tr></thead><tbody>${candidates.slice(0, 40).map(student => {
      const repeating = isYearDown(student);
      return `<tr><td>${escapeHtml(student.name || 'Student')}<div style="font-size:.72rem;color:var(--text-muted);">${escapeHtml(student.enrollmentNumber || '')}</div></td><td>${escapeHtml(student.course || student.program || '—')} · ${escapeHtml(student.yearLabel || yearLabel(student.year, student.durationYears) || '—')}</td><td>${Number(student.backlogs) || 0}</td><td><span class="badge ${repeating ? 'badge-danger' : 'badge-warning'}">${repeating ? 'Repeating year' : 'Review required'}</span></td><td><button class="btn btn-xs ${repeating ? 'btn-secondary' : 'btn-primary'} progression-decision" data-student-id="${escapeHtml(student.id)}" data-action="${repeating ? 'CLEAR' : 'REPEAT'}">${repeating ? 'Clear / progress' : 'Record repeat decision'}</button>${repeating && student.yearDownReason ? `<div style="font-size:.7rem;color:var(--text-muted);margin-top:4px;">${escapeHtml(student.yearDownReason)}</div>` : ''}</td></tr>`;
    }).join('')}</tbody></table></div>${candidates.length > 40 ? `<p style="font-size:.75rem;color:var(--text-muted);">Showing 40 of ${candidates.length} records.</p>` : ''}` : '<p style="margin:0;color:var(--text-muted);font-size:.84rem;">No students with backlogs or active repeat-year decisions are listed.</p>';
    progressionWrap.querySelectorAll('.progression-decision').forEach(button => button.addEventListener('click', () => {
      const student = activeStudents.find(item => item.id === button.dataset.studentId);
      if (student) openProgressionDecision(student, config, button.dataset.action, renderProgressionQueue);
    }));
  };
  renderProgressionQueue();
  container.querySelector('#download-progression-template').addEventListener('click', downloadProgressionTemplate);
  const progressionFile = container.querySelector('#progression-file');
  const progressionPreview = container.querySelector('#progression-import-preview');
  const progressionButton = container.querySelector('#import-progression');
  let progressionRows = [];
  let progressionImporting = false;
  let progressionProgress = '';
  const renderProgressionPreview = () => {
    const ready = progressionRows.filter(row => !row.validationError && !row.saved);
    progressionButton.disabled = progressionImporting || ready.length === 0;
    progressionButton.textContent = progressionImporting ? progressionProgress : ready.length ? `Save ${ready.length} ready decision(s)` : 'Save ready decisions';
    progressionPreview.innerHTML = progressionRows.length
      ? `<p style="margin:0 0 8px;font-size:.78rem;font-weight:600;">${ready.length} ready · ${progressionRows.filter(row => row.saved).length} saved · ${progressionRows.filter(row => row.error || row.validationError).length} skipped / failed</p><div style="max-height:280px;overflow:auto;"><table class="data-table"><thead><tr><th>Enrollment</th><th>Student</th><th>Decision</th><th>Target year</th><th>Academic year</th><th>Status</th></tr></thead><tbody>${progressionRows.slice(0, 250).map(row => `<tr><td>${escapeHtml(row.enrollmentNumber || '—')}</td><td>${escapeHtml(row.student?.name || '—')}</td><td>${escapeHtml(row.decision || '—')}</td><td>${row.targetYear || '—'}</td><td>${escapeHtml(row.academicYear || '—')}</td><td><span class="badge ${row.saved ? 'badge-success' : row.error || row.validationError ? 'badge-danger' : 'badge-info'}">${escapeHtml(row.saved ? 'Saved' : row.error || row.validationError || 'Ready')}</span></td></tr>`).join('')}</tbody></table></div>${progressionRows.length > 250 ? '<small style="color:var(--text-muted);">Showing 250 of ' + progressionRows.length + ' rows.</small>' : ''}`
      : '';
  };
  progressionFile.addEventListener('change', async () => {
    progressionRows = [];
    progressionPreview.innerHTML = '';
    progressionButton.disabled = true;
    const file = progressionFile.files?.[0];
    if (!file) return;
    try {
      const matrix = await parseImportFile(file);
      if (matrix.length < 2) throw new Error('The progression file has no data rows.');
      const headers = matrix[0].map(progressionKey);
      if (!headers.includes('enrollmentNumber') || !headers.includes('decision') || !headers.includes('reason')) throw new Error('The file must include enrollmentNumber, decision and reason columns.');
      const studentByEnrollment = new Map();
      activeStudents.forEach(student => {
        const key = String(student.enrollmentNumber || '').trim().toLowerCase();
        if (key) studentByEnrollment.set(key, student);
      });
      const seen = new Set();
      progressionRows = matrix.slice(1).map(cells => {
        const row = {};
        headers.forEach((header, index) => { row[header] = String(cells[index] ?? '').trim(); });
        const enrollmentNumber = String(row.enrollmentNumber || '').trim();
        const student = studentByEnrollment.get(enrollmentNumber.toLowerCase());
        const rawDecision = String(row.decision || '').trim().toUpperCase().replace(/[\s-]+/g, '_');
        const decision = ['YEAR_DOWN', 'REPEAT', 'REPEAT_YEAR'].includes(rawDecision) ? 'YEAR_DOWN'
          : ['PROGRESS', 'ADVANCE', 'CLEAR', 'CURRENT'].includes(rawDecision) ? 'PROGRESS' : '';
        const course = (config.courses || []).find(item => String(item.name || '').trim().toLowerCase() === String(student?.course || student?.program || '').trim().toLowerCase());
        const duration = Number(student?.durationYears || course?.durationYears) || 0;
        const currentYear = Number(student?.year) || 1;
        const targetYear = row.targetYear === ''
          ? decision === 'PROGRESS' && isYearDown(student) && currentYear < duration ? currentYear + 1 : currentYear
          : Number(row.targetYear);
        const reason = String(row.reason || '').trim().slice(0, 500);
        const academicYear = String(row.academicYear || config.activeAcademicYear || student?.academicYear || '').trim().slice(0, 20);
        let validationError = '';
        if (!enrollmentNumber) validationError = 'Enrollment number is required';
        else if (!student) validationError = 'Enrollment number was not found in active students';
        else if (seen.has(enrollmentNumber.toLowerCase())) validationError = 'Enrollment appears more than once in this file';
        else if (!decision) validationError = 'Decision must be YEAR_DOWN or PROGRESS';
        else if (!Number.isInteger(duration) || duration < 1) validationError = 'Configure course duration before importing progression';
        else if (!Number.isInteger(targetYear) || targetYear < 1 || targetYear > duration) validationError = `Target year must be between 1 and ${duration}`;
        else if (decision === 'YEAR_DOWN' && targetYear !== currentYear) validationError = 'Year-down must keep the student in their current year';
        else if (decision === 'PROGRESS' && targetYear < currentYear) validationError = 'A progression decision cannot move a student to an earlier year';
        else if (decision === 'PROGRESS' && targetYear === currentYear && !isYearDown(student)) validationError = 'Choose a later year for a student who is not repeating';
        else if (!reason) validationError = 'Decision reason is required';
        if (!validationError) seen.add(enrollmentNumber.toLowerCase());
        return { enrollmentNumber, student, decision, targetYear, academicYear, reason, validationError, error: '', saved: false };
      }).filter(row => row.enrollmentNumber || row.decision || row.reason);
      renderProgressionPreview();
    } catch (error) {
      progressionPreview.innerHTML = `<p class="text-danger">${escapeHtml(error.message || 'Could not read progression file.')}</p>`;
      showToast(error.message || 'Could not read progression file.', 'error');
    }
  });
  progressionButton.addEventListener('click', async () => {
    const ready = progressionRows.filter(row => !row.validationError && !row.saved);
    if (!ready.length) return;
    progressionImporting = true;
    let saved = 0;
    for (let index = 0; index < ready.length; index++) {
      const row = ready[index];
      row.error = '';
      try {
        const updated = await api.put(`/admissions/students/${encodeURIComponent(row.student.id)}/lifecycle`, {
          academicStanding: row.decision === 'YEAR_DOWN' ? 'YEAR_DOWN' : 'CURRENT',
          year: row.targetYear,
          academicYear: row.academicYear,
          reason: row.reason
        });
        Object.assign(row.student, updated);
        row.saved = true;
        saved++;
      } catch (error) {
        row.error = error.message || 'Could not save progression decision';
      }
      progressionProgress = `Saving ${index + 1} / ${ready.length}…`;
      renderProgressionPreview();
    }
    progressionImporting = false;
    progressionProgress = '';
    renderProgressionPreview();
    renderProgressionQueue();
    showToast(`${saved} progression decision(s) saved${ready.length - saved ? `, ${ready.length - saved} failed` : ''}.`, saved ? 'success' : 'error');
  });
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
