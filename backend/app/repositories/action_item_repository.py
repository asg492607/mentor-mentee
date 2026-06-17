from app.repositories.base_repository import BaseRepository
from app.firebase.client import db
from datetime import datetime

class ActionItemRepository(BaseRepository):
    def __init__(self):
        super().__init__('action_items')

    def get_by_student(self, student_id: str):
        query = self.collection.where('studentId', '==', student_id)
        return [doc.to_dict() | {'id': doc.id} for doc in query.stream()]

    def get_by_mentor(self, mentor_id: str):
        query = self.collection.where('mentorId', '==', mentor_id)
        return [doc.to_dict() | {'id': doc.id} for doc in query.stream()]

    def get_overdue(self):
        now = datetime.utcnow().isoformat()
        # Note: Firestore query with inequality on dueDate might require an index and limits other inequalities
        # In a real app we might query by status and filter dueDate in memory, but let's do the simplest here.
        query = self.collection.where('status', '!=', 'COMPLETED')
        results = []
        for doc in query.stream():
            data = doc.to_dict()
            if data.get('dueDate') and data['dueDate'] < now:
                results.append(data | {'id': doc.id})
        return results

    def get_by_meeting(self, meeting_id: str):
        query = self.collection.where('meetingId', '==', meeting_id)
        return [doc.to_dict() | {'id': doc.id} for doc in query.stream()]
