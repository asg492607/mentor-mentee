import { getUserProfile } from '/js/auth.js';
import { createSidebar } from '/js/components/sidebar.js';
import { createHeader } from '/js/components/header.js';
import { showToast } from '/js/components/toast.js';
import { showModal } from '/js/components/modal.js';
import { StudentService, ClassService, DepartmentService } from '/js/services.js';
import { api } from '/js/api.js';
import { AcademicConfigService, FinanceService, yearNumber, yearLabel } from '/js/services/academic-service.js';
import { normalizeImportDate, parseImportFile } from '/js/excel-import.js';
import { escapeHtml } from '/js/utils.js';

const fieldAliases = {
  name: ['name', 'fullname', 'studentname'],
  enrollmentNumber: ['enrollmentnumber', 'enrollmentno', 'enrollment', 'rollno', 'rollnumber', 'studentid'],
  email: ['email', 'emailaddress', 'studentemail'],
  mobileNumber: ['mobile', 'mobilenumber', 'phone', 'contact', 'mobileno'],
  fatherContact: ['fathercontact', 'fathercontactno', 'fathercontactnumber', 'parentcontact', 'parentcontactno', 'parentmobile', 'parentphone', 'guardiancontact'],
  department: ['department', 'dept', 'branch', 'specialization'],
  school: ['school', 'schoolname', 'college', 'collegeof'],
  course: ['course', 'coursename', 'program', 'programname', 'programme', 'degree'],
  class: ['class', 'section', 'division', 'batch'],
  year: ['year', 'studyyear', 'currentyear', 'yearofstudy'],
  admissionYear: ['admissionyear', 'joiningyear', 'entryyear'],
  academicYear: ['academicyear', 'session', 'academicsession'],
  admissionStatus: ['admissionstatus', 'admissiontype'],
  provisionalUntil: ['provisionaluntil', 'provisionalduedate', 'reviewdate'],
  admissionNotes: ['admissionnotes', 'pendingdocuments', 'admissioncomment']
};

function normalizeKey(value) {
  const key = String(value || '').toLowerCase().replace(/[^a-z0-9]/g, '');
  return Object.entries(fieldAliases).find(([, aliases]) => aliases.includes(key))?.[0] || key;
}

const feeAliases = {
  enrollmentNumber: ['enrollmentnumber', 'enrollmentno', 'enrollment', 'rollno', 'rollnumber', 'studentid'],
  totalAmount: ['totalamount', 'totalfee', 'feeamount', 'fees', 'tuitionfee'],
  dueDate: ['duedate', 'feeduedate', 'paymentduedate'],
  paymentAmount: ['paymentamount', 'amountpaid', 'payment', 'paidamount'],
  reference: ['reference', 'receipt', 'receiptno', 'receiptid', 'transactionid', 'transactionreference'],
  note: ['note', 'notes', 'comment', 'comments']
};
const courseAliases = {
  name: ['name', 'course', 'coursename', 'program', 'programname', 'programme', 'degree'],
  durationYears: ['durationyears', 'duration', 'years', 'courseyears'],
  semesterCount: ['semestercount', 'semesters', 'totalsemesters'],
  semesterDurationMonths: ['semesterdurationmonths', 'semestermonths', 'monthspersemester']
};

function feeKey(value) {
  const key = String(value || '').toLowerCase().replace(/[^a-z0-9]/g, '');
  return Object.entries(feeAliases).find(([, aliases]) => aliases.includes(key))?.[0] || key;
}

function courseKey(value) {
  const key = String(value || '').toLowerCase().replace(/[^a-z0-9]/g, '');
  return Object.entries(courseAliases).find(([, aliases]) => aliases.includes(key))?.[0] || key;
}

function downloadTemplate() {
  const csv = 'name,enrollmentNumber,email,mobileNumber,fatherContact,school,department,course,class,year,admissionYear,academicYear,admissionStatus,provisionalUntil\nSample Student,STU001,student@example.edu,0000000000,0000000000,School of Engineering,Computer Science,BTech,CS-A,FY,2026,2026-27,ADMITTED,\n';
  const link = document.createElement('a');
  link.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
  link.download = 'admission-list-template.csv';
  link.click();
  URL.revokeObjectURL(link.href);
}

function downloadFeeTemplate() {
  const csv = 'enrollmentNumber,totalAmount,dueDate,paymentAmount,reference,note\nSTU001,100000,2026-12-31,25000,RECEIPT-001,First installment\n';
  const link = document.createElement('a');
  link.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
  link.download = 'student-fees-import-template.csv';
  link.click();
  URL.revokeObjectURL(link.href);
}

function downloadAdmissionStatusTemplate() {
  const csv = 'enrollmentNumber,admissionStatus,provisionalUntil,admissionNotes\nSTU001,PROVISIONAL,2026-12-31,Submit final marksheet\n';
  const link = document.createElement('a');
  link.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
  link.download = 'admission-status-update-template.csv';
  link.click();
  URL.revokeObjectURL(link.href);
}

function downloadCourseTemplate() {
  const csv = 'courseName,durationYears,semesterCount,semesterDurationMonths\nBTech Computer Engineering,4,8,6\n';
  const link = document.createElement('a');
  link.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
  link.download = 'course-duration-import-template.csv';
  link.click();
  URL.revokeObjectURL(link.href);
}

async function paymentImportKey(studentId, reference) {
  const value = `${studentId}|${String(reference || '').trim().toLowerCase()}`;
  if (globalThis.crypto?.subtle && globalThis.TextEncoder) {
    try {
      const digest = await globalThis.crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
      return `fee_${Array.from(new Uint8Array(digest).slice(0, 24), byte => byte.toString(16).padStart(2, '0')).join('')}`;
    } catch (_) { /* use a deterministic fallback when Web Crypto is unavailable */ }
  }
  let first = 2166136261;
  let second = 2246822519;
  for (let index = 0; index < value.length; index++) {
    const code = value.charCodeAt(index);
    first = Math.imul(first ^ code, 16777619);
    second = Math.imul(second ^ code, 3266489917);
  }
  return `fee_${(first >>> 0).toString(16)}${(second >>> 0).toString(16)}`;
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
              <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin-top:14px;"><input id="course-import-file" type="file" accept=".csv,.xlsx,.xls" class="form-input" style="max-width:380px;"><button class="btn btn-secondary btn-sm" id="download-course-template">Download course template</button><button id="import-courses" class="btn btn-secondary btn-sm" disabled>Import course rows</button></div>
              <div id="course-import-preview" style="margin-top:10px;"></div>
              <div id="course-list" style="display:flex;gap:8px;flex-wrap:wrap;margin-top:14px;"></div>
              <div style="display:flex;justify-content:flex-end;margin-top:14px;"><button class="btn btn-primary" id="save-academic-config">Save academic setup</button></div>
            </div>
            <div class="card" style="padding:22px;">
              <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:16px;flex-wrap:wrap;margin-bottom:16px;">
              <div><h3 style="margin:0;">Import admission list</h3><p style="margin:5px 0 0;color:var(--text-secondary);font-size:.84rem;">CSV or Excel. Required: name, enrollment number, email, mobile, department and course. Optional: parent contact, admissionStatus (ADMITTED or PROVISIONAL) and provisionalUntil. The mobile number is the initial password.</p></div>
                <button class="btn btn-secondary btn-sm" id="download-admission-template">Download template</button>
              </div>
              <input type="file" id="admission-file" accept=".csv,.xlsx,.xls" class="form-input" style="max-width:480px;">
              <div id="admission-preview" style="margin-top:16px;"></div>
              <div style="display:flex;justify-content:flex-end;margin-top:14px;"><button class="btn btn-primary" id="import-admissions" disabled>Import ready students</button></div>
            </div>
            <div class="card" style="padding:22px;margin-top:18px;">
              <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:14px;flex-wrap:wrap;margin-bottom:10px;"><div><h3 style="margin:0;">Bulk update admission status</h3><p style="margin:5px 0 0;color:var(--text-secondary);font-size:.84rem;">Update existing students by enrollment number, including provisional review dates and pending-document notes.</p></div><button id="download-admission-status-template" class="btn btn-secondary btn-sm">Download template</button></div>
              <p style="margin:0 0 12px;color:var(--text-muted);font-size:.78rem;">Columns: enrollmentNumber, admissionStatus (ADMITTED or PROVISIONAL), provisionalUntil, admissionNotes. Rows are previewed and matched before updates run.</p>
              <div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap;"><input type="file" id="admission-status-file" accept=".csv,.xlsx,.xls" class="form-input" style="max-width:420px;"><button id="import-admission-status" class="btn btn-primary" disabled>Update ready students</button></div>
              <div id="admission-status-preview" style="margin-top:14px;"></div>
            </div>
            <div class="card" style="padding:22px;margin-top:18px;">
              <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:16px;flex-wrap:wrap;margin-bottom:12px;"><div><h3 style="margin:0;">Bulk fee schedules and receipts</h3><p style="margin:5px 0 0;color:var(--text-secondary);font-size:.84rem;">Import fee totals, due dates and received payments by enrollment number. Preview validates each row before any ledger entry is saved.</p></div><button class="btn btn-secondary btn-sm" id="download-fee-template">Download fee template</button></div>
              <p style="margin:0 0 12px;color:var(--text-muted);font-size:.78rem;">Columns: enrollmentNumber (required), totalAmount, dueDate, paymentAmount, reference, note. Leave optional cells blank to keep existing values. A payment requires a unique receipt reference and creates a separate ledger entry; re-importing that reference is idempotent.</p>
              <div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap;"><input type="file" id="fee-import-file" accept=".csv,.xlsx,.xls" class="form-input" style="max-width:420px;"><button class="btn btn-primary" id="import-fees" disabled>Import ready fee rows</button></div>
              <div id="fee-import-preview" style="margin-top:14px;"></div>
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
  container.querySelector('#download-course-template').addEventListener('click', downloadCourseTemplate);
  const courseFile = container.querySelector('#course-import-file');
  const coursePreview = container.querySelector('#course-import-preview');
  const courseImportButton = container.querySelector('#import-courses');
  let courseImportRows = [];
  const renderCoursePreview = () => {
    const ready = courseImportRows.filter(row => !row.error && !row.alreadyConfigured);
    courseImportButton.disabled = ready.length === 0;
    coursePreview.innerHTML = courseImportRows.length
      ? `<p style="margin:0 0 6px;font-size:.78rem;color:var(--text-secondary);">${ready.length} ready · ${courseImportRows.filter(row => row.alreadyConfigured).length} already configured · ${courseImportRows.filter(row => row.error).length} skipped</p><div style="max-height:220px;overflow:auto;"><table class="data-table"><thead><tr><th>Course</th><th>Duration</th><th>Semesters</th><th>Months per semester</th><th>Status</th></tr></thead><tbody>${courseImportRows.map(row => `<tr><td>${escapeHtml(row.name || '—')}</td><td>${row.durationYears || '—'} years</td><td>${row.semesterCount || '—'}</td><td>${row.semesterDurationMonths || '—'}</td><td><span class="badge ${row.error ? 'badge-danger' : row.alreadyConfigured ? 'badge-muted' : 'badge-info'}">${escapeHtml(row.error || (row.alreadyConfigured ? 'Already configured' : 'Ready'))}</span></td></tr>`).join('')}</tbody></table></div>`
      : '';
  };
  courseFile.addEventListener('change', async () => {
    courseImportRows = [];
    coursePreview.innerHTML = '';
    courseImportButton.disabled = true;
    const file = courseFile.files?.[0];
    if (!file) return;
    try {
      const matrix = await parseImportFile(file);
      if (matrix.length < 2) throw new Error('The course file has no data rows.');
      const headers = matrix[0].map(courseKey);
      if (!headers.includes('name') || !headers.includes('durationYears')) throw new Error('The course file must include courseName and durationYears columns.');
      const namesSeen = new Set();
      courseImportRows = matrix.slice(1).map(cells => {
        const row = {};
        headers.forEach((header, index) => { row[header] = String(cells[index] ?? '').trim(); });
        const name = String(row.name || '').trim();
        const durationYears = Number(row.durationYears);
        const semesterCount = durationYears * 2;
        const semesterDurationMonths = 6;
        const existing = (config.courses || []).find(course => String(course.name || '').trim().toLowerCase() === name.toLowerCase());
        let error = '';
        if (!name) error = 'Course name is required';
        else if (!Number.isInteger(durationYears) || durationYears < 1 || durationYears > 8) error = 'Duration must be a whole number from 1 to 8 years';
        else if (row.semesterCount && Number(row.semesterCount) !== semesterCount) error = `Semester count must be ${semesterCount} (2 per year)`;
        else if (row.semesterDurationMonths && Number(row.semesterDurationMonths) !== semesterDurationMonths) error = 'Each semester must be 6 months';
        else if (existing && Number(existing.durationYears) !== durationYears) error = 'Course already exists with a different duration';
        else if (namesSeen.has(name.toLowerCase())) error = 'Course appears more than once in this file';
        if (name) namesSeen.add(name.toLowerCase());
        return { name, durationYears, semesterCount, semesterDurationMonths, error, alreadyConfigured: Boolean(existing && !error) };
      }).filter(row => row.name);
      renderCoursePreview();
    } catch (error) {
      coursePreview.innerHTML = `<p class="text-danger">${escapeHtml(error.message || 'Could not read course file.')}</p>`;
      showToast(error.message || 'Could not read course file.', 'error');
    }
  });
  courseImportButton.addEventListener('click', async () => {
    const ready = courseImportRows.filter(row => !row.error && !row.alreadyConfigured);
    if (!ready.length) return;
    const previousCourses = config.courses || [];
    const additions = ready.map(({ name, durationYears, semesterCount, semesterDurationMonths }) => ({ name, durationYears, semesterCount, semesterDurationMonths }));
    courseImportButton.disabled = true;
    try {
      config.courses = [...previousCourses, ...additions];
      config.activeAcademicYear = container.querySelector('#active-academic-year').value.trim();
      await AcademicConfigService.save(config);
      ready.forEach(row => { row.alreadyConfigured = true; });
      renderCourses();
      showToast(`${additions.length} course(s) imported with ${additions.reduce((sum, course) => sum + course.semesterCount, 0)} total semesters.`, 'success');
    } catch (error) {
      config.courses = previousCourses;
      showToast(error.message || 'Could not save imported courses.', 'error');
    } finally {
      courseImportButton.disabled = false;
      renderCoursePreview();
    }
  });
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
        const provisionalInput = String(row.provisionalUntil || '').trim();
        const provisionalUntil = normalizeImportDate(provisionalInput);
        let error = '';
        if (!row.name || !row.email || !row.mobileNumber || !row.enrollmentNumber || !row.department || !row.course) error = 'Missing required field';
        else if (!row.email.includes('@')) error = 'Invalid email';
        else if (row.mobileNumber.length < 6) error = 'Mobile/password must be 6+ characters';
        else if (existingEmails.has(email) || seenEmails.has(email) || existingEnrollments.has(enrollment) || seenEnrollments.has(enrollment)) error = 'Duplicate email or enrollment number';
        else if (!config.courses?.length) error = 'Configure course names and durations before importing';
        else if (!course) error = 'Course is not configured';
        else if (year > duration) error = `Year exceeds ${duration}-year course`;
        else if (!['ADMITTED', 'PROVISIONAL'].includes(admissionStatus)) error = 'Admission status must be ADMITTED or PROVISIONAL';
        else if (provisionalInput && !provisionalUntil) error = 'Provisional date must be a valid date (use YYYY-MM-DD when ambiguous)';
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
      previewWrap.innerHTML = `<p id="admission-import-summary" style="margin:0 0 8px;font-weight:600;">${ready} ready · ${preview.length - ready} skipped</p><div style="max-height:320px;overflow:auto;"><table class="data-table"><thead><tr><th>Student</th><th>Enrollment</th><th>School / Department</th><th>Course / Year</th><th>Admission</th><th>Status</th></tr></thead><tbody>${preview.map((row, index) => `<tr data-admission-row="${index}"><td>${escapeHtml(row.name || '—')}</td><td>${escapeHtml(row.enrollmentNumber || '—')}</td><td>${escapeHtml(row.schoolName || row.school || '—')}<div style="font-size:.74rem;color:var(--text-muted);">${escapeHtml(row.department || '—')}</div></td><td>${escapeHtml(row.course || '—')} · ${escapeHtml(row.yearLabel || '—')}</td><td>${escapeHtml(row.admissionStatus === 'PROVISIONAL' ? `Provisional${row.provisionalUntil ? ` · review ${row.provisionalUntil}` : ''}` : 'Admitted')}</td><td><span class="badge ${row.error ? 'badge-warning' : 'badge-success'}">${escapeHtml(row.error || 'Ready')}</span></td></tr>`).join('')}</tbody></table></div>`;
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
          mobileNumber: row.mobileNumber, enrollmentNumber: row.enrollmentNumber, fatherContact: row.fatherContact || '',
          department: row.department, departmentId: row.departmentId, schoolId: row.schoolId, schoolName: row.schoolName,
          course: row.course, program: row.course,
          class: row.class || null, classId: classRecord?.id || null, year: row.year, yearLabel: row.yearLabel,
          durationYears: row.durationYears, semesterCount: row.durationYears * 2, semesterDurationMonths: 6, admissionYear: Number(row.admissionYear) || new Date().getFullYear(),
          academicYear: row.academicYear || activeYear, admissionStatus: row.admissionStatus,
          provisionalUntil: row.provisionalUntil
        });
        students.unshift({ ...profile, role: 'STUDENT' });
        row.status = 'Imported';
        created++;
      } catch (error) {
        failed++;
        row.status = 'Failed';
        row.error = error.message || 'Import failed';
      }
      const rowIndex = preview.indexOf(row);
      const statusBadge = previewWrap.querySelector(`[data-admission-row="${rowIndex}"] .badge`);
      if (statusBadge) {
        statusBadge.className = `badge ${row.status === 'Imported' ? 'badge-success' : 'badge-danger'}`;
        statusBadge.textContent = row.status === 'Imported' ? 'Imported' : row.error;
      }
      const summary = previewWrap.querySelector('#admission-import-summary');
      if (summary) summary.textContent = `${preview.filter(item => item.status === 'Ready').length} ready · ${preview.filter(item => item.status === 'Imported').length} imported · ${preview.filter(item => item.error || item.status === 'Skipped').length} skipped / failed`;
      importButton.textContent = `Importing ${index + 1} / ${ready.length}…`;
    }
    container.querySelector('#admission-count').textContent = students.length;
    renderDirectory();
    importButton.textContent = 'Import ready students';
    importButton.disabled = !preview.some(row => row.status === 'Ready');
    showToast(`${created} student account(s) created${failed ? `, ${failed} failed` : ''}.`, created ? 'success' : 'error');
  });

  container.querySelector('#download-admission-status-template').addEventListener('click', downloadAdmissionStatusTemplate);
  const admissionStatusFile = container.querySelector('#admission-status-file');
  const admissionStatusPreview = container.querySelector('#admission-status-preview');
  const admissionStatusButton = container.querySelector('#import-admission-status');
  let admissionStatusRows = [];
  let admissionStatusUpdating = false;
  let admissionStatusProgress = '';
  const renderAdmissionStatusPreview = () => {
    const ready = admissionStatusRows.filter(row => !row.validationError && !row.imported);
    admissionStatusButton.disabled = admissionStatusUpdating || ready.length === 0;
    admissionStatusButton.textContent = admissionStatusUpdating ? admissionStatusProgress : ready.length ? `Update ${ready.length} ready student(s)` : 'Update ready students';
    admissionStatusPreview.innerHTML = admissionStatusRows.length
      ? `<p style="margin:0 0 8px;font-weight:600;">${ready.length} ready · ${admissionStatusRows.filter(row => row.imported).length} updated · ${admissionStatusRows.filter(row => row.error || row.validationError).length} skipped / failed</p><div style="max-height:300px;overflow:auto;"><table class="data-table"><thead><tr><th>Enrollment</th><th>Student</th><th>Admission status</th><th>Review date</th><th>Status</th></tr></thead><tbody>${admissionStatusRows.slice(0, 250).map(row => `<tr><td>${escapeHtml(row.enrollmentNumber || '—')}</td><td>${escapeHtml(row.student?.name || '—')}</td><td>${escapeHtml(row.admissionStatus || '—')}</td><td>${escapeHtml(row.provisionalUntil || (row.admissionStatus === 'PROVISIONAL' ? 'Keep existing' : 'Cleared on admission'))}</td><td><span class="badge ${row.imported ? 'badge-success' : row.error || row.validationError ? 'badge-danger' : 'badge-info'}">${escapeHtml(row.imported ? 'Updated' : row.error || row.validationError || 'Ready')}</span></td></tr>`).join('')}</tbody></table></div>${admissionStatusRows.length > 250 ? `<small style="color:var(--text-muted);">Showing 250 of ${admissionStatusRows.length} rows.</small>` : ''}`
      : '';
  };
  admissionStatusFile.addEventListener('change', async () => {
    admissionStatusRows = [];
    admissionStatusPreview.innerHTML = '';
    admissionStatusButton.disabled = true;
    const file = admissionStatusFile.files?.[0];
    if (!file) return;
    try {
      const matrix = await parseImportFile(file);
      if (matrix.length < 2) throw new Error('The admission status file has no data rows.');
      const headers = matrix[0].map(normalizeKey);
      if (!headers.includes('enrollmentNumber') || !headers.includes('admissionStatus')) throw new Error('The file must include enrollmentNumber and admissionStatus columns.');
      const byEnrollment = new Map();
      students.forEach(student => {
        const key = String(student.enrollmentNumber || '').trim().toLowerCase();
        if (key) byEnrollment.set(key, student);
      });
      const seen = new Set();
      admissionStatusRows = matrix.slice(1).map(cells => {
        const row = {};
        headers.forEach((header, index) => { row[header] = String(cells[index] ?? '').trim(); });
        const enrollmentNumber = String(row.enrollmentNumber || '').trim();
        const student = byEnrollment.get(enrollmentNumber.toLowerCase());
        const status = String(row.admissionStatus || '').trim().toUpperCase();
        const dateInput = String(row.provisionalUntil || '').trim();
        const provisionalUntil = normalizeImportDate(dateInput);
        let validationError = '';
        if (!enrollmentNumber) validationError = 'Enrollment number is required';
        else if (!student) validationError = 'Enrollment number was not found';
        else if (seen.has(enrollmentNumber.toLowerCase())) validationError = 'Enrollment appears more than once in this file';
        else if (!['ADMITTED', 'PROVISIONAL'].includes(status)) validationError = 'Status must be ADMITTED or PROVISIONAL';
        else if (dateInput && !provisionalUntil) validationError = 'Review date must be valid (use YYYY-MM-DD when ambiguous)';
        else if (!row.admissionNotes && !dateInput && status === String(student.admissionStatus || 'ADMITTED').toUpperCase()) validationError = 'No admission status change or notes provided';
        if (!validationError) seen.add(enrollmentNumber.toLowerCase());
        return {
          enrollmentNumber, student, admissionStatus: status, provisionalUntil,
          admissionNotes: String(row.admissionNotes || '').slice(0, 500),
          validationError, error: '', imported: false
        };
      }).filter(row => row.enrollmentNumber || row.admissionStatus || row.admissionNotes);
      renderAdmissionStatusPreview();
    } catch (error) {
      admissionStatusPreview.innerHTML = `<p class="text-danger">${escapeHtml(error.message || 'Could not read admission status file.')}</p>`;
      showToast(error.message || 'Could not read admission status file.', 'error');
    }
  });
  admissionStatusButton.addEventListener('click', async () => {
    const ready = admissionStatusRows.filter(row => !row.validationError && !row.imported);
    if (!ready.length) return;
    admissionStatusUpdating = true;
    let saved = 0;
    for (let index = 0; index < ready.length; index++) {
      const row = ready[index];
      row.error = '';
      try {
        const updated = await api.put(`/admissions/students/${encodeURIComponent(row.student.id)}/lifecycle`, {
          admissionStatus: row.admissionStatus,
          ...(row.provisionalUntil ? { provisionalUntil: row.provisionalUntil } : {}),
          ...(row.admissionNotes ? { admissionNotes: row.admissionNotes } : {})
        });
        Object.assign(row.student, updated);
        row.imported = true;
        saved++;
      } catch (error) {
        row.error = error.message || 'Could not update admission record';
      }
      admissionStatusProgress = `Updating ${index + 1} / ${ready.length}…`;
      renderAdmissionStatusPreview();
    }
    admissionStatusUpdating = false;
    admissionStatusProgress = '';
    renderAdmissionStatusPreview();
    renderDirectory();
    showToast(`${saved} admission record(s) updated${ready.length - saved ? `, ${ready.length - saved} failed` : ''}.`, saved ? 'success' : 'error');
  });

  container.querySelector('#download-fee-template').addEventListener('click', downloadFeeTemplate);
  const feeFileInput = container.querySelector('#fee-import-file');
  const feePreview = container.querySelector('#fee-import-preview');
  const feeImportButton = container.querySelector('#import-fees');
  let feeImportRows = [];
  let feeImporting = false;
  let feeImportProgress = '';
  const renderFeePreview = () => {
    const ready = feeImportRows.filter(row => !row.validationError && !row.imported);
    const failures = feeImportRows.filter(row => row.error || row.validationError);
    feeImportButton.disabled = feeImporting || ready.length === 0;
    feeImportButton.textContent = feeImporting ? feeImportProgress : ready.length ? `Import ${ready.length} ready fee row(s)` : 'Import ready fee rows';
    feePreview.innerHTML = feeImportRows.length
      ? `<p style="margin:0 0 8px;font-weight:600;">${ready.length} ready · ${feeImportRows.filter(row => row.imported).length} imported · ${failures.length} skipped / failed</p><div style="max-height:340px;overflow:auto;"><table class="data-table"><thead><tr><th>Enrollment</th><th>Student</th><th>Total fee</th><th>Due date</th><th>Payment</th><th>Status</th></tr></thead><tbody>${feeImportRows.slice(0, 300).map(row => `<tr><td>${escapeHtml(row.enrollmentNumber || '—')}</td><td>${escapeHtml(row.student?.name || '—')}</td><td>${row.totalAmount === null ? 'Keep existing' : money(row.totalAmount)}</td><td>${escapeHtml(row.dueDate || 'Keep existing')}</td><td>${row.paymentAmount > 0 ? money(row.paymentAmount) : '—'}</td><td><span class="badge ${row.imported ? 'badge-success' : row.error ? 'badge-danger' : 'badge-info'}">${escapeHtml(row.imported ? 'Imported' : row.error || 'Ready')}</span></td></tr>`).join('')}</tbody></table></div>${feeImportRows.length > 300 ? `<p style="font-size:.75rem;color:var(--text-muted);">Showing first 300 of ${feeImportRows.length} rows.</p>` : ''}`
      : '';
  };

  feeFileInput.addEventListener('change', async () => {
    feeImportRows = [];
    feeImportButton.disabled = true;
    feePreview.innerHTML = '';
    const file = feeFileInput.files?.[0];
    if (!file) return;
    try {
      const matrix = await parseImportFile(file);
      if (matrix.length < 2) throw new Error('The selected file has no fee rows.');
      const headers = matrix[0].map(feeKey);
      if (!headers.includes('enrollmentNumber')) throw new Error('The fee file must include an enrollmentNumber column.');
      const byEnrollment = new Map();
      students.forEach(student => {
        const key = String(student.enrollmentNumber || '').trim().toLowerCase();
        if (key) byEnrollment.set(key, student);
      });
      const seenEnrollments = new Set();
      const seenReferences = new Set();
      feeImportRows = matrix.slice(1).map(cells => {
        const row = {};
        headers.forEach((header, column) => { row[header] = String(cells[column] ?? '').trim(); });
        const enrollmentNumber = String(row.enrollmentNumber || '').trim();
        const student = byEnrollment.get(enrollmentNumber.toLowerCase());
        const finance = student ? financeByStudent.get(student.id) : null;
        const parseAmount = (raw, label) => {
          if (raw === undefined || raw === null || String(raw).trim() === '') return null;
          const amount = Number(String(raw).replace(/[₹,$\s]/g, ''));
          if (!Number.isFinite(amount) || amount < 0 || Math.round(amount * 100) !== amount * 100) throw new Error(`${label} must be a non-negative amount with at most two decimal places`);
          return Math.round(amount * 100) / 100;
        };
        let totalAmount = null;
        let paymentAmount = null;
        let error = '';
        try {
          totalAmount = parseAmount(row.totalAmount, 'Total fee');
          paymentAmount = parseAmount(row.paymentAmount, 'Payment amount') || 0;
          const dueDateInput = row.dueDate || '';
          const dueDate = normalizeImportDate(dueDateInput);
          if (dueDateInput && !dueDate) throw new Error('Due date must be valid (use YYYY-MM-DD when ambiguous)');
          if (!enrollmentNumber) throw new Error('Enrollment number is required');
          if (!student) throw new Error('Enrollment number was not found');
          if (seenEnrollments.has(enrollmentNumber.toLowerCase())) throw new Error('Enrollment number appears more than once in this file');
          const referenceKey = String(row.reference || '').trim().toLowerCase();
          if (paymentAmount > 0 && !referenceKey) throw new Error('Receipt reference is required when recording a payment');
          if (paymentAmount > 0 && referenceKey && seenReferences.has(referenceKey)) throw new Error('Receipt reference appears more than once in this file');
          const hasChange = totalAmount !== null || Boolean(dueDate) || paymentAmount > 0 || Boolean(row.note);
          if (!hasChange) throw new Error('Provide a fee total, due date, payment, or note');
          const paid = Number(finance?.amountPaid) || 0;
          const effectiveTotal = totalAmount === null ? (finance?.totalAmount === null || finance?.totalAmount === undefined ? null : Number(finance.totalAmount)) : totalAmount;
          if (totalAmount !== null && totalAmount > 1000000000 || paymentAmount > 1000000000) throw new Error('Amounts cannot exceed ₹1,000,000,000');
          if (effectiveTotal !== null && effectiveTotal < paid) throw new Error('Total fee is lower than payments already recorded');
          if (paymentAmount > 0 && effectiveTotal === null) throw new Error('Set a total fee before recording a payment');
          if (dueDate && effectiveTotal === null) throw new Error('Set a total fee before adding a due date');
          if (paymentAmount > Math.max(0, (effectiveTotal || 0) - paid)) throw new Error('Payment exceeds the outstanding balance');
          seenEnrollments.add(enrollmentNumber.toLowerCase());
          if (paymentAmount > 0 && referenceKey) seenReferences.add(referenceKey);
        } catch (parseError) {
          error = parseError.message || 'Invalid fee row';
        }
        return {
          enrollmentNumber,
          student,
          totalAmount,
          dueDate: normalizeImportDate(row.dueDate || ''),
          paymentAmount,
          reference: String(row.reference || '').slice(0, 100),
          note: String(row.note || '').slice(0, 500),
          paymentId: null,
          error,
          validationError: error,
          imported: false
        };
      }).filter(row => row.enrollmentNumber || row.totalAmount !== null || row.paymentAmount > 0 || row.dueDate || row.note);
      await Promise.all(feeImportRows.filter(row => row.student && row.paymentAmount > 0 && row.reference).map(async row => {
        row.paymentId = await paymentImportKey(row.student.id, row.reference);
      }));
      renderFeePreview();
    } catch (error) {
      feePreview.innerHTML = `<p class="text-danger">${escapeHtml(error.message || 'Could not read fee file.')}</p>`;
      showToast(error.message || 'Could not read fee file.', 'error');
    }
  });

  feeImportButton.addEventListener('click', async () => {
    const ready = feeImportRows.filter(row => !row.validationError && !row.imported);
    if (!ready.length) return;
    feeImporting = true;
    let saved = 0;
    for (let index = 0; index < ready.length; index++) {
      const row = ready[index];
      row.error = '';
      try {
        const record = await FinanceService.update(row.student.id, {
          ...(row.totalAmount !== null ? { totalAmount: row.totalAmount } : {}),
          ...(row.dueDate ? { dueDate: row.dueDate } : {}),
          ...(row.paymentAmount > 0 ? { paymentAmount: row.paymentAmount, paymentId: row.paymentId } : {}),
          ...(row.reference ? { reference: row.reference } : {}),
          ...(row.note ? { note: row.note } : {})
        });
        row.imported = true;
        row.error = '';
        financeByStudent.set(row.student.id, record);
        saved++;
      } catch (error) {
        row.error = error.message || 'Could not save fee row';
      }
      feeImportProgress = `Importing ${index + 1} / ${ready.length}…`;
      renderFeePreview();
    }
    feeImporting = false;
    feeImportProgress = '';
    renderFeePreview();
    renderDirectory();
    showToast(`${saved} fee row(s) imported${ready.length - saved ? `, ${ready.length - saved} failed` : ''}.`, saved ? 'success' : 'error');
  });
}
