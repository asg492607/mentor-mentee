from app.repositories.base_repository import BaseRepository


class MeetingRepository(BaseRepository):
    def __init__(self):
        super().__init__('meetings')

    def get_by_student(self, student_id: str) -> list[dict]:
        return self.query(filters=[('studentId', '==', student_id)], order_by='createdAt', direction='DESCENDING')

    def get_by_mentor(self, mentor_id: str) -> list[dict]:
        return self.query(filters=[('mentorId', '==', mentor_id)], order_by='createdAt', direction='DESCENDING')

    def get_by_status(self, status: str) -> list[dict]:
        return self.query(filters=[('status', '==', status)])

    def get_upcoming_for_user(self, user_id: str, role: str) -> list[dict]:
        from datetime import datetime, timezone
        now = datetime.now(timezone.utc).isoformat()
        field = 'mentorId' if role in ['FACULTY', 'HOD', 'DEAN'] else 'studentId'
        # Firestore doesn't allow inequality + equality on different fields without composite index,
        # so filter status in-memory after fetching approved meetings.
        results = self.query(filters=[(field, '==', user_id), ('status', '==', 'APPROVED')])
        return [r for r in results if r.get('scheduledAt', '') >= now]

    def get_by_mentor_and_month(self, mentor_id: str, year: int, month: int) -> list[dict]:
        start_date = f"{year}-{month:02d}-01T00:00:00Z"
        end_date = f"{year}-{month + 1:02d}-01T00:00:00Z" if month < 12 else f"{year + 1}-01-01T00:00:00Z"
        results = self.query(filters=[('mentorId', '==', mentor_id)])
        return [
            r for r in results
            if start_date <= r.get('scheduledAt', '') < end_date
        ]
