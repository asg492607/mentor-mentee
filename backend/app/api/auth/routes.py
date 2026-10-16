"""
User authentication, login credentials, and session refresh
"""
from fastapi import APIRouter, Depends
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from app.config import settings
from app.firebase.client import firebase_auth, db
from app.services.auth_service import AuthService
from app.core.dependencies import get_current_user
from app.core.exceptions import ForbiddenException, ServiceUnavailableException, UnauthorizedException
from app.core.role_claims import claims_for_account
from app.utils.helpers import get_timestamp

router = APIRouter(prefix="/auth", tags=["Auth"])
token_security = HTTPBearer(auto_error=False)


def _get_profile(uid: str):
    student_doc = db.collection('students').document(uid).get()
    faculty_doc = db.collection('faculty').document(uid).get()
    if faculty_doc.exists:
        faculty = faculty_doc.to_dict() or {}
        if faculty.get('role') != 'STUDENT':
            return 'faculty', faculty_doc, faculty
    if student_doc.exists:
        student = student_doc.to_dict() or {}
        if student.get('role') == 'STUDENT':
            return 'students', student_doc, student
    if faculty_doc.exists:
        return 'faculty', faculty_doc, faculty_doc.to_dict() or {}
    if student_doc.exists:
        return 'students', student_doc, student_doc.to_dict() or {}
    return None, None, None


@router.post("/bootstrap-claims")
def bootstrap_legacy_claims(credentials: HTTPAuthorizationCredentials = Depends(token_security)):
    """Migrate existing approved accounts to trusted Firebase custom claims.

    This route is intentionally outside the normal approved-user dependency so an
    authenticated legacy account can receive its server-verified claims once.
    """
    if not credentials:
        raise UnauthorizedException("A Firebase sign-in is required")
    if not firebase_auth or not db:
        raise ServiceUnavailableException("Account migration is temporarily unavailable")

    try:
        decoded = firebase_auth.verify_id_token(credentials.credentials, check_revoked=True)
    except Exception:
        raise UnauthorizedException("Invalid authentication credentials")

    uid = decoded.get('uid')
    if not uid:
        raise UnauthorizedException("Invalid authentication credentials")

    email = str(decoded.get('email') or '').strip().lower()
    trusted_admin_email = settings.LEGACY_SUPER_ADMIN_EMAIL.strip().lower()
    profile_collection, profile_doc, profile = _get_profile(uid)

    # Preserve the repository's former root-admin account, but bind the exception
    # to its verified Firebase email and provision the role only on the server.
    if email and email == trusted_admin_email and decoded.get('email_verified') is True:
        if profile_collection == 'faculty' and profile.get('role') not in (None, 'ADMIN'):
            raise ForbiddenException("This administrator account has a conflicting staff profile")
        admin_profile = {
            **(profile or {}),
            'id': uid,
            'email': email,
            'name': (profile or {}).get('name') or decoded.get('name') or 'Administrator',
            'role': 'ADMIN',
            'status': 'approved',
            'isApproved': True,
            'updatedAt': get_timestamp(),
        }
        if not (profile or {}).get('createdAt'):
            admin_profile['createdAt'] = get_timestamp()
        db.collection('faculty').document(uid).set(admin_profile, merge=True)
        firebase_auth.set_custom_user_claims(uid, claims_for_account('ADMIN', True))
        return {"status": "claims_updated", "profile": admin_profile}

    if not profile:
        raise ForbiddenException("User profile not found. Register first or contact your administrator.")

    role = str(profile.get('role') or '').upper()
    approved = str(profile.get('status') or '').lower() == 'approved' and profile.get('isApproved') is True
    if not approved:
        raise ForbiddenException("Your account is pending approval by your department administrator.")

    if profile.get('status') != 'approved':
        profile_doc.reference.update({'status': 'approved'})
        profile['status'] = 'approved'

    # Existing ordinary accounts can be migrated from their own approved profile.
    # Legacy privileged roles are never inferred from a client-editable profile.
    if role not in {'STUDENT', 'FACULTY', 'MENTOR'}:
        raise ForbiddenException("This privileged account needs trusted administrator provisioning.")
    if (role == 'STUDENT') != (profile_collection == 'students'):
        raise ForbiddenException("Account role does not match its profile")
    if str(profile.get('email') or '').strip().lower() not in {'', email}:
        raise ForbiddenException("Account email does not match its profile")

    firebase_auth.set_custom_user_claims(uid, claims_for_account(role, True))
    return {"status": "claims_updated", "profile": {**profile, 'id': uid}}

@router.post("/verify-token")
def verify_token(user = Depends(get_current_user)):
    return {"status": "valid", "user": user}

@router.get("/me")
def get_me(user = Depends(get_current_user), auth_service: AuthService = Depends()):
    return auth_service.get_user_profile(user['uid'])
