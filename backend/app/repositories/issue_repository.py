from app.repositories.base_repository import BaseRepository


class IssueRepository(BaseRepository):
    def __init__(self):
        super().__init__('issues')

    def get_by_student(self, student_id: str) -> list[dict]:
        return self.query(filters=[('studentId', '==', student_id)])

    def get_by_mentor(self, mentor_id: str) -> list[dict]:
        return self.query(filters=[('mentorId', '==', mentor_id)])

    def get_by_status(self, status: str) -> list[dict]:
        return self.query(filters=[('status', '==', status)])

    def get_escalated(self, level: str) -> list[dict]:
        return self.query(filters=[('escalationLevel', '==', level)])

    def get_by_department(self, dept: str) -> list[dict]:
        return self.query(filters=[('department', '==', dept)])
