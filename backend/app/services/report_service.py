from app.repositories.student_repository import StudentRepository
from app.repositories.faculty_repository import FacultyRepository
from app.repositories.issue_repository import IssueRepository
from app.repositories.meeting_repository import MeetingRepository
from collections import Counter


class ReportService:
    def __init__(self):
        self.student_repo = StudentRepository()
        self.faculty_repo = FacultyRepository()
        self.issue_repo = IssueRepository()
        self.meeting_repo = MeetingRepository()

    def _aggregate_ai_insights(self, meetings: list) -> dict:
        """
        Aggregate AI-generated notes from completed meetings into cohort intelligence.
        Returns a structured aiInsights block for the mentor reports page.
        """
        meetings_with_ai = [m for m in meetings if m.get('hasAiNotes') and m.get('aiNotes')]

        if not meetings_with_ai:
            return {
                "analyzed": 0,
                "total": len(meetings),
                "coveragePercent": 0,
                "recurringIssues": [],
                "riskBreakdown": {"HIGH": 0, "MEDIUM": 0, "LOW": 0},
                "riskStudents": [],
                "escalationRequired": [],
                "topActionCategories": [],
                "recentInsights": []
            }

        # Risk breakdown
        risk_breakdown = Counter()
        risk_students = []
        escalation_required = []

        # Issue text aggregation
        all_issues_text = []

        # Recent insights (last 5 meetings with AI notes)
        recent_insights = []

        for m in meetings_with_ai:
            ai = m.get('aiNotes', {})
            risk_level = ai.get('riskLevel', 'LOW')
            risk_breakdown[risk_level] += 1

            if risk_level in ('HIGH', 'MEDIUM'):
                risk_students.append({
                    "studentId": m.get('studentId'),
                    "meetingId": m.get('id'),
                    "riskLevel": risk_level,
                    "signals": ai.get('riskSignals', []),
                    "meetingDate": m.get('scheduledAt') or m.get('createdAt')
                })

            if ai.get('requiresEscalation'):
                escalation_required.append({
                    "studentId": m.get('studentId'),
                    "meetingId": m.get('id'),
                    "generatedAt": ai.get('generatedAt')
                })

            if ai.get('issuesDiscussed'):
                all_issues_text.append(ai['issuesDiscussed'])

        # Extract recurring issue keywords (simple frequency analysis)
        issue_words = []
        for text in all_issues_text:
            words = [w.strip('•-*[]().,').lower() for w in text.split() if len(w) > 5]
            issue_words.extend(words)

        stop_words = {'student', 'mentor', 'session', 'meeting', 'discussed', 'review',
                      'academic', 'regarding', 'following', 'during', 'noted', 'raised'}
        filtered = [w for w in issue_words if w not in stop_words]
        top_issues = [word for word, _ in Counter(filtered).most_common(8)]

        # Recent insights — last 5 meetings sorted by date
        sorted_meetings = sorted(
            meetings_with_ai,
            key=lambda m: m.get('aiNotes', {}).get('generatedAt') or m.get('updatedAt') or '',
            reverse=True
        )
        for m in sorted_meetings[:5]:
            ai = m.get('aiNotes', {})
            recent_insights.append({
                "meetingId": m.get('id'),
                "studentId": m.get('studentId'),
                "topic": ai.get('topic', ''),
                "riskLevel": ai.get('riskLevel', 'LOW'),
                "issuesSummary": (ai.get('issuesDiscussed') or '')[:200],
                "actionCount": len((ai.get('actionItems') or '').split('\n')),
                "taskCount": len(ai.get('tasks') or []),
                "transcriptSource": ai.get('transcriptSource', 'live-only'),
                "generatedAt": ai.get('generatedAt', '')
            })

        total = len(meetings)
        analyzed = len(meetings_with_ai)
        coverage = round((analyzed / total * 100) if total > 0 else 0, 1)

        return {
            "analyzed": analyzed,
            "total": total,
            "coveragePercent": coverage,
            "recurringIssues": top_issues,
            "riskBreakdown": {
                "HIGH": risk_breakdown.get('HIGH', 0),
                "MEDIUM": risk_breakdown.get('MEDIUM', 0),
                "LOW": risk_breakdown.get('LOW', 0)
            },
            "riskStudents": risk_students,
            "escalationRequired": escalation_required,
            "recentInsights": recent_insights
        }

    def get_mentor_report(self, mentor_id: str) -> dict:
        students = self.student_repo.get_by_mentor(mentor_id)
        issues = self.issue_repo.get_by_mentor(mentor_id)
        meetings = self.meeting_repo.get_by_mentor(mentor_id)
        completed_meetings = [m for m in meetings if m.get('status') == 'COMPLETED']

        # Aggregate AI insights from completed meetings
        ai_insights = self._aggregate_ai_insights(completed_meetings)

        return {
            "totalStudents": len(students),
            "highRiskStudents": len([s for s in students if s.get('riskLevel') == 'HIGH']),
            "openIssues": len([i for i in issues if i.get('status') == 'OPEN']),
            "completedMeetings": len(completed_meetings),
            "pendingMeetings": len([m for m in meetings if m.get('status') == 'REQUESTED']),
            "aiInsights": ai_insights
        }

    def get_department_report(self, department: str) -> dict:
        students = self.student_repo.get_by_department(department)
        mentors = self.faculty_repo.get_by_department(department)
        issues = self.issue_repo.get_by_department(department)

        return {
            "department": department,
            "totalStudents": len(students),
            "totalMentors": len(mentors),
            "highRiskStudents": len([s for s in students if s.get('riskLevel') == 'HIGH']),
            "openIssues": len([i for i in issues if i.get('status') == 'OPEN']),
            "resolvedIssues": len([i for i in issues if i.get('status') == 'RESOLVED']),
        }

    def get_institution_report(self) -> dict:
        all_students = self.student_repo.get_all()
        all_mentors = self.faculty_repo.get_all()
        all_issues = self.issue_repo.get_all()
        all_meetings = self.meeting_repo.get_all()

        return {
            "totalStudents": len(all_students),
            "totalMentors": len(all_mentors),
            "highRiskStudents": len([s for s in all_students if s.get('riskLevel') == 'HIGH']),
            "openIssues": len([i for i in all_issues if i.get('status') == 'OPEN']),
            "completedMeetings": len([m for m in all_meetings if m.get('status') == 'COMPLETED']),
        }

    def get_dashboard_stats(self, role: str, user_id: str, department: str = None) -> dict:
        if role == 'FACULTY':
            return self.get_mentor_report(user_id)
        elif role == 'HOD':
            return self.get_department_report(department or '')
        elif role == 'DEAN':
            return self.get_institution_report()
        return {}
