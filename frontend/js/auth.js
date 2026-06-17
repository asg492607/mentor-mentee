import { auth, db } from './firebase-init.js';
import { 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  signOut, 
  onAuthStateChanged 
} from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js';
import { 
  doc, 
  getDoc, 
  setDoc 
} from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';
import { navigateTo } from './router.js';

let cachedUserProfile = null;

export async function login(email, password) {
  try {
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    const uid = userCredential.user.uid;
    
    // Fetch profile directly from Firestore
    let userDoc = await getDoc(doc(db, 'students', uid));
    let profile = null;
    if (userDoc.exists()) {
        profile = { id: uid, ...userDoc.data() };
    } else {
        userDoc = await getDoc(doc(db, 'faculty', uid));
        if (userDoc.exists()) {
            profile = { id: uid, ...userDoc.data() };
            if (profile.role === 'MENTOR' && profile.status !== 'approved' && !profile.isApproved) {
                await signOut(auth);
                throw new Error('Your account is pending approval by the Dean.');
            }
        }
    }
    
    if (!profile) throw new Error('User profile not found in database');
    
    cachedUserProfile = profile;
    return cachedUserProfile;
  } catch (error) {
    console.error("Login error:", error);
    throw error;
  }
}

export async function register(data) {
  try {
    const userCredential = await createUserWithEmailAndPassword(auth, data.email, data.password);
    const uid = userCredential.user.uid;
    
    const profileData = {
        id: uid,
        email: data.email,
        name: data.profile.name,
        role: data.role,
        department: data.profile.department,
        year: data.profile.year,
        rollNumber: data.profile.rollNumber,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
    };
    
    const collection = data.role === 'STUDENT' ? 'students' : 'faculty';
    await setDoc(doc(db, collection, uid), profileData);
    
    return profileData;
  } catch (error) {
    console.error("Register error:", error);
    throw error;
  }
}

export async function logout() {
  await signOut(auth);
  cachedUserProfile = null;
  navigateTo('/login');
}

export function getCurrentUser() {
  return auth.currentUser;
}

export async function getIdToken() {
  const user = auth.currentUser;
  if (!user) return null;
  return await user.getIdToken();
}

export function onAuthChange(callback) {
  return onAuthStateChanged(auth, callback);
}

export function getUserProfile() {
  return cachedUserProfile;
}

// Helper to fetch profile if logged in but refreshed
export async function fetchUserProfile() {
    const user = auth.currentUser;
    if (!user) return null;
    const uid = user.uid;
    try {
        let userDoc = await getDoc(doc(db, 'students', uid));
        let profile = null;
        if (userDoc.exists()) {
            profile = { id: uid, ...userDoc.data() };
        } else {
            userDoc = await getDoc(doc(db, 'faculty', uid));
            if (userDoc.exists()) {
                profile = { id: uid, ...userDoc.data() };
            }
        }
        cachedUserProfile = profile;
        return cachedUserProfile;
    } catch(e) {
        console.error("Failed to fetch profile", e);
    }
    return null;
}
