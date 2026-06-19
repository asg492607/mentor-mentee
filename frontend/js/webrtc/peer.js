import { STUN_SERVERS } from '/js/config.js';

export function createPeerConnection(signaling, localStream, remoteId) {
    const pc = new RTCPeerConnection(STUN_SERVERS);
    const pendingCandidates = [];
    let onTrackCallback = null;

    localStream?.getTracks().forEach(track => pc.addTrack(track, localStream));

    pc.onicecandidate = event => {
        if (event.candidate) signaling.sendSignal(remoteId, { candidate: event.candidate.toJSON() });
    };
    pc.ontrack = event => {
        if (event.streams?.[0]) onTrackCallback?.(event.streams[0]);
    };

    async function createOffer() {
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        signaling.sendSignal(remoteId, { description: pc.localDescription.toJSON() });
    }

    async function handleSignal(signal) {
        if (signal.description) {
            await pc.setRemoteDescription(signal.description);
            while (pendingCandidates.length) {
                await pc.addIceCandidate(pendingCandidates.shift());
            }
            if (signal.description.type === 'offer') {
                const answer = await pc.createAnswer();
                await pc.setLocalDescription(answer);
                signaling.sendSignal(remoteId, { description: pc.localDescription.toJSON() });
            }
        }
        if (signal.candidate) {
            if (pc.remoteDescription) await pc.addIceCandidate(signal.candidate);
            else pendingCandidates.push(signal.candidate);
        }
    }

    function replaceVideoTrack(track) {
        const sender = pc.getSenders().find(item => item.track?.kind === 'video');
        return sender ? sender.replaceTrack(track) : Promise.resolve();
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
