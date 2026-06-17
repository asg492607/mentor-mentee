import { auth } from './firebase-init.js';
import { 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  signOut, 
  onAuthStateChanged 
} from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js';
import { API_BASE_URL } from './config.js';
import { navigateTo } from './router.js';

let cachedUserProfile = null;

export async function login(email, password) {
  try {
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    const token = await userCredential.user.getIdToken();
    
    // Call backend to verify and get profile
    const response = await fetch(`${API_BASE_URL}/api/auth/verify-token`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    
    if (!response.ok) throw new Error('Failed to verify token with backend');
    
    cachedUserProfile = await response.json();
    return cachedUserProfile;
  } catch (error) {
    console.error("Login error:", error);
    throw error;
  }
}

export async function register(data) {
  try {
    // Note: In a real app, registration might be handled differently, 
    // potentially entirely via backend or creating user first then backend.
    const userCredential = await createUserWithEmailAndPassword(auth, data.email, data.password);
    const token = await userCredential.user.getIdToken();
    
    const response = await fetch(`${API_BASE_URL}/api/auth/register`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify(data)
    });
    
    if (!response.ok) throw new Error('Failed to register user details');
    
    return await response.json();
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
    const token = await getIdToken();
    if (!token) return null;
    try {
        const response = await fetch(`${API_BASE_URL}/api/auth/profile`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        if (response.ok) {
            cachedUserProfile = await response.json();
            return cachedUserProfile;
        }
    } catch(e) {
        console.error("Failed to fetch profile", e);
    }
    return null;
}
