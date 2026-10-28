export const API_BASE_URL = 'https://mentor-mentee-2ok6.onrender.com';

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
