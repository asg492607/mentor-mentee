from app.repositories.base_repository import BaseRepository
from datetime import datetime, timezone


class ActionItemRepository(BaseRepository):
    def __init__(self):
        super().__init__('action_items')

    def get_by_student(self, student_id: str) -> list[dict]:
        return self.query(filters=[('studentId', '==', student_id)])

    def get_by_mentor(self, mentor_id: str) -> list[dict]:
        return self.query(filters=[('mentorId', '==', mentor_id)])

    def get_overdue(self) -> list[dict]:
        now = datetime.now(timezone.utc).isoformat()
        # Fetch non-completed tasks and filter dueDate in-memory to avoid composite index requirement
        results = self.query(filters=[('status', '!=', 'COMPLETED')])
        return [r for r in results if r.get('dueDate') and r['dueDate'] < now]

    def get_by_meeting(self, meeting_id: str) -> list[dict]:
        return self.query(filters=[('meetingId', '==', meeting_id)])
