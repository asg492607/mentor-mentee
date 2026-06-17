from app.repositories.base_repository import BaseRepository
from app.firebase.client import db

class NotificationRepository(BaseRepository):
    def __init__(self):
        super().__init__('notifications')

    def get_by_user(self, user_id: str, unread_only: bool = False):
        query = self.collection.where('userId', '==', user_id)
        if unread_only:
            query = query.where('isRead', '==', False)
        return [doc.to_dict() | {'id': doc.id} for doc in query.stream()]

    def mark_as_read(self, notification_id: str):
        self.collection.document(notification_id).update({'isRead': True})

    def mark_all_read(self, user_id: str):
        query = self.collection.where('userId', '==', user_id).where('isRead', '==', False)
        batch = db.batch()
        for doc in query.stream():
            batch.update(doc.reference, {'isRead': True})
        batch.commit()
