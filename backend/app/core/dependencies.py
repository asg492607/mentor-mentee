from fastapi import Depends
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from app.firebase.client import firebase_auth, db
from app.core.exceptions import UnauthorizedException, ForbiddenException
from app.models.enums import UserRole

security = HTTPBearer()

def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    try:
        token = credentials.credentials
        decoded_token = firebase_auth.verify_id_token(token)
        uid = decoded_token['uid']
        
        user_doc = db.collection('students').document(uid).get()
        if not user_doc.exists:
            user_doc = db.collection('faculty').document(uid).get()
            
        if not user_doc.exists:
            raise UnauthorizedException("User not found")
        
        user_data = user_doc.to_dict()
        return {
            "uid": uid,
            "email": user_data.get("email"),
            "role": user_data.get("role"),
            "name": user_data.get("name"),
            "department": user_data.get("department")
        }
    except Exception as e:
        raise UnauthorizedException(f"Invalid authentication credentials: {str(e)}")

def require_role(*roles: UserRole):
    def role_checker(current_user: dict = Depends(get_current_user)):
        user_role = current_user.get("role")
        if not user_role or user_role not in [r.value for r in roles]:
            raise ForbiddenException("You do not have permission to perform this action")
        return current_user
    return role_checker

def get_db():
    return db
