from app.repositories.student_repository import StudentRepository
from app.repositories.faculty_repository import FacultyRepository
from app.repositories.issue_repository import IssueRepository
from app.repositories.meeting_repository import MeetingRepository

class ReportService:
    def __init__(self):
        self.student_repo = StudentRepository()
        self.faculty_repo = FacultyRepository()
        self.issue_repo = IssueRepository()
        self.meeting_repo = MeetingRepository()

    def get_mentor_report(self, mentor_id: str):
        students = self.student_repo.get_by_mentor(mentor_id)
        issues = self.issue_repo.get_by_mentor(mentor_id)
        meetings = self.meeting_repo.get_by_mentor(mentor_id)
        
        return {
            "totalStudents": len(students),
            "highRiskStudents": len([s for s in students if s.get('riskLevel') == 'HIGH']),
            "openIssues": len([i for i in issues if i.get('status') == 'OPEN']),
            "completedMeetings": len([m for m in meetings if m.get('status') == 'COMPLETED'])
        }

    def get_department_report(self, department: str):
        students = self.student_repo.get_by_department(department)
        mentors = self.faculty_repo.get_by_department(department)
        issues = self.issue_repo.get_by_department(department)
        
        return {
            "department": department,
            "totalStudents": len(students),
            "totalMentors": len(mentors),
            "highRiskStudents": len([s for s in students if s.get('riskLevel') == 'HIGH']),
            "openIssues": len([i for i in issues if i.get('status') == 'OPEN'])
        }

    def get_institution_report(self):
        return {
            "totalStudents": len(list(self.student_repo.collection.stream())),
            "totalMentors": len(list(self.faculty_repo.collection.stream()))
        }

    def get_dashboard_stats(self, role: str, user_id: str, department: str = None):
        if role == 'FACULTY':
            return self.get_mentor_report(user_id)
        elif role == 'HOD':
            return self.get_department_report(department)
        elif role == 'DEAN':
            return self.get_institution_report()
        return {}
