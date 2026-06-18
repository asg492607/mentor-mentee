from fastapi import APIRouter, Depends
from app.core.dependencies import get_current_user, require_role
from app.models.enums import UserRole
from app.services.report_service import ReportService
from app.repositories.department_repository import DepartmentRepository
from app.repositories.student_repository import StudentRepository
from app.repositories.faculty_repository import FacultyRepository
from app.repositories.issue_repository import IssueRepository
from app.repositories.meeting_repository import MeetingRepository
from datetime import datetime, timezone

router = APIRouter(prefix="/dean", tags=["Dean"])

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
