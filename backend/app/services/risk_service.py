from app.repositories.student_repository import StudentRepository
from app.repositories.issue_repository import IssueRepository
from app.repositories.meeting_repository import MeetingRepository
from app.repositories.action_item_repository import ActionItemRepository
from app.models.enums import RiskLevel

class RiskService:
    def __init__(self):
        self.student_repo = StudentRepository()
        self.issue_repo = IssueRepository()
        self.meeting_repo = MeetingRepository()
        self.task_repo = ActionItemRepository()

    def calculate_risk_score(self, student_id: str):
        student = self.student_repo.get_by_id(student_id)
        if not student:
            return 0
            
        try:
            cgpa = float(student.get('cgpa') or 0)
        except (TypeError, ValueError):
            cgpa = 0
        try:
            attendance = float(student.get('attendance') or 0)
            attendance_sessions = int(student.get('attendanceSessions') or 0)
        except (TypeError, ValueError):
            attendance = 0
            attendance_sessions = 0
        attendance_recorded = attendance_sessions > 0 or (
            attendance > 0 and student.get('attendanceStatus') != 'NOT_RECORDED'
        )
        
        cgpa_risk = max(0, (7.0 - cgpa) / 7.0 * 100) if cgpa < 7.0 else 0
        attendance_risk = max(0, (75.0 - attendance) / 75.0 * 100) if attendance_recorded and attendance < 75.0 else 0
        
        issues = self.issue_repo.get_by_student(student_id)
        open_issues = len([i for i in issues if i.get('status') == 'OPEN'])
        issue_risk = min(100, open_issues * 20)
        
        meetings = self.meeting_repo.get_by_student(student_id)
        missed_meetings = len([m for m in meetings if m.get('status') == 'MISSED'])
        meeting_risk = min(100, missed_meetings * 25)
        
        tasks = self.task_repo.get_by_student(student_id)
        overdue_tasks = len([t for t in tasks if t.get('status') == 'OVERDUE'])
        task_risk = min(100, overdue_tasks * 15)
        
        total_risk = (cgpa_risk * 0.30) + (attendance_risk * 0.25) + (issue_risk * 0.20) + (meeting_risk * 0.15) + (task_risk * 0.10)
        return total_risk

    def update_risk_for_student(self, student_id: str):
        score = self.calculate_risk_score(student_id)
        try:
            cgpa_recorded = float(student.get('cgpa') or 0) > 0
        except (TypeError, ValueError):
            cgpa_recorded = False
        try:
            attendance_recorded = int(student.get('attendanceSessions') or 0) > 0
        except (TypeError, ValueError):
            attendance_recorded = False
        has_assessment_data = (
            cgpa_recorded or attendance_recorded
            or student.get('attendanceStatus') not in (None, 'NOT_RECORDED')
            or bool(self.issue_repo.get_by_student(student_id))
            or bool(self.meeting_repo.get_by_student(student_id))
            or bool(self.task_repo.get_by_student(student_id))
        )
        level = RiskLevel.LOW.value if has_assessment_data else RiskLevel.NOT_ASSESSED.value
        if score > 70:
            level = RiskLevel.HIGH.value
        elif score > 40:
            level = RiskLevel.MEDIUM.value
            
        self.student_repo.update(student_id, {'riskScore': score, 'riskLevel': level})
        return {'studentId': student_id, 'riskScore': score, 'riskLevel': level}

    def update_all_risks(self):
        students = self.student_repo.collection.stream()
        for doc in students:
            self.update_risk_for_student(doc.id)
        return {"status": "success"}

    def get_high_risk_students(self, department: str = None):
        if department:
            return [student for student in self.student_repo.get_by_department(department)
                    if student.get('riskLevel') == RiskLevel.HIGH.value]
        return self.student_repo.get_high_risk()
