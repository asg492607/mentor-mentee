from pydantic import BaseModel
from typing import Optional
from datetime import datetime
from app.models.enums import NotificationType

class NotificationCreateRequest(BaseModel):
    userId: str
    type: NotificationType
    title: str
    message: str
    relatedId: Optional[str] = None

class NotificationResponse(BaseModel):
    id: str
    userId: str
    type: NotificationType
    title: str
    message: str
    read: bool = False
    relatedId: Optional[str] = None
    createdAt: datetime
