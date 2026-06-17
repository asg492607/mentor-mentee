from app.firebase.client import firebase_auth, db
from app.models.enums import UserRole
from app.utils.helpers import get_timestamp
from app.core.exceptions import BadRequestException, NotFoundException

class AuthService:
    def register_user(self, data):
        try:
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
                'createdAt': get_timestamp(),
                'updatedAt': get_timestamp()
            }
            
            collection = 'students' if data.role == UserRole.STUDENT else 'faculty'
            db.collection(collection).document(user.uid).set(profile_data)
            
            return profile_data
        except Exception as e:
            raise BadRequestException(f"Failed to register user: {str(e)}")

    def get_user_profile(self, uid: str):
        doc = db.collection('students').document(uid).get()
        if doc.exists:
            return doc.to_dict()
        
        doc = db.collection('faculty').document(uid).get()
        if doc.exists:
            return doc.to_dict()
            
        raise NotFoundException("User profile not found")

    def update_user_role(self, uid: str, role: UserRole):
        try:
            firebase_auth.set_custom_user_claims(uid, {'role': role.value})
            return {"message": "Role updated successfully"}
        except Exception as e:
            raise BadRequestException(str(e))
