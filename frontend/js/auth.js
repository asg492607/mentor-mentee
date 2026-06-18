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
const PRIVILEGED_ROLES = new Set(['HOD', 'DEAN', 'ADMIN']);

function normalizeAuthError(error) {
  const code = error?.code || '';
  if (code === 'auth/network-request-failed') {
    return new Error('Firebase Auth network request failed. Check internet access, Firebase project settings, and whether this domain is allowed.');
  }
  if (code === 'auth/email-already-in-use') {
    return new Error('This email is already registered. Please sign in or use another email.');
  }
  if (code === 'auth/invalid-email') {
    return new Error('Please enter a valid email address.');
  }
  if (code === 'auth/weak-password') {
    return new Error('Password is too weak. Use at least 6 characters.');
  }
  if (code === 'permission-denied') {
    return new Error('Firestore rejected this registration. Deploy the latest Firestore rules and try again.');
  }
  return error;
}

// Map frontend role values to Firestore collection names
function getCollectionForRole(role) {
  if (role === 'STUDENT') return 'students';
  // FACULTY, MENTOR, HOD, DEAN, ADMIN all go in 'faculty'
  return 'faculty';
}

export async function login(email, password) {
  try {
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    const uid = userCredential.user.uid;
    
    // Super Admin Override
    if (email === 'gandhiatharv565@gmail.com') {
      const adminProfile = {
        id: uid,
        email: email,
        name: 'Super Admin',
        role: 'ADMIN',
        status: 'approved',
        isApproved: true
      };
      cachedUserProfile = adminProfile;
      return cachedUserProfile;
    }

    // Check students collection first, then faculty
    let profile = null;

    let userDoc = await getDoc(doc(db, 'students', uid));
    if (userDoc.exists()) {
      profile = { id: uid, ...userDoc.data() };
      if (profile.status === 'pending' || !profile.isApproved) {
        await signOut(auth);
        throw new Error('Your account is pending approval by your assigned Mentor/Teacher.');
      }
    } else {
      userDoc = await getDoc(doc(db, 'faculty', uid));
      if (userDoc.exists()) {
        profile = { id: uid, ...userDoc.data() };
        
        if (profile.status === 'pending' || !profile.isApproved) {
          await signOut(auth);
          let approver = 'the Admin';
          if (profile.role === 'HOD') approver = 'the Dean';
          if (profile.role === 'FACULTY' || profile.role === 'MENTOR') approver = 'your HOD';
          throw new Error(`Your account is pending approval by ${approver}.`);
        }
      }
    }
    
    if (!profile) throw new Error('User profile not found in database. Please register first.');
    
    cachedUserProfile = profile;
    return cachedUserProfile;
  } catch (error) {
    console.error("Login error:", error);
    throw normalizeAuthError(error);
  }
}

export async function register(data) {
  try {
    const userCredential = await createUserWithEmailAndPassword(auth, data.email, data.password);
    const uid = userCredential.user.uid;
    
    const role = data.role;

    // Build profile — only include defined (non-undefined) fields
    const profileData = {
      id: uid,
      email: data.email,
      name: data.profile.name,
      role: role,
      department: data.profile.department || null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    // Student-only fields
    if (role === 'STUDENT') {
      if (data.profile.year !== undefined && data.profile.year !== null && !isNaN(data.profile.year)) {
        profileData.year = data.profile.year;
      }
      if (data.profile.rollNumber) profileData.rollNumber = data.profile.rollNumber;
      profileData.cgpa = 0;
      profileData.attendance = 0;
      profileData.riskLevel = 'LOW';
      profileData.mentorId = null;
    }

    // Faculty / HOD / Dean / Admin staff fields
    if (role !== 'STUDENT') {
      if (data.profile.designation) profileData.designation = data.profile.designation;
      if (data.profile.employeeId)  profileData.employeeId  = data.profile.employeeId;
      profileData.maxStudents = role === 'FACULTY' ? 20 : 0;
      profileData.assignedStudentCount = 0;
      profileData.status = 'pending';
      profileData.isApproved = false;
    }

    if (role === 'STUDENT') {
      profileData.status = 'pending';
      profileData.isApproved = false;
    }

    if (data.email === 'gandhiatharv565@gmail.com') {
      profileData.role = 'ADMIN';
      profileData.status = 'approved';
      profileData.isApproved = true;
    }

    // Strip any remaining undefined values to be safe
    Object.keys(profileData).forEach(key => {
      if (profileData[key] === undefined) delete profileData[key];
    });

    const collection = getCollectionForRole(role);
    await setDoc(doc(db, collection, uid), profileData);
    
    cachedUserProfile = profileData;
    return profileData;
  } catch (error) {
    console.error("Register error:", error);
    throw normalizeAuthError(error);
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

// Helper to fetch profile if logged in but page refreshed
export async function fetchUserProfile() {
  const user = auth.currentUser;
  if (!user) return null;
  const uid = user.uid;
  const email = user.email;
  try {
    // Super Admin bypass
    if (email === 'gandhiatharv565@gmail.com') {
      const adminProfile = {
        id: uid, email, name: 'Super Admin',
        role: 'ADMIN', status: 'approved', isApproved: true
      };
      cachedUserProfile = adminProfile;
      return cachedUserProfile;
    }

    let userDoc = await getDoc(doc(db, 'students', uid));
    let profile = null;
    if (userDoc.exists()) {
      profile = { id: uid, ...userDoc.data() };
      // If pending, force logout
      if (profile.status === 'pending' || !profile.isApproved) {
        await signOut(auth);
        cachedUserProfile = null;
        return null;
      }
    } else {
      userDoc = await getDoc(doc(db, 'faculty', uid));
      if (userDoc.exists()) {
        profile = { id: uid, ...userDoc.data() };
        if (profile.status === 'pending' || !profile.isApproved) {
          await signOut(auth);
          cachedUserProfile = null;
          return null;
        }
      }
    }
    cachedUserProfile = profile;
    return cachedUserProfile;
  } catch(e) {
    console.error("Failed to fetch profile", e);
  }
  return null;
}
