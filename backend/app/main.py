from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.config import settings
from app.firebase.client import initialize_firebase

# Import routers
from app.api.auth.routes import router as auth_router
from app.api.student.routes import router as student_router
from app.api.mentor.routes import router as mentor_router
from app.api.hod.routes import router as hod_router
from app.api.dean.routes import router as dean_router
from app.api.admin.routes import router as admin_router
from app.api.meetings.routes import router as meetings_router
from app.api.notifications.routes import router as notifications_router

# WebSocket import
from app.websocket.signaling import router as websocket_router

@asynccontextmanager
async def lifespan(app: FastAPI):
    initialize_firebase()
    yield

app = FastAPI(title="MentorOS API", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials="*" not in settings.cors_origins_list,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_router, prefix="/api")
app.include_router(student_router, prefix="/api")
app.include_router(mentor_router, prefix="/api")
app.include_router(hod_router, prefix="/api")
app.include_router(dean_router, prefix="/api")
app.include_router(admin_router, prefix="/api")
app.include_router(meetings_router, prefix="/api")
app.include_router(notifications_router, prefix="/api")
app.include_router(websocket_router, prefix="/ws")

@app.get("/health")
def health_check():
    return {"status": "healthy"}
