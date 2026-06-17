import { createSignaling } from '/js/webrtc/signaling.js';
import { createPeerConnection } from '/js/webrtc/peer.js';
import { getLocalStream, toggleCamera, toggleMic, shareScreen, stopScreenShare } from '/js/webrtc/media.js';
import { createMeetingChat } from '/js/webrtc/chat.js';
import { getUserProfile } from '/js/auth.js';
import { navigateTo } from '/js/router.js';
import { showToast } from '/js/components/toast.js';

export async function render(container) {
    const urlParams = new URLSearchParams(window.location.href.split('?')[1]);
    const meetingId = urlParams.get('id');
    const user = getUserProfile();

    if (!meetingId) {
        showToast('Invalid meeting ID', 'error');
        navigateTo('/dashboard');
        return;
    }

    container.innerHTML = `
        <div class="h-screen w-full bg-gray-900 flex flex-col md:flex-row relative fade-in">
            <!-- Main Video Area -->
            <div class="flex-1 flex flex-col relative h-full">
                <!-- Header -->
                <div class="absolute top-0 w-full p-4 flex justify-between items-center z-10 bg-gradient-to-b from-black/70 to-transparent">
                    <h2 class="text-white font-bold text-lg">Meeting Room: ${meetingId}</h2>
                    <div class="bg-gray-800/80 rounded px-3 py-1 text-white text-sm" id="connection-status">
                        Connecting...
                    </div>
                </div>

                <!-- Video Grid -->
                <div class="flex-1 bg-black p-4 flex items-center justify-center relative">
                    <div class="w-full h-full max-w-5xl relative flex items-center justify-center">
                        <video id="remote-video" class="w-full h-full object-cover rounded-xl bg-gray-800" autoplay playsinline></video>
                        <div id="remote-placeholder" class="absolute inset-0 flex flex-col items-center justify-center text-gray-400">
                            <i class="fas fa-user-circle text-6xl mb-4"></i>
                            <p>Waiting for others to join...</p>
                        </div>
                    </div>
                    
                    <!-- Local Video (PiP) -->
                    <div class="absolute bottom-24 right-4 w-48 h-36 bg-gray-800 rounded-lg overflow-hidden border-2 border-gray-700 shadow-xl z-20">
                        <video id="local-video" class="w-full h-full object-cover" autoplay playsinline muted></video>
                    </div>
                </div>

                <!-- Controls Bar -->
                <div class="h-20 bg-gray-900/90 backdrop-blur border-t border-gray-800 flex items-center justify-center gap-4 px-6 z-20">
                    <button id="btn-mic" class="w-12 h-12 rounded-full bg-gray-700 text-white hover:bg-gray-600 flex items-center justify-center transition-colors">
                        <i class="fas fa-microphone"></i>
                    </button>
                    <button id="btn-cam" class="w-12 h-12 rounded-full bg-gray-700 text-white hover:bg-gray-600 flex items-center justify-center transition-colors">
                        <i class="fas fa-video"></i>
                    </button>
                    <button id="btn-screen" class="w-12 h-12 rounded-full bg-gray-700 text-white hover:bg-gray-600 flex items-center justify-center transition-colors">
                        <i class="fas fa-desktop"></i>
                    </button>
                    <button id="btn-chat" class="w-12 h-12 rounded-full bg-gray-700 text-white hover:bg-gray-600 flex items-center justify-center transition-colors md:hidden">
                        <i class="fas fa-comment"></i>
                    </button>
                    <button id="btn-end" class="w-16 h-12 rounded-3xl bg-red-600 text-white hover:bg-red-700 flex items-center justify-center transition-colors ml-4 px-4 font-bold">
                        End Call
                    </button>
                </div>
            </div>

            <!-- Sidebar (Chat/Notes) -->
            <div id="meeting-sidebar" class="w-full md:w-80 bg-gray-800 border-l border-gray-700 flex flex-col h-full transform transition-transform duration-300 z-30">
                <div class="flex border-b border-gray-700">
                    <button class="flex-1 py-4 text-white font-medium border-b-2 border-primary" id="tab-chat">Chat</button>
                    ${user.role === 'mentor' ? '<button class="flex-1 py-4 text-gray-400 font-medium border-b-2 border-transparent" id="tab-notes">Notes</button>' : ''}
                </div>
                
                <!-- Chat Panel -->
                <div id="panel-chat" class="flex-1 flex flex-col h-full overflow-hidden">
                    <div id="chat-messages" class="flex-1 overflow-y-auto p-4 space-y-4">
                        <!-- Messages go here -->
                    </div>
                    <div class="p-4 border-t border-gray-700">
                        <form id="chat-form" class="flex gap-2">
                            <input type="text" id="chat-input" class="flex-1 bg-gray-700 text-white rounded px-3 py-2 outline-none focus:ring-2 focus:ring-primary" placeholder="Type a message...">
                            <button type="submit" class="bg-primary text-white rounded px-4 py-2 hover:bg-blue-600">
                                <i class="fas fa-paper-plane"></i>
                            </button>
                        </form>
                    </div>
                </div>

                <!-- Notes Panel (Mentor Only) -->
                ${user.role === 'mentor' ? `
                <div id="panel-notes" class="flex-1 flex flex-col h-full overflow-hidden hidden p-4">
                    <textarea class="w-full h-full bg-gray-700 text-white rounded p-3 outline-none resize-none" placeholder="Take meeting notes here..."></textarea>
                    <button class="btn btn-primary mt-4 w-full">Save Notes</button>
                </div>
                ` : ''}
            </div>
        </div>
    `;

    // Elements
    const localVideo = document.getElementById('local-video');
    const remoteVideo = document.getElementById('remote-video');
    const remotePlaceholder = document.getElementById('remote-placeholder');
    const statusEl = document.getElementById('connection-status');
    const chatMessages = document.getElementById('chat-messages');
    
    // State
    let localStream = null;
    let screenStream = null;
    let isCamOn = true;
    let isMicOn = true;
    
    // WebRTC Setup
    const signaling = createSignaling(meetingId);
    let peer = null;
    let chat = null;

    async function initRoom() {
        try {
            // 1. Get media
            localStream = await getLocalStream();
            localVideo.srcObject = localStream;
            
            // 2. Connect signaling
            signaling.connect();
            
            // 3. Setup peer connection when signaling connects
            signaling.onMessage('connect', async () => {
                statusEl.textContent = 'Connected to room';
                statusEl.className = 'bg-green-600 rounded px-3 py-1 text-white text-sm';
                
                peer = createPeerConnection(signaling, localStream);
                chat = createMeetingChat(signaling);
                
                // Handle remote track
                peer.onTrack((stream) => {
                    remoteVideo.srcObject = stream;
                    remotePlaceholder.style.display = 'none';
                });
                
                // Handle chat messages
                chat.onMessage(appendChatMessage);
                
                // Announce joining and initiate offer
                signaling.send('user-joined', { userId: user.id, name: user.name });
                await peer.createOffer();
            });
            
            signaling.onMessage('user-joined', async () => {
                // If another user joins, recreate offer
                if (peer) await peer.createOffer();
            });

            signaling.onMessage('user-left', () => {
                remoteVideo.srcObject = null;
                remotePlaceholder.style.display = 'flex';
                showToast('User left the meeting', 'info');
            });

        } catch (err) {
            console.error('Room init error:', err);
            showToast('Failed to access camera/microphone', 'error');
            statusEl.textContent = 'Error';
            statusEl.className = 'bg-red-600 rounded px-3 py-1 text-white text-sm';
        }
    }

    // UI Controls
    document.getElementById('btn-mic').addEventListener('click', (e) => {
        isMicOn = toggleMic(localStream);
        const icon = e.currentTarget.querySelector('i');
        icon.className = isMicOn ? 'fas fa-microphone' : 'fas fa-microphone-slash text-red-400';
    });

    document.getElementById('btn-cam').addEventListener('click', (e) => {
        isCamOn = toggleCamera(localStream);
        const icon = e.currentTarget.querySelector('i');
        icon.className = isCamOn ? 'fas fa-video' : 'fas fa-video-slash text-red-400';
    });

    document.getElementById('btn-screen').addEventListener('click', async (e) => {
        try {
            if (!screenStream) {
                screenStream = await shareScreen();
                // Replace video track
                const videoTrack = screenStream.getVideoTracks()[0];
                const sender = peer.pc.getSenders().find(s => s.track.kind === 'video');
                sender.replaceTrack(videoTrack);
                
                localVideo.srcObject = screenStream;
                e.currentTarget.classList.add('bg-blue-600');
                
                videoTrack.onended = () => {
                    stopScreenSharing();
                };
            } else {
                stopScreenSharing();
            }
        } catch (err) {
            console.error('Screen share error', err);
        }
    });

    function stopScreenSharing() {
        if (screenStream) {
            stopScreenShare(screenStream);
            screenStream = null;
            // Restore local camera
            const videoTrack = localStream.getVideoTracks()[0];
            const sender = peer.pc.getSenders().find(s => s.track.kind === 'video');
            sender.replaceTrack(videoTrack);
            localVideo.srcObject = localStream;
            document.getElementById('btn-screen').classList.remove('bg-blue-600');
        }
    }

    document.getElementById('btn-end').addEventListener('click', () => {
        cleanup();
        navigateTo(`/${user.role}/dashboard`);
    });

    // Chat functionality
    document.getElementById('chat-form').addEventListener('submit', (e) => {
        e.preventDefault();
        const input = document.getElementById('chat-input');
        const text = input.value.trim();
        if (text && chat) {
            const msg = chat.sendMessage(user.name, text);
            appendChatMessage(msg);
            input.value = '';
        }
    });

    function appendChatMessage(msg) {
        const isMe = msg.sender === user.name;
        const div = document.createElement('div');
        div.className = `flex flex-col ${isMe ? 'items-end' : 'items-start'}`;
        div.innerHTML = `
            <span class="text-xs text-gray-400 mb-1">${isMe ? 'You' : msg.sender}</span>
            <div class="${isMe ? 'bg-primary' : 'bg-gray-700'} text-white px-3 py-2 rounded-lg max-w-[80%] break-words text-sm">
                ${msg.text}
            </div>
        `;
        chatMessages.appendChild(div);
        chatMessages.scrollTop = chatMessages.scrollHeight;
    }

    // Tabs
    const tabChat = document.getElementById('tab-chat');
    const tabNotes = document.getElementById('tab-notes');
    const panelChat = document.getElementById('panel-chat');
    const panelNotes = document.getElementById('panel-notes');

    if (tabNotes) {
        tabChat.addEventListener('click', () => {
            tabChat.className = 'flex-1 py-4 text-white font-medium border-b-2 border-primary';
            tabNotes.className = 'flex-1 py-4 text-gray-400 font-medium border-b-2 border-transparent';
            panelChat.classList.remove('hidden');
            panelNotes.classList.add('hidden');
        });
        tabNotes.addEventListener('click', () => {
            tabNotes.className = 'flex-1 py-4 text-white font-medium border-b-2 border-primary';
            tabChat.className = 'flex-1 py-4 text-gray-400 font-medium border-b-2 border-transparent';
            panelNotes.classList.remove('hidden');
            panelChat.classList.add('hidden');
        });
    }

    // Cleanup on unmount
    function cleanup() {
        if (localStream) {
            localStream.getTracks().forEach(t => t.stop());
        }
        if (screenStream) {
            stopScreenShare(screenStream);
        }
        if (peer) {
            peer.close();
        }
        if (signaling) {
            signaling.send('user-left', { userId: user.id });
            signaling.disconnect();
        }
    }
    
    // Listen to route changes to cleanup
    window.addEventListener('hashchange', function onHash() {
        cleanup();
        window.removeEventListener('hashchange', onHash);
    });

    // Start
    initRoom();
}
