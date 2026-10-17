// Browser authentication is backed by a Secure, HttpOnly session cookie.
// No Firebase client SDK or Firebase configuration is loaded in this module.
import { API_BASE_URL } from './config.js';
import { navigateTo } from './router.js';

let cachedUserProfile = null;
const authListeners = new Set();

async function request(path, options = {}) {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    credentials: 'include',
    ...options,
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.detail || body.message || 'Authentication request failed');
  return body;
}

function notify() {
  for (const listener of authListeners) listener(cachedUserProfile ? { uid: cachedUserProfile.id || cachedUserProfile.uid } : null);
}

export async function login(email, password) {
  const result = await request('/api/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) });
  cachedUserProfile = result.profile;
  notify();
  return cachedUserProfile;
}

export async function register(data) {
  return request('/api/auth/register', { method: 'POST', body: JSON.stringify(data) });
}

export async function logout() {
  await request('/api/auth/logout', { method: 'POST' });
  cachedUserProfile = null;
  notify();
  navigateTo('/login');
}

export function getCurrentUser() {
  return cachedUserProfile ? { uid: cachedUserProfile.id || cachedUserProfile.uid } : null;
}

// Tokens deliberately never enter JavaScript; requests use the HttpOnly cookie.
export async function getIdToken() { return null; }

export function onAuthChange(callback) {
  authListeners.add(callback);
  fetchUserProfile().finally(() => callback(getCurrentUser()));
  return () => authListeners.delete(callback);
}

export function getUserProfile() { return cachedUserProfile; }

export async function updateUserProfileData(updates) {
  if (!cachedUserProfile) return null;
  cachedUserProfile = { ...cachedUserProfile, ...updates };
  return cachedUserProfile;
}

export async function fetchUserProfile() {
  try {
    const profile = await request('/api/auth/me');
    cachedUserProfile = { ...profile, id: profile.id || profile.uid };
    return cachedUserProfile;
  } catch (_) {
    cachedUserProfile = null;
    return null;
  }
}

export async function forgotPassword(email) {
  await request('/api/auth/password-reset', { method: 'POST', body: JSON.stringify({ email }) });
  return true;
}
