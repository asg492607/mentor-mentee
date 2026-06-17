from pydantic import BaseModel
from typing import Optional
from app.models.enums import RiskLevel

class MentorProfileResponse(BaseModel):
    id: str
    name: str
    email: str
    department: str
    designation: Optional[str] = None
    maxStudents: int = 20
    assignedStudentCount: int = 0

class MentorDashboardResponse(BaseModel):
    profile: MentorProfileResponse
    totalStudents: int = 0
    meetingsThisMonth: int = 0
    pendingMeetings: int = 0
    highRiskStudents: int = 0
    recentMeetings: list = []
    pendingIssues: int = 0

class AssignedStudentResponse(BaseModel):
    id: str
    name: str
    rollNumber: str
    year: int
    cgpa: Optional[float] = None
    attendance: Optional[float] = None
    riskLevel: RiskLevel = RiskLevel.LOW
    lastMeetingDate: Optional[str] = None
