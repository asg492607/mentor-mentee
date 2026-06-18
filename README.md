# MentorOS

MentorOS is a college mentor-mentee platform with role-based dashboards, Firebase Authentication, Firestore data, WebRTC meetings, issue escalation, tasks, and reports.

## Modules

- Exam, student, academic, teaching, mentor-mentee, travel, and non-academic sections.
- Student meeting requests, task tracking, profile, issues, and mentor details.
- Faculty mentor dashboards, assigned students, meeting approval, notes, and action items.
- HOD and Dean escalation and analytics views.
- Admin user, department, mentor allocation, and settings workflows.

## Stack

| Layer | Technology |
| --- | --- |
| Frontend | HTML, CSS, vanilla JavaScript |
| Backend | FastAPI, Gunicorn, Uvicorn |
| Auth | Firebase Authentication |
| Database | Firestore |
| Meetings | WebRTC plus FastAPI WebSocket signaling |
| Frontend deploy | Netlify static hosting |
| Backend deploy | Render web service |

## Local Setup

### Backend

```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\activate
pip install -r requirements.txt
uvicorn app.main:app --reload
```

Set these environment variables before using authenticated API features:

```powershell
$env:FIREBASE_CREDENTIALS_JSON = '<service account json>'
$env:FIREBASE_PROJECT_ID = 'mentee-93ae9'
$env:CORS_ORIGINS = 'http://localhost:4173,http://127.0.0.1:4173'
```

### Frontend

```powershell
cd frontend
python -m http.server 4173
```

Update `frontend/js/config.js` so `API_BASE_URL` points to the backend URL you are using.

## Real Meeting Notes

The meeting room uses Firebase ID tokens on the WebSocket URL and only allows the meeting student or mentor to join. For reliable calls outside the same network, configure a TURN server in `frontend/js/config.js`; public STUN servers alone are not enough for all mobile/campus networks.

## Deployment

Deploy the backend using `render.yaml`. Store `FIREBASE_CREDENTIALS_JSON` and `CORS_ORIGINS` as secret environment variables in Render.

Deploy the frontend from `frontend/` on Netlify. The included `frontend/netlify.toml` and `_redirects` support the hash-based SPA.
