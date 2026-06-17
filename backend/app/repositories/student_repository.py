from app.repositories.base_repository import BaseRepository
from app.firebase.client import db

class StudentRepository(BaseRepository):
    def __init__(self):
        super().__init__('students')

    def get_by_mentor(self, mentor_id: str):
        query = self.collection.where('mentorId', '==', mentor_id)
        return [doc.to_dict() | {'id': doc.id} for doc in query.stream()]

    def get_by_department(self, dept: str):
        query = self.collection.where('department', '==', dept)
        return [doc.to_dict() | {'id': doc.id} for doc in query.stream()]

    def get_high_risk(self):
        query = self.collection.where('riskLevel', '==', 'HIGH')
        return [doc.to_dict() | {'id': doc.id} for doc in query.stream()]

    def get_by_department_and_year(self, dept: str, year: int):
        query = self.collection.where('department', '==', dept).where('year', '==', year)
        return [doc.to_dict() | {'id': doc.id} for doc in query.stream()]

    def get_unassigned(self, department: str = None):
        query = self.collection.where('mentorId', '==', None)
        if department:
            query = query.where('department', '==', department)
        return [doc.to_dict() | {'id': doc.id} for doc in query.stream()]
