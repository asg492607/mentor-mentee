from fastapi import Depends, Request
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from app.firebase.client import firebase_auth, db
from app.core.exceptions import UnauthorizedException, ForbiddenException, ServiceUnavailableException
from app.models.enums import UserRole

security = HTTPBearer(auto_error=False)

def get_current_user(request: Request, credentials: HTTPAuthorizationCredentials = Depends(security)):
    if not credentials:
        raise UnauthorizedException("Authentication required")
    if not firebase_auth or not db:
        raise ServiceUnavailableException("Authentication service is not configured")
    try:
        token = credentials.credentials
        decoded_token = firebase_auth.verify_id_token(token, check_revoked=True)
        if decoded_token.get("platform_approved") is not True:
            raise ForbiddenException("Account approval is not configured")
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
        if not user_doc.exists:
            raise UnauthorizedException("User profile not found")
        user_data = user_doc.to_dict()
        if user_data.get("status") != "approved" or user_data.get("isApproved") is not True:
            raise ForbiddenException("Account is pending approval")

        role = user_data.get("role")
        if role == UserRole.ADMIN.value:
            if decoded_token.get("admin") is not True:
                raise ForbiddenException("Administrator access is not configured for this account")
        elif role in {UserRole.DEAN.value, UserRole.HOD.value, UserRole.SECTION_HEAD.value}:
            # These claims are issued only by trusted provisioning/approval endpoints.
            # A legacy or client-edited profile cannot grant institutional privileges.
            if decoded_token.get("platform_role") != role:
                raise ForbiddenException("This account's privileged role is not configured")

        current_user = {
            "uid": uid,
            "email": user_data.get("email") or decoded_token.get("email", ""),
            "role": role,
            "name": user_data.get("name") or decoded_token.get("name", "User"),
            "department": user_data.get("department")
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
