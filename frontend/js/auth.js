// Browser authentication is backed by a Secure, HttpOnly session cookie
// and synchronized with the Firebase Client SDK for realtime Firestore queries.
import { API_BASE_URL } from './config.js';

let cachedUserProfile = null;
const authListeners = new Set();

async function request(path, options = {}) {
  const token = await getIdToken().catch(() => null);
  const headers = {
    'Content-Type': 'application/json',
    ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
    ...(options.headers || {})
  };
  const response = await fetch(`${API_BASE_URL}${path}`, {
    credentials: 'include',
    ...options,
    headers,
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.detail || body.message || 'Authentication request failed');
  return body;
}

function notify() {
  const currentUser = getCurrentUser();
  for (const listener of authListeners) listener(currentUser);
}

export async function login(email, password) {
  const result = await request('/api/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) });
  cachedUserProfile = { ...result.profile, id: result.profile.id || result.profile.uid };
  try {
    localStorage.setItem('lumina_profile', JSON.stringify(cachedUserProfile));
  } catch (_) {}

  if (result.customToken) {
    try {
      const { auth } = await import('./firebase-init.js');
      const { signInWithCustomToken } = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js');
      await signInWithCustomToken(auth, result.customToken);
    } catch (e) {
      console.warn('Firebase client sign-in notice:', e);
    }
  }
  notify();
  return cachedUserProfile;
}

export async function register(data) {
  return request('/api/auth/register', { method: 'POST', body: JSON.stringify(data) });
}

export async function logout() {
  await request('/api/auth/logout', { method: 'POST' }).catch(() => {});
  try {
    const { auth } = await import('./firebase-init.js');
    const { signOut } = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js');
    await signOut(auth);
  } catch (_) {}
  cachedUserProfile = null;
  try {
    localStorage.removeItem('lumina_profile');
  } catch (_) {}
  notify();
  window.location.hash = '/login';
}

export function getCurrentUser() {
  if (cachedUserProfile) {
    return { uid: cachedUserProfile.id || cachedUserProfile.uid, email: cachedUserProfile.email };
  }
  try {
    const raw = localStorage.getItem('lumina_profile');
    if (raw) {
      const p = JSON.parse(raw);
      return { uid: p.id || p.uid, email: p.email };
    }
  } catch (_) {}
  return null;
}

export async function getIdToken() {
  try {
    const { auth } = await import('./firebase-init.js');
    if (auth && auth.currentUser) {
      return await auth.currentUser.getIdToken();
    }
  } catch (_) {}
  return null;
}

export function onAuthChange(callback) {
  authListeners.add(callback);
  
  import('./firebase-init.js').then(({ auth }) => {
    if (auth) {
      import('https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js').then(({ onAuthStateChanged }) => {
        onAuthStateChanged(auth, async (user) => {
          if (user) {
            await fetchUserProfile().catch(() => {});
          }
          callback(getCurrentUser());
        });
      }).catch(() => {});
    }
  }).catch(() => {});

  fetchUserProfile().finally(() => callback(getCurrentUser()));
  return () => authListeners.delete(callback);
}

export function getUserProfile() {
  if (cachedUserProfile) return cachedUserProfile;
  try {
    const raw = localStorage.getItem('lumina_profile');
    if (raw) {
      cachedUserProfile = JSON.parse(raw);
      return cachedUserProfile;
    }
  } catch (_) {}
  return null;
}

export async function updateUserProfileData(updates) {
  if (!cachedUserProfile) return null;
  cachedUserProfile = { ...cachedUserProfile, ...updates };
  try {
    localStorage.setItem('lumina_profile', JSON.stringify(cachedUserProfile));
  } catch (_) {}
  return cachedUserProfile;
}

export async function fetchUserProfile() {
  try {
    const profile = await request('/api/auth/me');
    cachedUserProfile = { ...profile, id: profile.id || profile.uid };
    try {
      localStorage.setItem('lumina_profile', JSON.stringify(cachedUserProfile));
    } catch (_) {}
    return cachedUserProfile;
  } catch (_) {
    return getUserProfile();
  }
}

export async function forgotPassword(email) {
  await request('/api/auth/password-reset', { method: 'POST', body: JSON.stringify({ email }) });
  return true;
}
