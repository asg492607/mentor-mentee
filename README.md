# MentorOS — Student Mentorship & Guidance Platform

A production-ready Mentor-Mentee Management Platform for colleges, featuring WebRTC video meetings, risk monitoring, issue escalation, and role-based dashboards.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | HTML5, CSS3, Vanilla JavaScript |
| Backend | Python, FastAPI |
| Database | Firebase Firestore |
| Auth | Firebase Authentication |
| Meetings | WebRTC + FastAPI WebSocket Signaling |
| Frontend Deploy | Netlify |
| Backend Deploy | Render |

## Project Structure

```
mentor/
├── backend/          # FastAPI backend (Python)
│   ├── app/
│   │   ├── api/      # Route handlers
│   │   ├── services/ # Business logic
│   │   ├── repositories/ # Data access
│   │   ├── schemas/  # Pydantic models
│   │   ├── models/   # Enums & domain models
│   │   ├── core/     # Auth, dependencies
│   │   ├── firebase/ # Firebase client
│   │   └── websocket/ # WebRTC signaling
│   └── requirements.txt
│
└── frontend/         # Vanilla JS SPA
    ├── index.html
    ├── css/          # Design system
    └── js/           # Application code
```

## Quick Start

### Backend
```bash
cd backend
python -m venv venv
venv\Scripts\activate       # Windows
pip install -r requirements.txt
cp .env.example .env        # Fill in Firebase credentials
uvicorn app.main:app --reload
```

### Frontend
```bash
cd frontend
# Serve with any static server
npx -y serve .
# Or use VS Code Live Server extension
```

## User Roles

- **Student** — View mentor, request meetings, raise issues, track tasks
- **Faculty Mentor** — Manage students, conduct meetings, assign action items
- **HOD** — Department analytics, risk monitoring, escalation management
- **Dean** — Institution-wide analytics and oversight
- **Admin** — User management, mentor allocation, platform settings

## Setup

1. Create a Firebase project at [console.firebase.google.com](https://console.firebase.google.com)
2. Enable **Email/Password** authentication
3. Create a **Firestore** database
4. Download the service account key → `backend/serviceAccountKey.json`
5. Copy the web config → `frontend/js/config.js`

## License

MIT
