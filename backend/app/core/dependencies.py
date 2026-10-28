from fastapi import Depends, Request
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from app.firebase.client import firebase_auth, db
from app.config import settings
from app.core.exceptions import UnauthorizedException, ForbiddenException, ServiceUnavailableException
from app.core.role_claims import claims_for_account
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

        token_role = str(decoded_token.get('role') or '').upper()
        if token_role not in {role.value for role in UserRole}:
            raise ForbiddenException("Your account role is not configured")

        # Select the only valid profile collection for the signed role. This
        # prevents a stray or conflicting document from changing account type.
        collection = 'students' if token_role == UserRole.STUDENT.value else 'faculty'
        user_doc = db.collection(collection).document(uid).get()
        if not user_doc or not user_doc.exists:
            raise ForbiddenException("No platform account has been provisioned for this user")

        user_data = user_doc.to_dict() or {}
        if user_data.get("status") != "approved" or user_data.get("isApproved") is not True:
            raise ForbiddenException("Your account is awaiting approval")

        # The server-side profile is authoritative. Token claims are cached until
        # refresh and must never override a changed or revoked platform role.
        role = str(user_data.get("role") or '').upper()
        if role != token_role:
            raise ForbiddenException("Your account role has changed. Please sign in again")
        expected_claims = claims_for_account(role, True)
        if any(decoded_token.get(key) != value for key, value in expected_claims.items()):
            raise ForbiddenException("Your account permissions are not current. Please sign in again")

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
