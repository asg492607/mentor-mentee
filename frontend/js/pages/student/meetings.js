import { getUserProfile } from '/js/auth.js';
import { navigateTo } from '/js/router.js';
import { createSidebar } from '/js/components/sidebar.js';
import { createHeader } from '/js/components/header.js';
import { showToast } from '/js/components/toast.js';
import { MeetingService, NotificationService, StudentService, AvailabilityService } from '/js/services.js';
import { exportMeetingSessionReport } from '/js/report-export.js';
import { renderCalendar } from '/js/components/calendar-view.js';

const TYPES = [
  '1-on-1 Mentorship Session',
  'Academic Issue & Doubt Clearing',
  'Career & Placement Guidance',
  'Internship & Higher Studies',
  'Project & Research Review',
  'Personal Concern & Wellbeing',
  'Hostel & Campus Facilities'
];

function statusBadge(s) {
  const cls = {REQUESTED:'badge-warning',APPROVED:'badge-success',ONGOING:'badge-info',REJECTED:'badge-danger',COMPLETED:'badge-muted',CANCELLED:'badge-muted'}[s] || 'badge-muted';
  return `<span class="badge ${cls}">${s}</span>`;
}

function fmt(iso) {
  if (!iso) return 'Not Scheduled Yet';
  const d = new Date(iso);
  if (isNaN(d.valueOf()) || d.getFullYear() < 2020) return 'Not Scheduled Yet';
  return d.toLocaleString('en-IN',{dateStyle:'medium',timeStyle:'short'});
}

export async function render(container) {
  const user = getUserProfile();

  let meetings = [];
  let activeViewMode = 'list';
  let bookingMode = 'slot'; // 'slot' or 'custom'
  let selectedSlotIso = null;

  container.innerHTML = `
    <div class="dashboard-layout fade-in">
      ${createSidebar(user.role, '/student/meetings')}
      <div class="main-content">
        ${createHeader('My Meetings & Calendar', user)}
        <div class="page-content">
          
          <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:16px; margin-bottom:20px;">
            <!-- View Mode Switcher -->
            <div class="view-mode-toggle" style="display:flex; background:var(--surface); border:1px solid var(--border); border-radius:12px; padding:3px; gap:4px;">
              <button class="btn btn-sm ${activeViewMode === 'list' ? 'btn-primary' : 'btn-ghost'}" id="btn-view-list" style="border-radius:9px; font-weight:600; display:flex; align-items:center; gap:6px;">
                <i class="ph ph-list-dashes"></i> List View
              </button>
              <button class="btn btn-sm ${activeViewMode === 'calendar' ? 'btn-primary' : 'btn-ghost'}" id="btn-view-calendar" style="border-radius:9px; font-weight:600; display:flex; align-items:center; gap:6px;">
                <i class="ph ph-calendar-blank"></i> Calendar View
              </button>
            </div>

            <!-- Request Meeting Action -->
            <button class="btn btn-primary" id="btn-new" style="display:flex; align-items:center; gap:8px; border-radius:12px; font-weight:700; padding:10px 20px; box-shadow:0 4px 12px rgba(99, 102, 241, 0.25);">
              <i class="ph ph-calendar-plus" style="font-size:1.2rem;"></i> Book / Request Meeting
            </button>
          </div>

          <!-- Smart Request / Calendly Slot Booking Drawer -->
          <div id="req-form" style="display:none; margin-bottom:24px; padding:24px; border-radius:16px; background:var(--surface,#fff); border:1px solid var(--border); box-shadow:0 4px 20px rgba(0,0,0,0.05);" class="inline-form">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:16px; border-bottom:1px solid var(--border); padding-bottom:12px;">
              <div>
                <h3 style="font-size:1.15rem; font-weight:800; margin:0; color:var(--text);">Schedule Mentorship Session</h3>
                <p style="font-size:0.8rem; color:var(--text-muted); margin:2px 0 0 0;">Book an available office hours slot or send a custom request</p>
              </div>
              <button class="btn btn-ghost btn-sm" id="btn-close-form" style="width:32px; height:32px; padding:0; border-radius:50%;">✕</button>
            </div>

            <!-- Booking Mode Selector -->
            <div style="display:flex; gap:10px; margin-bottom:18px;">
              <button type="button" class="btn btn-sm btn-primary" id="btn-mode-slot" style="flex:1; border-radius:8px; font-weight:600;">
                ⚡ Pick Open Mentor Slot (Instant)
              </button>
              <button type="button" class="btn btn-sm btn-secondary" id="btn-mode-custom" style="flex:1; border-radius:8px; font-weight:600;">
                📝 Custom Date &amp; Time
              </button>
            </div>

            <div class="form-group" style="margin-bottom:14px;">
              <label class="form-label" style="font-weight:600;">Meeting Topic / Scope</label>
              <select id="m-type" class="form-select" style="border-radius:10px;">${TYPES.map(t=>`<option>${t}</option>`).join('')}</select>
            </div>

            <div class="form-group" style="margin-bottom:14px;">
              <label class="form-label" style="font-weight:600;">Why / Agenda Description</label>
              <textarea id="m-desc" class="form-textarea" placeholder="Explain the context, problems or questions you wish to discuss with your mentor..." style="border-radius:10px; min-height:80px;"></textarea>
            </div>

            <!-- Calendly-Style Slot Picker Section -->
            <div id="slot-picker-section" style="margin-bottom:18px; padding:14px; background:rgba(99, 102, 241, 0.04); border-radius:12px; border:1px solid rgba(99, 102, 241, 0.15);">
              <label class="form-label" style="font-weight:700; color:var(--primary); margin-bottom:6px; display:block;">
                📅 Select Date to View Mentor's Open Slots:
              </label>
              <input type="date" id="slot-date-picker" class="form-input" style="border-radius:8px; margin-bottom:12px; background:#fff;">
              
              <div id="slots-container" style="display:flex; flex-wrap:wrap; gap:8px;">
                <div style="font-size:0.8rem; color:var(--text-muted);">Choose a date above to load available time slots.</div>
              </div>
            </div>

            <!-- Custom DateTime input (Hidden in slot mode) -->
            <div class="form-group" id="custom-date-section" style="display:none; margin-bottom:20px;">
              <label class="form-label" style="font-weight:600;">Preferred Date &amp; Time</label>
              <input type="datetime-local" id="m-date" class="form-input" style="border-radius:10px;">
            </div>

            <div style="display:flex; justify-content:flex-end; gap:10px;">
              <button class="btn btn-secondary" id="btn-cancel" style="border-radius:10px;">Cancel</button>
              <button class="btn btn-primary" id="btn-submit" style="border-radius:10px; font-weight:700;">Confirm Booking</button>
            </div>
          </div>

          <!-- Dynamic Wrap (List View or Calendar View) -->
          <div id="meetings-wrap">
            <div style="display:flex; justify-content:center; padding:40px;"><div class="spinner"></div></div>
          </div>
        </div>
      </div>
    </div>
  `;

  const toggle = () => {
    const f = container.querySelector('#req-form');
    f.style.display = f.style.display === 'none' ? 'block' : 'none';
    if (f.style.display === 'block') {
      // Set default tomorrow date
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const dateStr = tomorrow.toISOString().split('T')[0];
      const dateInput = container.querySelector('#slot-date-picker');
      if (dateInput) {
        dateInput.value = dateStr;
        loadMentorSlots(dateStr);
      }
    }
  };

  container.querySelector('#btn-new').addEventListener('click', toggle);
  container.querySelector('#btn-cancel').addEventListener('click', toggle);
  container.querySelector('#btn-close-form').addEventListener('click', toggle);

  // Booking mode toggles
  container.querySelector('#btn-mode-slot').addEventListener('click', () => {
    bookingMode = 'slot';
    container.querySelector('#btn-mode-slot').className = 'btn btn-sm btn-primary';
    container.querySelector('#btn-mode-custom').className = 'btn btn-sm btn-secondary';
    container.querySelector('#slot-picker-section').style.display = 'block';
    container.querySelector('#custom-date-section').style.display = 'none';
  });

  container.querySelector('#btn-mode-custom').addEventListener('click', () => {
    bookingMode = 'custom';
    container.querySelector('#btn-mode-slot').className = 'btn btn-sm btn-secondary';
    container.querySelector('#btn-mode-custom').className = 'btn btn-sm btn-primary';
    container.querySelector('#slot-picker-section').style.display = 'none';
    container.querySelector('#custom-date-section').style.display = 'block';
  });

  // Load Mentor Slots when date changes
  async function loadMentorSlots(dateStr) {
    const slotsDiv = container.querySelector('#slots-container');
    if (!slotsDiv) return;
    slotsDiv.innerHTML = '<div class="spinner" style="width:16px;height:16px;border-width:2px;"></div> Loading open slots...';

    try {
      const freshUser = await StudentService.get(user.id);
      const mentorId = freshUser?.mentorId || user.mentorId;
      if (!mentorId) {
        slotsDiv.innerHTML = '<div style="color:var(--danger);font-size:0.825rem;">No assigned mentor found.</div>';
        return;
      }

      const slots = await AvailabilityService.getAvailableSlots(mentorId, dateStr, meetings);
      if (!slots || slots.length === 0) {
        slotsDiv.innerHTML = '<div style="font-size:0.825rem; color:var(--text-muted);">No open office hours slots on this date. Try another day or switch to Custom Request.</div>';
        return;
      }

      slotsDiv.innerHTML = slots.map(s => {
        return `
          <button type="button" class="btn btn-sm slot-pill ${s.isAvailable ? 'btn-outline' : 'btn-disabled'}" data-iso="${s.iso}" ${s.isAvailable ? '' : 'disabled'}
                  style="border-radius:20px; font-weight:600; font-size:0.8rem; padding:6px 12px; margin-bottom:4px; ${s.isAvailable ? 'border-color:var(--primary); color:var(--primary); background:#fff;' : 'opacity:0.4;'}">
            🕐 ${s.label} (${s.duration}m)
          </button>
        `;
      }).join('');

      slotsDiv.querySelectorAll('.slot-pill').forEach(btn => {
        btn.addEventListener('click', () => {
          slotsDiv.querySelectorAll('.slot-pill').forEach(b => {
            b.style.background = '#fff';
            b.style.color = 'var(--primary)';
          });
          btn.style.background = 'var(--primary)';
          btn.style.color = '#fff';
          selectedSlotIso = btn.dataset.iso;
        });
      });

    } catch (e) {
      slotsDiv.innerHTML = `<div style="color:var(--danger);font-size:0.8rem;">Error loading slots: ${e.message}</div>`;
    }
  }

  container.querySelector('#slot-date-picker')?.addEventListener('change', (e) => {
    if (e.target.value) loadMentorSlots(e.target.value);
  });

  // Submit Handler
  container.querySelector('#btn-submit').addEventListener('click', async () => {
    const type = container.querySelector('#m-type').value;
    const description = container.querySelector('#m-desc').value.trim();
    let scheduledDate = null;
    let autoApprove = false;

    if (bookingMode === 'slot') {
      if (!selectedSlotIso) {
        showToast('Please select an available office hours time slot', 'warning');
        return;
      }
      scheduledDate = selectedSlotIso;
      autoApprove = true; // Instant approval for verified office hours slots!
    } else {
      scheduledDate = container.querySelector('#m-date')?.value || null;
      if (!scheduledDate) {
        showToast('Please select your preferred date & time for the session', 'warning');
        return;
      }
    }

    if (!description) { showToast('Please enter an agenda / description', 'warning'); return; }
    try {
      const btn = container.querySelector('#btn-submit');
      btn.disabled = true;
      btn.innerHTML = '<div class="spinner" style="width:16px;height:16px;border-width:2px;"></div>';

      const freshUser = await StudentService.get(user.id);
      if (freshUser) {
        Object.assign(user, freshUser);
        localStorage.setItem('lumina_profile', JSON.stringify(user));
      }

      if (!user.mentorId) {
        showToast('You have no mentor assigned yet', 'error');
        return;
      }

      const mId = await MeetingService.create({
        studentId: user.id,
        studentName: user.name,
        mentorId: user.mentorId,
        type,
        topic: type,
        description,
        preferredDate: scheduledDate,
        scheduledAt: scheduledDate,
        status: autoApprove ? 'APPROVED' : 'REQUESTED'
      });

      await NotificationService.create({
        userId: user.mentorId,
        type: autoApprove ? 'MEETING_APPROVED' : 'MEETING_REQUEST',
        title: autoApprove ? `Instant Slot Booked: ${type}` : `New Meeting Request: ${type}`,
        message: `${user.name} booked a session for ${fmt(scheduledDate)}. Agenda: ${description}`,
        relatedId: mId
      });

      showToast(autoApprove ? 'Slot booked and confirmed on calendar!' : 'Meeting request submitted!', 'success');
      container.querySelector('#req-form').style.display = 'none';
      container.querySelector('#m-desc').value = '';
      selectedSlotIso = null;
      await loadMeetings();
    } catch (err) {
      showToast('Error: ' + err.message, 'error');
    } finally {
      const btn = container.querySelector('#btn-submit');
      if (btn) { btn.disabled = false; btn.innerHTML = 'Confirm Booking'; }
    }
  });

  async function loadMeetings() {
    try {
      meetings = await MeetingService.getByStudent(user.id);
      renderView();
    } catch (err) {
      const wrap = container.querySelector('#meetings-wrap');
      if (wrap) {
        wrap.innerHTML = `<div class="empty-state"><h3 style="color:var(--danger);">Error loading meetings</h3><p>${err.message}</p></div>`;
      }
    }
  }

  function renderView() {
    const wrap = container.querySelector('#meetings-wrap');
    if (!wrap) return;

    if (activeViewMode === 'calendar') {
      renderCalendar(wrap, {
        meetings,
        currentUser: user,
        isMentor: false,
        onStatusChange: loadMeetings
      });
    } else {
      renderListView();
    }
  }

  function renderListView() {
    const wrap = container.querySelector('#meetings-wrap');
    if (!wrap) return;

    if (!meetings.length) {
      wrap.innerHTML = `
        <div class="empty-state card" style="padding:48px; border-radius:16px; text-align:center;">
          <div style="width:60px; height:60px; border-radius:50%; background:rgba(99,102,241,0.1); color:var(--primary); display:flex; align-items:center; justify-content:center; font-size:1.8rem; margin:0 auto 12px;">
            <i class="ph ph-calendar-x"></i>
          </div>
          <h3 style="font-size:1.15rem; font-weight:700; margin-bottom:4px;">No meetings scheduled yet</h3>
          <p style="font-size:0.85rem; color:var(--text-muted); margin:0 0 16px 0;">Pick an open slot or request a session with your mentor.</p>
          <button class="btn btn-primary" onclick="document.getElementById('btn-new').click()" style="border-radius:10px;">
            Book a Session
          </button>
        </div>
      `;
      return;
    }

    wrap.innerHTML = `<div style="display:flex; flex-direction:column; gap:14px;">
      ${meetings.map(m => {
        const isGroup = m.isGroup || m.studentId === 'ALL';
        const gcalUrl = MeetingService.generateGoogleCalendarUrl(m);
        const needsSignOff = (m.status === 'COMPLETED' && !m.studentAcknowledged && !isGroup);

        return `
          <div class="card" style="padding:20px; border-radius:14px; border:1px solid ${needsSignOff ? 'rgba(245, 158, 11, 0.4)' : 'var(--border)'}; background:${needsSignOff ? 'rgba(245, 158, 11, 0.02)' : 'var(--surface)'}; box-shadow:0 2px 10px rgba(0,0,0,0.03);" id="m-card-${m.id}">
            
            ${needsSignOff ? `
              <div style="display:flex; justify-content:space-between; align-items:center; background:rgba(245, 158, 11, 0.1); border:1px solid rgba(245, 158, 11, 0.3); border-radius:10px; padding:10px 14px; margin-bottom:14px;">
                <div style="font-size:0.82rem; font-weight:700; color:#b45309; display:flex; align-items:center; gap:6px;">
                  <i class="ph ph-warning-circle" style="font-size:1.1rem;"></i> Action Required: Review &amp; Acknowledge Mentor's Meeting Notes
                </div>
                <button class="btn btn-sm btn-primary btn-signoff" data-id="${m.id}" style="border-radius:8px; font-weight:700; padding:4px 12px; font-size:0.75rem; background:#d97706; border:none;">
                  ✍️ Sign-Off &amp; Rate
                </button>
              </div>
            ` : ''}

            <div style="display:flex; align-items:flex-start; justify-content:space-between; gap:16px; flex-wrap:wrap;">
              <div style="flex:1; min-width:260px;">
                <div style="display:flex; flex-wrap:wrap; gap:8px; align-items:center; margin-bottom:6px;">
                  <strong style="font-size:0.95rem; color:var(--text);">${escapeHtml(m.type || m.topic || 'Mentorship Session')}</strong>
                  ${isGroup ? '<span class="badge" style="background:#8b5cf6; color:#fff; font-size:0.7rem;">👥 Cohort Group Meet</span>' : ''}
                  ${statusBadge(m.status)}
                  ${m.studentAcknowledged ? '<span class="badge badge-success" style="font-size:0.7rem;"><i class="ph ph-seal-check"></i> Acknowledged by You</span>' : ''}
                  ${m.status === 'ONGOING' ? '<span style="font-size:0.72rem; color:var(--info); font-weight:700; animation:pulse 1.5s ease-in-out infinite;">● LIVE NOW</span>' : ''}
                </div>

                <div style="background:rgba(0,0,0,0.02); border-left:3px solid var(--primary); padding:6px 10px; border-radius:0 8px 8px 0; margin-bottom:8px;">
                  <p style="color:var(--text); font-size:0.85rem; margin:0; line-height:1.4;">
                    <strong>Why/Agenda:</strong> ${escapeHtml(m.description || 'Discussion with assigned mentor.')}
                  </p>
                </div>

                <div style="display:flex; flex-wrap:wrap; gap:14px; color:var(--text-muted); font-size:0.8rem;">
                  <span><i class="ph ph-clock"></i> ${m.scheduledAt ? 'Scheduled: ' + fmt(m.scheduledAt) : m.preferredDate ? 'Preferred: ' + fmt(m.preferredDate) : 'Time TBA'}</span>
                  <span><i class="ph ph-video-camera"></i> Lumina WebRTC Virtual Room</span>
                </div>
              </div>

              <div style="display:flex; flex-direction:column; gap:8px; flex-shrink:0;">
                ${(m.status === 'APPROVED' || m.status === 'ONGOING') ? `
                  <div style="display:flex; gap:6px;">
                    <button class="btn btn-sm btn-primary join-btn" data-id="${m.id}" style="border-radius:8px; font-weight:700;">
                      <i class="ph ph-video-camera"></i> ${m.status === 'ONGOING' ? 'Join Live Now' : 'Join Meeting'}
                    </button>
                    ${gcalUrl ? `<a href="${gcalUrl}" target="_blank" rel="noopener noreferrer" class="btn btn-sm btn-secondary" style="border-radius:8px;" title="Add to Google Calendar"><i class="ph ph-google-logo"></i></a>` : ''}
                    <button class="btn btn-sm btn-secondary btn-ics-export" data-id="${m.id}" style="border-radius:8px;" title="Download .ICS invite"><i class="ph ph-calendar-plus"></i></button>
                  </div>
                ` : ''}

                ${m.status === 'REQUESTED' ? `
                  <button class="btn btn-sm btn-secondary cancel-btn" data-id="${m.id}" style="border-radius:8px;">Cancel Request</button>
                ` : ''}

                ${m.status === 'COMPLETED' ? `
                  <div style="display:flex; gap:6px;">
                    ${m.notes ? `<button class="btn btn-sm btn-secondary view-notes-btn" data-id="${m.id}" style="border-radius:8px;">📝 View MOM Notes</button>` : ''}
                    <button class="btn btn-sm btn-outline report-btn" data-id="${m.id}" style="border-radius:8px;">📄 Download Report</button>
                  </div>
                ` : ''}
              </div>
            </div>

            <!-- Notes Panel for Completed Meeting -->
            ${m.status === 'COMPLETED' && m.notes ? `
              <div id="notes-panel-${m.id}" style="display:none; margin-top:16px; padding:16px; background:var(--bg-secondary); border:1px solid var(--border); border-radius:12px;">
                <h4 style="font-size:0.88rem; font-weight:700; margin-bottom:10px; color:var(--text);">📋 Minutes of Meeting (MOM) &amp; Guidance Provided</h4>
                <div style="display:grid; grid-template-columns:1fr 1fr; gap:10px;">
                  ${(m.notes.issuesDiscussed || m.notes.problem) ? `<div style="background:var(--card-bg,#fff); border:1px solid var(--border); border-radius:10px; padding:12px;"><p style="font-size:0.75rem; color:var(--text-muted); margin-bottom:4px; font-weight:700;">Section 1: Issues Discussed</p><p style="font-size:0.85rem; margin:0;">${escapeHtml(m.notes.issuesDiscussed || m.notes.problem)}</p></div>` : ''}
                  ${(m.notes.actionTaken || m.notes.advice) ? `<div style="background:var(--card-bg,#fff); border:1px solid var(--border); border-radius:10px; padding:12px;"><p style="font-size:0.75rem; color:var(--accent); margin-bottom:4px; font-weight:700;">Section 2: Action Taken / Guidance</p><p style="font-size:0.85rem; margin:0;">${escapeHtml(m.notes.actionTaken || m.notes.advice)}</p></div>` : ''}
                  ${m.notes.summary && m.notes.summary !== (m.notes.issuesDiscussed || m.notes.problem) ? `<div style="background:var(--card-bg,#fff); border:1px solid var(--border); border-radius:10px; padding:12px; grid-column:1/-1;"><p style="font-size:0.75rem; color:var(--text-muted); margin-bottom:4px; font-weight:700;">Summary</p><p style="font-size:0.85rem; margin:0;">${escapeHtml(m.notes.summary)}</p></div>` : ''}
                  ${m.notes.tasks?.length ? `<div style="background:var(--card-bg,#fff); border:1px solid var(--border); border-radius:10px; padding:12px; grid-column:1/-1;"><p style="font-size:0.75rem; color:var(--text-muted); margin-bottom:6px; font-weight:700;">Assigned Action Items (Synced to Tasks)</p>${m.notes.tasks.map(t => `<div style="display:flex; align-items:center; gap:8px; margin-bottom:4px;"><span style="color:var(--accent);">→</span><p style="font-size:0.85rem; margin:0;">${escapeHtml(typeof t === 'string' ? t : t.text)}</p></div>`).join('')}</div>` : ''}
                </div>
              </div>
            ` : ''}
          </div>
        `;
      }).join('')}
    </div>`;

    // Dual Sign-Off Handlers
    wrap.querySelectorAll('.btn-signoff').forEach(b => {
      b.addEventListener('click', () => {
        const m = meetings.find(x => x.id === b.dataset.id);
        if (m) openStudentSignOffModal(m);
      });
    });

    wrap.querySelectorAll('.view-notes-btn').forEach(b => {
      b.addEventListener('click', () => {
        const panel = document.getElementById(`notes-panel-${b.dataset.id}`);
        if (panel) {
          const isHidden = panel.style.display === 'none';
          panel.style.display = isHidden ? 'block' : 'none';
          b.textContent = isHidden ? 'Hide MOM Notes' : '📝 View MOM Notes';
        }
      });
    });

    wrap.querySelectorAll('.report-btn').forEach(b => {
      b.addEventListener('click', () => {
        const m = meetings.find(x => x.id === b.dataset.id);
        if (m) exportMeetingSessionReport(m);
      });
    });

    wrap.querySelectorAll('.join-btn').forEach(b => {
      b.addEventListener('click', () => navigateTo(`/meeting-room?id=${b.dataset.id}`));
    });

    wrap.querySelectorAll('.btn-ics-export').forEach(btn => {
      btn.addEventListener('click', () => {
        const m = meetings.find(x => x.id === btn.dataset.id);
        if (m) {
          MeetingService.downloadIcs(m);
          showToast('Calendar invite (.ics) downloaded!', 'success');
        }
      });
    });

    wrap.querySelectorAll('.cancel-btn').forEach(b => {
      b.addEventListener('click', async () => {
        if (!confirm('Are you sure you want to cancel this meeting request?')) return;
        try {
          await MeetingService.update(b.dataset.id, { status: 'CANCELLED' });
          showToast('Meeting cancelled', 'info');
          await loadMeetings();
        } catch (err) { showToast(err.message, 'error'); }
      });
    });
  }

  // View switchers
  container.querySelector('#btn-view-list').addEventListener('click', () => {
    activeViewMode = 'list';
    container.querySelector('#btn-view-list').className = 'btn btn-sm btn-primary';
    container.querySelector('#btn-view-calendar').className = 'btn btn-sm btn-ghost';
    renderView();
  });

  container.querySelector('#btn-view-calendar').addEventListener('click', () => {
    activeViewMode = 'calendar';
    container.querySelector('#btn-view-calendar').className = 'btn btn-sm btn-primary';
    container.querySelector('#btn-view-list').className = 'btn btn-sm btn-ghost';
    renderView();
  });

  await loadMeetings();

  // Dual Sign-Off Modal
  function openStudentSignOffModal(meeting) {
    document.querySelectorAll('#signoff-modal-root').forEach(e => e.remove());

    const modalRoot = document.createElement('div');
    modalRoot.id = 'signoff-modal-root';
    modalRoot.className = 'modal-backdrop';
    modalRoot.style.cssText = 'position:fixed; top:0; left:0; width:100vw; height:100vh; background:rgba(15,23,42,0.65); backdrop-filter:blur(4px); display:flex; align-items:center; justify-content:center; z-index:9999; padding:16px; animation:fadeIn 0.2s ease-out;';

    modalRoot.innerHTML = `
      <div class="modal-card card" style="width:100%; max-width:540px; border-radius:20px; padding:24px; background:var(--surface,#fff); border:1px solid var(--border); box-shadow:0 20px 40px rgba(0,0,0,0.2);">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:16px; border-bottom:1px solid var(--border); padding-bottom:12px;">
          <div>
            <h3 style="font-size:1.15rem; font-weight:800; margin:0; color:var(--text); display:flex; align-items:center; gap:8px;">
              <i class="ph ph-seal-check" style="color:#10b981;"></i> Student MOM Sign-Off
            </h3>
            <p style="font-size:0.78rem; color:var(--text-muted); margin:2px 0 0 0;">Review your mentor's guidance &amp; confirm official university record</p>
          </div>
          <button id="close-signoff-btn" class="btn btn-ghost" style="width:32px; height:32px; padding:0; border-radius:50%;">✕</button>
        </div>

        <div style="margin-bottom:16px; padding:12px; background:rgba(99, 102, 241, 0.04); border-left:3px solid var(--primary); border-radius:0 8px 8px 0; font-size:0.85rem;">
          <strong>Topic:</strong> ${escapeHtml(meeting.type || meeting.topic || 'Mentoring')}<br>
          <strong>Guidance Provided:</strong> ${escapeHtml(meeting.notes?.actionTaken || meeting.notes?.advice || 'General mentorship guidance given.')}
        </div>

        <div class="form-group" style="margin-bottom:14px;">
          <label class="form-label" style="font-weight:600;">Rate Session Usefulness (1 to 5 Stars)</label>
          <select id="signoff-rating" class="form-select" style="border-radius:8px;">
            <option value="5" selected>⭐⭐⭐⭐⭐ 5 - Highly Beneficial</option>
            <option value="4">⭐⭐⭐⭐ 4 - Very Helpful</option>
            <option value="3">⭐⭐⭐ 3 - Satisfactory</option>
            <option value="2">⭐⭐ 2 - Needs Follow-up</option>
            <option value="1">⭐ 1 - Not Helpful</option>
          </select>
        </div>

        <div class="form-group" style="margin-bottom:20px;">
          <label class="form-label" style="font-weight:600;">Student Reflections &amp; Undertaking (Optional)</label>
          <textarea id="signoff-feedback" class="form-textarea" placeholder="I have received the guidance and will work on the assigned action items..." style="border-radius:8px; min-height:75px;"></textarea>
        </div>

        <div style="display:flex; justify-content:flex-end; gap:10px;">
          <button class="btn btn-secondary" id="cancel-signoff-btn" style="border-radius:10px;">Cancel</button>
          <button class="btn btn-primary" id="confirm-signoff-btn" style="border-radius:10px; font-weight:700; background:#10b981; border:none;">
            ✍️ Digitally Acknowledge &amp; Sign
          </button>
        </div>
      </div>
    `;

    document.body.appendChild(modalRoot);

    modalRoot.querySelector('#close-signoff-btn').onclick = () => modalRoot.remove();
    modalRoot.querySelector('#cancel-signoff-btn').onclick = () => modalRoot.remove();

    modalRoot.querySelector('#confirm-signoff-btn').onclick = async () => {
      const rating = Number(modalRoot.querySelector('#signoff-rating').value) || 5;
      const feedback = modalRoot.querySelector('#signoff-feedback').value.trim();
      try {
        await MeetingService.acknowledgeMeeting(meeting.id, user.id, feedback, rating);
        showToast('Meeting record acknowledged and digitally signed!', 'success');
        modalRoot.remove();
        await loadMeetings();
      } catch (err) {
        showToast('Failed to sign off: ' + err.message, 'error');
      }
    };
  }
}
