from fastapi import APIRouter, Depends
from app.core.dependencies import get_current_user, require_role
from app.models.enums import UserRole
from app.services.student_service import StudentService
from app.services.meeting_service import MeetingService
from app.services.issue_service import IssueService
from app.schemas.student import StudentProfileUpdate
from app.schemas.meeting import MeetingCreateRequest
from app.schemas.issue import IssueCreateRequest
from app.schemas.action_item import ActionItemUpdateRequest
from app.repositories.action_item_repository import ActionItemRepository
from app.repositories.student_repository import StudentRepository
from app.repositories.meeting_repository import MeetingRepository
from app.core.exceptions import NotFoundException, ForbiddenException

router = APIRouter(prefix="/student", tags=["Student"])

def get_student_user(user = Depends(require_role(UserRole.STUDENT))):
    return user


def _student_issue_view(issue: dict) -> dict:
    """Return only fields required by the student issue tracker."""
    allowed = (
        "id", "title", "description", "category", "priority", "status",
        "escalationLevel", "createdAt", "updatedAt", "studentId",
    )
    safe = {key: issue[key] for key in allowed if key in issue}
    resolved_by = str(issue.get("resolvedByRole") or "").upper()
    if issue.get("actionTaken") or issue.get("resolution"):
        safe["actionTaken"] = issue.get("actionTaken") or issue.get("resolution")
    if resolved_by in {"HOD", "DEAN"} and (issue.get("actionTaken") or issue.get("resolution")):
        safe["actionTaken"] = "Resolved by Academic Administration"
    return safe

@router.get("/dashboard")
def get_dashboard(user = Depends(get_student_user), student_service: StudentService = Depends()):
    return student_service.get_dashboard(user['uid'])

@router.get("/mentor")
def get_mentor(user = Depends(get_student_user), student_service: StudentService = Depends()):
    return student_service.get_mentor(user['uid'])

@router.get("/meetings")
def get_meetings(user = Depends(get_student_user), meeting_service: MeetingService = Depends()):
    meetings = meeting_service.get_meetings_for_user(user['uid'], user.get('role', 'STUDENT'))
    student = StudentRepository().get_by_id(user['uid']) or {}
    meeting_repo = MeetingRepository()
    for mentor_id in {student.get('mentorId'), student.get('secondaryMentorId')} - {None, ''}:
        meetings.extend(meeting_repo.query(filters=[('studentId', '==', 'ALL'), ('mentorId', '==', mentor_id), ('isGroup', '==', True)]))
    unique = {meeting['id']: meeting for meeting in meetings if meeting.get('id')}
    safe_meetings = []
    for meeting in unique.values():
        safe = dict(meeting)
        for field in ('aiNotes', 'report', 'transcript', 'extractedSentences', 'confidentialObservations'):
            safe.pop(field, None)
        notes = safe.get('notes')
        if isinstance(notes, dict):
            notes = dict(notes)
            for field in ('confidentialObservations', 'confidentialNotes', 'transcript', 'extractedSentences'):
                notes.pop(field, None)
            safe['notes'] = notes
        attendees = safe.get('attendees')
        if isinstance(attendees, list):
            safe['attendees'] = [
                {key: item[key] for key in ('name', 'role', 'joinedAt', 'leftAt', 'durationSeconds', 'status', 'attended') if key in item}
                for item in attendees if isinstance(item, dict) and item.get('userId') == user['uid']
            ]
        safe_meetings.append(safe)
    return sorted(safe_meetings, key=lambda meeting: str(meeting.get('createdAt') or ''), reverse=True)

@router.post("/meetings/request")
def request_meeting(data: MeetingCreateRequest, user = Depends(get_student_user), meeting_service: MeetingService = Depends()):
    student = StudentRepository().get_by_id(user['uid'])
    if not student or not data.mentorId or data.mentorId not in {student.get('mentorId'), student.get('secondaryMentorId')}:
        raise ForbiddenException("You can only request meetings with your assigned mentor")
    return meeting_service.request_meeting(user['uid'], user.get('name', 'Student'), data.mentorId, data)

@router.get("/issues")
def get_issues(user = Depends(get_student_user), issue_service: IssueService = Depends()):
    issues = issue_service.get_issues_for_user(user['uid'], user.get('role', 'STUDENT'))
    return [_student_issue_view(issue) for issue in issues]

@router.post("/issues")
def create_issue(data: IssueCreateRequest, user = Depends(get_student_user), issue_service: IssueService = Depends()):
    student = StudentRepository().get_by_id(user['uid'])
    mentor_id = (student or {}).get('mentorId') or (student or {}).get('secondaryMentorId')
    if not student or not mentor_id:
        raise ForbiddenException("An assigned mentor is required before raising an issue")
    issue = issue_service.create_issue(user['uid'], user.get('name', 'Student'), mentor_id, data)
    return _student_issue_view(issue)

@router.get("/tasks")
def get_tasks(user = Depends(get_student_user), student_service: StudentService = Depends()):
    return student_service.get_dashboard(user['uid']).get('tasks', [])

@router.put("/tasks/{task_id}")
def update_task(task_id: str, data: ActionItemUpdateRequest, user = Depends(get_student_user)):
    task_repo = ActionItemRepository()
    task = task_repo.get_by_id(task_id)
    if not task:
        raise NotFoundException("Task not found")
    if task.get("studentId") != user["uid"]:
        raise ForbiddenException("You cannot update this task")
    update_data = data.model_dump(exclude_unset=True) if hasattr(data, "model_dump") else data.dict(exclude_unset=True)
    if "completionPercentage" in update_data:
        update_data["progress"] = update_data.pop("completionPercentage")
    task_repo.update(task_id, update_data)
    return task_repo.get_by_id(task_id)

@router.get("/profile")
def get_profile(user = Depends(get_student_user), student_service: StudentService = Depends()):
    return student_service.get_profile(user['uid'])

@router.put("/profile")
def update_profile(data: StudentProfileUpdate, user = Depends(get_student_user), student_service: StudentService = Depends()):
    return student_service.update_profile(user['uid'], data)
