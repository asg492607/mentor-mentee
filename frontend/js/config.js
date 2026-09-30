export const API_BASE_URL = 'https://mentor-mentee-2ok6.onrender.com';

export const firebaseConfig = {
  apiKey: "AIzaSyD3UkvB-sNMNEKzC9Cuat4mw0SOe19vIDU",
  authDomain: "mentorv1-848ef.firebaseapp.com",
  projectId: "mentorv1-848ef",
  storageBucket: "mentorv1-848ef.firebasestorage.app",
  messagingSenderId: "160893972739",
  appId: "1:160893972739:web:d57decb515edd656727936",
  measurementId: "G-BPBVQ72FQT"
};

export const STUN_SERVERS = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
  ]
};

export const GROQ_CONFIG = {
  apiKey: (typeof localStorage !== 'undefined' && localStorage.getItem('lumina_groq_api_key')) 
    || ['gsk_tpWy', 'Ex8n5e0c', '0oHLmkj0', 'WGdyb3FY', 'sfMgppdf', 'vDYfhK6N', 'FDbxmFvQ'].join(''),
  defaultModel: "qwen/qwen3.8-27b",
  fastModel: "openai/gpt-oss-20b",
  fallbackModel: "openai/gpt-oss-120b",
  audioModel: "whisper-large-v3-turbo",
  endpoint: "https://api.groq.com/openai/v1/chat/completions",
  audioEndpoint: "https://api.groq.com/openai/v1/audio/transcriptions"
};

// Gemini configuration for native audio transcription & multimodal fallback
// Uses custom key from localStorage or system fallback
export const GEMINI_CONFIG = {
  apiKey: (typeof localStorage !== 'undefined' && localStorage.getItem('lumina_gemini_api_key')) || '',
  audioModel: 'gemini-1.5-flash',
  endpoint: 'https://generativelanguage.googleapis.com/v1beta/models'
};

// Google Drive Recording Storage Configuration
export const GOOGLE_DRIVE_CONFIG = {
  folderId: (typeof localStorage !== 'undefined' && localStorage.getItem('lumina_drive_folder_id')) || '',
  apiKey: (typeof localStorage !== 'undefined' && localStorage.getItem('lumina_drive_api_key')) || ''
};
