import hashlib
import logging
import math
import re

from fastapi import APIRouter, Depends

from app.core.dependencies import require_role
from app.core.exceptions import BadRequestException, ForbiddenException
from app.core.role_claims import claims_for_account
from app.firebase.client import firebase_auth
from app.models.enums import UserRole
from app.repositories.student_repository import StudentRepository
from app.utils.helpers import get_timestamp
from app.services.institution_service import resolve_academic_placement
from app.services.allocation_service import AllocationService
from app.firebase.client import db

router = APIRouter(prefix="/admissions", tags=["Admissions"])
logger = logging.getLogger(__name__)


def _semester_number(value) -> int:
    text = str(value or "").strip().upper()
    match = re.fullmatch(r"(?:SEM(?:ESTER)?\s*)?(\d{1,2})", text)
    if match:
        return int(match.group(1))
    match = re.fullmatch(r"(?:SEM(?:ESTER)?\s*)?([IVX]+)", text)
    if not match:
        return 0
    return {
        "I": 1, "II": 2, "III": 3, "IV": 4, "V": 5, "VI": 6,
        "VII": 7, "VIII": 8, "IX": 9, "X": 10, "XI": 11, "XII": 12,
        "XIII": 13, "XIV": 14, "XV": 15, "XVI": 16,
    }.get(match.group(1), 0)


def _optional_number(data: dict, field: str, *, maximum: float = None):
    value = data.get(field)
    if value is None or value == "":
        return None
    try:
        number = float(value)
    except (TypeError, ValueError):
        raise BadRequestException(f"{field.upper()} must be a valid number")
    if not math.isfinite(number) or number < 0 or (maximum is not None and number > maximum):
        raise BadRequestException(f"{field.upper()} must be from 0 to {maximum}" if maximum is not None else f"{field.upper()} cannot be negative")
    return number


@router.post("/results")
def publish_semester_result(data: dict, user=Depends(require_role(UserRole.SECTION_HEAD))):
    """Validate a semester against the student's configured course and publish it atomically."""
    if user.get("department") != "Exam Section":
        raise ForbiddenException("Only the Exam Section can publish academic results")
    if not db:
        raise BadRequestException("Academic records are not configured")

    student_id = str(data.get("studentId") or "").strip()
    student_ref = db.collection("students").document(student_id)
    student_snapshot = student_ref.get()
    if not student_id or not student_snapshot.exists:
        raise BadRequestException("The selected student record was not found")
    student = student_snapshot.to_dict() or {}
    semester = _semester_number(data.get("semester"))
    if semester < 1:
        raise BadRequestException("Semester must be a valid semester number or Roman numeral")

    course = str(student.get("course") or student.get("program") or "").strip()
    duration = student.get("durationYears")
    if duration is None:
        config_snapshot = db.collection("settings").document("academics").get()
        config = config_snapshot.to_dict() or {}
        match = next((item for item in config.get("courses", [])
                      if str(item.get("name") or "").strip().casefold() == course.casefold()), None)
        duration = (match or {}).get("durationYears")
    try:
        duration = int(duration)
    except (TypeError, ValueError):
        duration = 0
    if duration < 1 or duration > 8:
        raise BadRequestException("Configure this student's course duration before publishing results")
    semester_count = duration * 2
    if semester > semester_count:
        raise BadRequestException(f"{course or 'This course'} is configured for {semester_count} semesters ({duration} years, 6 months each)")

    sgpa = _optional_number(data, "sgpa", maximum=10)
    cgpa = _optional_number(data, "cgpa", maximum=10)
    backlogs_number = _optional_number(data, "backlogs")
    if backlogs_number is not None and not backlogs_number.is_integer():
        raise BadRequestException("Backlogs must be a whole number")
    backlogs = int(backlogs_number) if backlogs_number is not None else None
    subjects = data.get("subjects") or []
    if not isinstance(subjects, list) or len(subjects) > 250:
        raise BadRequestException("Subjects must be a list of at most 250 entries")
    clean_subjects = []
    for subject in subjects:
        if not isinstance(subject, dict):
            raise BadRequestException("Each subject must be a valid record")
        marks = _optional_number({"marks": subject.get("marks")}, "marks", maximum=100)
        clean_subjects.append({
            "name": str(subject.get("name") or "")[:160],
            "marks": marks,
            "grade": str(subject.get("grade") or "")[:16],
        })
    if sgpa is None and cgpa is None and backlogs is None and not clean_subjects:
        raise BadRequestException("Provide at least one result metric or subject record")

    academic_year = str(data.get("academicYear") or "").strip()[:20]
    exam_name = str(data.get("examName") or "").strip()[:100]
    stable_key = "|".join((student_id, str(semester), academic_year.casefold(), exam_name.casefold()))
    result_id = hashlib.sha256(stable_key.encode("utf-8")).hexdigest()
    result_ref = db.collection("academic_results").document(result_id)
    old_result = result_ref.get()
    now = get_timestamp()
    result = {
        "studentId": student_id,
        "studentName": str(student.get("name") or ""),
        "enrollmentNumber": str(student.get("enrollmentNumber") or ""),
        "department": str(student.get("department") or ""),
        "departmentId": student.get("departmentId"),
        "schoolId": student.get("schoolId"),
        "course": course,
        "year": student.get("year"),
        "semester": str(data.get("semester") or f"Semester {semester}")[:30],
        "semesterNumber": semester,
        "semesterCount": semester_count,
        "semesterDurationMonths": 6,
        "examName": exam_name,
        "academicYear": academic_year,
        "sgpa": sgpa,
        "cgpa": cgpa,
        "backlogs": backlogs,
        "subjects": clean_subjects,
        "uploadedBy": user.get("uid"),
        "uploadedByName": user.get("name") or "",
        "updatedAt": now,
        "createdAt": (old_result.to_dict() or {}).get("createdAt") if old_result.exists else now,
    }

    # Do not let an older-semester upload roll back the student's current summary.
    result_refs = db.collection("academic_results").where("studentId", "==", student_id).stream()
    existing_results = [item.to_dict() or {} for item in result_refs if item.id != result_id]
    latest = max(existing_results + [result], key=lambda item: (int(item.get("semesterNumber") or 0), str(item.get("updatedAt") or "")))
    updates = {
        "latestSemester": latest.get("semester"),
        "latestSemesterNumber": int(latest.get("semesterNumber") or 0),
        "latestSGPA": latest.get("sgpa"),
        "updatedAt": now,
    }
    numeric_marks = [float(subject["marks"]) for subject in (latest.get("subjects") or [])
                     if isinstance(subject, dict) and subject.get("marks") is not None]
    marks_average = round(sum(numeric_marks) / len(numeric_marks), 2) if numeric_marks else None
    learner_level = "NOT_ASSESSED" if marks_average is None else "SLOW" if marks_average < 50 else "MEDIUM" if marks_average < 75 else "ADVANCED"
    updates.update({"latestSubjectAverage": marks_average, "learnerLevel": learner_level})
    if latest.get("cgpa") is not None:
        updates["cgpa"] = latest["cgpa"]
    if latest.get("backlogs") is not None:
        updates["backlogs"] = latest["backlogs"]
    try:
        attendance = float(student.get("attendance") or 0)
    except (TypeError, ValueError):
        attendance = 0
    try:
        open_issues = int(student.get("openIssuesCount") or 0)
    except (TypeError, ValueError):
        open_issues = 0
    risk_score = 0
    try:
        latest_cgpa = float(updates.get("cgpa", student.get("cgpa") or 0))
    except (TypeError, ValueError):
        latest_cgpa = 0
    if latest_cgpa > 0:
        risk_score += 40 if latest_cgpa < 5 else 30 if latest_cgpa < 6 else 15 if latest_cgpa < 7 else 0
    try:
        attendance_sessions = int(student.get("attendanceSessions") or 0)
    except (TypeError, ValueError):
        attendance_sessions = 0
    attendance_recorded = attendance_sessions > 0 or (
        attendance > 0 and student.get("attendanceStatus") != "NOT_RECORDED"
    )
    if attendance_recorded:
        risk_score += 40 if attendance < 60 else 25 if attendance < 75 else 10 if attendance < 85 else 0
    risk_score += 20 if open_issues >= 3 else 10 if open_issues > 0 else 0
    has_assessment_data = latest_cgpa > 0 or attendance_recorded or open_issues > 0 or latest.get("backlogs") is not None or bool(latest.get("subjects"))
    risk_level = "NOT_ASSESSED" if not has_assessment_data else "HIGH" if risk_score >= 60 else "MEDIUM" if risk_score >= 30 else "LOW"
    updates.update({"riskScore": min(100, risk_score), "riskLevel": risk_level})
    batch = db.batch()
    batch.set(result_ref, result, merge=True)
    batch.update(student_ref, updates)
    batch.commit()
    return {"id": result_id, **result}


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
    placement = resolve_academic_placement({**data, "department": department})
    department = placement.get("department") or department

    students = StudentRepository()
    if students.query(filters=[("enrollmentNumberNormalized", "==", enrollment.casefold())]) or students.query(filters=[("enrollmentNumber", "==", enrollment)]):
        raise BadRequestException("Enrollment number is already registered")

    course_settings = db.collection("settings").document("academics").get()
    configured_courses = (course_settings.to_dict() or {}).get("courses", []) if course_settings.exists else []
    configured_course = next((item for item in configured_courses
                              if isinstance(item, dict)
                              and str(item.get("name") or "").strip().casefold() == course.casefold()), None)
    if not configured_course:
        raise BadRequestException("Configure this course and its duration before admitting students")
    try:
        duration = int(configured_course.get("durationYears"))
        if data.get("durationYears") not in (None, "") and int(data.get("durationYears")) != duration:
            raise BadRequestException("Student course duration does not match the academic setup")
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
            "departmentId": placement.get("departmentId"),
            "schoolId": placement.get("schoolId"),
            "schoolName": placement.get("schoolName"),
            "enrollmentNumber": enrollment,
            "enrollmentNumberNormalized": enrollment.casefold(),
            "mobileNumber": mobile,
            "course": course,
            "program": course,
            "class": placement.get("class"),
            "classId": placement.get("classId"),
            "year": year,
            "yearLabel": str(data.get("yearLabel") or "").strip() or None,
            "durationYears": duration,
            "semesterCount": duration * 2,
            "semesterDurationMonths": 6,
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
            "riskLevel": "NOT_ASSESSED",
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
        try:
            AllocationService().allocate_student(created.uid)
        except Exception:
            logger.exception("Could not automatically allocate a mentor to admitted student %s", created.uid)
        return students.get_by_id(created.uid) or profile
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
