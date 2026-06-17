from app.repositories.student_repository import StudentRepository
from app.repositories.faculty_repository import FacultyRepository
from app.repositories.meeting_repository import MeetingRepository
from app.repositories.issue_repository import IssueRepository
from app.repositories.action_item_repository import ActionItemRepository
from app.core.exceptions import NotFoundException

class StudentService:
    def __init__(self):
        self.student_repo = StudentRepository()
        self.faculty_repo = FacultyRepository()
        self.meeting_repo = MeetingRepository()
        self.issue_repo = IssueRepository()
        self.task_repo = ActionItemRepository()

    def get_profile(self, student_id: str):
        profile = self.student_repo.get_by_id(student_id)
        if not profile:
            raise NotFoundException("Student not found")
        return profile

    def update_profile(self, student_id: str, data):
        self.student_repo.update(student_id, data.dict(exclude_unset=True))
        return self.get_profile(student_id)

    def get_mentor(self, student_id: str):
        profile = self.get_profile(student_id)
        mentor_id = profile.get('mentorId')
        if mentor_id:
            return self.faculty_repo.get_by_id(mentor_id)
        return None

    def get_dashboard(self, student_id: str):
        profile = self.get_profile(student_id)
        mentor = self.get_mentor(student_id)
        meetings = self.meeting_repo.get_by_student(student_id)
        tasks = self.task_repo.get_by_student(student_id)
        issues = self.issue_repo.get_by_student(student_id)
        
        return {
            "profile": profile,
            "mentor": mentor,
            "meetings": meetings,
            "tasks": tasks,
            "issues": issues
        }
