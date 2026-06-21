import { db } from '/js/firebase-init.js';
import { collection, doc, setDoc, deleteDoc, onSnapshot, query, where, addDoc, getDocs } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';

export function createSignaling(meetingId, user) {
    let handlers = {};
    let connected = false;
    let intentionalClose = false;
    let selfId = Math.random().toString(36).substring(2, 10);
    let unsubscribes = [];
    let myPresenceRef = null;
    const isHost = ['FACULTY', 'MENTOR', 'HOD', 'DEAN', 'SECTION_HEAD', 'ADMIN'].includes(String(user?.role).toUpperCase());

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
                    if (isHost) {
                        myPresenceRef = doc(sigRef, `presence_${selfId}`);
                        setDoc(myPresenceRef, { type: 'presence', id: selfId, name: user?.name || 'Participant' }).then(() => {
                            connected = true;
                            emit('joined', { id: selfId, peers });
                            emit('connect');
                        });
                    } else {
                        myPresenceRef = doc(sigRef, `waiting_${selfId}`);
                        setDoc(myPresenceRef, { type: 'waiting', id: selfId, name: user?.name || 'Participant' }).then(() => {
                            emit('waiting');
                        });
                    }
                }
            }, err => {
                emit('error', new Error('Permission denied or network error'));
            });
            unsubscribes.push(unsubPresence);

            if (isHost) {
                const unsubWaiting = onSnapshot(query(sigRef, where('type', '==', 'waiting')), snapshot => {
                    snapshot.docChanges().forEach(change => {
                        const data = change.doc.data();
                        if (change.type === 'added') emit('guest-waiting', { id: data.id, name: data.name });
                        if (change.type === 'removed') emit('guest-left-waiting', { id: data.id });
                    });
                });
                unsubscribes.push(unsubWaiting);
            }

            // Listen for messages (signals, chats, controls)
            let isInitialMessages = true;
            const unsubMessages = onSnapshot(query(sigRef, where('type', 'in', ['signal', 'chat', 'control'])), snapshot => {
                snapshot.docChanges().forEach(change => {
                    if (change.type === 'added') {
                        const data = change.doc.data();
                        if (data.from === selfId) return;

                        if (!isInitialMessages || data.type === 'control') {
                            if (data.type === 'signal' && data.to === selfId) {
                                emit('signal', { from: data.from, name: data.name, signal: data.signal });
                                deleteDoc(change.doc.ref).catch(()=>{});
                            } else if (data.type === 'chat') {
                                emit('chat', { name: data.name, text: data.text });
                            } else if (data.type === 'control' && data.to === selfId) {
                                handleControlMessage(data.action);
                                deleteDoc(change.doc.ref).catch(()=>{});
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

    async function handleControlMessage(action) {
        if (action === 'admit') {
            if (myPresenceRef) await deleteDoc(myPresenceRef).catch(()=>{});
            const sigRef = collection(db, 'meetings', meetingId, 'signaling');
            myPresenceRef = doc(sigRef, `presence_${selfId}`);
            await setDoc(myPresenceRef, { type: 'presence', id: selfId, name: user?.name || 'Participant' });
            connected = true;
            const presenceDocs = await getDocs(query(sigRef, where('type', '==', 'presence')));
            const peers = presenceDocs.docs.map(d => d.data()).filter(d => d.id !== selfId);
            emit('joined', { id: selfId, peers });
            emit('connect');
        } else if (action === 'deny' || action === 'remove') {
            emit('kicked', { reason: action });
            disconnect();
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

    async function sendControl(to, action) {
        try {
            await addDoc(collection(db, 'meetings', meetingId, 'signaling'), {
                type: 'control', from: selfId, to, action
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
        sendControl,
        disconnect,
        get isConnected() { return connected; },
        get selfId() { return selfId; },
        set selfId(val) { selfId = val; }
    };
}
