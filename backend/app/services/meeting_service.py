from app.repositories.meeting_repository import MeetingRepository
from app.services.notification_service import NotificationService
from app.models.enums import MeetingStatus, NotificationType
from app.utils.helpers import get_timestamp
from app.core.exceptions import NotFoundException, BadRequestException
import uuid

class MeetingService:
    def __init__(self):
        self.meeting_repo = MeetingRepository()
        self.notification_service = NotificationService()

    def request_meeting(self, student_id: str, student_name: str, mentor_id: str, data):
        meeting_data = data.dict()
        meeting_data.update({
            'studentId': student_id,
            'mentorId': mentor_id,
            'status': MeetingStatus.REQUESTED.value,
            'createdAt': get_timestamp()
        })
        meeting_id = self.meeting_repo.create(meeting_data)
        
        self.notification_service.create_notification(
            user_id=mentor_id,
            notif_type=NotificationType.MEETING_SCHEDULED.value,
            title="New Meeting Request",
            message=f"{student_name} has requested a meeting.",
            related_id=meeting_id
        )
        return self.meeting_repo.get_by_id(meeting_id)

    def approve_meeting(self, mentor_id: str, meeting_id: str, scheduled_at: str):
        meeting = self.meeting_repo.get_by_id(meeting_id)
        if not meeting or meeting.get('mentorId') != mentor_id:
            raise NotFoundException("Meeting not found")
            
        self.meeting_repo.update(meeting_id, {
            'status': MeetingStatus.APPROVED.value,
            'scheduledAt': scheduled_at,
            'updatedAt': get_timestamp()
        })
        
        self.notification_service.create_notification(
            user_id=meeting['studentId'],
            notif_type=NotificationType.MEETING_SCHEDULED.value,
            title="Meeting Approved",
            message=f"Your meeting has been approved and scheduled for {scheduled_at}.",
            related_id=meeting_id
        )
        return self.meeting_repo.get_by_id(meeting_id)

    def reject_meeting(self, mentor_id: str, meeting_id: str, reason: str):
        meeting = self.meeting_repo.get_by_id(meeting_id)
        if not meeting or meeting.get('mentorId') != mentor_id:
            raise NotFoundException("Meeting not found")
            
        self.meeting_repo.update(meeting_id, {
            'status': MeetingStatus.REJECTED.value,
            'rejectionReason': reason,
            'updatedAt': get_timestamp()
        })
        
        self.notification_service.create_notification(
            user_id=meeting['studentId'],
            notif_type=NotificationType.SYSTEM_ALERT.value,
            title="Meeting Rejected",
            message=f"Your meeting request was rejected: {reason}",
            related_id=meeting_id
        )
        return self.meeting_repo.get_by_id(meeting_id)

    def start_meeting(self, meeting_id: str):
        room_id = str(uuid.uuid4())
        self.meeting_repo.update(meeting_id, {
            'status': MeetingStatus.ONGOING.value,
            'roomId': room_id,
            'startedAt': get_timestamp()
        })
        return {"roomId": room_id}

    def end_meeting(self, meeting_id: str):
        self.meeting_repo.update(meeting_id, {
            'status': MeetingStatus.COMPLETED.value,
            'endedAt': get_timestamp()
        })
        return self.meeting_repo.get_by_id(meeting_id)

    def add_notes(self, meeting_id: str, notes_data):
        self.meeting_repo.update(meeting_id, {
            'notes': notes_data.notes,
            'updatedAt': get_timestamp()
        })
        return self.meeting_repo.get_by_id(meeting_id)

    def get_meetings_for_user(self, user_id: str, role: str):
        if role in ['FACULTY', 'HOD', 'DEAN']:
            return self.meeting_repo.get_by_mentor(user_id)
        return self.meeting_repo.get_by_student(user_id)
