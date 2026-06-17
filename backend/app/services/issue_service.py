from app.repositories.issue_repository import IssueRepository
from app.services.notification_service import NotificationService
from app.models.enums import IssueStatus, NotificationType
from app.utils.helpers import get_timestamp
from app.core.exceptions import NotFoundException


class IssueService:
    def __init__(self):
        self.issue_repo = IssueRepository()
        self.notification_service = NotificationService()

    def create_issue(self, student_id: str, student_name: str, mentor_id: str, data):
        # data may be a Pydantic model or a dict
        issue_data = data.model_dump() if hasattr(data, 'model_dump') else (data.dict() if hasattr(data, 'dict') else dict(data))
        issue_data.update({
            'studentId': student_id,
            'studentName': student_name,
            'mentorId': mentor_id,
            'status': IssueStatus.OPEN.value,
            'escalationLevel': 'MENTOR',
            'escalationHistory': [],
            'createdAt': get_timestamp(),
            'updatedAt': get_timestamp()
        })
        issue_id = self.issue_repo.create(issue_data)

        if mentor_id:
            self.notification_service.create_notification(
                user_id=mentor_id,
                notif_type=NotificationType.ISSUE_RAISED.value,
                title="New Issue Raised",
                message=f"{student_name} has raised an issue: {issue_data.get('title', '')}",
                related_id=issue_id
            )
        return self.issue_repo.get_by_id(issue_id)

    def update_issue(self, issue_id: str, data):
        # data may be a Pydantic model or plain dict
        if hasattr(data, 'model_dump'):
            update_data = data.model_dump(exclude_unset=True)
        elif hasattr(data, 'dict'):
            update_data = data.dict(exclude_unset=True)
        elif isinstance(data, dict):
            update_data = data
        else:
            update_data = {}
        update_data['updatedAt'] = get_timestamp()
        self.issue_repo.update(issue_id, update_data)
        return self.issue_repo.get_by_id(issue_id)

    def resolve_issue(self, issue_id: str, resolution: str):
        self.issue_repo.update(issue_id, {
            'status': IssueStatus.RESOLVED.value,
            'resolution': resolution,
            'updatedAt': get_timestamp()
        })
        issue = self.issue_repo.get_by_id(issue_id)
        if issue and issue.get('studentId'):
            self.notification_service.create_notification(
                user_id=issue['studentId'],
                notif_type=NotificationType.ISSUE_RESOLVED.value,
                title="Issue Resolved",
                message=f"Your issue '{issue.get('title')}' has been resolved.",
                related_id=issue_id
            )
        return issue

    def escalate_issue(self, issue_id: str, escalated_by: str, reason: str, target_level):
        issue = self.issue_repo.get_by_id(issue_id)
        if not issue:
            raise NotFoundException("Issue not found")

        # target_level may be an enum or string
        level_value = target_level.value if hasattr(target_level, 'value') else str(target_level)

        history = issue.get('escalationHistory', [])
        history.append({
            'escalatedBy': escalated_by,
            'reason': reason,
            'fromLevel': issue.get('escalationLevel'),
            'toLevel': level_value,
            'timestamp': get_timestamp()
        })

        self.issue_repo.update(issue_id, {
            'escalationLevel': level_value,
            'status': IssueStatus.ESCALATED.value,
            'escalationHistory': history,
            'updatedAt': get_timestamp()
        })
        return self.issue_repo.get_by_id(issue_id)

    def get_issues_for_user(self, user_id: str, role: str) -> list[dict]:
        if role in ['FACULTY', 'HOD', 'DEAN']:
            return self.issue_repo.get_by_mentor(user_id)
        return self.issue_repo.get_by_student(user_id)
