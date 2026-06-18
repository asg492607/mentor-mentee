from fastapi import APIRouter, Depends
from app.core.dependencies import get_current_user, require_role
from app.models.enums import UserRole
from app.services.allocation_service import AllocationService
from app.repositories.department_repository import DepartmentRepository
from app.repositories.student_repository import StudentRepository
from app.repositories.faculty_repository import FacultyRepository
from app.firebase.client import firebase_auth
from app.core.exceptions import BadRequestException, NotFoundException
from app.utils.helpers import get_timestamp

router = APIRouter(prefix="/admin", tags=["Admin"])


def get_admin_user(user=Depends(require_role(UserRole.ADMIN))):
    return user


@router.get("/users")
def get_users(user=Depends(get_admin_user)):
    student_repo = StudentRepository()
    faculty_repo = FacultyRepository()
    return {
        "students": student_repo.get_all(),
        "faculty": faculty_repo.get_all(),
    }


@router.post("/users")
def create_user(data: dict, user=Depends(get_admin_user)):
    if not firebase_auth:
        raise BadRequestException("Firebase authentication is not configured")
    role = str(data.get("role", "")).upper()
    if role not in {"STUDENT", "FACULTY", "HOD", "DEAN", "ADMIN"}:
        raise BadRequestException("Invalid role")
    created = firebase_auth.create_user(
        email=data["email"],
        password=data["password"],
        display_name=data.get("name"),
    )
    profile = {
        "id": created.uid,
        "email": data["email"],
        "name": data.get("name", ""),
        "role": role,
        "department": data.get("department"),
        "createdAt": get_timestamp(),
        "updatedAt": get_timestamp(),
    }
    if role == "STUDENT":
        profile.update({
            "year": data.get("year"),
            "rollNumber": data.get("rollNumber"),
            "cgpa": data.get("cgpa", 0),
            "attendance": data.get("attendance", 0),
            "riskLevel": data.get("riskLevel", "LOW"),
            "mentorId": data.get("mentorId"),
        })
    else:
        profile.update({
            "designation": data.get("designation"),
            "employeeId": data.get("employeeId"),
            "status": data.get("status", "approved"),
            "isApproved": data.get("isApproved", True),
            "maxStudents": data.get("maxStudents", 20),
            "assignedStudentCount": data.get("assignedStudentCount", 0),
        })
    repo = StudentRepository() if role == "STUDENT" else FacultyRepository()
    repo.create(profile, doc_id=created.uid)
    firebase_auth.set_custom_user_claims(created.uid, {"role": role})
    return profile


@router.put("/users/{user_id}")
def update_user(user_id: str, data: dict, user=Depends(get_admin_user)):
    student_repo = StudentRepository()
    faculty_repo = FacultyRepository()
    existing_student = student_repo.get_by_id(user_id)
    existing_faculty = faculty_repo.get_by_id(user_id)
    repo = student_repo if existing_student else faculty_repo if existing_faculty else None
    if not repo:
        raise NotFoundException("User not found")
    updates = {k: v for k, v in data.items() if k not in {"id", "email", "password"}}
    updates["updatedAt"] = get_timestamp()
    repo.update(user_id, updates)
    if firebase_auth and "role" in updates:
        firebase_auth.set_custom_user_claims(user_id, {"role": updates["role"]})
    return repo.get_by_id(user_id)


@router.delete("/users/{user_id}")
def delete_user(user_id: str, user=Depends(get_admin_user)):
    student_repo = StudentRepository()
    faculty_repo = FacultyRepository()
    if student_repo.get_by_id(user_id):
        student_repo.delete(user_id)
    elif faculty_repo.get_by_id(user_id):
        faculty_repo.delete(user_id)
    else:
        raise NotFoundException("User not found")
    if firebase_auth:
        firebase_auth.delete_user(user_id)
    return {"status": "deleted", "userId": user_id}


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
