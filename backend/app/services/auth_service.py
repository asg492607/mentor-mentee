"""
Credentials verification and session token generation service
"""
from app.firebase.client import firebase_auth, db
from app.models.enums import UserRole
from app.utils.helpers import get_timestamp
from app.core.exceptions import BadRequestException, LuminaException, NotFoundException, ServiceUnavailableException
from app.core.role_claims import claims_for_account

class AuthService:
    def register_user(self, data):
        try:
            if not firebase_auth or not db:
                raise ServiceUnavailableException("Firebase is not configured")
            public_roles = {UserRole.STUDENT, UserRole.FACULTY}
            if data.role not in public_roles:
                raise BadRequestException("Self-registration is limited to students and faculty")
            user = firebase_auth.create_user(
                email=data.email,
                password=data.password,
                display_name=data.name
            )
            firebase_auth.set_custom_user_claims(user.uid, claims_for_account(data.role.value, False))

            profile_data = {
                'id': user.uid,
                'email': data.email,
                'name': data.name,
                'role': data.role.value,
                'department': data.department,
                'createdAt': get_timestamp(),
                'updatedAt': get_timestamp()
            }

            if data.role == UserRole.STUDENT:
                profile_data.update({
                    'year': data.year,
                    'rollNumber': data.rollNumber,
                    'cgpa': 0,
                    'attendance': 0,
                    'riskLevel': 'LOW',
                    'mentorId': None,
                    'status': 'pending',
                    'isApproved': False,
                })
            else:
                profile_data.update({
                    'designation': data.designation,
                    'employeeId': data.employeeId,
                    'status': 'pending',
                    'isApproved': False,
                    'maxStudents': 20,
                    'assignedStudentCount': 0,
                })
            
            collection = 'students' if data.role == UserRole.STUDENT else 'faculty'
            db.collection(collection).document(user.uid).set(profile_data)
            
            return profile_data
        except LuminaException:
            raise
        except Exception as e:
            raise BadRequestException(f"Failed to register user: {str(e)}")

    def get_user_profile(self, uid: str):
        if not db:
            raise ServiceUnavailableException("Firestore is not configured")
        faculty_doc = db.collection('faculty').document(uid).get()
        student_doc = db.collection('students').document(uid).get()
        if faculty_doc.exists:
            faculty = faculty_doc.to_dict() or {}
            if faculty.get('role') != UserRole.STUDENT.value:
                return faculty
        if student_doc.exists:
            return student_doc.to_dict()
        if faculty_doc.exists:
            return faculty_doc.to_dict()
            
        raise NotFoundException("User profile not found")

    def update_user_role(self, uid: str, role: UserRole):
        try:
            if not firebase_auth or not db:
                raise ServiceUnavailableException("Firebase authentication is not configured")
            profile = self.get_user_profile(uid)
            is_student = profile.get('role') == UserRole.STUDENT.value
            if is_student != (role == UserRole.STUDENT):
                raise BadRequestException("Student and staff accounts cannot change account type")
            collection_name = 'students' if is_student else 'faculty'
            db.collection(collection_name).document(uid).update({
                'role': role.value,
                'updatedAt': get_timestamp(),
            })
            approved = profile.get('status') == 'approved' and profile.get('isApproved') is True
            firebase_auth.set_custom_user_claims(uid, claims_for_account(role.value, approved))
            return {"message": "Role updated successfully"}
        except LuminaException:
            raise
        except Exception as e:
            raise BadRequestException(str(e))
