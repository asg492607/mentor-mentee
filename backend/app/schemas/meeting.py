from pydantic import BaseModel
from typing import Optional
from app.models.enums import MeetingType, MeetingStatus


class MeetingCreateRequest(BaseModel):
    mentorId: str
    type: MeetingType
    description: str
    preferredDate: Optional[str] = None


class MeetingResponse(BaseModel):
    id: str
    studentId: str
    mentorId: str
    type: MeetingType
    status: MeetingStatus
    description: str
    scheduledAt: Optional[str] = None
    startedAt: Optional[str] = None
    endedAt: Optional[str] = None
    roomId: Optional[str] = None
    notes: Optional[str] = None
    createdAt: Optional[str] = None


class MeetingNotesRequest(BaseModel):
    problem: str
    advice: str
    tasks: list[str] = []
    summary: str

    @property
    def notes(self) -> str:
        return f"Problem: {self.problem}\nAdvice: {self.advice}\nSummary: {self.summary}"


class MeetingUpdateRequest(BaseModel):
    status: Optional[MeetingStatus] = None
    scheduledAt: Optional[str] = None
    rejectionReason: Optional[str] = None
