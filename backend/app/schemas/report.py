from pydantic import BaseModel

class DashboardStats(BaseModel):
    totalStudents: int
    totalMeetings: int
    totalIssues: int
    resolvedIssues: int
    highRiskStudents: int
    activeMentors: int

class MentorReportResponse(BaseModel):
    mentorName: str
    studentsAssigned: int
    meetingsConducted: int
    pendingStudents: int
    highRiskStudents: int
    issuesResolved: int

class DepartmentReportResponse(BaseModel):
    department: str
    totalStudents: int
    totalMentors: int
    meetingsThisMonth: int
    openIssues: int
    highRiskCount: int
    averageCgpa: float
