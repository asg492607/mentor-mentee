import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js';
import { getAuth } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js';
import { 
  initializeFirestore, 
  persistentLocalCache, 
  persistentMultipleTabManager,
  getFirestore 
} from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';
import { getStorage } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-storage.js';

export const firebaseConfig = {
  apiKey: "AIzaSyD3UkvB-sNMNEKzC9Cuat4mw0SOe19vIDU",
  authDomain: "mentorv1-848ef.firebaseapp.com",
  projectId: "mentorv1-848ef",
  storageBucket: "mentorv1-848ef.firebasestorage.app",
  messagingSenderId: "160893972739",
  appId: "1:160893972739:web:429bfcd6945cf97f727936",
  measurementId: "G-K6QC4JRN9P"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

let db;
try {
  db = initializeFirestore(app, {
    localCache: persistentLocalCache({
      tabManager: persistentMultipleTabManager()
    })
  });
} catch (e) {
  console.warn('Persistent cache initialization fallback to standard getFirestore:', e);
  db = getFirestore(app);
}

const storage = getStorage(app);

export { app, auth, db, storage };
