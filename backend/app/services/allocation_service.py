from app.repositories.student_repository import StudentRepository
from app.repositories.faculty_repository import FacultyRepository
from app.repositories.department_repository import DepartmentRepository
from app.services.notification_service import NotificationService
from app.models.enums import NotificationType
from app.core.exceptions import BadRequestException
from app.services.institution_service import same_department

class AllocationService:
    def __init__(self):
        self.student_repo = StudentRepository()
        self.faculty_repo = FacultyRepository()
        self.department_repo = DepartmentRepository()
        self.notification_service = NotificationService()

    @staticmethod
    def _eligible_mentor(mentor: dict) -> bool:
        role = str(mentor.get('role', '')).upper()
        status = str(mentor.get('status') or 'approved').lower()
        return (role in {'FACULTY', 'MENTOR', 'HOD'}
                and status in {'approved', 'active'}
                and mentor.get('isApproved', True) is not False)

    def manual_allocate(self, student_id: str, mentor_id: str, department_records: list[dict] = None):
        student = self.student_repo.get_by_id(student_id)
        mentor = self.faculty_repo.get_by_id(mentor_id)
        
        if not student or not mentor:
            raise BadRequestException("Invalid student or mentor ID")
            
        if not same_department(student, mentor, department_records):
            raise BadRequestException("A student can only be assigned to a mentor from the same department and school")
        if not self._eligible_mentor(mentor):
            raise BadRequestException("Selected user is not eligible to mentor students")
        if student.get('secondaryMentorId') == mentor_id:
            raise BadRequestException("Primary and secondary mentors must be different")

        previous_mentor_id = student.get('mentorId')
        if previous_mentor_id != mentor_id and int(mentor.get('assignedStudentCount') or 0) >= int(mentor.get('maxStudents') or 20):
            raise BadRequestException("Selected mentor has reached student capacity")
        mentor_ids = [mentor_id]
        if student.get('secondaryMentorId') and student.get('secondaryMentorId') not in mentor_ids:
            mentor_ids.append(student.get('secondaryMentorId'))
        self.student_repo.update(student_id, {
            'mentorId': mentor_id,
            'mentorIds': mentor_ids,
        })
        
        if previous_mentor_id != mentor_id:
            current_count = int(mentor.get('assignedStudentCount') or 0)
            self.faculty_repo.update(mentor_id, {'assignedStudentCount': current_count + 1})
            if previous_mentor_id:
                previous_mentor = self.faculty_repo.get_by_id(previous_mentor_id)
                if previous_mentor:
                    previous_count = max(0, int(previous_mentor.get('assignedStudentCount') or 1) - 1)
                    self.faculty_repo.update(previous_mentor_id, {'assignedStudentCount': previous_count})
        
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

    def allocate_student(self, student_id: str):
        student = self.student_repo.get_by_id(student_id)
        if not student:
            raise BadRequestException("Student not found")
        if student.get('mentorId'):
            return None
        departments = self.department_repo.get_all()
        mentors = [mentor for mentor in self.faculty_repo.get_all()
                   if self._eligible_mentor(mentor)
                   and same_department(student, mentor, departments)
                   and int(mentor.get('assignedStudentCount') or 0) < int(mentor.get('maxStudents') or 20)]
        mentors.sort(key=lambda mentor: int(mentor.get('assignedStudentCount') or 0))
        if not mentors:
            return None
        return self.manual_allocate(student_id, mentors[0]['id'], departments)

    def auto_allocate(self, department: str = None):
        students = [student for student in self.student_repo.get_all() if not student.get('mentorId')]
        if department:
            if department.startswith('id:'):
                department_id = department[3:]
                students = [student for student in students if student.get('departmentId') == department_id]
            elif department.startswith('legacy:'):
                department_name, _, school_id = department[7:].partition('|')
                students = [student for student in students
                            if student.get('department') == department_name
                            and (not school_id or student.get('schoolId') == school_id)]
            else:
                students = [student for student in students if department in {
                    student.get('departmentId'), student.get('department')
                }]
        mentors = [mentor for mentor in self.faculty_repo.get_all()
                   if self._eligible_mentor(mentor)]
        departments = self.department_repo.get_all()

        results = []
        for student in students:
            matching = [mentor for mentor in mentors if same_department(student, mentor, departments)]
            matching.sort(key=lambda mentor: int(mentor.get('assignedStudentCount') or 0))
            mentor = next((item for item in matching
                           if int(item.get('assignedStudentCount') or 0) < int(item.get('maxStudents') or 20)), None)
            if not mentor:
                continue
            result = self.manual_allocate(student['id'], mentor['id'], departments)
            results.append(result)
            mentor['assignedStudentCount'] = int(mentor.get('assignedStudentCount') or 0) + 1

        return {
            "status": "success",
            "allocated": len(results),
            "unassigned": len(students) - len(results),
        }

    def deallocate(self, student_id: str):
        student = self.student_repo.get_by_id(student_id)
        if not student or not student.get('mentorId'):
            raise BadRequestException("Student not allocated")
            
        mentor_id = student['mentorId']
        mentor = self.faculty_repo.get_by_id(mentor_id)
        
        self.student_repo.update(student_id, {'mentorId': None})
        if mentor:
            current_count = max(0, int(mentor.get('assignedStudentCount') or 1) - 1)
            self.faculty_repo.update(mentor_id, {'assignedStudentCount': current_count})
            
        return {"status": "success", "message": "Deallocated successfully"}
