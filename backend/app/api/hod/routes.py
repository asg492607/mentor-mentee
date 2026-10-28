from fastapi import APIRouter, Depends
from app.core.dependencies import get_current_user, require_role
from app.models.enums import UserRole
from app.services.report_service import ReportService
from app.services.risk_service import RiskService
from app.repositories.issue_repository import IssueRepository
from app.repositories.faculty_repository import FacultyRepository
from app.firebase.client import firebase_auth
from app.core.role_claims import claims_for_account
from app.repositories.student_repository import StudentRepository
from app.core.exceptions import NotFoundException, ForbiddenException, BadRequestException
from app.utils.helpers import get_timestamp

from app.services.issue_service import IssueService
from app.schemas.issue import IssueEscalateRequest
from app.services.allocation_service import AllocationService
import logging

router = APIRouter(prefix="/hod", tags=["HOD"])
logger = logging.getLogger(__name__)


def _department_scope(user: dict) -> str:
    if user.get("departmentId"):
        return f"id:{user['departmentId']}"
    department = str(user.get("department") or "")
    return f"legacy:{department}|{str(user.get('schoolId') or '')}" if department else ""


def _same_department(user: dict, record: dict) -> bool:
    user_id = user.get("departmentId")
    record_id = record.get("departmentId")
    if user_id or record_id:
        return bool(user_id and record_id and user_id == record_id)
    user_school = user.get("schoolId")
    record_school = record.get("schoolId")
    if user_school or record_school:
        return bool(user_school and record_school and user_school == record_school
                    and user.get("department") == record.get("department"))
    return bool(user.get("department")) and user.get("department") == record.get("department")

def get_hod_user(user = Depends(require_role(UserRole.HOD))):
    return user

@router.get("/dashboard")
def get_dashboard(user = Depends(get_hod_user), report_service: ReportService = Depends()):
    return report_service.get_dashboard_stats(UserRole.HOD.value, user['uid'], _department_scope(user))

@router.get("/risk-students")
def get_risk_students(user = Depends(get_hod_user), risk_service: RiskService = Depends()):
    return risk_service.get_high_risk_students(_department_scope(user))

@router.get("/escalations")
def get_escalations(user = Depends(get_hod_user)):
    issue_repo = IssueRepository()
    student_repo = StudentRepository()
    issues = issue_repo.get_escalated('HOD')
    visible = []
    for issue in issues:
        placement = issue
        student_id = issue.get('studentId')
        if student_id and not issue.get('departmentId'):
            student = student_repo.get_by_id(student_id)
            placement = {**issue, **(student or {})}
        if _same_department(user, placement):
            visible.append(issue)
    return visible

@router.put("/issues/{issue_id}/escalate")
def escalate_issue(issue_id: str, data: IssueEscalateRequest, user = Depends(get_hod_user), issue_service: IssueService = Depends()):
    issue = IssueRepository().get_by_id(issue_id)
    if not issue:
        raise NotFoundException("Issue not found")
    student_id = issue.get('studentId')
    student = StudentRepository().get_by_id(student_id) if student_id else None
    placement = issue if issue.get('departmentId') else {**issue, **(student or {})}
    if not _same_department(user, placement) or issue.get('escalationLevel') != 'HOD':
        raise ForbiddenException("You can only escalate issues assigned to your department")
    if data.targetLevel.value != 'DEAN':
        raise BadRequestException("HODs can escalate issues only to the dean")
    return issue_service.escalate_issue(issue_id, user['uid'], data.reason, data.targetLevel)

@router.put("/issues/{issue_id}")
def update_issue(issue_id: str, data: dict, user = Depends(get_hod_user), issue_service: IssueService = Depends()):
    issue = IssueRepository().get_by_id(issue_id)
    if not issue:
        raise NotFoundException("Issue not found")
    student_id = issue.get('studentId')
    student = StudentRepository().get_by_id(student_id) if student_id else None
    placement = issue if issue.get('departmentId') else {**issue, **(student or {})}
    if not _same_department(user, placement) or issue.get('escalationLevel') != 'HOD':
        raise ForbiddenException("You can only update issues in your department")
    allowed_fields = {"status", "resolution", "actionTaken", "updatedAt"}
    if not set(data).issubset(allowed_fields):
        raise BadRequestException("Unsupported issue fields")
    if data.get('status') == 'RESOLVED':
        return issue_service.resolve_issue(issue_id, data.get('resolution', 'Resolved by HOD'))
    return issue_service.update_issue(issue_id, data)

@router.get("/mentors")
def get_mentors(user = Depends(get_hod_user)):
    faculty_repo = FacultyRepository()
    scope = _department_scope(user)
    if scope:
        return faculty_repo.get_by_department(scope)
    return []


@router.put("/faculty/{faculty_id}/approve")
def approve_faculty(faculty_id: str, user=Depends(get_hod_user)):
    faculty_repo = FacultyRepository()
    profile = faculty_repo.get_by_id(faculty_id)
    if not profile:
        raise NotFoundException("Faculty account not found")
    if not _same_department(user, profile):
        raise ForbiddenException("You can only approve faculty in your department")
    if profile.get("role") != UserRole.FACULTY.value or profile.get("status") != "pending":
        raise BadRequestException("Only pending faculty accounts can be approved by an HOD")
    if not firebase_auth:
        raise BadRequestException("Firebase authentication is not configured")

    updated_at = get_timestamp()
    faculty_repo.update(faculty_id, {"status": "approved", "isApproved": True, "updatedAt": updated_at})
    firebase_auth.set_custom_user_claims(faculty_id, claims_for_account(UserRole.FACULTY.value, True))
    try:
        AllocationService().auto_allocate(_department_scope(user))
    except Exception:
        logger.exception("Could not allocate unassigned students after approving faculty %s", faculty_id)
    return {**profile, "status": "approved", "isApproved": True, "updatedAt": updated_at}
