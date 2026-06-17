from fastapi import APIRouter, Depends
from app.core.dependencies import get_current_user, require_role
from app.models.enums import UserRole
from app.services.report_service import ReportService
from app.repositories.department_repository import DepartmentRepository

router = APIRouter(prefix="/dean", tags=["Dean"])

def get_dean_user(user = Depends(get_current_user)):
    require_role(user, UserRole.DEAN)
    return user

@router.get("/dashboard")
def get_dashboard(user = Depends(get_dean_user), report_service: ReportService = Depends()):
    return report_service.get_institution_report()

@router.get("/departments")
def get_departments(user = Depends(get_dean_user)):
    dept_repo = DepartmentRepository()
    return [doc.to_dict() | {'id': doc.id} for doc in dept_repo.collection.stream()]

@router.get("/analytics")
def get_analytics(user = Depends(get_dean_user)):
    return {"message": "Dean analytics data"}
