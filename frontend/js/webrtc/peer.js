import { STUN_SERVERS } from '/js/config.js';

export function createPeerConnection(signalingClient, localStream) {
    let pc = null;
    let onTrackCallback = null;
    let onConnectionStateChangeCallback = null;
    
    function init() {
        const configuration = {
            iceServers: STUN_SERVERS.length ? STUN_SERVERS : [{ urls: 'stun:stun.l.google.com:19302' }]
        };
        
        pc = new RTCPeerConnection(configuration);
        
        // Add local stream tracks to PC
        if (localStream) {
            localStream.getTracks().forEach(track => {
                pc.addTrack(track, localStream);
            });
        }
        
        // Handle incoming ICE candidates
        pc.onicecandidate = (event) => {
            if (event.candidate) {
                signalingClient.send('candidate', event.candidate);
            }
        };
        
        // Handle incoming media streams
        pc.ontrack = (event) => {
            if (onTrackCallback && event.streams && event.streams[0]) {
                onTrackCallback(event.streams[0]);
            }
        };
        
        pc.onconnectionstatechange = () => {
            if (onConnectionStateChangeCallback) {
                onConnectionStateChangeCallback(pc.connectionState);
            }
            console.log('[Peer] Connection state:', pc.connectionState);
        };
        
        // Set up signaling handlers
        signalingClient.onMessage('offer', handleOffer);
        signalingClient.onMessage('answer', handleAnswer);
        signalingClient.onMessage('candidate', addIceCandidate);
    }
    
    async function createOffer() {
        try {
            const offer = await pc.createOffer();
            await pc.setLocalDescription(offer);
            signalingClient.send('offer', offer);
            return offer;
        } catch (err) {
            console.error('[Peer] Error creating offer:', err);
            throw err;
        }
    }
    
    async function handleOffer(offer) {
        try {
            await pc.setRemoteDescription(new RTCSessionDescription(offer));
            const answer = await pc.createAnswer();
            await pc.setLocalDescription(answer);
            signalingClient.send('answer', answer);
        } catch (err) {
            console.error('[Peer] Error handling offer:', err);
        }
    }
    
    async function handleAnswer(answer) {
        try {
            await pc.setRemoteDescription(new RTCSessionDescription(answer));
        } catch (err) {
            console.error('[Peer] Error handling answer:', err);
        }
    }
    
    async function addIceCandidate(candidate) {
        try {
            if (pc.remoteDescription) {
                await pc.addIceCandidate(new RTCIceCandidate(candidate));
            } else {
                console.warn('[Peer] Ignored ICE candidate because remote description is not set');
            }
        } catch (err) {
            console.error('[Peer] Error adding ICE candidate:', err);
        }
    }
    
    function close() {
        if (pc) {
            pc.close();
            pc = null;
        }
    }
    
    function onTrack(cb) {
        onTrackCallback = cb;
    }
    
    function onConnectionStateChange(cb) {
        onConnectionStateChangeCallback = cb;
    }
    
    // Initialize right away
    init();
    
    return {
        pc,
        createOffer,
        handleOffer,
        addIceCandidate,
        close,
        onTrack,
        onConnectionStateChange
    };
}
