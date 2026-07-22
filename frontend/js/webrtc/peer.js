import { STUN_SERVERS } from '/js/config.js';

export function createPeerConnection(signaling, localStream, remoteId) {
    const pc = new RTCPeerConnection(STUN_SERVERS);
    const pendingCandidates = [];
    let onTrackCallback = null;

    if (localStream && localStream.getTracks) {
        localStream.getTracks().forEach(track => {
            try {
                pc.addTrack(track, localStream);
            } catch (e) {
                console.warn('[WebRTC] Add track warning:', e);
            }
        });
    }

    pc.onicecandidate = event => {
        if (event.candidate) signaling.sendSignal(remoteId, { candidate: event.candidate.toJSON() });
    };

    pc.ontrack = event => {
        const stream = (event.streams && event.streams[0]) ? event.streams[0] : new MediaStream([event.track]);
        if (onTrackCallback) onTrackCallback(stream);
    };

    async function createOffer() {
        try {
            const offer = await pc.createOffer();
            await pc.setLocalDescription(offer);
            signaling.sendSignal(remoteId, { description: pc.localDescription.toJSON() });
        } catch (e) {
            console.error('[WebRTC] Error creating offer:', e);
        }
    }

    async function addCandidateSafely(candidateData) {
        if (!candidateData) return;
        try {
            const candidate = new RTCIceCandidate(candidateData);
            if (pc.remoteDescription && pc.remoteDescription.type) {
                await pc.addIceCandidate(candidate);
            } else {
                pendingCandidates.push(candidate);
            }
        } catch (e) {
            console.warn('[WebRTC] ICE candidate add warning:', e);
        }
    }

    async function handleSignal(signal) {
        try {
            if (signal.description) {
                await pc.setRemoteDescription(new RTCSessionDescription(signal.description));
                while (pendingCandidates.length) {
                    const cand = pendingCandidates.shift();
                    try {
                        await pc.addIceCandidate(cand);
                    } catch (e) {
                        console.warn('[WebRTC] Error flushing candidate:', e);
                    }
                }
                if (signal.description.type === 'offer') {
                    const answer = await pc.createAnswer();
                    await pc.setLocalDescription(answer);
                    signaling.sendSignal(remoteId, { description: pc.localDescription.toJSON() });
                }
            }
            if (signal.candidate) {
                await addCandidateSafely(signal.candidate);
            }
        } catch (e) {
            console.error('[WebRTC] Error handling signal:', e);
        }
    }

    function replaceVideoTrack(track) {
        if (!track) return Promise.resolve();
        const sender = pc.getSenders().find(item => item.track?.kind === 'video');
        if (sender) {
            return sender.replaceTrack(track);
        } else if (localStream) {
            try {
                pc.addTrack(track, localStream);
            } catch (e) {
                console.warn('[WebRTC] addTrack error:', e);
            }
        }
        return Promise.resolve();
    }

    return {
        pc,
        createOffer,
        handleSignal,
        replaceVideoTrack,
        onTrack(callback) { onTrackCallback = callback; },
        close() { pc.close(); }
    };
}
