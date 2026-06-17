import { API_BASE_URL } from '/js/config.js';

export function createSignaling(meetingId) {
    let ws = null;
    let messageHandlers = {};
    let isConnected = false;
    let reconnectAttempts = 0;
    const MAX_RECONNECT_ATTEMPTS = 5;
    
    function connect() {
        // Replace http/https with ws/wss
        const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        // Extract host from API_BASE_URL or use current host
        const wsHost = API_BASE_URL.replace(/^https?:\/\//, '');
        
        // Use default api url if absolute, otherwise derive from current window
        let wsUrl = '';
        if (API_BASE_URL.startsWith('http')) {
            wsUrl = `${API_BASE_URL.replace(/^http/, 'ws')}/ws/meeting/${meetingId}`;
        } else {
            wsUrl = `ws://localhost:8000/ws/meeting/${meetingId}`;
        }

        try {
            ws = new WebSocket(wsUrl);
            
            ws.onopen = () => {
                console.log('[Signaling] Connected to signaling server');
                isConnected = true;
                reconnectAttempts = 0;
                if (messageHandlers['connect']) {
                    messageHandlers['connect']();
                }
            };
            
            ws.onmessage = (event) => {
                try {
                    const msg = JSON.parse(event.data);
                    if (messageHandlers[msg.type]) {
                        messageHandlers[msg.type](msg.payload);
                    }
                    if (messageHandlers['*']) {
                        messageHandlers['*'](msg);
                    }
                } catch (e) {
                    console.error('[Signaling] Error parsing message', e);
                }
            };
            
            ws.onclose = () => {
                console.log('[Signaling] Disconnected');
                isConnected = false;
                if (messageHandlers['disconnect']) {
                    messageHandlers['disconnect']();
                }
                
                // Auto reconnect
                if (reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
                    reconnectAttempts++;
                    console.log(`[Signaling] Reconnecting... Attempt ${reconnectAttempts}`);
                    setTimeout(connect, 2000 * reconnectAttempts);
                }
            };
            
            ws.onerror = (err) => {
                console.error('[Signaling] WebSocket error:', err);
            };
        } catch (error) {
            console.error('[Signaling] Failed to connect', error);
        }
    }
    
    function send(type, payload) {
        if (!isConnected || !ws) {
            console.warn('[Signaling] Cannot send message, not connected');
            return false;
        }
        ws.send(JSON.stringify({ type, payload }));
        return true;
    }
    
    function onMessage(type, callback) {
        messageHandlers[type] = callback;
    }
    
    function disconnect() {
        if (ws) {
            ws.close();
            ws = null;
        }
    }
    
    return {
        connect,
        send,
        onMessage,
        disconnect,
        get isConnected() { return isConnected; }
    };
}
