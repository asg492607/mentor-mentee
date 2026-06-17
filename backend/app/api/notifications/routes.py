from fastapi import APIRouter, Depends
from app.core.dependencies import get_current_user
from app.services.notification_service import NotificationService

router = APIRouter(prefix="/notifications", tags=["Notifications"])

@router.get("/")
def get_notifications(unread_only: bool = False, user = Depends(get_current_user), notif_service: NotificationService = Depends()):
    return notif_service.get_notifications(user['uid'], unread_only)

@router.put("/{notification_id}/read")
def mark_read(notification_id: str, user = Depends(get_current_user), notif_service: NotificationService = Depends()):
    notif_service.mark_read(notification_id)
    return {"message": "Notification marked as read"}

@router.put("/read-all")
def mark_all_read(user = Depends(get_current_user), notif_service: NotificationService = Depends()):
    notif_service.mark_all_read(user['uid'])
    return {"message": "All notifications marked as read"}
