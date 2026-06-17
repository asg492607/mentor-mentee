from fastapi import APIRouter, Depends
from app.core.dependencies import get_current_user, require_role
from app.models.enums import UserRole
from app.services.student_service import StudentService
from app.services.meeting_service import MeetingService
from app.services.issue_service import IssueService
from app.schemas.student import StudentProfileUpdate
from app.schemas.meeting import MeetingCreateRequest
from app.schemas.issue import IssueCreateRequest

router = APIRouter(prefix="/student", tags=["Student"])

def get_student_user(user = Depends(get_current_user)):
    require_role(user, UserRole.STUDENT)
    return user

@router.get("/dashboard")
def get_dashboard(user = Depends(get_student_user), student_service: StudentService = Depends()):
    return student_service.get_dashboard(user['uid'])

@router.get("/mentor")
def get_mentor(user = Depends(get_student_user), student_service: StudentService = Depends()):
    return student_service.get_mentor(user['uid'])

@router.get("/meetings")
def get_meetings(user = Depends(get_student_user), meeting_service: MeetingService = Depends()):
    return meeting_service.get_meetings_for_user(user['uid'], user.get('role', 'STUDENT'))

@router.post("/meetings/request")
def request_meeting(data: MeetingCreateRequest, user = Depends(get_student_user), meeting_service: MeetingService = Depends()):
    return meeting_service.request_meeting(user['uid'], user.get('name', 'Student'), data.mentorId, data)

@router.get("/issues")
def get_issues(user = Depends(get_student_user), issue_service: IssueService = Depends()):
    return issue_service.get_issues_for_user(user['uid'], user.get('role', 'STUDENT'))

@router.post("/issues")
def create_issue(data: IssueCreateRequest, user = Depends(get_student_user), issue_service: IssueService = Depends()):
    return issue_service.create_issue(user['uid'], user.get('name', 'Student'), data.mentorId, data)

@router.get("/tasks")
def get_tasks(user = Depends(get_student_user), student_service: StudentService = Depends()):
    return student_service.get_dashboard(user['uid']).get('tasks', [])

@router.put("/tasks/{task_id}")
def update_task(task_id: str, user = Depends(get_student_user)):
    return {"message": f"Task {task_id} updated"}

@router.get("/profile")
def get_profile(user = Depends(get_student_user), student_service: StudentService = Depends()):
    return student_service.get_profile(user['uid'])

@router.put("/profile")
def update_profile(data: StudentProfileUpdate, user = Depends(get_student_user), student_service: StudentService = Depends()):
    return student_service.update_profile(user['uid'], data)
