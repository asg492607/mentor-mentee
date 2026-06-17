from app.repositories.base_repository import BaseRepository
from app.firebase.client import db

class IssueRepository(BaseRepository):
    def __init__(self):
        super().__init__('issues')

    def get_by_student(self, student_id: str):
        query = self.collection.where('studentId', '==', student_id)
        return [doc.to_dict() | {'id': doc.id} for doc in query.stream()]

    def get_by_mentor(self, mentor_id: str):
        query = self.collection.where('mentorId', '==', mentor_id)
        return [doc.to_dict() | {'id': doc.id} for doc in query.stream()]

    def get_by_status(self, status: str):
        query = self.collection.where('status', '==', status)
        return [doc.to_dict() | {'id': doc.id} for doc in query.stream()]

    def get_escalated(self, level: str):
        query = self.collection.where('escalationLevel', '==', level)
        return [doc.to_dict() | {'id': doc.id} for doc in query.stream()]

    def get_by_department(self, dept: str):
        query = self.collection.where('department', '==', dept)
        return [doc.to_dict() | {'id': doc.id} for doc in query.stream()]
