from fastapi import APIRouter, Depends
from app.core.dependencies import get_current_user, require_role
from app.models.enums import UserRole
from app.services.mentor_service import MentorService
from app.services.meeting_service import MeetingService
from app.services.issue_service import IssueService
from app.schemas.meeting import MeetingUpdateRequest, MeetingNotesRequest
from app.schemas.issue import IssueEscalateRequest

router = APIRouter(prefix="/mentor", tags=["Mentor"])

def get_mentor_user(user = Depends(get_current_user)):
    require_role(user, UserRole.FACULTY)
    return user

@router.get("/dashboard")
def get_dashboard(user = Depends(get_mentor_user), mentor_service: MentorService = Depends()):
    return mentor_service.get_dashboard(user['uid'])

@router.get("/students")
def get_students(user = Depends(get_mentor_user), mentor_service: MentorService = Depends()):
    return mentor_service.get_assigned_students(user['uid'])

@router.get("/students/{student_id}")
def get_student_detail(student_id: str, user = Depends(get_mentor_user), mentor_service: MentorService = Depends()):
    return mentor_service.get_student_detail(user['uid'], student_id)

@router.get("/meetings")
def get_meetings(user = Depends(get_mentor_user), meeting_service: MeetingService = Depends()):
    return meeting_service.get_meetings_for_user(user['uid'], user.get('role', 'FACULTY'))

@router.put("/meetings/{meeting_id}")
def update_meeting(meeting_id: str, data: MeetingUpdateRequest, user = Depends(get_mentor_user), meeting_service: MeetingService = Depends()):
    if data.status == "APPROVED":
        return meeting_service.approve_meeting(user['uid'], meeting_id, data.scheduledAt)
    elif data.status == "REJECTED":
        return meeting_service.reject_meeting(user['uid'], meeting_id, data.rejectionReason)
    return {"message": "Invalid status update"}

@router.post("/meetings/{meeting_id}/notes")
def add_meeting_notes(meeting_id: str, data: MeetingNotesRequest, user = Depends(get_mentor_user), meeting_service: MeetingService = Depends()):
    return meeting_service.add_notes(meeting_id, data)

@router.post("/meetings/{meeting_id}/action-items")
def add_action_item(meeting_id: str, user = Depends(get_mentor_user)):
    return {"message": f"Action item added to meeting {meeting_id}"}

@router.get("/issues")
def get_issues(user = Depends(get_mentor_user), issue_service: IssueService = Depends()):
    return issue_service.get_issues_for_user(user['uid'], user.get('role', 'FACULTY'))

@router.put("/issues/{issue_id}/escalate")
def escalate_issue(issue_id: str, data: IssueEscalateRequest, user = Depends(get_mentor_user), issue_service: IssueService = Depends()):
    return issue_service.escalate_issue(issue_id, user['uid'], data.reason, data.targetLevel)

@router.put("/issues/{issue_id}")
def update_issue(issue_id: str, data: dict, user = Depends(get_mentor_user), issue_service: IssueService = Depends()):
    if data.get('status') == 'RESOLVED':
        return issue_service.resolve_issue(issue_id, data.get('resolution', 'Resolved by mentor'))
    return issue_service.update_issue(issue_id, data)

@router.get("/reports")
def get_reports(user = Depends(get_mentor_user)):
    from app.services.report_service import ReportService
    report_service = ReportService()
    return report_service.get_mentor_report(user['uid'])
