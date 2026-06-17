export function createMeetingChat(signalingClient) {
    const history = [];
    let onMessageCallback = null;
    
    // Listen for incoming chat messages
    signalingClient.onMessage('chat', (msg) => {
        history.push(msg);
        if (onMessageCallback) {
            onMessageCallback(msg);
        }
    });
    
    function sendMessage(sender, text) {
        const msg = {
            sender,
            text,
            timestamp: new Date().toISOString()
        };
        
        // Add to local history
        history.push(msg);
        
        // Send via signaling
        signalingClient.send('chat', msg);
        
        return msg;
    }
    
    function onMessage(cb) {
        onMessageCallback = cb;
    }
    
    function getHistory() {
        return [...history];
    }
    
    return {
        sendMessage,
        onMessage,
        getHistory
    };
}
