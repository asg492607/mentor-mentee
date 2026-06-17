from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.config import settings
from app.firebase.client import initialize_firebase

# Import routers (mocking if not exist)
try:
    from app.api.auth.routes import router as auth_router
except ImportError:
    auth_router = None
try:
    from app.api.student.routes import router as student_router
except ImportError:
    student_router = None
try:
    from app.api.mentor.routes import router as mentor_router
except ImportError:
    mentor_router = None
try:
    from app.api.hod.routes import router as hod_router
except ImportError:
    hod_router = None
try:
    from app.api.dean.routes import router as dean_router
except ImportError:
    dean_router = None
try:
    from app.api.admin.routes import router as admin_router
except ImportError:
    admin_router = None
try:
    from app.api.meetings.routes import router as meetings_router
except ImportError:
    meetings_router = None
try:
    from app.api.notifications.routes import router as notifications_router
except ImportError:
    notifications_router = None

# WebSocket import
try:
    from app.websocket.signaling import router as websocket_router
except ImportError:
    websocket_router = None

@asynccontextmanager
async def lifespan(app: FastAPI):
    initialize_firebase()
    yield

app = FastAPI(title="MentorOS API", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

if auth_router: app.include_router(auth_router, prefix="/api/auth")
if student_router: app.include_router(student_router, prefix="/api/student")
if mentor_router: app.include_router(mentor_router, prefix="/api/mentor")
if hod_router: app.include_router(hod_router, prefix="/api/hod")
if dean_router: app.include_router(dean_router, prefix="/api/dean")
if admin_router: app.include_router(admin_router, prefix="/api/admin")
if meetings_router: app.include_router(meetings_router, prefix="/api/meetings")
if notifications_router: app.include_router(notifications_router, prefix="/api/notifications")
if websocket_router: app.include_router(websocket_router, prefix="/ws")

@app.get("/health")
def health_check():
    return {"status": "healthy"}
