from fastapi import APIRouter, Depends
from app.core.dependencies import get_current_user, require_role
from app.models.enums import UserRole
from app.services.report_service import ReportService
from app.repositories.department_repository import DepartmentRepository
from app.repositories.student_repository import StudentRepository
from app.repositories.faculty_repository import FacultyRepository
from app.repositories.issue_repository import IssueRepository
from app.repositories.meeting_repository import MeetingRepository
from app.core.exceptions import BadRequestException, NotFoundException, ServiceUnavailableException
from app.firebase.client import firebase_auth
from app.core.role_claims import claims_for_account
from app.utils.helpers import get_timestamp
from datetime import datetime, timezone
from app.services.allocation_service import AllocationService
import logging

router = APIRouter(prefix="/dean", tags=["Dean"])
logger = logging.getLogger(__name__)

def get_dean_user(user=Depends(require_role(UserRole.DEAN))):
    return user


@router.get("/dashboard")
def get_dashboard(user=Depends(get_dean_user), report_service: ReportService = Depends()):
    report = report_service.get_institution_report()
    dept_repo = DepartmentRepository()
    depts = dept_repo.get_all()
    return {
        **report,
        "departments": depts
    }


@router.get("/departments")
def get_departments(user=Depends(get_dean_user)):
    dept_repo = DepartmentRepository()
    return dept_repo.get_all()


@router.get("/analytics")
def get_analytics(user=Depends(get_dean_user)):
    student_repo = StudentRepository()
    faculty_repo = FacultyRepository()
    issue_repo   = IssueRepository()
    meeting_repo = MeetingRepository()

    all_students = student_repo.get_all()
    all_issues   = issue_repo.get_all()

    # Issue categories
    issue_categories = {}
    for issue in all_issues:
        cat = issue.get('category', 'Other')
        issue_categories[cat] = issue_categories.get(cat, 0) + 1

    # Dept risk
    dept_risk = {}
    for s in all_students:
        dept = s.get('department', 'Unknown')
        if s.get('riskLevel') == 'HIGH':
            dept_risk[dept] = dept_risk.get(dept, 0) + 1

    meetings_trend = []
    meetings = meeting_repo.get_all()
    now = datetime.now(timezone.utc)
    for offset in range(5, -1, -1):
        month = now.month - offset
        year = now.year
        while month <= 0:
            month += 12
            year -= 1
        prefix = f"{year}-{month:02d}"
        count = sum(
            1 for meeting in meetings
            if str(meeting.get('scheduledAt') or meeting.get('createdAt') or '').startswith(prefix)
        )
        meetings_trend.append(count)

    return {
        "issueCategories": issue_categories,
        "deptRisk": dept_risk,
        "meetingsTrend": meetings_trend,
        "mentorPerformance": []
    }


@router.put("/faculty/{faculty_id}/approve")
def approve_faculty(faculty_id: str, user=Depends(get_dean_user)):
    faculty_repo = FacultyRepository()
    profile = faculty_repo.get_by_id(faculty_id)
    if not profile:
        raise NotFoundException("Faculty account not found")
    if profile.get("role") != "FACULTY" or profile.get("status") != "pending":
        raise BadRequestException("This account is not eligible for dean approval")
    if not firebase_auth:
        raise ServiceUnavailableException("Firebase authentication is not configured")

    updated_at = get_timestamp()
    faculty_repo.update(faculty_id, {"status": "approved", "isApproved": True, "updatedAt": updated_at})
    firebase_auth.set_custom_user_claims(faculty_id, claims_for_account(profile["role"], True))
    try:
        AllocationService().auto_allocate(profile.get("departmentId") or profile.get("department"))
    except Exception:
        logger.exception("Could not allocate unassigned students after approving faculty %s", faculty_id)
    return {**profile, "status": "approved", "isApproved": True, "updatedAt": updated_at}


@router.put("/faculty/{faculty_id}/role")
def update_faculty_role(faculty_id: str, data: dict, user=Depends(get_dean_user)):
    role = str(data.get("role", "")).upper()
    if role not in {"FACULTY", "HOD", "SECTION_HEAD"}:
        raise BadRequestException("A dean can assign only faculty, HOD, or section-head roles")
    faculty_repo = FacultyRepository()
    profile = faculty_repo.get_by_id(faculty_id)
    if not profile:
        raise NotFoundException("Faculty account not found")
    if profile.get("status") != "approved" or profile.get("isApproved") is not True:
        raise BadRequestException("Approve this account before changing its role")
    if not firebase_auth:
        raise ServiceUnavailableException("Firebase authentication is not configured")

    updates = {"role": role, "updatedAt": get_timestamp()}
    if "department" in data:
        department = data.get("department")
        if department is not None and not isinstance(department, str):
            raise BadRequestException("Department must be a string")
        updates["department"] = department.strip() if department else None
    faculty_repo.update(faculty_id, updates)
    firebase_auth.set_custom_user_claims(faculty_id, claims_for_account(role, True))
    return {**profile, **updates}
