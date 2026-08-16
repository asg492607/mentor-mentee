import { db } from '/js/firebase-init.js';
import { collection, doc, setDoc, deleteDoc, onSnapshot, query, where, addDoc, getDocs } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';

export function createSignaling(meetingId, user, isHostExplicit = null) {
    let handlers = {};
    let connected = false;
    let intentionalClose = false;
    let selfId = Math.random().toString(36).substring(2, 10);
    let unsubscribes = [];
    let myPresenceRef = null;
    let pruneInterval = null;
    const isHost = isHostExplicit !== null ? !!isHostExplicit : ['FACULTY', 'MENTOR', 'HOD', 'DEAN', 'SECTION_HEAD', 'ADMIN'].includes(String(user?.role).toUpperCase());

    async function connect() {
        try {
            const sigRef = collection(db, 'meetings', meetingId, 'signaling');

            // Cleanup any orphaned presence/waiting documents from previous crashed sessions
            if (user?.id) {
                const orphansSnapshot = await getDocs(query(sigRef, where('userId', '==', user.id)));
                orphansSnapshot.forEach(doc => deleteDoc(doc.ref).catch(() => {}));
            }

            // Listen for room settings changes
            const settingsRef = doc(db, 'meetings', meetingId, 'controls', 'settings');
            const unsubSettings = onSnapshot(settingsRef, snapshot => {
                if (snapshot.exists()) {
                    emit('room-settings', snapshot.data());
                }
            }, () => {});
            unsubscribes.push(unsubSettings);

            // Listen for presence changes FIRST to build roster and catch new joins
            let initialPresenceDone = false;
            const unsubPresence = onSnapshot(query(sigRef, where('type', '==', 'presence')), snapshot => {
                const peers = [];
                snapshot.docChanges().forEach(change => {
                    const data = change.doc.data();
                    if (data.id === selfId) return;
                    
                    if (change.type === 'added') {
                        if (!initialPresenceDone) {
                            peers.push({ id: data.id, name: data.name, isHost: !!data.isHost });
                        } else {
                            emit('peer-joined', { id: data.id, name: data.name, isHost: !!data.isHost });
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
                        setDoc(myPresenceRef, { type: 'presence', id: selfId, userId: user?.id || null, name: user?.name || 'Participant', isHost: true }).then(() => {
                            connected = true;
                            if (pruneInterval) clearInterval(pruneInterval);
                            pruneInterval = setInterval(pruneStaleSignals, 45000);
                            emit('joined', { id: selfId, peers });
                            emit('connect');
                        }).catch(err => emit('error', new Error('Failed to join: ' + err.message)));
                    } else {
                        myPresenceRef = doc(sigRef, `waiting_${selfId}`);
                        setDoc(myPresenceRef, { type: 'waiting', id: selfId, userId: user?.id || null, name: user?.name || 'Participant', isHost: false }).then(() => {
                            emit('waiting');
                        }).catch(err => emit('error', new Error('Failed to join waiting room: ' + err.message)));
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

            // Listen for messages (signals, chats, controls, reactions, whiteboard, transcripts, quizzes, breakouts, laser, slides, code, sound, moments, doubts, pair-code, copilot, pomodoro, flashcard, focus-check, resource)
            let isInitialMessages = true;
            const messageTypes = ['signal', 'chat', 'control', 'reaction', 'hand-raise', 'whiteboard', 'transcript', 'quiz', 'breakout', 'laser', 'slides', 'code-run', 'sound-fx', 'moment', 'doubt', 'custom-quiz', 'pair-code', 'copilot-query', 'pomodoro', 'flashcard-sync', 'focus-check', 'resource-share'];
            const unsubMessages = onSnapshot(query(sigRef, where('type', 'in', messageTypes)), snapshot => {
                snapshot.docChanges().forEach(change => {
                    if (change.type === 'added') {
                        const data = change.doc.data();
                        if (data.from === selfId) return;

                        if (data.type === 'signal' && data.to === selfId) {
                            emit('signal', { from: data.from, name: data.name, signal: data.signal });
                            deleteDoc(change.doc.ref).catch(()=>{});
                        } else if (!isInitialMessages && data.type === 'chat') {
                            emit('chat', { name: data.name, text: data.text });
                        } else if (!isInitialMessages && data.type === 'reaction') {
                            emit('reaction', { from: data.from, name: data.name, emoji: data.emoji, label: data.label });
                            deleteDoc(change.doc.ref).catch(()=>{});
                        } else if (!isInitialMessages && data.type === 'hand-raise') {
                            emit('hand-raise', { from: data.from, name: data.name, isRaised: data.isRaised });
                        } else if (!isInitialMessages && data.type === 'whiteboard') {
                            emit('whiteboard', { from: data.from, action: data.action, stroke: data.stroke });
                        } else if (!isInitialMessages && data.type === 'transcript') {
                            emit('transcript', { from: data.from, name: data.name, text: data.text, isFinal: data.isFinal });
                        } else if (!isInitialMessages && data.type === 'quiz') {
                            emit('quiz', { from: data.from, name: data.name, event: data.event, payload: data.payload });
                        } else if (!isInitialMessages && data.type === 'breakout') {
                            emit('breakout', { from: data.from, action: data.action, payload: data.payload });
                        } else if (!isInitialMessages && data.type === 'laser') {
                            emit('laser', { from: data.from, x: data.x, y: data.y, active: data.active });
                        } else if (!isInitialMessages && data.type === 'slides') {
                            emit('slides', { from: data.from, slideIndex: data.slideIndex });
                        } else if (!isInitialMessages && data.type === 'code-run') {
                            emit('code-run', { from: data.from, name: data.name, code: data.code, lang: data.lang, output: data.output });
                        } else if (!isInitialMessages && data.type === 'sound-fx') {
                            emit('sound-fx', { from: data.from, sound: data.sound });
                            deleteDoc(change.doc.ref).catch(()=>{});
                        } else if (!isInitialMessages && data.type === 'moment') {
                            emit('moment', { from: data.from, name: data.name, timestamp: data.timestamp, tag: data.tag, note: data.note });
                        } else if (!isInitialMessages && data.type === 'doubt') {
                            emit('doubt', { from: data.from, name: data.name, question: data.question, category: data.category });
                        } else if (!isInitialMessages && data.type === 'custom-quiz') {
                            emit('custom-quiz', { from: data.from, name: data.name, question: data.question, options: data.options, correctIndex: data.correctIndex });
                        } else if (!isInitialMessages && data.type === 'pair-code') {
                            emit('pair-code', { from: data.from, fileName: data.fileName, content: data.content });
                        } else if (!isInitialMessages && data.type === 'copilot-query') {
                            emit('copilot-query', { from: data.from, name: data.name, prompt: data.prompt, response: data.response });
                        } else if (!isInitialMessages && data.type === 'pomodoro') {
                            emit('pomodoro', { from: data.from, action: data.action, durationSec: data.durationSec });
                        } else if (!isInitialMessages && data.type === 'flashcard-sync') {
                            emit('flashcard-sync', { from: data.from, cardIndex: data.cardIndex, isFlipped: data.isFlipped });
                        } else if (!isInitialMessages && data.type === 'focus-check') {
                            emit('focus-check', { from: data.from, name: data.name, action: data.action, status: data.status });
                        } else if (!isInitialMessages && data.type === 'resource-share') {
                            emit('resource-share', { from: data.from, name: data.name, title: data.title, link: data.link, category: data.category });
                        } else if (data.type === 'control' && (data.to === selfId || data.to === 'ALL')) {
                            handleControlMessage(data.action).catch(err => console.error("Control message error:", err));
                            if (data.to === selfId) deleteDoc(change.doc.ref).catch(()=>{});
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
            try {
                if (myPresenceRef) await deleteDoc(myPresenceRef).catch(()=>{});
                const sigRef = collection(db, 'meetings', meetingId, 'signaling');
                myPresenceRef = doc(sigRef, `presence_${selfId}`);
                await setDoc(myPresenceRef, { type: 'presence', id: selfId, name: user?.name || 'Participant', isHost: false });
                connected = true;
                const presenceDocs = await getDocs(query(sigRef, where('type', '==', 'presence')));
                const peers = presenceDocs.docs.map(d => d.data()).filter(d => d.id !== selfId);
                emit('joined', { id: selfId, peers });
                emit('connect');
            } catch (err) {
                console.error('[WebRTC] Admit processing failed:', err);
                emit('error', new Error('Failed to join meeting room after being admitted: ' + err.message));
            }
        } else if (action === 'deny' || action === 'remove') {
            emit('kicked', { reason: action });
            disconnect();
        } else if (['mute-mic', 'disable-cam', 'mute-all-mic', 'disable-all-cam'].includes(action)) {
            emit('remote-control', { action });
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

    async function pruneStaleSignals() {
        if (!isHost || !connected) return;
        try {
            const sigRef = collection(db, 'meetings', meetingId, 'signaling');
            const cutoffTime = Date.now() - (60 * 1000); // 1 minute cutoff
            const oldSignals = await getDocs(query(sigRef, where('createdAt', '<', cutoffTime)));
            oldSignals.forEach(d => deleteDoc(d.ref).catch(() => {}));
        } catch (e) {
            // Non-critical background cleanup
        }
    }

    async function sendSignal(to, signal) {
        if (!connected) return false;
        try {
            await addDoc(collection(db, 'meetings', meetingId, 'signaling'), {
                type: 'signal', from: selfId, to, name: user?.name, signal, createdAt: Date.now()
            });
            return true;
        } catch(e) { return false; }
    }

    async function sendChat(text) {
        if (!connected) return false;
        try {
            await addDoc(collection(db, 'meetings', meetingId, 'signaling'), {
                type: 'chat', from: selfId, name: user?.name, text, createdAt: Date.now()
            });
            return true;
        } catch(e) { return false; }
    }

    async function sendReaction(emoji, label = '') {
        if (!connected) return false;
        try {
            await addDoc(collection(db, 'meetings', meetingId, 'signaling'), {
                type: 'reaction', from: selfId, name: user?.name, emoji, label, createdAt: Date.now()
            });
            return true;
        } catch(e) { return false; }
    }

    async function sendHandRaise(isRaised) {
        if (!connected) return false;
        try {
            await addDoc(collection(db, 'meetings', meetingId, 'signaling'), {
                type: 'hand-raise', from: selfId, name: user?.name, isRaised, createdAt: Date.now()
            });
            return true;
        } catch(e) { return false; }
    }

    async function sendWhiteboard(action, stroke = null) {
        if (!connected) return false;
        try {
            await addDoc(collection(db, 'meetings', meetingId, 'signaling'), {
                type: 'whiteboard', from: selfId, action, stroke, createdAt: Date.now()
            });
            return true;
        } catch(e) { return false; }
    }

    async function sendTranscript(text, isFinal = true) {
        if (!connected) return false;
        try {
            await addDoc(collection(db, 'meetings', meetingId, 'signaling'), {
                type: 'transcript', from: selfId, name: user?.name, text, isFinal, createdAt: Date.now()
            });
            return true;
        } catch(e) { return false; }
    }

    async function sendQuiz(event, payload) {
        if (!connected) return false;
        try {
            await addDoc(collection(db, 'meetings', meetingId, 'signaling'), {
                type: 'quiz', from: selfId, name: user?.name, event, payload, createdAt: Date.now()
            });
            return true;
        } catch(e) { return false; }
    }

    async function sendBreakout(action, payload = {}) {
        if (!connected) return false;
        try {
            await addDoc(collection(db, 'meetings', meetingId, 'signaling'), {
                type: 'breakout', from: selfId, name: user?.name, action, payload, createdAt: Date.now()
            });
            return true;
        } catch(e) { return false; }
    }

    async function sendLaserPointer(x, y, active = true) {
        if (!connected) return false;
        try {
            await addDoc(collection(db, 'meetings', meetingId, 'signaling'), {
                type: 'laser', from: selfId, x, y, active, createdAt: Date.now()
            });
            return true;
        } catch(e) { return false; }
    }

    async function sendSlideSync(slideIndex) {
        if (!connected) return false;
        try {
            await addDoc(collection(db, 'meetings', meetingId, 'signaling'), {
                type: 'slides', from: selfId, slideIndex, createdAt: Date.now()
            });
            return true;
        } catch(e) { return false; }
    }

    async function sendCodeRun(code, lang, output) {
        if (!connected) return false;
        try {
            await addDoc(collection(db, 'meetings', meetingId, 'signaling'), {
                type: 'code-run', from: selfId, name: user?.name, code, lang, output, createdAt: Date.now()
            });
            return true;
        } catch(e) { return false; }
    }

    async function sendSoundFx(sound) {
        if (!connected) return false;
        try {
            await addDoc(collection(db, 'meetings', meetingId, 'signaling'), {
                type: 'sound-fx', from: selfId, sound, createdAt: Date.now()
            });
            return true;
        } catch(e) { return false; }
    }

    async function sendKeyMoment(tag, note, timestamp) {
        if (!connected) return false;
        try {
            await addDoc(collection(db, 'meetings', meetingId, 'signaling'), {
                type: 'moment', from: selfId, name: user?.name, tag, note, timestamp, createdAt: Date.now()
            });
            return true;
        } catch(e) { return false; }
    }

    async function sendDoubt(question, category) {
        if (!connected) return false;
        try {
            await addDoc(collection(db, 'meetings', meetingId, 'signaling'), {
                type: 'doubt', from: selfId, name: user?.name, question, category, createdAt: Date.now()
            });
            return true;
        } catch(e) { return false; }
    }

    async function sendCustomQuiz(question, options, correctIndex) {
        if (!connected) return false;
        try {
            await addDoc(collection(db, 'meetings', meetingId, 'signaling'), {
                type: 'custom-quiz', from: selfId, name: user?.name, question, options, correctIndex, createdAt: Date.now()
            });
            return true;
        } catch(e) { return false; }
    }

    async function sendPairCode(fileName, content) {
        if (!connected) return false;
        try {
            await addDoc(collection(db, 'meetings', meetingId, 'signaling'), {
                type: 'pair-code', from: selfId, fileName, content, createdAt: Date.now()
            });
            return true;
        } catch(e) { return false; }
    }

    async function sendCopilotQuery(prompt, response) {
        if (!connected) return false;
        try {
            await addDoc(collection(db, 'meetings', meetingId, 'signaling'), {
                type: 'copilot-query', from: selfId, name: user?.name, prompt, response, createdAt: Date.now()
            });
            return true;
        } catch(e) { return false; }
    }

    async function sendPomodoro(action, durationSec) {
        if (!connected) return false;
        try {
            await addDoc(collection(db, 'meetings', meetingId, 'signaling'), {
                type: 'pomodoro', from: selfId, name: user?.name, action, durationSec, createdAt: Date.now()
            });
            return true;
        } catch(e) { return false; }
    }

    async function sendFlashcardSync(cardIndex, isFlipped) {
        if (!connected) return false;
        try {
            await addDoc(collection(db, 'meetings', meetingId, 'signaling'), {
                type: 'flashcard-sync', from: selfId, cardIndex, isFlipped, createdAt: Date.now()
            });
            return true;
        } catch(e) { return false; }
    }

    async function sendFocusCheck(action, status) {
        if (!connected) return false;
        try {
            await addDoc(collection(db, 'meetings', meetingId, 'signaling'), {
                type: 'focus-check', from: selfId, name: user?.name, action, status, createdAt: Date.now()
            });
            return true;
        } catch(e) { return false; }
    }

    async function sendResourceShare(title, link, category) {
        if (!connected) return false;
        try {
            await addDoc(collection(db, 'meetings', meetingId, 'signaling'), {
                type: 'resource-share', from: selfId, name: user?.name, title, link, category, createdAt: Date.now()
            });
            return true;
        } catch(e) { return false; }
    }

    async function sendControl(to, action) {
        try {
            await addDoc(collection(db, 'meetings', meetingId, 'signaling'), {
                type: 'control', from: selfId, to, action, createdAt: Date.now()
            });
            return true;
        } catch(e) {
            console.error('[WebRTC] sendControl failed:', e);
            return false;
        }
    }

    async function updateRoomSettings(settings) {
        if (!isHost) return false;
        try {
            const settingsRef = doc(db, 'meetings', meetingId, 'controls', 'settings');
            await setDoc(settingsRef, { ...settings, updatedAt: new Date().toISOString() }, { merge: true });
            return true;
        } catch (e) {
            console.error('[WebRTC] updateRoomSettings failed:', e);
            return false;
        }
    }

    async function disconnect() {
        if (intentionalClose) return;
        intentionalClose = true;
        if (pruneInterval) clearInterval(pruneInterval);
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
        sendReaction,
        sendHandRaise,
        sendWhiteboard,
        sendTranscript,
        sendQuiz,
        sendBreakout,
        sendLaserPointer,
        sendSlideSync,
        sendCodeRun,
        sendSoundFx,
        sendKeyMoment,
        sendDoubt,
        sendCustomQuiz,
        sendPairCode,
        sendCopilotQuery,
        sendPomodoro,
        sendFlashcardSync,
        sendFocusCheck,
        sendResourceShare,
        sendControl,
        updateRoomSettings,
        disconnect,
        get isConnected() { return connected; },
        get selfId() { return selfId; },
        set selfId(val) { selfId = val; }
    };
}
