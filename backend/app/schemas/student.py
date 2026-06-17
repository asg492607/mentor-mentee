from pydantic import BaseModel
from typing import Optional
from datetime import datetime
from app.models.enums import RiskLevel

class StudentProfileCreate(BaseModel):
    name: str
    department: str
    year: int
    rollNumber: str
    cgpa: Optional[float] = None
    interests: list[str] = []
    skills: list[str] = []
    careerGoal: Optional[str] = None
    academicStatus: Optional[str] = None

class StudentProfileResponse(BaseModel):
    id: str
    name: str
    email: str
    department: str
    year: int
    rollNumber: str
    cgpa: Optional[float] = None
    attendance: Optional[float] = None
    interests: list[str] = []
    skills: list[str] = []
    careerGoal: Optional[str] = None
    academicStatus: Optional[str] = None
    mentorId: Optional[str] = None
    mentorName: Optional[str] = None
    riskScore: float = 0.0
    riskLevel: RiskLevel = RiskLevel.LOW
    createdAt: datetime

class StudentProfileUpdate(BaseModel):
    name: Optional[str] = None
    department: Optional[str] = None
    year: Optional[int] = None
    rollNumber: Optional[str] = None
    cgpa: Optional[float] = None
    attendance: Optional[float] = None
    interests: Optional[list[str]] = None
    skills: Optional[list[str]] = None
    careerGoal: Optional[str] = None
    academicStatus: Optional[str] = None

class StudentDashboardResponse(BaseModel):
    profile: StudentProfileResponse
    mentor: Optional[dict] = None
    upcomingMeetings: list = []
    pendingTasks: int = 0
    openIssues: int = 0
    recentMeetings: list = []
