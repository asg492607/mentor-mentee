/**
 * @fileoverview Faculty mentor overview dashboard with cohort indicators
 * @module dashboard
 */
// Mentor � Dashboard Page
// Overview: assigned students, pending meetings, escalated issues, and quick actions.
import { getUserProfile } from '/js/auth.js';
import { createSidebar } from '/js/components/sidebar.js';
import { createHeader } from '/js/components/header.js';
import { showToast } from '/js/components/toast.js';
import { StatsService, MeetingService, NotificationService, BookletService } from '/js/services.js';
import { startTour } from '/js/components/tour.js';
import { getAttendanceStatus, AttendanceInterventionService } from '/js/services/academic-service.js';
import { escapeHtml } from '/js/utils.js';

function riskBadge(r) {
  const cls = { HIGH: 'badge-danger', MEDIUM: 'badge-warning', LOW: 'badge-success' }[r] || 'badge-muted';
  return `<span class="badge ${cls}">${r || 'N/A'}</span>`;
}

function renderStats(totalStudents, pendingRequests, highRisk, completedMeetings, compliantBooklets = 0, lowAttendanceCount = 0) {
  return [
    { label: 'My Students', value: totalStudents, color: 'var(--info)', icon: 'ph-users' },
    { label: 'Pending Requests', value: pendingRequests, color: 'var(--warning)', icon: 'ph-calendar-plus' },
    { label: 'High Risk', value: highRisk, color: 'var(--danger)', icon: 'ph-warning-circle' },
    { label: 'Completed Meets', value: completedMeetings, color: 'var(--success)', icon: 'ph-calendar-check' },
    { label: 'Booklets (≥25%)', value: `${compliantBooklets}/${totalStudents}`, color: 'var(--accent)', icon: 'ph-book-open' },
    { label: 'FR Attendance (≤40%)', value: lowAttendanceCount, color: 'var(--danger)', icon: 'ph-warning' },
  ].map(c => `
    <div class="stat-card">
      <div class="stat-icon" style="background:${c.color}22; color:${c.color}; font-size:1.5rem; display:flex; align-items:center; justify-content:center;">
        <i class="ph ${c.icon}"></i>
      </div>
      <div class="stat-label">${c.label}</div>
      <div class="stat-value">${c.value}</div>
    </div>
  `).join('');
}

function renderPendingMeetings(pendingMeetings) {
  if (pendingMeetings.length === 0) {
    return '<p style="padding:20px;color:var(--text-muted);">No pending requests.</p>';
  }

  return pendingMeetings.slice(0, 5).map(m => `
    <div class="list-item" style="flex-direction:column;align-items:flex-start;gap:10px;">
      <div style="width:100%;">
        <div style="display:flex;justify-content:space-between;margin-bottom:4px;">
          <p style="font-weight:600;font-size:0.875rem;">${m.studentName || '-'}</p>
          <span class="badge badge-info">${m.type || 'Meeting'}</span>
        </div>
        <p style="color:var(--text-muted);font-size:0.78rem;">${m.description || ''}</p>
      </div>
      <div style="display:flex;gap:8px;width:100%;align-items:center;">
        <input type="datetime-local" class="form-input sched-input" data-id="${m.id}" value="${m.preferredDate || m.scheduledAt || ''}" style="flex:1;padding:6px 10px;font-size:0.78rem;">
        <button class="btn btn-sm btn-success approve-btn" data-id="${m.id}" data-name="${m.studentName || 'this student'}">Approve</button>
        <button class="btn btn-sm btn-danger reject-btn" data-id="${m.id}" data-name="${m.studentName || 'this student'}">Reject</button>
      </div>
    </div>
  `).join('');
}

function getBookletSnapshot(student) {
  const booklet = student.booklet || {};
  let latestSGPA = '-';
  let totalBacklogs = '-';
  let lastMeet = '-';

  if (booklet.academics) {
    const sems = ['SEM VIII', 'SEM VII', 'SEM VI', 'SEM V', 'SEM IV', 'SEM III', 'SEM II', 'SEM I'];
    for (const sem of sems) {
      if (booklet.academics[sem] && (booklet.academics[sem].classAwarded || booklet.academics[sem].backlogs)) {
        latestSGPA = booklet.academics[sem].classAwarded || '-';
        totalBacklogs = booklet.academics[sem].backlogs || '-';
        break;
      }
    }
  }

  if (booklet.meets && booklet.meets.length > 0) {
    lastMeet = booklet.meets[booklet.meets.length - 1].date || '-';
  }

  if (student.latestSGPA !== undefined && student.latestSGPA !== null) latestSGPA = student.latestSGPA;
  if (student.backlogs !== undefined && student.backlogs !== null) totalBacklogs = student.backlogs;

  return { latestSGPA, totalBacklogs, lastMeet, photoUrl: booklet.personal?.photoUrl };
}

function renderAcademicOverview(students) {
  if (students.length === 0) {
    return '<p style="padding:20px;color:var(--text-muted);">No students assigned yet.</p>';
  }

  const rows = students.slice(0, 6).map(s => {
    const { latestSGPA, totalBacklogs, lastMeet, photoUrl } = getBookletSnapshot(s);
    const photoHtml = photoUrl
      ? `<img src="${photoUrl}" style="width:32px; height:32px; border-radius:50%; object-fit:cover;">`
      : `<div class="avatar avatar-sm">${(s.name || '?')[0]}</div>`;

    return `
      <tr style="cursor:pointer; border-bottom:1px solid var(--border);" class="student-row-link" data-student-id="${s.id}">
        <td style="padding:10px 12px;">
          <div style="display:flex;align-items:center;gap:12px;">
            ${photoHtml}
            <div>
              <p style="font-weight:600;font-size:0.875rem;margin:0;">${s.name || 'Student'}</p>
              <p style="color:var(--text-muted);font-size:0.75rem;margin:0;">${s.enrollmentNumber || 'No Roll No.'}</p>
            </div>
          </div>
        </td>
        <td style="padding:10px 12px; font-weight:500;">${latestSGPA}</td>
        <td style="padding:10px 12px; color:${Number(totalBacklogs) > 0 ? 'var(--danger)' : 'var(--text)'};">${totalBacklogs}</td>
        <td style="padding:10px 12px; color:var(--text-muted);">${lastMeet}</td>
        <td style="padding:10px 12px;">${getAttendanceStatus(s).key === 'NOT_RECORDED' ? 'Not recorded' : `${s.attendance || 0}%`} ${getAttendanceStatus(s).isLow ? '<span class="badge badge-danger">FR</span>' : ''}</td>
        <td style="padding:10px 12px;">${s.latestSubjectAverage === null || s.latestSubjectAverage === undefined ? '—' : `${s.latestSubjectAverage}%`}</td>
        <td style="padding:10px 12px;"><span class="badge ${s.learnerLevel === 'SLOW' ? 'badge-danger' : s.learnerLevel === 'MEDIUM' ? 'badge-warning' : s.learnerLevel === 'ADVANCED' ? 'badge-success' : 'badge-muted'}">${s.learnerLevel || 'Not assessed'}</span></td>
        <td style="padding:10px 12px;">${riskBadge(s.riskLevel)}</td>
        <td style="padding:10px 12px;">${getAttendanceStatus(s).isLow ? `<button type="button" class="btn btn-xs btn-primary request-attendance-meeting" data-student-id="${s.id}">Special meeting</button>` : '—'}</td>
      </tr>
    `;
  }).join('');

  return `
    <div class="table-responsive">
      <table class="data-table" style="width:100%; border-collapse:collapse; text-align:left;">
        <thead style="background:rgba(0,0,0,0.02); border-bottom:1px solid var(--border);">
          <tr>
            <th style="padding:12px;">Student Profile</th>
            <th style="padding:12px;">Current SGPA</th>
            <th style="padding:12px;">Total Backlogs</th>
            <th style="padding:12px;">Last Meet Date</th>
            <th style="padding:12px;">Attendance</th>
            <th style="padding:12px;">Latest Marks</th>
            <th style="padding:12px;">Learner Level</th>
            <th style="padding:12px;">Risk</th>
            <th style="padding:12px;">Follow-up</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
  `;
}

export async function render(container) {
  const user = getUserProfile();

  container.innerHTML = `
    <div class="dashboard-layout fade-in">
      ${createSidebar(user.role, '/mentor/dashboard')}
      <div class="main-content">
        ${createHeader('Mentor Dashboard', user)}
        <div class="page-content" id="mentor-dash">
          <div style="display:flex;justify-content:center;padding:60px;"><div class="spinner"></div></div>
        </div>
      </div>
    </div>
  `;

  try {
    const data = await StatsService.getMentorStats(user.id, true) || {};
    const students = data.students || [];
    const meetings = data.meetings || [];
    const totalStudents = data.totalStudents ?? students.length;
    const pendingRequests = data.pendingRequests ?? meetings.filter(m => m.status === 'REQUESTED').length;
    const highRisk = data.highRiskStudents ?? students.filter(s => s.riskLevel === 'HIGH').length;
    const completedMeetings = data.completedMeetings ?? meetings.filter(m => m.status === 'COMPLETED').length;
    const compliantBooklets = students.filter(s => BookletService.calculateCompletion(s.booklet) >= 25).length;
    const lowAttendanceStudents = data.lowAttendanceStudents || students.filter(s => getAttendanceStatus(s).isLow);
    const pendingMeetings = meetings.filter(m => m.status === 'REQUESTED');
    const cohort = data.cohortAnalysis || StatsService.summarizeStudents(students);
    const learnerTotal = cohort.learnerCounts.SLOW + cohort.learnerCounts.MEDIUM + cohort.learnerCounts.ADVANCED;
    const bandBar = (label, key, color) => {
      const count = cohort.learnerCounts[key] || 0;
      const width = learnerTotal ? Math.round(count / learnerTotal * 100) : 0;
      return `<div style="display:grid;grid-template-columns:92px 1fr 34px;align-items:center;gap:8px;margin:8px 0;"><span style="font-size:.78rem;color:var(--text-secondary);">${label}</span><div class="progress-bar-wrap"><div class="progress-bar-fill" style="width:${width}%;background:${color};"></div></div><strong style="font-size:.78rem;text-align:right;">${count}</strong></div>`;
    };
    const supportCandidates = students.map(student => {
      const attendanceStatus = getAttendanceStatus(student);
      const reasons = [];
      if (attendanceStatus.isLow) reasons.push('FR attendance');
      if (student.riskLevel === 'HIGH') reasons.push('High risk');
      if (student.learnerLevel === 'SLOW') reasons.push('Slow marks band');
      if (attendanceStatus.key === 'BELOW_TARGET') reasons.push('Below 75% attendance');
      return { student, reasons, priority: (attendanceStatus.isLow ? 8 : 0) + (student.riskLevel === 'HIGH' ? 4 : 0) + (student.learnerLevel === 'SLOW' ? 2 : 0) + (attendanceStatus.key === 'BELOW_TARGET' ? 1 : 0) };
    }).filter(item => item.reasons.length).sort((a, b) => b.priority - a.priority);
    const supportQueue = supportCandidates.slice(0, 5);
    const concludedMeetings = meetings.filter(meeting => ['COMPLETED', 'CANCELLED', 'REJECTED'].includes(String(meeting.status || '').toUpperCase()));
    const meetingCompletion = concludedMeetings.length ? Math.round(concludedMeetings.filter(meeting => meeting.status === 'COMPLETED').length / concludedMeetings.length * 100) : null;
    const dash = container.querySelector('#mentor-dash');
    if (!dash) return;

    dash.innerHTML = `
      <div class="dashboard-container">
        <!-- Quick Actions Bar -->
        <div style="display:flex; gap:12px; margin-bottom:20px; flex-wrap:wrap;">
          <a href="#/mentor/students" class="btn btn-sm btn-primary" style="display:flex; align-items:center; gap:6px; border-radius:20px; font-weight:600;">
            <i class="ph ph-users" style="font-size:1.1rem;"></i> My Students
          </a>
          <a href="#/chat" class="btn btn-sm btn-secondary" style="display:flex; align-items:center; gap:6px; border-radius:20px; font-weight:600;">
            <i class="ph ph-chat-circle-text" style="font-size:1.1rem; color:var(--accent);"></i> Messages
          </a>
          <a href="#/mentor/meetings" class="btn btn-sm btn-secondary" style="display:flex; align-items:center; gap:6px; border-radius:20px; font-weight:600;">
            <i class="ph ph-calendar-check" style="font-size:1.1rem; color:var(--info);"></i> Schedule / Meetings
          </a>
          <a href="#/mentor/reports" class="btn btn-sm btn-secondary" style="display:flex; align-items:center; gap:6px; border-radius:20px; font-weight:600;">
            <i class="ph ph-chart-bar" style="font-size:1.1rem; color:var(--success);"></i> Export Reports
          </a>
          ${String(user.role).toUpperCase() === 'CLASS_TEACHER' ? `<a href="#/mentor/attendance" class="btn btn-sm btn-secondary" style="display:flex;align-items:center;gap:6px;border-radius:20px;font-weight:600;"><i class="ph ph-calendar-check" style="font-size:1.1rem;color:var(--success);"></i> Class Attendance</a>` : ''}
        </div>

        <div class="stats-grid" style="grid-template-columns:repeat(auto-fit,minmax(150px,1fr));margin-bottom:24px;">
          ${renderStats(totalStudents, pendingRequests, highRisk, completedMeetings, compliantBooklets, lowAttendanceStudents.length)}
        </div>

        <div class="card" style="padding:20px;margin-bottom:20px;">
          <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:12px;flex-wrap:wrap;margin-bottom:14px;">
            <div><h3 style="margin:0;">Cohort analysis</h3><p style="margin:4px 0 0;color:var(--text-muted);font-size:.8rem;">Computed from assigned students’ latest published marks and recorded class attendance.</p></div>
            <a href="#/mentor/reports" class="btn btn-xs btn-secondary">Detailed report</a>
          </div>
          <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(175px,1fr));gap:10px;margin-bottom:16px;">
            <div style="padding:12px;border:1px solid var(--border);border-radius:10px;"><div style="font-size:.72rem;color:var(--text-muted);">Average attendance</div><strong style="font-size:1.2rem;">${cohort.averageAttendance === null ? '—' : `${cohort.averageAttendance}%`}</strong><div style="font-size:.72rem;color:var(--text-muted);">${cohort.attendanceRecorded}/${cohort.total} students have records</div></div>
            <div style="padding:12px;border:1px solid var(--border);border-radius:10px;"><div style="font-size:.72rem;color:var(--text-muted);">Average subject marks</div><strong style="font-size:1.2rem;">${cohort.averageSubjectMarks === null ? '—' : `${cohort.averageSubjectMarks}%`}</strong><div style="font-size:.72rem;color:var(--text-muted);">${cohort.marksAssessed}/${cohort.total} assessed</div></div>
            <div style="padding:12px;border:1px solid var(--border);border-radius:10px;"><div style="font-size:.72rem;color:var(--text-muted);">Attendance below 75%</div><strong style="font-size:1.2rem;color:${cohort.belowTargetAttendance ? 'var(--warning)' : 'var(--success)'};">${cohort.belowTargetAttendance}</strong><div style="font-size:.72rem;color:var(--text-muted);">FR threshold is 40% or below</div></div>
            <div style="padding:12px;border:1px solid var(--border);border-radius:10px;"><div style="font-size:.72rem;color:var(--text-muted);">Meeting completion</div><strong style="font-size:1.2rem;">${meetingCompletion === null ? '—' : `${meetingCompletion}%`}</strong><div style="font-size:.72rem;color:var(--text-muted);">${completedMeetings} completed · ${pendingRequests} awaiting response</div></div>
          </div>
          <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:18px;">
            <div><h4 style="font-size:.82rem;margin:0 0 8px;">Learner bands <span style="font-weight:400;color:var(--text-muted);">(${learnerTotal} assessed)</span></h4>${bandBar('Slow · <50%', 'SLOW', 'var(--danger)')}${bandBar('Medium · 50–74%', 'MEDIUM', 'var(--warning)')}${bandBar('Advanced · ≥75%', 'ADVANCED', 'var(--success)')}${cohort.learnerCounts.NOT_ASSESSED ? `<p style="margin:8px 0 0;color:var(--text-muted);font-size:.75rem;">${cohort.learnerCounts.NOT_ASSESSED} students have no published subject marks yet.</p>` : ''}</div>
            <div><h4 style="font-size:.82rem;margin:0 0 8px;">Needs follow-up <span class="badge badge-warning">${supportCandidates.length > 5 ? '5+' : supportCandidates.length}</span></h4>${supportQueue.length ? supportQueue.map(({ student, reasons }) => `<div style="display:flex;justify-content:space-between;gap:10px;align-items:center;padding:8px 0;border-bottom:1px solid var(--border);"><div><strong style="font-size:.8rem;">${escapeHtml(student.name || 'Student')}</strong><div style="font-size:.72rem;color:var(--text-muted);">${reasons.map(escapeHtml).join(' · ')}</div></div><a class="btn btn-xs btn-secondary" href="#/mentor/booklet?studentId=${encodeURIComponent(student.id)}">Review</a></div>`).join('') : '<p style="color:var(--text-muted);font-size:.8rem;">No students currently match the FR, high-risk, slow-band, or below-target attendance rules.</p>'}</div>
          </div>
        </div>

        <div style="display:grid;grid-template-columns:1fr 1fr;gap:20px;">
          <div class="card">
            <div class="card-header" style="padding:16px 20px; border-bottom:1px solid var(--border); display:flex; justify-content:space-between; align-items:center;">
              <h3 style="font-size:0.95rem; font-weight:700; margin:0;">Pending Meeting Requests</h3>
              <a href="#/mentor/meetings" style="font-size:0.8rem;color:var(--accent);font-weight:600;">View All</a>
            </div>
            <div id="pending-list">${renderPendingMeetings(pendingMeetings)}</div>
          </div>

          <div class="card" style="grid-column: span 2;">
            <div class="card-header" style="padding:16px 20px; border-bottom:1px solid var(--border); display:flex; justify-content:space-between; align-items:center;">
              <h3 style="font-size:0.95rem; font-weight:700; margin:0;"><i class="ph ph-books" style="margin-right:8px; vertical-align:middle; color:var(--accent);"></i> Academic Progress Overview</h3>
              <a href="#/mentor/students" style="font-size:0.8rem;color:var(--accent);font-weight:600;">View All Booklets</a>
            </div>
            ${renderAcademicOverview(students)}
          </div>
        </div>
      </div>
    `;

    dash.querySelectorAll('.approve-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        const scheduledAt = dash.querySelector(`.sched-input[data-id="${btn.dataset.id}"]`)?.value;
        if (!scheduledAt) {
          showToast('Select a date/time first', 'warning');
          return;
        }
        if (!confirm(`Are you sure you want to approve this meeting for ${btn.dataset.name}?`)) return;

        try {
          await MeetingService.update(btn.dataset.id, { status: 'APPROVED', scheduledAt });
          await NotificationService.create({
            userId: meetings.find(m => m.id === btn.dataset.id)?.studentId,
            type: 'MEETING_APPROVED',
            title: 'Meeting Approved!',
            message: `Your meeting on ${new Date(scheduledAt).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })} has been confirmed.`,
            relatedId: btn.dataset.id
          });
          showToast('Meeting approved!', 'success');
          btn.closest('.list-item')?.remove();
        } catch (err) {
          showToast(err.message, 'error');
        }
      });
    });

    dash.querySelectorAll('.reject-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        if (!confirm(`Are you sure you want to reject this meeting for ${btn.dataset.name}?`)) return;
        try {
          await MeetingService.update(btn.dataset.id, {
            status: 'REJECTED',
            rejectionReason: 'Unavailable at the requested time'
          });
          showToast('Meeting rejected', 'info');
          btn.closest('.list-item')?.remove();
        } catch (err) {
          showToast(err.message, 'error');
        }
      });
    });

    dash.querySelectorAll('.student-row-link').forEach(row => {
      row.addEventListener('click', () => {
        window.location.hash = `#/mentor/booklet?studentId=${row.dataset.studentId}`;
      });
    });

    dash.querySelectorAll('.request-attendance-meeting').forEach(button => {
      button.addEventListener('click', async event => {
        event.stopPropagation();
        button.disabled = true;
        try {
          const result = await AttendanceInterventionService.requestMeeting(button.dataset.studentId);
          button.textContent = result.created ? 'Requested' : 'Already requested';
          showToast(result.created ? 'Special FR attendance meeting requested.' : 'An open FR attendance meeting already exists.', result.created ? 'success' : 'info');
        } catch (error) {
          showToast(error.message || 'Could not request the attendance meeting.', 'error');
          button.disabled = false;
        }
      });
    });

    const tourSteps = [
      { selector: '.sidebar', title: 'Navigation', desc: 'Use this sidebar to view all your students, schedule meetings, and resolve issues.', position: 'right' },
      { selector: '.stats-grid', title: 'Actionable Insights', desc: 'Quickly see how many pending meetings and high-risk students require your attention.', position: 'bottom' },
      { selector: '.card', title: 'Your Mentees', desc: 'A quick list of your assigned mentees. Click on any row to open their Mentor Booklet.', position: 'top' }
    ];

    startTour('mentor_dashboard', tourSteps);

    const tourBtn = document.getElementById('start-tour-btn');
    if (tourBtn) {
      tourBtn.addEventListener('click', () => startTour('mentor_dashboard', tourSteps, true));
    }

  } catch (err) {
    console.error('Mentor dashboard load error:', err);
    const dash = container.querySelector('#mentor-dash');
    if (dash) {
      dash.innerHTML = `<div class="empty-state"><h3 style="color:var(--danger);">Error loading dashboard</h3><p>${err.message}</p></div>`;
    }
  }
}

