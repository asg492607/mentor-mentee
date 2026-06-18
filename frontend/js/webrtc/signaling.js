import { API_BASE_URL } from '/js/config.js';
import { getIdToken } from '/js/auth.js';

export function createSignaling(meetingId, user) {
    let ws = null;
    let handlers = {};
    let connected = false;
    let intentionalClose = false;

    async function connect() {
        const token = await getIdToken();
        if (!token) throw new Error('You must be signed in to join a meeting');
        const wsBase = API_BASE_URL.replace(/^http:/, 'ws:').replace(/^https:/, 'wss:');
        const url = `${wsBase}/ws/meeting/${encodeURIComponent(meetingId)}?token=${encodeURIComponent(token)}`;

        ws = new WebSocket(url);
        ws.onopen = () => {
            connected = true;
            ws.send(JSON.stringify({ type: 'join', name: user?.name || 'Participant' }));
            emit('connect');
        };
        ws.onmessage = event => {
            const message = JSON.parse(event.data);
            emit(message.type, message);
            emit('*', message);
        };
        ws.onerror = () => emit('error', new Error('Could not connect to the meeting server'));
        ws.onclose = event => {
            connected = false;
            emit('disconnect', event);
            if (!intentionalClose && event.code >= 4400) {
                emit('error', new Error(event.reason || 'Meeting access was rejected'));
            }
        };
    }

    function emit(type, payload) {
        (handlers[type] || []).forEach(callback => callback(payload));
    }

    function onMessage(type, callback) {
        handlers[type] = handlers[type] || [];
        handlers[type].push(callback);
        return () => {
            handlers[type] = (handlers[type] || []).filter(item => item !== callback);
        };
    }

    function sendSignal(to, signal) {
        return sendRaw({ type: 'signal', to, signal });
    }

    function sendChat(text) {
        return sendRaw({ type: 'chat', text });
    }

    function sendRaw(message) {
        if (!connected || ws?.readyState !== WebSocket.OPEN) return false;
        ws.send(JSON.stringify(message));
        return true;
    }

    function disconnect() {
        intentionalClose = true;
        ws?.close(1000, 'Participant left');
        ws = null;
    }

    return {
        connect,
        onMessage,
        sendSignal,
        sendChat,
        disconnect,
        get isConnected() { return connected; }
    };
}
