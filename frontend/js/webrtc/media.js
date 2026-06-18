export async function getLocalStream(video = true, audio = true) {
    try {
        return await navigator.mediaDevices.getUserMedia({ video, audio });
    } catch (err) {
        console.warn('[Media] Camera and microphone unavailable, retrying audio only:', err);
        try {
            return await navigator.mediaDevices.getUserMedia({ video: false, audio: true });
        } catch (audioErr) {
            console.warn('[Media] Joining without local media:', audioErr);
            return new MediaStream();
        }
    }
}

export function toggleCamera(stream) {
    if (!stream) return false;
    const videoTracks = stream.getVideoTracks();
    if (videoTracks.length === 0) return false;
    
    const track = videoTracks[0];
    track.enabled = !track.enabled;
    return track.enabled;
}

export function toggleMic(stream) {
    if (!stream) return false;
    const audioTracks = stream.getAudioTracks();
    if (audioTracks.length === 0) return false;
    
    const track = audioTracks[0];
    track.enabled = !track.enabled;
    return track.enabled;
}

export async function shareScreen() {
    try {
        const stream = await navigator.mediaDevices.getDisplayMedia({
            video: { cursor: "always" },
            audio: false
        });
        return stream;
    } catch (err) {
        console.error('[Media] Error sharing screen:', err);
        throw err;
    }
}

export function stopScreenShare(stream) {
    if (!stream) return;
    stream.getTracks().forEach(track => {
        track.stop();
    });
}
