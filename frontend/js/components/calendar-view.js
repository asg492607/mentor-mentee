import { MeetingService } from '/js/services.js';
import { showToast } from '/js/components/toast.js';
import { exportMeetingSessionReport } from '/js/report-export.js';

const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, char => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;'
}[char]));

function fmtDateTime(iso) {
  if (!iso) return 'Not Scheduled';
  const d = new Date(iso);
  if (isNaN(d.valueOf()) || d.getFullYear() < 2020) return 'Not Scheduled';
  return d.toLocaleString('en-IN', { 
    weekday: 'short', 
    day: 'numeric', 
    month: 'short', 
    year: 'numeric', 
    hour: '2-digit', 
    minute: '2-digit' 
  });
}

function fmtTimeOnly(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d.valueOf())) return '';
  return d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
}

function getStatusStyle(status) {
  switch (status) {
    case 'APPROVED':
      return { bg: 'rgba(16, 185, 129, 0.12)', border: '#10b981', text: '#059669', badge: 'badge-success', label: 'Approved' };
    case 'ONGOING':
      return { bg: 'rgba(6, 182, 212, 0.15)', border: '#06b6d4', text: '#0891b2', badge: 'badge-info', label: 'Live Now' };
    case 'REQUESTED':
      return { bg: 'rgba(245, 158, 11, 0.12)', border: '#f59e0b', text: '#d97706', badge: 'badge-warning', label: 'Requested' };
    case 'COMPLETED':
      return { bg: 'rgba(99, 102, 241, 0.12)', border: '#6366f1', text: '#4f46e5', badge: 'badge-primary', label: 'Completed' };
    case 'REJECTED':
      return { bg: 'rgba(239, 68, 68, 0.12)', border: '#ef4444', text: '#dc2626', badge: 'badge-danger', label: 'Rejected' };
    default:
      return { bg: 'rgba(148, 163, 184, 0.12)', border: '#94a3b8', text: '#64748b', badge: 'badge-muted', label: status || 'Scheduled' };
  }
}

/**
 * Renders an interactive calendar in the provided container
 */
export function renderCalendar(container, options = {}) {
  const {
    meetings = [],
    currentUser = {},
    isMentor = false,
    onStatusChange = null
  } = options;

  let currentYear = new Date().getFullYear();
  let currentMonth = new Date().getMonth(); // 0-indexed

  function buildCalendarView() {
    const firstDay = new Date(currentYear, currentMonth, 1).getDay();
    const totalDays = new Date(currentYear, currentMonth + 1, 0).getDate();
    const prevMonthDays = new Date(currentYear, currentMonth, 0).getDate();
    const today = new Date();

    const monthNames = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'
    ];

    // Filter and map meetings into dates map { "YYYY-MM-DD": [meeting, ...] }
    const dateMeetingMap = {};
    meetings.forEach(m => {
      const dateStr = m.scheduledAt || m.preferredDate;
      if (!dateStr) return;
      const d = new Date(dateStr);
      if (isNaN(d.valueOf())) return;
      
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      if (!dateMeetingMap[key]) dateMeetingMap[key] = [];
      dateMeetingMap[key].push(m);
    });

    container.innerHTML = `
      <div class="calendar-wrapper card" style="padding:24px; border-radius:16px; box-shadow:0 4px 20px rgba(0,0,0,0.05); background:var(--surface);">
        <!-- Calendar Header -->
        <div class="calendar-header" style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:16px; margin-bottom:24px; padding-bottom:16px; border-bottom:1px solid var(--border);">
          <div style="display:flex; align-items:center; gap:12px;">
            <div style="width:44px; height:44px; border-radius:12px; background:rgba(99, 102, 241, 0.1); color:var(--primary); display:flex; align-items:center; justify-content:center; font-size:1.4rem;">
              <i class="ph ph-calendar"></i>
            </div>
            <div>
              <h2 style="font-size:1.35rem; font-weight:700; margin:0; color:var(--text); letter-spacing:-0.01em;">
                ${monthNames[currentMonth]} <span style="color:var(--text-muted); font-weight:500;">${currentYear}</span>
              </h2>
              <p style="font-size:0.8rem; color:var(--text-muted); margin:2px 0 0 0;">
                ${meetings.length} Total Mentorship Sessions Tracked
              </p>
            </div>
          </div>

          <!-- Controls -->
          <div style="display:flex; align-items:center; gap:8px;">
            <button class="btn btn-secondary btn-sm" id="cal-btn-prev" title="Previous Month" style="width:36px; height:36px; padding:0; display:flex; align-items:center; justify-content:center; border-radius:10px;">
              <i class="ph ph-caret-left" style="font-size:1.1rem;"></i>
            </button>
            <button class="btn btn-secondary btn-sm" id="cal-btn-today" style="font-weight:600; font-size:0.82rem; padding:6px 14px; border-radius:10px;">
              Today
            </button>
            <button class="btn btn-secondary btn-sm" id="cal-btn-next" title="Next Month" style="width:36px; height:36px; padding:0; display:flex; align-items:center; justify-content:center; border-radius:10px;">
              <i class="ph ph-caret-right" style="font-size:1.1rem;"></i>
            </button>
          </div>
        </div>

        <!-- Status Legend -->
        <div class="calendar-legend" style="display:flex; flex-wrap:wrap; gap:14px; margin-bottom:18px; font-size:0.8rem; color:var(--text-secondary); background:rgba(0,0,0,0.02); padding:10px 16px; border-radius:10px;">
          <span style="display:flex; align-items:center; gap:6px;">
            <span style="width:10px; height:10px; border-radius:50%; background:#10b981;"></span> Approved / Confirmed
          </span>
          <span style="display:flex; align-items:center; gap:6px;">
            <span style="width:10px; height:10px; border-radius:50%; background:#f59e0b;"></span> Pending Request
          </span>
          <span style="display:flex; align-items:center; gap:6px;">
            <span style="width:10px; height:10px; border-radius:50%; background:#6366f1;"></span> Completed
          </span>
          <span style="display:flex; align-items:center; gap:6px;">
            <span style="width:10px; height:10px; border-radius:50%; background:#8b5cf6;"></span> 👥 Cohort / Group Meet
          </span>
        </div>

        <!-- Weekday Headers -->
        <div class="calendar-grid-header" style="display:grid; grid-template-columns:repeat(7, 1fr); gap:8px; text-align:center; margin-bottom:8px; font-size:0.82rem; font-weight:700; color:var(--text-muted); text-transform:uppercase; letter-spacing:0.05em;">
          <div>Sun</div>
          <div>Mon</div>
          <div>Tue</div>
          <div>Wed</div>
          <div>Thu</div>
          <div>Fri</div>
          <div>Sat</div>
        </div>

        <!-- Calendar Days Grid -->
        <div class="calendar-grid" id="calendar-days-grid" style="display:grid; grid-template-columns:repeat(7, 1fr); gap:8px;">
          ${renderDaysCells()}
        </div>
      </div>
    `;

    function renderDaysCells() {
      let cellsHtml = '';

      // Previous month filler days
      for (let i = firstDay - 1; i >= 0; i--) {
        const dayNum = prevMonthDays - i;
        cellsHtml += `
          <div class="calendar-day-cell prev-month" style="min-height:96px; padding:8px; border-radius:10px; background:rgba(0,0,0,0.015); border:1px dashed var(--border); opacity:0.45;">
            <div style="font-size:0.8rem; font-weight:600; color:var(--text-muted);">${dayNum}</div>
          </div>
        `;
      }

      // Current month days
      for (let day = 1; day <= totalDays; day++) {
        const key = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        const dayMeetings = dateMeetingMap[key] || [];
        const isToday = (today.getFullYear() === currentYear && today.getMonth() === currentMonth && today.getDate() === day);

        cellsHtml += `
          <div class="calendar-day-cell current-month ${isToday ? 'is-today' : ''}" data-date="${key}" 
               style="min-height:100px; padding:8px; border-radius:12px; background:var(--card-bg, #fff); border:1px solid ${isToday ? 'var(--primary)' : 'var(--border)'}; display:flex; flex-direction:column; gap:4px; transition:transform 0.15s ease, box-shadow 0.15s ease; cursor:pointer; ${isToday ? 'box-shadow:0 0 0 2px rgba(99,102,241,0.25); background:rgba(99,102,241,0.02);' : ''}">
            
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:2px;">
              <span style="font-size:0.82rem; font-weight:${isToday ? '800' : '600'}; color:${isToday ? 'var(--primary)' : 'var(--text)'}; width:24px; height:24px; display:flex; align-items:center; justify-content:center; border-radius:50%; ${isToday ? 'background:var(--primary); color:#fff;' : ''}">
                ${day}
              </span>
              ${dayMeetings.length > 0 ? `<span style="font-size:0.7rem; font-weight:700; color:var(--text-muted); background:var(--border); border-radius:10px; padding:1px 6px;">${dayMeetings.length}</span>` : ''}
            </div>

            <div class="calendar-events-list" style="display:flex; flex-direction:column; gap:4px; flex:1; overflow:hidden;">
              ${dayMeetings.slice(0, 3).map(m => {
                const style = getStatusStyle(m.status);
                const isGroup = m.isGroup || m.studentId === 'ALL';
                const timeStr = fmtTimeOnly(m.scheduledAt || m.preferredDate);
                const title = m.type || m.topic || 'Mentoring';
                return `
                  <div class="cal-event-pill" data-meeting-id="${m.id}" 
                       style="padding:3px 6px; border-radius:6px; background:${isGroup ? 'rgba(139, 92, 246, 0.15)' : style.bg}; border-left:3px solid ${isGroup ? '#8b5cf6' : style.border}; font-size:0.72rem; color:${isGroup ? '#6d28d9' : style.text}; font-weight:600; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; display:flex; align-items:center; gap:4px;"
                       title="${escapeHtml(title)} - ${timeStr} (${style.label})">
                    <span style="font-size:0.68rem; opacity:0.85;">${timeStr}</span>
                    <span style="overflow:hidden; text-overflow:ellipsis;">${isGroup ? '👥 ' : ''}${escapeHtml(title)}</span>
                  </div>
                `;
              }).join('')}
              ${dayMeetings.length > 3 ? `<div style="font-size:0.68rem; color:var(--primary); font-weight:600; padding-left:4px;">+${dayMeetings.length - 3} more</div>` : ''}
            </div>
          </div>
        `;
      }

      return cellsHtml;
    }

    // Attach Header Control Listeners
    container.querySelector('#cal-btn-prev').onclick = () => {
      if (currentMonth === 0) {
        currentMonth = 11;
        currentYear--;
      } else {
        currentMonth--;
      }
      buildCalendarView();
    };

    container.querySelector('#cal-btn-next').onclick = () => {
      if (currentMonth === 11) {
        currentMonth = 0;
        currentYear++;
      } else {
        currentMonth++;
      }
      buildCalendarView();
    };

    container.querySelector('#cal-btn-today').onclick = () => {
      currentMonth = new Date().getMonth();
      currentYear = new Date().getFullYear();
      buildCalendarView();
    };

    // Attach Event Click Listeners
    container.querySelectorAll('.cal-event-pill').forEach(el => {
      el.onclick = (e) => {
        e.stopPropagation();
        const targetPill = e.currentTarget || e.target.closest('.cal-event-pill');
        const mId = targetPill?.dataset?.meetingId;
        const meeting = meetings.find(m => m.id === mId);
        if (meeting) {
          openMeetingDetailsModal(meeting, isMentor, currentUser, onStatusChange);
        }
      };
    });

    container.querySelectorAll('.calendar-day-cell.current-month').forEach(el => {
      el.onclick = (e) => {
        const targetCell = e.currentTarget || e.target.closest('.calendar-day-cell');
        const dateKey = targetCell?.dataset?.date;
        const dayMeetings = dateMeetingMap[dateKey] || [];
        if (dayMeetings.length === 1) {
          openMeetingDetailsModal(dayMeetings[0], isMentor, currentUser, onStatusChange);
        } else if (dayMeetings.length > 1) {
          openDayMeetingsListModal(dateKey, dayMeetings, isMentor, currentUser, onStatusChange);
        }
      };
    });
  }

  buildCalendarView();
}

/**
 * Opens detailed modal showing What, Why, When, Links, and Actions for a meeting
 */
export function openMeetingDetailsModal(meeting, isMentor, currentUser, onStatusChange) {
  // Remove existing modal if any
  document.querySelectorAll('#meeting-detail-modal-root').forEach(e => e.remove());

  const style = getStatusStyle(meeting.status);
  const isGroup = meeting.isGroup || meeting.studentId === 'ALL';
  const origin = window.location.origin;
  const meetingRoomUrl = `${origin}/#/meeting-room?id=${meeting.id}`;
  const gcalUrl = MeetingService.generateGoogleCalendarUrl(meeting);
  const canJoin = ['APPROVED', 'ONGOING'].includes(meeting.status);

  const modalRoot = document.createElement('div');
  modalRoot.id = 'meeting-detail-modal-root';
  modalRoot.className = 'modal-backdrop';
  modalRoot.style.cssText = 'position:fixed; top:0; left:0; width:100vw; height:100vh; background:rgba(15,23,42,0.65); backdrop-filter:blur(4px); display:flex; align-items:center; justify-content:center; z-index:9999; padding:16px; animation:fadeIn 0.2s ease-out;';

  modalRoot.innerHTML = `
    <div class="modal-card card" style="width:100%; max-width:620px; max-height:90vh; overflow-y:auto; border-radius:20px; padding:0; box-shadow:0 25px 50px -12px rgba(0, 0, 0, 0.25); background:var(--surface, #fff); border:1px solid var(--border);">
      
      <!-- Top Banner -->
      <div style="padding:24px; background:linear-gradient(135deg, rgba(99, 102, 241, 0.08) 0%, rgba(168, 85, 247, 0.08) 100%); border-bottom:1px solid var(--border); display:flex; justify-content:space-between; align-items:flex-start;">
        <div>
          <div style="display:flex; align-items:center; gap:8px; margin-bottom:8px;">
            <span class="badge ${style.badge}" style="font-weight:700; text-transform:uppercase; font-size:0.75rem; letter-spacing:0.04em;">
              ${style.label}
            </span>
            ${isGroup ? '<span class="badge" style="background:#8b5cf6; color:#fff; font-weight:600;"><i class="ph ph-users-three"></i> Cohort Group Session</span>' : '<span class="badge badge-muted">1-on-1 Mentorship</span>'}
          </div>
          <h2 style="font-size:1.35rem; font-weight:800; color:var(--text); margin:0; line-height:1.3;">
            ${escapeHtml(meeting.type || meeting.topic || 'Mentoring Session')}
          </h2>
        </div>
        <button id="modal-close-btn" class="btn btn-ghost" style="width:36px; height:36px; padding:0; border-radius:50%; display:flex; align-items:center; justify-content:center; color:var(--text-muted);">
          <i class="ph ph-x" style="font-size:1.25rem;"></i>
        </button>
      </div>

      <!-- Content Details Body -->
      <div style="padding:24px; display:flex; flex-direction:column; gap:20px;">
        
        <!-- Why & Purpose Box -->
        <div style="background:rgba(99, 102, 241, 0.04); border-left:4px solid var(--primary); padding:14px 16px; border-radius:0 12px 12px 0;">
          <div style="font-size:0.78rem; font-weight:700; text-transform:uppercase; color:var(--primary); letter-spacing:0.05em; margin-bottom:4px; display:flex; align-items:center; gap:6px;">
            <i class="ph ph-info" style="font-size:1rem;"></i> Why this meeting is scheduled (Agenda / Purpose)
          </div>
          <p style="margin:0; font-size:0.9rem; color:var(--text); line-height:1.5;">
            ${escapeHtml(meeting.description || 'Routine mentorship progress check-in, academic support, and career milestone tracking.')}
          </p>
        </div>

        <!-- When & Where Grid -->
        <div style="display:grid; grid-template-columns:1fr 1fr; gap:16px;">
          <div style="padding:14px; border:1px solid var(--border); border-radius:12px; background:var(--card-bg, #fff);">
            <div style="font-size:0.75rem; font-weight:600; color:var(--text-muted); margin-bottom:4px; display:flex; align-items:center; gap:6px;">
              <i class="ph ph-clock" style="color:var(--primary);"></i> Scheduled Timing
            </div>
            <div style="font-size:0.95rem; font-weight:700; color:var(--text);">
              ${fmtDateTime(meeting.scheduledAt || meeting.preferredDate)}
            </div>
            <div style="font-size:0.75rem; color:var(--text-muted); margin-top:2px;">Duration: ~45 mins</div>
          </div>

          <div style="padding:14px; border:1px solid var(--border); border-radius:12px; background:var(--card-bg, #fff);">
            <div style="font-size:0.75rem; font-weight:600; color:var(--text-muted); margin-bottom:4px; display:flex; align-items:center; gap:6px;">
              <i class="ph ph-video-camera" style="color:var(--accent);"></i> Mode & Platform
            </div>
            <div style="font-size:0.95rem; font-weight:700; color:var(--text);">
              Lumina WebRTC Room
            </div>
            <div style="font-size:0.75rem; color:var(--text-muted); margin-top:2px;">HD Video, Audio & Screen Share</div>
          </div>
        </div>

        <!-- Participants -->
        <div style="padding:14px; border:1px solid var(--border); border-radius:12px; background:var(--card-bg, #fff);">
          <div style="font-size:0.75rem; font-weight:600; color:var(--text-muted); margin-bottom:10px; display:flex; align-items:center; gap:6px;">
            <i class="ph ph-users" style="color:var(--primary);"></i> Meeting Participants
          </div>
          <div style="display:flex; flex-direction:column; gap:10px;">
            <div style="display:flex; align-items:center; justify-content:space-between;">
              <div style="display:flex; align-items:center; gap:10px;">
                <div style="width:32px; height:32px; border-radius:50%; background:linear-gradient(135deg,#6366f1,#8b5cf6); color:#fff; display:flex; align-items:center; justify-content:center; font-weight:700; font-size:0.8rem;">
                  ${(meeting.mentorName || 'M')[0]}
                </div>
                <div>
                  <div style="font-size:0.88rem; font-weight:700; color:var(--text);">${escapeHtml(meeting.mentorName || 'Faculty Mentor')}</div>
                  <div style="font-size:0.75rem; color:var(--text-muted);">Session Host</div>
                </div>
              </div>
              <span class="badge badge-primary" style="font-size:0.7rem;">Mentor</span>
            </div>

            <div style="display:flex; align-items:center; justify-content:space-between;">
              <div style="display:flex; align-items:center; gap:10px;">
                <div style="width:32px; height:32px; border-radius:50%; background:linear-gradient(135deg,#06b6d4,#3b82f6); color:#fff; display:flex; align-items:center; justify-content:center; font-weight:700; font-size:0.8rem;">
                  ${isGroup ? '👥' : (meeting.studentName || 'S')[0]}
                </div>
                <div>
                  <div style="font-size:0.88rem; font-weight:700; color:var(--text);">
                    ${isGroup ? 'All Assigned Cohort Students' : escapeHtml(meeting.studentName || 'Mentee')}
                  </div>
                  <div style="font-size:0.75rem; color:var(--text-muted);">${isGroup ? 'Cohort Batch' : 'Assigned Mentee'}</div>
                </div>
              </div>
              <span class="badge badge-info" style="font-size:0.7rem;">${isGroup ? 'Batch' : 'Student'}</span>
            </div>
          </div>
        </div>

        <!-- Minutes of Meeting / Notes (If Completed) -->
        ${meeting.notes ? `
          <div style="padding:14px; border:1px solid rgba(99, 102, 241, 0.2); border-radius:12px; background:rgba(99, 102, 241, 0.03);">
            <div style="font-size:0.78rem; font-weight:700; color:var(--primary); margin-bottom:6px; display:flex; align-items:center; justify-content:space-between;">
              <span><i class="ph ph-file-text"></i> Minutes of Meeting (MOM)</span>
              <button class="btn btn-ghost btn-sm" id="btn-export-mom" style="padding:2px 8px; font-size:0.72rem; color:var(--primary);">
                <i class="ph ph-download-simple"></i> Download PDF
              </button>
            </div>
            <p style="margin:0; font-size:0.85rem; color:var(--text); line-height:1.5;">
              ${escapeHtml(typeof meeting.notes === 'string' ? meeting.notes : (meeting.notes.summary || meeting.notes.discussion || JSON.stringify(meeting.notes)))}
            </p>
          </div>
        ` : ''}

        <!-- Direct Action Bar & Sync Links -->
        <div style="display:flex; flex-direction:column; gap:12px; margin-top:8px;">
          
          <!-- Join Meeting Button -->
          ${canJoin ? `
            <a href="${meetingRoomUrl}" class="btn btn-primary" style="display:flex; align-items:center; justify-content:center; gap:8px; padding:12px; font-size:0.95rem; font-weight:700; border-radius:12px; text-decoration:none;">
              <i class="ph ph-video-camera" style="font-size:1.2rem;"></i> Join Video Meeting Room
            </a>
          ` : `
            <div style="font-size:0.8rem; text-align:center; color:var(--text-muted); padding:6px;">
              ${meeting.status === 'REQUESTED' ? '⚠️ Meeting is pending mentor approval before video room unlocks.' : 'Session is completed or inactive.'}
            </div>
          `}

          <!-- Calendar Sync Options -->
          <div style="display:grid; grid-template-columns:1fr 1fr; gap:10px;">
            ${gcalUrl ? `
              <a href="${gcalUrl}" target="_blank" rel="noopener noreferrer" class="btn btn-secondary" style="display:flex; align-items:center; justify-content:center; gap:6px; font-size:0.82rem; font-weight:600; border-radius:10px; text-decoration:none;">
                <i class="ph ph-google-logo" style="color:#ea4335;"></i> Add to Google Cal
              </a>
            ` : ''}
            <button class="btn btn-secondary" id="btn-export-ics" style="display:flex; align-items:center; justify-content:center; gap:6px; font-size:0.82rem; font-weight:600; border-radius:10px;">
              <i class="ph ph-calendar-plus" style="color:var(--primary);"></i> Download .ICS File
            </button>
          </div>

          <!-- Mentor Approval Controls if Requested -->
          ${(isMentor && meeting.status === 'REQUESTED') ? `
            <div style="border-top:1px solid var(--border); padding-top:16px; margin-top:4px; display:flex; gap:10px;">
              <button class="btn btn-primary" id="btn-quick-approve" style="flex:1; border-radius:10px;">
                <i class="ph ph-check-circle"></i> Approve Session
              </button>
              <button class="btn btn-danger" id="btn-quick-reject" style="flex:1; border-radius:10px;">
                <i class="ph ph-x-circle"></i> Reject
              </button>
            </div>
          ` : ''}
        </div>

      </div>
    </div>
  `;

  document.body.appendChild(modalRoot);

  // Close handlers
  const closeModal = () => modalRoot.remove();
  modalRoot.querySelector('#modal-close-btn').onclick = closeModal;
  modalRoot.onclick = (e) => {
    if (e.target === modalRoot) closeModal();
  };

  // ICS download
  const icsBtn = modalRoot.querySelector('#btn-export-ics');
  if (icsBtn) {
    icsBtn.onclick = () => {
      MeetingService.downloadIcs(meeting);
      showToast('Meeting invite (.ics) downloaded!', 'success');
    };
  }

  // MOM PDF export
  const momBtn = modalRoot.querySelector('#btn-export-mom');
  if (momBtn) {
    momBtn.onclick = () => {
      exportMeetingSessionReport(meeting);
    };
  }

  // Mentor Quick Approve / Reject
  const approveBtn = modalRoot.querySelector('#btn-quick-approve');
  if (approveBtn) {
    approveBtn.onclick = async () => {
      try {
        const sched = meeting.scheduledAt || meeting.preferredDate || new Date().toISOString();
        await MeetingService.update(meeting.id, { status: 'APPROVED', scheduledAt: sched });
        showToast('Meeting approved successfully!', 'success');
        closeModal();
        if (typeof onStatusChange === 'function') onStatusChange();
      } catch (err) {
        showToast('Error approving meeting: ' + err.message, 'error');
      }
    };
  }

  const rejectBtn = modalRoot.querySelector('#btn-quick-reject');
  if (rejectBtn) {
    rejectBtn.onclick = async () => {
      const reason = prompt('Reason for rejection (optional):');
      if (reason === null) return;
      try {
        await MeetingService.update(meeting.id, { status: 'REJECTED', rejectionReason: reason || 'Unavailable' });
        showToast('Meeting request rejected.', 'warning');
        closeModal();
        if (typeof onStatusChange === 'function') onStatusChange();
      } catch (err) {
        showToast('Error: ' + err.message, 'error');
      }
    };
  }
}

/**
 * Opens multi-meeting selection modal when clicking on a date cell with multiple meetings
 */
function openDayMeetingsListModal(dateKey, dayMeetings, isMentor, currentUser, onStatusChange) {
  document.querySelectorAll('#day-meetings-list-modal-root').forEach(e => e.remove());

  const modalRoot = document.createElement('div');
  modalRoot.id = 'day-meetings-list-modal-root';
  modalRoot.className = 'modal-backdrop';
  modalRoot.style.cssText = 'position:fixed; top:0; left:0; width:100vw; height:100vh; background:rgba(15,23,42,0.65); backdrop-filter:blur(4px); display:flex; align-items:center; justify-content:center; z-index:9998; padding:16px; animation:fadeIn 0.2s ease-out;';

  modalRoot.innerHTML = `
    <div class="modal-card card" style="width:100%; max-width:520px; border-radius:20px; padding:24px; background:var(--surface, #fff); border:1px solid var(--border);">
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:16px; border-bottom:1px solid var(--border); padding-bottom:12px;">
        <div>
          <h3 style="font-size:1.15rem; font-weight:700; margin:0; color:var(--text);">Sessions for ${dateKey}</h3>
          <p style="font-size:0.8rem; color:var(--text-muted); margin:2px 0 0 0;">${dayMeetings.length} meetings scheduled</p>
        </div>
        <button id="day-modal-close-btn" class="btn btn-ghost" style="width:32px; height:32px; padding:0; border-radius:50%; display:flex; align-items:center; justify-content:center;">
          <i class="ph ph-x" style="font-size:1.1rem;"></i>
        </button>
      </div>

      <div style="display:flex; flex-direction:column; gap:10px; max-height:60vh; overflow-y:auto;">
        ${dayMeetings.map(m => {
          const style = getStatusStyle(m.status);
          const isGroup = m.isGroup || m.studentId === 'ALL';
          const timeStr = fmtTimeOnly(m.scheduledAt || m.preferredDate);
          return `
            <div class="card card-hover" data-id="${m.id}" style="padding:14px; border-radius:12px; cursor:pointer; display:flex; justify-content:space-between; align-items:center; border:1px solid var(--border); background:var(--card-bg, #fff);">
              <div>
                <div style="display:flex; align-items:center; gap:6px; margin-bottom:4px;">
                  <span class="badge ${style.badge}" style="font-size:0.7rem;">${style.label}</span>
                  ${isGroup ? '<span class="badge" style="background:#8b5cf6; color:#fff; font-size:0.7rem;">👥 Cohort</span>' : ''}
                </div>
                <strong style="font-size:0.9rem; color:var(--text);">${escapeHtml(m.type || m.topic || 'Mentorship Session')}</strong>
                <div style="font-size:0.78rem; color:var(--text-muted); margin-top:2px;">
                  ${isGroup ? 'Cohort Batch' : escapeHtml(m.studentName || 'Student')} • ${timeStr || 'Time TBA'}
                </div>
              </div>
              <i class="ph ph-arrow-right" style="color:var(--text-muted); font-size:1.1rem;"></i>
            </div>
          `;
        }).join('')}
      </div>
    </div>
  `;

  document.body.appendChild(modalRoot);

  modalRoot.querySelector('#day-modal-close-btn').onclick = () => modalRoot.remove();
  modalRoot.onclick = (e) => {
    if (e.target === modalRoot) modalRoot.remove();
  };

  modalRoot.querySelectorAll('.card-hover').forEach(card => {
    card.onclick = () => {
      const mId = card.dataset.id;
      const meeting = dayMeetings.find(m => m.id === mId);
      modalRoot.remove();
      if (meeting) {
        openMeetingDetailsModal(meeting, isMentor, currentUser, onStatusChange);
      }
    };
  });
}
