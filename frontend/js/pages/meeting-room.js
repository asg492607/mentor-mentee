import { createSignaling } from '/js/webrtc/signaling.js';
import { createPeerConnection } from '/js/webrtc/peer.js';
import { getLocalStream, toggleCamera, toggleMic, shareScreen, stopScreenShare } from '/js/webrtc/media.js';
import { getUserProfile } from '/js/auth.js';
import { navigateTo } from '/js/router.js';
import { showToast } from '/js/components/toast.js';
import { MeetingService } from '/js/services.js';

const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, char => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;'
}[char]));

export async function render(container) {
  const params = new URLSearchParams(window.location.hash.split('?')[1] || '');
  const meetingId = params.get('id');
  const user = getUserProfile();
  if (!meetingId || !user) {
    showToast('Invalid meeting link', 'error');
    navigateTo('/');
    return;
  }

  const meeting = await MeetingService.get(meetingId);
  const hasAccess = [meeting?.studentId, meeting?.mentorId].includes(user.id) || meeting?.studentId === 'ALL';

  if (!meeting || !hasAccess) {
    showToast('You do not have access to this meeting', 'error');
    navigateTo('/');
    return;
  }
  if (!['APPROVED', 'ONGOING'].includes(meeting.status)) {
    showToast('This meeting is not ready to join', 'warning');
    navigateTo('/');
    return;
  }

  const isMentor = (meeting?.mentorId === user.id) || ['FACULTY', 'MENTOR', 'HOD', 'DEAN', 'SECTION_HEAD', 'ADMIN'].includes(String(user?.role).toUpperCase());

  container.innerHTML = `
      <div class="meeting-room-layout">
        <!-- Top Bar -->
        <header class="meeting-topbar">
          <div class="meeting-topbar-left">
            <div class="meeting-title-wrap">
              <div class="meeting-title">
                ${escapeHtml(meeting.type || '1-on-1 Mentorship Session')}
                ${isMentor ? '<span class="meeting-host-badge">Ã°Å¸â€˜â€˜ Host</span>' : ''}
              </div>
              <div class="meeting-status-chips">
                <span class="meeting-timer" id="meeting-status">
                  <span class="meeting-live-dot"></span>
                  <span id="meeting-timer-text">Connecting...</span>
                </span>
                <span class="meeting-security-chip">Ã°Å¸â€â€™ E2E Encrypted</span>
                <span class="meeting-security-chip" id="participant-count-chip">Ã°Å¸â€˜Â¥ 1 Participant</span>
              </div>
            </div>
          </div>
          <div class="meeting-topbar-right">
            <button class="btn-meet-secondary" id="copy-room-link" title="Copy invitation link">
              <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z"/></svg>
              <span>Copy Link</span>
            </button>
          </div>
        </header>

        <!-- Main Workspace -->
        <main class="meeting-main">
          <!-- Video Grid / Join Lounge -->
          <section class="video-grid grid-1" id="video-grid">
            <!-- Pre-join Screen -->
            <div class="meeting-join" id="join-screen">
              <div class="meeting-join-card">
                <h2>Ready to join?</h2>
                <p>Meeting with <strong>${escapeHtml(meeting.mentorName || 'Mentor')}</strong></p>
                
                <div class="preview-video-container">
                  <video id="preview-video" autoplay playsinline muted></video>
                  <div class="preview-controls-overlay">
                    <button class="btn-preview-toggle" id="preview-mic" title="Toggle Microphone">
                      <svg viewBox="0 0 24 24" fill="currentColor" width="20" height="20"><path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z"/><path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z"/></svg>
                    </button>
                    <button class="btn-preview-toggle" id="preview-cam" title="Toggle Camera">
                      <svg viewBox="0 0 24 24" fill="currentColor" width="20" height="20"><path d="M17 10.5V7c0-.55-.45-1-1-1H4c-.55 0-1 .45-1 1v10c0 .55.45 1 1 1h12c.55 0 1-.45 1-1v-3.5l4 4v-11l-4 4z"/></svg>
                    </button>
                  </div>
                </div>

                <button class="btn-join-main" id="btn-join-meeting">
                  <span>Enter Meeting Room</span>
                  <svg viewBox="0 0 24 24" fill="currentColor" width="20" height="20"><path d="M10 17l5-5-5-5v10z"/></svg>
                </button>
              </div>
            </div>

            <!-- Waiting Room Screen for Students -->
            <div class="meeting-waiting" id="meeting-waiting" hidden>
              <div class="meeting-waiting-card">
                <div class="pulse-ring-wrap">
                  <div class="pulse-ring-circle"></div>
                  <div class="pulse-ring-circle"></div>
                  <div class="tile-avatar-circle">${escapeHtml((user.name || '?')[0].toUpperCase())}</div>
                </div>
                <h2>Waiting for Host to Admit You</h2>
                <p>The mentor will let you in shortly. Your camera and microphone will connect automatically upon entry.</p>
              </div>
            </div>
          </section>

          <!-- Side Drawer Panel -->
          <aside class="meeting-side-panel hidden" id="meeting-side-panel">
            <div class="side-panel-header">
              <div class="side-panel-title" id="side-panel-title">Chat</div>
              <button class="btn-meet-secondary" id="btn-close-side-panel" style="padding: 4px 8px; border-radius: 50%;">Ã¢Å“â€¢</button>
            </div>
            
            <div class="side-panel-tabs">
              <button class="side-panel-tab active" data-panel="chat">
                <span>Ã°Å¸â€™Â¬ Chat</span>
              </button>
              <button class="side-panel-tab" data-panel="participants">
                <span>Ã°Å¸â€˜Â¥ People</span>
              </button>
              ${isMentor ? `
              <button class="side-panel-tab" data-panel="controls">
                <span>Ã°Å¸â€ºÂ¡Ã¯Â¸Â Controls</span>
              </button>
              <button class="side-panel-tab" data-panel="notes">
                <span>Ã°Å¸â€œÂ Notes</span>
              </button>
              <button class="side-panel-tab" data-panel="report">
                <span>Ã°Å¸â€œâ€¹ Report</span>
              </button>` : ''}
            </div>

            <div class="side-panel-body">
              <!-- Chat Panel -->
              <div id="panel-chat">
                <div class="chat-messages" id="chat-messages">
                  <div class="chat-empty-state">No messages yet. Send a message to start the conversation!</div>
                </div>
                <div id="chat-locked-notice" class="chat-locked-banner" hidden>
                  Ã°Å¸â€â€™ Chat is locked by the meeting host
                </div>
              </div>

              <!-- Participants Panel -->
              <div id="panel-participants" hidden></div>

              <!-- Host Control Center -->
              ${isMentor ? `
              <div id="panel-controls" class="host-controls-panel" hidden>
                <div class="host-section-card">
                  <div class="host-section-title">Ã¢Å¡Â¡ Instant Broadcast Actions</div>
                  <div class="host-quick-actions">
                    <button class="btn-host-action mute-btn" id="btn-host-mute-all" title="Mute all student microphones immediately">
                      Ã°Å¸â€â€¡ Mute All Students
                    </button>
                    <button class="btn-host-action" id="btn-host-disable-cams" title="Turn off all student video cameras immediately">
                      Ã°Å¸â€œÂ· Turn Off All Cams
                    </button>
                  </div>
                </div>

                <div class="host-section-card">
                  <div class="host-section-title">Ã°Å¸â€ºÂ¡Ã¯Â¸Â Student Permission Locks</div>
                  
                  <div class="host-toggle-row">
                    <div class="host-toggle-info">
                      <div class="host-toggle-label">Block All Voices (Mic Lock)</div>
                      <div class="host-toggle-desc">Mutes students and prevents unmuting</div>
                    </div>
                    <label class="switch-control">
                      <input type="checkbox" id="toggle-host-mic-lock">
                      <span class="switch-slider"></span>
                    </label>
                  </div>

                  <div class="host-toggle-row">
                    <div class="host-toggle-info">
                      <div class="host-toggle-label">Block All Videos (Camera Lock)</div>
                      <div class="host-toggle-desc">Disables cameras and prevents turning on</div>
                    </div>
                    <label class="switch-control">
                      <input type="checkbox" id="toggle-host-cam-lock">
                      <span class="switch-slider"></span>
                    </label>
                  </div>

                  <div class="host-toggle-row">
                    <div class="host-toggle-info">
                      <div class="host-toggle-label">Block Student Chat (Chat Lock)</div>
                      <div class="host-toggle-desc">Prevents students from typing messages</div>
                    </div>
                    <label class="switch-control">
                      <input type="checkbox" id="toggle-host-chat-lock">
                      <span class="switch-slider"></span>
                    </label>
                  </div>

                  <div class="host-toggle-row">
                    <div class="host-toggle-info">
                      <div class="host-toggle-label">Lock Screen Sharing</div>
                      <div class="host-toggle-desc">Restricts screen sharing to Host only</div>
                    </div>
                    <label class="switch-control">
                      <input type="checkbox" id="toggle-host-screen-lock">
                      <span class="switch-slider blue"></span>
                    </label>
                  </div>

                  <div class="host-toggle-row">
                    <div class="host-toggle-info">
                      <div class="host-toggle-label">Lock Meeting Room</div>
                      <div class="host-toggle-desc">Denies new unadmitted participants</div>
                    </div>
                    <label class="switch-control">
                      <input type="checkbox" id="toggle-host-room-lock">
                      <span class="switch-slider blue"></span>
                    </label>
                  </div>
                </div>
              </div>` : ''}

              <!-- Notes Panel (Mentor Only) -->
              ${isMentor ? `
              <div id="panel-notes" hidden>
                <div class="host-section-card">
                  <div class="host-section-title">Ã°Å¸â€œÂ Confidential Meeting Notes</div>
                  <p style="font-size:0.75rem; color:var(--meet-text-muted); margin-bottom:8px;">Notes saved here are synchronized with the mentorship dossier.</p>
                  <textarea id="meeting-notes" class="meeting-notes-area" placeholder="Enter session notes, action items, or feedback for the mentee...">${escapeHtml(meeting.notes?.summary || '')}</textarea>
                  <button class="btn-join-main" id="save-meeting-notes" style="padding:10px 16px; font-size:0.875rem; margin-top:8px;">Save Session Notes</button>
                </div>
              </div>` : ''}

              <!-- Report Generation Panel (Mentor Only) -->
              ${isMentor ? `
              <div id="panel-report" hidden>
                <div class="report-form-scroll">

                  <div class="report-section-title">📋 Meeting Report Generation</div>
                  <p class="report-section-desc">Fill in the details below to generate an official mentorship session report.</p>

                  <!-- Meeting Info -->
                  <div class="report-field-group">
                    <label class="report-label">📌 Meeting Topic / Agenda</label>
                    <input id="rpt-topic" class="report-input" type="text" placeholder="e.g. Academic Progress Review, Career Guidance..." value="${escapeHtml(meeting.type || '')}">
                  </div>

                  <div class="report-field-row">
                    <div class="report-field-group">
                      <label class="report-label">📅 Meeting Date</label>
                      <input id="rpt-date" class="report-input" type="date" value="${new Date(meeting.scheduledAt || Date.now()).toISOString().slice(0, 10)}">
                    </div>
                    <div class="report-field-group">
                      <label class="report-label">🕐 Meeting Time</label>
                      <input id="rpt-time" class="report-input" type="time" value="${new Date(meeting.scheduledAt || Date.now()).toTimeString().slice(0, 5)}">
                    </div>
                  </div>

                  <div class="report-field-group">
                    <label class="report-label">👥 Students Present</label>
                    <div id="rpt-students-list" class="rpt-students-list">
                      <div class="rpt-student-row">
                        <input class="report-input rpt-sname" type="text" placeholder="Student Name" style="flex:1.4">
                        <input class="report-input rpt-senroll" type="text" placeholder="Enrollment No." style="flex:1">
                        <button class="btn-rpt-remove" onclick="this.closest('.rpt-student-row').remove()" title="Remove">✕</button>
                      </div>
                    </div>
                    <button class="btn-rpt-add-student" id="btn-add-student" type="button">+ Add Student</button>
                  </div>

                  <div class="report-field-group">
                    <label class="report-label">⚠️ Issues Discussed</label>
                    <textarea id="rpt-issues" class="report-textarea" rows="4" placeholder="Summarize problems, challenges, or concerns raised during the meeting...">${escapeHtml(meeting.notes?.summary || '')}</textarea>
                  </div>

                  <div class="report-field-group">
                    <label class="report-label">✅ Action Items & Resolutions</label>
                    <textarea id="rpt-actions" class="report-textarea" rows="4" placeholder="List follow-up tasks, solutions agreed upon, or next steps..."></textarea>
                  </div>

                  <div class="report-field-group">
                    <label class="report-label">📝 Additional Remarks</label>
                    <textarea id="rpt-remarks" class="report-textarea" rows="3" placeholder="Any other observations, feedback, or remarks for the record..."></textarea>
                  </div>

                  <div class="report-field-group">
                    <label class="report-label">🏢 Department</label>
                    <input id="rpt-dept" class="report-input" type="text" placeholder="e.g. School of Computing" value="${escapeHtml(meeting.department || 'School of Computing')}">
                  </div>

                  <!-- Signature Section -->
                  <div class="report-sig-section">
                    <div class="report-sig-title">✍️ Signature Block</div>

                    <div class="report-sig-row">
                      <div class="report-sig-box">
                        <div class="report-sig-line"></div>
                        <div class="report-sig-name">Prepared By</div>
                        <div class="report-sig-person" id="rpt-prepared-name">Prof. ${escapeHtml(meeting.mentorName || user.name || 'Mentor Name')}</div>
                        <div class="report-sig-role">Mentor / Faculty</div>
                      </div>
                      <div class="report-sig-box">
                        <div class="report-sig-line"></div>
                        <div class="report-sig-name">Checked By</div>
                        <input id="rpt-checker-name" class="report-sig-input" type="text" placeholder="Prof. (Leave empty)">
                        <div class="report-sig-role">Coordinator / Faculty</div>
                      </div>
                      <div class="report-sig-box">
                        <div class="report-sig-line"></div>
                        <div class="report-sig-name">Verify By</div>
                        <div class="report-sig-person" style="font-size:0.68rem; line-height:1.25;">
                          <div>Dr. Nilesh Thale</div>
                          <div>Dr. Aman Singh</div>
                        </div>
                        <div class="report-sig-role">Verification Committee</div>
                      </div>
                      <div class="report-sig-box">
                        <div class="report-sig-line"></div>
                        <div class="report-sig-name">Approved By</div>
                        <input id="rpt-hod-name" class="report-sig-input" type="text" placeholder="HOD Name">
                        <div class="report-sig-role">Head of Department</div>
                      </div>
                    </div>
                  </div>

                  <div class="report-actions">
                    <button class="btn-report-save" id="btn-save-report">💾 Save Report</button>
                    <button class="btn-report-generate" id="btn-generate-report">🖨️ Generate & Print</button>
                  </div>

                </div>
              </div>` : ''}
            </div>

            <!-- Chat Input Footer -->
            <form class="chat-input-wrap" id="chat-form">
              <input class="chat-input" id="chat-input" maxlength="2000" placeholder="Type a message to everyone..." autocomplete="off">
              <button class="btn-chat-send" type="submit" id="btn-chat-send">Send</button>
            </form>
          </aside>
        </main>

        <!-- Bottom Controls Dock -->
        <div class="meeting-controls-dock-wrap">
          <footer class="meeting-controls">
            <!-- Microphone -->
            <button class="control-btn" id="btn-mic" title="Toggle Microphone">
              <span class="control-btn-icon">
                <svg viewBox="0 0 24 24" fill="currentColor" width="22" height="22"><path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3zm5.91-3c-.49 0-.9.39-.9.88C17 14.15 14.8 16 12 16s-5-.15-5.01-4.12c0-.49-.41-.88-.9-.88s-.89.39-.89.88c0 5.05 3.91 9.14 8.8 9.87V24h2v-2.25c4.89-.73 8.8-4.82 8.8-9.87 0-.49-.4-.88-.89-.88z"/></svg>
              </span>
              <span class="control-btn-label" id="label-mic">Mic</span>
            </button>

            <!-- Camera -->
            <button class="control-btn" id="btn-cam" title="Toggle Camera">
              <span class="control-btn-icon">
                <svg viewBox="0 0 24 24" fill="currentColor" width="22" height="22"><path d="M15 8v8H5V8h10m1-2H4c-.55 0-1 .45-1 1v10c0 .55.45 1 1 1h12c.55 0 1-.45 1-1v-3.5l4 4v-11l-4 4V7c0-.55-.45-1-1-1z"/></svg>
              </span>
              <span class="control-btn-label" id="label-cam">Camera</span>
            </button>

            <!-- Screen Share -->
            <button class="control-btn" id="btn-screen" title="Share Screen">
              <span class="control-btn-icon">
                <svg viewBox="0 0 24 24" fill="currentColor" width="22" height="22"><path d="M20 18c1.1 0 1.99-.9 1.99-2L22 6c0-1.11-.9-2-2-2H4c-1.11 0-2 .89-2 2v10c0 1.1.89 2 2 2H0v2h24v-2h-4zM4 16V6h16v10H4z"/></svg>
              </span>
              <span class="control-btn-label">Share</span>
            </button>

            <!-- Chat Drawer Toggle -->
            <button class="control-btn" id="btn-toggle-chat" title="Chat Messages">
              <span class="control-btn-icon">
                <svg viewBox="0 0 24 24" fill="currentColor" width="22" height="22"><path d="M20 2H4c-1.1 0-1.99.9-1.99 2L2 22l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm-2 12H6v-2h12v2zm0-3H6V9h12v2zm0-3H6V6h12v2z"/></svg>
              </span>
              <span class="control-btn-label">Chat</span>
            </button>

            <!-- People Drawer Toggle -->
            <button class="control-btn" id="btn-toggle-people" title="Participants">
              <span class="control-btn-icon">
                <svg viewBox="0 0 24 24" fill="currentColor" width="22" height="22"><path d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z"/></svg>
              </span>
              <span class="control-btn-label">People</span>
            </button>

            <!-- Host Controls Drawer Toggle (Host only) -->
            ${isMentor ? `
            <button class="control-btn" id="btn-toggle-controls" title="Host Controls">
              <span class="control-btn-icon" style="color:#fbbf24;">
                <svg viewBox="0 0 24 24" fill="currentColor" width="22" height="22"><path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4zm0 10.99h7c-.53 4.12-3.28 7.79-7 8.94V12H5V6.3l7-3.11v8.8z"/></svg>
              </span>
              <span class="control-btn-label">Controls</span>
            </button>` : ''}

            <!-- Record Button (Mentor only) -->
            ${isMentor ? `
            <button class="control-btn" id="btn-record" title="Record Meeting">
              <span class="control-btn-icon" style="color:var(--meet-crimson);">
                <svg viewBox="0 0 24 24" fill="currentColor" width="22" height="22"><circle cx="12" cy="12" r="8"/></svg>
              </span>
              <span class="control-btn-label" id="label-record">Record</span>
            </button>` : ''}

            <!-- End / Leave Call -->
            <button class="control-btn end-call" id="btn-end" title="Leave Meeting">
              <span class="control-btn-icon">
                <svg viewBox="0 0 24 24" fill="currentColor" width="24" height="24"><path d="M12 9c-1.6 0-3.15.25-4.6.72v3.1c0 .39-.23.74-.56.9-.98.49-1.87 1.12-2.66 1.85-.18.18-.43.28-.7.28-.28 0-.53-.11-.71-.29L.29 13.08c-.18-.17-.29-.42-.29-.7 0-.28.11-.53.29-.71C3.34 8.78 7.46 7 12 7s8.66 1.78 11.71 4.67c.18.18.29.43.29.71 0 .28-.11.52-.29.71l-2.48 2.48c-.18.18-.43.29-.71.29-.27 0-.52-.11-.7-.28-.79-.74-1.69-1.36-2.67-1.85-.33-.16-.56-.5-.56-.9v-3.1C15.15 9.25 13.6 9 12 9z"/></svg>
              </span>
              <span class="control-btn-label">${isMentor ? 'End' : 'Leave'}</span>
            </button>
          </footer>
        </div>
      </div>`;

  const peers = new Map();
  const signaling = createSignaling(meetingId, user, isMentor);
  const timerText = document.getElementById('meeting-timer-text');
  const participantChip = document.getElementById('participant-count-chip');
  const grid = document.getElementById('video-grid');
  let localStream;
  let screenStream;
  let elapsed = 0;
  let timer = null;
  let cleaned = false;
  let activeRoomSettings = {
    micLocked: false,
    cameraLocked: false,
    chatLocked: false,
    screenLocked: false,
    roomLocked: false
  };

  let participants = [];
  let waitingList = [];

  // Helper: update tile layout classes
  function updateGridClass() {
    const count = grid.querySelectorAll('.video-tile').length;
    if (count <= 1) grid.className = 'video-grid grid-1';
    else if (count === 2) grid.className = 'video-grid grid-2';
    else if (count === 3) grid.className = 'video-grid grid-3';
    else if (count === 4) grid.className = 'video-grid grid-4';
    else grid.className = 'video-grid grid-multi';

    if (participantChip) {
      participantChip.textContent = `Ã°Å¸â€˜Â¥ ${Math.max(1, count)} Participant${count > 1 ? 's' : ''}`;
    }
  }

  function addVideo(id, name, stream, isLocal = false, isTileHost = false) {
    container.querySelector('#meeting-waiting')?.remove();
    let tile = container.querySelector(`[data-peer="${id}"]`);
    let video;
    let avatar;

    if (!tile) {
      tile = document.createElement('div');
      tile.className = 'video-tile';
      tile.dataset.peer = id;

      video = document.createElement('video');
      video.autoplay = true;
      video.playsInline = true;
      video.muted = isLocal; // Always mute local playback to prevent echo

      avatar = document.createElement('div');
      avatar.className = 'tile-avatar';
      avatar.innerHTML = `<div class="tile-avatar-circle">${escapeHtml((name || '?')[0].toUpperCase())}</div>`;
      avatar.style.display = 'none';

      const labelBar = document.createElement('div');
      labelBar.className = 'tile-label-bar';
      labelBar.innerHTML = `
                <span class="tile-label">${escapeHtml(name)}</span>
                ${isTileHost ? '<span class="tile-role-pill host">Host</span>' : ''}
                ${isLocal ? '<span class="tile-role-pill">You</span>' : ''}
            `;

      const statusIcons = document.createElement('div');
      statusIcons.className = 'tile-status-icons';
      statusIcons.id = `status-icons-${id}`;

      tile.append(video, avatar, labelBar, statusIcons);
      grid.append(tile);
    } else {
      video = tile.querySelector('video');
      avatar = tile.querySelector('.tile-avatar');
    }

    if (video.srcObject !== stream) {
      video.srcObject = stream;
    }

    video.play().catch(err => console.warn(`[Video] Play error for ${id}:`, err));

    // Listen to track enablement
    if (stream && stream.getVideoTracks) {
      const vTrack = stream.getVideoTracks()[0];
      if (vTrack) {
        const checkVideo = () => {
          const enabled = vTrack.enabled && !vTrack.muted;
          tile.classList.toggle('video-off', !enabled);
          if (avatar) avatar.style.display = enabled ? 'none' : 'flex';
        };
        vTrack.onmute = checkVideo;
        vTrack.onunmute = checkVideo;
        checkVideo();
      }
    }

    updateGridClass();
  }

  function createPeer(id, name, offer) {
    if (peers.has(id)) return peers.get(id);
    const peer = createPeerConnection(signaling, localStream, id);
    peer.onTrack(stream => {
      const isPeerHost = participants.find(p => p.id === id)?.isHost;
      addVideo(id, name || 'Participant', stream, false, isPeerHost);
    });
    peers.set(id, peer);

    peer.pc.addEventListener('iceconnectionstatechange', () => {
      if (peer.pc.iceConnectionState === 'failed' || peer.pc.iceConnectionState === 'disconnected') {
        if (peer.pc.restartIce) {
          peer.pc.restartIce();
          peer.createOffer().catch(handleError);
        }
      }
    });

    if (offer) peer.createOffer().catch(handleError);
    return peer;
  }

  function appendMessage(sender, text, own = false) {
    const emptyState = container.querySelector('.chat-empty-state');
    if (emptyState) emptyState.remove();

    const row = document.createElement('div');
    row.className = `chat-message${own ? ' own' : ''}`;

    const senderLabel = document.createElement('span');
    senderLabel.className = 'chat-sender';
    senderLabel.textContent = own ? 'You' : sender;

    const bubble = document.createElement('div');
    bubble.className = 'chat-bubble';
    bubble.textContent = text;

    row.append(senderLabel, bubble);
    const chatBox = container.querySelector('#chat-messages');
    if (chatBox) {
      chatBox.append(row);
      chatBox.scrollTop = chatBox.scrollHeight;
    }
  }

  function renderRoster(participants = [], waitingList = []) {
    let html = '';

    // Waiting room section for host
    if (isMentor && waitingList.length > 0) {
      html += `<div class="waiting-room-card">
                <div class="waiting-room-header">
                    <span class="waiting-room-title">Ã¢ÂÂ³ WAITING ROOM (${waitingList.length})</span>
                    <div style="display:flex;gap:4px;">
                        <button class="btn-meet-secondary" style="padding:3px 8px;font-size:0.75rem;" onclick="window.admitAll()">Admit All</button>
                        <button class="btn-meet-secondary" style="padding:3px 8px;font-size:0.75rem;" onclick="window.denyAll()">Deny All</button>
                    </div>
                </div>
                ${waitingList.map(person => `
                    <div class="participant-item">
                        <div class="participant-avatar-badge">${escapeHtml((person.name || '?')[0].toUpperCase())}</div>
                        <div class="participant-info">
                            <span class="participant-name">${escapeHtml(person.name)}</span>
                            <span class="participant-sub">Waiting to join</span>
                        </div>
                        <div class="participant-actions">
                            <button class="btn-part-action" style="background:#10b98122;color:#10b981;border-color:#10b98144;" onclick="window.admitUser('${person.id}')" title="Admit">Ã¢Å“â€œ</button>
                            <button class="btn-part-action danger" onclick="window.denyUser('${person.id}')" title="Deny">Ã¢Å“â€¢</button>
                        </div>
                    </div>
                `).join('')}
            </div>`;
    }

    html += `<div style="font-size:0.75rem;font-weight:700;color:var(--meet-text-muted);text-transform:uppercase;letter-spacing:0.05em;margin-bottom:10px;">In Meeting (${participants.length})</div>`;
    html += participants.map(person => {
      const isSelf = person.id === signaling.selfId;
      const personIsHost = person.isHost || (person.name === meeting.mentorName);
      return `
            <div class="participant-item">
                <div class="participant-avatar-badge">${escapeHtml((person.name || '?')[0].toUpperCase())}</div>
                <div class="participant-info">
                    <span class="participant-name">${escapeHtml(person.name)} ${isSelf ? '<span style="color:#818cf8;font-size:0.75rem;">(You)</span>' : ''}</span>
                    <span class="participant-sub">${personIsHost ? 'Ã°Å¸â€˜â€˜ Meeting Host' : 'Student Participant'}</span>
                </div>
                ${isMentor && !isSelf ? `
                    <div class="participant-actions">
                        <button class="btn-part-action" onclick="window.muteMic('${person.id}')" title="Mute Participant Microphone">Ã°Å¸â€â€¡</button>
                        <button class="btn-part-action" onclick="window.stopCam('${person.id}')" title="Stop Participant Video">Ã°Å¸â€œÂ·Ã¢ÂÅ’</button>
                        <button class="btn-part-action danger" onclick="window.removeUser('${person.id}')" title="Remove from Call">Ã°Å¸Å¡Â«</button>
                    </div>
                ` : ''}
            </div>
            `;
    }).join('');

    const panel = container.querySelector('#panel-participants');
    if (panel) panel.innerHTML = html;
  }

  const handleControlAction = async (id, action) => {
    const success = await signaling.sendControl(id, action);
    if (!success) showToast('Failed to broadcast control command', 'error');
  };

  window.admitUser = (id) => handleControlAction(id, 'admit');
  window.denyUser = (id) => handleControlAction(id, 'deny');
  window.removeUser = (id) => {
    if (confirm("Are you sure you want to remove this participant?")) {
      handleControlAction(id, 'remove');
    }
  };
  window.muteMic = (id) => {
    handleControlAction(id, 'mute-mic');
    showToast('Mute signal sent to participant', 'info');
  };
  window.stopCam = (id) => {
    handleControlAction(id, 'disable-cam');
    showToast('Stop video signal sent to participant', 'info');
  };
  window.admitAll = () => waitingList.forEach(p => handleControlAction(p.id, 'admit'));
  window.denyAll = () => waitingList.forEach(p => handleControlAction(p.id, 'deny'));

  function handleError(error) {
    console.error(error);
    if (timerText) timerText.textContent = error.message || 'Connection error';
    showToast(error.message || 'Meeting connection failed', 'error');
  }

  // Apply Student Lock Enforcement based on real-time roomSettings
  function applyStudentLocks(settings) {
    if (isMentor) return; // Hosts are never restricted

    // 1. Microphone Lock
    const btnMic = document.getElementById('btn-mic');
    const labelMic = document.getElementById('label-mic');
    if (btnMic) {
      if (settings.micLocked) {
        // If microphone is currently active, turn it off immediately
        if (localStream && localStream.getAudioTracks()[0]?.enabled) {
          toggleMic(localStream);
          btnMic.classList.add('active');
        }
        btnMic.disabled = true;
        if (labelMic) labelMic.textContent = 'Mic (Locked)';
        btnMic.title = 'Microphone is locked by the host';
      } else {
        btnMic.disabled = false;
        if (labelMic) labelMic.textContent = 'Mic';
        btnMic.title = 'Toggle Microphone';
      }
    }

    // 2. Camera Lock
    const btnCam = document.getElementById('btn-cam');
    const labelCam = document.getElementById('label-cam');
    if (btnCam) {
      if (settings.cameraLocked) {
        // If camera is currently active, disable it immediately
        if (localStream && localStream.getVideoTracks()[0]?.enabled) {
          toggleCamera(localStream);
          btnCam.classList.add('active');
          const localTile = container.querySelector('[data-peer="local"]');
          if (localTile) {
            localTile.classList.add('video-off');
            const localAvatar = localTile.querySelector('.tile-avatar');
            if (localAvatar) localAvatar.style.display = 'flex';
          }
        }
        btnCam.disabled = true;
        if (labelCam) labelCam.textContent = 'Cam (Locked)';
        btnCam.title = 'Camera is locked by the host';
      } else {
        btnCam.disabled = false;
        if (labelCam) labelCam.textContent = 'Camera';
        btnCam.title = 'Toggle Camera';
      }
    }

    // 3. Chat Lock
    const chatInput = document.getElementById('chat-input');
    const chatSend = document.getElementById('btn-chat-send');
    const chatLockBanner = document.getElementById('chat-locked-notice');
    if (chatInput) {
      if (settings.chatLocked) {
        chatInput.disabled = true;
        chatInput.placeholder = 'Chat has been locked by the host';
        if (chatSend) chatSend.disabled = true;
        if (chatLockBanner) chatLockBanner.hidden = false;
      } else {
        chatInput.disabled = false;
        chatInput.placeholder = 'Type a message to everyone...';
        if (chatSend) chatSend.disabled = false;
        if (chatLockBanner) chatLockBanner.hidden = true;
      }
    }

    // 4. Screen Sharing Lock
    const btnScreen = document.getElementById('btn-screen');
    if (btnScreen) {
      if (settings.screenLocked) {
        if (screenStream) {
          document.getElementById('btn-screen').click(); // Stop screen share
        }
        btnScreen.disabled = true;
        btnScreen.title = 'Screen sharing is locked by the host';
      } else {
        btnScreen.disabled = false;
        btnScreen.title = 'Share Screen';
      }
    }
  }

  async function init() {
    try {
      if (!localStream) localStream = await getLocalStream();
      addVideo('local', `${user.name} (You)`, localStream, true, isMentor);

      signaling.onMessage('joined', message => {
        signaling.selfId = message.id;
        participants = [{ id: message.id, name: user.name, isHost: isMentor }, ...message.peers];
        renderRoster(participants, waitingList);
        message.peers.forEach(person => {
          createPeer(person.id, person.name, true);
        });
      });

      signaling.onMessage('peer-joined', message => {
        participants = participants.filter(p => p.id !== message.id);
        participants.push({ id: message.id, name: message.name, isHost: message.isHost });
        renderRoster(participants, waitingList);
        createPeer(message.id, message.name, false);
        showToast(`${message.name} joined the meeting`, 'info');
      });

      signaling.onMessage('signal', message => {
        createPeer(message.from, message.name, false).handleSignal(message.signal).catch(handleError);
      });

      signaling.onMessage('peer-left', message => {
        participants = participants.filter(p => p.id !== message.id);
        renderRoster(participants, waitingList);
        peers.get(message.id)?.close();
        peers.delete(message.id);
        const tile = container.querySelector(`[data-peer="${message.id}"]`);
        if (tile) tile.remove();
        updateGridClass();
        showToast('A participant left the meeting', 'info');
      });

      signaling.onMessage('chat', message => appendMessage(message.name, message.text));

      // Host only: Listen to waiting room events
      signaling.onMessage('guest-waiting', message => {
        if (!waitingList.find(p => p.id === message.id)) {
          waitingList.push({ id: message.id, name: message.name });
          renderRoster(participants, waitingList);
          showToast(`${message.name} is in the waiting room`, 'info');

          // Auto-open side drawer to Participants tab
          const sidePanel = document.getElementById('meeting-side-panel');
          if (sidePanel) sidePanel.classList.remove('hidden');
          const peopleTab = document.querySelector('.side-panel-tab[data-panel="participants"]');
          if (peopleTab) peopleTab.click();

          // Play pleasant chime
          try {
            const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
            const osc = audioCtx.createOscillator();
            const gain = audioCtx.createGain();
            osc.connect(gain);
            gain.connect(audioCtx.destination);
            osc.type = 'sine';
            osc.frequency.setValueAtTime(587.33, audioCtx.currentTime); // D5
            osc.frequency.exponentialRampToValueAtTime(880, audioCtx.currentTime + 0.15); // A5
            gain.gain.setValueAtTime(0, audioCtx.currentTime);
            gain.gain.linearRampToValueAtTime(0.3, audioCtx.currentTime + 0.05);
            gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.4);
            osc.start(audioCtx.currentTime);
            osc.stop(audioCtx.currentTime + 0.4);
          } catch (e) { }
        }
      });

      signaling.onMessage('guest-left-waiting', message => {
        waitingList = waitingList.filter(p => p.id !== message.id);
        renderRoster(participants, waitingList);
      });

      // Guest only: Waiting room & Kicked events
      signaling.onMessage('waiting', () => {
        if (timerText) timerText.textContent = 'In Waiting Room';
      });

      signaling.onMessage('kicked', (payload) => {
        showToast(payload.reason === 'deny' ? 'The host denied your request to join' : 'You were removed from the meeting by the host', 'error');
        setTimeout(() => document.getElementById('btn-end').click(), 1500);
      });

      // Handle direct remote commands from Host (e.g. Mute All, Disable All Cameras, Individual Mute)
      signaling.onMessage('remote-control', payload => {
        if (isMentor) return; // Do not apply to host

        if (payload.action === 'mute-mic' || payload.action === 'mute-all-mic') {
          if (localStream?.getAudioTracks()[0]?.enabled) {
            toggleMic(localStream);
            document.getElementById('btn-mic')?.classList.add('active');
          }
          showToast(payload.action === 'mute-all-mic' ? 'Host muted all student microphones' : 'Host muted your microphone', 'warning');
        } else if (payload.action === 'disable-cam' || payload.action === 'disable-all-cam') {
          if (localStream?.getVideoTracks()[0]?.enabled) {
            toggleCamera(localStream);
            document.getElementById('btn-cam')?.classList.add('active');
            const localTile = container.querySelector('[data-peer="local"]');
            if (localTile) {
              localTile.classList.add('video-off');
              const localAvatar = localTile.querySelector('.tile-avatar');
              if (localAvatar) localAvatar.style.display = 'flex';
            }
          }
          showToast(payload.action === 'disable-all-cam' ? 'Host turned off all student cameras' : 'Host turned off your camera', 'warning');
        }
      });

      // Real-time Room Settings Sync
      signaling.onMessage('room-settings', settings => {
        const prevSettings = { ...activeRoomSettings };
        activeRoomSettings = { ...activeRoomSettings, ...settings };

        if (isMentor) {
          // Sync Host toggles
          const micToggle = document.getElementById('toggle-host-mic-lock');
          const camToggle = document.getElementById('toggle-host-cam-lock');
          const chatToggle = document.getElementById('toggle-host-chat-lock');
          const screenToggle = document.getElementById('toggle-host-screen-lock');
          const roomToggle = document.getElementById('toggle-host-room-lock');

          if (micToggle && settings.micLocked !== undefined) micToggle.checked = settings.micLocked;
          if (camToggle && settings.cameraLocked !== undefined) camToggle.checked = settings.cameraLocked;
          if (chatToggle && settings.chatLocked !== undefined) chatToggle.checked = settings.chatLocked;
          if (screenToggle && settings.screenLocked !== undefined) screenToggle.checked = settings.screenLocked;
          if (roomToggle && settings.roomLocked !== undefined) roomToggle.checked = settings.roomLocked;
        } else {
          // Student notifications when host changes lock settings
          if (prevSettings.micLocked !== undefined && prevSettings.micLocked !== settings.micLocked) {
            showToast(settings.micLocked ? 'Ã°Å¸â€â€™ Host has locked all student microphones' : 'Ã°Å¸â€â€œ Host has unlocked student microphones. You may unmute.', settings.micLocked ? 'warning' : 'info');
          }
          if (prevSettings.cameraLocked !== undefined && prevSettings.cameraLocked !== settings.cameraLocked) {
            showToast(settings.cameraLocked ? 'Ã°Å¸â€â€™ Host has locked all student cameras' : 'Ã°Å¸â€â€œ Host has unlocked student cameras. You may turn on your camera.', settings.cameraLocked ? 'warning' : 'info');
          }
          if (prevSettings.chatLocked !== undefined && prevSettings.chatLocked !== settings.chatLocked) {
            showToast(settings.chatLocked ? 'Ã°Å¸â€â€™ Host has locked the chat' : 'Ã°Å¸â€â€œ Host has unlocked the chat', settings.chatLocked ? 'warning' : 'info');
          }

          applyStudentLocks(settings);
        }
      });

      // Host Control Center Event Listeners
      if (isMentor) {
        // One-click Broadcast: Mute All Students
        document.getElementById('btn-host-mute-all')?.addEventListener('click', async () => {
          await handleControlAction('ALL', 'mute-all-mic');
          showToast('Broadcasted Mute All command to all students', 'info');
        });

        // One-click Broadcast: Turn Off All Cameras
        document.getElementById('btn-host-disable-cams')?.addEventListener('click', async () => {
          await handleControlAction('ALL', 'disable-all-cam');
          showToast('Broadcasted Turn Off Cameras command to all students', 'info');
        });

        // Toggle: Block All Voices (Mic Lock)
        document.getElementById('toggle-host-mic-lock')?.addEventListener('change', async (e) => {
          const isLocked = e.target.checked;
          await signaling.updateRoomSettings({ micLocked: isLocked });
          if (isLocked) {
            await handleControlAction('ALL', 'mute-all-mic');
          }
          showToast(isLocked ? 'Student microphones locked' : 'Student microphones unlocked ("on")', 'info');
        });

        // Toggle: Block All Videos (Camera Lock)
        document.getElementById('toggle-host-cam-lock')?.addEventListener('change', async (e) => {
          const isLocked = e.target.checked;
          await signaling.updateRoomSettings({ cameraLocked: isLocked });
          if (isLocked) {
            await handleControlAction('ALL', 'disable-all-cam');
          }
          showToast(isLocked ? 'Student cameras locked' : 'Student cameras unlocked ("on")', 'info');
        });

        // Toggle: Block Student Chat (Chat Lock)
        document.getElementById('toggle-host-chat-lock')?.addEventListener('change', async (e) => {
          const isLocked = e.target.checked;
          await signaling.updateRoomSettings({ chatLocked: isLocked });
          showToast(isLocked ? 'Student chat locked' : 'Student chat unlocked ("on")', 'info');
        });

        // Toggle: Block Screen Sharing
        document.getElementById('toggle-host-screen-lock')?.addEventListener('change', async (e) => {
          const isLocked = e.target.checked;
          await signaling.updateRoomSettings({ screenLocked: isLocked });
          showToast(isLocked ? 'Screen sharing locked for students' : 'Screen sharing unlocked', 'info');
        });

        // Toggle: Lock Meeting Room
        document.getElementById('toggle-host-room-lock')?.addEventListener('change', async (e) => {
          const isLocked = e.target.checked;
          await signaling.updateRoomSettings({ roomLocked: isLocked });
          showToast(isLocked ? 'Meeting room is locked to new attendees' : 'Meeting room is unlocked', 'info');
        });
      }

      signaling.onMessage('connect', () => {
        if (timerText) timerText.textContent = '00:00';
        if (timer) clearInterval(timer);
        timer = setInterval(() => {
          elapsed += 1;
          const minutes = String(Math.floor(elapsed / 60)).padStart(2, '0');
          const seconds = String(elapsed % 60).padStart(2, '0');
          if (timerText) timerText.textContent = `${minutes}:${seconds}`;
        }, 1000);
      });

      signaling.onMessage('error', handleError);
      await signaling.connect();

      if (isMentor) {
        await MeetingService.update(meetingId, {
          status: 'ONGOING',
          startedAt: meeting.startedAt || new Date().toISOString()
        });
      }
    } catch (error) {
      handleError(error);
    }
  }

  // Media Control Buttons in Bottom Bar
  document.getElementById('btn-mic').onclick = event => {
    if (!isMentor && activeRoomSettings.micLocked) {
      showToast('Microphone is locked by the meeting host', 'warning');
      return;
    }
    if (localStream) {
      const isEnabled = toggleMic(localStream);
      event.currentTarget.classList.toggle('active', !isEnabled);
    }
  };

  document.getElementById('btn-cam').onclick = event => {
    if (!isMentor && activeRoomSettings.cameraLocked) {
      showToast('Camera is locked by the meeting host', 'warning');
      return;
    }
    if (localStream) {
      const isEnabled = toggleCamera(localStream);
      event.currentTarget.classList.toggle('active', !isEnabled);
      const localTile = container.querySelector('[data-peer="local"]');
      if (localTile) {
        localTile.classList.toggle('video-off', !isEnabled);
        const localAvatar = localTile.querySelector('.tile-avatar');
        if (localAvatar) localAvatar.style.display = isEnabled ? 'none' : 'flex';
      }
    }
  };

  document.getElementById('btn-screen').onclick = async event => {
    if (!isMentor && activeRoomSettings.screenLocked) {
      showToast('Screen sharing is locked by the meeting host', 'warning');
      return;
    }
    try {
      if (screenStream) {
        stopScreenShare(screenStream);
        screenStream = null;
        const camera = localStream?.getVideoTracks()[0] || null;
        await Promise.all([...peers.values()].map(peer => peer.replaceVideoTrack(camera)));
        addVideo('local', `${user.name} (You)`, localStream, true, isMentor);
        event.currentTarget.classList.remove('active');
        return;
      }
      screenStream = await shareScreen();
      const track = screenStream.getVideoTracks()[0];
      await Promise.all([...peers.values()].map(peer => peer.replaceVideoTrack(track)));
      addVideo('local', `${user.name} (Screen)`, screenStream, true, isMentor);
      event.currentTarget.classList.add('active');
      track.onended = () => document.getElementById('btn-screen').click();
    } catch (error) {
      showToast('Screen sharing cancelled', 'warning');
    }
  };

  // Recording Logic (Host Mentor Only)
  let mediaRecorder = null;
  let recordedChunks = [];
  let recordStream = null;
  const btnRecord = document.getElementById('btn-record');
  if (btnRecord) {
    btnRecord.onclick = async () => {
      if (mediaRecorder && mediaRecorder.state !== 'inactive') {
        mediaRecorder.stop();
        btnRecord.classList.remove('active');
        const label = document.getElementById('label-record');
        if (label) label.textContent = 'Record';
        return;
      }

      try {
        recordStream = await navigator.mediaDevices.getDisplayMedia({
          video: { displaySurface: 'browser' },
          audio: true
        });

        const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        const dest = audioCtx.createMediaStreamDestination();
        if (recordStream.getAudioTracks().length > 0) {
          audioCtx.createMediaStreamSource(new MediaStream([recordStream.getAudioTracks()[0]])).connect(dest);
        }
        if (localStream && localStream.getAudioTracks().length > 0) {
          audioCtx.createMediaStreamSource(new MediaStream([localStream.getAudioTracks()[0]])).connect(dest);
        }
        const mixedStream = new MediaStream([
          ...recordStream.getVideoTracks(),
          ...dest.stream.getAudioTracks()
        ]);

        const options = { mimeType: 'video/webm; codecs=vp8,opus', videoBitsPerSecond: 2500000 };
        try {
          mediaRecorder = new MediaRecorder(mixedStream, options);
        } catch (e) {
          mediaRecorder = new MediaRecorder(mixedStream, { videoBitsPerSecond: 2500000 });
        }

        recordedChunks = [];
        mediaRecorder.ondataavailable = e => {
          if (e.data.size > 0) recordedChunks.push(e.data);
        };

        mediaRecorder.onstop = () => {
          const blob = new Blob(recordedChunks, { type: 'video/webm' });
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          document.body.appendChild(a);
          a.style.display = 'none';
          a.href = url;
          a.download = `meeting_recording_${new Date().toISOString().slice(0, 10)}.webm`;
          a.click();
          URL.revokeObjectURL(url);
          recordStream.getTracks().forEach(t => t.stop());

          btnRecord.classList.remove('active');
          const label = document.getElementById('label-record');
          if (label) label.textContent = 'Record';
          showToast('Recording downloaded locally', 'success');
        };

        recordStream.getVideoTracks()[0].onended = () => {
          if (mediaRecorder.state !== 'inactive') mediaRecorder.stop();
        };

        mediaRecorder.start(1000);
        btnRecord.classList.add('active');
        const label = document.getElementById('label-record');
        if (label) label.textContent = 'Stop';
        showToast('Recording started', 'info');
      } catch (err) {
        console.error(err);
        showToast('Recording cancelled', 'warning');
      }
    };
  }

  // Side Panel Toggle & Tabs
  const sidePanel = document.getElementById('meeting-side-panel');
  const sidePanelTitle = document.getElementById('side-panel-title');

  function openPanelTab(panelName) {
    if (!sidePanel) return;
    sidePanel.classList.remove('hidden');
    document.querySelectorAll('.side-panel-tab').forEach(item => {
      item.classList.toggle('active', item.dataset.panel === panelName);
    });
    ['chat', 'participants', 'controls', 'notes', 'report'].forEach(name => {
      const panel = document.getElementById(`panel-${name}`);
      if (panel) panel.hidden = panelName !== name;
    });
    const chatForm = document.getElementById('chat-form');
    if (chatForm) chatForm.hidden = panelName !== 'chat';

    if (sidePanelTitle) {
      const titles = { chat: 'Meeting Chat', participants: 'People in Call', controls: 'Host Control Center', notes: 'Session Notes', report: 'Report Generation' };
      sidePanelTitle.textContent = titles[panelName] || 'Meeting Panel';
    }
  }

  document.getElementById('btn-toggle-chat')?.addEventListener('click', () => {
    if (!sidePanel.classList.contains('hidden') && document.querySelector('.side-panel-tab.active')?.dataset.panel === 'chat') {
      sidePanel.classList.add('hidden');
    } else {
      openPanelTab('chat');
    }
  });

  document.getElementById('btn-toggle-people')?.addEventListener('click', () => {
    if (!sidePanel.classList.contains('hidden') && document.querySelector('.side-panel-tab.active')?.dataset.panel === 'participants') {
      sidePanel.classList.add('hidden');
    } else {
      openPanelTab('participants');
    }
  });

  document.getElementById('btn-toggle-controls')?.addEventListener('click', () => {
    if (!sidePanel.classList.contains('hidden') && document.querySelector('.side-panel-tab.active')?.dataset.panel === 'controls') {
      sidePanel.classList.add('hidden');
    } else {
      openPanelTab('controls');
    }
  });

  document.getElementById('btn-close-side-panel')?.addEventListener('click', () => {
    sidePanel.classList.add('hidden');
  });

  document.querySelectorAll('.side-panel-tab').forEach(button => {
    button.onclick = () => openPanelTab(button.dataset.panel);
  });

  // Chat form submission
  document.getElementById('chat-form').onsubmit = event => {
    event.preventDefault();
    if (!isMentor && activeRoomSettings.chatLocked) {
      showToast('Chat is currently locked by the host', 'warning');
      return;
    }
    const input = document.getElementById('chat-input');
    const text = input.value.trim();
    if (text && signaling.sendChat(text)) {
      appendMessage('You', text, true);
      input.value = '';
    }
  };

  // Copy invite link
  document.getElementById('copy-room-link').onclick = async () => {
    try {
      await navigator.clipboard.writeText(location.href);
      showToast('Meeting invite link copied to clipboard', 'success');
    } catch (e) {
      showToast('Failed to copy link', 'error');
    }
  };

  // Save session notes
  document.getElementById('save-meeting-notes')?.addEventListener('click', async () => {
    try {
      const summary = document.getElementById('meeting-notes').value.trim();
      await MeetingService.update(meetingId, { notes: { ...(meeting.notes || {}), summary } });
      showToast('Session notes saved securely', 'success');
    } catch (e) {
      showToast('Failed to save notes: ' + e.message, 'error');
    }
  });

  // Add student row button
  document.getElementById('btn-add-student')?.addEventListener('click', () => {
    const list = document.getElementById('rpt-students-list');
    if (!list) return;
    const row = document.createElement('div');
    row.className = 'rpt-student-row';
    row.innerHTML = `
            <input class="report-input rpt-sname" type="text" placeholder="Student Name" style="flex:1.4">
            <input class="report-input rpt-senroll" type="text" placeholder="Enrollment No." style="flex:1">
            <button class="btn-rpt-remove" onclick="this.closest('.rpt-student-row').remove()" title="Remove">✕</button>
        `;
    list.appendChild(row);
  });

  // Save meeting report
  document.getElementById('btn-save-report')?.addEventListener('click', async () => {
    try {
      const studentRows = [...document.querySelectorAll('.rpt-student-row')].map(row => ({
        name: row.querySelector('.rpt-sname')?.value.trim(),
        enrollment: row.querySelector('.rpt-senroll')?.value.trim()
      })).filter(s => s.name || s.enrollment);

      const reportData = {
        topic: document.getElementById('rpt-topic')?.value.trim(),
        date: document.getElementById('rpt-date')?.value,
        time: document.getElementById('rpt-time')?.value,
        students: studentRows,
        issuesDiscussed: document.getElementById('rpt-issues')?.value.trim(),
        actionItems: document.getElementById('rpt-actions')?.value.trim(),
        remarks: document.getElementById('rpt-remarks')?.value.trim(),
        department: document.getElementById('rpt-dept')?.value.trim(),
        preparedBy: meeting.mentorName || user.name,
        checkedBy: document.getElementById('rpt-checker-name')?.value.trim() || '',
        verifiedBy: 'Dr. Nilesh Thale, Dr. Aman Singh',
        hodName: document.getElementById('rpt-hod-name')?.value.trim() || '',
        savedAt: new Date().toISOString()
      };
      await MeetingService.update(meetingId, { report: reportData });
      showToast('Report data saved successfully!', 'success');
    } catch (e) {
      showToast('Failed to save report: ' + e.message, 'error');
    }
  });

  // Generate & Print meeting report — Professional B&W layout
  document.getElementById('btn-generate-report')?.addEventListener('click', () => {
    const topic = document.getElementById('rpt-topic')?.value.trim() || 'Mentorship Session';
    const date = document.getElementById('rpt-date')?.value || new Date().toISOString().slice(0, 10);
    const time = document.getElementById('rpt-time')?.value || '';
    const issues = document.getElementById('rpt-issues')?.value.trim() || 'No issues reported.';
    const actions = document.getElementById('rpt-actions')?.value.trim() || 'No action items.';
    const remarks = document.getElementById('rpt-remarks')?.value.trim() || '';
    const dept = document.getElementById('rpt-dept')?.value.trim() || 'School of Computing';
    const preparedBy = meeting.mentorName || user.name || '';
    const checkedBy = document.getElementById('rpt-checker-name')?.value.trim() || '';
    const hodName = document.getElementById('rpt-hod-name')?.value.trim() || '';

    // Collect student rows
    const studentRows = [...document.querySelectorAll('.rpt-student-row')].map(row => ({
      name: row.querySelector('.rpt-sname')?.value.trim() || '',
      enrollment: row.querySelector('.rpt-senroll')?.value.trim() || ''
    })).filter(s => s.name || s.enrollment);

    const formatDate = (d) => {
      if (!d) return '';
      const dt = new Date(d + 'T00:00:00');
      return dt.toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' });
    };

    const totalStudents = studentRows.length;

    // Absolute URL for the header banner image (same origin, works in popup)
    const bannerUrl = window.location.origin + '/assets/images/mit_adt_header_banner.jpg';

    // Build student attendance rows for page 2
    const attendanceRows = studentRows.map((s, i) => `
          <tr>
            <td style="text-align:center;">${i + 1}</td>
            <td>${escapeHtml(s.name)}</td>
            <td style="text-align:center;">${escapeHtml(s.enrollment)}</td>
            <td></td>
          </tr>
        `).join('');

    const reportWin = window.open('', '_blank', 'width=900,height=1200');
    if (!reportWin) { showToast('Please allow pop-ups to generate the report', 'warning'); return; }

    reportWin.document.write(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Mentorship Session Report - ${topic}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Times New Roman', Times, serif; background: #fff; color: #000; font-size: 11pt; }
    .page { width: 210mm; min-height: 297mm; margin: 0 auto; padding: 14mm 18mm 12mm 18mm; }
    .page-break { page-break-before: always; }

    /* ---- HEADER ---- */
    .rpt-header { margin-bottom: 0; }
    .rpt-banner { width: 100%; display: block; border-bottom: 2px solid #888; }
    .rpt-divider { height: 1.5px; background: #000; margin: 4px 0 12px 0; }

    /* ---- TITLE ---- */
    .rpt-title { text-align: center; margin-bottom: 12px; }
    .rpt-title h1 { font-size: 12.5pt; font-weight: 700; text-transform: uppercase; letter-spacing: 0.8px; border: 1.5px solid #000; display: inline-block; padding: 4px 20px; }
    .rpt-title .sub { font-size: 8.5pt; color: #444; margin-top: 4px; }

    /* ---- INFO TABLE ---- */
    .info-table { width: 100%; border-collapse: collapse; margin-bottom: 12px; font-size: 10pt; }
    .info-table td { padding: 5px 8px; vertical-align: top; border: 1px solid #aaa; }
    .info-table td:first-child { font-weight: 700; width: 32%; background: #f2f2f2; }

    /* ---- SECTIONS ---- */
    .section { margin-bottom: 10px; }
    .section-head { border: 1.5px solid #000; border-bottom: none; padding: 4px 8px; font-size: 10pt; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; background: #f2f2f2; }
    .section-body { border: 1.5px solid #000; padding: 8px 10px; min-height: 52px; font-size: 10pt; line-height: 1.7; white-space: pre-wrap; }

    /* ---- SIGNATURE BLOCK (4-Column) ---- */
    .sig-block { margin-top: 22px; border-top: 2px solid #000; padding-top: 12px; }
    .sig-block-title { text-align: center; font-size: 9.5pt; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 18px; }
    .sig-row { display: flex; justify-content: space-between; gap: 10px; }
    .sig-col { flex: 1; text-align: center; }
    .sig-space { height: 44px; border-bottom: 1px solid #000; margin-bottom: 6px; position: relative; }
    .sig-space::after { content: '(Signature)'; position: absolute; bottom: 2px; left: 50%; transform: translateX(-50%); font-size: 6.5pt; color: #777; font-style: italic; }
    .sig-label { font-size: 7.5pt; font-weight: 700; text-transform: uppercase; letter-spacing: 0.4px; margin-bottom: 4px; }
    .sig-name { font-size: 9pt; font-weight: 700; border-bottom: 1px dotted #555; min-height: 16px; padding-bottom: 2px; display: inline-block; min-width: 80%; }
    .sig-role { font-size: 7pt; color: #444; margin-top: 3px; }

    /* ---- ATTENDANCE TABLE (page 2) ---- */
    .att-title { text-align: center; margin-bottom: 12px; margin-top: 4px; }
    .att-title h2 { font-size: 12.5pt; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; border: 1.5px solid #000; display: inline-block; padding: 4px 20px; }
    .att-title .sub { font-size: 8.5pt; color: #444; margin-top: 4px; }
    .att-meta { font-size: 9.5pt; margin-bottom: 12px; border: 1px solid #aaa; padding: 6px 10px; background: #f9f9f9; }
    .att-meta span { font-weight: 700; }
    .att-table { width: 100%; border-collapse: collapse; font-size: 10pt; }
    .att-table th { background: #f2f2f2; border: 1.5px solid #000; padding: 6px 8px; text-align: left; font-weight: 700; text-transform: uppercase; font-size: 9pt; letter-spacing: 0.3px; }
    .att-table th:nth-child(1) { width: 8%; text-align: center; }
    .att-table th:nth-child(3) { width: 28%; text-align: center; }
    .att-table th:nth-child(4) { width: 24%; text-align: center; }
    .att-table td { border: 1px solid #aaa; padding: 6px 8px; vertical-align: middle; }
    .att-table td:nth-child(1) { text-align: center; }
    .att-table td:nth-child(3) { text-align: center; }
    .att-table td:nth-child(4) { text-align: center; }
    .att-table tr:nth-child(even) td { background: #fafafa; }

    /* ---- FOOTER ---- */
    .rpt-footer { margin-top: 16px; border-top: 1px solid #aaa; padding-top: 6px; text-align: center; font-size: 7.5pt; color: #666; }

    @media print {
      .page { padding: 10mm 14mm; }
      .no-print { display: none !important; }
      .page-break { page-break-before: always; }
    }
  </style>
</head>
<body>

  <!-- ===== PAGE 1: Main Report ===== -->
  <div class="page">
    <div class="rpt-header">
      <img src="${bannerUrl}" alt="MIT-ADT University Header" class="rpt-banner">
    </div>
    <div class="rpt-divider"></div>

    <div class="rpt-title">
      <h1>Mentorship Session Report</h1>
      <div class="sub">Official Record of Mentor-Mentee Interaction</div>
    </div>

    <table class="info-table">
      <tr><td>Meeting Topic / Agenda</td><td>${escapeHtml(topic)}</td></tr>
      <tr><td>Date of Meeting</td><td>${escapeHtml(formatDate(date))}</td></tr>
      <tr><td>Time of Meeting</td><td>${escapeHtml(time)}</td></tr>
      <tr><td>Department</td><td>${escapeHtml(dept)}</td></tr>
      <tr><td>Mentor / Faculty</td><td>Prof. ${escapeHtml(preparedBy)}</td></tr>
      <tr><td>Total Students Present</td><td>${totalStudents} student${totalStudents !== 1 ? 's' : ''} &nbsp;<em style="font-size:8.5pt;color:#555;">(Attendance list on Page 2)</em></td></tr>
    </table>

    <div class="section">
      <div class="section-head">Issues Discussed</div>
      <div class="section-body">${escapeHtml(issues)}</div>
    </div>

    <div class="section">
      <div class="section-head">Action Items &amp; Resolutions</div>
      <div class="section-body">${escapeHtml(actions)}</div>
    </div>

    ${remarks ? `<div class="section"><div class="section-head">Additional Remarks</div><div class="section-body">${escapeHtml(remarks)}</div></div>` : ''}

    <div class="sig-block">
      <div class="sig-block-title">Signatures &amp; Authorization</div>
      <div class="sig-row">
        <div class="sig-col">
          <div class="sig-space"></div>
          <div class="sig-label">Prepared By</div>
          <div><span class="sig-name">Prof. ${escapeHtml(preparedBy)}</span></div>
          <div class="sig-role">Mentor / Faculty</div>
        </div>
        <div class="sig-col">
          <div class="sig-space"></div>
          <div class="sig-label">Checked By</div>
          <div><span class="sig-name">${checkedBy ? escapeHtml(checkedBy) : 'Prof. _________________'}</span></div>
          <div class="sig-role">Coordinator / Faculty</div>
        </div>
        <div class="sig-col">
          <div class="sig-space"></div>
          <div class="sig-label">Verify By</div>
          <div>
            <div style="font-size:9pt; font-weight:700;">Dr. Nilesh Thale</div>
            <div style="font-size:9pt; font-weight:700; margin-top:2px;">Dr. Aman Singh</div>
          </div>
          <div class="sig-role">Verification Committee</div>
        </div>
        <div class="sig-col">
          <div class="sig-space"></div>
          <div class="sig-label">Approved By (HOD)</div>
          <div><span class="sig-name">${escapeHtml(hodName || 'Dr. _________________')}</span></div>
          <div class="sig-role">Head of Department, ${escapeHtml(dept)}</div>
        </div>
      </div>
    </div>

    <div class="rpt-footer">This is an official document of MIT Art, Design &amp; Technology University, Pune &bull; Generated on ${new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' })} &bull; Page 1 of 2</div>
  </div>

  <!-- ===== PAGE 2: Attendance List ===== -->
  <div class="page page-break">
    <div class="rpt-header">
      <img src="${bannerUrl}" alt="MIT-ADT University Header" class="rpt-banner">
    </div>
    <div class="rpt-divider"></div>

    <div class="att-title">
      <h2>Student Attendance Sheet</h2>
      <div class="sub">Annexure to Mentorship Session Report</div>
    </div>

    <div class="att-meta">
      <span>Meeting Topic:</span> ${escapeHtml(topic)} &emsp;
      <span>Date:</span> ${escapeHtml(formatDate(date))} &emsp;
      <span>Mentor:</span> Prof. ${escapeHtml(preparedBy)}
    </div>

    <table class="att-table">
      <thead>
        <tr>
          <th>Sr. No.</th>
          <th>Student Name</th>
          <th>Enrollment No.</th>
          <th>Signature</th>
        </tr>
      </thead>
      <tbody>
        ${attendanceRows || '<tr><td colspan="4" style="text-align:center;padding:20px;color:#777;">No students added</td></tr>'}
      </tbody>
    </table>

    <div class="sig-block" style="margin-top:24px;">
      <div class="sig-block-title">Signatures &amp; Authorization</div>
      <div class="sig-row">
        <div class="sig-col">
          <div class="sig-space"></div>
          <div class="sig-label">Prepared By</div>
          <div><span class="sig-name">Prof. ${escapeHtml(preparedBy)}</span></div>
          <div class="sig-role">Mentor / Faculty</div>
        </div>
        <div class="sig-col">
          <div class="sig-space"></div>
          <div class="sig-label">Checked By</div>
          <div><span class="sig-name">${checkedBy ? escapeHtml(checkedBy) : 'Prof. _________________'}</span></div>
          <div class="sig-role">Coordinator / Faculty</div>
        </div>
        <div class="sig-col">
          <div class="sig-space"></div>
          <div class="sig-label">Verify By</div>
          <div>
            <div style="font-size:9pt; font-weight:700;">Dr. Nilesh Thale</div>
            <div style="font-size:9pt; font-weight:700; margin-top:2px;">Dr. Aman Singh</div>
          </div>
          <div class="sig-role">Verification Committee</div>
        </div>
        <div class="sig-col">
          <div class="sig-space"></div>
          <div class="sig-label">Approved By (HOD)</div>
          <div><span class="sig-name">${escapeHtml(hodName || 'Dr. _________________')}</span></div>
          <div class="sig-role">Head of Department, ${escapeHtml(dept)}</div>
        </div>
      </div>
    </div>

    <div class="rpt-footer">This is an official document of MIT Art, Design &amp; Technology University, Pune &bull; Generated on ${new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' })} &bull; Page 2 of 2</div>
  </div>

  <div class="no-print" style="text-align:center; margin: 18px 0; font-family: Arial, sans-serif;">
    <button onclick="window.print()" style="padding:10px 32px; font-size:14px; background:#111; color:#fff; border:none; border-radius:6px; cursor:pointer; font-weight:700;">🖨️ Print / Save as PDF</button>
    <button onclick="window.close()" style="margin-left:12px; padding:10px 24px; font-size:14px; background:#888; color:#fff; border:none; border-radius:6px; cursor:pointer;">Close</button>
  </div>
</body>
</html>`);
    reportWin.document.close();
    setTimeout(() => reportWin.focus(), 300);
    showToast('Report generated! Use Print → Save as PDF to download.', 'success');
  });

  // Clean up connections
  async function cleanup() {
    if (cleaned) return;
    cleaned = true;
    clearInterval(timer);
    if (mediaRecorder && mediaRecorder.state !== 'inactive') {
      mediaRecorder.stop();
    }
    localStream?.getTracks().forEach(track => track.stop());
    stopScreenShare(screenStream);
    peers.forEach(peer => peer.close());
    signaling.disconnect();
  }

  // Leave / End Call button
  document.getElementById('btn-end').onclick = async () => {
    if (isMentor) {
      const endForAll = confirm("Do you want to end this meeting for EVERYONE?\n\nÃ¢â‚¬Â¢ Click OK to End for Everyone\nÃ¢â‚¬Â¢ Click Cancel to Leave without ending for others");
      if (endForAll) {
        try {
          await MeetingService.update(meetingId, {
            status: 'COMPLETED',
            endedAt: new Date().toISOString()
          });
        } catch (e) {
          console.warn('Meeting status sync warning:', e);
        }
      }
    }
    await cleanup();
    navigateTo(String(user.role).toUpperCase() === 'STUDENT' ? '/student/meetings' : '/mentor/meetings');
  };

  window.addEventListener('hashchange', cleanup, { once: true });

  // Pre-join camera and mic preview
  try {
    localStream = await getLocalStream();
    const previewVideo = document.getElementById('preview-video');
    if (previewVideo) previewVideo.srcObject = localStream;

    document.getElementById('preview-mic').onclick = event => {
      const isEnabled = toggleMic(localStream);
      event.currentTarget.classList.toggle('muted', !isEnabled);
      const mainMic = document.getElementById('btn-mic');
      if (mainMic) mainMic.classList.toggle('active', !isEnabled);
    };

    document.getElementById('preview-cam').onclick = event => {
      const isEnabled = toggleCamera(localStream);
      event.currentTarget.classList.toggle('muted', !isEnabled);
      const mainCam = document.getElementById('btn-cam');
      if (mainCam) mainCam.classList.toggle('active', !isEnabled);
    };
  } catch (e) {
    console.warn('Could not initialize preview:', e);
  }

  // Enter meeting room on join click
  document.getElementById('btn-join-meeting').onclick = () => {
    document.getElementById('join-screen')?.remove();
    const waiting = document.getElementById('meeting-waiting');
    if (waiting && !isMentor) waiting.hidden = false;
    init();
  };
}
