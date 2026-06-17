from app.repositories.base_repository import BaseRepository
from app.firebase.client import db

class FacultyRepository(BaseRepository):
    def __init__(self):
        super().__init__('faculty')

    def get_by_department(self, dept: str):
        query = self.collection.where('department', '==', dept)
        return [doc.to_dict() | {'id': doc.id} for doc in query.stream()]

    def get_available(self, dept: str):
        query = self.collection.where('department', '==', dept)
        results = []
        for doc in query.stream():
            data = doc.to_dict()
            if data.get('assignedStudentCount', 0) < data.get('maxStudents', 20):
                results.append(data | {'id': doc.id})
        return results
