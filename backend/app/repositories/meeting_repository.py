from app.repositories.base_repository import BaseRepository
from app.firebase.client import db

class MeetingRepository(BaseRepository):
    def __init__(self):
        super().__init__('meetings')

    def get_by_student(self, student_id: str):
        query = self.collection.where('studentId', '==', student_id).order_by('scheduledAt', direction='DESCENDING')
        return [doc.to_dict() | {'id': doc.id} for doc in query.stream()]

    def get_by_mentor(self, mentor_id: str):
        query = self.collection.where('mentorId', '==', mentor_id).order_by('scheduledAt', direction='DESCENDING')
        return [doc.to_dict() | {'id': doc.id} for doc in query.stream()]

    def get_by_status(self, status: str):
        query = self.collection.where('status', '==', status)
        return [doc.to_dict() | {'id': doc.id} for doc in query.stream()]

    def get_upcoming_for_user(self, user_id: str, role: str):
        field = 'mentorId' if role in ['FACULTY', 'HOD', 'DEAN'] else 'studentId'
        from datetime import datetime
        now = datetime.utcnow().isoformat()
        query = self.collection.where(field, '==', user_id).where('scheduledAt', '>=', now).where('status', '==', 'APPROVED')
        return [doc.to_dict() | {'id': doc.id} for doc in query.stream()]

    def get_by_mentor_and_month(self, mentor_id: str, year: int, month: int):
        start_date = f"{year}-{month:02d}-01T00:00:00Z"
        end_date = f"{year}-{month+1:02d}-01T00:00:00Z" if month < 12 else f"{year+1}-01-01T00:00:00Z"
        query = self.collection.where('mentorId', '==', mentor_id).where('scheduledAt', '>=', start_date).where('scheduledAt', '<', end_date)
        return [doc.to_dict() | {'id': doc.id} for doc in query.stream()]
