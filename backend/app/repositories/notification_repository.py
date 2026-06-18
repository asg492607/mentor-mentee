from app.repositories.base_repository import BaseRepository


class NotificationRepository(BaseRepository):
    def __init__(self):
        super().__init__('notifications')

    def get_by_user(self, user_id: str, unread_only: bool = False):
        query = self.collection_ref.where('userId', '==', user_id)
        if unread_only:
            query = query.where('isRead', '==', False)
        return [doc.to_dict() | {'id': doc.id} for doc in query.stream()]

    def mark_as_read(self, notification_id: str):
        self.update(notification_id, {'isRead': True})

    def mark_all_read(self, user_id: str):
        from app.firebase.client import db
        query = self.collection_ref.where('userId', '==', user_id).where('isRead', '==', False)
        batch = db.batch()
        for doc in query.stream():
            batch.update(doc.reference, {'isRead': True})
        batch.commit()
