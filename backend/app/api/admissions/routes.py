from fastapi import APIRouter, Depends

from app.core.dependencies import require_role
from app.core.exceptions import BadRequestException, ForbiddenException
from app.core.role_claims import claims_for_account
from app.firebase.client import firebase_auth
from app.models.enums import UserRole
from app.repositories.student_repository import StudentRepository
from app.utils.helpers import get_timestamp

router = APIRouter(prefix="/admissions", tags=["Admissions"])


@router.post("/students")
def admit_student(data: dict, user=Depends(require_role(UserRole.SECTION_HEAD))):
    """Provision an admitted student account for the Admission Cell."""
    if user.get("department") != "Admission Cell":
        raise ForbiddenException("Only the Admission Cell can import admitted student records")
    if not firebase_auth:
        raise BadRequestException("Firebase authentication is not configured")

    name = str(data.get("name") or "").strip()
    email = str(data.get("email") or "").strip().lower()
    password = str(data.get("password") or "")
    mobile = str(data.get("mobileNumber") or "").strip()
    enrollment = str(data.get("enrollmentNumber") or "").strip()
    department = str(data.get("department") or "").strip()
    course = str(data.get("course") or data.get("program") or "").strip()
    if not name or "@" not in email or len(password) < 6 or len(mobile) < 6:
        raise BadRequestException("Name, valid email, and mobile/password of at least 6 characters are required")
    if not enrollment or not department or not course:
        raise BadRequestException("Enrollment number, department, and course are required")

    students = StudentRepository()
    if students.query(filters=[("enrollmentNumberNormalized", "==", enrollment.casefold())]) or students.query(filters=[("enrollmentNumber", "==", enrollment)]):
        raise BadRequestException("Enrollment number is already registered")

    try:
        duration = int(data.get("durationYears") or 4)
        year = int(data.get("year") or 1)
        admission_year = int(data.get("admissionYear") or 0) or None
    except (TypeError, ValueError):
        raise BadRequestException("Course duration, student year, and admission year must be valid numbers")
    if duration < 1 or duration > 8 or year < 1 or year > duration:
        raise BadRequestException("Student year must be within the configured course duration")

    created = None
    try:
        created = firebase_auth.create_user(email=email, password=password, display_name=name)
        profile = {
            "id": created.uid,
            "name": name,
            "email": email,
            "role": UserRole.STUDENT.value,
            "department": department,
            "enrollmentNumber": enrollment,
            "enrollmentNumberNormalized": enrollment.casefold(),
            "mobileNumber": mobile,
            "course": course,
            "program": course,
            "class": str(data.get("class") or "").strip() or None,
            "year": year,
            "yearLabel": str(data.get("yearLabel") or "").strip() or None,
            "durationYears": duration,
            "admissionYear": admission_year,
            "academicYear": str(data.get("academicYear") or "").strip() or None,
            "admissionStatus": "ADMITTED",
            "admittedBy": user.get("uid"),
            "admittedByName": user.get("name"),
            "admittedAt": get_timestamp(),
            "cgpa": 0,
            "attendance": 0,
            "attendanceStatus": "NOT_RECORDED",
            "riskScore": 0,
            "riskLevel": "LOW",
            "mentorId": None,
            "secondaryMentorId": None,
            "mentorIds": [],
            "status": "approved",
            "isApproved": True,
            "createdAt": get_timestamp(),
            "updatedAt": get_timestamp(),
        }
        students.create(profile, doc_id=created.uid)
        firebase_auth.set_custom_user_claims(created.uid, claims_for_account(UserRole.STUDENT.value, True))
        return profile
    except Exception as error:
        if created:
            try:
                students.delete(created.uid)
            except Exception:
                pass
            try:
                firebase_auth.delete_user(created.uid)
            except Exception:
                pass
        if "already exists" in str(error).lower() or "email already" in str(error).lower():
            raise BadRequestException("Email is already registered")
        if isinstance(error, BadRequestException):
            raise
        raise BadRequestException("Could not create the admitted student account")
