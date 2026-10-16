"""
FastAPI application factory, CORS policies, and routing mount
"""
from contextlib import asynccontextmanager
from time import perf_counter
from fastapi import Depends, FastAPI, Request
from fastapi.concurrency import run_in_threadpool
from fastapi.middleware.cors import CORSMiddleware
from app.config import settings
from app.firebase.client import initialize_firebase
from app.core.dependencies import get_current_user

# Import routers
from app.api.auth.routes import router as auth_router
from app.api.student.routes import router as student_router
from app.api.mentor.routes import router as mentor_router
from app.api.hod.routes import router as hod_router
from app.api.dean.routes import router as dean_router
from app.api.admin.routes import router as admin_router
from app.api.meetings.routes import router as meetings_router
from app.api.notifications.routes import router as notifications_router
from app.api.ai.routes import router as ai_router
from app.api.security.routes import router as security_router
from app.services.security_event_service import SecurityEventService

# WebSocket import
from app.websocket.signaling import router as websocket_router

@asynccontextmanager
async def lifespan(app: FastAPI):
    initialize_firebase()
    yield

app = FastAPI(
    title="Lumina API",
    lifespan=lifespan,
    docs_url=None,
    redoc_url=None,
    openapi_url=None,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=False,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type"],
)

# Defense in depth: every REST route requires a verified, approved Firebase user,
# even if a future endpoint is added without its own explicit dependency.
api_routers = (
    auth_router,
    student_router,
    mentor_router,
    hod_router,
    dean_router,
    admin_router,
    meetings_router,
    notifications_router,
    ai_router,
    security_router,
)
for api_router in api_routers:
    app.include_router(api_router, prefix="/api", dependencies=[Depends(get_current_user)])
app.include_router(websocket_router, prefix="/ws")


@app.middleware("http")
async def log_api_access(request: Request, call_next):
    if not request.url.path.startswith("/api/") or request.method == "OPTIONS":
        return await call_next(request)

    started_at = perf_counter()
    try:
        response = await call_next(request)
    except Exception:
        event = SecurityEventService.build_api_event(
            request=request,
            status_code=500,
            duration_ms=round((perf_counter() - started_at) * 1000),
        )
        await run_in_threadpool(SecurityEventService.write_event, event)
        raise

    event = SecurityEventService.build_api_event(
        request=request,
        status_code=response.status_code,
        duration_ms=round((perf_counter() - started_at) * 1000),
    )
    await run_in_threadpool(SecurityEventService.write_event, event)
    return response

@app.get("/health")
def health_check():
    return {"status": "healthy"}
