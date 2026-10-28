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
from app.core.exceptions import BadRequestException, ForbiddenException, ServiceUnavailableException, UnauthorizedException
from app.core.role_claims import claims_for_account
from app.utils.helpers import get_timestamp

router = APIRouter(prefix="/auth", tags=["Auth"])
token_security = HTTPBearer(auto_error=False)
_auth_rate_limits: dict[tuple[str, str], deque[float]] = defaultdict(deque)


@router.get("/institution-options")
def get_public_institution_options():
    """Return the non-sensitive school, department, and classroom choices for registration."""
    if not db:
        raise ServiceUnavailableException("Institution directory is temporarily unavailable")

    records = [
        {**(snapshot.to_dict() or {}), 'id': snapshot.id}
        for snapshot in db.collection('departments').stream()
    ]
    schools = {
        item['id']: item.get('name')
        for item in records
        if str(item.get('type') or '').upper() in {'SCHOOL', 'COLLEGE'}
    }
    departments = [
        {
            'id': item['id'],
            'name': item.get('name'),
            'type': item.get('type'),
            'schoolId': item.get('schoolId'),
            'schoolName': item.get('schoolName') or schools.get(item.get('schoolId')),
        }
        for item in records
        if str(item.get('type') or '').upper() not in {'SCHOOL', 'COLLEGE', 'SECTION'}
    ]
    classes = [
        {
            'id': item.id,
            'className': item.get('className'),
            'departmentId': item.get('departmentId'),
            'course': item.get('course') or '',
            'durationYears': item.get('durationYears') or 4,
            'year': item.get('year'),
        }
        for item in db.collection('classes').stream()
        if item.get('departmentId')
    ]
    departments.sort(key=lambda item: str(item.get('name') or '').casefold())
    classes.sort(key=lambda item: (str(item.get('departmentId')), str(item.get('className') or '').casefold()))
    return {'departments': departments, 'classes': classes}

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
    """Issue claims only for a server-provisioned, approved platform account."""
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

    if not profile or profile_collection not in {'students', 'faculty'}:
        raise ForbiddenException("No platform account has been provisioned for this user")
    if profile.get('status') != 'approved' or profile.get('isApproved') is not True:
        raise ForbiddenException("Your account is awaiting approval")

    role = str(profile.get('role') or '').upper()
    if not role:
        raise ForbiddenException("Your platform account does not have an assigned role")
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

    department = str(profile_input.get('department') or '').strip()
    department_id = str(profile_input.get('departmentId') or '').strip()
    department_record = None
    if department_id:
        department_doc = db.collection('departments').document(department_id).get()
        if department_doc.exists:
            department_record = {**(department_doc.to_dict() or {}), 'id': department_doc.id}
    elif department:
        matches = list(db.collection('departments').where('name', '==', department).limit(2).get())
        if len(matches) == 1:
            department_record = {**(matches[0].to_dict() or {}), 'id': matches[0].id}
    if (
        not department_record
        or str(department_record.get('type') or '').upper() in {'SCHOOL', 'COLLEGE', 'SECTION'}
        or (department and department_record.get('name') != department)
    ):
        raise BadRequestException("Select a valid academic department")
    department = str(department_record.get('name') or '').strip()
    department_id = str(department_record.get('id') or '').strip()
    school_id = department_record.get('schoolId')
    school_name = department_record.get('schoolName')
    if school_id and not school_name:
        school_doc = db.collection('departments').document(str(school_id)).get()
        school_name = (school_doc.to_dict() or {}).get('name') if school_doc.exists else None

    if role == 'STUDENT':
        class_name = str(profile_input.get('class') or '').strip()
        class_id = str(profile_input.get('classId') or '').strip()
        enrollment = str(profile_input.get('enrollmentNumber') or '').strip()
        try:
            year = int(profile_input.get('year'))
        except (TypeError, ValueError):
            raise BadRequestException("Select a valid student year")
        if not class_name or not enrollment or not 1 <= year <= 8:
            raise BadRequestException("Department, class, enrollment number, and a valid year are required")
        class_doc = db.collection('classes').document(class_id).get() if class_id else None
        if not class_doc or not class_doc.exists:
            matching_classes = list(
                db.collection('classes')
                .where('departmentId', '==', department_id)
                .where('className', '==', class_name)
                .limit(2)
                .get()
            )
            class_doc = matching_classes[0] if len(matching_classes) == 1 else None
        if not class_doc or not class_doc.exists:
            raise BadRequestException("Select a classroom configured for this department")
        class_record = class_doc.to_dict() or {}
        if (
            class_record.get('departmentId') != department_id
            or str(class_record.get('className') or '').strip() != class_name
        ):
            raise BadRequestException("The selected classroom does not belong to this department")
        class_id = class_doc.id
        try:
            duration_years = int(class_record.get('durationYears') or profile_input.get('durationYears') or 4)
        except (TypeError, ValueError):
            duration_years = 4
        duration_years = max(1, min(8, duration_years))
        if year > duration_years:
            raise BadRequestException(f"The selected course has {duration_years} year(s)")
        try:
            class_year = int(class_record.get('year')) if class_record.get('year') is not None else None
        except (TypeError, ValueError):
            class_year = {
                'FY': 1, 'FIRST': 1, 'FIRST YEAR': 1,
                'SY': 2, 'SECOND': 2, 'SECOND YEAR': 2,
                'TY': 3, 'THIRD': 3, 'THIRD YEAR': 3,
                'LY': 4, 'FINAL': 4, 'FINAL YEAR': 4, 'FOURTH YEAR': 4,
            }.get(str(class_record.get('year') or '').strip().upper())
        if class_year and class_year != year:
            raise BadRequestException("The selected year does not match this classroom")
        normalized_enrollment = enrollment.casefold()
        existing = db.collection('students').where('enrollmentNumberNormalized', '==', normalized_enrollment).limit(1).get()
        if not existing:
            existing = db.collection('students').where('enrollmentNumber', '==', enrollment).limit(1).get()
        if existing:
            raise BadRequestException("Enrollment number is already registered")
    elif not department or not str(profile_input.get('designation') or '').strip() or not str(profile_input.get('employeeId') or '').strip():
        raise BadRequestException("Department, designation, and employee ID are required for faculty registration")

    user = None
    collection = 'students' if role == 'STUDENT' else 'faculty'
    try:
        user = firebase_auth.create_user(email=email, password=password)
        profile = {
            'id': user.uid, 'email': email, 'name': str(profile_input['name']).strip(),
            'role': role, 'department': department,
            'departmentId': department_id, 'schoolId': school_id,
            'schoolName': school_name,
            'createdAt': get_timestamp(), 'updatedAt': get_timestamp(),
            'status': 'pending', 'isApproved': False,
            'termsAccepted': True, 'termsAcceptedAt': get_timestamp(),
        }
        if role == 'STUDENT':
            profile.update({
                'year': year, 'class': class_name,
                'classId': class_id,
                'course': class_record.get('course') or profile_input.get('course') or '',
                'program': class_record.get('course') or profile_input.get('course') or '',
                'durationYears': duration_years,
                'semesterCount': duration_years * 2,
                'semesterDurationMonths': 6,
                'yearLabel': str(profile_input.get('yearLabel') or ''),
                'enrollmentNumber': enrollment,
                'enrollmentNumberNormalized': normalized_enrollment,
                'cgpa': 0, 'attendance': 0, 'riskLevel': 'LOW', 'mentorId': None,
            })
        else:
            profile.update({
                'designation': str(profile_input['designation']).strip(),
                'employeeId': str(profile_input['employeeId']).strip(),
                'maxStudents': 20, 'assignedStudentCount': 0,
            })
        db.collection(collection).document(user.uid).set(profile)
        return {'profile': profile}
    except Exception as exc:
        if user:
            try:
                db.collection(collection).document(user.uid).delete()
            except Exception:
                logger.exception("Could not remove incomplete registration profile %s", user.uid)
            try:
                firebase_auth.delete_user(user.uid)
            except Exception:
                logger.exception("Could not remove incomplete registration account %s", user.uid)
        message = str(exc).lower()
        if 'already exists' in message or 'email already' in message:
            raise UnauthorizedException("This email is already registered")
        logger.exception("Self-registration failed")
        raise ServiceUnavailableException("Unable to complete registration. Please try again.")


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

    if not profile or profile_collection not in {'students', 'faculty'}:
        raise ForbiddenException("No platform account has been provisioned for this user")
    if profile.get('status') != 'approved' or profile.get('isApproved') is not True:
        raise ForbiddenException("Your account is awaiting approval")

    role = str(profile.get('role') or '').upper()
    if not role:
        raise ForbiddenException("Your platform account does not have an assigned role")

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
