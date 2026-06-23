import { getUserProfile } from '/js/auth.js';
import { createSidebar } from '/js/components/sidebar.js';
import { createHeader } from '/js/components/header.js';
import { showToast } from '/js/components/toast.js';
import { StatsService, MeetingService, NotificationService } from '/js/services.js';
import { startTour } from '/js/components/tour.js';

function riskBadge(r) {
  const cls = { HIGH: 'badge-danger', MEDIUM: 'badge-warning', LOW: 'badge-success' }[r] || 'badge-muted';
  return `<span class="badge ${cls}">${r || 'N/A'}</span>`;
}

function renderStats(totalStudents, pendingRequests, highRisk, completedMeetings) {
  return [
    { label: 'My Students', value: totalStudents, color: 'var(--info)', icon: 'ph-users' },
    { label: 'Pending Requests', value: pendingRequests, color: 'var(--warning)', icon: 'ph-calendar-plus' },
    { label: 'High Risk', value: highRisk, color: 'var(--danger)', icon: 'ph-warning-circle' },
    { label: 'Completed Meetings', value: completedMeetings, color: 'var(--success)', icon: 'ph-calendar-check' },
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
        <td style="padding:10px 12px;">${s.attendance || 0}%</td>
        <td style="padding:10px 12px;">${riskBadge(s.riskLevel)}</td>
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
            <th style="padding:12px;">Risk</th>
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
    const data = await StatsService.getMentorStats(user.id);
    const { totalStudents, pendingRequests, completedMeetings, students, meetings } = data;
    const highRisk = students.filter(s => s.riskLevel === 'HIGH').length;
    const pendingMeetings = meetings.filter(m => m.status === 'REQUESTED');
    const dash = container.querySelector('#mentor-dash');
    if (!dash) return;

    dash.innerHTML = `
      <div class="stats-grid" style="grid-template-columns:repeat(4,1fr);margin-bottom:24px;">
        ${renderStats(totalStudents, pendingRequests, highRisk, completedMeetings)}
      </div>

      <div style="display:grid;grid-template-columns:1fr 1fr;gap:20px;">
        <div class="card">
          <div class="card-header">
            <h3>Pending Meeting Requests</h3>
            <a href="#/mentor/meetings" style="font-size:0.8rem;color:var(--accent);">View All</a>
          </div>
          <div id="pending-list">${renderPendingMeetings(pendingMeetings)}</div>
        </div>

        <div class="card" style="grid-column: span 2;">
          <div class="card-header">
            <h3><i class="ph ph-books" style="margin-right:8px; vertical-align:middle;"></i> Academic Progress Overview</h3>
            <a href="#/mentor/students" style="font-size:0.8rem;color:var(--accent);">View All Booklets</a>
          </div>
          ${renderAcademicOverview(students)}
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
