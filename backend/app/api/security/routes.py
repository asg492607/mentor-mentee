"""Authenticated portal activity logging endpoints."""

from fastapi import APIRouter, Depends, Request
from pydantic import BaseModel, Field

from app.core.dependencies import get_current_user

router = APIRouter(prefix="/security", tags=["Security"])


class PortalPageView(BaseModel):
    path: str = Field(min_length=1, max_length=120, pattern=r"^/[A-Za-z0-9/_-]+$")


@router.post("/page-view", status_code=204)
def log_portal_page_view(
    data: PortalPageView,
    request: Request,
    _user=Depends(get_current_user),
):
    # The HTTP middleware persists this event with the authenticated actor and
    # connection metadata after the response is generated.
    request.state.audit_event_type = "portal_page_view"
    request.state.audit_page = data.path
