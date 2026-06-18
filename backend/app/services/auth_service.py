from app.firebase.client import firebase_auth, db
from app.models.enums import UserRole
from app.utils.helpers import get_timestamp
from app.core.exceptions import BadRequestException, MentorOSException, NotFoundException, ServiceUnavailableException

class AuthService:
    def register_user(self, data):
        try:
            if not firebase_auth or not db:
                raise ServiceUnavailableException("Firebase is not configured")
            public_roles = {UserRole.STUDENT, UserRole.FACULTY, UserRole.HOD, UserRole.DEAN, UserRole.ADMIN}
            privileged_roles = {UserRole.HOD, UserRole.DEAN, UserRole.ADMIN}
            if data.role not in public_roles:
                raise BadRequestException("Invalid registration role")
            user = firebase_auth.create_user(
                email=data.email,
                password=data.password,
                display_name=data.name
            )
            firebase_auth.set_custom_user_claims(user.uid, {'role': data.role.value})
            
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
                })
            elif data.role == UserRole.FACULTY:
                profile_data.update({
                    'designation': data.designation,
                    'employeeId': data.employeeId,
                    'status': 'pending',
                    'isApproved': False,
                    'maxStudents': 20,
                    'assignedStudentCount': 0,
                })
            elif data.role in privileged_roles:
                default_designations = {
                    UserRole.HOD: 'Head of Department',
                    UserRole.DEAN: 'Dean',
                    UserRole.ADMIN: 'Administrator',
                }
                profile_data.update({
                    'designation': data.designation or default_designations[data.role],
                    'employeeId': data.employeeId,
                    'status': 'approved',
                    'isApproved': True,
                    'maxStudents': 0,
                    'assignedStudentCount': 0,
                })
            
            collection = 'students' if data.role == UserRole.STUDENT else 'faculty'
            db.collection(collection).document(user.uid).set(profile_data)
            
            return profile_data
        except MentorOSException:
            raise
        except Exception as e:
            raise BadRequestException(f"Failed to register user: {str(e)}")

    def get_user_profile(self, uid: str):
        if not db:
            raise ServiceUnavailableException("Firestore is not configured")
        doc = db.collection('students').document(uid).get()
        if doc.exists:
            return doc.to_dict()
        
        doc = db.collection('faculty').document(uid).get()
        if doc.exists:
            return doc.to_dict()
            
        raise NotFoundException("User profile not found")

    def update_user_role(self, uid: str, role: UserRole):
        try:
            if not firebase_auth:
                raise ServiceUnavailableException("Firebase authentication is not configured")
            firebase_auth.set_custom_user_claims(uid, {'role': role.value})
            return {"message": "Role updated successfully"}
        except MentorOSException:
            raise
        except Exception as e:
            raise BadRequestException(str(e))
