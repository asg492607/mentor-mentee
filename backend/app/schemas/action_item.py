from pydantic import BaseModel
from typing import Optional
from datetime import datetime
from app.models.enums import ActionItemStatus, ActionItemCategory

class ActionItemCreateRequest(BaseModel):
    description: str
    category: ActionItemCategory
    deadline: datetime
    studentId: str
    meetingId: Optional[str] = None

class ActionItemResponse(BaseModel):
    id: str
    meetingId: Optional[str] = None
    studentId: str
    studentName: str
    mentorId: str
    mentorName: str
    description: str
    category: ActionItemCategory
    deadline: datetime
    status: ActionItemStatus
    completionPercentage: int = 0
    createdAt: datetime
    updatedAt: datetime

class ActionItemUpdateRequest(BaseModel):
    status: Optional[ActionItemStatus] = None
    completionPercentage: Optional[int] = None
