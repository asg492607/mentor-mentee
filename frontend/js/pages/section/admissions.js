import { getUserProfile } from '/js/auth.js';
import { createSidebar } from '/js/components/sidebar.js';
import { createHeader } from '/js/components/header.js';
import { showToast } from '/js/components/toast.js';
import { showModal } from '/js/components/modal.js';
import { StudentService, ClassService, DepartmentService } from '/js/services.js';
import { api } from '/js/api.js';
import { AcademicConfigService, FinanceService, yearNumber, yearLabel } from '/js/services/academic-service.js';
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
  academicYear: ['academicyear', 'session', 'academicsession'],
  admissionStatus: ['admissionstatus', 'admissiontype'],
  provisionalUntil: ['provisionaluntil', 'provisionalduedate', 'reviewdate']
};

function normalizeKey(value) {
  const key = String(value || '').toLowerCase().replace(/[^a-z0-9]/g, '');
  return Object.entries(fieldAliases).find(([, aliases]) => aliases.includes(key))?.[0] || key;
}

function downloadTemplate() {
  const csv = 'name,enrollmentNumber,email,mobileNumber,school,department,course,class,year,admissionYear,academicYear,admissionStatus,provisionalUntil\nSample Student,STU001,student@example.edu,0000000000,School of Engineering,Computer Science,BTech,CS-A,FY,2026,2026-27,ADMITTED,\n';
  const link = document.createElement('a');
  link.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
  link.download = 'admission-list-template.csv';
  link.click();
  URL.revokeObjectURL(link.href);
}

function buildIntakeCohorts(students) {
  const cohorts = new Map();
  students.forEach(student => {
    const school = String(student.schoolName || student.schoolId || 'School not set');
    const department = String(student.department || 'Department not set');
    const course = String(student.course || student.program || 'Course not set');
    const year = String(student.yearLabel || student.year || 'Year not set');
    const key = [school, department, course, year].map(value => value.trim().toLowerCase()).join('|');
    const cohort = cohorts.get(key) || { school, department, course, year, total: 0, assigned: 0 };
    cohort.total++;
    if (student.mentorId) cohort.assigned++;
    cohorts.set(key, cohort);
  });
  return [...cohorts.values()].sort((a, b) => (b.total - b.assigned) - (a.total - a.assigned) || b.total - a.total);
}

function money(value) {
  const amount = Number(value);
  return Number.isFinite(amount) ? new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(amount) : '—';
}

function isIsoDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

function feeStatusBadge(status) {
  const styles = { PAID: 'badge-success', PARTIAL: 'badge-warning', DUE: 'badge-info', OVERDUE: 'badge-danger', NOT_SET: 'badge-muted', UNAVAILABLE: 'badge-muted' };
  const label = status === 'NOT_SET' ? 'Not set' : status === 'UNAVAILABLE' ? 'Unavailable' : status || 'Not set';
  return `<span class="badge ${styles[status] || 'badge-muted'}">${escapeHtml(label)}</span>`;
}

function openLifecycleModal(student, finance, onSaved) {
  const currentAdmission = String(student.admissionStatus || 'ADMITTED').toUpperCase();
  const isYearDown = student.yearDown === true || String(student.academicStanding || '').toUpperCase() === 'YEAR_DOWN';
  const paymentId = globalThis.crypto?.randomUUID?.() || `pay-${Date.now()}-${Math.random().toString(36).slice(2, 12)}`;
  let lifecycleSaved = false;
  showModal({
    title: `Student record · ${escapeHtml(student.name || student.enrollmentNumber || 'Student')}`,
    size: 'lg',
    confirmText: 'Save student record',
    content: `
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(230px,1fr));gap:16px;">
        <section style="border:1px solid var(--border);border-radius:12px;padding:14px;">
          <h4 style="margin:0 0 12px;">Admission and academic standing</h4>
          <div class="form-group"><label class="form-label" for="life-admission-status">Admission status</label><select id="life-admission-status" class="form-select"><option value="ADMITTED" ${currentAdmission === 'ADMITTED' ? 'selected' : ''}>Admitted</option><option value="PROVISIONAL" ${currentAdmission === 'PROVISIONAL' ? 'selected' : ''}>Provisional admission</option></select></div>
          <div class="form-group"><label class="form-label" for="life-provisional-until">Provisional review date</label><input id="life-provisional-until" type="date" class="form-input" value="${escapeHtml(student.provisionalUntil || '')}"></div>
          <div class="form-group"><label class="form-label" for="life-admission-notes">Admission notes / pending documents</label><textarea id="life-admission-notes" class="form-input" maxlength="500" rows="3">${escapeHtml(student.admissionNotes || '')}</textarea></div>
          <div class="form-group"><label class="form-label">Academic standing</label><div class="form-input" style="height:auto;min-height:40px;display:flex;align-items:center;">${isYearDown ? 'Repeating the same year' : 'Current year'}</div></div>
          ${isYearDown && student.yearDownReason ? `<p style="margin:0;color:var(--text-muted);font-size:.75rem;">Exam decision: ${escapeHtml(student.yearDownReason)}</p>` : ''}
          <p style="margin:8px 0 0;color:var(--text-muted);font-size:.75rem;">The Exam Section records year-down and progression decisions. A repeat keeps the student in ${escapeHtml(student.yearLabel || yearLabel(student.year, student.durationYears) || 'their current year')}.</p>
        </section>
        <section style="border:1px solid var(--border);border-radius:12px;padding:14px;">
          <h4 style="margin:0 0 4px;">Fee ledger · INR</h4><p style="margin:0 0 12px;color:var(--text-muted);font-size:.76rem;">Paid amounts are recorded as separate ledger entries and cannot exceed the outstanding balance.</p>
          <div class="form-group"><label class="form-label" for="life-total-fee">Total fee</label><input id="life-total-fee" type="number" min="0" step="0.01" class="form-input" value="${finance?.totalAmount ?? ''}" placeholder="Total fee in ₹"></div>
          <div style="font-size:.78rem;color:var(--text-secondary);margin:-4px 0 12px;">Paid ${money(finance?.amountPaid)} · Outstanding ${money(finance?.outstandingAmount)}</div>
          <div class="form-group"><label class="form-label" for="life-payment-amount">New payment received</label><input id="life-payment-amount" type="number" min="0" step="0.01" class="form-input" placeholder="Leave blank if no payment"></div>
          <div class="form-group"><label class="form-label" for="life-payment-reference">Receipt / transaction reference</label><input id="life-payment-reference" class="form-input" maxlength="100" placeholder="Optional reference"></div>
          <div class="form-group"><label class="form-label" for="life-fee-due-date">Fee due date</label><input id="life-fee-due-date" type="date" class="form-input" value="${escapeHtml(finance?.dueDate || '')}"></div>
          <div class="form-group" style="margin-bottom:0;"><label class="form-label" for="life-fee-note">Fee note / payment note</label><textarea id="life-fee-note" class="form-input" maxlength="500" rows="3" placeholder="Optional note">${escapeHtml(finance?.notes || '')}</textarea></div>
        </section>
      </div>`,
    onConfirm: async close => {
      const button = document.getElementById('custom-modal-confirm');
      const admissionStatus = document.getElementById('life-admission-status').value;
      const paymentAmount = document.getElementById('life-payment-amount').value.trim();
      const totalAmount = document.getElementById('life-total-fee').value.trim();
      const dueDate = document.getElementById('life-fee-due-date').value;
      if (totalAmount !== '' && (!Number.isFinite(Number(totalAmount)) || Number(totalAmount) < 0)) return showToast('Enter a valid non-negative total fee.', 'warning');
      if (paymentAmount !== '' && (!Number.isFinite(Number(paymentAmount)) || Number(paymentAmount) <= 0)) return showToast('Enter a valid payment amount greater than zero.', 'warning');
      if (paymentAmount && totalAmount === '' && finance?.totalAmount == null) return showToast('Set a total fee before recording a payment.', 'warning');
      button.disabled = true;
      try {
        const updated = await api.put(`/admissions/students/${encodeURIComponent(student.id)}/lifecycle`, {
          admissionStatus,
          provisionalUntil: document.getElementById('life-provisional-until').value,
          admissionNotes: document.getElementById('life-admission-notes').value
        });
        lifecycleSaved = true;
        Object.assign(student, updated);
        const hasFinanceUpdate = totalAmount !== '' || paymentAmount !== '' || dueDate !== '' || Boolean(document.getElementById('life-fee-note').value.trim());
        if (hasFinanceUpdate) {
          const savedFinance = await FinanceService.update(student.id, {
            ...(totalAmount !== '' ? { totalAmount: Number(totalAmount) } : {}),
            ...(paymentAmount !== '' ? { paymentAmount: Number(paymentAmount) } : {}),
            ...(paymentAmount !== '' ? { paymentId } : {}),
            dueDate,
            note: document.getElementById('life-fee-note').value,
            reference: document.getElementById('life-payment-reference').value
          });
          onSaved.finance(savedFinance);
        }
        showToast('Student status and fee record saved.', 'success');
        close();
        await onSaved.render();
      } catch (error) {
        showToast(lifecycleSaved ? `Student status saved, but the fee update failed: ${error.message || 'try again.'}` : error.message || 'Could not save the student record.', 'error');
      } finally {
        if (document.getElementById('custom-modal-confirm')) button.disabled = false;
      }
    }
  });
}

export async function render(container) {
  const user = getUserProfile();
  await DepartmentService.backfillReferences().catch(error => console.warn('Academic links could not be refreshed:', error));
  let config = await AcademicConfigService.get().catch(() => ({ activeAcademicYear: '', courses: [] }));
  let students = await StudentService.getAllFresh().catch(() => []);
  let financeUnavailable = false;
  let financeRecords = await FinanceService.getAll().catch(error => { financeUnavailable = true; console.warn('Student fee summaries could not be loaded:', error); return []; });
  const financeByStudent = new Map(financeRecords.map(record => [record.studentId, record]));
  const allInstitutionRecords = await DepartmentService.getAll().catch(() => []);
  let departments = allInstitutionRecords.filter(item => !['SCHOOL', 'COLLEGE'].includes(String(item.type || '').toUpperCase()));
  const schools = allInstitutionRecords.filter(item => ['SCHOOL', 'COLLEGE'].includes(String(item.type || '').toUpperCase()));
  let preview = [];
  const activeStudents = students.filter(student => !['PENDING', 'REJECTED', 'DISABLED', 'SUSPENDED'].includes(String(student.status || '').toUpperCase()) && student.isApproved !== false);
  const pendingStudents = students.length - activeStudents.length;
  const assignedStudents = activeStudents.filter(student => student.mentorId).length;
  const intakeCohorts = buildIntakeCohorts(activeStudents);
  const overallAssignmentCoverage = activeStudents.length ? Math.round(assignedStudents / activeStudents.length * 100) : 0;
  const provisionalCount = activeStudents.filter(student => String(student.admissionStatus || '').toUpperCase() === 'PROVISIONAL').length;
  const provisionalOverdueCount = activeStudents.filter(student => String(student.admissionStatus || '').toUpperCase() === 'PROVISIONAL' && student.provisionalUntil && student.provisionalUntil < new Date().toISOString().slice(0, 10)).length;
  const yearDownCount = activeStudents.filter(student => student.yearDown === true || String(student.academicStanding || '').toUpperCase() === 'YEAR_DOWN').length;
  const billedTotal = financeRecords.reduce((sum, record) => sum + (Number(record.totalAmount) || 0), 0);
  const paidTotal = financeRecords.reduce((sum, record) => sum + (Number(record.amountPaid) || 0), 0);
  const outstandingTotal = financeRecords.reduce((sum, record) => sum + (Number(record.outstandingAmount) || 0), 0);
  const overdueCount = financeRecords.filter(record => record.status === 'OVERDUE').length;
  const feeTrackedCount = financeRecords.filter(record => record.totalAmount !== null && record.totalAmount !== undefined).length;

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
            <div class="card" style="padding:20px;margin-bottom:20px;">
              <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:12px;flex-wrap:wrap;margin-bottom:12px;"><div><h3 style="margin:0;">Intake and placement analysis</h3><p style="margin:4px 0 0;color:var(--text-muted);font-size:.8rem;">Active admitted students grouped by school, department, course, and year.</p></div><span class="badge badge-info">${intakeCohorts.length} cohorts</span></div>
              <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(155px,1fr));gap:10px;margin-bottom:14px;">
                <div style="padding:12px;border:1px solid var(--border);border-radius:10px;"><div style="font-size:.72rem;color:var(--text-muted);">Active students</div><strong style="font-size:1.15rem;">${activeStudents.length}</strong></div>
                <div style="padding:12px;border:1px solid var(--border);border-radius:10px;"><div style="font-size:.72rem;color:var(--text-muted);">Mentor allocation</div><strong style="font-size:1.15rem;color:${overallAssignmentCoverage < 100 ? 'var(--warning)' : 'var(--success)'};">${overallAssignmentCoverage}%</strong><div style="font-size:.72rem;color:var(--text-muted);">${assignedStudents}/${activeStudents.length} assigned</div></div>
                <div style="padding:12px;border:1px solid var(--border);border-radius:10px;"><div style="font-size:.72rem;color:var(--text-muted);">Needs mentor allocation</div><strong style="font-size:1.15rem;color:${activeStudents.length - assignedStudents ? 'var(--warning)' : 'var(--success)'};">${activeStudents.length - assignedStudents}</strong></div>
                <div style="padding:12px;border:1px solid var(--border);border-radius:10px;"><div style="font-size:.72rem;color:var(--text-muted);">Pending student review</div><strong style="font-size:1.15rem;">${pendingStudents}</strong></div>
                <div style="padding:12px;border:1px solid var(--border);border-radius:10px;"><div style="font-size:.72rem;color:var(--text-muted);">Provisional admission</div><strong style="font-size:1.15rem;color:${provisionalCount ? 'var(--warning)' : 'var(--success)'};">${provisionalCount}</strong><div style="font-size:.72rem;color:${provisionalOverdueCount ? 'var(--danger)' : 'var(--text-muted)'};">${provisionalOverdueCount} review dates overdue</div></div>
                <div style="padding:12px;border:1px solid var(--border);border-radius:10px;"><div style="font-size:.72rem;color:var(--text-muted);">Repeating same year</div><strong style="font-size:1.15rem;color:${yearDownCount ? 'var(--danger)' : 'var(--success)'};">${yearDownCount}</strong></div>
                <div style="padding:12px;border:1px solid var(--border);border-radius:10px;"><div style="font-size:.72rem;color:var(--text-muted);">Recorded outstanding fees</div><strong style="font-size:1.05rem;color:${financeUnavailable || !feeTrackedCount ? 'var(--text-muted)' : outstandingTotal ? 'var(--warning)' : 'var(--success)'};">${financeUnavailable ? 'Unavailable' : feeTrackedCount ? money(outstandingTotal) : 'Not set'}</strong><div style="font-size:.72rem;color:var(--text-muted);">${financeUnavailable ? 'Finance data could not be loaded' : feeTrackedCount ? `${overdueCount} overdue · ${money(paidTotal)} collected of ${money(billedTotal)} billed` : 'No fee schedules recorded yet'}</div></div>
              </div>
              ${intakeCohorts.length ? `<div style="overflow:auto;"><table class="data-table"><thead><tr><th>School</th><th>Department</th><th>Course</th><th>Year</th><th>Students</th><th>Mentor coverage</th></tr></thead><tbody>${intakeCohorts.slice(0, 12).map(cohort => `<tr><td>${escapeHtml(cohort.school)}</td><td>${escapeHtml(cohort.department)}</td><td>${escapeHtml(cohort.course)}</td><td>${escapeHtml(cohort.year)}</td><td>${cohort.total}</td><td>${cohort.total ? Math.round(cohort.assigned / cohort.total * 100) : 0}% <span style="font-size:.7rem;color:var(--text-muted);">(${cohort.assigned}/${cohort.total})</span></td></tr>`).join('')}</tbody></table></div>` : '<p style="margin:0;color:var(--text-muted);font-size:.8rem;">No admitted students are available for analysis yet.</p>'}
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
              <div><h3 style="margin:0;">Import admission list</h3><p style="margin:5px 0 0;color:var(--text-secondary);font-size:.84rem;">CSV or Excel. Required: name, enrollment number, email, mobile, department and course. Optional: admissionStatus (ADMITTED or PROVISIONAL) and provisionalUntil (YYYY-MM-DD). The mobile number is the initial password.</p></div>
                <button class="btn btn-secondary btn-sm" id="download-admission-template">Download template</button>
              </div>
              <input type="file" id="admission-file" accept=".csv,.xlsx,.xls" class="form-input" style="max-width:480px;">
              <div id="admission-preview" style="margin-top:16px;"></div>
              <div style="display:flex;justify-content:flex-end;margin-top:14px;"><button class="btn btn-primary" id="import-admissions" disabled>Import ready students</button></div>
            </div>
            <div class="card" style="padding:22px;margin-top:20px;">
              <div style="display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap;margin-bottom:12px;"><div><h3 style="margin:0;">Student lifecycle, allocation and fee directory</h3><p style="margin:5px 0 0;color:var(--text-secondary);font-size:.84rem;">Manage provisional documents, repeat-year decisions, fee schedules, due dates, and recorded payments.</p></div><div style="display:flex;gap:8px;flex-wrap:wrap;"><input id="admission-search" class="form-input" style="min-width:210px;" placeholder="Search name or enrollment"><select id="admission-course-filter" class="form-select" style="min-width:160px;"><option value="">All courses</option></select><select id="admission-year-filter" class="form-select" style="min-width:130px;"><option value="">All years</option></select><select id="admission-status-filter" class="form-select" style="min-width:145px;"><option value="">All admissions</option><option value="PROVISIONAL">Provisional</option><option value="ADMITTED">Admitted</option></select><select id="admission-standing-filter" class="form-select" style="min-width:145px;"><option value="">All standings</option><option value="YEAR_DOWN">Repeating year</option><option value="CURRENT">Current year</option></select><select id="admission-fee-filter" class="form-select" style="min-width:130px;"><option value="">All fees</option><option value="OVERDUE">Overdue</option><option value="DUE">Due</option><option value="PARTIAL">Partial</option><option value="PAID">Paid</option><option value="NOT_SET">Not set</option></select></div></div>
              <div id="admission-directory"></div>
            </div>
          </div>
        </div>
      </div>
    </div>`;

  const courseList = container.querySelector('#course-list');
  const directory = container.querySelector('#admission-directory');
  const searchInput = container.querySelector('#admission-search');
  const courseFilter = container.querySelector('#admission-course-filter');
  const yearFilter = container.querySelector('#admission-year-filter');
  const statusFilter = container.querySelector('#admission-status-filter');
  const standingFilter = container.querySelector('#admission-standing-filter');
  const feeFilter = container.querySelector('#admission-fee-filter');
  let directoryPage = 0;
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
    const search = searchInput.value.trim().toLowerCase();
    const list = students.filter(student => {
      const admissionStatus = String(student.admissionStatus || 'ADMITTED').toUpperCase();
      const yearDown = student.yearDown === true || String(student.academicStanding || '').toUpperCase() === 'YEAR_DOWN';
      const finance = financeByStudent.get(student.id);
      const searchMatch = !search || [student.name, student.enrollmentNumber, student.email].some(value => String(value || '').toLowerCase().includes(search));
      return searchMatch
        && (!courseFilter.value || (student.course || student.program) === courseFilter.value)
        && (!yearFilter.value || String(student.year || '') === yearFilter.value)
        && (!statusFilter.value || admissionStatus === statusFilter.value)
        && (!standingFilter.value || (standingFilter.value === 'YEAR_DOWN' ? yearDown : !yearDown))
        && (!feeFilter.value || String(finance?.status || 'NOT_SET') === feeFilter.value);
    });
    const pageCount = Math.max(1, Math.ceil(list.length / 50));
    directoryPage = Math.min(directoryPage, pageCount - 1);
    const pageRows = list.slice(directoryPage * 50, (directoryPage + 1) * 50);
    directory.innerHTML = list.length ? `<div style="overflow:auto;"><table class="data-table"><thead><tr><th>Student</th><th>School / Department</th><th>Course / Year</th><th>Admission</th><th>Academic standing</th><th>Mentor</th><th>Fee status</th><th>Outstanding</th><th>Manage</th></tr></thead><tbody>${pageRows.map(student => {
      const finance = financeByStudent.get(student.id);
      const admissionStatus = String(student.admissionStatus || 'ADMITTED').toUpperCase();
      const provisionalOverdue = admissionStatus === 'PROVISIONAL' && student.provisionalUntil && student.provisionalUntil < new Date().toISOString().slice(0, 10);
      const yearDown = student.yearDown === true || String(student.academicStanding || '').toUpperCase() === 'YEAR_DOWN';
      return `<tr><td>${escapeHtml(student.name || '—')}<div style="font-size:.74rem;color:var(--text-muted);">${escapeHtml(student.enrollmentNumber || '')} · ${escapeHtml(student.email || '')}</div></td><td>${escapeHtml(student.schoolName || '—')}<div style="font-size:.74rem;color:var(--text-muted);">${escapeHtml(student.department || '')}</div></td><td>${escapeHtml(student.course || student.program || '—')}<div style="font-size:.74rem;color:var(--text-muted);">${escapeHtml(student.yearLabel || yearLabel(student.year, student.durationYears) || '—')} · ${escapeHtml(student.academicYear || '')}</div></td><td><span class="badge ${provisionalOverdue ? 'badge-danger' : admissionStatus === 'PROVISIONAL' ? 'badge-warning' : 'badge-success'}">${provisionalOverdue ? 'Provisional · overdue' : admissionStatus === 'PROVISIONAL' ? 'Provisional' : 'Admitted'}</span>${admissionStatus === 'PROVISIONAL' && student.provisionalUntil ? `<div style="font-size:.7rem;color:var(--text-muted);">Review by ${escapeHtml(student.provisionalUntil)}</div>` : ''}</td><td><span class="badge ${yearDown ? 'badge-danger' : 'badge-muted'}">${yearDown ? 'Repeating year' : 'Current'}</span>${yearDown && student.yearDownReason ? `<div style="font-size:.7rem;color:var(--text-muted);max-width:180px;">${escapeHtml(student.yearDownReason)}</div>` : ''}</td><td>${student.mentorId ? 'Assigned' : '<span class="badge badge-warning">Pending</span>'}</td><td>${feeStatusBadge(financeUnavailable ? 'UNAVAILABLE' : finance?.status || 'NOT_SET')}</td><td>${finance?.totalAmount !== null && finance?.totalAmount !== undefined ? money(finance.outstandingAmount) : '—'}</td><td><button class="btn btn-xs btn-secondary manage-lifecycle" data-student-id="${escapeHtml(student.id)}">Manage</button></td></tr>`;
    }).join('')}</tbody></table></div><div style="display:flex;justify-content:space-between;align-items:center;margin-top:8px;gap:10px;"><p style="margin:0;font-size:.75rem;color:var(--text-muted);">Showing ${list.length ? directoryPage * 50 + 1 : 0}–${Math.min((directoryPage + 1) * 50, list.length)} of ${list.length}. Finance information is restricted to the Admin, Dean, and Admission Cell.</p><div style="display:flex;gap:6px;"><button id="admission-prev-page" class="btn btn-xs btn-secondary" ${directoryPage === 0 ? 'disabled' : ''}>Previous</button><span style="font-size:.75rem;align-self:center;color:var(--text-muted);">${directoryPage + 1} / ${pageCount}</span><button id="admission-next-page" class="btn btn-xs btn-secondary" ${directoryPage >= pageCount - 1 ? 'disabled' : ''}>Next</button></div></div>` : '<div class="empty-state" style="padding:24px;"><h3>No students match these filters</h3></div>';
    directory.querySelector('#admission-prev-page')?.addEventListener('click', () => { directoryPage--; renderDirectory(); });
    directory.querySelector('#admission-next-page')?.addEventListener('click', () => { directoryPage++; renderDirectory(); });
    directory.querySelectorAll('.manage-lifecycle').forEach(button => button.addEventListener('click', () => {
      const student = students.find(item => item.id === button.dataset.studentId);
      if (student) openLifecycleModal(student, financeByStudent.get(student.id), {
        finance: record => financeByStudent.set(record.studentId, record),
        render: () => render(container)
      });
    }));
  };
  courseFilter.addEventListener('change', renderDirectory);
  yearFilter.addEventListener('change', renderDirectory);
  searchInput.addEventListener('input', () => { directoryPage = 0; renderDirectory(); });
  [statusFilter, standingFilter, feeFilter].forEach(filter => filter.addEventListener('change', () => { directoryPage = 0; renderDirectory(); }));
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
        const admissionStatus = String(row.admissionStatus || 'ADMITTED').trim().toUpperCase();
        const provisionalUntil = String(row.provisionalUntil || '').trim();
        let error = '';
        if (!row.name || !row.email || !row.mobileNumber || !row.enrollmentNumber || !row.department || !row.course) error = 'Missing required field';
        else if (!row.email.includes('@')) error = 'Invalid email';
        else if (row.mobileNumber.length < 6) error = 'Mobile/password must be 6+ characters';
        else if (existingEmails.has(email) || seenEmails.has(email) || existingEnrollments.has(enrollment) || seenEnrollments.has(enrollment)) error = 'Duplicate email or enrollment number';
        else if (!config.courses?.length) error = 'Configure course names and durations before importing';
        else if (!course) error = 'Course is not configured';
        else if (year > duration) error = `Year exceeds ${duration}-year course`;
        else if (!['ADMITTED', 'PROVISIONAL'].includes(admissionStatus)) error = 'Admission status must be ADMITTED or PROVISIONAL';
        else if (provisionalUntil && !isIsoDate(provisionalUntil)) error = 'Provisional date must be a valid date in YYYY-MM-DD format';
        const deptMatches = departments.filter(item => String(item.name || '').trim().toLowerCase() === String(row.department || '').trim().toLowerCase());
        const schoolMatch = row.school ? deptMatches.find(item => {
          const linkedSchool = allInstitutionRecords.find(school => school.id === item.schoolId);
          return String(linkedSchool?.name || item.schoolName || '').trim().toLowerCase() === row.school.toLowerCase();
        }) : null;
        const departmentRecord = row.school ? schoolMatch : (deptMatches.length === 1 ? deptMatches[0] : null);
        if (!error && departments.length && !departmentRecord) error = deptMatches.length > 1 ? 'School is required to identify this department' : 'Department is not configured under a school';
        else if (!error && schools.length && !departmentRecord?.schoolId) error = 'Department must be linked to a school first';
        if (!error) { seenEmails.add(email); seenEnrollments.add(enrollment); }
        return { ...row, admissionStatus, provisionalUntil, departmentId: departmentRecord?.id || null, schoolId: departmentRecord?.schoolId || null, schoolName: departmentRecord?.schoolName || allInstitutionRecords.find(school => school.id === departmentRecord?.schoolId)?.name || null, year, yearLabel: yearLabel(year, duration), durationYears: duration, status: error ? 'Skipped' : 'Ready', error };
      }).filter(row => row.name || row.email || row.enrollmentNumber);
      const ready = preview.filter(row => row.status === 'Ready').length;
      previewWrap.innerHTML = `<p style="margin:0 0 8px;font-weight:600;">${ready} ready · ${preview.length - ready} skipped</p><div style="max-height:320px;overflow:auto;"><table class="data-table"><thead><tr><th>Student</th><th>Enrollment</th><th>School / Department</th><th>Course / Year</th><th>Admission</th><th>Status</th></tr></thead><tbody>${preview.map(row => `<tr><td>${escapeHtml(row.name || '—')}</td><td>${escapeHtml(row.enrollmentNumber || '—')}</td><td>${escapeHtml(row.schoolName || row.school || '—')}<div style="font-size:.74rem;color:var(--text-muted);">${escapeHtml(row.department || '—')}</div></td><td>${escapeHtml(row.course || '—')} · ${escapeHtml(row.yearLabel || '—')}</td><td>${escapeHtml(row.admissionStatus === 'PROVISIONAL' ? `Provisional${row.provisionalUntil ? ` · review ${row.provisionalUntil}` : ''}` : 'Admitted')}</td><td><span class="badge ${row.error ? 'badge-warning' : 'badge-success'}">${escapeHtml(row.error || 'Ready')}</span></td></tr>`).join('')}</tbody></table></div>`;
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
          academicYear: row.academicYear || activeYear, admissionStatus: row.admissionStatus,
          provisionalUntil: row.provisionalUntil
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
