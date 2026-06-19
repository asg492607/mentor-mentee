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
    if (!meeting || ![meeting.studentId, meeting.mentorId].includes(user.id)) {
        showToast('You do not have access to this meeting', 'error');
        navigateTo('/');
        return;
    }
    if (!['APPROVED', 'ONGOING'].includes(meeting.status)) {
        showToast('This meeting is not ready to join', 'warning');
        navigateTo('/');
        return;
    }

    const isMentor = ['FACULTY', 'MENTOR'].includes(String(user.role).toUpperCase());
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
            <div class="meeting-waiting" id="meeting-waiting">
              <div class="pulse-ring"><div class="avatar avatar-lg">${escapeHtml((user.name || '?')[0])}</div></div>
              <h2>Waiting for the other participant</h2>
              <p>Keep this tab open. The call connects automatically.</p>
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
          <button class="control-btn" id="btn-mic"><span class="control-btn-icon">Mic</span><span class="control-btn-label">Microphone</span></button>
          <button class="control-btn" id="btn-cam"><span class="control-btn-icon">Cam</span><span class="control-btn-label">Camera</span></button>
          <button class="control-btn" id="btn-screen"><span class="control-btn-icon">Share</span><span class="control-btn-label">Share screen</span></button>
          <button class="control-btn" id="btn-panel"><span class="control-btn-icon">Chat</span><span class="control-btn-label">Chat</span></button>
          <button class="control-btn end-call" id="btn-end"><span class="control-btn-icon">End</span><span class="control-btn-label">Leave</span></button>
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
    let timer;
    let cleaned = false;

    function addVideo(id, name, stream, muted = false) {
        waiting?.remove();
        let tile = document.querySelector(`[data-peer="${id}"]`);
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
        document.getElementById('chat-messages').append(row);
        row.scrollIntoView({ block: 'nearest' });
    }

    function renderRoster(participants = []) {
        document.getElementById('panel-participants').innerHTML = participants.map(person =>
            `<div class="participant-item"><div class="avatar avatar-sm">${escapeHtml((person.name || '?')[0])}</div><span class="participant-name">${escapeHtml(person.name)}${person.id === signaling.selfId ? ' (you)' : ''}</span></div>`
        ).join('');
    }

    function handleError(error) {
        console.error(error);
        status.textContent = error.message || 'Connection error';
        showToast(error.message || 'Meeting connection failed', 'error');
    }

    let participants = [];

    async function init() {
        try {
            localStream = await getLocalStream();
            addVideo('local', `${user.name} (you)`, localStream, true);
            signaling.onMessage('joined', message => {
                signaling.selfId = message.id;
                participants = [{ id: message.id, name: user.name }, ...message.peers];
                renderRoster(participants);
                message.peers.forEach(person => createPeer(person.id, person.name, true));
            });
            signaling.onMessage('peer-joined', message => {
                participants.push({ id: message.id, name: message.name });
                renderRoster(participants);
                createPeer(message.id, message.name, false);
            });
            signaling.onMessage('signal', message => createPeer(message.from, message.name, false).handleSignal(message.signal).catch(handleError));
            signaling.onMessage('peer-left', message => {
                participants = participants.filter(p => p.id !== message.id);
                renderRoster(participants);
                peers.get(message.id)?.close();
                peers.delete(message.id);
                document.querySelector(`[data-peer="${message.id}"]`)?.remove();
                showToast('A participant left the meeting', 'info');
            });
            signaling.onMessage('chat', message => appendMessage(message.name, message.text));
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
            await MeetingService.update(meetingId, { status: 'ONGOING', startedAt: meeting.startedAt || new Date().toISOString() });
        } catch (error) {
            handleError(error);
        }
    }

    document.getElementById('btn-mic').onclick = event => event.currentTarget.classList.toggle('active', !toggleMic(localStream));
    document.getElementById('btn-cam').onclick = event => event.currentTarget.classList.toggle('active', !toggleCamera(localStream));
    document.getElementById('btn-screen').onclick = async event => {
        try {
            if (screenStream) {
                stopScreenShare(screenStream);
                screenStream = null;
                const camera = localStream.getVideoTracks()[0];
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
        await navigator.clipboard.writeText(location.href);
        showToast('Meeting link copied', 'success');
    };
    document.getElementById('save-meeting-notes')?.addEventListener('click', async () => {
        const summary = document.getElementById('meeting-notes').value.trim();
        await MeetingService.update(meetingId, { notes: { ...(meeting.notes || {}), summary } });
        showToast('Meeting notes saved', 'success');
    });

    async function cleanup() {
        if (cleaned) return;
        cleaned = true;
        clearInterval(timer);
        localStream?.getTracks().forEach(track => track.stop());
        stopScreenShare(screenStream);
        peers.forEach(peer => peer.close());
        signaling.disconnect();
    }
    document.getElementById('btn-end').onclick = async () => {
        await cleanup();
        navigateTo(String(user.role).toUpperCase() === 'STUDENT' ? '/student/meetings' : '/mentor/meetings');
    };
    window.addEventListener('hashchange', cleanup, { once: true });
    init();
}
