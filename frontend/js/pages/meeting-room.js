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
                ${isMentor ? '<span class="meeting-host-badge">👑 Host</span>' : ''}
              </div>
              <div class="meeting-status-chips">
                <span class="meeting-timer" id="meeting-status">
                  <span class="meeting-live-dot"></span>
                  <span id="meeting-timer-text">Connecting...</span>
                </span>
                <span class="meeting-security-chip">🔒 E2E Encrypted</span>
                <span class="meeting-security-chip" id="participant-count-chip">👥 1 Participant</span>
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
              <button class="btn-meet-secondary" id="btn-close-side-panel" style="padding: 4px 8px; border-radius: 50%;">✕</button>
            </div>
            
            <div class="side-panel-tabs">
              <button class="side-panel-tab active" data-panel="chat">
                <span>💬 Chat</span>
              </button>
              <button class="side-panel-tab" data-panel="participants">
                <span>👥 People</span>
              </button>
              ${isMentor ? `
              <button class="side-panel-tab" data-panel="controls">
                <span>🛡️ Controls</span>
              </button>
              <button class="side-panel-tab" data-panel="notes">
                <span>📝 Notes</span>
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
                <div class="host-section-card">
                  <div class="host-section-title">📝 Confidential Meeting Notes</div>
                  <p style="font-size:0.75rem; color:var(--meet-text-muted); margin-bottom:8px;">Notes saved here are synchronized with the mentorship dossier.</p>
                  <textarea id="meeting-notes" class="meeting-notes-area" placeholder="Enter session notes, action items, or feedback for the mentee...">${escapeHtml(meeting.notes?.summary || '')}</textarea>
                  <button class="btn-join-main" id="save-meeting-notes" style="padding:10px 16px; font-size:0.875rem; margin-top:8px;">Save Session Notes</button>
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
            return `
            <div class="participant-item">
                <div class="participant-avatar-badge">${escapeHtml((person.name || '?')[0].toUpperCase())}</div>
                <div class="participant-info">
                    <span class="participant-name">${escapeHtml(person.name)} ${isSelf ? '<span style="color:#818cf8;font-size:0.75rem;">(You)</span>' : ''}</span>
                    <span class="participant-sub">${personIsHost ? '👑 Meeting Host' : 'Student Participant'}</span>
                </div>
                ${isMentor && !isSelf ? `
                    <div class="participant-actions">
                        <button class="btn-part-action" onclick="window.muteMic('${person.id}')" title="Mute Participant Microphone">🔇</button>
                        <button class="btn-part-action" onclick="window.stopCam('${person.id}')" title="Stop Participant Video">📷❌</button>
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
        ['chat', 'participants', 'controls', 'notes'].forEach(name => {
            const panel = document.getElementById(`panel-${name}`);
            if (panel) panel.hidden = panelName !== name;
        });
        const chatForm = document.getElementById('chat-form');
        if (chatForm) chatForm.hidden = panelName !== 'chat';

        if (sidePanelTitle) {
            const titles = { chat: 'Meeting Chat', participants: 'People in Call', controls: 'Host Control Center', notes: 'Session Notes' };
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
