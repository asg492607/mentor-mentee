import os
from datetime import datetime
from fastapi import APIRouter, Depends, UploadFile, File, Form, HTTPException, Request
from fastapi.responses import FileResponse
from app.core.dependencies import get_current_user
from app.services.meeting_service import MeetingService
from app.services.drive_service import DriveService
from app.repositories.meeting_repository import MeetingRepository
from app.firebase.client import firebase_auth
from app.core.exceptions import NotFoundException, ForbiddenException, ServiceUnavailableException, BadRequestException
from app.schemas.ai_notes import AINotesRequest
from app.utils.helpers import get_timestamp
from app.services.notification_service import NotificationService
from app.services.allocation_service import AllocationService
from firebase_admin import firestore as admin_firestore
from uuid import uuid4

router = APIRouter(prefix="/meetings", tags=["Meetings"])


@router.post("/students/{student_id}/attendance-intervention")
def request_attendance_intervention(student_id: str, user=Depends(get_current_user)):
    """Create one open special meeting request for a student flagged FR (attendance <= 40%)."""
    role = str(user.get("role") or "").upper()
    if role not in {"FACULTY", "MENTOR", "CLASS_TEACHER", "HOD", "DEAN", "ADMIN"}:
        raise ForbiddenException("Your role cannot request an attendance intervention meeting")
    repo = MeetingRepository()
    student = repo.db.collection("students").document(student_id).get()
    if not student.exists:
        raise NotFoundException("Student not found")
    student_data = student.to_dict() or {}
    if str(student_data.get("status") or "").lower() not in {"approved", "active"} or student_data.get("isApproved", True) is False:
        raise BadRequestException("An approved student account is required")
    try:
        attendance = float(student_data.get("attendance") or 0)
        sessions = int(student_data.get("attendanceSessions") or 0)
    except (TypeError, ValueError):
        attendance, sessions = 0, 0
    if sessions < 1 or attendance > 40:
        raise BadRequestException("A special FR meeting is available after attendance is recorded at 40% or below")

    if role in {"FACULTY", "MENTOR", "CLASS_TEACHER"} and user["uid"] not in {
        student_data.get("mentorId"), student_data.get("secondaryMentorId")
    }:
        raise ForbiddenException("You can request this meeting only for a student assigned to you")
    if role == "HOD" and not _same_department(user, student_data):
        raise ForbiddenException("You can request this meeting only for students in your department")

    mentor_id = student_data.get("mentorId")
    if not mentor_id:
        try:
            AllocationService().allocate_student(student_id)
        except Exception:
            pass
        refreshed = repo.db.collection("students").document(student_id).get()
        student_data = refreshed.to_dict() or student_data
        mentor_id = student_data.get("mentorId")
    if not mentor_id:
        raise BadRequestException("Assign an eligible department mentor before requesting the intervention meeting")

    active_statuses = {"REQUESTED", "APPROVED", "SCHEDULED", "ONGOING", "IN_PROGRESS"}
    existing = repo.db.collection("meetings").where("studentId", "==", student_id).stream()
    for meeting_doc in existing:
        meeting = meeting_doc.to_dict() or {}
        if meeting.get("attendanceIntervention") is True and meeting.get("status") in active_statuses:
            return {"meetingId": meeting_doc.id, "created": False, "status": meeting.get("status")}

    mentor_doc = repo.db.collection("faculty").document(mentor_id).get()
    mentor = mentor_doc.to_dict() or {} if mentor_doc.exists else {}
    if str(mentor.get("status") or "").lower() not in {"approved", "active"} or mentor.get("isApproved", True) is False:
        raise BadRequestException("The assigned mentor account is not active")

    now = get_timestamp()
    meeting_ref = repo.db.collection("meetings").document()
    meeting = {
        "id": meeting_ref.id,
        "studentId": student_id,
        "studentName": student_data.get("name") or "Student",
        "mentorId": mentor_id,
        "mentorName": mentor.get("name") or "Mentor",
        "department": student_data.get("department") or "",
        "departmentId": student_data.get("departmentId"),
        "schoolId": student_data.get("schoolId"),
        "schoolName": student_data.get("schoolName") or "",
        "type": "ACADEMIC",
        "title": "Special FR Attendance Support Meeting",
        "description": f"Attendance intervention meeting requested at {attendance:.1f}% across {sessions} recorded class sessions. Review barriers, agree on an attendance recovery plan, and record the follow-up with the student.",
        "status": "REQUESTED",
        "attendanceIntervention": True,
        "attendanceFlag": "FR",
        "attendanceAtRequest": attendance,
        "attendanceSessionsAtRequest": sessions,
        "createdBy": user["uid"],
        "createdByRole": role,
        "createdAt": now,
        "updatedAt": now,
    }
    meeting_ref.set(meeting)
    notifier = NotificationService()
    notifier.create_notification(
        user_id=mentor_id, notif_type="MEETING_REQUESTED",
        title="FR attendance meeting requested",
        message=f"Please arrange a special attendance support meeting with {student_data.get('name') or 'your mentee'} ({attendance:.1f}% attendance).",
        related_id=meeting_ref.id,
    )
    notifier.create_notification(
        user_id=student_id, notif_type="MEETING_REQUESTED",
        title="Attendance support meeting requested",
        message="Your mentor has been asked to arrange a meeting to discuss attendance support and next steps.",
        related_id=meeting_ref.id,
    )
    return {"meetingId": meeting_ref.id, "created": True, "status": "REQUESTED"}


def _same_department(user: dict, record: dict) -> bool:
    user_department_id = user.get("departmentId")
    record_department_id = record.get("departmentId")
    if user_department_id or record_department_id:
        return bool(user_department_id and record_department_id and user_department_id == record_department_id)
    user_school_id = user.get("schoolId")
    record_school_id = record.get("schoolId")
    if user_school_id or record_school_id:
        return bool(user_school_id and record_school_id and user_school_id == record_school_id
                    and user.get("department") == record.get("department"))
    return bool(user.get("department")) and user.get("department") == record.get("department")


def _can_access_meeting(user: dict, meeting: dict) -> bool:
    if user["uid"] in {meeting.get("studentId"), meeting.get("mentorId")}:
        return True
    if meeting.get("studentId") == "ALL" and user.get("role") == "STUDENT":
        profile = MeetingRepository().db.collection("students").document(user["uid"]).get()
        student = profile.to_dict() if profile.exists else {}
        return meeting.get("mentorId") in {
            student.get("mentorId"), student.get("secondaryMentorId")
        }
    if user.get("role") in {"ADMIN", "DEAN"}:
        return True
    if user.get("role") == "HOD":
        scope = meeting
        if not meeting.get("departmentId") and not meeting.get("department") and meeting.get("studentId") not in (None, "ALL"):
            student = MeetingRepository().db.collection("students").document(meeting["studentId"]).get()
            scope = {**meeting, **(student.to_dict() or {})} if student.exists else meeting
        return _same_department(user, scope)
    return False


def _can_access_private_notes(user: dict, meeting: dict) -> bool:
    if (user.get("role") in {"FACULTY", "MENTOR", "HOD"} and user["uid"] == meeting.get("mentorId")) \
            or user.get("role") in {"ADMIN", "DEAN"}:
        return True
    if user.get("role") != "HOD":
        return False
    scope = meeting
    student_id = meeting.get("studentId")
    if not meeting.get("departmentId") and not meeting.get("department") and student_id not in (None, "ALL"):
        student = MeetingRepository().db.collection("students").document(student_id).get()
        scope = {**meeting, **(student.to_dict() or {})} if student.exists else meeting
    return _same_department(user, scope)


def _sanitize_meeting_for_student(meeting: dict, user_id: str) -> dict:
    safe = dict(meeting)
    for field in ("aiNotes", "report", "transcript", "extractedSentences", "confidentialObservations"):
        safe.pop(field, None)
    notes = safe.get("notes")
    if isinstance(notes, dict):
        notes = dict(notes)
        for field in ("confidentialObservations", "confidentialNotes", "transcript", "extractedSentences"):
            notes.pop(field, None)
        safe["notes"] = notes
    attendees = safe.get("attendees")
    if isinstance(attendees, list):
        safe["attendees"] = [
            {key: item[key] for key in ("name", "role", "joinedAt", "leftAt", "durationSeconds", "status", "attended") if key in item}
            for item in attendees if isinstance(item, dict) and item.get("userId") == user_id
        ]
    return safe


def _recording_recipient_emails(repo: MeetingRepository, meeting: dict) -> list[str]:
    recipient_ids = {meeting.get("mentorId")}
    student_id = meeting.get("studentId")
    if student_id and student_id != "ALL":
        recipient_ids.add(student_id)
    elif meeting.get("mentorId"):
        for field in ("mentorId", "secondaryMentorId"):
            for student in repo.db.collection("students").where(field, "==", meeting["mentorId"]).stream():
                recipient_ids.add(student.id)

    emails = set()
    for user_id in recipient_ids:
        if not user_id:
            continue
        for collection_name in ("students", "faculty"):
            profile = repo.db.collection(collection_name).document(user_id).get()
            if profile.exists:
                user_data = profile.to_dict()
                if user_data.get("status") == "approved" and user_data.get("isApproved") is True:
                    if user_data.get("email"):
                        emails.add(user_data["email"])
                break

    meeting_scope = meeting
    department = meeting.get("department")
    if not meeting.get("departmentId") and not department and meeting.get("studentId") not in (None, "ALL"):
        student = repo.db.collection("students").document(meeting["studentId"]).get()
        if student.exists:
            meeting_scope = {**meeting, **(student.to_dict() or {})}
            department = meeting_scope.get("department")
    for profile in repo.db.collection("faculty").stream():
        data = profile.to_dict()
        role = data.get("role")
        if (role in {"ADMIN", "DEAN"} or (role == "HOD" and _same_department(data, meeting_scope))) \
                and data.get("status") == "approved" and data.get("isApproved") is True and data.get("email"):
            emails.add(data["email"])
    return sorted(emails)


@router.post("/{meeting_id}/attendance")
def record_meeting_attendance(meeting_id: str, data: dict = None, user=Depends(get_current_user)):
    repo = MeetingRepository()
    meeting_ref = repo.db.collection("meetings").document(meeting_id)
    meeting = repo.get_by_id(meeting_id)
    if not meeting:
        raise NotFoundException("Meeting not found")
    if not _can_access_meeting(user, meeting):
        raise ForbiddenException("You are not a participant in this meeting")

    profile_collection = "students" if user.get("role") == "STUDENT" else "faculty"
    profile_doc = repo.db.collection(profile_collection).document(user["uid"]).get()
    profile = profile_doc.to_dict() if profile_doc.exists else {}
    if not profile:
        raise ForbiddenException("Your approved platform profile could not be found")
    session_id = str((data or {}).get("sessionId") or "").strip()[:80] or str(uuid4())
    attendee = {
        "sessionId": session_id,
        "userId": user["uid"],
        "name": profile.get("name") or user.get("name") or "Participant",
        "email": profile.get("email") or user.get("email") or "",
        "role": user.get("role") or "STUDENT",
        "class": profile.get("class") or "",
        "enrollmentNumber": profile.get("enrollmentNumber") or "",
        "department": profile.get("department") or "",
        "joinedAt": get_timestamp(),
        "status": "ATTENDED",
        "attended": True,
    }

    @admin_firestore.transactional
    def save_attendee(transaction):
        snapshot = meeting_ref.get(transaction=transaction)
        current = snapshot.to_dict() or {}
        attendees = current.get("attendees") if isinstance(current.get("attendees"), list) else []
        if not any(isinstance(item, dict) and item.get("userId") == user["uid"] and item.get("sessionId") == session_id for item in attendees):
            attendees.append(attendee)
        participant_count = len({item.get("userId") for item in attendees if isinstance(item, dict) and item.get("userId")})
        transaction.update(meeting_ref, {
            "attendees": attendees,
            "attendanceCount": participant_count,
            "updatedAt": get_timestamp(),
        })
        return participant_count

    count = save_attendee(repo.db.transaction())
    return {"recorded": True, "attendanceCount": count}


@router.post("/{meeting_id}/attendance/leave")
def record_meeting_attendance_leave(meeting_id: str, data: dict = None, user=Depends(get_current_user)):
    repo = MeetingRepository()
    meeting_ref = repo.db.collection("meetings").document(meeting_id)
    meeting = repo.get_by_id(meeting_id)
    if not meeting:
        raise NotFoundException("Meeting not found")
    if not _can_access_meeting(user, meeting):
        raise ForbiddenException("You are not a participant in this meeting")

    session_id = str((data or {}).get("sessionId") or "").strip()[:80]
    if not session_id:
        return {"recorded": False, "reason": "Attendance session was not supplied"}
    left_at = get_timestamp()

    @admin_firestore.transactional
    def save_departure(transaction):
        snapshot = meeting_ref.get(transaction=transaction)
        if not snapshot.exists:
            return False
        current = snapshot.to_dict() or {}
        attendees = current.get("attendees") if isinstance(current.get("attendees"), list) else []
        updated = []
        found = False
        for attendee in attendees:
            if isinstance(attendee, dict) and attendee.get("userId") == user["uid"] and attendee.get("sessionId") == session_id:
                found = True
                if not attendee.get("leftAt"):
                    attendee = dict(attendee)
                    attendee["leftAt"] = left_at
                    try:
                        joined = datetime.fromisoformat(str(attendee.get("joinedAt") or "").replace("Z", "+00:00"))
                        left = datetime.fromisoformat(left_at.replace("Z", "+00:00"))
                        if joined.tzinfo is None and left.tzinfo is not None:
                            joined = joined.replace(tzinfo=left.tzinfo)
                        attendee["durationSeconds"] = max(0, int((left - joined).total_seconds()))
                    except (TypeError, ValueError):
                        attendee["durationSeconds"] = None
            updated.append(attendee)
        if found:
            transaction.update(meeting_ref, {"attendees": updated, "updatedAt": left_at})
        return found

    recorded = save_departure(repo.db.transaction())
    return {"recorded": recorded}

@router.get("/{meeting_id}")
def get_meeting(meeting_id: str, user = Depends(get_current_user)):
    repo = MeetingRepository()
    meeting = repo.get_by_id(meeting_id)
    if not meeting:
        raise NotFoundException("Meeting not found")
    if not _can_access_meeting(user, meeting):
        raise ForbiddenException("You are not a participant in this meeting")
    return _sanitize_meeting_for_student(meeting, user["uid"]) if user.get("role") == "STUDENT" else meeting

@router.put("/{meeting_id}/start")
def start_meeting(meeting_id: str, user = Depends(get_current_user), meeting_service: MeetingService = Depends()):
    return meeting_service.start_meeting(meeting_id, user["uid"])

@router.put("/{meeting_id}/end")
def end_meeting(meeting_id: str, user = Depends(get_current_user), meeting_service: MeetingService = Depends()):
    meeting = meeting_service.end_meeting(meeting_id, user["uid"])
    return _sanitize_meeting_for_student(meeting, user["uid"]) if user.get("role") == "STUDENT" else meeting


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
    if not (user.get("role") in {"FACULTY", "MENTOR", "HOD"} and user["uid"] == meeting.get("mentorId")) \
            and user.get("role") != "ADMIN":
        raise ForbiddenException("Only the meeting mentor can save AI notes")

    ai_notes_dict = data.dict()
    ai_notes_dict["savedAt"] = get_timestamp()

    if not firebase_auth:
        raise ServiceUnavailableException("Firebase authentication is not configured")
    saved_at = get_timestamp()
    repo.db.collection("meeting_private").document(meeting_id).set(
        {"aiNotes": ai_notes_dict, "updatedAt": saved_at}, merge=True
    )
    repo.update(meeting_id, {"hasAiNotes": True, "updatedAt": saved_at})

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

    if not _can_access_private_notes(user, meeting):
        raise ForbiddenException("You do not have access to this meeting's AI notes")

    private_doc = repo.db.collection("meeting_private").document(meeting_id).get()
    private_data = private_doc.to_dict() if private_doc.exists else {}
    ai_notes = private_data.get("aiNotes") or meeting.get("aiNotes")
    if not ai_notes:
        return {"hasAiNotes": False, "aiNotes": None}

    return {"hasAiNotes": True, "aiNotes": ai_notes, "meetingId": meeting_id}


@router.post("/{meeting_id}/report")
def save_private_report(meeting_id: str, data: dict, user=Depends(get_current_user)):
    repo = MeetingRepository()
    meeting = repo.get_by_id(meeting_id)
    if not meeting:
        raise NotFoundException("Meeting not found")
    if not (user.get("role") in {"FACULTY", "MENTOR", "HOD"} and user["uid"] == meeting.get("mentorId")) \
            and user.get("role") != "ADMIN":
        raise ForbiddenException("Only the meeting mentor or an administrator can save this report")
    if not firebase_auth:
        raise ServiceUnavailableException("Firebase authentication is not configured")

    if len(str(data)) > 1_000_000:
        raise HTTPException(status_code=413, detail="Meeting report exceeds the size limit")
    allowed_fields = {
        "topic", "date", "time", "students", "issuesDiscussed", "transcript",
        "extractedSentences", "actionItems", "remarks", "confidentialObservations",
        "confidentialNotes", "riskLevel", "riskSignals", "tasks", "department",
        "preparedBy", "checkedBy", "verifiedBy", "hodName", "savedAt", "aiGenerated",
        "verifiedAt", "generatedAt",
    }
    report = {key: value for key, value in data.items() if key in allowed_fields}
    saved_at = get_timestamp()
    repo.db.collection("meeting_private").document(meeting_id).set(
        {"report": report, "updatedAt": saved_at}, merge=True
    )
    repo.update(meeting_id, {"hasAiNotes": True, "updatedAt": saved_at})
    return {"success": True, "meetingId": meeting_id}


@router.get("/{meeting_id}/report")
def get_private_report(meeting_id: str, user=Depends(get_current_user)):
    repo = MeetingRepository()
    meeting = repo.get_by_id(meeting_id)
    if not meeting:
        raise NotFoundException("Meeting not found")
    if not _can_access_private_notes(user, meeting):
        raise ForbiddenException("You do not have access to this meeting's report")
    private_doc = repo.db.collection("meeting_private").document(meeting_id).get()
    private_data = private_doc.to_dict() if private_doc.exists else {}
    return {"report": private_data.get("report") or meeting.get("report"), "meetingId": meeting_id}


@router.get("/{meeting_id}/minutes")
def get_student_safe_minutes(meeting_id: str, user=Depends(get_current_user)):
    repo = MeetingRepository()
    meeting = repo.get_by_id(meeting_id)
    if not meeting:
        raise NotFoundException("Meeting not found")
    if not _can_access_meeting(user, meeting):
        raise ForbiddenException("You are not a participant in this meeting")

    private_doc = repo.db.collection("meeting_private").document(meeting_id).get()
    private_data = private_doc.to_dict() if private_doc.exists else {}
    report = private_data.get("report") or meeting.get("report") or {}
    ai_notes = private_data.get("aiNotes") or meeting.get("aiNotes") or {}
    shared_notes = meeting.get("notes") if isinstance(meeting.get("notes"), dict) else {}
    return {
        "topic": report.get("topic") or ai_notes.get("topic") or meeting.get("type"),
        "issuesDiscussed": report.get("issuesDiscussed") or ai_notes.get("issuesDiscussed") or shared_notes.get("issuesDiscussed") or shared_notes.get("problem"),
        "actionItems": report.get("actionItems") or ai_notes.get("actionItems") or shared_notes.get("actionTaken") or shared_notes.get("advice"),
        "tasks": report.get("tasks") or ai_notes.get("tasks") or shared_notes.get("tasks") or [],
        "remarks": report.get("remarks") or shared_notes.get("summary") or shared_notes.get("remarks"),
    }


# ── GOOGLE DRIVE & RECORDING ENDPOINTS ──────────────────────────────────────────

@router.post("/{meeting_id}/upload-recording")
async def upload_meeting_recording(
    meeting_id: str,
    request: Request,
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
    if not _can_access_meeting(user, meeting):
        raise ForbiddenException("You are not authorized to upload recordings for this meeting")

    if mode not in {"audio", "video"}:
        raise HTTPException(status_code=400, detail="Unsupported recording mode")
    allowed_types = {"audio/webm", "audio/ogg", "audio/mp4", "audio/wav", "video/webm", "video/mp4"}
    mime_type = (file.content_type or ("audio/webm" if mode == "audio" else "video/webm")).split(";")[0].lower()
    if mime_type not in allowed_types:
        raise HTTPException(status_code=415, detail="Unsupported recording type")

    # Read binary content
    max_size = 100 * 1024 * 1024
    contents = await file.read(max_size + 1)
    if not contents:
        raise HTTPException(status_code=400, detail="Empty recording file provided")
    if len(contents) > max_size:
        raise HTTPException(status_code=413, detail="Recording exceeds the 100 MB upload limit")

    filename = os.path.basename(file.filename or f"Meeting_{meeting_id}_{mode}.webm")

    drive_service = DriveService()
    mentor_name = (meeting.get("mentorName") if meeting else None) or user.get("name") or "Mentor"
    meeting_date = (meeting.get("date") if meeting else None) or get_timestamp()

    result = await drive_service.upload_recording(
        file_bytes=contents,
        filename=filename,
        mime_type=mime_type,
        meeting_id=meeting_id,
        mentor_name=mentor_name,
        meeting_date=meeting_date
    )
    if result.get("storage") == "google_drive" and result.get("fileId"):
        await drive_service.share_file_with_users(
            result["fileId"], _recording_recipient_emails(repo, meeting)
        )

    # Convert relative local paths to absolute URLs
    base_url = str(request.base_url).rstrip("/")
    if result.get("webViewLink", "").startswith("/"):
        result["webViewLink"] = f"{base_url}{result['webViewLink']}"
    if result.get("downloadLink", "").startswith("/"):
        result["downloadLink"] = f"{base_url}{result['downloadLink']}"

    # Persist recording metadata to Firestore meeting document if db is available
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
            "recordingMimeType": mime_type,
            "lastRecording": {
                "mode": mode,
                "duration": duration,
                "recordedAt": get_timestamp(),
                "fileName": filename,
                "url": result.get("webViewLink", "")
            }
    }
    if result.get("storage") == "local_storage":
        protected_url = f"/api/meetings/{meeting_id}/recording/content"
        rec_update["recordingUrl"] = protected_url
        rec_update["recordingDownloadUrl"] = protected_url
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

    if not _can_access_meeting(user, meeting):
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


@router.get("/{meeting_id}/recording/content")
def get_meeting_recording_content(meeting_id: str, user = Depends(get_current_user)):
    repo = MeetingRepository()
    meeting = repo.get_by_id(meeting_id)
    if not meeting:
        raise NotFoundException("Meeting not found")
    if not _can_access_meeting(user, meeting):
        raise ForbiddenException("You do not have permission to view this recording")
    if meeting.get("recordingStorage") != "local_storage":
        raise NotFoundException("This recording is not stored on this server")

    file_id = str(meeting.get("recordingDriveId") or "")
    if not file_id or os.path.basename(file_id) != file_id or any(ch not in "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789._-" for ch in file_id):
        raise NotFoundException("Recording file not found")
    recording_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "static", "recordings"))
    file_path = os.path.abspath(os.path.join(recording_dir, file_id))
    if not file_path.startswith(recording_dir + os.sep) or not os.path.isfile(file_path):
        raise NotFoundException("Recording file not found")
    return FileResponse(file_path, media_type=meeting.get("recordingMimeType", "application/octet-stream"))
