import hashlib
import logging
import math
import re
from datetime import date, datetime
from decimal import Decimal, InvalidOperation, ROUND_HALF_UP
from uuid import uuid4

from fastapi import APIRouter, Depends

from app.core.dependencies import get_current_user, require_role
from app.core.exceptions import BadRequestException, ForbiddenException, NotFoundException
from app.core.role_claims import claims_for_account
from app.firebase.client import firebase_auth
from app.models.enums import UserRole
from app.repositories.student_repository import StudentRepository
from app.utils.helpers import get_timestamp
from app.services.institution_service import resolve_academic_placement
from app.services.allocation_service import AllocationService
from app.firebase.client import db
from firebase_admin import firestore as admin_firestore

router = APIRouter(prefix="/admissions", tags=["Admissions"])
logger = logging.getLogger(__name__)


def _is_admission_office(user: dict) -> bool:
    return user.get("role") == UserRole.SECTION_HEAD.value and user.get("department") == "Admission Cell"


def _is_exam_office(user: dict) -> bool:
    return user.get("role") == UserRole.SECTION_HEAD.value and user.get("department") == "Exam Section"


def _require_admission_manager(user: dict) -> None:
    if user.get("role") != UserRole.ADMIN.value and not _is_admission_office(user):
        raise ForbiddenException("Only the Admin or Admission Cell can change admission and finance records")


def _year_number(value) -> int:
    text = str(value or "").strip().upper()
    match = re.search(r"(?:^|\D)([1-8])(?:\D|$)", text)
    if match:
        return int(match.group(1))
    return {"FY": 1, "FIRST": 1, "SY": 2, "SECOND": 2, "TY": 3, "THIRD": 3,
            "LY": 4, "FINAL": 4, "FOURTH": 4}.get(text, 0)


def _year_label(value: int) -> str:
    return {1: "FY", 2: "SY", 3: "TY", 4: "LY"}.get(value, f"Year {value}")


def _result_rank(result: dict):
    try:
        semester = int(result.get("semesterNumber") or 0)
    except (TypeError, ValueError):
        semester = 0
    year_text = str(result.get("academicYear") or "")
    year_match = re.search(r"(?:19|20)\d{2}", year_text)
    academic_year = int(year_match.group(0)) if year_match else 0
    if not academic_year:
        updated_match = re.search(r"(?:19|20)\d{2}", str(result.get("updatedAt") or ""))
        academic_year = int(updated_match.group(0)) if updated_match else 0
    if not academic_year:
        try:
            admission_year = int(result.get("admissionYear") or 0)
        except (TypeError, ValueError):
            admission_year = 0
        academic_year = admission_year + max(0, (semester - 1) // 2) if admission_year else 0
    return academic_year, semester, str(result.get("updatedAt") or "")


def _money(value, field: str, *, optional: bool = False):
    if value is None or value == "":
        if optional:
            return None
        raise BadRequestException(f"{field} is required")
    try:
        amount = Decimal(str(value))
    except (InvalidOperation, TypeError, ValueError):
        raise BadRequestException(f"{field} must be a valid amount")
    if not amount.is_finite() or amount < 0 or amount > Decimal("1000000000"):
        raise BadRequestException(f"{field} must be between 0 and 1,000,000,000 INR")
    rounded = amount.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
    if amount != rounded:
        raise BadRequestException(f"{field} can have at most two decimal places")
    return float(rounded)


def _fee_status(total_amount, amount_paid, due_date) -> str:
    if total_amount is None:
        return "NOT_SET"
    outstanding = max(0, round(float(total_amount) - float(amount_paid or 0), 2))
    if outstanding == 0:
        return "PAID"
    if due_date and str(due_date) < date.today().isoformat():
        return "OVERDUE"
    if float(amount_paid or 0) > 0:
        return "PARTIAL"
    return "DUE"


@router.put("/students/{student_id}/lifecycle")
def update_student_lifecycle(student_id: str, data: dict, user=Depends(get_current_user)):
    """Record provisional admission and exam-approved repeat-year decisions."""
    if not db:
        raise BadRequestException("Academic records are not configured")
    is_admin = user.get("role") == UserRole.ADMIN.value
    is_admission = _is_admission_office(user)
    is_exam = _is_exam_office(user)
    if not (is_admin or is_admission or is_exam):
        raise ForbiddenException("Only the Admin, Admission Cell, or Exam Section can update this student lifecycle")

    allowed = {"admissionStatus", "provisionalUntil", "admissionNotes", "academicStanding", "year", "academicYear", "reason"}
    unknown = set(data) - allowed
    if unknown:
        raise BadRequestException(f"Unsupported lifecycle field(s): {', '.join(sorted(unknown))}")
    admission_fields = {"admissionStatus", "provisionalUntil", "admissionNotes"}
    if admission_fields.intersection(data) and not (is_admin or is_admission):
        raise ForbiddenException("Only the Admin or Admission Cell can change admission status")
    academic_fields = {"academicStanding", "year", "academicYear", "reason"}
    if academic_fields.intersection(data) and not (is_admin or is_exam):
        raise ForbiddenException("Only the Admin or Exam Section can change academic progression")
    if not data:
        raise BadRequestException("Provide at least one lifecycle update")

    student_ref = db.collection("students").document(student_id)
    snapshot = student_ref.get()
    if not student_id or not snapshot.exists:
        raise NotFoundException("Student record not found")
    student = snapshot.to_dict() or {}
    updates = {"updatedAt": get_timestamp()}

    if "admissionStatus" in data:
        admission_status = str(data.get("admissionStatus") or "").strip().upper()
        if admission_status not in {"PROVISIONAL", "ADMITTED"}:
            raise BadRequestException("Admission status must be Provisional or Admitted")
        updates["admissionStatus"] = admission_status
        if admission_status == "ADMITTED" and str(student.get("admissionStatus") or "").upper() != "ADMITTED":
            updates["admittedAt"] = get_timestamp()
            updates["admittedBy"] = user.get("uid")
            updates["admittedByName"] = user.get("name")

    if "provisionalUntil" in data:
        provisional_until = str(data.get("provisionalUntil") or "").strip()
        if provisional_until:
            try:
                datetime.strptime(provisional_until, "%Y-%m-%d")
            except ValueError:
                raise BadRequestException("Provisional review date must use YYYY-MM-DD")
        updates["provisionalUntil"] = provisional_until or None

    if "admissionNotes" in data:
        updates["admissionNotes"] = str(data.get("admissionNotes") or "").strip()[:500]
    if updates.get("admissionStatus") == "ADMITTED":
        updates["provisionalUntil"] = None

    if not academic_fields.intersection(data):
        student_ref.update(updates)
        return {"id": student_id, **updates}
    if "reason" in data and not ({"academicStanding", "year"} & set(data)):
        raise BadRequestException("A reason must accompany an academic standing or year change")

    old_year = _year_number(student.get("year")) or _year_number(student.get("yearLabel")) or 1
    duration = student.get("durationYears")
    if duration is None:
        config_snapshot = db.collection("settings").document("academics").get()
        courses = (config_snapshot.to_dict() or {}).get("courses", []) if config_snapshot.exists else []
        course = str(student.get("course") or student.get("program") or "").strip().casefold()
        match = next((item for item in courses if isinstance(item, dict) and str(item.get("name") or "").strip().casefold() == course), {})
        duration = match.get("durationYears")
    try:
        duration = int(duration)
    except (TypeError, ValueError):
        duration = 0
    if duration < 1 or duration > 8:
        raise BadRequestException("Configure this student's course duration before changing academic progression")

    old_standing = "YEAR_DOWN" if student.get("yearDown") is True else str(student.get("academicStanding") or "CURRENT").upper()
    if old_standing not in {"CURRENT", "YEAR_DOWN"}:
        old_standing = "CURRENT"
    standing = str(data.get("academicStanding", old_standing) or old_standing).strip().upper()
    if standing not in {"CURRENT", "YEAR_DOWN"}:
        raise BadRequestException("Academic standing must be Current or Year down")
    new_year = _year_number(data.get("year")) if "year" in data else old_year
    if new_year < 1 or new_year > duration:
        raise BadRequestException(f"Year must be between 1 and the configured {duration}-year course duration")
    if standing == "YEAR_DOWN" and new_year != old_year:
        raise BadRequestException("A year-down student must remain in the same year")
    history = student.get("academicProgressHistory") if isinstance(student.get("academicProgressHistory"), list) else []
    reason = str(data.get("reason") or "").strip()[:500]
    academic_year = str(data.get("academicYear") or "").strip()[:20]
    if not academic_year:
        config_snapshot = db.collection("settings").document("academics").get()
        academic_year = str((config_snapshot.to_dict() or {}).get("activeAcademicYear") or student.get("academicYear") or "").strip()[:20]

    status_changed = standing != old_standing
    year_changed = new_year != old_year
    new_down_event = standing == "YEAR_DOWN" and (status_changed or not student.get("yearDownAt") or str(student.get("yearDownAcademicYear") or "") != academic_year)
    if new_down_event and not reason:
        raise BadRequestException("Add the exam decision or failure reason before marking a student year down")
    if year_changed and not reason:
        raise BadRequestException("Add the exam decision reason before changing a student's year")
    if new_down_event:
        history.append({"type": "YEAR_DOWN", "year": old_year, "academicYear": academic_year or None,
                        "reason": reason, "recordedBy": user.get("uid"), "recordedByName": user.get("name"), "at": updates["updatedAt"]})
        updates.update({"yearDown": True, "yearDownYear": old_year, "yearDownAcademicYear": academic_year or None,
                        "yearDownReason": reason, "yearDownAt": updates["updatedAt"],
                        "yearRepeatCount": (int(student.get("yearRepeatCount")) if str(student.get("yearRepeatCount") or "").isdigit() else 0) + 1})
    elif standing == "YEAR_DOWN" and reason and reason != str(student.get("yearDownReason") or ""):
        history.append({"type": "YEAR_DOWN_REASON_UPDATED", "year": old_year, "academicYear": academic_year or None,
                        "reason": reason, "recordedBy": user.get("uid"), "recordedByName": user.get("name"), "at": updates["updatedAt"]})
        updates["yearDownReason"] = reason
    elif standing == "CURRENT" and old_standing == "YEAR_DOWN":
        history.append({"type": "YEAR_DOWN_CLEARED", "year": old_year, "academicYear": academic_year or None,
                        "reason": reason or "Academic progression updated", "recordedBy": user.get("uid"),
                        "recordedByName": user.get("name"), "at": updates["updatedAt"]})
        updates.update({"yearDown": False, "yearDownYear": None, "yearDownAcademicYear": None,
                        "yearDownReason": None, "yearDownAt": None})
    if year_changed:
        history.append({"type": "YEAR_UPDATED", "fromYear": old_year, "toYear": new_year,
                        "academicYear": academic_year or None, "reason": reason or "Academic progression updated",
                        "recordedBy": user.get("uid"), "recordedByName": user.get("name"), "at": updates["updatedAt"]})
        updates.update({"year": new_year, "yearLabel": _year_label(new_year)})
    if "academicStanding" in data or year_changed:
        updates["academicStanding"] = standing
    if "academicYear" in data and academic_year:
        updates["academicYear"] = academic_year
    if history != (student.get("academicProgressHistory") or []):
        updates["academicProgressHistory"] = history[-50:]

    student_ref.update(updates)
    return {"id": student_id, **updates, "year": new_year, "yearLabel": _year_label(new_year), "academicStanding": standing}


def _fee_response(student_id: str, data: dict) -> dict:
    total = data.get("totalAmount")
    paid = float(data.get("amountPaid") or 0)
    outstanding = max(0, round(float(total or 0) - paid, 2))
    result = {"studentId": student_id, **data, "outstandingAmount": outstanding,
              "status": _fee_status(total, paid, data.get("dueDate")), "currency": data.get("currency") or "INR"}
    return result


@router.get("/fees")
def get_fee_summaries(user=Depends(get_current_user)):
    allowed = user.get("role") in {UserRole.ADMIN.value, UserRole.DEAN.value} or _is_admission_office(user)
    if not allowed:
        raise ForbiddenException("Fee summaries are limited to the Admin, Dean, and Admission Cell")
    if not db:
        raise BadRequestException("Finance records are not configured")
    return [_fee_response(item.id, item.to_dict() or {}) for item in db.collection("student_finances").stream()]


@router.get("/students/{student_id}/fees")
def get_student_fees(student_id: str, user=Depends(get_current_user)):
    is_self = user.get("role") == UserRole.STUDENT.value and user.get("uid") == student_id
    is_office = user.get("role") in {UserRole.ADMIN.value, UserRole.DEAN.value} or _is_admission_office(user)
    if not (is_self or is_office):
        raise ForbiddenException("You cannot view this student's finance record")
    if not db:
        raise BadRequestException("Finance records are not configured")
    student_ref = db.collection("students").document(student_id)
    student_snapshot = student_ref.get()
    if not student_snapshot.exists:
        raise NotFoundException("Student record not found")
    snapshot = db.collection("student_finances").document(student_id).get()
    data = snapshot.to_dict() or {} if snapshot.exists else {}
    payments = db.collection("student_fee_payments").where("studentId", "==", student_id).stream()
    result = _fee_response(student_id, data)
    payment_rows = [payment.to_dict() or {} for payment in payments]
    result["payments"] = sorted(payment_rows, key=lambda item: str(item.get("recordedAt") or ""), reverse=True)[:20]
    return result


@router.put("/students/{student_id}/fees")
def update_student_fees(student_id: str, data: dict, user=Depends(get_current_user)):
    _require_admission_manager(user)
    if not db:
        raise BadRequestException("Finance records are not configured")
    student_snapshot = db.collection("students").document(student_id).get()
    if not student_id or not student_snapshot.exists:
        raise NotFoundException("Student record not found")

    allowed = {"totalAmount", "paymentAmount", "paymentId", "dueDate", "note", "reference"}
    unknown = set(data) - allowed
    if unknown:
        raise BadRequestException(f"Unsupported finance field(s): {', '.join(sorted(unknown))}")
    if not data:
        raise BadRequestException("Provide a fee schedule, due date, note, or payment update")
    requested_total = _money(data.get("totalAmount"), "Total fee", optional=True) if "totalAmount" in data else None
    if "totalAmount" in data and requested_total is None:
        raise BadRequestException("Total fee cannot be cleared; enter 0 for a waived or fully credited fee")
    payment_amount = _money(data.get("paymentAmount", 0), "Payment amount")
    due_date = str(data.get("dueDate") or "").strip() if "dueDate" in data else None
    if due_date:
        try:
            datetime.strptime(due_date, "%Y-%m-%d")
        except ValueError:
            raise BadRequestException("Fee due date must use YYYY-MM-DD")
    note = str(data.get("note") or "").strip()[:500]
    reference = str(data.get("reference") or "").strip()[:100]
    payment_id = str(data.get("paymentId") or uuid4()).strip()
    if payment_amount > 0 and not re.fullmatch(r"[A-Za-z0-9_-]{8,80}", payment_id):
        raise BadRequestException("Payment reference key is invalid")
    student = student_snapshot.to_dict() or {}
    finance_ref = db.collection("student_finances").document(student_id)
    payment_ref = db.collection("student_fee_payments").document(payment_id)
    now = get_timestamp()

    @admin_firestore.transactional
    def save_finance(transaction):
        current_snapshot = finance_ref.get(transaction=transaction)
        current = current_snapshot.to_dict() or {}
        payment_snapshot = payment_ref.get(transaction=transaction) if payment_amount > 0 else None
        duplicate_payment = False
        if payment_snapshot and payment_snapshot.exists:
            existing_payment = payment_snapshot.to_dict() or {}
            if existing_payment.get("studentId") != student_id or _money(existing_payment.get("amount"), "Stored payment") != payment_amount:
                raise BadRequestException("This payment reference was already used for a different payment")
            duplicate_payment = True
        new_payment_amount = 0 if duplicate_payment else payment_amount
        current_total = _money(current.get("totalAmount"), "Stored total fee", optional=True)
        current_paid = _money(current.get("amountPaid", 0), "Stored amount paid")
        total = requested_total if "totalAmount" in data else current_total
        if total is None and new_payment_amount > 0:
            raise BadRequestException("Set a total fee before recording a payment")
        if total is not None and total < current_paid:
            raise BadRequestException("Total fee cannot be lower than payments already recorded")
        outstanding = max(0, round(float(total or 0) - current_paid, 2))
        if new_payment_amount > outstanding:
            raise BadRequestException(f"Payment exceeds the outstanding balance of ₹{outstanding:.2f}")
        paid = round(current_paid + new_payment_amount, 2)
        effective_due_date = due_date if "dueDate" in data else current.get("dueDate")
        if total is None and (new_payment_amount > 0 or effective_due_date):
            raise BadRequestException("Set a total fee before adding a due date or payment")
        if total is None and not note and new_payment_amount == 0:
            raise BadRequestException("Set a total fee before creating a fee record")
        profile = {
            "studentId": student_id,
            "studentName": student.get("name") or "",
            "enrollmentNumber": student.get("enrollmentNumber") or "",
            "department": student.get("department") or "",
            "departmentId": student.get("departmentId"),
            "schoolId": student.get("schoolId"),
            "schoolName": student.get("schoolName") or "",
            "course": student.get("course") or student.get("program") or "",
            "totalAmount": total,
            "amountPaid": paid,
            "outstandingAmount": max(0, round(float(total or 0) - paid, 2)),
            "dueDate": effective_due_date or None,
            "currency": "INR",
            "status": _fee_status(total, paid, effective_due_date),
            "notes": note if "note" in data else current.get("notes", ""),
            "updatedAt": now,
            "updatedBy": user.get("uid"),
            "updatedByName": user.get("name") or "",
            "createdAt": current.get("createdAt") or now,
        }
        transaction.set(finance_ref, profile, merge=True)
        if new_payment_amount > 0:
            transaction.set(payment_ref, {
                "studentId": student_id,
                "amount": payment_amount,
                "currency": "INR",
                "reference": reference,
                "note": note,
                "recordedAt": now,
                "recordedBy": user.get("uid"),
                "recordedByName": user.get("name") or "",
            })
        return profile

    return _fee_response(student_id, save_finance(db.transaction()))


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
    config_snapshot = None
    config = {}
    if duration is None or not student.get("academicYear"):
        config_snapshot = db.collection("settings").document("academics").get()
        config = config_snapshot.to_dict() or {}
    if duration is None:
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

    academic_year = str(data.get("academicYear") or student.get("academicYear") or config.get("activeAcademicYear") or "").strip()[:20]
    if student.get("yearDown") is True and not academic_year:
        raise BadRequestException("Set the active academic year before publishing a repeat-year result")
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
        "admissionYear": student.get("admissionYear"),
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
    latest = max(existing_results + [result], key=_result_rank)
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
    admission_status = str(data.get("admissionStatus") or "ADMITTED").strip().upper()
    if admission_status not in {"PROVISIONAL", "ADMITTED"}:
        raise BadRequestException("Admission status must be Provisional or Admitted")
    provisional_until = str(data.get("provisionalUntil") or "").strip()
    if provisional_until:
        try:
            datetime.strptime(provisional_until, "%Y-%m-%d")
        except ValueError:
            raise BadRequestException("Provisional review date must use YYYY-MM-DD")
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
            "fatherContact": str(data.get("fatherContact") or data.get("parentContact") or "").strip()[:30],
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
            "admissionStatus": admission_status,
            "provisionalUntil": provisional_until or None,
            "admissionNotes": str(data.get("admissionNotes") or "").strip()[:500],
            "provisionedBy": user.get("uid"),
            "provisionedByName": user.get("name"),
            "provisionedAt": get_timestamp(),
            "admittedBy": user.get("uid") if admission_status == "ADMITTED" else None,
            "admittedByName": user.get("name") if admission_status == "ADMITTED" else None,
            "admittedAt": get_timestamp() if admission_status == "ADMITTED" else None,
            "academicStanding": "CURRENT",
            "yearDown": False,
            "yearRepeatCount": 0,
            "academicProgressHistory": [],
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
