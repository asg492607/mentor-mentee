from fastapi import APIRouter, Depends
from app.core.dependencies import require_role
from app.models.enums import UserRole
from app.services.mentor_service import MentorService
from app.services.meeting_service import MeetingService
from app.services.issue_service import IssueService
from app.schemas.meeting import MeetingUpdateRequest, MeetingNotesRequest
from app.schemas.issue import IssueEscalateRequest
from app.schemas.action_item import ActionItemCreateRequest
from app.repositories.action_item_repository import ActionItemRepository
from app.repositories.issue_repository import IssueRepository
from app.repositories.student_repository import StudentRepository
from app.firebase.client import firebase_auth
from app.core.role_claims import claims_for_account
from app.core.exceptions import NotFoundException, ForbiddenException, BadRequestException
from app.utils.helpers import get_timestamp
from app.firebase.client import db

router = APIRouter(prefix="/mentor", tags=["Mentor"])

def get_mentor_user(user = Depends(require_role(UserRole.FACULTY, UserRole.MENTOR, UserRole.HOD))):
    return user


def get_class_teacher_user(user = Depends(require_role(UserRole.CLASS_TEACHER))):
    return user


@router.post("/classes/{class_id}/attendance/recalculate")
def recalculate_class_attendance(class_id: str, user=Depends(get_class_teacher_user)):
    """Rebuild student attendance summaries from the class register on the server."""
    class_doc = db.collection("classes").document(class_id).get()
    if not class_doc.exists or (class_doc.to_dict() or {}).get("classTeacherId") != user["uid"]:
        raise ForbiddenException("You are not assigned to this class")
    class_data = class_doc.to_dict() or {}

    totals: dict[str, list[int]] = {}
    for record_doc in db.collection("attendance_records").where("classId", "==", class_id).stream():
        record = record_doc.to_dict() or {}
        student_id = str(record.get("studentId") or "")
        if not student_id:
            continue
        summary = totals.setdefault(student_id, [0, 0])
        summary[0] += 1
        summary[1] += int(record.get("present") is True)

    assigned_students = db.collection("students").where("classId", "==", class_id).stream()
    for student_doc in assigned_students:
        totals.setdefault(student_doc.id, [0, 0])

    updated = 0
    batch = db.batch()
    batch_size = 0
    for student_id, (sessions, present) in totals.items():
        student_ref = db.collection("students").document(student_id)
        student_doc = student_ref.get()
        if not student_doc.exists:
            continue
        student = student_doc.to_dict() or {}
        if student.get("classId") != class_id:
            if student.get("classId") or student.get("class") != class_data.get("className"):
                continue
            class_department_id = class_data.get("departmentId")
            student_department_id = student.get("departmentId")
            if class_department_id and student_department_id:
                if student_department_id != class_department_id:
                    continue
            elif student.get("department") != class_data.get("department"):
                continue
            if student.get("schoolId") != class_data.get("schoolId"):
                continue
        attendance = round((present / sessions) * 1000) / 10 if sessions else 0
        attendance_status = "NOT_RECORDED" if not sessions else "LOW" if attendance <= 40 else "BELOW_TARGET" if attendance < 75 else "ON_TRACK"

        score = 0
        try:
            cgpa = float(student.get("cgpa") or 0)
        except (TypeError, ValueError):
            cgpa = 0
        if cgpa > 0:
            score += 40 if cgpa < 5 else 30 if cgpa < 6 else 15 if cgpa < 7 else 0
        if sessions:
            score += 40 if attendance < 60 else 25 if attendance < 75 else 10 if attendance < 85 else 0
        try:
            open_issues = int(student.get("openIssuesCount") or 0)
        except (TypeError, ValueError):
            open_issues = 0
        score += 20 if open_issues >= 3 else 10 if open_issues > 0 else 0
        has_assessment_data = cgpa > 0 or sessions > 0 or open_issues > 0

        batch.update(student_ref, {
            "attendance": attendance,
            "attendanceStatus": attendance_status,
            "attendanceSessions": sessions,
            "attendancePresent": present,
            "riskScore": min(100, score),
            "riskLevel": "NOT_ASSESSED" if not has_assessment_data else "HIGH" if score >= 60 else "MEDIUM" if score >= 30 else "LOW",
            "updatedAt": get_timestamp(),
        })
        batch_size += 1
        updated += 1
        if batch_size == 450:
            batch.commit()
            batch = db.batch()
            batch_size = 0

    if batch_size:
        batch.commit()
    return {"updatedStudents": updated, "classId": class_id}

@router.get("/dashboard")
def get_dashboard(user = Depends(get_mentor_user), mentor_service: MentorService = Depends()):
    return mentor_service.get_dashboard(user['uid'])

@router.get("/students")
def get_students(user = Depends(get_mentor_user), mentor_service: MentorService = Depends()):
    return mentor_service.get_assigned_students(user['uid'])

@router.get("/students/{student_id}")
def get_student_detail(student_id: str, user = Depends(get_mentor_user), mentor_service: MentorService = Depends()):
    return mentor_service.get_student_detail(user['uid'], student_id)

@router.get("/meetings")
def get_meetings(user = Depends(get_mentor_user), meeting_service: MeetingService = Depends()):
    return meeting_service.get_meetings_for_user(user['uid'], user.get('role', 'FACULTY'))

@router.put("/meetings/{meeting_id}")
def update_meeting(meeting_id: str, data: MeetingUpdateRequest, user = Depends(get_mentor_user), meeting_service: MeetingService = Depends()):
    if data.status == "APPROVED":
        return meeting_service.approve_meeting(user['uid'], meeting_id, data.scheduledAt)
    elif data.status == "REJECTED":
        return meeting_service.reject_meeting(user['uid'], meeting_id, data.rejectionReason)
    return {"message": "Invalid status update"}

@router.post("/meetings/{meeting_id}/notes")
def add_meeting_notes(meeting_id: str, data: MeetingNotesRequest, user = Depends(get_mentor_user), meeting_service: MeetingService = Depends()):
    meeting = meeting_service.meeting_repo.get_by_id(meeting_id)
    if not meeting:
        raise NotFoundException("Meeting not found")
    if meeting.get("mentorId") != user["uid"]:
        raise ForbiddenException("You cannot edit notes for this meeting")
    return meeting_service.add_notes(meeting_id, data)

@router.post("/meetings/{meeting_id}/action-items")
def add_action_item(meeting_id: str, data: ActionItemCreateRequest, user = Depends(get_mentor_user)):
    meeting_service = MeetingService()
    meeting = meeting_service.meeting_repo.get_by_id(meeting_id)
    if not meeting:
        raise NotFoundException("Meeting not found")
    if meeting.get("mentorId") != user["uid"]:
        raise ForbiddenException("You cannot add action items to this meeting")
    if meeting.get("studentId") != "ALL" and meeting.get("studentId") != data.studentId:
        raise ForbiddenException("Task student must be a participant in this meeting")
    student = StudentRepository().get_by_id(data.studentId)
    if not student or user["uid"] not in {
        student.get("mentorId"), student.get("secondaryMentorId")
    }:
        raise ForbiddenException("You can only assign tasks to your mentees")
    item = {
        "meetingId": meeting_id,
        "studentId": data.studentId,
        "mentorId": user["uid"],
        "mentorName": user.get("name"),
        "description": data.description,
        "category": data.category.value if hasattr(data.category, "value") else data.category,
        "deadline": data.deadline.isoformat(),
        "status": "PENDING",
        "progress": 0,
        "createdAt": get_timestamp(),
        "updatedAt": get_timestamp(),
    }
    repo = ActionItemRepository()
    item_id = repo.create(item)
    return repo.get_by_id(item_id)

@router.get("/issues")
def get_issues(user = Depends(get_mentor_user), issue_service: IssueService = Depends()):
    return issue_service.get_issues_for_user(user['uid'], user.get('role', 'FACULTY'))

@router.put("/issues/{issue_id}/escalate")
def escalate_issue(issue_id: str, data: IssueEscalateRequest, user = Depends(get_mentor_user), issue_service: IssueService = Depends()):
    issue = IssueRepository().get_by_id(issue_id)
    if not issue:
        raise NotFoundException("Issue not found")
    if issue.get("mentorId") != user["uid"]:
        raise ForbiddenException("You can only escalate issues assigned to you")
    if issue.get("escalationLevel") != "MENTOR":
        raise ForbiddenException("This issue is no longer at the mentor escalation level")
    if data.targetLevel.value != "HOD":
        raise BadRequestException("Mentors can escalate issues only to the HOD")
    return issue_service.escalate_issue(issue_id, user['uid'], data.reason, data.targetLevel)

@router.put("/issues/{issue_id}")
def update_issue(issue_id: str, data: dict, user = Depends(get_mentor_user), issue_service: IssueService = Depends()):
    issue = IssueRepository().get_by_id(issue_id)
    if not issue:
        raise NotFoundException("Issue not found")
    if issue.get("mentorId") != user["uid"]:
        raise ForbiddenException("You can only update issues assigned to you")
    allowed_fields = {"status", "resolution", "actionTaken", "updatedAt"}
    if not set(data).issubset(allowed_fields):
        raise BadRequestException("Unsupported issue fields")
    if data.get('status') == 'RESOLVED':
        return issue_service.resolve_issue(issue_id, data.get('resolution', 'Resolved by mentor'))
    return issue_service.update_issue(issue_id, data)

@router.get("/reports")
def get_reports(user = Depends(get_mentor_user)):
    from app.services.report_service import ReportService
    report_service = ReportService()
    return report_service.get_mentor_report(user['uid'])


@router.put("/students/{student_id}/approve")
def approve_student(student_id: str, user=Depends(get_mentor_user)):
    student_repo = StudentRepository()
    student = student_repo.get_by_id(student_id)
    if not student:
        raise NotFoundException("Student account not found")
    if user["uid"] not in {student.get("mentorId"), student.get("secondaryMentorId")}:
        raise ForbiddenException("You can only approve students assigned to you")
    if not firebase_auth:
        raise BadRequestException("Firebase authentication is not configured")

    updated_at = get_timestamp()
    student_repo.update(student_id, {"status": "approved", "isApproved": True, "updatedAt": updated_at})
    firebase_auth.set_custom_user_claims(student_id, claims_for_account(UserRole.STUDENT.value, True))
    return {**student, "status": "approved", "isApproved": True, "updatedAt": updated_at}
