import logging

from fastapi import APIRouter, Depends, Query
from app.core.dependencies import get_current_user, require_role
from app.models.enums import UserRole
from app.services.allocation_service import AllocationService
from app.repositories.department_repository import DepartmentRepository
from app.repositories.student_repository import StudentRepository
from app.repositories.faculty_repository import FacultyRepository
from app.firebase.client import firebase_auth
from app.core.role_claims import claims_for_account
from app.core.exceptions import BadRequestException, NotFoundException
from app.utils.helpers import get_timestamp
from app.services.security_event_service import SecurityEventService
from app.services.institution_service import resolve_academic_placement, same_department

router = APIRouter(prefix="/admin", tags=["Admin"])
logger = logging.getLogger(__name__)


def auto_assign_student(student_id: str) -> None:
    try:
        AllocationService().allocate_student(student_id)
    except Exception:
        logger.exception("Could not automatically allocate a mentor to student %s", student_id)


def auto_allocate_department(department: str) -> None:
    if not department:
        return
    try:
        AllocationService().auto_allocate(department)
    except Exception:
        logger.exception("Could not allocate unassigned students in department %s", department)


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
    if role not in {"STUDENT", "FACULTY", "MENTOR", "CLASS_TEACHER", "HOD", "SECTION_HEAD", "DEAN", "ADMIN"}:
        raise BadRequestException("Invalid role")
    email = str(data.get("email", "")).strip().lower()
    password = str(data.get("password", ""))
    if not email or len(password) < 6:
        raise BadRequestException("A valid email and password of at least 6 characters are required")
    placement = resolve_academic_placement(data) if role in {"STUDENT", "FACULTY", "MENTOR", "CLASS_TEACHER", "HOD"} else {}
    faculty_repo = FacultyRepository()
    if role == "STUDENT" and data.get("mentorId"):
        mentor = faculty_repo.get_by_id(str(data.get("mentorId")))
        if not mentor or not same_department(placement, mentor):
            raise BadRequestException("A student can only be assigned to a mentor from the same department and school")
        if int(mentor.get("assignedStudentCount") or 0) >= int(mentor.get("maxStudents") or 20):
            raise BadRequestException("Selected mentor has reached their student capacity")
    created = firebase_auth.create_user(
        email=email,
        password=password,
        display_name=data.get("name"),
    )
    profile = {
        "id": created.uid,
        "email": email,
        "name": data.get("name", ""),
        "role": role,
        "department": placement.get("department", data.get("department")),
        "departmentId": placement.get("departmentId"),
        "schoolId": placement.get("schoolId"),
        "schoolName": placement.get("schoolName"),
        "createdAt": get_timestamp(),
        "updatedAt": get_timestamp(),
    }
    if role == "STUDENT":
        profile.update({
            "year": data.get("year"),
            "class": placement.get("class", data.get("class")),
            "classId": placement.get("classId"),
            "rollNumber": data.get("rollNumber"),
            "enrollmentNumber": data.get("enrollmentNumber"),
            "enrollmentNumberNormalized": str(data.get("enrollmentNumber") or "").strip().casefold() or None,
            "mobileNumber": data.get("mobileNumber"),
            "course": data.get("course") or data.get("program"),
            "program": data.get("program") or data.get("course"),
            "durationYears": data.get("durationYears"),
            "yearLabel": data.get("yearLabel"),
            "admissionYear": data.get("admissionYear"),
            "academicYear": data.get("academicYear"),
            "admissionStatus": data.get("admissionStatus", "ADMITTED"),
            "cgpa": data.get("cgpa", 0),
            "attendance": data.get("attendance", 0),
            "attendanceStatus": data.get("attendanceStatus", "NOT_RECORDED"),
            "riskLevel": data.get("riskLevel", "NOT_ASSESSED"),
            "mentorId": data.get("mentorId"),
            "secondaryMentorId": None,
            "mentorIds": [data.get("mentorId")] if data.get("mentorId") else [],
            "status": "approved",
            "isApproved": True,
        })
    else:
        profile.update({
            "designation": data.get("designation"),
            "employeeId": data.get("employeeId"),
            "status": "approved",
            "isApproved": True,
            "maxStudents": data.get("maxStudents", 20),
            "assignedStudentCount": data.get("assignedStudentCount", 0),
            "classTeacherFor": data.get("classTeacherFor", []),
        })
    repo = StudentRepository() if role == "STUDENT" else FacultyRepository()
    repo.create(profile, doc_id=created.uid)
    if role == "STUDENT" and profile.get("mentorId"):
        mentor = faculty_repo.get_by_id(str(profile["mentorId"]))
        faculty_repo.update(profile["mentorId"], {
            "assignedStudentCount": int((mentor or {}).get("assignedStudentCount") or 0) + 1
        })
    firebase_auth.set_custom_user_claims(created.uid, claims_for_account(role, True))
    if role == "STUDENT" and not profile.get("mentorId"):
        auto_assign_student(created.uid)
        return repo.get_by_id(created.uid) or profile
    if role in {"FACULTY", "MENTOR", "HOD"}:
        auto_allocate_department(placement.get("departmentId") or placement.get("department"))
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
    if "role" in updates:
        role = str(updates["role"]).upper()
        allowed_roles = {item.value for item in UserRole}
        if role not in allowed_roles:
            raise BadRequestException("Invalid role")
        if existing_student and role != UserRole.STUDENT.value:
            raise BadRequestException("Student accounts cannot be assigned a staff role")
        if existing_faculty and role == UserRole.STUDENT.value:
            raise BadRequestException("Faculty accounts cannot be assigned a student role")
        updates["role"] = role
        if existing_faculty and role not in {"FACULTY", "MENTOR", "HOD"}:
            assigned_students = [student for student in student_repo.get_all()
                                 if user_id in {student.get("mentorId"), student.get("secondaryMentorId")}]
            if assigned_students:
                raise BadRequestException("Reassign this teacher's students before changing them to a non-mentor role")
    if ("department" in updates or "departmentId" in updates or "schoolId" in updates or "classId" in updates) and str(existing_student.get("role") if existing_student else existing_faculty.get("role", "")).upper() in {
        "STUDENT", "FACULTY", "MENTOR", "CLASS_TEACHER", "HOD"
    }:
        existing_profile = existing_student or existing_faculty
        placement = resolve_academic_placement({**existing_profile, **updates})
        updates.update(placement)
        mentor_id = updates.get("mentorId", existing_student.get("mentorId")) if existing_student else None
        if existing_student and mentor_id:
            mentor = faculty_repo.get_by_id(mentor_id)
            if not mentor or not same_department(placement, mentor):
                raise BadRequestException("Unassign or replace the current mentor before moving this student to another department")
        if existing_faculty:
            assigned_students = [student for student in student_repo.get_all()
                                 if user_id in {student.get("mentorId"), student.get("secondaryMentorId")}]
            if any(not same_department(student, placement) for student in assigned_students):
                raise BadRequestException("Reassign this teacher's students before moving them to another department")
    previous_mentor_id = existing_student.get("mentorId") if existing_student else None
    next_mentor_id = updates.get("mentorId", previous_mentor_id) if existing_student else None
    if existing_student and "mentorId" in updates:
        mentor_ids = [next_mentor_id, existing_student.get("secondaryMentorId")]
        updates["mentorIds"] = list(dict.fromkeys(item for item in mentor_ids if item))
        if next_mentor_id:
            mentor = faculty_repo.get_by_id(str(next_mentor_id))
            candidate_student = {**existing_student, **updates}
            if not mentor or not same_department(candidate_student, mentor):
                raise BadRequestException("A student can only be assigned to a mentor from the same department and school")
            if next_mentor_id != previous_mentor_id and int(mentor.get("assignedStudentCount") or 0) >= int(mentor.get("maxStudents") or 20):
                raise BadRequestException("Selected mentor has reached student capacity")
    updates["updatedAt"] = get_timestamp()
    repo.update(user_id, updates)
    if existing_student and previous_mentor_id != next_mentor_id:
        if next_mentor_id:
            mentor = faculty_repo.get_by_id(str(next_mentor_id)) or {}
            faculty_repo.update(str(next_mentor_id), {"assignedStudentCount": int(mentor.get("assignedStudentCount") or 0) + 1})
        if previous_mentor_id:
            mentor = faculty_repo.get_by_id(str(previous_mentor_id))
            if mentor:
                faculty_repo.update(str(previous_mentor_id), {"assignedStudentCount": max(0, int(mentor.get("assignedStudentCount") or 1) - 1)})
    if existing_student and not existing_student.get("mentorId") and (updates.get("departmentId") or updates.get("department")):
        auto_assign_student(user_id)
    updated_profile = repo.get_by_id(user_id)
    if existing_faculty and str(updated_profile.get("role", "")).upper() in {"FACULTY", "MENTOR", "HOD"} and ("department" in updates or "departmentId" in updates or "role" in updates):
        auto_allocate_department(updated_profile.get("departmentId") or updated_profile.get("department"))
    if firebase_auth and ({"role", "status", "isApproved"} & set(updates)):
        firebase_auth.set_custom_user_claims(
            user_id,
            claims_for_account(
                updated_profile.get("role"),
                updated_profile.get("status") == "approved" and updated_profile.get("isApproved") is True,
            ),
        )
    return updated_profile


@router.put("/users/{user_id}/approve")
def approve_user(user_id: str, user=Depends(get_admin_user)):
    student_repo = StudentRepository()
    faculty_repo = FacultyRepository()
    profile = student_repo.get_by_id(user_id)
    repo = student_repo if profile else faculty_repo
    if not profile:
        profile = faculty_repo.get_by_id(user_id)
    if not profile:
        raise NotFoundException("User not found")
    if not firebase_auth:
        raise BadRequestException("Firebase authentication is not configured")

    role = str(profile.get("role", "")).upper()
    profile.update({"status": "approved", "isApproved": True, "updatedAt": get_timestamp()})
    repo.update(user_id, {"status": "approved", "isApproved": True, "updatedAt": profile["updatedAt"]})
    firebase_auth.set_custom_user_claims(user_id, claims_for_account(role, True))
    if role == UserRole.STUDENT.value and not profile.get("mentorId") and (profile.get("departmentId") or profile.get("department")):
        auto_assign_student(user_id)
        profile = student_repo.get_by_id(user_id) or profile
    return profile


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


@router.get("/security-events")
def get_security_events(
    limit: int = Query(default=150, ge=1, le=300),
    user=Depends(get_admin_user),
):
    return SecurityEventService.recent_events(limit)
