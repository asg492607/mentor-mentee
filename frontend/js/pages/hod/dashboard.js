// HOD � Department Dashboard
// Department-specific mentoring performance, mentor rosters, and risk summaries.
import { getUserProfile } from '/js/auth.js';
import { createSidebar } from '/js/components/sidebar.js';
import { createHeader } from '/js/components/header.js';
import { StatsService, IssueService, FacultyService, NotificationService } from '/js/services.js';
import { showModal } from '/js/components/modal.js';
import { departmentScope, escapeHtml } from '/js/utils.js';
import { showToast } from '/js/components/toast.js';
import { parseImportFile, isRowObjectEmpty } from '/js/excel-import.js';
import { exportMentorStudentReport, exportSingleMentorReport } from '/js/report-export.js';
import { getAttendanceStatus, AttendanceInterventionService } from '/js/services/academic-service.js';

function riskBadge(r) {
  const cls = {HIGH:'badge-danger',MEDIUM:'badge-warning',LOW:'badge-success'}[r]||'badge-muted';
  return `<span class="badge ${cls}">${r||'N/A'}</span>`;
}

function buildDepartmentCohorts(students) {
  const groups = new Map();
  students.forEach(student => {
    const course = String(student.course || student.program || 'Course not set');
    const year = String(student.yearLabel || student.year || 'Year not set');
    const classroom = String(student.class || 'Class not set');
    const key = `${course.toLowerCase()}|${year.toLowerCase()}|${classroom.toLowerCase()}`;
    if (!groups.has(key)) groups.set(key, { course, year, classroom, students: [] });
    groups.get(key).students.push(student);
  });
  return [...groups.values()].map(group => ({ ...group, analysis: StatsService.summarizeStudents(group.students) }))
    .sort((a, b) => b.analysis.frCount - a.analysis.frCount || b.analysis.learnerCounts.SLOW - a.analysis.learnerCounts.SLOW || b.students.length - a.students.length);
}


async function notifyDeans(issueId, title, message) {
  try {
    const deans = await FacultyService.getDeans();
    for (const dean of deans) {
      const targetUid = dean.id || dean.uid;
      if (targetUid) {
        await NotificationService.create({
          userId: targetUid,
          type: 'ISSUE_ESCALATED',
          title: title,
          message: message,
          relatedId: issueId
        });
      }
    }
  } catch (err) {
    console.warn('[HOD Dashboard] Failed to notify Dean(s):', err);
  }
}

function openRaiseIssueModal(user, dept, students, onIssueCreated) {
  const studentsSorted = [...(students || [])].sort((a, b) => (a.name || '').localeCompare(b.name || ''));

  showModal({
    title: 'Raise & Escalate Issue',
    size: 'lg',
    content: `
      <div style="display:flex; flex-direction:column; gap:16px;">
        <p style="font-size:0.85rem; color:var(--text-secondary); margin:0;">
          Log a student grievance or departmental concern, with the option to immediately escalate it to the Dean for university-level review.
        </p>

        <div class="form-group" style="margin-bottom:0;">
          <label class="form-label" style="font-weight:600; font-size:0.85rem;">Student (Optional - Select Student or Department-Wide)</label>
          <select id="hod-new-issue-student" class="form-select">
            <option value="">-- Department-Wide / General Concern (No specific student) --</option>
            ${studentsSorted.map(s => `
              <option value="${s.id}">
                ${escapeHtml(s.name)} ${s.enrollmentNumber ? '(' + escapeHtml(s.enrollmentNumber) + ')' : ''} ${s.class ? '- Class ' + escapeHtml(s.class) : ''}
              </option>
            `).join('')}
          </select>
        </div>

        <div class="form-group" style="margin-bottom:0;">
          <label class="form-label" style="font-weight:600; font-size:0.85rem;">Issue Title <span style="color:var(--danger);">*</span></label>
          <input type="text" id="hod-new-issue-title" class="form-input" placeholder="e.g. Critical attendance penalty appeal / Equipment shortage in IoT lab / Fee barrier">
        </div>

        <div style="display:grid; grid-template-columns:1fr 1fr; gap:14px;">
          <div class="form-group" style="margin-bottom:0;">
            <label class="form-label" style="font-weight:600; font-size:0.85rem;">Category</label>
            <select id="hod-new-issue-cat" class="form-select">
              <option value="Academic">Academic</option>
              <option value="Examination">Examination / Backlog</option>
              <option value="Accounts & Fees">Accounts &amp; Fees</option>
              <option value="Discipline & Conduct">Discipline &amp; Conduct</option>
              <option value="Hostel & Campus">Hostel &amp; Campus</option>
              <option value="Laboratory & Infrastructure">Laboratory &amp; Infrastructure</option>
              <option value="Placements & Internships">Placements &amp; Internships</option>
              <option value="Mentorship & Faculty">Mentorship &amp; Faculty</option>
              <option value="General Grievance">General Grievance</option>
            </select>
          </div>

          <div class="form-group" style="margin-bottom:0;">
            <label class="form-label" style="font-weight:600; font-size:0.85rem;">Priority</label>
            <select id="hod-new-issue-pri" class="form-select">
              <option value="HIGH" selected>High (Urgent Attention)</option>
              <option value="CRITICAL">Critical (Immediate Policy/Administrative Action)</option>
              <option value="MEDIUM">Medium (Standard Review)</option>
              <option value="LOW">Low (Informational)</option>
            </select>
          </div>
        </div>

        <div class="form-group" style="margin-bottom:0; background:linear-gradient(135deg, rgba(99,102,241,0.06), rgba(168,85,247,0.06)); padding:14px; border-radius:12px; border:1px solid rgba(99,102,241,0.25);">
          <label class="form-label" style="font-weight:700; font-size:0.88rem; color:var(--text); margin-bottom:8px; display:flex; align-items:center; gap:6px;">
            <i class="ph ph-shield-warning" style="color:var(--accent);"></i> Escalation Routing
          </label>
          <div style="display:flex; gap:20px; flex-wrap:wrap;">
            <label style="display:flex; align-items:center; gap:8px; font-size:0.85rem; cursor:pointer; font-weight:600;">
              <input type="radio" name="hod-target-level" value="DEAN" checked id="hod-target-dean">
              🎓 Escalate to Dean Immediately
            </label>
            <label style="display:flex; align-items:center; gap:8px; font-size:0.85rem; cursor:pointer; font-weight:600;">
              <input type="radio" name="hod-target-level" value="HOD" id="hod-target-hod">
              🏛️ Retain at Department / HOD Level
            </label>
          </div>
        </div>

        <div class="form-group" id="hod-dean-reason-wrap" style="margin-bottom:0;">
          <label class="form-label" style="font-weight:600; font-size:0.85rem;">
            Escalation Reason / Notes for Dean <span style="color:var(--danger);">*</span>
          </label>
          <textarea id="hod-new-issue-dean-reason" class="form-textarea" style="min-height:80px;" placeholder="Explain why Dean-level review, executive exception, or institutional sanction is necessary..."></textarea>
        </div>

        <div class="form-group" style="margin-bottom:0;">
          <label class="form-label" style="font-weight:600; font-size:0.85rem;">Description &amp; Details <span style="color:var(--danger);">*</span></label>
          <textarea id="hod-new-issue-desc" class="form-textarea" style="min-height:90px;" placeholder="Provide comprehensive details, background, observations, and expected resolution..."></textarea>
        </div>
      </div>
    `,
    confirmText: 'Submit & Escalate',
    cancelText: 'Cancel',
    onConfirm: async (close) => {
      const title = document.getElementById('hod-new-issue-title')?.value.trim();
      const desc = document.getElementById('hod-new-issue-desc')?.value.trim();
      const cat = document.getElementById('hod-new-issue-cat')?.value || 'General Grievance';
      const pri = document.getElementById('hod-new-issue-pri')?.value || 'HIGH';
      const studentId = document.getElementById('hod-new-issue-student')?.value || null;
      const targetLevel = document.querySelector('input[name="hod-target-level"]:checked')?.value || 'DEAN';
      const isDeanEscalation = targetLevel === 'DEAN';
      const deanReason = document.getElementById('hod-new-issue-dean-reason')?.value.trim();

      if (!title) {
        return showToast('Issue title is required', 'error');
      }
      if (!desc) {
        return showToast('Issue description is required', 'error');
      }
      if (isDeanEscalation && !deanReason) {
        return showToast('Please provide an escalation reason for the Dean', 'error');
      }

      const selectedStudent = studentId ? students.find(s => s.id === studentId) : null;

      const issuePayload = {
        title,
        description: desc,
        category: cat,
        priority: pri,
        department: dept || user.department || '',
        departmentId: user.departmentId || null,
        schoolId: user.schoolId || null,
        schoolName: user.schoolName || null,
        studentId: selectedStudent?.id || null,
        studentName: selectedStudent?.name || (studentId ? 'Department Student' : 'Department Wide'),
        studentEnrollment: selectedStudent?.enrollmentNumber || null,
        mentorId: selectedStudent?.mentorId || null,
        raisedBy: user.id || user.uid,
        raisedByName: user.name,
        raisedByRole: 'HOD',
        status: isDeanEscalation ? 'ESCALATED' : 'OPEN',
        escalationLevel: targetLevel,
        escalationHistory: isDeanEscalation ? [{
          from: 'HOD',
          to: 'DEAN',
          reason: deanReason,
          escalatedBy: user.name,
          byRole: 'HOD',
          at: new Date().toISOString()
        }] : []
      };

      try {
        const newIssueId = await IssueService.create(issuePayload);

        // Notify Dean if escalated
        if (isDeanEscalation) {
          await notifyDeans(
            newIssueId,
            `New Issue Escalated by HOD (${user.department || dept})`,
            `HOD ${user.name} raised and escalated an issue: "${title}". Reason: ${deanReason}`
          );
        }

        // Notify Student if selected
        if (selectedStudent?.id) {
          await NotificationService.create({
            userId: selectedStudent.id,
            type: 'ISSUE_RAISED',
            title: 'Department Issue Logged',
            message: `HOD ${user.name} logged an issue regarding "${title}". ${isDeanEscalation ? 'Escalated to Dean.' : ''}`,
            relatedId: newIssueId
          });
        }

        // Notify Mentor if student has an assigned mentor
        if (selectedStudent?.mentorId) {
          await NotificationService.create({
            userId: selectedStudent.mentorId,
            type: 'ISSUE_RAISED',
            title: `Issue Logged for Mentee (${selectedStudent.name})`,
            message: `HOD logged an issue for your mentee: "${title}". ${isDeanEscalation ? 'Escalated to Dean.' : ''}`,
            relatedId: newIssueId
          });
        }

        showToast(isDeanEscalation ? 'Issue raised and escalated to Dean successfully!' : 'Issue logged successfully!', 'success');
        close();
        if (onIssueCreated) onIssueCreated();
      } catch (err) {
        showToast(err.message, 'error');
      }
    }
  });

  // Attach dynamic toggle listeners inside modal
  setTimeout(() => {
    const deanRadio = document.getElementById('hod-target-dean');
    const hodRadio = document.getElementById('hod-target-hod');
    const reasonWrap = document.getElementById('hod-dean-reason-wrap');
    const confirmBtn = document.getElementById('custom-modal-confirm');

    if (deanRadio && hodRadio && reasonWrap) {
      deanRadio.addEventListener('change', () => {
        if (deanRadio.checked) {
          reasonWrap.style.display = 'block';
          if (confirmBtn) confirmBtn.textContent = 'Submit & Escalate';
        }
      });
      hodRadio.addEventListener('change', () => {
        if (hodRadio.checked) {
          reasonWrap.style.display = 'none';
          if (confirmBtn) confirmBtn.textContent = 'Submit Issue';
        }
      });
    }
  }, 50);
}

export async function render(container) {
  const user = getUserProfile();

  container.innerHTML = `
    <div class="dashboard-layout fade-in">
      ${createSidebar(user.role, '/hod/dashboard')}
      <div class="main-content">
        ${createHeader('HOD Dashboard', user)}
        <div class="page-content" id="hod-content">
          <div style="display:flex;justify-content:center;padding:60px;"><div class="spinner"></div></div>
        </div>
      </div>
    </div>
  `;

  try {
    const dept = user.department;
    const deptScope = departmentScope(user);
    const data = await StatsService.getDeptStats(deptScope);
    const { 
      totalStudents = 0, 
      totalMentors = 0, 
      highRiskStudents = 0, 
      openIssues = 0, 
      resolvedIssues = 0, 
      students = [], 
      mentors = [], 
      issues = [],
      meetings = []
    } = data || {};

        const severeIssues = (issues || [])
      .filter(i => (i.priority === 'CRITICAL' || i.priority === 'HIGH' || i.riskLevel === 'HIGH' || i.isSevere) && i.status !== 'RESOLVED')
      .sort((a,b) => new Date(b.updatedAt || b.createdAt || 0) - new Date(a.updatedAt || a.createdAt || 0));

const highRiskList = (students || [])
      .filter(s => s.riskLevel === 'HIGH')
      .sort((a,b) => (b.riskScore||0) - (a.riskScore||0));
    const frStudents = (students || []).filter(student => getAttendanceStatus(student).isLow);
    const cohortAnalysis = data.cohortAnalysis || StatsService.summarizeStudents(students);
    const learnerCounts = cohortAnalysis.learnerCounts;
    const classCohorts = buildDepartmentCohorts(students);
    const completedMeetings = meetings.filter(meeting => String(meeting.status || '').toUpperCase() === 'COMPLETED').length;
    const pendingMeetings = meetings.filter(meeting => String(meeting.status || '').toUpperCase() === 'REQUESTED').length;
    const activeMeetings = meetings.filter(meeting => ['APPROVED', 'SCHEDULED', 'ONGOING', 'IN_PROGRESS'].includes(String(meeting.status || '').toUpperCase())).length;
    const interventionMeetingStudentIds = new Set(meetings.filter(meeting => meeting.attendanceIntervention === true && ['REQUESTED', 'APPROVED', 'SCHEDULED', 'ONGOING', 'IN_PROGRESS'].includes(String(meeting.status || '').toUpperCase())).map(meeting => meeting.studentId));
    const frWithOpenMeeting = frStudents.filter(student => interventionMeetingStudentIds.has(student.id)).length;
    const monthKeys = Array.from({ length: 6 }, (_, index) => {
      const date = new Date();
      date.setDate(1);
      date.setMonth(date.getMonth() - 5 + index);
      return { key: `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`, label: date.toLocaleDateString('en-IN', { month: 'short' }) };
    });
    const departmentMeetingsByMonth = new Map(monthKeys.map(month => [month.key, 0]));
    meetings.forEach(meeting => {
      const date = new Date(meeting.createdAt || meeting.scheduledAt || '');
      if (!Number.isNaN(date.getTime())) {
        const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        if (departmentMeetingsByMonth.has(key)) departmentMeetingsByMonth.set(key, departmentMeetingsByMonth.get(key) + 1);
      }
    });
    const maxDepartmentMeetings = Math.max(1, ...departmentMeetingsByMonth.values());

    const escalations = (issues || []).filter(i => i.escalationLevel === 'HOD' || i.escalationLevel === 'DEAN' || (i.department === dept && (i.status === 'ESCALATED' || i.status === 'OPEN'))).sort((a,b) => new Date(b.updatedAt || b.createdAt || 0) - new Date(a.updatedAt || a.createdAt || 0));

    // Build mentor performance
    const mentorStats = mentors.filter(member => member.isApproved !== false && !['PENDING', 'REJECTED', 'DISABLED'].includes(String(member.status || '').toUpperCase())).map(m => {
      const mStudents = students.filter(s => s.mentorId === m.id);
      const mRisk     = mStudents.filter(s => s.riskLevel === 'HIGH').length;
      const analysis = StatsService.summarizeStudents(mStudents);
      return { ...m, studentCount: mStudents.length, highRisk: mRisk, analysis };
    }).sort((a, b) => b.analysis.frCount - a.analysis.frCount || b.analysis.learnerCounts.SLOW - a.analysis.learnerCounts.SLOW || b.studentCount - a.studentCount);
    const pendingFaculty = mentors.filter(member => String(member.status || '').toUpperCase() === 'PENDING' || member.isApproved === false);

    const content = container.querySelector('#hod-content');
    if (!content) return;
    content.innerHTML = `
      <div class="dashboard-container">
        <!-- Quick Actions Bar -->
        <div style="display:flex; gap:12px; margin-bottom:20px; flex-wrap:wrap;">
          <a href="#/hod/reports" class="btn btn-sm btn-primary" style="display:flex; align-items:center; gap:6px; border-radius:20px; font-weight:600;">
            <i class="ph ph-chart-bar" style="font-size:1.1rem;"></i> Mentor Reports
          </a>
          <a href="#/hod/allocation" class="btn btn-sm btn-secondary" style="display:flex; align-items:center; gap:6px; border-radius:20px; font-weight:600;">
            <i class="ph ph-users-three" style="font-size:1.1rem; color:var(--accent);"></i> Allocation
          </a>
          <a href="#/hod/risk-students" class="btn btn-sm btn-secondary" style="display:flex; align-items:center; gap:6px; border-radius:20px; font-weight:600;">
            <i class="ph ph-warning-octagon" style="font-size:1.1rem; color:var(--danger);"></i> Severe Issues
          </a>
          <a href="#/hod/escalations" class="btn btn-sm btn-secondary" style="display:flex; align-items:center; gap:6px; border-radius:20px; font-weight:600;">
            <i class="ph ph-siren" style="font-size:1.1rem; color:var(--warning);"></i> Escalations
          </a>
        
          <button id="btn-hod-raise-issue" class="btn btn-sm btn-primary" style="display:flex; align-items:center; gap:6px; border-radius:20px; font-weight:700; margin-left:auto; background:linear-gradient(135deg, #6366f1, #a855f7); color:#fff; border:none; box-shadow:0 3px 10px rgba(99,102,241,0.25);">
            <i class="ph ph-plus-circle" style="font-size:1.1rem;"></i> Raise &amp; Escalate Issue
          </button>
        </div>

        <!-- Stats -->
      <div class="stats-grid" style="grid-template-columns:repeat(auto-fit,minmax(150px,1fr));margin-bottom:24px;">
        ${[
          ['Total Students',   totalStudents,    'var(--info)',    'M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5z'],
          ['Mentors',          totalMentors,     'var(--accent)', 'M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z'],
          ['Severe Issues',     severeIssues.length, 'var(--danger)', 'M1 21h22L12 2 1 21zm12-3h-2v-2h2v2zm0-4h-2v-4h2v4z'],
          ['Open Issues',      openIssues,       'var(--warning)','M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z'],
          ['Resolved Issues',  resolvedIssues,   'var(--success)','M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z'],
          ['FR Attendance (≤40%)', frStudents.length, 'var(--danger)', 'M12 2 1 21h22L12 2zm1 14h-2v-2h2v2zm0-4h-2V8h2v4z'],
        ].map(([l,v,c,i]) => `
          <div class="stat-card">
            <div class="stat-icon" style="background:${c}22;"><svg viewBox="0 0 24 24" style="fill:${c};width:20px;height:20px;"><path d="${i}"/></svg></div>
            <div class="stat-label">${l}</div>
            <div class="stat-value">${v}</div>
          </div>
        `).join('')}
      </div>

      <div class="card" style="padding:20px;margin-bottom:24px;border:1px solid var(--border);">
        <div style="display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap;margin-bottom:14px;">
          <div><h3 style="margin:0;color:var(--danger);">FR students — low attendance</h3><p style="margin:3px 0 0;color:var(--text-muted);font-size:.8rem;">FR means recorded attendance at or below 40%. Request a special support meeting for follow-up.</p></div>
          <div style="display:flex;gap:6px;flex-wrap:wrap;"><span class="badge badge-danger">${frStudents.length} FR</span><span class="badge badge-muted">Not assessed ${learnerCounts.NOT_ASSESSED}</span></div>
        </div>
        <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:12px;">
          <span class="badge badge-danger">Slow marks band (&lt;50%): ${learnerCounts.SLOW}</span><span class="badge badge-warning">Medium (50–74%): ${learnerCounts.MEDIUM}</span><span class="badge badge-success">Advanced (≥75%): ${learnerCounts.ADVANCED}</span>
        </div>
        ${frStudents.length ? `<div style="overflow:auto;"><table class="data-table"><thead><tr><th>Student</th><th>Class</th><th>Attendance</th><th>Latest marks</th><th>Learner level</th><th>Follow-up</th></tr></thead><tbody>${frStudents.slice(0, 12).map(student => `<tr><td>${escapeHtml(student.name || 'Student')}<div style="font-size:.75rem;color:var(--text-muted);">${escapeHtml(student.enrollmentNumber || '')}</div></td><td>${escapeHtml(student.class || '—')}</td><td><span class="badge badge-danger">FR · ${Math.max(0, Number(student.attendance) || 0)}%</span></td><td>${student.latestSubjectAverage === null || student.latestSubjectAverage === undefined ? '—' : `${escapeHtml(student.latestSubjectAverage)}%`}</td><td>${escapeHtml(student.learnerLevel || 'Not assessed')}</td><td><button class="btn btn-xs btn-primary hod-fr-meeting" data-student-id="${student.id}">Special meeting</button></td></tr>`).join('')}</tbody></table></div>` : '<p style="margin:0;color:var(--text-muted);">No recorded FR attendance cases in this department.</p>'}
      </div>

      <div class="card" style="padding:20px;margin-bottom:24px;">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:12px;flex-wrap:wrap;margin-bottom:14px;">
          <div><h3 style="margin:0;">Department academic health</h3><p style="margin:4px 0 0;color:var(--text-muted);font-size:.8rem;">Averages use students with published marks or recorded attendance; sample sizes are shown.</p></div>
          <span class="badge badge-info">Attendance coverage · ${cohortAnalysis.attendanceRecorded}/${cohortAnalysis.total}</span>
        </div>
        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));gap:10px;margin-bottom:16px;">
          <div style="padding:12px;border:1px solid var(--border);border-radius:10px;"><div style="font-size:.72rem;color:var(--text-muted);">Mean subject marks</div><strong style="font-size:1.2rem;">${cohortAnalysis.averageSubjectMarks === null ? '—' : `${cohortAnalysis.averageSubjectMarks}%`}</strong><div style="font-size:.72rem;color:var(--text-muted);">${cohortAnalysis.marksAssessed} students assessed</div></div>
          <div style="padding:12px;border:1px solid var(--border);border-radius:10px;"><div style="font-size:.72rem;color:var(--text-muted);">Mean attendance</div><strong style="font-size:1.2rem;">${cohortAnalysis.averageAttendance === null ? '—' : `${cohortAnalysis.averageAttendance}%`}</strong><div style="font-size:.72rem;color:var(--text-muted);">${cohortAnalysis.attendanceRecorded} students with records</div></div>
          <div style="padding:12px;border:1px solid var(--border);border-radius:10px;"><div style="font-size:.72rem;color:var(--text-muted);">Below 75% attendance</div><strong style="font-size:1.2rem;color:${cohortAnalysis.belowTargetAttendance ? 'var(--warning)' : 'var(--success)'};">${cohortAnalysis.belowTargetAttendance}</strong><div style="font-size:.72rem;color:var(--text-muted);">FR cases: ${cohortAnalysis.frCount}</div></div>
          <div style="padding:12px;border:1px solid var(--border);border-radius:10px;"><div style="font-size:.72rem;color:var(--text-muted);">Students without mentor</div><strong style="font-size:1.2rem;color:${cohortAnalysis.unassignedCount ? 'var(--warning)' : 'var(--success)'};">${cohortAnalysis.unassignedCount}</strong><div style="font-size:.72rem;color:var(--text-muted);">of ${cohortAnalysis.total} department students</div></div>
        </div>
        <h4 style="font-size:.84rem;margin:0 0 8px;">Course, year, and class comparison</h4>
        ${classCohorts.length ? `<div style="overflow:auto;"><table class="data-table"><thead><tr><th>Course</th><th>Year</th><th>Class</th><th>Students</th><th>Mean marks</th><th>Mean attendance</th><th>FR</th><th>Slow band</th></tr></thead><tbody>${classCohorts.slice(0, 12).map(group => `<tr><td>${escapeHtml(group.course)}</td><td>${escapeHtml(group.year)}</td><td>${escapeHtml(group.classroom)}</td><td>${group.students.length}</td><td>${group.analysis.averageSubjectMarks === null ? '—' : `${group.analysis.averageSubjectMarks}% (${group.analysis.marksAssessed})`}</td><td>${group.analysis.averageAttendance === null ? '—' : `${group.analysis.averageAttendance}% (${group.analysis.attendanceRecorded})`}</td><td><span class="badge ${group.analysis.frCount ? 'badge-danger' : 'badge-success'}">${group.analysis.frCount}</span></td><td>${group.analysis.learnerCounts.SLOW}</td></tr>`).join('')}</tbody></table></div>` : '<p style="color:var(--text-muted);font-size:.8rem;">No department students are available for comparison.</p>'}
      </div>

      <div class="card" style="padding:20px;margin-bottom:24px;">
        <div style="display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap;margin-bottom:12px;"><div><h3 style="margin:0;">Mentorship follow-through</h3><p style="margin:4px 0 0;color:var(--text-muted);font-size:.8rem;">Meeting volume by request date, with active and completed status counts.</p></div><div style="display:flex;gap:6px;flex-wrap:wrap;"><span class="badge badge-info">${meetings.length} total</span><span class="badge badge-warning">${pendingMeetings} requested</span><span class="badge badge-primary">${activeMeetings} scheduled / active</span><span class="badge badge-success">${completedMeetings} completed</span></div></div>
        <p style="font-size:.78rem;color:var(--text-secondary);margin:0 0 10px;">${frWithOpenMeeting} of ${frStudents.length} current FR students have an open support meeting.</p>
        ${meetings.length ? `<div style="display:grid;grid-template-columns:repeat(6,minmax(36px,1fr));gap:10px;align-items:end;height:100px;padding:4px;">${monthKeys.map(month => { const count = departmentMeetingsByMonth.get(month.key) || 0; const height = count ? Math.max(8, Math.round(count / maxDepartmentMeetings * 72)) : 3; return `<div title="${month.label}: ${count} requests" style="display:flex;flex-direction:column;align-items:center;justify-content:flex-end;height:100%;gap:5px;"><span style="font-size:.7rem;color:var(--text-secondary);">${count}</span><div style="width:min(100%,40px);height:${height}px;background:var(--accent);border-radius:5px 5px 2px 2px;"></div><span style="font-size:.68rem;color:var(--text-muted);">${month.label}</span></div>`; }).join('')}</div>` : '<p style="margin:0;color:var(--text-muted);font-size:.8rem;">No department meeting records yet.</p>'}
      </div>

      <div style="display:grid;grid-template-columns:1fr 1fr;gap:20px;margin-bottom:20px;">
        <!-- Severe Issues (In Place of High Risk) -->
        <div class="card" style="border-top:3px solid var(--danger);">
          <div class="card-header" style="display:flex; justify-content:space-between; align-items:center;">
            <div style="display:flex; align-items:center; gap:8px;">
              <span class="stat-icon" style="background:rgba(239,68,68,0.15); color:var(--danger); width:32px; height:32px; border-radius:8px; display:inline-flex; align-items:center; justify-content:center; font-size:1.1rem;">
                <i class="ph ph-warning-octagon"></i>
              </span>
              <div>
                <h3 style="margin:0; font-size:1rem; font-weight:700; color:var(--danger);">Severe Issues</h3>
                <p style="margin:2px 0 0; font-size:0.75rem; color:var(--text-muted);">Urgent grievances &amp; critical concerns requiring immediate resolution</p>
              </div>
            </div>
            <span class="badge badge-danger" style="font-weight:700; font-size:0.75rem;">${severeIssues.length} Severe Flagged</span>
          </div>
          ${severeIssues.length === 0
            ? '<p style="padding:24px; color:var(--text-muted); text-align:center;">No active severe or critical issues flagged in this department.</p>'
            : `<div style="display:flex; flex-direction:column;">
                ${severeIssues.slice(0, 6).map(si => `
                  <div class="list-item" style="padding:14px; border-bottom:1px solid var(--border); display:flex; justify-content:space-between; align-items:flex-start; gap:12px;">
                    <div style="flex:1;">
                      <div style="display:flex; align-items:center; gap:8px; margin-bottom:4px; flex-wrap:wrap;">
                        <span style="font-weight:700; font-size:0.88rem; color:var(--text);">${escapeHtml(si.title)}</span>
                        <span class="badge badge-danger" style="font-size:0.68rem; font-weight:700; letter-spacing:0.03em; display:inline-flex; align-items:center; gap:3px;">
                          <i class="ph ph-warning"></i> ${escapeHtml(si.priority || 'SEVERE')}
                        </span>
                        <span class="badge ${si.status === 'ESCALATED' ? 'badge-danger' : 'badge-warning'}" style="font-size:0.68rem;">
                          ${escapeHtml(si.status)}
                        </span>
                        ${si.escalationLevel === 'DEAN' 
                          ? `<span class="badge badge-accent" style="font-size:0.68rem; display:inline-flex; align-items:center; gap:3px;"><i class="ph ph-shield-check"></i> At Dean</span>`
                          : `<span class="badge badge-info" style="font-size:0.68rem; display:inline-flex; align-items:center; gap:3px;"><i class="ph ph-user-circle"></i> At HOD</span>`
                        }
                      </div>
                      <div style="font-size:0.8rem; color:var(--text-secondary); margin-bottom:2px;">
                        <strong>Student:</strong> ${escapeHtml(si.studentName || 'Department-Wide')} 
                        ${si.category ? `&bull; <strong>Category:</strong> ${escapeHtml(si.category)}` : ''}
                      </div>
                      ${si.description ? `<p style="font-size:0.76rem; color:var(--text-muted); margin:3px 0 0; line-clamp:2; display:-webkit-box; -webkit-line-clamp:2; -webkit-box-orient:vertical; overflow:hidden;">${escapeHtml(si.description)}</p>` : ''}
                    </div>
                    <div style="display:flex; flex-direction:column; gap:6px; align-items:flex-end; flex-shrink:0;">
                      ${si.status !== 'RESOLVED' && si.escalationLevel !== 'DEAN' ? `
                        <button class="btn btn-xs btn-outline-danger btn-dash-escalate-dean" data-id="${si.id}" data-title="${escapeHtml(si.title)}" style="display:inline-flex; align-items:center; gap:4px; font-weight:600; font-size:0.75rem; white-space:nowrap; border-radius:6px;">
                          <i class="ph ph-arrow-up-right"></i> Escalate to Dean
                        </button>
                        <button class="btn btn-xs btn-outline-success btn-dash-resolve" data-id="${si.id}" data-title="${escapeHtml(si.title)}" data-sid="${si.studentId || ''}" style="display:inline-flex; align-items:center; gap:4px; font-weight:600; font-size:0.75rem; white-space:nowrap; border-radius:6px;">
                          <i class="ph ph-check"></i> Resolve
                        </button>
                      ` : si.escalationLevel === 'DEAN' && si.status !== 'RESOLVED' ? `
                        <span style="font-size:0.75rem; color:var(--accent); font-weight:600; display:inline-flex; align-items:center; gap:4px;">
                          <i class="ph ph-clock"></i> Under Dean Review
                        </span>
                      ` : `
                        <span class="badge badge-success" style="font-size:0.72rem;">Resolved</span>
                      `}
                    </div>
                  </div>
                `).join('')}
              </div>`
          }
        </div>

        <!-- Escalations -->
        <div class="card">
          <div class="card-header" style="display:flex; justify-content:space-between; align-items:center;">
            <div>
              <h3 style="margin:0; font-size:1rem; font-weight:700; display:flex; align-items:center; gap:8px;">
                <i class="ph ph-siren" style="color:var(--warning);"></i> Escalated &amp; Department Issues
              </h3>
              <p style="margin:2px 0 0; font-size:0.75rem; color:var(--text-muted);">Manage department grievances and escalate critical matters to the Dean</p>
            </div>
            <div style="display:flex; align-items:center; gap:8px;">
              <button id="btn-card-raise-issue" class="btn btn-xs btn-primary" style="display:inline-flex; align-items:center; gap:4px; font-weight:600;">
                <i class="ph ph-plus"></i> Raise Issue
              </button>
              <a href="#/hod/escalations" style="font-size:0.8rem; color:var(--accent); font-weight:600;">View All</a>
            </div>
          </div>
          ${escalations.length === 0
            ? '<p style="padding:20px;color:var(--text-muted);">No escalations or pending issues found.</p>'
            : `<div style="display:flex; flex-direction:column;">
                ${escalations.slice(0,6).map(e => `
                  <div class="list-item" style="padding:14px; border-bottom:1px solid var(--border); display:flex; justify-content:space-between; align-items:flex-start; gap:12px;" id="dash-esc-${e.id}">
                    <div style="flex:1;">
                      <div style="display:flex; align-items:center; gap:8px; margin-bottom:4px; flex-wrap:wrap;">
                        <span style="font-weight:700; font-size:0.88rem; color:var(--text);">${escapeHtml(e.title)}</span>
                        <span class="badge ${e.status==='RESOLVED'?'badge-success':e.status==='ESCALATED'?'badge-danger':'badge-warning'}" style="font-size:0.7rem;">${escapeHtml(e.status)}</span>
                        ${e.priority ? `<span class="badge ${e.priority==='CRITICAL'||e.priority==='HIGH'?'badge-danger':'badge-warning'}" style="font-size:0.68rem;">${escapeHtml(e.priority)}</span>` : ''}
                        ${e.escalationLevel === 'DEAN' 
                          ? `<span class="badge badge-accent" style="font-size:0.7rem; display:inline-flex; align-items:center; gap:3px;"><i class="ph ph-shield-check"></i> At Dean</span>`
                          : `<span class="badge badge-info" style="font-size:0.7rem; display:inline-flex; align-items:center; gap:3px;"><i class="ph ph-user-circle"></i> At HOD</span>`
                        }
                      </div>
                      <div style="font-size:0.8rem; color:var(--text-secondary); margin-bottom:2px;">
                        <strong>Student:</strong> ${escapeHtml(e.studentName || 'Department-Wide')} 
                        ${e.category ? `&bull; <strong>Category:</strong> ${escapeHtml(e.category)}` : ''}
                      </div>
                      ${e.description ? `<p style="font-size:0.76rem; color:var(--text-muted); margin:4px 0 0; line-clamp:2; display:-webkit-box; -webkit-line-clamp:2; -webkit-box-orient:vertical; overflow:hidden;">${escapeHtml(e.description)}</p>` : ''}
                    </div>
                    <div style="display:flex; flex-direction:column; gap:6px; align-items:flex-end; flex-shrink:0;">
                      ${e.status !== 'RESOLVED' && e.escalationLevel !== 'DEAN' ? `
                        <button class="btn btn-xs btn-outline-danger btn-dash-escalate-dean" data-id="${e.id}" data-title="${escapeHtml(e.title)}" style="display:inline-flex; align-items:center; gap:4px; font-weight:600; white-space:nowrap; border-radius:6px;">
                          <i class="ph ph-arrow-up-right"></i> Escalate to Dean
                        </button>
                        <button class="btn btn-xs btn-outline-success btn-dash-resolve" data-id="${e.id}" data-title="${escapeHtml(e.title)}" data-sid="${e.studentId || ''}" style="display:inline-flex; align-items:center; gap:4px; font-weight:600; white-space:nowrap; border-radius:6px;">
                          <i class="ph ph-check"></i> Resolve
                        </button>
                      ` : e.escalationLevel === 'DEAN' && e.status !== 'RESOLVED' ? `
                        <span style="font-size:0.75rem; color:var(--accent); font-weight:600; display:inline-flex; align-items:center; gap:4px;">
                          <i class="ph ph-clock"></i> Awaiting Dean
                        </span>
                      ` : `
                        <span class="badge badge-success" style="font-size:0.72rem;">Resolved</span>
                      `}
                    </div>
                  </div>
                `).join('')}
              </div>`
          }
        </div>
      </div>

      <div style="display:grid;grid-template-columns:1fr 1fr;gap:20px;margin-bottom:20px;">
        <!-- Bulk Registration -->
        <div class="card" style="grid-column: 1 / -1;">
          <div class="card-header">
            <h3>Bulk User Registration</h3>
            <span style="font-size:0.8rem;color:var(--text-secondary);">Register students and faculty for your department via CSV</span>
          </div>
          <div style="padding:16px; display:flex; gap:12px; align-items:center;">
            <button id="btn-hod-download-template" class="btn btn-secondary">⬇️ Download Template</button>
            <label class="btn btn-primary" style="margin:0;cursor:pointer;">
              📁 Bulk Import (CSV / Excel)
              <input type="file" id="hod-csv-upload" accept=".csv, .xlsx, .xls" style="display:none;">
            </label>
          </div>
        </div>

        <!-- Manage Classes -->
        <div class="card" style="grid-column: 1 / -1;">
          <div class="card-header">
            <h3>Manage Classes</h3>
            <span style="font-size:0.8rem;color:var(--text-secondary);">Students select these when registering</span>
          </div>
          <div style="display:flex;gap:12px;align-items:center;margin-bottom:16px;">
            <input type="text" id="new-class-name" class="form-input" placeholder="e.g. 1 or A" style="max-width:200px;">
            <button class="btn btn-primary" id="btn-add-class">Add Class</button>
          </div>
          <div id="class-list" style="display:flex;gap:8px;flex-wrap:wrap;">
            <!-- Classes will be rendered here -->
          </div>
        </div>
      </div>

      <!-- Approvals Queue -->
      <div class="card" style="margin-bottom:20px;">
        <div class="card-header"><h3>Pending Faculty Approvals</h3></div>
        ${pendingFaculty.length === 0
          ? '<p style="padding:20px;color:var(--text-muted);">No pending approvals.</p>'
          : `<table class="data-table">
              <thead><tr><th>Name</th><th>Email</th><th>Action</th></tr></thead>
              <tbody>
                ${pendingFaculty.map(m => `
                  <tr>
                    <td><strong>${m.name}</strong></td>
                    <td>${m.email}</td>
                    <td><button class="btn btn-xs btn-primary btn-approve" data-id="${m.id}">Approve</button></td>
                  </tr>
                `).join('')}
              </tbody>
             </table>`
        }
      </div>

      <!-- Mentor Performance -->
      <div class="card">
        <div class="card-header"><h3>Mentor Performance — ${dept || 'Department'}</h3></div>
        ${mentorStats.length === 0
          ? '<p style="padding:20px;color:var(--text-muted);">No mentors found.</p>'
          : `<table class="data-table">
              <thead><tr><th>Mentor</th><th>Students</th><th>Mean marks</th><th>Mean attendance</th><th>FR</th><th>Slow band</th><th>High risk</th></tr></thead>
              <tbody>
                ${mentorStats.map(m => `
                  <tr>
                    <td style="font-weight:600;">${m.name}</td>
                    <td>${m.studentCount}</td>
                    <td>${m.analysis.averageSubjectMarks === null ? '—' : `${m.analysis.averageSubjectMarks}%`}</td>
                    <td>${m.analysis.averageAttendance === null ? '—' : `${m.analysis.averageAttendance}%`}</td>
                    <td><span class="badge ${m.analysis.frCount ? 'badge-danger' : 'badge-success'}">${m.analysis.frCount}</span></td>
                    <td>${m.analysis.learnerCounts.SLOW}</td>
                    <td><span class="badge ${m.highRisk>3?'badge-danger':m.highRisk>1?'badge-warning':'badge-success'}">${m.highRisk}</span></td>
                  </tr>
                `).join('')}
              </tbody>
            </table>`
        }
      </div>

      <!-- ===== HOD Reports & Downloads Section ===== -->
      <div class="card" style="margin-top:20px;padding:0;overflow:hidden;border:1px solid var(--border);">
        <div style="display:flex;justify-content:space-between;align-items:center;padding:16px 20px;border-bottom:1px solid var(--border);background:linear-gradient(135deg,rgba(108,71,255,0.07),rgba(168,85,247,0.04));">
          <div>
            <h3 style="margin:0;font-size:0.95rem;font-weight:700;display:flex;align-items:center;gap:8px;">
              📊 Reports &amp; Downloads
              <span class="badge badge-accent" style="font-size:0.68rem;padding:2px 7px;">Export Center</span>
            </h3>
            <p style="margin:3px 0 0;font-size:0.78rem;color:var(--text-muted);">Generate mentor reports for ${dept || 'your department'}</p>
          </div>
          <div style="display:flex;gap:10px;">
            <button id="btn-hod-dash-excel" class="btn btn-sm btn-secondary" style="display:flex;align-items:center;gap:6px;">
              <i class="ph ph-file-xls" style="font-size:1rem;color:var(--success);"></i> Master Excel
            </button>
            <button id="btn-hod-dash-pdf" class="btn btn-sm btn-secondary" style="display:flex;align-items:center;gap:6px;">
              <i class="ph ph-file-pdf" style="font-size:1rem;color:var(--danger);"></i> Master PDF
            </button>
            <a href="#/hod/reports" class="btn btn-sm btn-primary" style="display:flex;align-items:center;gap:6px;font-weight:600;">
              <i class="ph ph-chart-bar"></i> Full Reports →
            </a>
          </div>
        </div>
        <div style="padding:14px 20px;display:flex;gap:12px;align-items:center;flex-wrap:wrap;">
          <label style="font-size:0.84rem;font-weight:600;color:var(--text-secondary);white-space:nowrap;">Quick Download for Mentor:</label>
          <select id="hod-dash-mentor-select" class="form-select" style="flex:1;min-width:200px;padding:7px 12px;font-size:0.84rem;">
            <option value="">-- Select a Faculty Mentor --</option>
            ${mentorStats.map(m => `<option value="${m.id}">${m.name} (${m.studentCount} students)</option>`).join('')}
          </select>
          <button id="btn-hod-single-excel" class="btn btn-sm btn-secondary" style="display:flex;align-items:center;gap:6px;">
            <i class="ph ph-file-xls" style="color:var(--success);"></i> Excel
          </button>
          <button id="btn-hod-single-pdf" class="btn btn-sm btn-secondary" style="display:flex;align-items:center;gap:6px;">
            <i class="ph ph-file-pdf" style="color:var(--danger);"></i> PDF
          </button>
        </div>
      </div>

    </div>
  `;

    
    // --- Raise Issue & Escalations Listeners ---
    container.querySelector('#btn-hod-raise-issue')?.addEventListener('click', () => {
      openRaiseIssueModal(user, dept, students, () => render(container));
    });

    container.querySelectorAll('.hod-fr-meeting').forEach(button => {
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

    container.querySelector('#btn-card-raise-issue')?.addEventListener('click', () => {
      openRaiseIssueModal(user, dept, students, () => render(container));
    });

    // Escalate existing issue to Dean
    container.querySelectorAll('.btn-dash-escalate-dean').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const issueId = e.currentTarget?.dataset?.id || btn.dataset.id;
        const issueTitle = e.currentTarget?.dataset?.title || btn.dataset.title || 'Department Issue';

        showModal({
          title: 'Escalate Issue to Dean',
          content: `
            <p style="font-size:0.875rem; color:var(--text-secondary); margin-bottom:14px;">
              You are escalating <strong>"${escapeHtml(issueTitle)}"</strong> to the Dean for university-level review and administrative intervention.
            </p>
            <div class="form-group">
              <label class="form-label" style="font-weight:600;">Reason for Escalation to Dean <span style="color:var(--danger);">*</span></label>
              <textarea id="dash-dean-reason" class="form-textarea" style="min-height:110px;" placeholder="State why Dean intervention or policy exception is required..."></textarea>
            </div>
          `,
          confirmText: 'Escalate to Dean',
          onConfirm: async (close) => {
            const reason = document.getElementById('dash-dean-reason')?.value.trim();
            if (!reason) {
              return showToast('Escalation reason is required', 'error');
            }
            try {
              await IssueService.escalate(issueId, 'DEAN', reason, user.name, 'HOD');
              await notifyDeans(
                issueId,
                `Issue Escalated to Dean by HOD (${user.department || dept})`,
                `HOD ${user.name} escalated issue "${issueTitle}" to Dean: ${reason}`
              );
              showToast('Issue escalated to Dean successfully!', 'success');
              close();
              render(container);
            } catch (err) {
              showToast(err.message, 'error');
            }
          }
        });
      });
    });

    // Resolve issue directly from dashboard
    container.querySelectorAll('.btn-dash-resolve').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const issueId = e.currentTarget?.dataset?.id || btn.dataset.id;
        const studentId = e.currentTarget?.dataset?.sid || btn.dataset.sid;
        const issueTitle = e.currentTarget?.dataset?.title || btn.dataset.title || 'Issue';

        showModal({
          title: 'Resolve Issue',
          content: `
            <div class="form-group">
              <label class="form-label" style="font-weight:600;">Resolution Notes <span style="color:var(--danger);">*</span></label>
              <textarea id="dash-resolution-notes" class="form-textarea" style="min-height:110px;" placeholder="Describe what was resolved and any follow-up actions..."></textarea>
            </div>
          `,
          confirmText: 'Resolve',
          onConfirm: async (close) => {
            const resolution = document.getElementById('dash-resolution-notes')?.value.trim();
            if (!resolution) {
              return showToast('Resolution notes are required', 'error');
            }
            try {
              await IssueService.resolve(issueId, resolution, 'HOD');
              if (studentId) {
                await NotificationService.create({
                  userId: studentId,
                  type: 'ISSUE_RESOLVED',
                  title: 'Issue Resolved',
                  message: `Your issue "${issueTitle}" has been resolved by HOD: ${resolution}`,
                  relatedId: issueId
                });
              }
              showToast('Issue marked as resolved!', 'success');
              close();
              render(container);
            } catch (err) {
              showToast(err.message, 'error');
            }
          }
        });
      });
    });

    container.querySelectorAll('.btn-approve').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const id = e.currentTarget?.dataset?.id || e.target.closest('.btn-approve')?.dataset?.id;
        if (!id) return;
        btn.disabled = true; btn.textContent = '...';
        try {
          await FacultyService.approve(id);
          showToast('Faculty approved successfully!', 'success');
          setTimeout(() => render(container), 1000); // refresh page
        } catch (err) {
          showToast(err.message, 'error');
          btn.disabled = false; btn.textContent = 'Approve';
        }
      });
    });

    // HOD Dashboard Report Buttons
    container.querySelector('#btn-hod-dash-excel')?.addEventListener('click', async () => {
      await exportMentorStudentReport('excel');
    });
    container.querySelector('#btn-hod-dash-pdf')?.addEventListener('click', async () => {
      await exportMentorStudentReport('pdf');
    });
    container.querySelector('#btn-hod-single-excel')?.addEventListener('click', async () => {
      const mId = container.querySelector('#hod-dash-mentor-select')?.value;
      if (!mId) return showToast('Please select a mentor first', 'warning');
      await exportSingleMentorReport(mId, 'excel');
    });
    container.querySelector('#btn-hod-single-pdf')?.addEventListener('click', async () => {
      const mId = container.querySelector('#hod-dash-mentor-select')?.value;
      if (!mId) return showToast('Please select a mentor first', 'warning');
      await exportSingleMentorReport(mId, 'pdf');
    });

    // --- Bulk CSV Upload Logic ---
    const btnDownloadTemplate = document.getElementById('btn-hod-download-template');
    if (btnDownloadTemplate) {
      btnDownloadTemplate.addEventListener('click', () => {
        const csvContent = "role,name,email,password,class,enrollmentNumber\nSTUDENT,Sample Student,student@example.com,REPLACE_WITH_STRONG_PASSWORD,A,EN1001\nFACULTY,Sample Faculty,faculty@example.com,REPLACE_WITH_STRONG_PASSWORD,,EMP001\n";
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement("a");
        const url = URL.createObjectURL(blob);
        link.setAttribute("href", url);
        link.setAttribute("download", "User_Registration_Template.csv");
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      });
    }

    const csvUpload = document.getElementById('hod-csv-upload');
    if (csvUpload) {
      csvUpload.addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        if (!confirm(`Are you sure you want to bulk import users into ${dept}?`)) {
          e.target.value = '';
          return;
        }

        try {
          const rowsMatrix = await parseImportFile(file);
          if (!rowsMatrix || rowsMatrix.length <= 1) {
            e.target.value = '';
            return showToast('File is empty or only contains headers', 'warning');
          }

          const headers = rowsMatrix[0].map(h => String(h || '').trim().toLowerCase());
          const expected = ['role', 'name', 'email', 'password'];
          for (const req of expected) {
            if (!headers.includes(req)) {
              e.target.value = '';
              return showToast(`Missing required column: ${req}`, 'error');
            }
          }

          const dataRows = [];
          for (let i = 1; i < rowsMatrix.length; i++) {
            const cols = rowsMatrix[i].map(c => String(c !== null && c !== undefined ? c : '').trim());
            const row = {};
            headers.forEach((h, idx) => { row[h] = cols[idx] || ''; });
            
            // Skip completely empty rows or rows missing required fields
            if (isRowObjectEmpty(row)) continue;
            if (!row.role || !row.email || !row.password) continue;
            
            dataRows.push(row);
          }

          if (dataRows.length === 0) {
            e.target.value = '';
            return showToast('No valid non-empty user records found in file', 'warning');
          }

          showToast(`Processing ${dataRows.length} users for ${dept}...`, 'info');
          let successCount = 0;
          let duplicateCount = 0;
          let failCount = 0;
          const { AdminService } = await import('/js/services.js');
          const seenEmails = new Set();

          for (let i = 0; i < dataRows.length; i++) {
            const row = dataRows[i];
            const cleanEmail = (row.email || '').toLowerCase().trim();

            if (seenEmails.has(cleanEmail)) {
              duplicateCount++;
              continue;
            }

            try {
              const role = row.role.toUpperCase();
              const data = {
                role, name: row.name, email: row.email, password: row.password, department: dept
              };

              if (role === 'STUDENT') {
                data.class = row.class || null;
                data.year = (row.year && !isNaN(parseInt(row.year))) ? parseInt(row.year) : null;
                data.enrollmentNumber = row.enrollmentnumber || row.employeeid || null;
              } else {
                data.employeeId = row.employeeid || row.enrollmentnumber || null;
              }

              await AdminService.createUser(data);
              seenEmails.add(cleanEmail);
              successCount++;
            } catch(err) {
              console.error(`Error importing row ${i + 1}:`, err);
              if (err.code === 'auth/email-already-in-use' || String(err.message || '').includes('already in use')) {
                duplicateCount++;
              } else {
                failCount++;
              }
            }

            if ((i + 1) % 5 === 0) {
              await new Promise(r => setTimeout(r, 0));
            }
          }
          e.target.value = '';
          const msg = `Bulk Import Finished! ${successCount} created successfully. ${duplicateCount ? duplicateCount + ' duplicates skipped. ' : ''}${failCount ? failCount + ' failed.' : ''}`;
          showToast(msg, successCount > 0 ? 'success' : 'info');
          if (successCount > 0) setTimeout(() => render(container), 1500);
        } catch (err) {
          console.error('Import error:', err);
          e.target.value = '';
        }
      });
    }

    // Load and render classes
    async function loadClasses() {
      const list = container.querySelector('#class-list');
      if (!list) return;
      try {
        const { ClassService } = await import('/js/services.js');
        const classes = await ClassService.getByDepartment(deptScope);
        if (!classes || !classes.length) {
          list.innerHTML = '<span style="color:var(--text-muted);font-size:0.85rem;">No classes defined.</span>';
          return;
        }
        list.innerHTML = classes.map(c => `
          <span class="badge badge-info" style="display:inline-flex;align-items:center;gap:6px;font-size:0.85rem;padding:6px 12px;">
            Class ${c.className}
            <button class="btn-del-class" data-id="${c.id}" style="background:none;border:none;color:currentColor;cursor:pointer;opacity:0.7;margin-left:4px;" title="Delete class">✕</button>
          </span>
        `).join('');

        container.querySelectorAll('.btn-del-class').forEach(btn => {
          btn.addEventListener('click', async () => {
            if(!confirm('Delete this class?')) return;
            try {
              await ClassService.delete(btn.dataset.id);
              showToast('Class deleted', 'success');
              await loadClasses();
            } catch (err) {
              showToast('Error deleting class: ' + err.message, 'error');
            }
          });
        });
      } catch (e) {
        console.error('Failed to load classes:', e);
        if (list) list.innerHTML = '<span style="color:var(--danger);font-size:0.85rem;">Error loading classes</span>';
      }
    }

    const addClassBtn = container.querySelector('#btn-add-class');
    if (addClassBtn) {
      addClassBtn.addEventListener('click', async () => {
        const input = container.querySelector('#new-class-name');
        const name = input ? input.value.trim() : '';
        if (!name) {
          showToast('Please enter a class name (e.g. TY-CORE-1)', 'warning');
          return;
        }
        if (!dept) {
          showToast('Department is not set in your profile', 'error');
          return;
        }
        addClassBtn.disabled = true;
        try {
          const { ClassService } = await import('/js/services.js');
          const existing = await ClassService.getByDepartment(deptScope);
          if (existing.some(c => (c.className || '').toLowerCase() === name.toLowerCase())) {
            showToast(`Class "${name}" already exists for ${dept}`, 'warning');
            addClassBtn.disabled = false;
            return;
          }
          await ClassService.create({ department: dept, departmentId: user.departmentId || null, schoolId: user.schoolId || null, schoolName: user.schoolName || null, className: name });
          if (input) input.value = '';
          showToast(`Class "${name}" added successfully!`, 'success');
          await loadClasses();
        } catch (err) {
          console.error('Failed to add class:', err);
          showToast('Failed to add class: ' + (err.message || err), 'error');
        } finally {
          addClassBtn.disabled = false;
        }
      });
    }

    loadClasses();

  } catch (err) {
    const content = container.querySelector('#hod-content');
    if (content) content.innerHTML = `<div class="empty-state"><h3 style="color:var(--danger);">Error loading dashboard</h3><p>${err.message}</p></div>`;
  }
}

