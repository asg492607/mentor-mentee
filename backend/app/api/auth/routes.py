"""
User authentication, login credentials, and session refresh
"""
from datetime import timedelta
from typing import Any

import logging
import httpx
import time
from collections import defaultdict, deque
from fastapi import APIRouter, Depends, HTTPException, Request, Response

logger = logging.getLogger(__name__)
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
_auth_rate_limits: dict[tuple[str, str], deque[float]] = defaultdict(deque)

def _auth_rate_limit(key: str, action: str, maximum: int, seconds: int) -> None:
    now = time.monotonic()
    requests = _auth_rate_limits[(key, action)]
    while requests and now - requests[0] > seconds:
        requests.popleft()
    if len(requests) >= maximum:
        raise HTTPException(
            status_code=429,
            detail="Too many authentication attempts. Please try again shortly."
        )
    requests.append(now)


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


def _provision_claims(decoded: dict[str, Any]) -> dict[str, Any]:
    """Issue claims from a server-verified profile and return that profile."""
    uid = decoded.get('uid')
    email = str(decoded.get('email') or '').strip().lower()
    if not uid:
        raise UnauthorizedException("Invalid authentication credentials")

    trusted_admin_email = settings.LEGACY_SUPER_ADMIN_EMAIL.strip().lower()
    profile_collection, _profile_doc, profile = _get_profile(uid)
    if trusted_admin_email and email == trusted_admin_email and decoded.get('email_verified') is True:
        if profile_collection == 'faculty' and profile.get('role') not in (None, 'ADMIN'):
            raise ForbiddenException("This administrator account has a conflicting staff profile")
        profile = {
            **(profile or {}), 'id': uid, 'email': email,
            'name': (profile or {}).get('name') or decoded.get('name') or 'Administrator',
            'role': 'ADMIN', 'status': 'approved', 'isApproved': True,
            'updatedAt': get_timestamp(),
        }
        if not profile.get('createdAt'):
            profile['createdAt'] = get_timestamp()
        db.collection('faculty').document(uid).set(profile, merge=True)
        firebase_auth.set_custom_user_claims(uid, claims_for_account('ADMIN', True))
        return profile

    if not profile:
        raise ForbiddenException("User profile not found. Register first or contact your administrator.")
    role = str(profile.get('role') or '').upper()
    approved = str(profile.get('status') or '').lower() == 'approved' and profile.get('isApproved') is True
    if not approved:
        raise ForbiddenException("Your account is pending approval by your department administrator.")
    if role not in {'STUDENT', 'FACULTY', 'MENTOR'}:
        raise ForbiddenException("This privileged account needs trusted administrator provisioning.")
    if (role == 'STUDENT') != (profile_collection == 'students'):
        raise ForbiddenException("Account role does not match its profile")
    if str(profile.get('email') or '').strip().lower() not in {'', email}:
        raise ForbiddenException("Account email does not match its profile")
    firebase_auth.set_custom_user_claims(uid, claims_for_account(role, True))
    return {**profile, 'id': uid}


def _identity_request(action: str, payload: dict[str, Any]) -> dict[str, Any]:
    if not settings.FIREBASE_WEB_API_KEY:
        raise ServiceUnavailableException("Server authentication is not configured")
    try:
        response = httpx.post(
            f"https://identitytoolkit.googleapis.com/v1/accounts:{action}?key={settings.FIREBASE_WEB_API_KEY}",
            json=payload,
            timeout=15,
        )
    except httpx.HTTPError:
        raise ServiceUnavailableException("Authentication service is temporarily unavailable")
    if response.status_code >= 400:
        error = response.json().get('error', {}).get('message', 'Authentication failed')
        if action == 'signInWithPassword':
            raise UnauthorizedException("Invalid email or password")
        raise UnauthorizedException(error.replace('_', ' ').lower())
    return response.json()


def _set_session(response: Response, id_token: str) -> None:
    try:
        session_cookie = firebase_auth.create_session_cookie(id_token, expires_in=timedelta(days=5))
    except Exception:
        raise ServiceUnavailableException("Unable to create a secure session")
    response.set_cookie(
        key=settings.SESSION_COOKIE_NAME,
        value=session_cookie,
        max_age=5 * 24 * 60 * 60,
        httponly=True,
        secure=settings.SESSION_COOKIE_SECURE,
        samesite='none',
        path='/',
    )


@router.post('/login')
def login_with_server_session(payload: dict[str, Any], response: Response, request: Request):
    """Authenticate without ever sending the Firebase Web API key to a browser."""
    client_ip = request.client.host if request.client else "unknown"
    _auth_rate_limit(client_ip, "login_ip", maximum=10, seconds=60)
    if not firebase_auth or not db:
        raise ServiceUnavailableException("Authentication service is not configured")
    email = str(payload.get('email') or '').strip().lower()
    if email:
        _auth_rate_limit(email, "login_account", maximum=6, seconds=60)
    password = str(payload.get('password') or '')
    if not email or not password:
        raise UnauthorizedException("Email and password are required")
    sign_in = _identity_request('signInWithPassword', {
        'email': email, 'password': password, 'returnSecureToken': True,
    })
    try:
        decoded = firebase_auth.verify_id_token(sign_in['idToken'], check_revoked=True)
        profile = _provision_claims(decoded)
        role = str(profile.get('role') or 'STUDENT').upper()
        claims = claims_for_account(role, True)
        custom_token_raw = firebase_auth.create_custom_token(decoded['uid'], claims)
        custom_token = custom_token_raw.decode('utf-8') if isinstance(custom_token_raw, bytes) else str(custom_token_raw)
        refreshed = _identity_request('signInWithCustomToken', {
            'token': custom_token, 'returnSecureToken': True,
        })
        _set_session(response, refreshed['idToken'])
    except (ForbiddenException, UnauthorizedException, ServiceUnavailableException):
        raise
    except Exception as exc:
        logger.exception("Login verification failed: %s", exc)
        raise UnauthorizedException(f"Unable to verify this account: {str(exc)}")
    return {'profile': profile, 'customToken': custom_token}


@router.post('/logout', status_code=204)
def logout_server_session(response: Response):
    response.delete_cookie(settings.SESSION_COOKIE_NAME, path='/', samesite='none', secure=settings.SESSION_COOKIE_SECURE)


@router.post('/password-reset', status_code=204)
def password_reset(payload: dict[str, Any], request: Request):
    client_ip = request.client.host if request.client else "unknown"
    _auth_rate_limit(client_ip, "password_reset", maximum=4, seconds=60)
    email = str(payload.get('email') or '').strip().lower()
    if email:
        _auth_rate_limit(email, "password_reset_account", maximum=3, seconds=60)
    if not email:
        raise UnauthorizedException("Email is required")
    _identity_request('sendOobCode', {'requestType': 'PASSWORD_RESET', 'email': email})


@router.post('/register')
def register_account(payload: dict[str, Any], request: Request):
    """Create pending self-registration accounts with the Admin SDK only."""
    client_ip = request.client.host if request.client else "unknown"
    _auth_rate_limit(client_ip, "register_ip", maximum=5, seconds=60)
    if not firebase_auth or not db:
        raise ServiceUnavailableException("Registration service is not configured")
    email = str(payload.get('email') or '').strip().lower()
    password = str(payload.get('password') or '')
    role = str(payload.get('role') or '').upper()
    profile_input = payload.get('profile') or {}
    if role not in {'STUDENT', 'FACULTY'}:
        raise ForbiddenException("Only student and faculty accounts can self-register")
    if not email or len(password) < 6 or not str(profile_input.get('name') or '').strip():
        raise UnauthorizedException("Provide a name, valid email address, and a password of at least 6 characters")
    terms_accepted = bool(payload.get('termsAccepted') or profile_input.get('termsAccepted'))
    if not terms_accepted:
        raise UnauthorizedException("You must accept the Terms & Conditions and Privacy Policy to register")
    try:
        user = firebase_auth.create_user(email=email, password=password)
    except Exception as exc:
        message = str(exc).lower()
        if 'already exists' in message or 'email already' in message:
            raise UnauthorizedException("This email is already registered")
        raise ServiceUnavailableException("Unable to create the account")

    profile = {
        'id': user.uid, 'email': email, 'name': str(profile_input['name']).strip(),
        'role': role, 'department': profile_input.get('department') or None,
        'createdAt': get_timestamp(), 'updatedAt': get_timestamp(),
        'status': 'pending', 'isApproved': False,
        'termsAccepted': True, 'termsAcceptedAt': get_timestamp(),
    }
    if role == 'STUDENT':
        profile.update({
            'year': profile_input.get('year'), 'class': profile_input.get('class') or None,
            'enrollmentNumber': profile_input.get('enrollmentNumber') or None,
            'cgpa': 0, 'attendance': 0, 'riskLevel': 'LOW', 'mentorId': None,
        })
        collection = 'students'
    else:
        profile.update({
            'designation': profile_input.get('designation') or None,
            'employeeId': profile_input.get('employeeId') or None,
            'maxStudents': 20, 'assignedStudentCount': 0,
        })
        collection = 'faculty'
    db.collection(collection).document(user.uid).set(profile)
    return {'profile': profile}


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
    if trusted_admin_email and email == trusted_admin_email and decoded.get('email_verified') is True:
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
    profile = auth_service.get_user_profile(user['uid'])
    if not profile:
        profile = {
            'id': user['uid'],
            'uid': user['uid'],
            'email': user.get('email'),
            'role': user.get('role'),
            'name': user.get('name'),
            'department': user.get('department'),
        }
    role = str(profile.get('role') or user.get('role') or 'STUDENT').upper()
    claims = claims_for_account(role, True)
    custom_token_raw = firebase_auth.create_custom_token(user['uid'], claims)
    custom_token = custom_token_raw.decode('utf-8') if isinstance(custom_token_raw, bytes) else str(custom_token_raw)
    return {**profile, 'customToken': custom_token}
