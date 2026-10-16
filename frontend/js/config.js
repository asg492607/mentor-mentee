export const API_BASE_URL = 'https://mentor-mentee-2ok6.onrender.com';

export const firebaseConfig = {
  apiKey: "AIzaSyD3UkvB-sNMNEKzC9Cuat4mw0SOe19vIDU",
  authDomain: "mentorv1-848ef.firebaseapp.com",
  projectId: "mentorv1-848ef",
  storageBucket: "mentorv1-848ef.firebasestorage.app",
  messagingSenderId: "160893972739",
  appId: "1:160893972739:web:429bfcd6945cf97f727936",
  measurementId: "G-K6QC4JRN9P"
};
export const STUN_SERVERS = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
  ]
};

export const GROQ_CONFIG = {
  defaultModel: "qwen/qwen3.8-27b"
};

export const GEMINI_CONFIG = {
  defaultModel: 'gemini-3.8-flash'
};
