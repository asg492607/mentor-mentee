from pydantic import BaseModel
from typing import Optional
from datetime import datetime
from app.models.enums import MeetingType, MeetingStatus

class MeetingCreateRequest(BaseModel):
    mentorId: str
    type: MeetingType
    description: str
    preferredDate: Optional[str] = None

class MeetingResponse(BaseModel):
    id: str
    studentId: str
    studentName: str
    mentorId: str
    mentorName: str
    type: MeetingType
    status: MeetingStatus
    description: str
    scheduledAt: Optional[datetime] = None
    startedAt: Optional[datetime] = None
    endedAt: Optional[datetime] = None
    roomId: Optional[str] = None
    notes: Optional[str] = None
    actionItems: list[str] = []
    createdAt: datetime

class MeetingNotesRequest(BaseModel):
    problem: str
    advice: str
    tasks: list[str] = []
    summary: str

class MeetingUpdateRequest(BaseModel):
    status: Optional[MeetingStatus] = None
    scheduledAt: Optional[str] = None
