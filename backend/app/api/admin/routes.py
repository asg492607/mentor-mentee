from fastapi import APIRouter, Depends
from app.core.dependencies import get_current_user, require_role
from app.models.enums import UserRole
from app.services.allocation_service import AllocationService
from app.repositories.department_repository import DepartmentRepository
from app.repositories.student_repository import StudentRepository
from app.repositories.faculty_repository import FacultyRepository

router = APIRouter(prefix="/admin", tags=["Admin"])


def get_admin_user(user=Depends(require_role(UserRole.ADMIN))):
    return user


@router.get("/users")
def get_users(user=Depends(get_admin_user)):
    return {"message": "List of all users"}


@router.post("/users")
def create_user(data: dict, user=Depends(get_admin_user)):
    return {"message": "User created"}


@router.put("/users/{user_id}")
def update_user(user_id: str, data: dict, user=Depends(get_admin_user)):
    return {"message": f"User {user_id} updated"}


@router.delete("/users/{user_id}")
def delete_user(user_id: str, user=Depends(get_admin_user)):
    return {"message": f"User {user_id} deleted"}


@router.get("/departments")
def get_departments(user=Depends(get_admin_user)):
    dept_repo = DepartmentRepository()
    return dept_repo.get_all()


@router.post("/departments")
def create_department(data: dict, user=Depends(get_admin_user)):
    dept_repo = DepartmentRepository()
    dept_id = dept_repo.create(data)
    return {"id": dept_id, **data}


@router.put("/departments/{dept_id}")
def update_department(dept_id: str, data: dict, user=Depends(get_admin_user)):
    dept_repo = DepartmentRepository()
    dept_repo.update(dept_id, data)
    return {"message": f"Department {dept_id} updated"}


@router.post("/allocate")
def manual_allocate(data: dict, user=Depends(get_admin_user), allocation_service: AllocationService = Depends()):
    return allocation_service.manual_allocate(data.get('studentId'), data.get('mentorId'))


@router.post("/auto-allocate")
def auto_allocate(data: dict, user=Depends(get_admin_user), allocation_service: AllocationService = Depends()):
    return allocation_service.auto_allocate(data.get('department'))


@router.get("/stats")
def get_stats(user=Depends(get_admin_user)):
    student_repo = StudentRepository()
    faculty_repo = FacultyRepository()
    return {
        "totalStudents": len(student_repo.get_all()),
        "totalMentors": len(faculty_repo.get_all())
    }
