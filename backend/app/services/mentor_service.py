from app.repositories.faculty_repository import FacultyRepository
from app.repositories.student_repository import StudentRepository
from app.repositories.meeting_repository import MeetingRepository
from app.repositories.issue_repository import IssueRepository
from app.repositories.action_item_repository import ActionItemRepository
from app.core.exceptions import NotFoundException

class MentorService:
    def __init__(self):
        self.faculty_repo = FacultyRepository()
        self.student_repo = StudentRepository()
        self.meeting_repo = MeetingRepository()
        self.issue_repo = IssueRepository()
        self.task_repo = ActionItemRepository()

    def get_dashboard(self, mentor_id: str):
        profile = self.faculty_repo.get_by_id(mentor_id)
        students = self.student_repo.get_by_mentor(mentor_id)
        meetings = self.meeting_repo.get_by_mentor(mentor_id)
        tasks = self.task_repo.get_by_mentor(mentor_id)
        issues = self.issue_repo.get_by_mentor(mentor_id)
        
        return {
            "profile": profile,
            "assigned_students": students,
            "meetings": meetings,
            "tasks": tasks,
            "issues": issues
        }

    def get_assigned_students(self, mentor_id: str):
        return self.student_repo.get_by_mentor(mentor_id)

    def get_student_detail(self, mentor_id: str, student_id: str):
        student = self.student_repo.get_by_id(student_id)
        if not student or student.get('mentorId') != mentor_id:
            raise NotFoundException("Assigned student not found")
        
        meetings = self.meeting_repo.get_by_student(student_id)
        tasks = self.task_repo.get_by_student(student_id)
        issues = self.issue_repo.get_by_student(student_id)
        
        return {
            "student": student,
            "meetings": meetings,
            "tasks": tasks,
            "issues": issues
        }
