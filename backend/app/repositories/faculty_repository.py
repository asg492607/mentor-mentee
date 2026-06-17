from app.repositories.base_repository import BaseRepository


class FacultyRepository(BaseRepository):
    def __init__(self):
        super().__init__('faculty')

    def get_by_department(self, dept: str) -> list[dict]:
        return self.query(filters=[('department', '==', dept)])

    def get_available(self, dept: str) -> list[dict]:
        mentors = self.get_by_department(dept)
        return [
            m for m in mentors
            if m.get('assignedStudentCount', 0) < m.get('maxStudents', 20)
        ]
