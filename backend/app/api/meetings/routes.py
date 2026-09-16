from fastapi import APIRouter, Depends
from app.core.dependencies import get_current_user
from app.services.meeting_service import MeetingService
from app.repositories.meeting_repository import MeetingRepository
from app.core.exceptions import NotFoundException, ForbiddenException
from app.schemas.ai_notes import AINotesRequest
from app.utils.helpers import get_timestamp

router = APIRouter(prefix="/meetings", tags=["Meetings"])

@router.get("/{meeting_id}")
def get_meeting(meeting_id: str, user = Depends(get_current_user)):
    repo = MeetingRepository()
    meeting = repo.get_by_id(meeting_id)
    if not meeting:
        raise NotFoundException("Meeting not found")
    if user["uid"] not in {meeting.get("studentId"), meeting.get("mentorId")} and user["role"] not in {"ADMIN", "HOD", "DEAN"}:
        raise ForbiddenException("You are not a participant in this meeting")
    return meeting

@router.put("/{meeting_id}/start")
def start_meeting(meeting_id: str, user = Depends(get_current_user), meeting_service: MeetingService = Depends()):
    return meeting_service.start_meeting(meeting_id, user["uid"])

@router.put("/{meeting_id}/end")
def end_meeting(meeting_id: str, user = Depends(get_current_user), meeting_service: MeetingService = Depends()):
    return meeting_service.end_meeting(meeting_id, user["uid"])


# ── AI NOTES ENDPOINTS ─────────────────────────────────────────────────────────

@router.post("/{meeting_id}/ai-notes")
def save_ai_notes(meeting_id: str, data: AINotesRequest, user = Depends(get_current_user)):
    """
    Save AI-generated structured notes for a meeting.
    Called automatically by the frontend when the mentor ends a meeting.
    Only the mentor or an admin can save AI notes for a meeting.
    """
    repo = MeetingRepository()
    meeting = repo.get_by_id(meeting_id)
    if not meeting:
        raise NotFoundException("Meeting not found")
    if user["uid"] != meeting.get("mentorId") and user["role"] not in {"ADMIN"}:
        raise ForbiddenException("Only the meeting mentor can save AI notes")

    ai_notes_dict = data.dict()
    ai_notes_dict["savedAt"] = get_timestamp()

    repo.update(meeting_id, {
        "aiNotes": ai_notes_dict,
        "hasAiNotes": True,
        "updatedAt": get_timestamp()
    })

    return {"success": True, "message": "AI notes saved successfully", "meetingId": meeting_id}


@router.get("/{meeting_id}/ai-notes")
def get_ai_notes(meeting_id: str, user = Depends(get_current_user)):
    """
    Retrieve AI-generated notes for a specific meeting.
    Accessible by the mentor, admin, HOD, or dean.
    """
    repo = MeetingRepository()
    meeting = repo.get_by_id(meeting_id)
    if not meeting:
        raise NotFoundException("Meeting not found")

    allowed_roles = {"ADMIN", "HOD", "DEAN"}
    if (user["uid"] not in {meeting.get("studentId"), meeting.get("mentorId")}
            and user["role"] not in allowed_roles):
        raise ForbiddenException("You do not have access to this meeting's AI notes")

    ai_notes = meeting.get("aiNotes")
    if not ai_notes:
        return {"hasAiNotes": False, "aiNotes": None}

    return {"hasAiNotes": True, "aiNotes": ai_notes, "meetingId": meeting_id}
