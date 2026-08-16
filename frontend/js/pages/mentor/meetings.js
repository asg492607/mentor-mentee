import { getUserProfile } from '/js/auth.js';
import { navigateTo } from '/js/router.js';
import { createSidebar } from '/js/components/sidebar.js';
import { createHeader } from '/js/components/header.js';
import { showToast } from '/js/components/toast.js';
import { MeetingService, NotificationService, TaskService, IssueService, StudentService, AvailabilityService } from '/js/services.js';
import { exportMeetingSessionReport } from '/js/report-export.js';
import { renderCalendar } from '/js/components/calendar-view.js';

function statusBadge(s) {
  const cls = {REQUESTED:'badge-warning',APPROVED:'badge-success',ONGOING:'badge-info',REJECTED:'badge-danger',COMPLETED:'badge-muted',CANCELLED:'badge-muted'}[s]||'badge-muted';
  return `<span class="badge ${cls}">${s}</span>`;
}

function fmt(iso) {
  if (!iso) return 'Not Scheduled Yet';
  const d = new Date(iso);
  if (isNaN(d.valueOf()) || d.getFullYear() < 2020) return 'Not Scheduled Yet';
  return d.toLocaleString('en-IN',{dateStyle:'medium',timeStyle:'short'});
}

const MEETING_TYPES = [
  '1-on-1 Mentorship Session',
  'Batch / Group Mentoring',
  'Academic Progress & Doubt Clearing',
  'Remedial / Attendance Intervention',
  'Career & Internship Guidance',
  'Personal Wellbeing / Counseling',
  'Project & Research Review'
];

export async function render(container) {
  const user = getUserProfile();

  container.innerHTML = `
    <div class="dashboard-layout fade-in">
      ${createSidebar(user.role, '/mentor/meetings')}
      <div class="main-content">
        ${createHeader('Meetings & Schedules', user)}
        <div class="page-content">
          
          <!-- Top Bar with Actions & View Mode Switcher -->
          <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:16px; margin-bottom:20px;">
            <!-- View Mode Switcher -->
            <div class="view-mode-toggle" style="display:flex; background:var(--surface); border:1px solid var(--border); border-radius:12px; padding:3px; gap:4px;">
              <button class="btn btn-sm btn-view-mode ${activeViewMode === 'list' ? 'btn-primary' : 'btn-ghost'}" id="btn-view-list" style="border-radius:9px; font-weight:600; display:flex; align-items:center; gap:6px;">
                <i class="ph ph-list-dashes"></i> List View
              </button>
              <button class="btn btn-sm btn-view-mode ${activeViewMode === 'calendar' ? 'btn-primary' : 'btn-ghost'}" id="btn-view-calendar" style="border-radius:9px; font-weight:600; display:flex; align-items:center; gap:6px;">
                <i class="ph ph-calendar-blank"></i> Calendar View
              </button>
            </div>

            <!-- Action Buttons -->
            <div style="display:flex; align-items:center; gap:10px;">
              <button class="btn btn-secondary" id="btn-manage-availability" style="display:flex; align-items:center; gap:6px; border-radius:12px; font-weight:600;">
                <i class="ph ph-clock-user" style="color:var(--primary); font-size:1.1rem;"></i> Office Hours &amp; Slots
              </button>
              <button class="btn btn-primary" id="btn-schedule-meeting" style="display:flex; align-items:center; gap:8px; border-radius:12px; font-weight:700; padding:10px 20px; box-shadow:0 4px 12px rgba(99, 102, 241, 0.25);">
                <i class="ph ph-calendar-plus" style="font-size:1.2rem;"></i> Schedule New Session
              </button>
            </div>
          </div>

          <!-- List Tabs (Visible only in List View) -->
          <div id="list-tab-bar" style="display:flex; gap:0; border-bottom:1px solid var(--border); margin-bottom:20px;">
            ${['Pending','Approved','Completed','All'].map((t,i) =>
              `<button class="tab-btn ${i===0?'tab-active':''}" data-tab="${t.toLowerCase()}"
                style="padding:10px 20px; background:none; border:none; border-bottom:2px solid ${i===0?'var(--accent)':'transparent'};
                color:${i===0?'var(--accent)':'var(--text-secondary)'}; font-weight:600; cursor:pointer; font-size:0.875rem; transition:all 0.2s;">
                ${t}
              </button>`
            ).join('')}
          </div>

          <!-- Dynamic Panel (List or Calendar) -->
          <div id="meetings-panel">
            <div style="display:flex; justify-content:center; padding:60px;"><div class="spinner"></div></div>
          </div>

        </div>
      </div>
    </div>
  `;

  let meetings = [];
  let students = [];
  let activeTab = 'pending';
  let activeViewMode = 'list';

  async function loadData() {
    try {
      const [mList, sList] = await Promise.all([
        MeetingService.getByMentor(user.id),
        StudentService.getByMentor(user.id)
      ]);
      meetings = mList;
      students = sList;
    } catch (err) {
      showToast('Error loading meetings: ' + err.message, 'error');
    }
  }

  await loadData();

  function renderCurrentView() {
    const listTabBar = container.querySelector('#list-tab-bar');
    const panel = container.querySelector('#meetings-panel');
    if (!panel) return;

    if (activeViewMode === 'calendar') {
      if (listTabBar) listTabBar.style.display = 'none';
      renderCalendar(panel, {
        meetings,
        currentUser: user,
        isMentor: true,
        onStatusChange: async () => {
          await loadData();
          renderCurrentView();
        }
      });
    } else {
      if (listTabBar) listTabBar.style.display = 'flex';
      renderListView();
    }
  }

  function renderListView() {
    const panel = container.querySelector('#meetings-panel');
    if (!panel) return;

    let list = meetings;
    if (activeTab === 'pending')   list = meetings.filter(m => m.status === 'REQUESTED');
    if (activeTab === 'approved')  list = meetings.filter(m => m.status === 'APPROVED' || m.status === 'ONGOING');
    if (activeTab === 'completed') list = meetings.filter(m => m.status === 'COMPLETED');

    if (!list.length) {
      panel.innerHTML = `<div class="empty-state card" style="padding:48px; border-radius:16px; text-align:center;">
        <div style="width:60px; height:60px; border-radius:50%; background:rgba(99,102,241,0.1); color:var(--primary); display:flex; align-items:center; justify-content:center; font-size:1.8rem; margin:0 auto 12px;">
          <i class="ph ph-calendar-x"></i>
        </div>
        <h3 style="font-size:1.1rem; font-weight:700; color:var(--text); margin-bottom:4px;">No meetings in this category</h3>
        <p style="font-size:0.85rem; color:var(--text-muted); margin:0;">Schedule a session or toggle tabs to check other categories.</p>
      </div>`;
      return;
    }

    panel.innerHTML = `<div style="display:flex; flex-direction:column; gap:14px;">
      ${list.map(m => {
        const isGroup = m.isGroup || m.studentId === 'ALL';
        const gcalUrl = MeetingService.generateGoogleCalendarUrl(m);

        return `
          <div class="card" style="padding:20px; border-radius:14px; border:1px solid var(--border); box-shadow:0 2px 10px rgba(0,0,0,0.03);" id="card-${m.id}">
            <div style="display:flex; gap:16px; align-items:flex-start; flex-wrap:wrap;">
              <div class="avatar avatar-md" style="background:${isGroup ? 'linear-gradient(135deg,#8b5cf6,#6366f1)' : 'linear-gradient(135deg,#06b6d4,#3b82f6)'}; color:#fff; font-weight:700;">
                ${isGroup ? '👥' : (m.studentName || '?')[0].toUpperCase()}
              </div>

              <div style="flex:1; min-width:260px;">
                <div style="display:flex; flex-wrap:wrap; gap:8px; align-items:center; margin-bottom:6px;">
                  <strong style="font-size:0.95rem; color:var(--text);">${isGroup ? 'All Assigned Cohort Students' : (m.studentName || '—')}</strong>
                  <span class="badge ${isGroup ? 'badge-primary' : 'badge-accent'}" style="font-weight:600;">
                    ${isGroup ? '👥 Cohort Session' : (m.type || m.topic || 'Mentorship Session')}
                  </span>
                  ${statusBadge(m.status)}
                  ${m.studentAcknowledged ? '<span class="badge badge-success" style="font-size:0.7rem;"><i class="ph ph-seal-check"></i> Student Signed-Off</span>' : (m.status === 'COMPLETED' ? '<span class="badge badge-warning" style="font-size:0.7rem;">⏳ Awaiting Student Sign-Off</span>' : '')}
                </div>
                
                <div style="background:rgba(0,0,0,0.02); border-left:3px solid var(--primary); padding:6px 10px; border-radius:0 8px 8px 0; margin-bottom:8px;">
                  <p style="color:var(--text); font-size:0.85rem; margin:0; line-height:1.4;">
                    <strong>Why/Agenda:</strong> ${m.description || 'General progress check-in'}
                  </p>
                </div>

                <div style="display:flex; flex-wrap:wrap; gap:14px; color:var(--text-muted); font-size:0.8rem;">
                  <span><i class="ph ph-clock"></i> ${m.scheduledAt ? 'Scheduled: ' + fmt(m.scheduledAt) : m.preferredDate ? 'Requested Date: ' + fmt(m.preferredDate) : 'No date set'}</span>
                  <span><i class="ph ph-video-camera"></i> Lumina WebRTC Room</span>
                </div>
              </div>

              <div style="display:flex; flex-direction:column; gap:8px; flex-shrink:0;">
                ${m.status === 'REQUESTED' ? `
                  <input type="datetime-local" class="form-input sched-i" data-id="${m.id}" value="${m.preferredDate || ''}" style="width:210px; padding:7px 10px; font-size:0.8rem; border-radius:8px;">
                  <div style="display:flex; gap:8px;">
                    <button class="btn btn-sm btn-success appr-btn" data-id="${m.id}" data-sid="${m.studentId}" style="border-radius:8px; font-weight:600;">✓ Approve</button>
                    <button class="btn btn-sm btn-danger rej-btn" data-id="${m.id}" data-sid="${m.studentId}" style="border-radius:8px; font-weight:600;">✗ Reject</button>
                  </div>
                ` : (m.status === 'APPROVED' || m.status === 'ONGOING') ? `
                  <div style="display:flex; gap:6px;">
                    <button class="btn btn-sm btn-primary join-btn" data-id="${m.id}" style="border-radius:8px; font-weight:700;">
                      <i class="ph ph-video-camera"></i> ${m.status === 'ONGOING' ? '● Join Live' : 'Join Room'}
                    </button>
                    ${gcalUrl ? `<a href="${gcalUrl}" target="_blank" rel="noopener noreferrer" class="btn btn-sm btn-secondary" style="border-radius:8px;" title="Add to Google Calendar"><i class="ph ph-google-logo"></i></a>` : ''}
                    <button class="btn btn-sm btn-secondary btn-ics-export" data-id="${m.id}" style="border-radius:8px;" title="Download .ICS invite"><i class="ph ph-calendar-plus"></i></button>
                  </div>
                  <div style="display:flex; gap:6px;">
                    <button class="btn btn-sm btn-secondary note-btn" data-id="${m.id}" style="border-radius:8px;">📝 Notes &amp; MOM</button>
                    <button class="btn btn-sm btn-outline report-btn" data-id="${m.id}" style="border-radius:8px;">📄 PDF Report</button>
                  </div>
                ` : m.status === 'COMPLETED' ? `
                  <div style="display:flex; gap:6px;">
                    <button class="btn btn-sm btn-secondary note-btn" data-id="${m.id}" style="border-radius:8px;">📝 Edit MOM &amp; Observations</button>
                    <button class="btn btn-sm btn-primary report-btn" data-id="${m.id}" style="border-radius:8px;">📄 Download Report</button>
                  </div>
                ` : ''}
              </div>
            </div>

            <!-- Structured Report & Notes Form -->
            <div id="notes-${m.id}" style="display:none; margin-top:16px; padding:16px; background:var(--bg-secondary); border:1px solid var(--border); border-radius:12px;" class="inline-form">
              <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px; flex-wrap:wrap; gap:8px;">
                <h4 style="margin:0; font-size:0.95rem; font-weight:700; display:flex; align-items:center; gap:6px;">
                  📋 Mentorship Meeting Notes, MOM &amp; Action Report
                </h4>
                <button class="btn btn-sm btn-outline report-btn" data-id="${m.id}" type="button" style="padding:4px 10px; font-size:0.78rem; border-radius:8px;">
                  🖨️ Export PDF Report
                </button>
              </div>
              
              <div style="display:grid; grid-template-columns:1fr; gap:12px;">
                <div class="form-group">
                  <label class="form-label" style="font-weight:600; display:flex; align-items:center; gap:5px;">
                    <span style="color:var(--danger,#ef4444);">⚠️</span> Section 1: Student Issues &amp; Concerns Discussed
                  </label>
                  <textarea class="form-textarea np" style="min-height:75px; border-radius:8px;" placeholder="Record direct student issues, academic/personal/hostel/classroom concerns discussed in this meeting...">${m.notes?.issuesDiscussed || m.notes?.studentIssues || m.notes?.problem || ''}</textarea>
                </div>

                <div class="form-group">
                  <label class="form-label" style="font-weight:600; display:flex; align-items:center; gap:5px;">
                    <span style="color:var(--success,#22c55e);">✅</span> Section 2: Action Taken &amp; Remedial Measures
                  </label>
                  <textarea class="form-textarea na" style="min-height:75px; border-radius:8px;" placeholder="Record action taken, remedial measures suggested, mentor advice &amp; solutions provided...">${m.notes?.actionTaken || m.notes?.remedialMeasures || m.notes?.advice || ''}</textarea>
                </div>

                <!-- Section 3: Confidential Faculty Observations -->
                <div class="form-group" style="background:rgba(239, 68, 68, 0.04); border:1px dashed rgba(239, 68, 68, 0.25); padding:10px; border-radius:8px;">
                  <label class="form-label" style="font-weight:700; color:#dc2626; display:flex; align-items:center; gap:6px;">
                    <i class="ph ph-lock-key"></i> Section 3: Confidential Faculty-Only Observations (Visible only to Mentor, HOD, Dean)
                  </label>
                  <textarea class="form-textarea npo" style="min-height:60px; border-radius:8px; background:#fff;" placeholder="Private observations (e.g., student shows signs of stress, potential attendance risk, counseling recommendation)...">${m.notes?.privateObservations || ''}</textarea>
                </div>

                <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px;">
                  <div class="form-group">
                    <label class="form-label" style="font-weight:600;">🎯 Action Items / Tasks (Auto-synced to Student Roster)</label>
                    <textarea class="form-textarea nt" style="min-height:65px; border-radius:8px;" placeholder="Submit revised assignment by Friday&#10;Meet subject faculty for doubt clearance">${(m.notes?.tasks||[]).join('\n')}</textarea>
                    <small style="color:var(--text-muted); font-size:0.75rem;">One task per line — automatically assigns to student tasks</small>
                  </div>
                  <div class="form-group">
                    <label class="form-label" style="font-weight:600;">📝 Additional Remarks (Optional)</label>
                    <textarea class="form-textarea nr" style="min-height:65px; border-radius:8px;" placeholder="Additional observations or remarks for HOD review...">${m.notes?.remarks || m.notes?.summary || ''}</textarea>
                  </div>
                </div>
              </div>

              <!-- Student Acknowledgment & Feedback Section if Completed -->
              ${m.studentAcknowledged ? `
                <div style="margin-top:10px; padding:10px 14px; background:rgba(16, 185, 129, 0.08); border-radius:8px; border:1px solid rgba(16, 185, 129, 0.2); font-size:0.82rem;">
                  <div style="font-weight:700; color:#059669; display:flex; align-items:center; gap:6px; margin-bottom:2px;">
                    <i class="ph ph-seal-check"></i> Digitally Signed &amp; Acknowledged by Student on ${fmt(m.acknowledgedAt)}
                  </div>
                  ${m.studentRating ? `<div style="color:var(--text); font-weight:600;">Student Rating: ${'⭐'.repeat(m.studentRating || 5)} (${m.studentRating}/5)</div>` : ''}
                  ${m.studentFeedback ? `<div style="color:var(--text-secondary); margin-top:2px;">Reflections: "${m.studentFeedback}"</div>` : ''}
                </div>
              ` : ''}

              <div style="display:flex; gap:10px; margin-top:14px; justify-content:flex-end; flex-wrap:wrap;">
                <button class="btn btn-sm btn-secondary cancel-note-btn" data-id="${m.id}" style="border-radius:8px;">Cancel</button>
                <button class="btn btn-sm btn-primary save-note-btn" data-id="${m.id}" data-sid="${m.studentId}" style="border-radius:8px;">💾 Save Notes &amp; Sync Tasks</button>
                <button class="btn btn-sm btn-success save-gen-report-btn" data-id="${m.id}" data-sid="${m.studentId}" style="border-radius:8px;">🖨️ Save &amp; Download Report</button>
              </div>
            </div>
          </div>
        `;
      }).join('')}
    </div>`;

    // Event Handlers for List View
    panel.querySelectorAll('.appr-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        const scheduledAt = panel.querySelector(`.sched-i[data-id="${btn.dataset.id}"]`)?.value;
        if (!scheduledAt) { showToast('Select date/time first', 'warning'); return; }
        try {
          await MeetingService.update(btn.dataset.id, { status:'APPROVED', scheduledAt });
          if (btn.dataset.sid) {
            await NotificationService.create({
              userId: btn.dataset.sid, type:'MEETING_APPROVED',
              title:'Meeting Approved!', message:`Scheduled for ${fmt(scheduledAt)}`, relatedId:btn.dataset.id
            });
          }
          const m = meetings.find(x => x.id === btn.dataset.id);
          if (m) { m.status = 'APPROVED'; m.scheduledAt = scheduledAt; }
          showToast('Meeting approved!', 'success');
          renderCurrentView();
        } catch (err) { showToast(err.message, 'error'); }
      });
    });

    panel.querySelectorAll('.rej-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        const reason = prompt('Enter rejection reason (optional):', 'Unavailable at the requested time');
        if (reason === null) return;
        try {
          await MeetingService.update(btn.dataset.id, { status:'REJECTED', rejectionReason: reason || 'Unavailable' });
          const m = meetings.find(x => x.id === btn.dataset.id);
          if (m) m.status = 'REJECTED';
          showToast('Meeting rejected', 'info');
          renderCurrentView();
        } catch (err) { showToast(err.message, 'error'); }
      });
    });

    panel.querySelectorAll('.join-btn').forEach(btn => {
      btn.addEventListener('click', () => navigateTo(`/meeting-room?id=${btn.dataset.id}`));
    });

    panel.querySelectorAll('.btn-ics-export').forEach(btn => {
      btn.addEventListener('click', () => {
        const m = meetings.find(x => x.id === btn.dataset.id);
        if (m) {
          MeetingService.downloadIcs(m);
          showToast('Calendar invite (.ics) downloaded!', 'success');
        }
      });
    });

    panel.querySelectorAll('.note-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const w = document.getElementById(`notes-${btn.dataset.id}`);
        if (w) w.style.display = w.style.display === 'none' ? 'block' : 'none';
      });
    });

    panel.querySelectorAll('.report-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const m = meetings.find(x => x.id === btn.dataset.id);
        if (m) exportMeetingSessionReport(m);
      });
    });

    // Save Notes Handlers
    async function saveMeetingNotes(meetingId, studentId, andDownloadReport = false) {
      const card = document.getElementById(`card-${meetingId}`);
      const issuesDiscussed = card.querySelector('.np')?.value || '';
      const actionTaken = card.querySelector('.na')?.value || '';
      const privateObservations = card.querySelector('.npo')?.value || '';
      const tasks = card.querySelector('.nt')?.value?.split('\n').filter(Boolean) || [];
      const remarks = card.querySelector('.nr')?.value || '';

      await MeetingService.saveMOMWithActionItems(meetingId, {
        issuesDiscussed,
        actionTaken,
        privateObservations,
        tasks,
        remarks,
        studentId,
        mentorId: user.id
      });

      const m = meetings.find(x => x.id === meetingId);
      if (m) {
        m.notes = { issuesDiscussed, actionTaken, privateObservations, tasks, remarks, summary: remarks || issuesDiscussed };
        m.status = 'COMPLETED';
      }

      showToast('Meeting notes & Action items synced successfully!', 'success');
      renderCurrentView();

      if (andDownloadReport && m) {
        exportMeetingSessionReport(m);
      }
    }

    panel.querySelectorAll('.save-note-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        btn.disabled = true;
        try {
          await saveMeetingNotes(btn.dataset.id, btn.dataset.sid, false);
        } catch (err) {
          showToast(err.message, 'error');
        } finally {
          btn.disabled = false;
        }
      });
    });

    panel.querySelectorAll('.save-gen-report-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        btn.disabled = true;
        try {
          await saveMeetingNotes(btn.dataset.id, btn.dataset.sid, true);
        } catch (err) {
          showToast(err.message, 'error');
        } finally {
          btn.disabled = false;
        }
      });
    });

    panel.querySelectorAll('.cancel-note-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const w = document.getElementById(`notes-${btn.dataset.id}`);
        if (w) w.style.display = 'none';
      });
    });
  }

  // View Switcher Handlers
  container.querySelector('#btn-view-list').addEventListener('click', () => {
    activeViewMode = 'list';
    container.querySelector('#btn-view-list').className = 'btn btn-sm btn-primary';
    container.querySelector('#btn-view-calendar').className = 'btn btn-sm btn-ghost';
    renderCurrentView();
  });

  container.querySelector('#btn-view-calendar').addEventListener('click', () => {
    activeViewMode = 'calendar';
    container.querySelector('#btn-view-calendar').className = 'btn btn-sm btn-primary';
    container.querySelector('#btn-view-list').className = 'btn btn-sm btn-ghost';
    renderCurrentView();
  });

  // Tab switcher
  container.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      container.querySelectorAll('.tab-btn').forEach(b => { 
        b.style.borderBottomColor = 'transparent'; 
        b.style.color = 'var(--text-secondary)'; 
      });
      btn.style.borderBottomColor = 'var(--accent)'; 
      btn.style.color = 'var(--accent)';
      activeTab = btn.dataset.tab; 
      renderCurrentView();
    });
  });

  renderCurrentView();

  // ── OFFICE HOURS & AVAILABILITY MANAGER MODAL ──────────────────────────────────
  const availModalHtml = `
    <div id="avail-modal" class="modal-backdrop" style="display:none; z-index:9999; position:fixed; top:0; left:0; width:100vw; height:100vh; background:rgba(15,23,42,0.65); backdrop-filter:blur(4px); align-items:center; justify-content:center;">
      <div class="modal card" style="width:100%; max-width:540px; border-radius:20px; padding:24px; background:var(--surface,#fff); border:1px solid var(--border); box-shadow:0 20px 40px rgba(0,0,0,0.2);">
        <div class="modal-header" style="display:flex; justify-content:space-between; align-items:center; margin-bottom:16px; border-bottom:1px solid var(--border); padding-bottom:12px;">
          <div>
            <h3 style="font-size:1.15rem; font-weight:800; margin:0; color:var(--text); display:flex; align-items:center; gap:8px;">
              <i class="ph ph-clock-user" style="color:var(--primary);"></i> Configure Office Hours &amp; Slots
            </h3>
            <p style="font-size:0.78rem; color:var(--text-muted); margin:2px 0 0;">Students will be able to book open slots directly on your calendar</p>
          </div>
          <button class="btn btn-ghost btn-sm" id="close-avail-modal" style="width:32px; height:32px; padding:0; border-radius:50%;">✕</button>
        </div>

        <form id="avail-form">
          <div class="form-group" style="margin-bottom:14px;">
            <label class="form-label" style="font-weight:600; margin-bottom:6px; display:block;">Active Mentoring Days</label>
            <div style="display:grid; grid-template-columns:repeat(3, 1fr); gap:8px;" id="avail-days-grid">
              ${['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'].map(d => `
                <label style="display:flex; align-items:center; gap:6px; font-size:0.82rem; cursor:pointer; background:var(--bg-primary); padding:6px 10px; border-radius:8px; border:1px solid var(--border);">
                  <input type="checkbox" name="avail-days" value="${d}"> ${d.slice(0,3)}
                </label>
              `).join('')}
            </div>
          </div>

          <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px; margin-bottom:14px;">
            <div class="form-group">
              <label class="form-label" style="font-weight:600;">Office Hours Start</label>
              <input type="time" id="avail-start-time" class="form-input" value="14:00" style="border-radius:10px;">
            </div>
            <div class="form-group">
              <label class="form-label" style="font-weight:600;">Office Hours End</label>
              <input type="time" id="avail-end-time" class="form-input" value="17:00" style="border-radius:10px;">
            </div>
          </div>

          <div style="display:grid; grid-template-columns:1fr 1fr 1fr; gap:10px; margin-bottom:20px;">
            <div class="form-group">
              <label class="form-label" style="font-weight:600; font-size:0.78rem;">Slot Duration</label>
              <select id="avail-duration" class="form-select" style="border-radius:8px; font-size:0.82rem;">
                <option value="15">15 mins</option>
                <option value="20">20 mins</option>
                <option value="30" selected>30 mins</option>
                <option value="45">45 mins</option>
                <option value="60">60 mins</option>
              </select>
            </div>
            <div class="form-group">
              <label class="form-label" style="font-weight:600; font-size:0.78rem;">Buffer Time</label>
              <select id="avail-buffer" class="form-select" style="border-radius:8px; font-size:0.82rem;">
                <option value="5">5 mins</option>
                <option value="10" selected>10 mins</option>
                <option value="15">15 mins</option>
              </select>
            </div>
            <div class="form-group">
              <label class="form-label" style="font-weight:600; font-size:0.78rem;">Daily Cap</label>
              <select id="avail-max-daily" class="form-select" style="border-radius:8px; font-size:0.82rem;">
                <option value="2">2 meets</option>
                <option value="4" selected>4 meets</option>
                <option value="6">6 meets</option>
                <option value="8">8 meets</option>
              </select>
            </div>
          </div>

          <div style="display:flex; justify-content:flex-end; gap:10px;">
            <button type="button" class="btn btn-secondary" id="cancel-avail-modal" style="border-radius:10px;">Cancel</button>
            <button type="submit" class="btn btn-primary" id="btn-save-avail" style="border-radius:10px; font-weight:700;">Save Office Hours</button>
          </div>
        </form>
      </div>
    </div>
  `;
  container.insertAdjacentHTML('beforeend', availModalHtml);

  const availModal = container.querySelector('#avail-modal');
  container.querySelector('#btn-manage-availability')?.addEventListener('click', async () => {
    try {
      const config = await AvailabilityService.get(user.id);
      if (config) {
        const days = config.activeDays || ['Monday','Wednesday','Friday'];
        availModal.querySelectorAll('input[name="avail-days"]').forEach(chk => {
          chk.checked = days.includes(chk.value);
        });
        if (config.startTime) availModal.querySelector('#avail-start-time').value = config.startTime;
        if (config.endTime) availModal.querySelector('#avail-end-time').value = config.endTime;
        if (config.slotDuration) availModal.querySelector('#avail-duration').value = config.slotDuration;
        if (config.bufferMinutes) availModal.querySelector('#avail-buffer').value = config.bufferMinutes;
        if (config.maxDailyMeets) availModal.querySelector('#avail-max-daily').value = config.maxDailyMeets;
      }
      availModal.style.display = 'flex';
    } catch (e) {
      showToast('Error fetching availability: ' + e.message, 'error');
    }
  });

  container.querySelector('#close-avail-modal').onclick = () => availModal.style.display = 'none';
  container.querySelector('#cancel-avail-modal').onclick = () => availModal.style.display = 'none';

  container.querySelector('#avail-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = container.querySelector('#btn-save-avail');
    btn.disabled = true;
    btn.textContent = 'Saving...';
    try {
      const activeDays = [...availModal.querySelectorAll('input[name="avail-days"]:checked')].map(c => c.value);
      const startTime = availModal.querySelector('#avail-start-time').value;
      const endTime = availModal.querySelector('#avail-end-time').value;
      const slotDuration = Number(availModal.querySelector('#avail-duration').value);
      const bufferMinutes = Number(availModal.querySelector('#avail-buffer').value);
      const maxDailyMeets = Number(availModal.querySelector('#avail-max-daily').value);

      await AvailabilityService.save(user.id, {
        activeDays,
        startTime,
        endTime,
        slotDuration,
        bufferMinutes,
        maxDailyMeets,
        mentorName: user.name
      });

      showToast('Office hours & availability saved successfully!', 'success');
      availModal.style.display = 'none';
    } catch (err) {
      showToast('Failed to save office hours: ' + err.message, 'error');
    } finally {
      btn.disabled = false;
      btn.textContent = 'Save Office Hours';
    }
  });

  // Schedule Modal Setup
  const modalHtml = `
    <div id="schedule-modal" class="modal-backdrop" style="display:none; z-index:9999; position:fixed; top:0; left:0; width:100vw; height:100vh; background:rgba(15,23,42,0.65); backdrop-filter:blur(4px); align-items:center; justify-content:center;">
      <div class="modal card" style="width:100%; max-width:540px; border-radius:20px; padding:24px; background:var(--surface,#fff); border:1px solid var(--border); box-shadow:0 20px 40px rgba(0,0,0,0.2);">
        <div class="modal-header" style="display:flex; justify-content:space-between; align-items:center; margin-bottom:18px; border-bottom:1px solid var(--border); padding-bottom:12px;">
          <h3 style="font-size:1.2rem; font-weight:800; margin:0; color:var(--text);">Schedule Mentorship Session</h3>
          <button class="btn btn-ghost btn-sm" id="close-sched-modal" style="width:32px; height:32px; padding:0; border-radius:50%;">✕</button>
        </div>
        <div class="modal-body">
          <form id="sched-form">
            <div class="form-group" style="margin-bottom:14px;">
              <label class="form-label" style="font-weight:600;">Meeting Format &amp; Scope</label>
              <select id="sched-student" class="form-select" required style="border-radius:10px;">
                <option value="">Select Target Mentee / Group</option>
                <option value="ALL" style="font-weight:bold; color:var(--accent);">👥 Cohort Group Meeting (All Assigned Mentees)</option>
                ${students.map(s => `<option value="${s.id}">👤 ${s.name} (${s.enrollmentNumber||s.rollNo||'Mentee'})</option>`).join('')}
              </select>
            </div>

            <div class="form-group" style="margin-bottom:14px;">
              <label class="form-label" style="font-weight:600;">Meeting Type / Category</label>
              <select id="sched-type" class="form-select" style="border-radius:10px;">
                ${MEETING_TYPES.map(t => `<option value="${t}">${t}</option>`).join('')}
              </select>
            </div>

            <div class="form-group" style="margin-bottom:14px;">
              <label class="form-label" style="font-weight:600;">Why / Agenda / Discussion Topics</label>
              <textarea id="sched-desc" class="form-textarea" required placeholder="Explain why this session is scheduled and topics to be discussed..." style="border-radius:10px; min-height:80px;"></textarea>
            </div>

            <div class="form-group" style="margin-bottom:20px;">
              <label class="form-label" style="font-weight:600;">Date &amp; Scheduled Time</label>
              <input type="datetime-local" id="sched-date" class="form-input" required style="border-radius:10px;">
            </div>

            <div class="modal-footer" style="display:flex; justify-content:flex-end; gap:10px; border:none; padding:0;">
              <button type="button" class="btn btn-secondary" id="cancel-sched-modal" style="border-radius:10px;">Cancel</button>
              <button type="submit" class="btn btn-primary" id="btn-submit-sched" style="border-radius:10px; font-weight:700;">Schedule &amp; Notify</button>
            </div>
          </form>
        </div>
      </div>
    </div>
  `;
  container.insertAdjacentHTML('beforeend', modalHtml);

  const schedModal = container.querySelector('#schedule-modal');
  container.querySelector('#btn-schedule-meeting').addEventListener('click', () => {
    const studentSelect = container.querySelector('#sched-student');
    studentSelect.innerHTML = '<option value="">Select Target Mentee / Group</option><option value="ALL" style="font-weight:bold;color:var(--accent);">👥 Cohort Group Meeting (All Assigned Mentees)</option>' + 
      students.map(s => `<option value="${s.id}">👤 ${s.name} (${s.enrollmentNumber||s.rollNo||'Mentee'})</option>`).join('');
    schedModal.style.display = 'flex';
  });

  container.querySelector('#close-sched-modal').addEventListener('click', () => schedModal.style.display = 'none');
  container.querySelector('#cancel-sched-modal').addEventListener('click', () => schedModal.style.display = 'none');
  schedModal.addEventListener('click', (e) => {
    if (e.target === schedModal) schedModal.style.display = 'none';
  });

  container.querySelector('#sched-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = container.querySelector('#btn-submit-sched');
    btn.disabled = true; 
    btn.textContent = 'Scheduling...';

    try {
      const studentId = container.querySelector('#sched-student').value;
      const type = container.querySelector('#sched-type').value || 'Mentorship Session';
      const desc = container.querySelector('#sched-desc').value.trim();
      const date = container.querySelector('#sched-date').value;

      if (studentId === 'ALL') {
        const mData = {
          mentorId: user.id, 
          mentorName: user.name,
          studentId: 'ALL', 
          studentName: 'Cohort Batch Meeting',
          isGroup: true, 
          type, 
          topic: desc, 
          description: desc, 
          scheduledAt: date,
          department: user.department || 'Department of Computer Science & Engineering (Core)',
          students: students.map(s => ({ name: s.name, studentName: s.name, enrollment: s.enrollmentNumber || s.rollNo || '—' })),
          status: 'APPROVED'
        };
        const mId = await MeetingService.create(mData);
        meetings.unshift({ id: mId, ...mData });
        
        for (const s of students) {
          await NotificationService.create({
            userId: s.id, type: 'MEETING_APPROVED',
            title: `New Group Mentorship Session: ${type}`, 
            message: `Scheduled for ${fmt(date)}. Agenda: ${desc}`, 
            relatedId: mId
          });
        }
      } else {
        const student = students.find(s => s.id === studentId);
        const mData = {
          mentorId: user.id, 
          mentorName: user.name,
          studentId: student.id, 
          studentName: student.name,
          studentEnrollment: student.enrollmentNumber || student.rollNo || '—',
          department: student.department || user.department || 'Department of Computer Science & Engineering (Core)',
          type, 
          topic: desc, 
          description: desc, 
          scheduledAt: date,
          students: [{ name: student.name, enrollment: student.enrollmentNumber || student.rollNo || '—' }],
          status: 'APPROVED'
        };
        const mId = await MeetingService.create(mData);
        meetings.unshift({ id: mId, ...mData });
        
        await NotificationService.create({
          userId: student.id, type: 'MEETING_APPROVED',
          title: `Mentorship Session Scheduled: ${type}`, 
          message: `Scheduled for ${fmt(date)}. Agenda: ${desc}`, 
          relatedId: mId
        });
      }

      showToast('Meeting scheduled and added to calendar!', 'success');
      schedModal.style.display = 'none';
      e.target.reset();
      
      activeTab = 'approved';
      renderCurrentView();
    } catch(err) {
      showToast(err.message, 'error');
    } finally {
      btn.disabled = false; 
      btn.textContent = 'Schedule & Notify';
    }
  });
}
