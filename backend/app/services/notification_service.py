from app.repositories.notification_repository import NotificationRepository
from app.utils.helpers import get_timestamp

class NotificationService:
    def __init__(self):
        self.notification_repo = NotificationRepository()

    def create_notification(self, user_id: str, notif_type: str, title: str, message: str, related_id: str = None):
        notif_data = {
            'userId': user_id,
            'type': notif_type,
            'title': title,
            'message': message,
            'relatedId': related_id,
            'isRead': False,
            'createdAt': get_timestamp()
        }
        return self.notification_repo.create(notif_data)

    def get_notifications(self, user_id: str, unread_only: bool = False):
        return self.notification_repo.get_by_user(user_id, unread_only)

    def mark_read(self, id: str):
        self.notification_repo.mark_as_read(id)

    def mark_all_read(self, user_id: str):
        self.notification_repo.mark_all_read(user_id)
