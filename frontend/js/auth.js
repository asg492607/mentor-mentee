/**
 * @fileoverview Authentication state, token persistence, and role guards
 * @module auth
 */
import { auth, db } from './firebase-init.js';
import { 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  signOut, 
  onAuthStateChanged,
  sendPasswordResetEmail
} from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js';
import { 
  doc, 
  getDoc, 
  setDoc,
} from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';
import { navigateTo } from './router.js';
import { API_BASE_URL } from './config.js';

/** Cached user profile object; populated after login or page reload. */
let cachedUserProfile = null;

function normalizeAuthError(error) {
  const code = error?.code || '';
  if (code === 'auth/network-request-failed') {
    return new Error('Firebase Auth network request failed. Check internet access, Firebase project settings, and whether this domain is allowed.');
  }
  if (code === 'auth/user-not-found') {
    return new Error('No user account found matching this email address.');
  }
  if (code === 'auth/invalid-credential' || code === 'auth/wrong-password') {
    return new Error('Incorrect email or password. Please try again.');
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
  // Staff profiles are stored in 'faculty'; elevated roles still require trusted claims.
  return 'faculty';
}

function isApprovedProfile(profile) {
  return String(profile?.status || '').toLowerCase() === 'approved' && profile?.isApproved === true;
}

async function readOwnProfile(uid, preferredRole = '') {
  const role = String(preferredRole || '').toUpperCase();
  const collections = ['ADMIN', 'DEAN', 'HOD', 'SECTION_HEAD', 'FACULTY', 'MENTOR'].includes(role)
    ? ['faculty', 'students']
    : ['students', 'faculty'];

  for (const collectionName of collections) {
    const userDoc = await getDoc(doc(db, collectionName, uid));
    if (userDoc.exists()) return { id: uid, ...userDoc.data() };
  }
  return null;
}

async function bootstrapTrustedClaims(user) {
  const token = await user.getIdToken();
  let response;
  try {
    response = await fetch(`${API_BASE_URL}/api/auth/bootstrap-claims`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` }
    });
  } catch (_error) {
    throw new Error('Secure account migration is unavailable. Please retry in a moment.');
  }

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload.detail || 'Your account could not be securely verified. Contact your department administrator.');
  }

  if (payload.profile) cachedUserProfile = payload.profile;
  const refreshed = await user.getIdTokenResult(true);
  return { profile: payload.profile || null, claims: refreshed.claims };
}

function hasExpectedRoleClaim(claims, role) {
  const normalizedRole = String(role || '').toUpperCase();
  if (normalizedRole === 'ADMIN') return claims.admin === true;
  if (['DEAN', 'HOD', 'SECTION_HEAD'].includes(normalizedRole)) {
    return claims.platform_role === normalizedRole;
  }
  return true;
}


export async function login(email, password) {
  const normEmail = String(email || '').trim().toLowerCase();
  try {
    const userCredential = await signInWithEmailAndPassword(auth, normEmail, password);
    const uid = userCredential.user.uid;
    
    let tokenResult = await userCredential.user.getIdTokenResult();
    let profile = await readOwnProfile(
      uid,
      tokenResult.claims.admin === true ? 'ADMIN' : tokenResult.claims.platform_role
    );
    if (tokenResult.claims.platform_approved !== true || !hasExpectedRoleClaim(tokenResult.claims, profile?.role)) {
      try {
        const migrated = await bootstrapTrustedClaims(userCredential.user);
        profile = migrated.profile || await readOwnProfile(uid, profile?.role);
        tokenResult = { claims: migrated.claims };
      } catch (error) {
        await signOut(auth);
        throw error;
      }
    }

    profile = profile || await readOwnProfile(uid, tokenResult.claims.admin === true ? 'ADMIN' : '');
    if (!profile) {
      await signOut(auth);
      throw new Error('User profile not found in database. Please register first.');
    }
    if (!isApprovedProfile(profile)) {
      await signOut(auth);
      let approver = 'the Admin';
      if (profile.role === 'HOD') approver = 'the Dean';
      if (profile.role === 'FACULTY' || profile.role === 'MENTOR') approver = 'your HOD';
      throw new Error(`Your account is pending approval by ${approver}.`);
    }
    if (tokenResult.claims.platform_approved !== true || !hasExpectedRoleClaim(tokenResult.claims, profile.role)) {
      await signOut(auth);
      throw new Error('This account needs trusted administrator provisioning. Contact your department administrator.');
    }
    
    cachedUserProfile = profile;
    return cachedUserProfile;
  } catch (error) {
    console.error("Login error:", error);
    throw normalizeAuthError(error);
  }
}

export async function register(data) {
  try {
    const cleanEmail = String(data.email || '').trim().toLowerCase();
    if (!cleanEmail) throw new Error('Email address is required.');

    const allowedSelfRegistrationRoles = ['STUDENT', 'FACULTY'];
    if (!allowedSelfRegistrationRoles.includes(data.role)) {
      throw new Error('Administrator and dean accounts must be provisioned by an administrator.');
    }

    const userCredential = await createUserWithEmailAndPassword(auth, cleanEmail, data.password);
    const uid = userCredential.user.uid;
    
    const role = data.role;

    // Build profile — only include defined (non-undefined) fields
    const profileData = {
      id: uid,
      email: cleanEmail,
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
      if (data.profile.class) profileData.class = data.profile.class;
      if (data.profile.enrollmentNumber) profileData.enrollmentNumber = data.profile.enrollmentNumber;
      profileData.cgpa = 0;
      profileData.attendance = 0;
      profileData.riskLevel = 'LOW';
      profileData.mentorId = null;
    }

    // Staff profile fields. New accounts always remain pending until approval.
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

    profileData.status = 'pending';
    profileData.isApproved = false;

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

export async function updateUserProfileData(updates) {
  if (!cachedUserProfile) return null;
  cachedUserProfile = { ...cachedUserProfile, ...updates };
  return cachedUserProfile;
}

// Helper to fetch profile if logged in but page refreshed
export async function fetchUserProfile() {
  const user = auth.currentUser;
  if (!user) return null;
  const uid = user.uid;
  try {
    let tokenResult = await user.getIdTokenResult();
    let profile = await readOwnProfile(
      uid,
      tokenResult.claims.admin === true ? 'ADMIN' : tokenResult.claims.platform_role
    );
    if (tokenResult.claims.platform_approved !== true || !hasExpectedRoleClaim(tokenResult.claims, profile?.role)) {
      try {
        const migrated = await bootstrapTrustedClaims(user);
        tokenResult = { claims: migrated.claims };
        profile = migrated.profile || await readOwnProfile(uid, profile?.role);
      } catch (error) {
        // Pending accounts are not signed out here; the login page can show the
        // approval error and an existing session remains available for retry.
        console.warn('Trusted account migration was not completed:', error.message);
        cachedUserProfile = null;
        return null;
      }
    }
    if (!profile && tokenResult.claims.admin === true) {
      profile = await readOwnProfile(uid, 'ADMIN');
    }
    if (!profile || !isApprovedProfile(profile) || !hasExpectedRoleClaim(tokenResult.claims, profile.role)) {
        await signOut(auth);
        cachedUserProfile = null;
        return null;
    }
    cachedUserProfile = profile;
    return cachedUserProfile;
  } catch(e) {
    console.error("Failed to fetch profile", e);
  }
  return null;
}

export async function forgotPassword(email) {
  try {
    await sendPasswordResetEmail(auth, email);
    return true;
  } catch (error) {
    console.error("Forgot password error:", error);
    throw normalizeAuthError(error);
  }
}


