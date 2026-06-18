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
    // Configure a TURN server for reliable calls across restrictive networks.
    // Example: { urls: 'turn:turn.example.com:3478', username: 'user', credential: 'secret' }
  ]
};
