from fastapi import APIRouter, Depends, UploadFile, File, Form, HTTPException
from typing import Optional
from app.core.dependencies import get_current_user
from app.services.meeting_service import MeetingService
from app.services.drive_service import DriveService
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


# ── GOOGLE DRIVE & RECORDING ENDPOINTS ──────────────────────────────────────────

@router.post("/{meeting_id}/upload-recording")
async def upload_meeting_recording(
    meeting_id: str,
    file: UploadFile = File(...),
    mode: str = Form("audio"),
    duration: int = Form(0),
    user = Depends(get_current_user)
):
    """
    Upload session recording to Google Drive folder and save link in meeting document.
    Only participants or administrative users can upload recordings.
    """
    repo = MeetingRepository()
    meeting = repo.get_by_id(meeting_id)
    if not meeting:
        raise NotFoundException("Meeting not found")

    allowed_roles = {"ADMIN", "HOD", "DEAN"}
    if user["uid"] not in {meeting.get("studentId"), meeting.get("mentorId")} and user["role"] not in allowed_roles:
        raise ForbiddenException("You are not authorized to upload recordings for this meeting")

    # Read binary content
    contents = await file.read()
    if not contents:
        raise HTTPException(status_code=400, detail="Empty recording file provided")

    filename = file.filename or f"Meeting_{meeting_id}_{mode}.webm"
    mime_type = file.content_type or ("audio/webm" if mode == "audio" else "video/webm")

    drive_service = DriveService()
    mentor_name = meeting.get("mentorName") or user.get("name") or "Mentor"
    meeting_date = meeting.get("date") or get_timestamp()

    result = await drive_service.upload_recording(
        file_bytes=contents,
        filename=filename,
        mime_type=mime_type,
        meeting_id=meeting_id,
        mentor_name=mentor_name,
        meeting_date=meeting_date
    )

    # Persist recording metadata to Firestore meeting document
    rec_update = {
        "hasRecording": True,
        "recordingUrl": result.get("webViewLink", ""),
        "recordingDownloadUrl": result.get("downloadLink", ""),
        "recordingDriveId": result.get("fileId", ""),
        "recordingStorage": result.get("storage", "google_drive"),
        "recordingMode": mode,
        "recordingDuration": duration,
        "recordingUploadedAt": get_timestamp(),
        "recordingFileName": filename,
        "lastRecording": {
            "mode": mode,
            "duration": duration,
            "recordedAt": get_timestamp(),
            "fileName": filename,
            "url": result.get("webViewLink", "")
        }
    }
    repo.update(meeting_id, rec_update)

    return {
        "success": True,
        "message": "Recording uploaded and saved successfully",
        "meetingId": meeting_id,
        "data": result
    }


@router.get("/{meeting_id}/recording")
def get_meeting_recording(meeting_id: str, user = Depends(get_current_user)):
    """
    Retrieve recording details and Google Drive link for a meeting.
    """
    repo = MeetingRepository()
    meeting = repo.get_by_id(meeting_id)
    if not meeting:
        raise NotFoundException("Meeting not found")

    allowed_roles = {"ADMIN", "HOD", "DEAN"}
    if user["uid"] not in {meeting.get("studentId"), meeting.get("mentorId")} and user["role"] not in allowed_roles:
        raise ForbiddenException("You do not have permission to view this recording")

    if not meeting.get("hasRecording"):
        return {"hasRecording": False, "message": "No recording available for this session"}

    return {
        "hasRecording": True,
        "meetingId": meeting_id,
        "recordingUrl": meeting.get("recordingUrl"),
        "recordingDownloadUrl": meeting.get("recordingDownloadUrl"),
        "recordingDriveId": meeting.get("recordingDriveId"),
        "recordingStorage": meeting.get("recordingStorage", "google_drive"),
        "mode": meeting.get("recordingMode", "audio"),
        "duration": meeting.get("recordingDuration", 0),
        "uploadedAt": meeting.get("recordingUploadedAt")
    }
