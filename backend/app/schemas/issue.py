from pydantic import BaseModel
from typing import Optional
from datetime import datetime
from app.models.enums import IssueStatus, IssuePriority, EscalationLevel

class IssueCreateRequest(BaseModel):
    title: str
    description: str
    category: str
    priority: IssuePriority

class IssueResponse(BaseModel):
    id: str
    studentId: str
    studentName: str
    mentorId: str
    mentorName: str
    title: str
    description: str
    category: str
    status: IssueStatus
    priority: IssuePriority
    escalationLevel: EscalationLevel
    escalationHistory: list[dict] = []
    resolution: Optional[str] = None
    resolvedAt: Optional[datetime] = None
    createdAt: datetime
    updatedAt: datetime

class IssueEscalateRequest(BaseModel):
    reason: str
    targetLevel: EscalationLevel

class IssueUpdateRequest(BaseModel):
    status: Optional[IssueStatus] = None
    resolution: Optional[str] = None
