from fastapi import APIRouter, Depends
from app.core.dependencies import get_current_user, require_role
from app.models.enums import UserRole
from app.services.report_service import ReportService
from app.services.risk_service import RiskService
from app.repositories.issue_repository import IssueRepository
from app.repositories.faculty_repository import FacultyRepository

from app.services.issue_service import IssueService
from app.schemas.issue import IssueEscalateRequest

router = APIRouter(prefix="/hod", tags=["HOD"])

def get_hod_user(user = Depends(require_role(UserRole.HOD))):
    return user

@router.get("/dashboard")
def get_dashboard(user = Depends(get_hod_user), report_service: ReportService = Depends()):
    return report_service.get_dashboard_stats(UserRole.HOD.value, user['uid'], user.get('department'))

@router.get("/risk-students")
def get_risk_students(user = Depends(get_hod_user), risk_service: RiskService = Depends()):
    return risk_service.get_high_risk_students(user.get('department'))

@router.get("/escalations")
def get_escalations(user = Depends(get_hod_user)):
    issue_repo = IssueRepository()
    return issue_repo.get_escalated('HOD')

@router.put("/issues/{issue_id}/escalate")
def escalate_issue(issue_id: str, data: IssueEscalateRequest, user = Depends(get_hod_user), issue_service: IssueService = Depends()):
    return issue_service.escalate_issue(issue_id, user['uid'], data.reason, data.targetLevel)

@router.put("/issues/{issue_id}")
def update_issue(issue_id: str, data: dict, user = Depends(get_hod_user), issue_service: IssueService = Depends()):
    if data.get('status') == 'RESOLVED':
        return issue_service.resolve_issue(issue_id, data.get('resolution', 'Resolved by HOD'))
    return issue_service.update_issue(issue_id, data)

@router.get("/mentors")
def get_mentors(user = Depends(get_hod_user)):
    faculty_repo = FacultyRepository()
    if user.get('department'):
        return faculty_repo.get_by_department(user.get('department'))
    return []
