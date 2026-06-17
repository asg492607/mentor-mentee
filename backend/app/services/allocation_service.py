from app.repositories.student_repository import StudentRepository
from app.repositories.faculty_repository import FacultyRepository
from app.services.notification_service import NotificationService
from app.models.enums import NotificationType
from app.core.exceptions import BadRequestException

class AllocationService:
    def __init__(self):
        self.student_repo = StudentRepository()
        self.faculty_repo = FacultyRepository()
        self.notification_service = NotificationService()

    def manual_allocate(self, student_id: str, mentor_id: str):
        student = self.student_repo.get_by_id(student_id)
        mentor = self.faculty_repo.get_by_id(mentor_id)
        
        if not student or not mentor:
            raise BadRequestException("Invalid student or mentor ID")
            
        self.student_repo.update(student_id, {'mentorId': mentor_id})
        
        current_count = mentor.get('assignedStudentCount', 0)
        self.faculty_repo.update(mentor_id, {'assignedStudentCount': current_count + 1})
        
        self.notification_service.create_notification(
            user_id=student_id,
            notif_type=NotificationType.SYSTEM_ALERT.value,
            title="Mentor Assigned",
            message=f"You have been assigned to mentor {mentor.get('name')}.",
            related_id=mentor_id
        )
        self.notification_service.create_notification(
            user_id=mentor_id,
            notif_type=NotificationType.SYSTEM_ALERT.value,
            title="Student Assigned",
            message=f"Student {student.get('name')} has been assigned to you.",
            related_id=student_id
        )
        return {"status": "success", "studentId": student_id, "mentorId": mentor_id}

    def bulk_allocate(self, allocations: list):
        results = []
        for alloc in allocations:
            try:
                res = self.manual_allocate(alloc.student_id, alloc.mentor_id)
                results.append(res)
            except Exception as e:
                results.append({"status": "failed", "studentId": alloc.student_id, "error": str(e)})
        return results

    def auto_allocate(self, department: str):
        unassigned_students = self.student_repo.get_unassigned(department)
        available_mentors = self.faculty_repo.get_available(department)
        
        if not available_mentors:
            raise BadRequestException("No available mentors in department")
            
        results = []
        mentor_idx = 0
        for student in unassigned_students:
            mentor = available_mentors[mentor_idx]
            if mentor.get('assignedStudentCount', 0) >= mentor.get('maxStudents', 20):
                continue
            
            res = self.manual_allocate(student['id'], mentor['id'])
            results.append(res)
            
            mentor_idx = (mentor_idx + 1) % len(available_mentors)
            
        return {"status": "success", "allocated": len(results)}

    def deallocate(self, student_id: str):
        student = self.student_repo.get_by_id(student_id)
        if not student or not student.get('mentorId'):
            raise BadRequestException("Student not allocated")
            
        mentor_id = student['mentorId']
        mentor = self.faculty_repo.get_by_id(mentor_id)
        
        self.student_repo.update(student_id, {'mentorId': None})
        if mentor:
            current_count = max(0, mentor.get('assignedStudentCount', 1) - 1)
            self.faculty_repo.update(mentor_id, {'assignedStudentCount': current_count})
            
        return {"status": "success", "message": "Deallocated successfully"}
