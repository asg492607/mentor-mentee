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

    const isMentor = ['FACULTY', 'MENTOR', 'HOD', 'DEAN', 'SECTION_HEAD', 'ADMIN'].includes(String(user.role).toUpperCase());
    container.innerHTML = `
      <div class="meeting-room-layout">
        <header class="meeting-topbar">
          <div>
            <div class="meeting-title">${escapeHtml(meeting.type || 'Mentor meeting')}</div>
            <div class="meeting-timer" id="meeting-status">Connecting securely...</div>
          </div>
          <button class="btn btn-secondary btn-sm" id="copy-room-link">Copy invite link</button>
        </header>
        <main class="meeting-main">
          <section class="video-grid grid-1" id="video-grid">
            <div class="meeting-join" id="join-screen">
              <div class="meeting-waiting-card" style="width: 600px; max-width: 90%;">
                <h2>Ready to join?</h2>
                <p>You are about to join a meeting with <strong>${escapeHtml(meeting.mentorName)}</strong></p>
                
                <div style="width: 100%; height: 300px; background: #000; border-radius: 16px; overflow: hidden; position: relative; margin: 24px 0; border: 1px solid rgba(255,255,255,0.1); box-shadow: inset 0 0 40px rgba(0,0,0,0.8);">
                  <video id="preview-video" autoplay playsinline muted style="width: 100%; height: 100%; object-fit: cover;"></video>
                  <div style="position: absolute; bottom: 16px; left: 0; right: 0; display: flex; justify-content: center; gap: 16px;">
                    <button class="control-btn" id="preview-mic" style="background: rgba(0,0,0,0.75); backdrop-filter: blur(10px); width: 44px; height: 44px; border-radius: 50%; border: none; color: white;"><svg viewBox="0 0 24 24" fill="currentColor" width="20" height="20"><path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z"/><path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z"/></svg></button>
                    <button class="control-btn" id="preview-cam" style="background: rgba(0,0,0,0.75); backdrop-filter: blur(10px); width: 44px; height: 44px; border-radius: 50%; border: none; color: white;"><svg viewBox="0 0 24 24" fill="currentColor" width="20" height="20"><path d="M17 10.5V7c0-.55-.45-1-1-1H4c-.55 0-1 .45-1 1v10c0 .55.45 1 1 1h12c.55 0 1-.45 1-1v-3.5l4 4v-11l-4 4z"/></svg></button>
                  </div>
                </div>

                <button class="btn btn-primary btn-lg" id="btn-join-meeting" style="width: 100%;">Join Meeting</button>
              </div>
            </div>
            <div class="meeting-waiting" id="meeting-waiting" hidden>
              <div class="meeting-waiting-card">
                <div class="pulse-ring"><div class="avatar avatar-lg">${escapeHtml((user.name || '?')[0])}</div></div>
                <h2>Waiting for the other participant</h2>
                <p>Keep this tab open. The call connects automatically.</p>
              </div>
            </div>
          </section>
          <aside class="meeting-side-panel" id="meeting-side-panel">
            <div class="side-panel-tabs">
              <button class="side-panel-tab active" data-panel="chat">Chat</button>
              <button class="side-panel-tab" data-panel="participants">People</button>
              ${isMentor ? '<button class="side-panel-tab" data-panel="notes">Notes</button>' : ''}
            </div>
            <div class="side-panel-body">
              <div id="panel-chat">
                <div class="chat-messages" id="chat-messages"></div>
              </div>
              <div id="panel-participants" hidden></div>
              ${isMentor ? `<div id="panel-notes" hidden>
                <textarea id="meeting-notes" class="meeting-notes-area" placeholder="Private meeting summary...">${escapeHtml(meeting.notes?.summary || '')}</textarea>
                <button class="btn btn-primary w-full mt-3" id="save-meeting-notes">Save notes</button>
              </div>` : ''}
            </div>
            <form class="chat-input-wrap" id="chat-form">
              <input class="chat-input" id="chat-input" maxlength="2000" placeholder="Message everyone" autocomplete="off">
              <button class="btn btn-primary btn-sm" type="submit">Send</button>
            </form>
          </aside>
        </main>
        <footer class="meeting-controls">
          <button class="control-btn" id="btn-mic"><span class="control-btn-icon"><svg viewBox="0 0 24 24" fill="currentColor" width="24" height="24"><path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3zm5.91-3c-.49 0-.9.39-.9.88C17 14.15 14.8 16 12 16s-5-.15-5.01-4.12c0-.49-.41-.88-.9-.88s-.89.39-.89.88c0 5.05 3.91 9.14 8.8 9.87V24h2v-2.25c4.89-.73 8.8-4.82 8.8-9.87 0-.49-.4-.88-.89-.88z"/></svg></span><span class="control-btn-label">Microphone</span></button>
          <button class="control-btn" id="btn-cam"><span class="control-btn-icon"><svg viewBox="0 0 24 24" fill="currentColor" width="24" height="24"><path d="M15 8v8H5V8h10m1-2H4c-.55 0-1 .45-1 1v10c0 .55.45 1 1 1h12c.55 0 1-.45 1-1v-3.5l4 4v-11l-4 4V7c0-.55-.45-1-1-1z"/></svg></span><span class="control-btn-label">Camera</span></button>
          <button class="control-btn" id="btn-screen"><span class="control-btn-icon"><svg viewBox="0 0 24 24" fill="currentColor" width="24" height="24"><path d="M20 18c1.1 0 1.99-.9 1.99-2L22 6c0-1.11-.9-2-2-2H4c-1.11 0-2 .89-2 2v10c0 1.1.89 2 2 2H0v2h24v-2h-4zM4 16V6h16v10H4z"/></svg></span><span class="control-btn-label">Share screen</span></button>
          <button class="control-btn" id="btn-panel"><span class="control-btn-icon"><svg viewBox="0 0 24 24" fill="currentColor" width="24" height="24"><path d="M20 2H4c-1.1 0-1.99.9-1.99 2L2 22l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm-2 12H6v-2h12v2zm0-3H6V9h12v2zm0-3H6V6h12v2z"/></svg></span><span class="control-btn-label">Chat</span></button>
          ${isMentor ? `<button class="control-btn" id="btn-record"><span class="control-btn-icon" style="color:var(--danger);"><svg viewBox="0 0 24 24" fill="currentColor" width="24" height="24"><circle cx="12" cy="12" r="8"/></svg></span><span class="control-btn-label">Record</span></button>` : ''}
          <button class="control-btn end-call" id="btn-end"><span class="control-btn-icon"><svg viewBox="0 0 24 24" fill="currentColor" width="24" height="24"><path d="M12 9c-1.6 0-3.15.25-4.6.72v3.1c0 .39-.23.74-.56.9-.98.49-1.87 1.12-2.66 1.85-.18.18-.43.28-.7.28-.28 0-.53-.11-.71-.29L.29 13.08c-.18-.17-.29-.42-.29-.7 0-.28.11-.53.29-.71C3.34 8.78 7.46 7 12 7s8.66 1.78 11.71 4.67c.18.18.29.43.29.71 0 .28-.11.52-.29.71l-2.48 2.48c-.18.18-.43.29-.71.29-.27 0-.52-.11-.7-.28-.79-.74-1.69-1.36-2.67-1.85-.33-.16-.56-.5-.56-.9v-3.1C15.15 9.25 13.6 9 12 9z"/></svg></span><span class="control-btn-label">Leave</span></button>
        </footer>
      </div>`;

    const peers = new Map();
    const signaling = createSignaling(meetingId, user);
    const status = document.getElementById('meeting-status');
    const grid = document.getElementById('video-grid');
    const waiting = document.getElementById('meeting-waiting');
    let localStream;
    let screenStream;
    let elapsed = 0;
    let cleaned = false;

    // VISUAL DEBUGGER
    const debugPanel = document.createElement('div');
    debugPanel.style.cssText = 'position:fixed;bottom:80px;left:20px;background:rgba(0,0,0,0.8);color:#0f0;font-family:monospace;font-size:10px;padding:10px;max-height:200px;overflow-y:auto;z-index:9999;pointer-events:none;width:300px;border-radius:8px;';
    document.body.appendChild(debugPanel);
    const logDebug = (msg) => {
        console.log('[DEBUG]', msg);
        const p = document.createElement('div');
        p.textContent = msg;
        debugPanel.appendChild(p);
        debugPanel.scrollTop = debugPanel.scrollHeight;
    };
    window.logDebug = logDebug;

    function addVideo(id, name, stream, muted = false) {
        waiting?.remove();
        let tile = container.querySelector(`[data-peer="${id}"]`);
        if (!tile) {
            tile = document.createElement('div');
            tile.className = 'video-tile';
            tile.dataset.peer = id;
            const video = document.createElement('video');
            video.autoplay = true;
            video.playsInline = true;
            video.muted = muted;
            const label = document.createElement('span');
            label.className = 'tile-label';
            label.textContent = name;
            tile.append(video, label);
            grid.append(tile);
        }
        tile.querySelector('video').srcObject = stream;
        const count = grid.querySelectorAll('.video-tile').length;
        grid.className = `video-grid grid-${Math.min(count, 4)}`;
    }

    function createPeer(id, name, offer) {
        if (peers.has(id)) return peers.get(id);
        const peer = createPeerConnection(signaling, localStream, id);
        peer.onTrack(stream => addVideo(id, name || 'Participant', stream));
        peers.set(id, peer);

        peer.pc.addEventListener('iceconnectionstatechange', () => {
            if (peer.pc.iceConnectionState === 'failed' || peer.pc.iceConnectionState === 'disconnected') {
                console.log('ICE Connection failed/disconnected. Attempting restart...');
                if (peer.pc.restartIce) peer.pc.restartIce();
            }
        });

        if (offer) peer.createOffer().catch(handleError);
        return peer;
    }

    function appendMessage(sender, text, own = false) {
        const row = document.createElement('div');
        row.className = `chat-message${own ? ' own' : ''}`;
        const bubble = document.createElement('div');
        bubble.className = 'chat-bubble';
        bubble.textContent = `${sender}: ${text}`;
        row.append(bubble);
        const chatBox = container.querySelector('#chat-messages');
        if (chatBox) {
            chatBox.append(row);
            row.scrollIntoView({ block: 'nearest' });
        }
    }

    function renderRoster(participants = [], waitingList = []) {
        let html = '';
        
        if (isMentor && waitingList.length > 0) {
            html += `<div style="padding:12px;background:var(--warning)22;border-radius:8px;margin-bottom:12px;">
                <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
                    <span style="font-size:0.8rem;font-weight:600;color:var(--warning);">WAITING ROOM (${waitingList.length})</span>
                    <div style="display:flex;gap:4px;">
                        <button class="btn btn-sm btn-secondary" onclick="window.admitAll()">Admit All</button>
                        <button class="btn btn-sm btn-secondary" onclick="window.denyAll()">Deny All</button>
                    </div>
                </div>
                ${waitingList.map(person => `
                    <div class="participant-item">
                        <div class="avatar avatar-sm">${escapeHtml((person.name || '?')[0])}</div>
                        <span class="participant-name">${escapeHtml(person.name)}</span>
                        <div style="display:flex;gap:4px;">
                            <button class="btn btn-sm btn-primary" onclick="window.admitUser('${person.id}')">Admit</button>
                            <button class="btn btn-sm btn-secondary" onclick="window.denyUser('${person.id}')">Deny</button>
                        </div>
                    </div>
                `).join('')}
            </div>`;
        }

        html += `<div style="font-size:0.8rem;font-weight:600;color:rgba(255,255,255,0.5);margin-bottom:8px;padding:0 4px;">IN CALL (${participants.length})</div>`;
        html += participants.map(person => `
            <div class="participant-item">
                <div class="avatar avatar-sm">${escapeHtml((person.name || '?')[0])}</div>
                <span class="participant-name">${escapeHtml(person.name)}${person.id === signaling.selfId ? ' (you)' : ''}</span>
                ${isMentor && person.id !== signaling.selfId ? `
                    <div style="display:flex; gap:4px; margin-left:auto;">
                        <button class="btn btn-sm btn-secondary" onclick="window.muteMic('${person.id}')" title="Mute Mic" style="padding:2px 6px;font-size:0.8rem;">🔇</button>
                        <button class="btn btn-sm btn-secondary" onclick="window.stopCam('${person.id}')" title="Stop Camera" style="padding:2px 6px;font-size:0.8rem;">📷❌</button>
                        <button class="btn btn-sm btn-secondary" onclick="window.removeUser('${person.id}')" style="color:var(--danger);border-color:rgba(239,68,68,0.2);padding:2px 6px;font-size:0.7rem;">Remove</button>
                    </div>
                ` : ''}
            </div>
        `).join('');

        (container.querySelector('#panel-participants') || {}).innerHTML = html;
    }

    const handleControlAction = async (id, action) => {
        window.logDebug(`Sending control ${action} to ${id}`);
        const success = await signaling.sendControl(id, action);
        window.logDebug(`Control send success: ${success}`);
        if (!success) showToast('Failed to perform action. Check your connection.', 'error');
    };
    
    window.admitUser = (id) => handleControlAction(id, 'admit');
    window.denyUser = (id) => handleControlAction(id, 'deny');
    window.removeUser = (id) => handleControlAction(id, 'remove');
    window.muteMic = (id) => handleControlAction(id, 'mute-mic');
    window.stopCam = (id) => handleControlAction(id, 'disable-cam');
    window.admitAll = () => waitingList.forEach(p => handleControlAction(p.id, 'admit'));
    window.denyAll = () => waitingList.forEach(p => handleControlAction(p.id, 'deny'));

    function handleError(error) {
        console.error(error);
        status.textContent = error.message || 'Connection error';
        showToast(error.message || 'Meeting connection failed', 'error');
    }

    let participants = [];
    let waitingList = [];

    async function init() {
        try {
            window.logDebug(`Initializing as ${isMentor ? 'Host' : 'Guest'}`);
            if (!localStream) localStream = await getLocalStream();
            addVideo('local', `${user.name} (you)`, localStream, true);
            signaling.onMessage('joined', message => {
                window.logDebug(`Joined room! Peers: ${message.peers.length}`);
                signaling.selfId = message.id;
                participants = [{ id: message.id, name: user.name }, ...message.peers];
                renderRoster(participants, waitingList);
                message.peers.forEach(person => {
                    window.logDebug(`Creating offer for ${person.name}`);
                    createPeer(person.id, person.name, true);
                });
            });
            signaling.onMessage('peer-joined', message => {
                window.logDebug(`Peer joined: ${message.name}`);
                participants.push({ id: message.id, name: message.name });
                renderRoster(participants, waitingList);
                createPeer(message.id, message.name, false);
            });
            signaling.onMessage('signal', message => {
                window.logDebug(`Received signal from ${message.name}`);
                createPeer(message.from, message.name, false).handleSignal(message.signal).catch(handleError);
            });
            signaling.onMessage('peer-left', message => {
                participants = participants.filter(p => p.id !== message.id);
                renderRoster(participants, waitingList);
                peers.get(message.id)?.close();
                peers.delete(message.id);
                const tile = container.querySelector(`[data-peer="${message.id}"]`);
                if (tile) tile.remove();
                showToast('A participant left the meeting', 'info');
            });
            signaling.onMessage('chat', message => appendMessage(message.name, message.text));
            
            // Host only: Listen to waiting room events
            signaling.onMessage('guest-waiting', message => {
                if (!waitingList.find(p => p.id === message.id)) {
                    waitingList.push({ id: message.id, name: message.name });
                    renderRoster(participants, waitingList);
                    showToast(`${message.name} is waiting to join`, 'info');
                    
                    // Automatically open the side panel to the 'participants' tab so the host sees the Admit button
                    const sidePanel = document.getElementById('meeting-side-panel');
                    if (sidePanel) sidePanel.classList.remove('hidden');
                    const peopleTab = document.querySelector('.side-panel-tab[data-panel="participants"]');
                    if (peopleTab) peopleTab.click();

                    // Play a subtle ring tone
                    try {
                        const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
                        const osc = audioCtx.createOscillator();
                        const gain = audioCtx.createGain();
                        osc.connect(gain);
                        gain.connect(audioCtx.destination);
                        osc.type = 'sine';
                        osc.frequency.setValueAtTime(600, audioCtx.currentTime);
                        osc.frequency.exponentialRampToValueAtTime(800, audioCtx.currentTime + 0.1);
                        gain.gain.setValueAtTime(0, audioCtx.currentTime);
                        gain.gain.linearRampToValueAtTime(0.5, audioCtx.currentTime + 0.1);
                        gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.5);
                        osc.start(audioCtx.currentTime);
                        osc.stop(audioCtx.currentTime + 0.5);
                    } catch(e) {}
                }
            });
            signaling.onMessage('guest-left-waiting', message => {
                waitingList = waitingList.filter(p => p.id !== message.id);
                renderRoster(participants, waitingList);
            });

            // Guest only: Waiting room & Kicked events
            signaling.onMessage('waiting', () => {
                status.textContent = 'Waiting for host...';
            });
            signaling.onMessage('kicked', (payload) => {
                showToast(payload.reason === 'deny' ? 'The host denied your request to join' : 'You were removed from the meeting', 'error');
                setTimeout(() => document.getElementById('btn-end').click(), 1500);
            });
            signaling.onMessage('remote-control', payload => {
                if (payload.action === 'mute-mic' && localStream.getAudioTracks()[0]?.enabled) {
                    document.getElementById('btn-mic').click();
                    showToast('The host has muted your microphone', 'warning');
                } else if (payload.action === 'disable-cam' && localStream.getVideoTracks()[0]?.enabled) {
                    document.getElementById('btn-cam').click();
                    showToast('The host has disabled your camera', 'warning');
                }
            });

            signaling.onMessage('connect', () => {
                status.textContent = 'Connected';
                timer = setInterval(() => {
                    elapsed += 1;
                    const minutes = String(Math.floor(elapsed / 60)).padStart(2, '0');
                    const seconds = String(elapsed % 60).padStart(2, '0');
                    status.textContent = `${minutes}:${seconds}`;
                }, 1000);
            });
            signaling.onMessage('error', handleError);
            await signaling.connect();
            if (isMentor) {
                await MeetingService.update(meetingId, { status: 'ONGOING', startedAt: meeting.startedAt || new Date().toISOString() });
            }
        } catch (error) {
            handleError(error);
        }
    }

    document.getElementById('btn-mic').onclick = event => {
        if (localStream) event.currentTarget.classList.toggle('active', !toggleMic(localStream));
    };
    document.getElementById('btn-cam').onclick = event => {
        if (localStream) event.currentTarget.classList.toggle('active', !toggleCamera(localStream));
    };
    document.getElementById('btn-screen').onclick = async event => {
        try {
            if (screenStream) {
                stopScreenShare(screenStream);
                screenStream = null;
                const camera = localStream?.getVideoTracks()[0] || null;
                await Promise.all([...peers.values()].map(peer => peer.replaceVideoTrack(camera)));
                addVideo('local', `${user.name} (you)`, localStream, true);
                event.currentTarget.classList.remove('active');
                return;
            }
            screenStream = await shareScreen();
            const track = screenStream.getVideoTracks()[0];
            await Promise.all([...peers.values()].map(peer => peer.replaceVideoTrack(track)));
            addVideo('local', `${user.name} (screen)`, screenStream, true);
            event.currentTarget.classList.add('active');
            track.onended = () => document.getElementById('btn-screen').click();
        } catch (error) {
            showToast('Screen sharing was cancelled or unavailable', 'warning');
        }
    };
    
    // Recording Logic
    let mediaRecorder = null;
    let recordedChunks = [];
    let recordStream = null;
    const btnRecord = document.getElementById('btn-record');
    if (btnRecord) {
        btnRecord.onclick = async event => {
            if (mediaRecorder && mediaRecorder.state !== 'inactive') {
                mediaRecorder.stop();
                btnRecord.classList.remove('active');
                btnRecord.querySelector('.control-btn-label').textContent = 'Record';
                return;
            }

            try {
                recordStream = await navigator.mediaDevices.getDisplayMedia({
                    video: { displaySurface: 'browser' },
                    audio: true
                });

                // Mix Audio Tracks
                const audioCtx = new AudioContext();
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

                // Compress video: 2.5Mbps bitrate for high quality text
                const options = { mimeType: 'video/webm; codecs=vp8,opus', videoBitsPerSecond: 2500000 };
                try {
                    mediaRecorder = new MediaRecorder(mixedStream, options);
                } catch (e) {
                    console.warn('VP8/Opus fallback:', e);
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
                    btnRecord.querySelector('.control-btn-label').textContent = 'Record';
                    showToast('Recording downloaded locally', 'success');
                };

                recordStream.getVideoTracks()[0].onended = () => {
                    if (mediaRecorder.state !== 'inactive') mediaRecorder.stop();
                };

                mediaRecorder.start(1000);
                btnRecord.classList.add('active');
                btnRecord.querySelector('.control-btn-label').textContent = 'Stop Recording';
                showToast('Recording started (compressed)', 'info');

            } catch (err) {
                console.error(err);
                showToast('Recording cancelled', 'warning');
            }
        };
    }

    document.getElementById('btn-panel').onclick = () => document.getElementById('meeting-side-panel').classList.toggle('hidden');
    document.getElementById('chat-form').onsubmit = event => {
        event.preventDefault();
        const input = document.getElementById('chat-input');
        const text = input.value.trim();
        if (text && signaling.sendChat(text)) {
            appendMessage('You', text, true);
            input.value = '';
        }
    };
    document.querySelectorAll('.side-panel-tab').forEach(button => button.onclick = () => {
        document.querySelectorAll('.side-panel-tab').forEach(item => item.classList.toggle('active', item === button));
        ['chat', 'participants', 'notes'].forEach(name => {
            const panel = document.getElementById(`panel-${name}`);
            if (panel) panel.hidden = button.dataset.panel !== name;
        });
        document.getElementById('chat-form').hidden = button.dataset.panel !== 'chat';
    });
    document.getElementById('copy-room-link').onclick = async () => {
        try {
            await navigator.clipboard.writeText(location.href);
            showToast('Meeting link copied', 'success');
        } catch (e) {
            showToast('Failed to copy link. Check your permissions.', 'error');
        }
    };
    document.getElementById('save-meeting-notes')?.addEventListener('click', async () => {
        try {
            const summary = document.getElementById('meeting-notes').value.trim();
            await MeetingService.update(meetingId, { notes: { ...(meeting.notes || {}), summary } });
            showToast('Meeting notes saved', 'success');
        } catch (e) {
            showToast('Failed to save notes: ' + e.message, 'error');
        }
    });

    async function cleanup() {
        if (cleaned) return;
        cleaned = true;
        clearInterval(timer);
        if (mediaRecorder && mediaRecorder.state !== 'inactive') {
            mediaRecorder.stop(); // save recording if active
        }
        localStream?.getTracks().forEach(track => track.stop());
        stopScreenShare(screenStream);
        peers.forEach(peer => peer.close());
        signaling.disconnect();
    }
    document.getElementById('btn-end').onclick = async () => {
        if (isMentor) {
            const endForAll = confirm("Do you want to end this meeting for everyone? (Click OK to End For All, Cancel to just Leave)");
            if (endForAll) {
                try {
                    await MeetingService.update(meetingId, { status: 'COMPLETED' });
                } catch (e) {
                    showToast('Failed to sync meeting status. Leaving anyway...', 'warning');
                }
            }
        }
        await cleanup();
        navigateTo(String(user.role).toUpperCase() === 'STUDENT' ? '/student/meetings' : '/mentor/meetings');
    };
    window.addEventListener('hashchange', cleanup, { once: true });
    
    
    // Initialize preview immediately
    try {
        localStream = await getLocalStream();
        const previewVideo = document.getElementById('preview-video');
        if (previewVideo) previewVideo.srcObject = localStream;
        
        document.getElementById('preview-mic').onclick = () => {
            const isEnabled = toggleMic(localStream);
            document.getElementById('preview-mic').innerHTML = isEnabled ? '<i class="ph ph-microphone"></i>' : '<i class="ph ph-microphone-slash"></i>';
            document.getElementById('preview-mic').style.color = isEnabled ? 'inherit' : 'var(--danger)';
            // Sync with actual meeting button if it exists
            const mainMic = document.getElementById('btn-mic');
            if (mainMic) {
                mainMic.innerHTML = isEnabled ? '<i class="ph ph-microphone"></i><span class="control-btn-label">Mic</span>' : '<i class="ph ph-microphone-slash"></i><span class="control-btn-label">Mic</span>';
                if (!isEnabled) mainMic.classList.add('danger'); else mainMic.classList.remove('danger');
            }
        };
        
        document.getElementById('preview-cam').onclick = () => {
            const isEnabled = toggleCamera(localStream);
            document.getElementById('preview-cam').innerHTML = isEnabled ? '<i class="ph ph-video-camera"></i>' : '<i class="ph ph-video-camera-slash"></i>';
            document.getElementById('preview-cam').style.color = isEnabled ? 'inherit' : 'var(--danger)';
            const mainCam = document.getElementById('btn-cam');
            if (mainCam) {
                mainCam.innerHTML = isEnabled ? '<i class="ph ph-video-camera"></i><span class="control-btn-label">Camera</span>' : '<i class="ph ph-video-camera-slash"></i><span class="control-btn-label">Camera</span>';
                if (!isEnabled) mainCam.classList.add('danger'); else mainCam.classList.remove('danger');
            }
        };
    } catch (e) {
        console.warn('Could not initialize preview', e);
    }

    document.getElementById('btn-join-meeting').onclick = () => {
        document.getElementById('join-screen').remove();
        document.getElementById('meeting-waiting').hidden = false;
        init();
    };
}

