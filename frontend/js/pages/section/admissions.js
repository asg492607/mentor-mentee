import { getUserProfile } from '/js/auth.js';
import { createSidebar } from '/js/components/sidebar.js';
import { createHeader } from '/js/components/header.js';
import { showToast } from '/js/components/toast.js';
import { StudentService, ClassService, DepartmentService } from '/js/services.js';
import { api } from '/js/api.js';
import { AcademicConfigService, yearNumber, yearLabel } from '/js/services/academic-service.js';
import { parseImportFile } from '/js/excel-import.js';
import { escapeHtml } from '/js/utils.js';

const fieldAliases = {
  name: ['name', 'fullname', 'studentname'],
  enrollmentNumber: ['enrollmentnumber', 'enrollmentno', 'enrollment', 'rollno', 'rollnumber', 'studentid'],
  email: ['email', 'emailaddress', 'studentemail'],
  mobileNumber: ['mobile', 'mobilenumber', 'phone', 'contact', 'mobileno'],
  department: ['department', 'dept', 'branch', 'specialization'],
  school: ['school', 'schoolname', 'college', 'collegeof'],
  course: ['course', 'coursename', 'program', 'programname', 'programme', 'degree'],
  class: ['class', 'section', 'division', 'batch'],
  year: ['year', 'studyyear', 'currentyear', 'yearofstudy'],
  admissionYear: ['admissionyear', 'joiningyear', 'entryyear'],
  academicYear: ['academicyear', 'session', 'academicsession']
};

function normalizeKey(value) {
  const key = String(value || '').toLowerCase().replace(/[^a-z0-9]/g, '');
  return Object.entries(fieldAliases).find(([, aliases]) => aliases.includes(key))?.[0] || key;
}

function downloadTemplate() {
  const csv = 'name,enrollmentNumber,email,mobileNumber,school,department,course,class,year,admissionYear,academicYear\nSample Student,STU001,student@example.edu,0000000000,School of Engineering,Computer Science,BTech,CS-A,FY,2026,2026-27\n';
  const link = document.createElement('a');
  link.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
  link.download = 'admission-list-template.csv';
  link.click();
  URL.revokeObjectURL(link.href);
}

export async function render(container) {
  const user = getUserProfile();
  await DepartmentService.backfillReferences().catch(error => console.warn('Academic links could not be refreshed:', error));
  let config = await AcademicConfigService.get().catch(() => ({ activeAcademicYear: '', courses: [] }));
  let students = await StudentService.getAllFresh().catch(() => []);
  const allInstitutionRecords = await DepartmentService.getAll().catch(() => []);
  let departments = allInstitutionRecords.filter(item => !['SCHOOL', 'COLLEGE'].includes(String(item.type || '').toUpperCase()));
  const schools = allInstitutionRecords.filter(item => ['SCHOOL', 'COLLEGE'].includes(String(item.type || '').toUpperCase()));
  let preview = [];

  container.innerHTML = `
    <div class="dashboard-layout fade-in">
      ${createSidebar(user.role, '/section/dashboard', user.department)}
      <div class="main-content">
        ${createHeader('Admissions Dashboard', user)}
        <div class="page-content">
          <div class="dashboard-container">
            <div class="card" style="padding:24px;margin-bottom:20px;background:linear-gradient(135deg,var(--accent-light),var(--bg-card));">
              <div style="display:flex;justify-content:space-between;gap:16px;align-items:center;flex-wrap:wrap;">
                <div><span class="badge badge-accent">ADMISSION CELL</span><h2 style="margin:10px 0 4px;">Student intake and academic setup</h2><p style="margin:0;color:var(--text-secondary);">Import the admitted student register. Their course, cohort and year will be available to mentors and class teachers.</p></div>
                <div style="min-width:180px;text-align:center;padding:14px 20px;border-radius:12px;background:var(--bg-card);"><div class="stat-label">Registered students</div><div class="stat-value" id="admission-count">…</div></div>
              </div>
            </div>
            <div class="card" style="padding:22px;margin-bottom:20px;">
              <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:16px;flex-wrap:wrap;margin-bottom:14px;">
                <div><h3 style="margin:0;">Academic year and course durations</h3><p style="margin:5px 0 0;color:var(--text-secondary);font-size:.84rem;">Configure the course list once. Year labels (FY, SY, TY, LY) follow the selected course duration.</p></div>
                <div class="form-group" style="margin:0;min-width:180px;"><label class="form-label">Active academic year</label><input id="active-academic-year" class="form-input" value="${escapeHtml(config.activeAcademicYear || '')}" placeholder="2026-27"></div>
              </div>
              <div style="display:grid;grid-template-columns:minmax(200px,1fr) 150px auto;gap:10px;align-items:end;max-width:650px;">
                <div class="form-group" style="margin:0;"><label class="form-label">Course / programme</label><input id="course-name" class="form-input" placeholder="e.g. BTech CSE"></div>
                <div class="form-group" style="margin:0;"><label class="form-label">Duration (years)</label><input id="course-duration" class="form-input" type="number" min="1" max="8" placeholder="1–8" required></div>
                <button class="btn btn-secondary" id="add-course">Add course</button>
              </div>
              <div id="course-list" style="display:flex;gap:8px;flex-wrap:wrap;margin-top:14px;"></div>
              <div style="display:flex;justify-content:flex-end;margin-top:14px;"><button class="btn btn-primary" id="save-academic-config">Save academic setup</button></div>
            </div>
            <div class="card" style="padding:22px;">
              <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:16px;flex-wrap:wrap;margin-bottom:16px;">
              <div><h3 style="margin:0;">Import admission list</h3><p style="margin:5px 0 0;color:var(--text-secondary);font-size:.84rem;">CSV or Excel. Required: name, enrollment number, email, mobile, department and course. Add School when departments share a name. The mobile number is the initial password.</p></div>
                <button class="btn btn-secondary btn-sm" id="download-admission-template">Download template</button>
              </div>
              <input type="file" id="admission-file" accept=".csv,.xlsx,.xls" class="form-input" style="max-width:480px;">
              <div id="admission-preview" style="margin-top:16px;"></div>
              <div style="display:flex;justify-content:flex-end;margin-top:14px;"><button class="btn btn-primary" id="import-admissions" disabled>Import ready students</button></div>
            </div>
            <div class="card" style="padding:22px;margin-top:20px;">
              <div style="display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap;margin-bottom:12px;"><div><h3 style="margin:0;">Admitted student directory</h3><p style="margin:5px 0 0;color:var(--text-secondary);font-size:.84rem;">Review current intake records and their mentor allocation status.</p></div><div style="display:flex;gap:8px;flex-wrap:wrap;"><select id="admission-course-filter" class="form-select" style="min-width:180px;"><option value="">All courses</option></select><select id="admission-year-filter" class="form-select" style="min-width:140px;"><option value="">All years</option></select></div></div>
              <div id="admission-directory"></div>
            </div>
          </div>
        </div>
      </div>
    </div>`;

  const courseList = container.querySelector('#course-list');
  const directory = container.querySelector('#admission-directory');
  const courseFilter = container.querySelector('#admission-course-filter');
  const yearFilter = container.querySelector('#admission-year-filter');
  const renderDirectory = () => {
    const courses = [...new Set(students.map(student => student.course || student.program).filter(Boolean))].sort();
    const selectedCourse = courseFilter.value;
    const selectedYear = yearFilter.value;
    courseFilter.innerHTML = '<option value="">All courses</option>' + courses.map(course => `<option value="${escapeHtml(course)}">${escapeHtml(course)}</option>`).join('');
    courseFilter.value = selectedCourse;
    const maxYears = Math.max(1, ...[...(config.courses || []).map(course => Number(course.durationYears) || 0), ...students.map(student => Number(student.durationYears) || 0)]);
    yearFilter.innerHTML = '<option value="">All years</option>' + Array.from({ length: Math.min(8, maxYears) }, (_, index) => {
      const year = index + 1;
      return `<option value="${year}">${escapeHtml(yearLabel(year, maxYears) || `Year ${year}`)}</option>`;
    }).join('');
    yearFilter.value = selectedYear;
    const list = students.filter(student => (!courseFilter.value || (student.course || student.program) === courseFilter.value) && (!yearFilter.value || String(student.year || '') === yearFilter.value));
    directory.innerHTML = list.length ? `<div style="overflow:auto;"><table class="data-table"><thead><tr><th>Student</th><th>Enrollment</th><th>School / Department</th><th>Course</th><th>Year</th><th>Academic year</th><th>Mentor</th></tr></thead><tbody>${list.slice(0, 50).map(student => `<tr><td>${escapeHtml(student.name || '—')}<div style="font-size:.74rem;color:var(--text-muted);">${escapeHtml(student.email || '')}</div></td><td>${escapeHtml(student.enrollmentNumber || '—')}</td><td>${escapeHtml(student.schoolName || '—')}<div style="font-size:.74rem;color:var(--text-muted);">${escapeHtml(student.department || '')}</div></td><td>${escapeHtml(student.course || student.program || '—')}</td><td>${escapeHtml(student.yearLabel || yearLabel(student.year, student.durationYears) || '—')}</td><td>${escapeHtml(student.academicYear || '—')}</td><td>${student.mentorId ? 'Assigned' : '<span class="badge badge-warning">Pending</span>'}</td></tr>`).join('')}</tbody></table></div><p style="margin:8px 0 0;font-size:.75rem;color:var(--text-muted);">Showing ${Math.min(list.length, 50)} of ${list.length} matching students.</p>` : '<div class="empty-state" style="padding:24px;"><h3>No admitted students match these filters</h3></div>';
  };
  courseFilter.addEventListener('change', renderDirectory);
  yearFilter.addEventListener('change', renderDirectory);
  const renderCourses = () => {
    courseList.innerHTML = (config.courses || []).map((course, index) => {
      const duration = Number(course.durationYears);
      const description = Number.isInteger(duration) && duration >= 1 && duration <= 8
        ? `${duration} years · ${duration * 2} semesters · 6 months each`
        : 'Duration required';
      return `<span class="badge badge-info" style="padding:7px 10px;display:inline-flex;gap:8px;align-items:center;">${escapeHtml(course.name)} · ${description} <button class="remove-course" data-index="${index}" aria-label="Remove course" style="border:0;background:transparent;color:inherit;cursor:pointer;">×</button></span>`;
    }).join('') || '<span style="font-size:.82rem;color:var(--text-muted);">No courses configured yet.</span>';
    courseList.querySelectorAll('.remove-course').forEach(button => button.addEventListener('click', () => {
      config.courses.splice(Number(button.dataset.index), 1);
      renderCourses();
    }));
  };
  renderCourses();
  container.querySelector('#admission-count').textContent = students.length;
  renderDirectory();

  container.querySelector('#add-course').addEventListener('click', () => {
    const name = container.querySelector('#course-name').value.trim();
    const durationYears = Number(container.querySelector('#course-duration').value);
    if (!name || !Number.isInteger(durationYears) || durationYears < 1 || durationYears > 8) return showToast('Enter a course name and duration from 1 to 8 years.', 'warning');
    if ((config.courses || []).some(course => course.name.toLowerCase() === name.toLowerCase())) return showToast('That course is already configured.', 'warning');
    config.courses = [...(config.courses || []), { name, durationYears, semesterCount: durationYears * 2, semesterDurationMonths: 6 }];
    container.querySelector('#course-name').value = '';
    renderCourses();
  });
  container.querySelector('#save-academic-config').addEventListener('click', async event => {
    const button = event.currentTarget;
    button.disabled = true;
    try {
      config.activeAcademicYear = container.querySelector('#active-academic-year').value.trim();
      await AcademicConfigService.save(config);
      showToast('Academic setup saved.', 'success');
    } catch (error) { showToast(error.message || 'Could not save academic setup.', 'error'); }
    finally { button.disabled = false; }
  });
  container.querySelector('#download-admission-template').addEventListener('click', downloadTemplate);

  const fileInput = container.querySelector('#admission-file');
  const previewWrap = container.querySelector('#admission-preview');
  const importButton = container.querySelector('#import-admissions');
  fileInput.addEventListener('change', async () => {
    preview = [];
    importButton.disabled = true;
    try {
      const rows = await parseImportFile(fileInput.files[0]);
      if (!rows || rows.length < 2) throw new Error('The selected file has no student rows.');
      const headers = rows[0].map(normalizeKey);
      const existingEmails = new Set(students.map(student => String(student.email || '').toLowerCase()));
      const existingEnrollments = new Set(students.map(student => String(student.enrollmentNumber || '').toLowerCase()));
      const seenEmails = new Set();
      const seenEnrollments = new Set();
      preview = rows.slice(1).map(cells => {
        const row = {};
        headers.forEach((header, index) => { row[header] = String(cells[index] ?? '').trim(); });
        const email = row.email?.toLowerCase();
        const enrollment = row.enrollmentNumber?.toLowerCase();
        const course = (config.courses || []).find(item => item.name.toLowerCase() === String(row.course || '').toLowerCase());
        const duration = course?.durationYears || 0;
        const year = yearNumber(row.year || 'FY') || 1;
        let error = '';
        if (!row.name || !row.email || !row.mobileNumber || !row.enrollmentNumber || !row.department || !row.course) error = 'Missing required field';
        else if (!row.email.includes('@')) error = 'Invalid email';
        else if (row.mobileNumber.length < 6) error = 'Mobile/password must be 6+ characters';
        else if (existingEmails.has(email) || seenEmails.has(email) || existingEnrollments.has(enrollment) || seenEnrollments.has(enrollment)) error = 'Duplicate email or enrollment number';
        else if (!config.courses?.length) error = 'Configure course names and durations before importing';
        else if (!course) error = 'Course is not configured';
        else if (year > duration) error = `Year exceeds ${duration}-year course`;
        const deptMatches = departments.filter(item => String(item.name || '').trim().toLowerCase() === String(row.department || '').trim().toLowerCase());
        const schoolMatch = row.school ? deptMatches.find(item => {
          const linkedSchool = allInstitutionRecords.find(school => school.id === item.schoolId);
          return String(linkedSchool?.name || item.schoolName || '').trim().toLowerCase() === row.school.toLowerCase();
        }) : null;
        const departmentRecord = row.school ? schoolMatch : (deptMatches.length === 1 ? deptMatches[0] : null);
        if (!error && departments.length && !departmentRecord) error = deptMatches.length > 1 ? 'School is required to identify this department' : 'Department is not configured under a school';
        else if (!error && schools.length && !departmentRecord?.schoolId) error = 'Department must be linked to a school first';
        if (!error) { seenEmails.add(email); seenEnrollments.add(enrollment); }
        return { ...row, departmentId: departmentRecord?.id || null, schoolId: departmentRecord?.schoolId || null, schoolName: departmentRecord?.schoolName || allInstitutionRecords.find(school => school.id === departmentRecord?.schoolId)?.name || null, year, yearLabel: yearLabel(year, duration), durationYears: duration, status: error ? 'Skipped' : 'Ready', error };
      }).filter(row => row.name || row.email || row.enrollmentNumber);
      const ready = preview.filter(row => row.status === 'Ready').length;
      previewWrap.innerHTML = `<p style="margin:0 0 8px;font-weight:600;">${ready} ready · ${preview.length - ready} skipped</p><div style="max-height:320px;overflow:auto;"><table class="data-table"><thead><tr><th>Student</th><th>Enrollment</th><th>School / Department</th><th>Course / Year</th><th>Status</th></tr></thead><tbody>${preview.map(row => `<tr><td>${escapeHtml(row.name || '—')}</td><td>${escapeHtml(row.enrollmentNumber || '—')}</td><td>${escapeHtml(row.schoolName || row.school || '—')}<div style="font-size:.74rem;color:var(--text-muted);">${escapeHtml(row.department || '—')}</div></td><td>${escapeHtml(row.course || '—')} · ${escapeHtml(row.yearLabel || '—')}</td><td><span class="badge ${row.error ? 'badge-warning' : 'badge-success'}">${escapeHtml(row.error || 'Ready')}</span></td></tr>`).join('')}</tbody></table></div>`;
      importButton.disabled = !ready;
    } catch (error) {
      previewWrap.innerHTML = `<p class="text-danger">${escapeHtml(error.message || 'Could not read file.')}</p>`;
      showToast(error.message || 'Could not read file.', 'error');
    }
  });

  importButton.addEventListener('click', async () => {
    const ready = preview.filter(row => row.status === 'Ready');
    if (!ready.length) return;
    importButton.disabled = true;
    importButton.textContent = `Importing 0 / ${ready.length}…`;
    let created = 0;
    let failed = 0;
    const activeYear = container.querySelector('#active-academic-year').value.trim() || config.activeAcademicYear || '';
    for (let index = 0; index < ready.length; index++) {
      const row = ready[index];
      try {
        let classRecord = null;
        if (row.class) {
          const knownClasses = row.departmentId ? await ClassService.getByDepartmentId(row.departmentId) : await ClassService.getByDepartment(row.department);
          classRecord = knownClasses.find(item => String(item.className || '').toLowerCase() === row.class.toLowerCase()) || null;
          if (!classRecord) throw new Error(`Classroom “${row.class}” is not configured for ${row.department}. Ask an administrator or HOD to create it, then retry this student.`);
        }
        const profile = await api.post('/admissions/students', {
          role: 'STUDENT', name: row.name, email: row.email, password: row.mobileNumber,
          mobileNumber: row.mobileNumber, enrollmentNumber: row.enrollmentNumber,
          department: row.department, departmentId: row.departmentId, schoolId: row.schoolId, schoolName: row.schoolName,
          course: row.course, program: row.course,
          class: row.class || null, classId: classRecord?.id || null, year: row.year, yearLabel: row.yearLabel,
          durationYears: row.durationYears, semesterCount: row.durationYears * 2, semesterDurationMonths: 6, admissionYear: Number(row.admissionYear) || new Date().getFullYear(),
          academicYear: row.academicYear || activeYear, admissionStatus: 'ADMITTED'
        });
        students.unshift({ ...profile, role: 'STUDENT' });
        created++;
      } catch (error) {
        failed++;
        row.error = error.message || 'Import failed';
      }
      importButton.textContent = `Importing ${index + 1} / ${ready.length}…`;
    }
    container.querySelector('#admission-count').textContent = students.length;
    renderDirectory();
    importButton.textContent = 'Import ready students';
    importButton.disabled = false;
    showToast(`${created} student account(s) created${failed ? `, ${failed} failed` : ''}.`, created ? 'success' : 'error');
  });
}
