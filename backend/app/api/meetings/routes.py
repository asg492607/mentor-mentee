from fastapi import APIRouter, Depends
from app.core.dependencies import get_current_user
from app.services.meeting_service import MeetingService
from app.repositories.meeting_repository import MeetingRepository

router = APIRouter(prefix="/meetings", tags=["Meetings"])

@router.get("/{meeting_id}")
def get_meeting(meeting_id: str, user = Depends(get_current_user)):
    repo = MeetingRepository()
    return repo.get_by_id(meeting_id)

@router.put("/{meeting_id}/start")
def start_meeting(meeting_id: str, user = Depends(get_current_user), meeting_service: MeetingService = Depends()):
    return meeting_service.start_meeting(meeting_id)

@router.put("/{meeting_id}/end")
def end_meeting(meeting_id: str, user = Depends(get_current_user), meeting_service: MeetingService = Depends()):
    return meeting_service.end_meeting(meeting_id)
