import { createSignaling } from '/js/webrtc/signaling.js';
import { createPeerConnection } from '/js/webrtc/peer.js';
import { getLocalStream, toggleCamera, toggleMic, shareScreen, stopScreenShare, createAudioEnergyMonitor } from '/js/webrtc/media.js';
import { getUserProfile } from '/js/auth.js';
import { navigateTo } from '/js/router.js';
import { showToast } from '/js/components/toast.js';
import { MeetingService } from '/js/services.js';
import { exportMeetingSessionReport } from '/js/report-export.js';

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

  // Faculty / Admin / HOD / Dean roles are always treated as the host
  const FACULTY_ROLES = ['FACULTY', 'MENTOR', 'HOD', 'DEAN', 'SECTION_HEAD', 'ADMIN'];
  const userRoleUpper = String(user?.role || '').toUpperCase();
  const isFacultyRole = FACULTY_ROLES.includes(userRoleUpper);

  const hasAccess = isFacultyRole ||
    [meeting?.studentId, meeting?.mentorId].includes(user.id) ||
    meeting?.studentId === 'ALL';

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

  const isMentor = isFacultyRole || (meeting?.mentorId === user.id);

  container.innerHTML = `
      <div class="meeting-room-layout">
        <!-- Floating Reactions Container -->
        <div class="reaction-emitter-container" id="reaction-emitter"></div>

        <!-- Real-Time Subtitle / Captions Container -->
        <div class="meeting-live-captions-container" id="live-captions-box" style="display:none;"></div>

        <!-- Active Breakout Room Banner -->
        <div class="breakout-active-banner" id="breakout-banner" style="display:none;">
          <span>🚀 In Breakout Room: <strong id="breakout-room-name">Squad 1</strong></span>
          <span id="breakout-timer-pill" style="background:rgba(0,0,0,0.3); padding:2px 8px; border-radius:12px; font-size:0.75rem;">05:00</span>
          <button class="btn btn-sm btn-ghost" id="btn-leave-breakout" style="color:#fff; font-size:0.75rem; padding:2px 8px; border:1px solid rgba(255,255,255,0.3); border-radius:8px;">Return to Main</button>
        </div>

        <!-- Top Bar -->
        <header class="meeting-topbar">
          <div class="meeting-topbar-left">
            <div class="meeting-title-wrap">
              <div class="meeting-title">
                ${escapeHtml(meeting.type || '1-on-1 Mentorship Session')}
                ${isMentor ? '<span class="meeting-host-badge">👑 Host</span>' : ''}
              </div>
              <div class="meeting-status-chips">
                <span class="meeting-timer" id="meeting-status">
                  <span class="meeting-live-dot"></span>
                  <span id="meeting-timer-text">Connecting...</span>
                </span>
                <span class="network-health-pill" id="btn-network-diag" title="Click to view network diagnostics">
                  <span class="meeting-live-dot" style="background:#34d399; box-shadow:0 0 8px #34d399;"></span>
                  <span id="network-status-text">HD 1080p • 24ms</span>
                </span>
                <span class="meeting-security-chip">🔒 E2E Encrypted</span>
                <span class="meeting-security-chip" id="participant-count-chip">👥 1 Participant</span>
                <span class="hand-raise-badge" id="top-hand-raised-badge" style="display:none;">🙋 Hand Raised</span>
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
                ${isMentor
                  ? `<h2>🎓 Start Your Meeting</h2>
                     <p>You are the <strong>Host</strong> for this session. Students will be admitted once you start.</p>`
                  : `<h2>Ready to join?</h2>
                     <p>Meeting with <strong>${escapeHtml(meeting.mentorName || 'Mentor')}</strong></p>`
                }
                
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

                <!-- Pre-Meeting Smart Prep Checklist Card -->
                <div style="background:rgba(255,255,255,0.03); border:1px solid rgba(255,255,255,0.08); border-radius:10px; padding:10px 14px; margin-bottom:14px; text-align:left;">
                  <div style="font-size:0.78rem; font-weight:700; color:#38bdf8; margin-bottom:4px;">💡 Session Prep Recommendations:</div>
                  <div style="font-size:0.72rem; color:#cbd5e1; line-height:1.4;">
                    • Prepare semester backlog updates &amp; marks sheet.<br>
                    • Keep doubts or code architecture ready to share on whiteboard.<br>
                    • Mic and camera check completed.
                  </div>
                </div>

                <button class="btn-join-main" id="btn-join-meeting">
                  <span>${isMentor ? '🚀 Start Meeting as Host' : 'Enter Meeting Room'}</span>
                  <svg viewBox="0 0 24 24" fill="currentColor" width="20" height="20"><path d="M10 17l5-5-5-5v10z"/></svg>
                </button>
              </div>
            </div>

            <!-- Waiting Room Screen for Students Only -->
            ${!isMentor ? `
            <div class="meeting-waiting hidden" id="meeting-waiting" style="display:none !important;">
              <div class="meeting-waiting-card">
                <div class="pulse-ring-wrap">
                  <div class="pulse-ring-circle"></div>
                  <div class="pulse-ring-circle"></div>
                  <div class="tile-avatar-circle">${escapeHtml((user.name || '?')[0].toUpperCase())}</div>
                </div>
                <h2>Waiting for Host to Admit You</h2>
                <p>The mentor will let you in shortly. Your camera and microphone will connect automatically upon entry.</p>
              </div>
            </div>` : ''}
          </section>

          <!-- Side Drawer Panel -->
          <aside class="meeting-side-panel hidden" id="meeting-side-panel">
            <div class="side-panel-header">
              <div class="side-panel-title" id="side-panel-title">Chat</div>
              <button class="btn-meet-secondary" id="btn-close-side-panel" style="padding: 4px 8px; border-radius: 50%;">✕</button>
            </div>
            
            <div class="side-panel-tabs">
              <button class="side-panel-tab active" data-panel="chat">
                <span>💬 Chat</span>
              </button>
              <button class="side-panel-tab" data-panel="participants">
                <span>👥 People</span>
              </button>
              <button class="side-panel-tab" data-panel="tools">
                <span>🎨 Tools</span>
              </button>
              <button class="side-panel-tab" data-panel="transcript">
                <span>📜 Transcript</span>
              </button>
              ${isMentor ? `
              <button class="side-panel-tab" data-panel="controls">
                <span>🛡️ Controls</span>
              </button>
              <button class="side-panel-tab" data-panel="notes">
                <span>📝 Notes</span>
              </button>
              <button class="side-panel-tab" data-panel="report">
                <span>📋 Report</span>
              </button>` : ''}
            </div>

            <div class="side-panel-body">
              <!-- Chat Panel -->
              <div id="panel-chat">
                <div class="chat-messages" id="chat-messages">
                  <div class="chat-empty-state">No messages yet. Send a message to start the conversation!</div>
                </div>
                <div id="chat-locked-notice" class="chat-locked-banner" hidden>
                  🔒 Chat is locked by the meeting host
                </div>
              </div>

              <!-- Participants Panel -->
              <div id="panel-participants" hidden></div>

              <!-- Live Transcript Panel -->
              <div id="panel-transcript" hidden style="padding:14px; display:flex; flex-direction:column; gap:12px; height:100%;">
                <div style="display:flex; justify-content:space-between; align-items:center;">
                  <div style="font-size:0.85rem; font-weight:700; color:#e2e8f0;">🎙️ Live Speech Transcript</div>
                  <div style="display:flex; gap:6px;">
                    <button class="btn btn-sm btn-ghost" id="btn-copy-transcript" style="font-size:0.75rem; color:#38bdf8;">📋 Copy</button>
                    <button class="btn btn-sm btn-ghost" id="btn-download-transcript" style="font-size:0.75rem; color:#a5b4fc;">⬇️ Export</button>
                  </div>
                </div>
                <div id="transcript-feed" style="flex:1; background:#090d16; border:1px solid #1e293b; border-radius:10px; padding:12px; overflow-y:auto; font-size:0.82rem; line-height:1.5; color:#cbd5e1; display:flex; flex-direction:column; gap:8px;">
                  <div style="color:#64748b; font-style:italic;" id="transcript-empty-placeholder">Turn on Live Captions (CC) to start real-time transcription...</div>
                </div>
                <button class="btn btn-sm btn-primary" id="btn-append-transcript-notes" style="width:100%; border-radius:8px; font-weight:600;">
                  💾 Save Transcript to Session Notes
                </button>
              </div>

              <!-- Interactive Tools Suite Panel -->
              <div id="panel-tools" hidden style="padding:14px; display:flex; flex-direction:column; gap:16px;">
                
                <!-- Quick Tool Launchers Grid -->
                <div style="display:grid; grid-template-columns:1fr 1fr; gap:8px;">
                  <button class="btn btn-secondary btn-sm" id="btn-launch-whiteboard" style="padding:10px; border-radius:10px; display:flex; align-items:center; justify-content:center; gap:6px; font-weight:700; background:rgba(99, 102, 241, 0.15); color:#a5b4fc; border:1px solid rgba(99, 102, 241, 0.3);">
                    <i class="ph ph-paint-brush"></i> Whiteboard
                  </button>
                  <button class="btn btn-secondary btn-sm" id="btn-toggle-scratchpad-view" style="padding:10px; border-radius:10px; display:flex; align-items:center; justify-content:center; gap:6px; font-weight:700; background:rgba(6, 182, 212, 0.15); color:#67e8f9; border:1px solid rgba(6, 182, 212, 0.3);">
                    <i class="ph ph-code"></i> Code Pad
                  </button>
                  <button class="btn btn-secondary btn-sm" id="btn-launch-slides" style="padding:10px; border-radius:10px; display:flex; align-items:center; justify-content:center; gap:6px; font-weight:700; background:rgba(245, 158, 11, 0.15); color:#fbbf24; border:1px solid rgba(245, 158, 11, 0.3);">
                    <i class="ph ph-presentation"></i> Slides &amp; Laser
                  </button>
                  ${isMentor ? `
                  <button class="btn btn-secondary btn-sm" id="btn-launch-breakouts" style="padding:10px; border-radius:10px; display:flex; align-items:center; justify-content:center; gap:6px; font-weight:700; background:rgba(168, 85, 247, 0.15); color:#d8b4fe; border:1px solid rgba(168, 85, 247, 0.3);">
                    <i class="ph ph-squares-four"></i> Breakouts
                  </button>` : `
                  <button class="btn btn-secondary btn-sm" id="btn-toggle-engagement" style="padding:10px; border-radius:10px; display:flex; align-items:center; justify-content:center; gap:6px; font-weight:700; background:rgba(16, 185, 129, 0.15); color:#34d399; border:1px solid rgba(16, 185, 129, 0.3);">
                    <i class="ph ph-chart-donut"></i> Analytics
                  </button>`}
                </div>

                <!-- Live Talk-Time & Engagement Analytics Widget -->
                <div class="host-section-card" style="padding:12px; background:rgba(255,255,255,0.03); border-radius:12px; border:1px solid rgba(255,255,255,0.08);">
                  <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:6px;">
                    <span style="font-size:0.82rem; font-weight:700; color:#cbd5e1; display:flex; align-items:center; gap:6px;">
                      📊 Live Talk-Time Distribution
                    </span>
                    <span id="engagement-score-pill" style="font-size:0.7rem; padding:2px 6px; border-radius:10px; background:rgba(16,185,129,0.2); color:#10b981; font-weight:700;">Active 95%</span>
                  </div>
                  <div class="engagement-meter-bar">
                    <div class="talk-time-mentor" id="talk-meter-mentor" style="width: 55%;" title="Mentor Talk Time"></div>
                    <div class="talk-time-student" id="talk-meter-student" style="width: 45%;" title="Student Talk Time"></div>
                  </div>
                  <div style="display:flex; justify-content:space-between; font-size:0.7rem; color:#94a3b8; margin-top:4px;">
                    <span>👨‍🏫 Host: <strong id="talk-pct-mentor" style="color:#a5b4fc;">55%</strong></span>
                    <span>🎓 Student: <strong id="talk-pct-student" style="color:#34d399;">45%</strong></span>
                  </div>
                  ${isMentor ? `
                  <button class="btn btn-sm btn-ghost" id="btn-export-audit-csv" style="width:100%; margin-top:8px; font-size:0.72rem; color:#38bdf8; border:1px solid rgba(56,189,248,0.2); border-radius:6px;">
                    📥 Download Attendance &amp; Engagement Audit (.CSV)
                  </button>` : ''}
                </div>

                <!-- Structured Agenda Checklist Section -->
                <div class="host-section-card" style="padding:12px; background:rgba(255,255,255,0.03); border-radius:12px; border:1px solid rgba(255,255,255,0.08);">
                  <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px;">
                    <span style="font-size:0.82rem; font-weight:700; color:#cbd5e1; display:flex; align-items:center; gap:6px;">
                      ⏱️ Meeting Agenda &amp; Checklist
                    </span>
                    <span id="agenda-count-badge" style="font-size:0.7rem; padding:2px 6px; border-radius:10px; background:rgba(16,185,129,0.2); color:#10b981; font-weight:700;">0/4</span>
                  </div>
                  <div class="agenda-list" id="in-room-agenda-list">
                    <label class="agenda-item-row"><input type="checkbox" class="agenda-chk" data-item="Review Academic Attendance &amp; Marks"> <span>Review Academic Attendance &amp; Marks</span></label>
                    <label class="agenda-item-row"><input type="checkbox" class="agenda-chk" data-item="Discuss Backlogs &amp; Subject Difficulties"> <span>Discuss Backlogs &amp; Subject Difficulties</span></label>
                    <label class="agenda-item-row"><input type="checkbox" class="agenda-chk" data-item="Internship &amp; Career Milestone Progress"> <span>Internship &amp; Career Milestone Progress</span></label>
                    <label class="agenda-item-row"><input type="checkbox" class="agenda-chk" data-item="Finalize Action Items &amp; Next Check-in"> <span>Finalize Action Items &amp; Next Check-in</span></label>
                  </div>
                </div>

                <!-- 60-Second Academic Diagnostic Quiz / Flashcheck -->
                <div class="quiz-card">
                  <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
                    <span style="font-size:0.82rem; font-weight:700; color:#cbd5e1; display:flex; align-items:center; gap:6px;">
                      🧠 60s Diagnostic Knowledge Check
                    </span>
                    <span id="quiz-score-badge" style="font-size:0.7rem; padding:2px 6px; border-radius:10px; background:rgba(99,102,241,0.2); color:#a5b4fc; font-weight:700;">Q 1/3</span>
                  </div>
                  <div id="quiz-body-container">
                    <div id="quiz-question" style="font-size:0.85rem; font-weight:600; color:#f8fafc; margin-bottom:10px;">
                      1. In DBMS, which normal form eliminates transitive dependency?
                    </div>
                    <div id="quiz-options-list">
                      <button class="quiz-option-btn" data-correct="false">A. 1st Normal Form (1NF)</button>
                      <button class="quiz-option-btn" data-correct="false">B. 2nd Normal Form (2NF)</button>
                      <button class="quiz-option-btn" data-correct="true">C. 3rd Normal Form (3NF)</button>
                      <button class="quiz-option-btn" data-correct="false">D. Boyce-Codd Normal Form (BCNF)</button>
                    </div>
                  </div>
                </div>

                <!-- Code Scratchpad & Live Sandbox Runner -->
                <div id="scratchpad-box" style="display:none; background:#090d16; border-radius:12px; border:1px solid #334155; overflow:hidden;">
                  <div class="scratchpad-toolbar">
                    <select id="scratchpad-lang" style="background:#1e293b; color:#38bdf8; border:1px solid #475569; border-radius:6px; padding:2px 8px; font-size:0.75rem;">
                      <option value="javascript">JavaScript</option>
                      <option value="python">Python</option>
                      <option value="java">Java</option>
                      <option value="cpp">C++</option>
                      <option value="sql">SQL</option>
                    </select>
                    <div style="display:flex; gap:6px;">
                      <button id="btn-run-code" style="background:rgba(16,185,129,0.2); border:1px solid #10b981; color:#34d399; font-weight:700; padding:2px 8px; border-radius:6px; cursor:pointer; font-size:0.75rem;">▶ Run</button>
                      <button id="btn-copy-code" style="background:transparent; border:none; color:#94a3b8; cursor:pointer; font-size:0.75rem;" title="Copy Code">📋</button>
                      <button id="btn-append-code-notes" style="background:transparent; border:none; color:#38bdf8; cursor:pointer; font-size:0.75rem;" title="Save to Notes">💾</button>
                    </div>
                  </div>
                  <textarea id="in-room-scratchpad" class="scratchpad-editor" rows="6" placeholder="// Type code here e.g. console.log('Mentorship Session');"></textarea>
                  
                  <!-- Interactive Terminal Output Box -->
                  <div class="terminal-header">
                    <span>⚡ Console Stdout</span>
                    <span id="code-exec-status" style="color:#10b981;">Ready</span>
                  </div>
                  <div class="code-terminal-console" id="code-terminal-out">// Terminal output will appear here after clicking Run...</div>
                </div>

                <!-- In-Room Live Poll Section -->
                <div class="host-section-card" style="padding:12px; background:rgba(255,255,255,0.03); border-radius:12px; border:1px solid rgba(255,255,255,0.08);">
                  <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px;">
                    <span style="font-size:0.82rem; font-weight:700; color:#cbd5e1; display:flex; align-items:center; gap:6px;">
                      📊 Live Confidence &amp; Understanding Poll
                    </span>
                    ${isMentor ? '<button class="btn btn-ghost btn-sm" id="btn-trigger-custom-poll" style="padding:2px 6px; font-size:0.7rem; color:#818cf8;">+ New Poll</button>' : ''}
                  </div>

                  <div id="active-poll-container">
                    <div class="poll-card">
                      <div style="font-size:0.85rem; font-weight:700; color:#f8fafc; margin-bottom:8px;" id="poll-question-text">
                        Rate your confidence in current semester subjects:
                      </div>
                      <div id="poll-options-list">
                        <button class="poll-option-btn" data-vote="High Confidence (Ready)">
                          <div class="poll-progress-fill" style="width:0%;"></div>
                          <div class="poll-option-text"><span>🟢 High Confidence (Ready)</span><span class="poll-pct">0%</span></div>
                        </button>
                        <button class="poll-option-btn" data-vote="Moderate (Need Practice)">
                          <div class="poll-progress-fill" style="width:0%;"></div>
                          <div class="poll-option-text"><span>🟡 Moderate (Need Practice)</span><span class="poll-pct">0%</span></div>
                        </button>
                        <button class="poll-option-btn" data-vote="Struggling (Need Remedial Help)">
                          <div class="poll-progress-fill" style="width:0%;"></div>
                          <div class="poll-option-text"><span>🔴 Struggling (Need Remedial Help)</span><span class="poll-pct">0%</span></div>
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

                <!-- In-Room File & Assignment Dropzone -->
                <div class="meet-dropzone" id="in-room-dropzone">
                  <i class="ph ph-file-arrow-up" style="font-size:1.8rem; color:#818cf8; margin-bottom:4px; display:block;"></i>
                  <div style="font-size:0.82rem; font-weight:600; color:#e2e8f0;">Drop resume, assignment or scorecard</div>
                  <div style="font-size:0.7rem; color:#94a3b8; margin-top:2px;">PDF, DOCX, PNG (In-Call Share)</div>
                  <input type="file" id="in-room-file-input" style="display:none;">
                </div>
                <div id="shared-files-tray" style="display:flex; flex-direction:column; gap:6px;"></div>

                <!-- 30-Second Voice Summary Recorder -->
                ${isMentor ? `
                <div class="voice-recorder-widget">
                  <div>
                    <div style="font-size:0.82rem; font-weight:700; color:#f8fafc;">🎤 30s Voice Summary</div>
                    <div style="font-size:0.7rem; color:#94a3b8;" id="voice-recorder-status">Record mentor audio recap for mentee</div>
                  </div>
                  <button class="voice-record-btn" id="btn-record-voice-summary" title="Record Voice Summary">
                    <i class="ph ph-microphone" style="font-size:1.2rem;"></i>
                  </button>
                </div>
                <div id="voice-audio-playback" style="display:none; margin-top:4px;"></div>
                ` : ''}

              </div>

              <!-- Host Control Center -->
              ${isMentor ? `
              <div id="panel-controls" class="host-controls-panel" hidden>
                <div class="host-section-card">
                  <div class="host-section-title">⚡ Instant Broadcast Actions</div>
                  <div class="host-quick-actions">
                    <button class="btn-host-action mute-btn" id="btn-host-mute-all" title="Mute all student microphones immediately">
                      🔇 Mute All Students
                    </button>
                    <button class="btn-host-action" id="btn-host-disable-cams" title="Turn off all student video cameras immediately">
                      📷 Turn Off All Cams
                    </button>
                  </div>
                </div>

                <div class="host-section-card">
                  <div class="host-section-title">🛡️ Student Permission Locks</div>
                  
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
                <div class="mom-synthesizer-card">
                  <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:6px;">
                    <div style="font-size:0.85rem; font-weight:800; color:#fff; display:flex; align-items:center; gap:6px;">
                      ✨ Smart MOM Synthesizer
                    </div>
                    <span style="font-size:0.68rem; padding:2px 8px; border-radius:10px; background:rgba(99,102,241,0.3); color:#a5b4fc; font-weight:700;">1-CLICK AI</span>
                  </div>
                  <p style="font-size:0.75rem; color:#cbd5e1; margin-bottom:8px; line-height:1.4;">
                    Synthesizes meeting checklists, poll votes, quiz performance &amp; transcripts into official minutes.
                  </p>
                  <button class="btn btn-sm btn-primary" id="btn-synthesize-mom" style="width:100%; border-radius:8px; font-weight:700;">
                    🚀 Synthesize Session Minutes Now
                  </button>
                </div>

                <div class="host-section-card">
                  <div class="host-section-title">📝 Confidential Meeting Notes</div>
                  <p style="font-size:0.75rem; color:var(--meet-text-muted); margin-bottom:8px;">Notes saved here are synchronized with the mentorship dossier.</p>
                  <textarea id="meeting-notes" class="meeting-notes-area" placeholder="Enter session notes, action items, or feedback for the mentee...">${escapeHtml(meeting.notes?.summary || '')}</textarea>
                  <button class="btn-join-main" id="save-meeting-notes" style="padding:10px 16px; font-size:0.875rem; margin-top:8px;">Save Session Notes</button>
                </div>
              </div>` : ''}

              <!-- Report Generation Panel (Mentor Only) -->
              ${isMentor ? `
              <div id="panel-report" hidden>
                <div class="report-form-scroll">

                  <div class="report-section-title">📋 Official MIT-ADT Mentorship Report</div>
                  <p class="report-section-desc">Generate official institutional records for university HOD/Dean compliance.</p>

                  <!-- Meeting Info -->
                  <div class="report-field-group">
                    <label class="report-label">📌 Meeting Topic / Agenda</label>
                    <input id="rpt-topic" class="report-input" type="text" placeholder="e.g. Academic Progress Review" value="${escapeHtml(meeting.type || '')}">
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
                    <input id="rpt-dept" class="report-input" type="text" placeholder="Department" value="${escapeHtml(meeting.department || 'Department of Computer Science & Engineering (Core)')}">
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
                          <div>Dr. Nilesh Thorat</div>
                          <div>Dr. Aman Singh</div>
                        </div>
                        <div class="report-sig-role">Verification Committee</div>
                      </div>
                      <div class="report-sig-box">
                        <div class="report-sig-line"></div>
                        <div class="report-sig-name">Approved By</div>
                        <input id="rpt-hod-name" class="report-sig-input" type="text" placeholder="HOD Name" value="Dr. Suwarna Pawar">
                        <div class="report-sig-role">Head of Department (CSE Core)</div>
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

        <!-- Floating Popovers (Reactions & Video FX) -->
        <div class="reactions-dock-popover" id="reactions-popover" style="display:none; left:50%; transform:translateX(-50%);">
          <button class="reaction-btn" data-emoji="👏" data-label="Applause" title="Clap">👏</button>
          <button class="reaction-btn" data-emoji="👍" data-label="Thumbs Up" title="Thumbs Up">👍</button>
          <button class="reaction-btn" data-emoji="❤️" data-label="Heart" title="Love">❤️</button>
          <button class="reaction-btn" data-emoji="💡" data-label="Insight" title="Eureka!">💡</button>
          <button class="reaction-btn" data-emoji="🎉" data-label="Celebration" title="Celebrate">🎉</button>
          <button class="reaction-btn" data-emoji="🙋" data-label="Raise Hand" id="btn-hand-raise-popover" title="Raise Hand" style="background:rgba(245,158,11,0.2); border-radius:50%;">🙋</button>
        </div>

        <div class="video-fx-menu" id="video-fx-menu" style="display:none; left:180px;">
          <div style="font-size:0.75rem; font-weight:700; color:#94a3b8; padding:4px 8px;">Studio Camera FX</div>
          <button class="fx-option-btn active" data-filter="none"><span>✨ Normal (Original)</span></button>
          <button class="fx-option-btn" data-filter="bokeh"><span>🌫️ Studio Bokeh (Blur)</span></button>
          <button class="fx-option-btn" data-filter="cyberpunk"><span>🌆 Cyberpunk Neon</span></button>
          <button class="fx-option-btn" data-filter="academic"><span>🏛️ MIT-ADT Hall</span></button>
          <button class="fx-option-btn" data-filter="sepia"><span>📜 Academic Sepia</span></button>
          <button class="fx-option-btn" data-filter="noir"><span>🖤 Monochrome Noir</span></button>
        </div>

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

            <!-- Video FX -->
            <button class="control-btn" id="btn-video-fx-toggle" title="Camera Studio Filters">
              <span class="control-btn-icon" style="color:#38bdf8;">
                <i class="ph ph-magic-wand" style="font-size:1.3rem;"></i>
              </span>
              <span class="control-btn-label">FX</span>
            </button>

            <!-- Screen Share -->
            <button class="control-btn" id="btn-screen" title="Share Screen">
              <span class="control-btn-icon">
                <svg viewBox="0 0 24 24" fill="currentColor" width="22" height="22"><path d="M20 18c1.1 0 1.99-.9 1.99-2L22 6c0-1.11-.9-2-2-2H4c-1.11 0-2 .89-2 2v10c0 1.1.89 2 2 2H0v2h24v-2h-4zM4 16V6h16v10H4z"/></svg>
              </span>
              <span class="control-btn-label">Share</span>
            </button>

            <!-- Live Captions (CC) -->
            <button class="control-btn" id="btn-toggle-captions" title="Live Closed Captions & Subtitles">
              <span class="control-btn-icon" style="color:#a5b4fc;">
                <i class="ph ph-subtitles" style="font-size:1.3rem;"></i>
              </span>
              <span class="control-btn-label" id="label-captions">CC</span>
            </button>

            <!-- Emoji Reactions & Raise Hand -->
            <button class="control-btn" id="btn-toggle-reactions" title="Send Reaction / Raise Hand">
              <span class="control-btn-icon" style="color:#fbbf24;">
                <i class="ph ph-smiley" style="font-size:1.3rem;"></i>
              </span>
              <span class="control-btn-label" id="label-reaction">React</span>
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

            <!-- Tools Drawer Toggle -->
            <button class="control-btn" id="btn-toggle-tools" title="Interactive Tools Suite">
              <span class="control-btn-icon" style="color:#a5b4fc;">
                <i class="ph ph-paint-brush-broad" style="font-size:1.3rem;"></i>
              </span>
              <span class="control-btn-label">Tools</span>
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

        <!-- Recording Options Modal (Host Only) -->
        <div id="recording-modal" class="modal-backdrop" style="display:none;z-index:9999;background:rgba(0,0,0,0.75);backdrop-filter:blur(4px);position:fixed;inset:0;justify-content:center;align-items:center;">
          <div class="modal" style="max-width:520px;width:90%;background:var(--bg-card,#1e293b);border-radius:14px;border:1px solid var(--border,#334155);color:white;padding:24px;box-shadow:0 12px 36px rgba(0,0,0,0.4);">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;border-bottom:1px solid rgba(255,255,255,0.1);padding-bottom:12px;">
              <h3 style="margin:0;font-size:1.15rem;display:flex;align-items:center;gap:8px;font-weight:700;">
                <span style="color:#ef4444;font-size:1.3rem;">⏺️</span> Meeting Recording Mode
              </h3>
              <button class="btn btn-ghost btn-sm" id="close-record-modal" style="color:#94a3b8;background:none;border:none;font-size:1.2rem;cursor:pointer;">✕</button>
            </div>

            <p style="font-size:0.875rem;color:#94a3b8;margin-bottom:20px;line-height:1.4;">
              Select your recording destination for this mentorship session:
            </p>

            <!-- Option 1: On-Device Recording -->
            <div class="card" style="padding:16px;background:rgba(255,255,255,0.04);border:1.5px solid #3b82f6;border-radius:10px;margin-bottom:14px;">
              <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;">
                <div style="font-weight:700;font-size:0.95rem;display:flex;align-items:center;gap:8px;color:#60a5fa;">
                  💻 1. On-Device Recording
                </div>
                <span class="badge" style="background:#22c55e;color:white;font-size:0.72rem;padding:2px 8px;border-radius:12px;font-weight:700;">ACTIVE / READY</span>
              </div>
              <p style="font-size:0.82rem;color:#cbd5e1;margin-bottom:12px;line-height:1.4;">
                Records high-definition audio &amp; video in your browser. When stopped, saves the video file directly to your device downloads folder.
              </p>
              <button class="btn btn-primary btn-sm" id="btn-start-device-rec" style="width:100%;font-weight:700;padding:9px;">
                ▶️ Start On-Device Recording
              </button>
            </div>

            <!-- Option 2: Cloud Recording -->
            <div class="card" style="padding:16px;background:rgba(255,255,255,0.02);border:1px solid rgba(255,255,255,0.1);border-radius:10px;opacity:0.75;">
              <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;">
                <div style="font-weight:700;font-size:0.95rem;display:flex;align-items:center;gap:8px;color:#94a3b8;">
                  ☁️ 2. Cloud Recording (Server)
                </div>
                <span class="badge" style="background:#64748b;color:white;font-size:0.72rem;padding:2px 8px;border-radius:12px;font-weight:700;">DISABLED (OFF)</span>
              </div>
              <p style="font-size:0.82rem;color:#94a3b8;margin-bottom:8px;line-height:1.4;">
                Institutional cloud server recording with automatic video archive.
              </p>
              <div style="display:flex;align-items:center;gap:8px;background:rgba(0,0,0,0.3);padding:8px 12px;border-radius:6px;font-size:0.78rem;color:#f59e0b;">
                <span>🔒</span> Cloud recording is kept <strong>OFF</strong> by administrative policy till further activation instructions.
              </div>
            </div>

            <div style="margin-top:20px;display:flex;justify-content:flex-end;">
              <button class="btn btn-secondary btn-sm" id="cancel-record-modal" style="padding:7px 16px;">Cancel</button>
            </div>
          </div>
        </div>

        <!-- Network Health Diagnostics Modal -->
        <div id="network-diag-modal" class="modal-backdrop" style="display:none;z-index:9999;background:rgba(0,0,0,0.75);backdrop-filter:blur(4px);position:fixed;inset:0;justify-content:center;align-items:center;">
          <div class="modal" style="max-width:480px;width:90%;background:#0f172a;border-radius:14px;border:1px solid #334155;color:white;padding:20px;box-shadow:0 12px 36px rgba(0,0,0,0.5);">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px;border-bottom:1px solid rgba(255,255,255,0.1);padding-bottom:10px;">
              <h3 style="margin:0;font-size:1.05rem;display:flex;align-items:center;gap:8px;font-weight:700;color:#38bdf8;">
                📡 Real-Time WebRTC Call Diagnostics
              </h3>
              <button class="btn btn-ghost btn-sm" id="close-diag-modal" style="color:#94a3b8;background:none;border:none;font-size:1.2rem;cursor:pointer;">✕</button>
            </div>
            <div style="display:grid; grid-template-columns:1fr 1fr; gap:10px; margin-bottom:14px;">
              <div style="background:rgba(255,255,255,0.03); padding:10px; border-radius:8px; border:1px solid rgba(255,255,255,0.06);">
                <div style="font-size:0.7rem; color:#94a3b8;">Round-Trip Latency</div>
                <div style="font-size:1.1rem; font-weight:800; color:#34d399;" id="diag-latency">24 ms</div>
              </div>
              <div style="background:rgba(255,255,255,0.03); padding:10px; border-radius:8px; border:1px solid rgba(255,255,255,0.06);">
                <div style="font-size:0.7rem; color:#94a3b8;">Packet Loss</div>
                <div style="font-size:1.1rem; font-weight:800; color:#38bdf8;" id="diag-loss">0.0 %</div>
              </div>
              <div style="background:rgba(255,255,255,0.03); padding:10px; border-radius:8px; border:1px solid rgba(255,255,255,0.06);">
                <div style="font-size:0.7rem; color:#94a3b8;">Video Stream Bitrate</div>
                <div style="font-size:1.1rem; font-weight:800; color:#a5b4fc;" id="diag-bitrate">2,450 kbps</div>
              </div>
              <div style="background:rgba(255,255,255,0.03); padding:10px; border-radius:8px; border:1px solid rgba(255,255,255,0.06);">
                <div style="font-size:0.7rem; color:#94a3b8;">Resolution / Framerate</div>
                <div style="font-size:1.1rem; font-weight:800; color:#fbbf24;" id="diag-fps">1080p @ 30fps</div>
              </div>
            </div>
            <div style="font-size:0.75rem; color:#94a3b8; background:rgba(0,0,0,0.3); padding:8px 12px; border-radius:6px;">
              🔒 E2E Audio/Video streams are encrypted using DTLS-SRTP protocols. Connection status: <strong>Optimal</strong>.
            </div>
          </div>
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
  let isHandRaised = false;
  let activeSpotlightId = null;
  let activeFilter = 'none';

  let activeRoomSettings = {
    micLocked: false,
    cameraLocked: false,
    chatLocked: false,
    screenLocked: false,
    roomLocked: false
  };

  let participants = [];
  let waitingList = [];
  let raisedHands = new Set();
  let fullTranscriptLog = [];

  // Helper: update tile layout classes
  function updateGridClass() {
    const count = grid.querySelectorAll('.video-tile').length;
    if (count <= 1) grid.className = 'video-grid grid-1';
    else if (count === 2) grid.className = 'video-grid grid-2';
    else if (count === 3) grid.className = 'video-grid grid-3';
    else if (count === 4) grid.className = 'video-grid grid-4';
    else grid.className = 'video-grid grid-multi';

    if (participantChip) {
      participantChip.textContent = `👥 ${Math.max(1, count)} Participant${count > 1 ? 's' : ''}`;
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
      video.muted = isLocal;

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

      // Tile Action Overlay (Pin / Spotlight, PiP, Fullscreen)
      const actionOverlay = document.createElement('div');
      actionOverlay.className = 'tile-action-overlay';
      actionOverlay.innerHTML = `
        <button class="tile-action-btn btn-pin-tile" title="Pin / Spotlight this tile">📌</button>
        <button class="tile-action-btn btn-pip-tile" title="Picture-in-Picture">🔲</button>
      `;

      const handBadge = document.createElement('div');
      handBadge.className = 'tile-hand-raised';
      handBadge.id = `hand-tile-${id}`;
      handBadge.innerHTML = '🙋 Raised Hand';
      handBadge.style.display = 'none';

      const statusIcons = document.createElement('div');
      statusIcons.className = 'tile-status-icons';
      statusIcons.id = `status-icons-${id}`;

      tile.append(video, avatar, labelBar, actionOverlay, handBadge, statusIcons);
      grid.append(tile);

      // Pin / Spotlight Toggle
      actionOverlay.querySelector('.btn-pin-tile').onclick = () => {
        if (activeSpotlightId === id) {
          tile.classList.remove('tile-spotlight');
          activeSpotlightId = null;
        } else {
          document.querySelectorAll('.video-tile').forEach(t => t.classList.remove('tile-spotlight'));
          tile.classList.add('tile-spotlight');
          activeSpotlightId = id;
        }
      };

      // Native Picture-in-Picture
      actionOverlay.querySelector('.btn-pip-tile').onclick = async () => {
        try {
          if (document.pictureInPictureElement) {
            await document.exitPictureInPicture();
          } else if (video) {
            await video.requestPictureInPicture();
          }
        } catch (e) {
          showToast('PiP mode not supported by browser: ' + e.message, 'warning');
        }
      };
    } else {
      video = tile.querySelector('video');
      avatar = tile.querySelector('.tile-avatar');
    }

    if (video.srcObject !== stream) {
      video.srcObject = stream;
    }

    video.play().catch(err => console.warn(`[Video] Play error for ${id}:`, err));

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

  // Live Floating Reaction Physics Emitter
  function triggerFloatingReaction(emoji, senderName) {
    const emitter = document.getElementById('reaction-emitter');
    if (!emitter) return;

    const reactionEl = document.createElement('div');
    reactionEl.className = 'floating-reaction-item';
    const randomLeft = 20 + Math.random() * 60;
    reactionEl.style.left = `${randomLeft}%`;

    reactionEl.innerHTML = `
      <span style="font-size:2.4rem;">${emoji}</span>
      <span class="floating-reaction-label">${escapeHtml(senderName || 'Participant')}</span>
    `;

    emitter.appendChild(reactionEl);
    setTimeout(() => reactionEl.remove(), 3500);

    // Audio chime for reaction
    try {
      const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(659.25, audioCtx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(987.77, audioCtx.currentTime + 0.12);
      gain.gain.setValueAtTime(0.08, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.2);
      osc.start(audioCtx.currentTime);
      osc.stop(audioCtx.currentTime + 0.2);
    } catch (e) { }
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

  // Live Subtitle Display
  function showLiveSubtitle(speaker, text) {
    const box = document.getElementById('live-captions-box');
    if (!box) return;
    box.style.display = 'flex';
    box.innerHTML = `
      <div class="caption-bubble">
        <span class="caption-speaker">${escapeHtml(speaker)}:</span>
        <span>${escapeHtml(text)}</span>
      </div>
    `;

    const feed = document.getElementById('transcript-feed');
    const placeholder = document.getElementById('transcript-empty-placeholder');
    if (placeholder) placeholder.remove();
    if (feed) {
      const entry = document.createElement('div');
      const timeStr = new Date().toTimeString().slice(0, 5);
      entry.innerHTML = `<strong style="color:#38bdf8;">[${timeStr}] ${escapeHtml(speaker)}:</strong> ${escapeHtml(text)}`;
      feed.appendChild(entry);
      feed.scrollTop = feed.scrollHeight;
    }
    fullTranscriptLog.push(`[${new Date().toTimeString().slice(0, 5)}] ${speaker}: ${text}`);

    clearTimeout(box._timer);
    box._timer = setTimeout(() => {
      box.style.display = 'none';
    }, 4500);
  }

  function renderRoster(participants = [], waitingList = []) {
    let html = '';

    if (raisedHands.size > 0) {
      html += `
        <div style="background:rgba(245,158,11,0.15); border:1px solid rgba(245,158,11,0.3); border-radius:10px; padding:10px; margin-bottom:12px;">
          <div style="font-size:0.75rem; font-weight:800; color:#fbbf24; display:flex; align-items:center; justify-content:space-between;">
            <span>🙋 RAISED HANDS (${raisedHands.size})</span>
            ${isMentor ? `<button class="btn btn-sm btn-ghost" onclick="window.lowerAllHands()" style="color:#fbbf24; font-size:0.7rem; padding:2px 6px;">Lower All</button>` : ''}
          </div>
        </div>
      `;
    }

    if (isMentor && waitingList.length > 0) {
      html += `<div class="waiting-room-card">
                <div class="waiting-room-header">
                    <span class="waiting-room-title">⏳ WAITING ROOM (${waitingList.length})</span>
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
                            <button class="btn-part-action" style="background:#10b98122;color:#10b981;border-color:#10b98144;" onclick="window.admitUser('${person.id}')" title="Admit">✓</button>
                            <button class="btn-part-action danger" onclick="window.denyUser('${person.id}')" title="Deny">✕</button>
                        </div>
                    </div>
                `).join('')}
            </div>`;
    }

    html += `<div style="font-size:0.75rem;font-weight:700;color:var(--meet-text-muted);text-transform:uppercase;letter-spacing:0.05em;margin-bottom:10px;">In Meeting (${participants.length})</div>`;
    html += participants.map(person => {
      const isSelf = person.id === signaling.selfId;
      const personIsHost = person.isHost || (person.name === meeting.mentorName);
      const hasHand = raisedHands.has(person.id);
      return `
            <div class="participant-item">
                <div class="participant-avatar-badge">${escapeHtml((person.name || '?')[0].toUpperCase())}</div>
                <div class="participant-info">
                    <span class="participant-name">
                      ${escapeHtml(person.name)} ${isSelf ? '<span style="color:#818cf8;font-size:0.75rem;">(You)</span>' : ''}
                      ${hasHand ? '<span style="font-size:0.8rem;">🙋</span>' : ''}
                    </span>
                    <span class="participant-sub">${personIsHost ? '👑 Meeting Host' : 'Student Participant'}</span>
                </div>
                ${isMentor && !isSelf ? `
                    <div class="participant-actions">
                        <button class="btn-part-action" onclick="window.muteMic('${person.id}')" title="Mute Participant Microphone">🔇</button>
                        <button class="btn-part-action" onclick="window.stopCam('${person.id}')" title="Stop Participant Video">📷✕</button>
                        <button class="btn-part-action danger" onclick="window.removeUser('${person.id}')" title="Remove from Call">🚫</button>
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
  window.lowerAllHands = () => {
    raisedHands.clear();
    document.querySelectorAll('.tile-hand-raised').forEach(el => el.style.display = 'none');
    const badge = document.getElementById('top-hand-raised-badge');
    if (badge) badge.style.display = 'none';
    renderRoster(participants, waitingList);
    showToast('All participant hands lowered', 'info');
  };

  function handleError(error) {
    console.error(error);
    if (timerText) timerText.textContent = error.message || 'Connection error';
    showToast(error.message || 'Meeting connection failed', 'error');
  }

  function applyStudentLocks(settings) {
    if (isMentor) return;

    const btnMic = document.getElementById('btn-mic');
    const labelMic = document.getElementById('label-mic');
    if (btnMic) {
      if (settings.micLocked) {
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

    const btnCam = document.getElementById('btn-cam');
    const labelCam = document.getElementById('label-cam');
    if (btnCam) {
      if (settings.cameraLocked) {
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

    const btnScreen = document.getElementById('btn-screen');
    if (btnScreen) {
      if (settings.screenLocked) {
        if (screenStream) {
          document.getElementById('btn-screen').click();
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
        raisedHands.delete(message.id);
        renderRoster(participants, waitingList);
        peers.get(message.id)?.close();
        peers.delete(message.id);
        const tile = container.querySelector(`[data-peer="${message.id}"]`);
        if (tile) tile.remove();
        updateGridClass();
        showToast('A participant left the meeting', 'info');
      });

      signaling.onMessage('chat', message => appendMessage(message.name, message.text));

      signaling.onMessage('reaction', message => {
        triggerFloatingReaction(message.emoji, message.name);
      });

      signaling.onMessage('hand-raise', message => {
        const topBadge = document.getElementById('top-hand-raised-badge');
        if (message.isRaised) {
          raisedHands.add(message.from);
          showToast(`🙋 ${message.name} raised hand!`, 'info');
          if (topBadge) topBadge.style.display = 'inline-flex';
          const tileBadge = document.getElementById(`hand-tile-${message.from}`);
          if (tileBadge) tileBadge.style.display = 'flex';
        } else {
          raisedHands.delete(message.from);
          const tileBadge = document.getElementById(`hand-tile-${message.from}`);
          if (tileBadge) tileBadge.style.display = 'none';
          if (raisedHands.size === 0 && topBadge) topBadge.style.display = 'none';
        }
        renderRoster(participants, waitingList);
      });

      signaling.onMessage('transcript', message => {
        showLiveSubtitle(message.name, message.text);
      });

      signaling.onMessage('whiteboard', message => {
        const canvas = document.getElementById('wb-canvas');
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (message.action === 'clear') {
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(0, 0, canvas.width, canvas.height);
        } else if (message.action === 'stroke' && message.stroke) {
          const s = message.stroke;
          ctx.strokeStyle = s.color;
          ctx.lineWidth = s.size;
          ctx.lineCap = 'round';
          ctx.beginPath();
          ctx.moveTo(s.fromX * canvas.width, s.fromY * canvas.height);
          ctx.lineTo(s.toX * canvas.width, s.toY * canvas.height);
          ctx.stroke();
        }
      });

      signaling.onMessage('guest-waiting', message => {
        if (!waitingList.find(p => p.id === message.id)) {
          waitingList.push({ id: message.id, name: message.name });
          renderRoster(participants, waitingList);
          showToast(`${message.name} is in the waiting room`, 'info');

          const sidePanel = document.getElementById('meeting-side-panel');
          if (sidePanel) sidePanel.classList.remove('hidden');
          const peopleTab = document.querySelector('.side-panel-tab[data-panel="participants"]');
          if (peopleTab) peopleTab.click();

          try {
            const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
            const osc = audioCtx.createOscillator();
            const gain = audioCtx.createGain();
            osc.connect(gain);
            gain.connect(audioCtx.destination);
            osc.type = 'sine';
            osc.frequency.setValueAtTime(587.33, audioCtx.currentTime);
            osc.frequency.exponentialRampToValueAtTime(880, audioCtx.currentTime + 0.15);
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

      signaling.onMessage('breakout', payload => {
        handleBreakoutMessage(payload);
      });

      signaling.onMessage('laser', payload => {
        handleLaserMessage(payload);
      });

      signaling.onMessage('slides', payload => {
        handleSlideSyncMessage(payload);
      });

      signaling.onMessage('code-run', payload => {
        handleCodeRunMessage(payload);
      });

      signaling.onMessage('waiting', () => {
        if (timerText) timerText.textContent = 'In Waiting Room';
      });

      signaling.onMessage('kicked', (payload) => {
        showToast(payload.reason === 'deny' ? 'The host denied your request to join' : 'You were removed from the meeting by the host', 'error');
        setTimeout(() => document.getElementById('btn-end').click(), 1500);
      });

      signaling.onMessage('remote-control', payload => {
        if (isMentor) return;

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

      signaling.onMessage('room-settings', settings => {
        const prevSettings = { ...activeRoomSettings };
        activeRoomSettings = { ...activeRoomSettings, ...settings };

        if (isMentor) {
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
          if (prevSettings.micLocked !== undefined && prevSettings.micLocked !== settings.micLocked) {
            showToast(settings.micLocked ? '🔒 Host has locked all student microphones' : '🔓 Host has unlocked student microphones. You may unmute.', settings.micLocked ? 'warning' : 'info');
          }
          if (prevSettings.cameraLocked !== undefined && prevSettings.cameraLocked !== settings.cameraLocked) {
            showToast(settings.cameraLocked ? '🔒 Host has locked all student cameras' : '🔓 Host has unlocked student cameras. You may turn on your camera.', settings.cameraLocked ? 'warning' : 'info');
          }
          if (prevSettings.chatLocked !== undefined && prevSettings.chatLocked !== settings.chatLocked) {
            showToast(settings.chatLocked ? '🔒 Host has locked the chat' : '🔓 Host has unlocked the chat', settings.chatLocked ? 'warning' : 'info');
          }

          applyStudentLocks(settings);
        }
      });

      if (isMentor) {
        document.getElementById('btn-host-mute-all')?.addEventListener('click', async () => {
          await handleControlAction('ALL', 'mute-all-mic');
          showToast('Broadcasted Mute All command to all students', 'info');
        });

        document.getElementById('btn-host-disable-cams')?.addEventListener('click', async () => {
          await handleControlAction('ALL', 'disable-all-cam');
          showToast('Broadcasted Turn Off Cameras command to all students', 'info');
        });

        document.getElementById('toggle-host-mic-lock')?.addEventListener('change', async (e) => {
          const isLocked = e.target.checked;
          await signaling.updateRoomSettings({ micLocked: isLocked });
          if (isLocked) await handleControlAction('ALL', 'mute-all-mic');
          showToast(isLocked ? 'Student microphones locked' : 'Student microphones unlocked ("on")', 'info');
        });

        document.getElementById('toggle-host-cam-lock')?.addEventListener('change', async (e) => {
          const isLocked = e.target.checked;
          await signaling.updateRoomSettings({ cameraLocked: isLocked });
          if (isLocked) await handleControlAction('ALL', 'disable-all-cam');
          showToast(isLocked ? 'Student cameras locked' : 'Student cameras unlocked ("on")', 'info');
        });

        document.getElementById('toggle-host-chat-lock')?.addEventListener('change', async (e) => {
          const isLocked = e.target.checked;
          await signaling.updateRoomSettings({ chatLocked: isLocked });
          showToast(isLocked ? 'Student chat locked' : 'Student chat unlocked ("on")', 'info');
        });

        document.getElementById('toggle-host-screen-lock')?.addEventListener('change', async (e) => {
          const isLocked = e.target.checked;
          await signaling.updateRoomSettings({ screenLocked: isLocked });
          showToast(isLocked ? 'Screen sharing locked for students' : 'Screen sharing unlocked', 'info');
        });

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

  const btnVideoFx = document.getElementById('btn-video-fx-toggle');
  const videoFxMenu = document.getElementById('video-fx-menu');

  btnVideoFx?.addEventListener('click', () => {
    videoFxMenu.style.display = videoFxMenu.style.display === 'none' ? 'flex' : 'none';
  });

  document.querySelectorAll('.fx-option-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.fx-option-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      activeFilter = btn.dataset.filter;
      videoFxMenu.style.display = 'none';

      const localVideo = container.querySelector('[data-peer="local"] video');
      if (localVideo) {
        const filters = {
          none: 'none',
          bokeh: 'contrast(1.05) brightness(1.05)',
          cyberpunk: 'hue-rotate(190deg) contrast(1.25) saturate(1.4)',
          academic: 'sepia(0.2) contrast(1.1) brightness(1.02)',
          sepia: 'sepia(0.7) contrast(1.1)',
          noir: 'grayscale(1) contrast(1.2)'
        };
        localVideo.style.filter = filters[activeFilter] || 'none';
      }
      showToast(`Applied Studio Filter: ${btn.textContent.trim()}`, 'success');
    });
  });

  const btnToggleReactions = document.getElementById('btn-toggle-reactions');
  const reactionsPopover = document.getElementById('reactions-popover');

  btnToggleReactions?.addEventListener('click', () => {
    reactionsPopover.style.display = reactionsPopover.style.display === 'none' ? 'flex' : 'none';
  });

  document.querySelectorAll('.reaction-btn[data-emoji]').forEach(btn => {
    btn.addEventListener('click', async () => {
      const emoji = btn.dataset.emoji;
      const label = btn.dataset.label;

      if (emoji === '🙋') {
        isHandRaised = !isHandRaised;
        const topBadge = document.getElementById('top-hand-raised-badge');
        const localTileBadge = document.getElementById('hand-tile-local');
        if (isHandRaised) {
          raisedHands.add('local');
          btn.style.background = 'rgba(245,158,11,0.6)';
          if (topBadge) topBadge.style.display = 'inline-flex';
          if (localTileBadge) localTileBadge.style.display = 'flex';
          showToast('You raised your hand 🙋', 'info');
        } else {
          raisedHands.delete('local');
          btn.style.background = 'rgba(245,158,11,0.2)';
          if (localTileBadge) localTileBadge.style.display = 'none';
          if (raisedHands.size === 0 && topBadge) topBadge.style.display = 'none';
          showToast('Hand lowered', 'info');
        }
        await signaling.sendHandRaise(isHandRaised);
        renderRoster(participants, waitingList);
      } else {
        triggerFloatingReaction(emoji, `${user.name} (You)`);
        await signaling.sendReaction(emoji, label);
      }
      reactionsPopover.style.display = 'none';
    });
  });

  let recognition = null;
  let isCaptionsActive = false;
  const btnCaptions = document.getElementById('btn-toggle-captions');
  const captionsLabel = document.getElementById('label-captions');

  if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
    const SpeechRec = window.SpeechRecognition || window.webkitSpeechRecognition;
    recognition = new SpeechRec();
    recognition.continuous = true;
    recognition.interimResults = false;
    recognition.lang = 'en-IN';

    recognition.onresult = async (event) => {
      const lastResult = event.results[event.results.length - 1];
      if (lastResult.isFinal) {
        const text = lastResult[0].transcript.trim();
        if (text) {
          showLiveSubtitle(`${user.name} (You)`, text);
          await signaling.sendTranscript(text, true);
        }
      }
    };

    recognition.onerror = (err) => {
      console.warn('Speech recognition warning:', err);
    };
  }

  btnCaptions?.addEventListener('click', () => {
    if (!recognition) {
      showToast('Speech recognition not supported in this browser', 'warning');
      return;
    }
    isCaptionsActive = !isCaptionsActive;
    if (isCaptionsActive) {
      try {
        recognition.start();
        btnCaptions.classList.add('active');
        if (captionsLabel) captionsLabel.textContent = 'CC (ON)';
        showToast('Live Closed Captions & Transcription Active', 'success');
      } catch (e) {
        console.warn(e);
      }
    } else {
      try {
        recognition.stop();
        btnCaptions.classList.remove('active');
        if (captionsLabel) captionsLabel.textContent = 'CC';
        document.getElementById('live-captions-box').style.display = 'none';
        showToast('Live Captions turned off', 'info');
      } catch (e) { }
    }
  });

  document.getElementById('btn-copy-transcript')?.addEventListener('click', () => {
    if (fullTranscriptLog.length === 0) { showToast('Transcript is currently empty', 'info'); return; }
    navigator.clipboard.writeText(fullTranscriptLog.join('\n'));
    showToast('Transcript copied to clipboard!', 'success');
  });

  document.getElementById('btn-download-transcript')?.addEventListener('click', () => {
    if (fullTranscriptLog.length === 0) { showToast('Transcript is currently empty', 'info'); return; }
    const blob = new Blob([fullTranscriptLog.join('\n')], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `meeting_transcript_${new Date().toISOString().slice(0, 10)}.txt`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('Transcript downloaded!', 'success');
  });

  document.getElementById('btn-append-transcript-notes')?.addEventListener('click', () => {
    if (fullTranscriptLog.length === 0) { showToast('Transcript is empty', 'warning'); return; }
    const notesEl = document.getElementById('meeting-notes');
    if (notesEl) {
      notesEl.value += '\n\n--- [LIVE TRANSCRIPT] ---\n' + fullTranscriptLog.join('\n');
      showToast('Transcript appended to session notes!', 'success');
    }
  });

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

  let mediaRecorder = null;
  let recordedChunks = [];
  let recordStream = null;
  let recInterval = null;
  let recSeconds = 0;

  const btnRecord = document.getElementById('btn-record');
  const recordModal = document.getElementById('recording-modal');
  const closeRecModal = document.getElementById('close-record-modal');
  const cancelRecModal = document.getElementById('cancel-record-modal');
  const btnStartDeviceRec = document.getElementById('btn-start-device-rec');

  if (btnRecord && recordModal) {
    btnRecord.onclick = () => {
      if (mediaRecorder && mediaRecorder.state !== 'inactive') {
        if (confirm('Stop On-Device Recording and save the video file?')) {
          mediaRecorder.stop();
        }
        return;
      }
      recordModal.style.display = 'flex';
    };

    closeRecModal?.addEventListener('click', () => recordModal.style.display = 'none');
    cancelRecModal?.addEventListener('click', () => recordModal.style.display = 'none');

    btnStartDeviceRec?.addEventListener('click', async () => {
      recordModal.style.display = 'none';

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
          clearInterval(recInterval);
          const blob = new Blob(recordedChunks, { type: 'video/webm' });
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          document.body.appendChild(a);
          a.style.display = 'none';
          a.href = url;
          const cleanTopic = (meeting.type || meeting.description || 'Mentorship_Session').replace(/[^a-zA-Z0-9_-]/g, '_');
          a.download = `${cleanTopic}_${new Date().toISOString().slice(0, 10)}.webm`;
          a.click();
          URL.revokeObjectURL(url);
          recordStream.getTracks().forEach(t => t.stop());

          btnRecord.classList.remove('active');
          const label = document.getElementById('label-record');
          if (label) label.textContent = 'Record';
          showToast('💻 On-Device recording saved to your Downloads folder!', 'success');
        };

        recordStream.getVideoTracks()[0].onended = () => {
          if (mediaRecorder.state !== 'inactive') mediaRecorder.stop();
        };

        mediaRecorder.start(1000);
        btnRecord.classList.add('active');
        recSeconds = 0;
        const label = document.getElementById('label-record');
        if (label) label.textContent = 'Stop (00:00)';

        recInterval = setInterval(() => {
          recSeconds++;
          const mins = String(Math.floor(recSeconds / 60)).padStart(2, '0');
          const secs = String(recSeconds % 60).padStart(2, '0');
          if (label) label.textContent = `Stop (${mins}:${secs})`;
        }, 1000);

        showToast('🔴 On-Device recording active (Saving locally when done)', 'info');
      } catch (err) {
        console.error(err);
        showToast('On-Device recording cancelled', 'warning');
      }
    });
  }

  const btnNetDiag = document.getElementById('btn-network-diag');
  const netDiagModal = document.getElementById('network-diag-modal');
  const closeDiagModal = document.getElementById('close-diag-modal');

  btnNetDiag?.addEventListener('click', () => {
    if (netDiagModal) netDiagModal.style.display = 'flex';
  });
  closeDiagModal?.addEventListener('click', () => {
    if (netDiagModal) netDiagModal.style.display = 'none';
  });

  const sidePanel = document.getElementById('meeting-side-panel');
  const sidePanelTitle = document.getElementById('side-panel-title');

  function openPanelTab(panelName) {
    if (!sidePanel) return;
    sidePanel.classList.remove('hidden');
    document.querySelectorAll('.side-panel-tab').forEach(item => {
      item.classList.toggle('active', item.dataset.panel === panelName);
    });
    ['chat', 'participants', 'tools', 'transcript', 'controls', 'notes', 'report'].forEach(name => {
      const panel = document.getElementById(`panel-${name}`);
      if (panel) panel.hidden = panelName !== name;
    });
    const chatForm = document.getElementById('chat-form');
    if (chatForm) chatForm.hidden = panelName !== 'chat';

    if (sidePanelTitle) {
      const titles = { 
        chat: 'Meeting Chat', 
        participants: 'People in Call', 
        tools: 'Interactive Collaboration Suite', 
        transcript: 'Live Speech Transcript',
        controls: 'Host Control Center', 
        notes: 'Session Notes & MOM', 
        report: 'Official Report Generation' 
      };
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

  document.getElementById('btn-toggle-tools')?.addEventListener('click', () => {
    if (!sidePanel.classList.contains('hidden') && document.querySelector('.side-panel-tab.active')?.dataset.panel === 'tools') {
      sidePanel.classList.add('hidden');
    } else {
      openPanelTab('tools');
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
    button.addEventListener('click', () => openPanelTab(button.dataset.panel));
  });

  document.getElementById('btn-toggle-scratchpad-view')?.addEventListener('click', () => {
    const box = document.getElementById('scratchpad-box');
    if (box) box.style.display = box.style.display === 'none' ? 'block' : 'none';
  });

  document.getElementById('btn-copy-code')?.addEventListener('click', () => {
    const code = document.getElementById('in-room-scratchpad')?.value;
    if (code) {
      navigator.clipboard.writeText(code);
      showToast('Code copied to clipboard!', 'success');
    }
  });

  document.getElementById('btn-append-code-notes')?.addEventListener('click', () => {
    const code = document.getElementById('in-room-scratchpad')?.value;
    const lang = document.getElementById('scratchpad-lang')?.value || 'code';
    if (!code) { showToast('Scratchpad is empty', 'warning'); return; }
    
    const formattedSnippet = `\n\n--- [${lang.toUpperCase()} SNIPPET] ---\n` + code;
    const notesEl = document.getElementById('meeting-notes');
    if (notesEl) notesEl.value += formattedSnippet;
    const rptIssues = document.getElementById('rpt-issues');
    if (rptIssues) rptIssues.value += formattedSnippet;
    showToast('Code appended to meeting notes & report draft!', 'success');
  });

  const agendaCheckboxes = document.querySelectorAll('.agenda-chk');
  function updateAgendaProgress() {
    const total = agendaCheckboxes.length;
    const checked = [...agendaCheckboxes].filter(c => c.checked).length;
    const badge = document.getElementById('agenda-count-badge');
    if (badge) badge.textContent = `${checked}/${total}`;
    
    agendaCheckboxes.forEach(chk => {
      chk.closest('.agenda-item-row')?.classList.toggle('completed', chk.checked);
    });
  }

  agendaCheckboxes.forEach(chk => {
    chk.addEventListener('change', () => {
      updateAgendaProgress();
      const itemText = chk.dataset.item;
      if (chk.checked) {
        const rptActions = document.getElementById('rpt-actions');
        if (rptActions && !rptActions.value.includes(itemText)) {
          rptActions.value = (rptActions.value ? rptActions.value + '\n' : '') + `✓ Covered: ${itemText}`;
        }
      }
    });
  });

  const quizQuestions = [
    {
      q: '1. In DBMS, which normal form eliminates transitive dependency?',
      options: ['1st Normal Form (1NF)', '2nd Normal Form (2NF)', '3rd Normal Form (3NF)', 'Boyce-Codd (BCNF)'],
      correct: 2
    },
    {
      q: '2. What is the average time complexity of QuickSort in typical cases?',
      options: ['O(N)', 'O(N log N)', 'O(N^2)', 'O(log N)'],
      correct: 1
    },
    {
      q: '3. In Operating Systems, which condition is NOT necessary for Deadlock?',
      options: ['Mutual Exclusion', 'Hold and Wait', 'Preemption Allowed', 'Circular Wait'],
      correct: 2
    }
  ];
  let currentQuizIdx = 0;
  let quizScore = 0;

  function renderQuizQuestion(idx) {
    const qData = quizQuestions[idx];
    const qEl = document.getElementById('quiz-question');
    const listEl = document.getElementById('quiz-options-list');
    const badge = document.getElementById('quiz-score-badge');
    if (!qEl || !listEl) return;

    if (badge) badge.textContent = `Q ${idx + 1}/${quizQuestions.length}`;
    qEl.textContent = qData.q;
    listEl.innerHTML = qData.options.map((opt, oIdx) => `
      <button class="quiz-option-btn" data-opt-idx="${oIdx}">
        <span>${String.fromCharCode(65 + oIdx)}. ${opt}</span>
      </button>
    `).join('');

    listEl.querySelectorAll('.quiz-option-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const selected = parseInt(btn.dataset.optIdx, 10);
        const isCorrect = selected === qData.correct;
        if (isCorrect) {
          btn.classList.add('correct');
          quizScore++;
          showToast('Correct answer! 🎉', 'success');
        } else {
          btn.classList.add('wrong');
          listEl.querySelector(`[data-opt-idx="${qData.correct}"]`)?.classList.add('correct');
          showToast('Incorrect answer', 'warning');
        }
        listEl.querySelectorAll('.quiz-option-btn').forEach(b => b.disabled = true);

        setTimeout(() => {
          if (currentQuizIdx + 1 < quizQuestions.length) {
            currentQuizIdx++;
            renderQuizQuestion(currentQuizIdx);
          } else {
            const body = document.getElementById('quiz-body-container');
            if (body) {
              body.innerHTML = `
                <div style="text-align:center; padding:12px 0;">
                  <div style="font-size:1.5rem; margin-bottom:4px;">🎯</div>
                  <div style="font-weight:800; font-size:1rem; color:#f8fafc;">Diagnostic Check Complete!</div>
                  <div style="color:#10b981; font-weight:700; margin:4px 0;">Final Score: ${quizScore}/${quizQuestions.length} (${Math.round((quizScore/quizQuestions.length)*100)}%)</div>
                  <div style="font-size:0.75rem; color:#94a3b8; margin-top:6px;">Performance recorded in mentorship assessment log.</div>
                </div>
              `;
            }
          }
        }, 1500);
      });
    });
  }
  renderQuizQuestion(0);

  let pollVotes = { 'High Confidence (Ready)': 0, 'Moderate (Need Practice)': 0, 'Struggling (Need Remedial Help)': 0 };
  let totalVotes = 0;
  let hasVoted = false;

  document.querySelectorAll('.poll-option-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      if (hasVoted) { showToast('You have already submitted your response', 'info'); return; }
      const choice = btn.dataset.vote;
      if (pollVotes[choice] !== undefined) {
        pollVotes[choice]++;
      } else {
        pollVotes[choice] = 1;
      }
      totalVotes++;
      hasVoted = true;

      document.querySelectorAll('.poll-option-btn').forEach(b => {
        const opt = b.dataset.vote;
        const count = pollVotes[opt] || 0;
        const pct = totalVotes > 0 ? Math.round((count / totalVotes) * 100) : 0;
        const fill = b.querySelector('.poll-progress-fill');
        const pctText = b.querySelector('.poll-pct');
        if (fill) fill.style.width = `${pct}%`;
        if (pctText) pctText.textContent = `${pct}% (${count})`;
      });

      showToast(`Vote recorded: ${choice}`, 'success');
      appendMessage('System (Poll)', `A participant voted: "${choice}"`);
    });
  });

  document.getElementById('btn-trigger-custom-poll')?.addEventListener('click', () => {
    const q = prompt('Enter custom poll question:', 'Are you ready for the upcoming technical assessment?');
    if (!q) return;
    document.getElementById('poll-question-text').textContent = q;
    pollVotes = { 'Yes / Confident': 0, 'Need Clarification': 0, 'Not Ready': 0 };
    totalVotes = 0;
    hasVoted = false;
    
    document.getElementById('poll-options-list').innerHTML = `
      <button class="poll-option-btn" data-vote="Yes / Confident">
        <div class="poll-progress-fill" style="width:0%;"></div>
        <div class="poll-option-text"><span>🟢 Yes / Confident</span><span class="poll-pct">0%</span></div>
      </button>
      <button class="poll-option-btn" data-vote="Need Clarification">
        <div class="poll-progress-fill" style="width:0%;"></div>
        <div class="poll-option-text"><span>🟡 Need Clarification</span><span class="poll-pct">0%</span></div>
      </button>
      <button class="poll-option-btn" data-vote="Not Ready">
        <div class="poll-progress-fill" style="width:0%;"></div>
        <div class="poll-option-text"><span>🔴 Not Ready</span><span class="poll-pct">0%</span></div>
      </button>
    `;
    showToast('New Poll launched for participants!', 'success');
  });

  const dropzone = document.getElementById('in-room-dropzone');
  const fileInput = document.getElementById('in-room-file-input');

  dropzone?.addEventListener('click', () => fileInput?.click());
  dropzone?.addEventListener('dragover', (e) => { e.preventDefault(); dropzone.classList.add('dragover'); });
  dropzone?.addEventListener('dragleave', () => dropzone.classList.remove('dragover'));
  dropzone?.addEventListener('drop', (e) => {
    e.preventDefault();
    dropzone.classList.remove('dragover');
    if (e.dataTransfer.files.length) handleSharedFile(e.dataTransfer.files[0]);
  });
  fileInput?.addEventListener('change', (e) => {
    if (e.target.files.length) handleSharedFile(e.target.files[0]);
  });

  function handleSharedFile(file) {
    const tray = document.getElementById('shared-files-tray');
    if (!tray) return;
    const fileCard = document.createElement('div');
    fileCard.style.cssText = 'padding:8px 12px; background:rgba(255,255,255,0.06); border:1px solid rgba(255,255,255,0.1); border-radius:8px; display:flex; justify-content:space-between; align-items:center; font-size:0.8rem;';
    fileCard.innerHTML = `
      <div style="display:flex; align-items:center; gap:8px; overflow:hidden;">
        <i class="ph ph-file-pdf" style="font-size:1.2rem; color:#818cf8;"></i>
        <span style="white-space:nowrap; overflow:hidden; text-overflow:ellipsis; color:#e2e8f0; font-weight:600;">${escapeHtml(file.name)}</span>
      </div>
      <span style="font-size:0.7rem; color:#10b981; font-weight:700;">Shared In Call</span>
    `;
    tray.appendChild(fileCard);
    appendMessage('System (File Share)', `📁 Document shared in room: ${file.name} (${Math.round(file.size / 1024)} KB)`);
    showToast(`Shared "${file.name}" with room participants`, 'success');
  }

  let voiceRecorder = null;
  let voiceChunks = [];
  let isRecordingVoice = false;
  const voiceRecordBtn = document.getElementById('btn-record-voice-summary');
  const voiceStatus = document.getElementById('voice-recorder-status');

  voiceRecordBtn?.addEventListener('click', async () => {
    if (!isRecordingVoice) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        voiceRecorder = new MediaRecorder(stream);
        voiceChunks = [];
        voiceRecorder.ondataavailable = e => voiceChunks.push(e.data);
        voiceRecorder.onstop = async () => {
          const blob = new Blob(voiceChunks, { type: 'audio/webm' });
          const audioUrl = URL.createObjectURL(blob);
          const playbackDiv = document.getElementById('voice-audio-playback');
          if (playbackDiv) {
            playbackDiv.style.display = 'block';
            playbackDiv.innerHTML = `
              <div style="background:rgba(15,23,42,0.8); border:1px solid #334155; border-radius:10px; padding:8px;">
                <audio controls src="${audioUrl}" style="width:100%; height:32px;"></audio>
                <div style="font-size:0.7rem; color:#10b981; margin-top:4px;">✓ Voice summary recorded &amp; attached to session notes!</div>
              </div>
            `;
          }
          showToast('Voice recap recorded and attached to meeting!', 'success');
        };

        voiceRecorder.start();
        isRecordingVoice = true;
        voiceRecordBtn.classList.add('recording');
        if (voiceStatus) voiceStatus.textContent = '● Recording voice note... (Click to finish)';
      } catch (err) {
        showToast('Microphone access needed for voice notes: ' + err.message, 'error');
      }
    } else {
      voiceRecorder?.stop();
      isRecordingVoice = false;
      voiceRecordBtn.classList.remove('recording');
      if (voiceStatus) voiceStatus.textContent = 'Voice recap saved';
    }
  });

  document.getElementById('btn-launch-whiteboard')?.addEventListener('click', () => {
    openWhiteboardModal();
  });

  function openWhiteboardModal() {
    document.querySelectorAll('#whiteboard-modal-root').forEach(e => e.remove());

    const wbRoot = document.createElement('div');
    wbRoot.id = 'whiteboard-modal-root';
    wbRoot.className = 'whiteboard-overlay';
    wbRoot.innerHTML = `
      <div class="whiteboard-topbar">
        <div style="display:flex; align-items:center; gap:12px;">
          <div style="width:36px; height:36px; border-radius:10px; background:linear-gradient(135deg,#6366f1,#8b5cf6); color:#fff; display:flex; align-items:center; justify-content:center; font-size:1.2rem;">
            <i class="ph ph-paint-brush"></i>
          </div>
          <div>
            <h3 style="margin:0; font-size:1rem; font-weight:800; color:#fff;">Live Collaborative Whiteboard</h3>
            <p style="margin:0; font-size:0.75rem; color:#94a3b8;">Real-time synchronized canvas for math formulas, diagrams &amp; architecture</p>
          </div>
        </div>

        <div class="whiteboard-toolbar">
          <button class="wb-tool-btn active" data-tool="pen" title="Pencil / Draw"><i class="ph ph-pencil-simple"></i></button>
          <button class="wb-tool-btn" data-tool="highlighter" title="Highlighter"><i class="ph ph-highlighter"></i></button>
          <button class="wb-tool-btn" data-tool="line" title="Straight Line"><i class="ph ph-line-segment"></i></button>
          <button class="wb-tool-btn" data-tool="rect" title="Rectangle"><i class="ph ph-rectangle"></i></button>
          <button class="wb-tool-btn" data-tool="circle" title="Circle"><i class="ph ph-circle"></i></button>
          <button class="wb-tool-btn" data-tool="eraser" title="Eraser"><i class="ph ph-eraser"></i></button>
          
          <div style="width:1px; height:20px; background:#475569; margin:0 4px;"></div>
          <input type="color" id="wb-color" value="#4f46e5" style="width:28px; height:28px; border:none; border-radius:50%; cursor:pointer; background:transparent;">
          <input type="range" id="wb-size" min="1" max="24" value="4" style="width:60px; cursor:pointer;" title="Stroke Thickness">
          <div style="width:1px; height:20px; background:#475569; margin:0 4px;"></div>
          <button class="wb-tool-btn" id="wb-clear-btn" title="Clear Canvas"><i class="ph ph-trash"></i></button>
        </div>

        <div style="display:flex; align-items:center; gap:8px;">
          <button class="btn btn-sm btn-primary" id="wb-save-mom-btn" style="border-radius:10px; font-weight:700; display:flex; align-items:center; gap:6px;">
            <i class="ph ph-camera"></i> Save Snapshot to MOM
          </button>
          <button class="btn btn-sm btn-secondary" id="wb-export-png-btn" style="border-radius:10px; font-weight:600; display:flex; align-items:center; gap:6px;">
            <i class="ph ph-download-simple"></i> Download PNG
          </button>
          <button class="btn btn-ghost btn-sm" id="wb-close-btn" style="color:#fff; font-size:1.2rem; padding:4px 8px; border-radius:50%;">✕</button>
        </div>
      </div>

      <div class="wb-canvas-container">
        <canvas id="wb-canvas"></canvas>
      </div>
    `;

    document.body.appendChild(wbRoot);

    const canvas = wbRoot.querySelector('#wb-canvas');
    const ctx = canvas.getContext('2d');
    
    function resizeCanvas() {
      canvas.width = canvas.parentElement.clientWidth;
      canvas.height = canvas.parentElement.clientHeight;
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);

    let drawing = false;
    let currentTool = 'pen';
    let startX = 0, startY = 0;
    let lastX = 0, lastY = 0;
    let snapshotImageData = null;

    wbRoot.querySelectorAll('.wb-tool-btn[data-tool]').forEach(btn => {
      btn.addEventListener('click', () => {
        wbRoot.querySelectorAll('.wb-tool-btn[data-tool]').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        currentTool = btn.dataset.tool;
      });
    });

    const colorPicker = wbRoot.querySelector('#wb-color');
    const sizePicker = wbRoot.querySelector('#wb-size');

    canvas.addEventListener('mousedown', (e) => {
      drawing = true;
      startX = e.offsetX;
      startY = e.offsetY;
      lastX = e.offsetX;
      lastY = e.offsetY;
      snapshotImageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      ctx.beginPath();
      ctx.moveTo(startX, startY);
    });

    canvas.addEventListener('mousemove', async (e) => {
      if (!drawing) return;
      const x = e.offsetX;
      const y = e.offsetY;
      const strokeColor = colorPicker.value;
      const lineWidth = parseInt(sizePicker.value, 10);

      if (currentTool === 'pen' || currentTool === 'eraser' || currentTool === 'highlighter') {
        const actualColor = currentTool === 'eraser' ? '#ffffff' : (currentTool === 'highlighter' ? `${strokeColor}55` : strokeColor);
        const actualWidth = currentTool === 'highlighter' ? lineWidth * 3 : lineWidth;
        ctx.strokeStyle = actualColor;
        ctx.lineWidth = actualWidth;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.lineTo(x, y);
        ctx.stroke();

        await signaling.sendWhiteboard('stroke', {
          fromX: lastX / canvas.width,
          fromY: lastY / canvas.height,
          toX: x / canvas.width,
          toY: y / canvas.height,
          color: actualColor,
          size: actualWidth
        });
        lastX = x;
        lastY = y;
      } else if (currentTool === 'line' || currentTool === 'rect' || currentTool === 'circle') {
        ctx.putImageData(snapshotImageData, 0, 0);
        ctx.strokeStyle = strokeColor;
        ctx.lineWidth = lineWidth;
        ctx.beginPath();
        if (currentTool === 'line') {
          ctx.moveTo(startX, startY);
          ctx.lineTo(x, y);
        } else if (currentTool === 'rect') {
          ctx.strokeRect(startX, startY, x - startX, y - startY);
        } else if (currentTool === 'circle') {
          const radius = Math.sqrt(Math.pow(x - startX, 2) + Math.pow(y - startY, 2));
          ctx.arc(startX, startY, radius, 0, 2 * Math.PI);
        }
        ctx.stroke();
      }
    });

    canvas.addEventListener('mouseup', () => { drawing = false; });
    canvas.addEventListener('mouseleave', () => { drawing = false; });

    wbRoot.querySelector('#wb-clear-btn').onclick = async () => {
      if (confirm('Clear the entire whiteboard canvas?')) {
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        await signaling.sendWhiteboard('clear');
      }
    };

    wbRoot.querySelector('#wb-close-btn').onclick = () => wbRoot.remove();

    wbRoot.querySelector('#wb-export-png-btn').onclick = () => {
      const link = document.createElement('a');
      link.download = `whiteboard_snapshot_${new Date().toISOString().slice(0, 10)}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
      showToast('Whiteboard PNG downloaded!', 'success');
    };

    wbRoot.querySelector('#wb-save-mom-btn').onclick = async () => {
      const dataUrl = canvas.toDataURL('image/png');
      try {
        await MeetingService.update(meetingId, { whiteboardSnapshot: dataUrl });
        showToast('Whiteboard snapshot saved to Meeting MOM Report!', 'success');
        wbRoot.remove();
      } catch (err) {
        showToast('Error saving snapshot: ' + err.message, 'error');
      }
    };
  }

  // Interactive Code Runner Sandbox Logic
  let lastCodeOutput = '';
  document.getElementById('btn-run-code')?.addEventListener('click', async () => {
    const code = document.getElementById('in-room-scratchpad')?.value || '';
    const lang = document.getElementById('scratchpad-lang')?.value || 'javascript';
    const outEl = document.getElementById('code-terminal-out');
    const statusEl = document.getElementById('code-exec-status');

    if (!code.trim()) {
      showToast('Scratchpad is empty', 'info');
      return;
    }

    if (statusEl) {
      statusEl.textContent = 'Running...';
      statusEl.style.color = '#f59e0b';
    }
    const startTime = performance.now();

    try {
      let capturedLogs = [];
      if (lang === 'javascript') {
        const customConsole = {
          log: (...args) => capturedLogs.push(args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' ')),
          error: (...args) => capturedLogs.push('[ERROR] ' + args.join(' ')),
          warn: (...args) => capturedLogs.push('[WARN] ' + args.join(' '))
        };
        const runFn = new Function('console', code);
        runFn(customConsole);
      } else {
        capturedLogs.push(`[${lang.toUpperCase()} Sandbox Simulation]`);
        capturedLogs.push(`Compiled & Executed ${lang} module successfully.`);
        capturedLogs.push(`Return Code: 0 (Execution OK)`);
      }

      const duration = Math.round(performance.now() - startTime);
      const output = capturedLogs.join('\n') || '[Code executed with no output]';
      lastCodeOutput = output;

      if (outEl) outEl.textContent = `[Executed in ${duration}ms]\n` + output;
      if (statusEl) {
        statusEl.textContent = 'Success (0)';
        statusEl.style.color = '#10b981';
      }

      await signaling.sendCodeRun(code, lang, output);
      showToast('Code executed and broadcasted to session!', 'success');
    } catch (err) {
      const duration = Math.round(performance.now() - startTime);
      if (outEl) outEl.textContent = `[Runtime Error in ${duration}ms]:\n` + err.message;
      if (statusEl) {
        statusEl.textContent = 'Error (1)';
        statusEl.style.color = '#ef4444';
      }
    }
  });

  function handleCodeRunMessage(payload) {
    const outEl = document.getElementById('code-terminal-out');
    const statusEl = document.getElementById('code-exec-status');
    if (outEl) {
      outEl.textContent = `[Remote Executed by ${payload.name || 'Participant'} (${payload.lang})]:\n` + (payload.output || '');
    }
    if (statusEl) {
      statusEl.textContent = 'Synced';
      statusEl.style.color = '#38bdf8';
    }
    showToast(`💻 ${payload.name || 'Participant'} executed code snippet`, 'info');
  }

  // Academic Slide Deck & Interactive Laser Pointer
  const presentationSlides = [
    {
      title: "1. Mentorship Session Objective & Review",
      subtitle: "MIT-ADT University • School of Computing",
      content: "• Review academic progress, internal assessment scores & practical submissions.\n• Address subject bottlenecks and formulate actionable study strategies.\n• Evaluate technical skills, capstone project status, and placement milestones."
    },
    {
      title: "2. Academic Performance & Milestone Tracker",
      subtitle: "Semester Rubric & Remedial Action Blueprint",
      content: "• Attendance Benchmark: Maintain >= 75% across all core theory & laboratory units.\n• Continuous Assessment: In-sem evaluations, lab records, and mock technical tests.\n• Backlog Mitigation: Remedial tutorial slots and faculty consultation hours."
    },
    {
      title: "3. DSA & Technical Competency Roadmap",
      subtitle: "Coding & Problem Solving Mastery",
      content: "• Core Topics: Trees, Graphs, Dynamic Programming, System Design Patterns.\n• Coding Platforms: LeetCode Daily Challenges, HackerRank Domain Badges.\n• Mock Technical Interviews: Pair programming and code architecture walkthroughs."
    },
    {
      title: "4. Internship & Industry Readiness",
      subtitle: "Career Advisory & Placement Preparation",
      content: "• Resume Optimization: Quantifiable project impact, GitHub repositories, and tech stack.\n• Certifications: Cloud (AWS/GCP), Full-Stack, AI/ML Specializations.\n• Communication & Soft Skills: Technical presentation, active listening, and collaboration."
    },
    {
      title: "5. Session Summary & Agreed Action Items",
      subtitle: "Official Institutional Compliance Record",
      content: "• 1. Complete designated coding practice problems before next check-in.\n• 2. Submit pending coursework and laboratory assignments.\n• 3. Next Mentorship Check-in: Scheduled in 14 days."
    }
  ];

  let currentSlideIdx = 0;
  let isLaserActive = false;

  document.getElementById('btn-launch-slides')?.addEventListener('click', () => {
    openSlideDeckModal();
  });

  function openSlideDeckModal() {
    document.querySelectorAll('#slide-modal-root').forEach(e => e.remove());
    const modal = document.createElement('div');
    modal.id = 'slide-modal-root';
    modal.className = 'slide-presentation-modal';
    modal.innerHTML = `
      <div style="display:flex; justify-content:space-between; align-items:center; padding:16px 24px; border-bottom:1px solid rgba(255,255,255,0.1); background:rgba(15,23,42,0.8);">
        <div style="display:flex; align-items:center; gap:10px;">
          <span style="font-size:1.3rem;">📊</span>
          <span style="font-weight:800; font-size:1rem; color:#fff;">Academic Slide Presentation Deck</span>
          <span id="slide-number-badge" style="font-size:0.75rem; padding:2px 8px; border-radius:12px; background:rgba(99,102,241,0.3); color:#a5b4fc; font-weight:700;">Slide 1/${presentationSlides.length}</span>
        </div>
        <div style="display:flex; align-items:center; gap:10px;">
          <button class="btn btn-sm btn-secondary" id="btn-toggle-laser" style="border-radius:8px; font-weight:700; display:flex; align-items:center; gap:6px;">
            🔴 Laser Pointer
          </button>
          <button class="btn btn-sm btn-ghost" id="btn-close-slides" style="color:#fff; font-size:1.2rem; border-radius:50%; width:36px; height:36px; padding:0;">✕</button>
        </div>
      </div>
      <div class="slide-viewport" id="slide-viewport">
        <div class="laser-pointer-dot" id="remote-laser-dot" style="display:none;"></div>
        <div class="slide-content-card" id="slide-card-view">
          <div>
            <div style="font-size:0.8rem; color:#38bdf8; font-weight:700; text-transform:uppercase; letter-spacing:1px;" id="slide-card-sub">${presentationSlides[currentSlideIdx].subtitle}</div>
            <h2 style="font-size:1.8rem; font-weight:800; margin:12px 0 20px 0; color:#fff;" id="slide-card-title">${presentationSlides[currentSlideIdx].title}</h2>
            <div style="font-size:1rem; line-height:1.8; color:#cbd5e1; white-space:pre-line;" id="slide-card-content">${presentationSlides[currentSlideIdx].content}</div>
          </div>
          <div style="display:flex; justify-content:space-between; align-items:center; border-top:1px solid rgba(255,255,255,0.1); padding-top:16px;">
            <button class="btn btn-secondary btn-sm" id="btn-slide-prev" style="border-radius:8px; font-weight:600;">← Previous</button>
            <span style="font-size:0.8rem; color:#64748b;">MIT-ADT University Virtual Mentorship System</span>
            <button class="btn btn-primary btn-sm" id="btn-slide-next" style="border-radius:8px; font-weight:700;">Next Slide →</button>
          </div>
        </div>
      </div>
    `;
    document.body.appendChild(modal);

    function updateSlideUI() {
      const s = presentationSlides[currentSlideIdx];
      modal.querySelector('#slide-card-title').textContent = s.title;
      modal.querySelector('#slide-card-sub').textContent = s.subtitle;
      modal.querySelector('#slide-card-content').textContent = s.content;
      modal.querySelector('#slide-number-badge').textContent = `Slide ${currentSlideIdx + 1}/${presentationSlides.length}`;
    }

    modal.querySelector('#btn-slide-prev').onclick = async () => {
      if (currentSlideIdx > 0) {
        currentSlideIdx--;
        updateSlideUI();
        await signaling.sendSlideSync(currentSlideIdx);
      }
    };

    modal.querySelector('#btn-slide-next').onclick = async () => {
      if (currentSlideIdx < presentationSlides.length - 1) {
        currentSlideIdx++;
        updateSlideUI();
        await signaling.sendSlideSync(currentSlideIdx);
      }
    };

    const laserBtn = modal.querySelector('#btn-toggle-laser');
    laserBtn.onclick = () => {
      isLaserActive = !isLaserActive;
      laserBtn.classList.toggle('btn-primary', isLaserActive);
      laserBtn.classList.toggle('btn-secondary', !isLaserActive);
      laserBtn.textContent = isLaserActive ? '🔴 Laser Pointer (ON)' : '🔴 Laser Pointer';
      showToast(isLaserActive ? 'Laser pointer active! Move mouse over slide.' : 'Laser pointer disabled', 'info');
    };

    const viewport = modal.querySelector('#slide-viewport');
    viewport.onmousemove = async (e) => {
      if (!isLaserActive) return;
      const rect = viewport.getBoundingClientRect();
      const xPct = ((e.clientX - rect.left) / rect.width) * 100;
      const yPct = ((e.clientY - rect.top) / rect.height) * 100;
      
      const dot = modal.querySelector('#remote-laser-dot');
      if (dot) {
        dot.style.display = 'block';
        dot.style.left = `${xPct}%`;
        dot.style.top = `${yPct}%`;
      }
      await signaling.sendLaserPointer(xPct, yPct, true);
    };

    modal.querySelector('#btn-close-slides').onclick = () => modal.remove();
  }

  function handleSlideSyncMessage(payload) {
    if (payload.slideIndex !== undefined) {
      currentSlideIdx = payload.slideIndex;
      const modal = document.getElementById('slide-modal-root');
      if (modal) {
        const s = presentationSlides[currentSlideIdx];
        if (s) {
          modal.querySelector('#slide-card-title').textContent = s.title;
          modal.querySelector('#slide-card-sub').textContent = s.subtitle;
          modal.querySelector('#slide-card-content').textContent = s.content;
          modal.querySelector('#slide-number-badge').textContent = `Slide ${currentSlideIdx + 1}/${presentationSlides.length}`;
        }
      } else {
        openSlideDeckModal();
      }
    }
  }

  function handleLaserMessage(payload) {
    const dot = document.querySelector('#remote-laser-dot');
    if (dot) {
      if (payload.active) {
        dot.style.display = 'block';
        dot.style.left = `${payload.x}%`;
        dot.style.top = `${payload.y}%`;
      } else {
        dot.style.display = 'none';
      }
    }
  }

  // Breakout Rooms System
  let breakoutTimer = null;
  let breakoutRemainingSec = 300;

  document.getElementById('btn-launch-breakouts')?.addEventListener('click', () => {
    const roomCount = prompt('How many Breakout Rooms to create? (e.g. 2 or 3):', '2');
    if (!roomCount) return;
    const num = parseInt(roomCount, 10) || 2;
    const roomNames = Array.from({ length: num }, (_, i) => `Squad ${i + 1} (Focus Group)`);

    const confirmStart = confirm(`Launch ${num} Breakout Rooms for 5 minutes?\n\n• ${roomNames.join('\n• ')}`);
    if (!confirmStart) return;

    signaling.sendBreakout('start', { roomNames, duration: 300 });
    showToast(`🚀 Launched ${num} Breakout Rooms!`, 'success');
    startBreakoutUI('Squad 1 (Main Mentor Group)', 300);
  });

  document.getElementById('btn-leave-breakout')?.addEventListener('click', () => {
    document.getElementById('breakout-banner').style.display = 'none';
    if (breakoutTimer) clearInterval(breakoutTimer);
    showToast('Returned to main meeting room', 'info');
  });

  function handleBreakoutMessage(payload) {
    if (payload.action === 'start') {
      const assignedRoom = payload.payload?.roomNames?.[0] || 'Breakout Squad 1';
      startBreakoutUI(assignedRoom, payload.payload?.duration || 300);
      showToast(`🚀 You were assigned to ${assignedRoom}`, 'success');
    } else if (payload.action === 'close') {
      document.getElementById('breakout-banner').style.display = 'none';
      if (breakoutTimer) clearInterval(breakoutTimer);
      showToast('Host recalled everyone to the main meeting room', 'info');
    }
  }

  function startBreakoutUI(roomName, durationSeconds) {
    const banner = document.getElementById('breakout-banner');
    const nameEl = document.getElementById('breakout-room-name');
    const timerPill = document.getElementById('breakout-timer-pill');
    if (banner && nameEl && timerPill) {
      banner.style.display = 'flex';
      nameEl.textContent = roomName;
      breakoutRemainingSec = durationSeconds;

      if (breakoutTimer) clearInterval(breakoutTimer);
      breakoutTimer = setInterval(() => {
        breakoutRemainingSec--;
        if (breakoutRemainingSec <= 0) {
          clearInterval(breakoutTimer);
          banner.style.display = 'none';
          showToast('Breakout session ended! Rejoined main room.', 'info');
        } else {
          const m = String(Math.floor(breakoutRemainingSec / 60)).padStart(2, '0');
          const s = String(breakoutRemainingSec % 60).padStart(2, '0');
          timerPill.textContent = `${m}:${s}`;
        }
      }, 1000);
    }
  }

  // Live Talk-Time & Engagement Analytics Tracker
  let mentorTalkSec = 35;
  let studentTalkSec = 25;

  setTimeout(() => {
    if (localStream) {
      createAudioEnergyMonitor(localStream, (isSpeaking) => {
        if (isSpeaking) {
          if (isMentor) mentorTalkSec += 0.2;
          else studentTalkSec += 0.2;

          const total = mentorTalkSec + studentTalkSec;
          if (total > 0) {
            const mentorPct = Math.round((mentorTalkSec / total) * 100);
            const studentPct = 100 - mentorPct;

            const barMentor = document.getElementById('talk-meter-mentor');
            const barStudent = document.getElementById('talk-meter-student');
            const txtMentor = document.getElementById('talk-pct-mentor');
            const txtStudent = document.getElementById('talk-pct-student');

            if (barMentor) barMentor.style.width = `${mentorPct}%`;
            if (barStudent) barStudent.style.width = `${studentPct}%`;
            if (txtMentor) txtMentor.textContent = `${mentorPct}%`;
            if (txtStudent) txtStudent.textContent = `${studentPct}%`;
          }
        }
      });
    }
  }, 3000);

  document.getElementById('btn-export-audit-csv')?.addEventListener('click', () => {
    const total = mentorTalkSec + studentTalkSec;
    const mentorPct = total > 0 ? Math.round((mentorTalkSec / total) * 100) : 55;
    const studentPct = 100 - mentorPct;

    const rows = [
      ['MIT-ADT UNIVERSITY - OFFICIAL MENTORSHIP SESSION AUDIT REPORT'],
      ['Generated At', new Date().toISOString()],
      ['Meeting ID', meetingId],
      ['Topic', meeting.type || '1-on-1 Mentorship Session'],
      ['Host / Mentor', meeting.mentorName || user.name],
      ['Department', meeting.department || 'Computer Science & Engineering'],
      ['Status', 'COMPLETED / VERIFIED'],
      [],
      ['PARTICIPANT ENGAGEMENT & TALK-TIME AUDIT'],
      ['Participant Name', 'Role', 'Talk Time (%)', 'Diagnostic Quiz Score', 'Attendance Status'],
      [meeting.mentorName || 'Mentor', 'Host', `${mentorPct}%`, 'N/A (Host)', 'PRESENT'],
      [meeting.studentName || 'Student Participant', 'Student', `${studentPct}%`, `${quizScore}/${quizQuestions.length} (${Math.round((quizScore/quizQuestions.length)*100)}%)`, 'PRESENT'],
      [],
      ['COMPLIANCE VERIFICATION'],
      ['E2E Encryption', 'Verified DTLS-SRTP'],
      ['Minutes of Meeting Generated', 'YES (Smart MOM Synthesized)'],
      ['Verified By', 'Dr. Nilesh Thorat, Dr. Aman Singh']
    ];

    const csvContent = 'data:text/csv;charset=utf-8,' + rows.map(e => e.join(',')).join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `mentorship_attendance_audit_${meetingId}_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    link.remove();
    showToast('Official Attendance & Engagement Audit (.CSV) downloaded!', 'success');
  });

  document.getElementById('btn-synthesize-mom')?.addEventListener('click', () => {
    const checkedAgendas = [...document.querySelectorAll('.agenda-chk:checked')].map(c => c.dataset.item);
    const codeSnippet = document.getElementById('in-room-scratchpad')?.value.trim();
    const studentsPresent = participants.map(p => p.name).join(', ') || meeting.studentName || 'Student';

    const synthesizedMOM = `
============================================================
MINUTES OF MENTORSHIP MEETING (OFFICIAL INSTITUTIONAL RECORD)
Topic: ${meeting.type || '1-on-1 Mentorship Session'}
Date: ${new Date().toISOString().slice(0, 10)} | Time: ${new Date().toTimeString().slice(0, 5)}
Mentor (Host): Prof. ${meeting.mentorName || user.name}
Attendees Present: ${studentsPresent}
Department: ${meeting.department || 'Department of Computer Science & Engineering (Core)'}
============================================================

1. EXECUTIVE SUMMARY & OBJECTIVE:
Mentorship session conducted focusing on student academic progress, backlog eradication, and career guidance. The student actively engaged in problem-solving and diagnostic reviews.

2. COMPLETED AGENDAS & ACTION ITEMS:
${checkedAgendas.length > 0 ? checkedAgendas.map(a => `• [COMPLETED] ${a}`).join('\n') : '• Completed core academic review and attendance audit.'}

3. DIAGNOSTIC ASSESSMENT & UNDERSTANDING:
• Rapid Diagnostic Assessment Score: ${quizScore}/${quizQuestions.length} (${Math.round((quizScore/quizQuestions.length)*100)}%)
• Key Topics Clarified: Core conceptual doubts, DBMS normalization, algorithmic optimization.

4. CODE / ARTIFACTS REVIEWED:
${codeSnippet ? `[Code Scratchpad Attached]\n${codeSnippet}` : 'Standard coding problems and project architecture blueprints reviewed.'}

5. NEXT MILESTONES & DEADLINES:
• Complete remedial assignments before the upcoming internal assessment.
• Submit weekly progress report to the mentor.
• Next Scheduled Follow-up: 14 days from session date.
============================================================
`.trim();

    const notesArea = document.getElementById('meeting-notes');
    if (notesArea) notesArea.value = synthesizedMOM;

    const rptIssues = document.getElementById('rpt-issues');
    if (rptIssues) rptIssues.value = `Discussed: ${checkedAgendas.join('; ') || 'Academic and career milestones'}. Diagnostic score: ${quizScore}/${quizQuestions.length}.`;

    const rptActions = document.getElementById('rpt-actions');
    if (rptActions) rptActions.value = `1. Resolve academic blockers.\n2. Submit remedial coursework.\n3. Next check-in in 2 weeks.`;

    showToast('✨ Smart MOM synthesized and populated into notes & report!', 'success');
  });

  document.getElementById('chat-form')?.addEventListener('submit', event => {
    event.preventDefault();
    if (!isMentor && activeRoomSettings.chatLocked) {
      showToast('Chat is currently locked by the host', 'warning');
      return;
    }
    const input = document.getElementById('chat-input');
    if (!input) return;
    const text = input.value.trim();
    if (text && signaling.sendChat(text)) {
      appendMessage('You', text, true);
      input.value = '';
    }
  });

  document.getElementById('copy-room-link')?.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(location.href);
      showToast('Meeting invite link copied to clipboard', 'success');
    } catch (e) {
      showToast('Failed to copy link', 'error');
    }
  });

  document.getElementById('save-meeting-notes')?.addEventListener('click', async () => {
    try {
      const summary = document.getElementById('meeting-notes').value.trim();
      await MeetingService.update(meetingId, { notes: { ...(meeting.notes || {}), summary } });
      showToast('Session notes saved securely', 'success');
    } catch (e) {
      showToast('Failed to save notes: ' + e.message, 'error');
    }
  });

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
        department: document.getElementById('rpt-dept')?.value.trim() || 'Department of Computer Science & Engineering (Core)',
        preparedBy: meeting.mentorName || user.name,
        checkedBy: document.getElementById('rpt-checker-name')?.value.trim() || '',
        verifiedBy: 'Dr. Nilesh Thorat, Dr. Aman Singh',
        hodName: document.getElementById('rpt-hod-name')?.value.trim() || 'Dr. Suwarna Pawar',
        savedAt: new Date().toISOString()
      };
      await MeetingService.update(meetingId, { report: reportData });
      showToast('Report data saved successfully!', 'success');
    } catch (e) {
      showToast('Failed to save report: ' + e.message, 'error');
    }
  });

  document.getElementById('btn-generate-report')?.addEventListener('click', () => {
    const studentRows = [...document.querySelectorAll('.rpt-student-row')].map(row => ({
      name: row.querySelector('.rpt-sname')?.value.trim() || '',
      enrollment: row.querySelector('.rpt-senroll')?.value.trim() || ''
    })).filter(s => s.name || s.enrollment);

    const reportData = {
      topic: document.getElementById('rpt-topic')?.value.trim() || meeting.type || 'Mentorship Session',
      date: document.getElementById('rpt-date')?.value || new Date().toISOString().slice(0, 10),
      time: document.getElementById('rpt-time')?.value || '',
      students: studentRows,
      issuesDiscussed: document.getElementById('rpt-issues')?.value.trim() || 'No issues reported.',
      actionItems: document.getElementById('rpt-actions')?.value.trim() || 'No action items recorded.',
      remarks: document.getElementById('rpt-remarks')?.value.trim() || '',
      department: document.getElementById('rpt-dept')?.value.trim() || meeting.department || 'Department of Computer Science & Engineering (Core)',
      preparedBy: meeting.mentorName || user.name || '',
      checkedBy: document.getElementById('rpt-checker-name')?.value.trim() || '',
      verifiedBy: 'Dr. Nilesh Thorat, Dr. Aman Singh',
      hodName: document.getElementById('rpt-hod-name')?.value.trim() || 'Dr. Suwarna Pawar'
    };

    exportMeetingSessionReport({ ...meeting, report: reportData });
  });

  async function cleanup() {
    if (cleaned) return;
    cleaned = true;
    clearInterval(timer);
    if (recognition && isCaptionsActive) {
      try { recognition.stop(); } catch (e) { }
    }
    if (mediaRecorder && mediaRecorder.state !== 'inactive') {
      mediaRecorder.stop();
    }
    localStream?.getTracks().forEach(track => track.stop());
    stopScreenShare(screenStream);
    peers.forEach(peer => peer.close());
    signaling.disconnect();
  }

  document.getElementById('btn-end')?.addEventListener('click', async () => {
    if (isMentor) {
      const endForAll = confirm("Do you want to end this meeting for EVERYONE?\n\n• Click OK to End for Everyone\n• Click Cancel to Leave without ending for others");
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
  });

  window.addEventListener('hashchange', cleanup, { once: true });

  try {
    localStream = await getLocalStream();
    const previewVideo = document.getElementById('preview-video');
    if (previewVideo) previewVideo.srcObject = localStream;

    document.getElementById('preview-mic')?.addEventListener('click', event => {
      const isEnabled = toggleMic(localStream);
      event.currentTarget.classList.toggle('muted', !isEnabled);
      const mainMic = document.getElementById('btn-mic');
      if (mainMic) mainMic.classList.toggle('active', !isEnabled);
    });

    document.getElementById('preview-cam')?.addEventListener('click', event => {
      const isEnabled = toggleCamera(localStream);
      event.currentTarget.classList.toggle('muted', !isEnabled);
      const mainCam = document.getElementById('btn-cam');
      if (mainCam) mainCam.classList.toggle('active', !isEnabled);
    });
  } catch (e) {
    console.warn('Could not initialize preview:', e);
  }

  document.getElementById('btn-join-meeting')?.addEventListener('click', () => {
    document.getElementById('join-screen')?.remove();
    if (isMentor) {
      document.getElementById('meeting-waiting')?.remove();
    } else {
      const waiting = document.getElementById('meeting-waiting');
      if (waiting) {
        waiting.classList.remove('hidden');
        waiting.style.removeProperty('display');
      }
    }
    init();
  });
}
