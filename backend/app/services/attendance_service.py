from app.core.exceptions import BadRequestException, NotFoundException
from app.firebase.client import db
from app.utils.helpers import get_timestamp


def recalculate_class_attendance(class_id: str) -> dict:
    """Rebuild a class's student attendance summaries from its saved register."""
    if not db:
        raise BadRequestException("Attendance records are not configured")

    class_doc = db.collection("classes").document(class_id).get()
    if not class_doc.exists:
        raise NotFoundException("Class not found")
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

    for student_doc in db.collection("students").where("classId", "==", class_id).stream():
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
