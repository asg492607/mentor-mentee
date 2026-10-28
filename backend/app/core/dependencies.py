from fastapi import Depends, Request
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from app.firebase.client import firebase_auth, db
from app.config import settings
from app.core.exceptions import UnauthorizedException, ForbiddenException, ServiceUnavailableException
from app.models.enums import UserRole

security = HTTPBearer(auto_error=False)

def get_current_user(request: Request, credentials: HTTPAuthorizationCredentials = Depends(security)):
    if not firebase_auth or not db:
        raise ServiceUnavailableException("Authentication service is not configured")
    try:
        # Browser clients use an HttpOnly session cookie. Keep Bearer-token
        # support for non-browser API consumers.
        if credentials:
            decoded_token = firebase_auth.verify_id_token(credentials.credentials, check_revoked=True)
        else:
            session_cookie = request.cookies.get(settings.SESSION_COOKIE_NAME)
            if not session_cookie:
                raise UnauthorizedException("Authentication required")
            decoded_token = firebase_auth.verify_session_cookie(session_cookie, check_revoked=True)
        uid = decoded_token.get('uid')
        if not uid:
            raise UnauthorizedException("Invalid authentication credentials")

        student_doc = db.collection('students').document(uid).get()
        faculty_doc = db.collection('faculty').document(uid).get()
        if decoded_token.get("admin") is True and faculty_doc.exists:
            user_doc = faculty_doc
        elif student_doc.exists and (student_doc.to_dict() or {}).get("role") == UserRole.STUDENT.value:
            user_doc = student_doc
        elif faculty_doc.exists:
            user_doc = faculty_doc
        else:
            user_doc = student_doc
        
        if not user_doc or not user_doc.exists:
            raise ForbiddenException("No platform account has been provisioned for this user")

        user_data = user_doc.to_dict() or {}
        if user_data.get("status") != "approved" or user_data.get("isApproved") is not True:
            raise ForbiddenException("Your account is awaiting approval")

        # The server-side profile is authoritative. Token claims are cached until
        # refresh and must never override a changed or revoked platform role.
        role = user_data.get("role")
        if not role:
            raise ForbiddenException("Your platform account does not have an assigned role")

        current_user = {
            "uid": uid,
            "email": user_data.get("email") or decoded_token.get("email", ""),
            "role": role,
            "name": user_data.get("name") or decoded_token.get("name", "User"),
            "department": user_data.get("department"),
            "departmentId": user_data.get("departmentId"),
            "schoolId": user_data.get("schoolId"),
            "schoolName": user_data.get("schoolName"),
        }
        request.state.audit_actor = current_user
        return current_user
    except (UnauthorizedException, ForbiddenException, ServiceUnavailableException):
        raise
    except Exception:
        raise UnauthorizedException("Invalid authentication credentials")

def require_role(*roles: UserRole):
    def role_checker(current_user: dict = Depends(get_current_user)):
        user_role = current_user.get("role")
        if not user_role or user_role not in [r.value for r in roles]:
            raise ForbiddenException("You do not have permission to perform this action")
        return current_user
    return role_checker

def get_db():
    return db
