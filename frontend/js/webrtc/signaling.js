import { db } from '/js/firebase-init.js';
import { collection, doc, setDoc, deleteDoc, onSnapshot, query, where, addDoc } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';

export function createSignaling(meetingId, user) {
    let handlers = {};
    let connected = false;
    let intentionalClose = false;
    let selfId = Math.random().toString(36).substring(2, 10);
    let unsubscribes = [];
    let myPresenceRef = null;

    async function connect() {
        try {
            const sigRef = collection(db, 'meetings', meetingId, 'signaling');

            // Listen for presence changes FIRST to build roster and catch new joins
            let initialPresenceDone = false;
            const unsubPresence = onSnapshot(query(sigRef, where('type', '==', 'presence')), snapshot => {
                const peers = [];
                snapshot.docChanges().forEach(change => {
                    const data = change.doc.data();
                    if (data.id === selfId) return;
                    
                    if (change.type === 'added') {
                        if (!initialPresenceDone) {
                            peers.push({ id: data.id, name: data.name });
                        } else {
                            emit('peer-joined', { id: data.id, name: data.name });
                        }
                    }
                    if (change.type === 'removed') {
                        emit('peer-left', { id: data.id });
                    }
                });

                if (!initialPresenceDone) {
                    initialPresenceDone = true;
                    // Now that we have initial peers, announce ourselves
                    myPresenceRef = doc(sigRef, `presence_${selfId}`);
                    setDoc(myPresenceRef, { type: 'presence', id: selfId, name: user?.name || 'Participant' }).then(() => {
                        connected = true;
                        emit('joined', { id: selfId, peers });
                        emit('connect');
                    });
                }
            }, err => {
                emit('error', new Error('Permission denied or network error'));
            });
            unsubscribes.push(unsubPresence);

            // Listen for messages (signals and chats)
            let isInitialMessages = true;
            const unsubMessages = onSnapshot(query(sigRef, where('type', 'in', ['signal', 'chat'])), snapshot => {
                snapshot.docChanges().forEach(change => {
                    if (change.type === 'added') {
                        const data = change.doc.data();
                        if (data.from === selfId) return;

                        if (!isInitialMessages) {
                            if (data.type === 'signal' && data.to === selfId) {
                                emit('signal', { from: data.from, name: data.name, signal: data.signal });
                                // Clean up consumed signals to save space
                                deleteDoc(change.doc.ref).catch(()=>{});
                            } else if (data.type === 'chat') {
                                emit('chat', { name: data.name, text: data.text });
                            }
                        }
                    }
                });
                isInitialMessages = false;
            });
            unsubscribes.push(unsubMessages);

            window.addEventListener('beforeunload', disconnect);
        } catch (e) {
            emit('error', new Error('Could not connect to meeting server: ' + e.message));
        }
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

    async function sendSignal(to, signal) {
        if (!connected) return false;
        try {
            await addDoc(collection(db, 'meetings', meetingId, 'signaling'), {
                type: 'signal', from: selfId, to, name: user?.name, signal
            });
            return true;
        } catch(e) { return false; }
    }

    async function sendChat(text) {
        if (!connected) return false;
        try {
            await addDoc(collection(db, 'meetings', meetingId, 'signaling'), {
                type: 'chat', from: selfId, name: user?.name, text
            });
            return true;
        } catch(e) { return false; }
    }

    async function disconnect() {
        if (intentionalClose) return;
        intentionalClose = true;
        unsubscribes.forEach(unsub => unsub());
        if (myPresenceRef) {
            await deleteDoc(myPresenceRef).catch(()=>{});
        }
        connected = false;
    }

    return {
        connect,
        onMessage,
        sendSignal,
        sendChat,
        disconnect,
        get isConnected() { return connected; },
        get selfId() { return selfId; },
        set selfId(val) { selfId = val; }
    };
}
