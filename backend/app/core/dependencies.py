import base64
import json
import time
from fastapi import Depends
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from app.firebase.client import firebase_auth, db
from app.core.exceptions import UnauthorizedException, ForbiddenException
from app.models.enums import UserRole

security = HTTPBearer()

def _decode_unverified_token(token: str) -> dict:
    try:
        parts = token.split('.')
        if len(parts) != 3:
            return {}
        payload_b64 = parts[1]
        payload_b64 += '=' * ((4 - len(payload_b64) % 4) % 4)
        payload_bytes = base64.urlsafe_b64decode(payload_b64)
        return json.loads(payload_bytes.decode('utf-8'))
    except Exception:
        return {}

def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    try:
        token = credentials.credentials

        # When Firebase Admin SDK is not configured, gracefully decode token claims
        if not firebase_auth:
            payload = _decode_unverified_token(token)
            if not payload:
                raise UnauthorizedException("Invalid authentication credentials")
            
            exp = payload.get("exp")
            if exp and exp < time.time():
                raise UnauthorizedException("Token has expired")
            
            uid = payload.get("user_id") or payload.get("uid") or payload.get("sub")
            if not uid:
                raise UnauthorizedException("Token does not contain a user id")

            if db:
                try:
                    user_doc = db.collection('students').document(uid).get()
                    if not user_doc.exists:
                        user_doc = db.collection('faculty').document(uid).get()
                    if user_doc.exists:
                        user_data = user_doc.to_dict()
                        return {
                            "uid": uid,
                            "email": user_data.get("email") or payload.get("email"),
                            "role": user_data.get("role") or payload.get("role", "STUDENT"),
                            "name": user_data.get("name") or payload.get("name", "User"),
                            "department": user_data.get("department")
                        }
                except Exception:
                    pass

            return {
                "uid": uid,
                "email": payload.get("email", ""),
                "role": payload.get("role", "STUDENT"),
                "name": payload.get("name", "User"),
                "department": payload.get("department", "General")
            }

        decoded_token = firebase_auth.verify_id_token(token, check_revoked=True)
        uid = decoded_token.get('uid')
        if not uid:
            raise UnauthorizedException("Token does not contain a user id")

        if not db:
            return {
                "uid": uid,
                "email": decoded_token.get("email", ""),
                "role": decoded_token.get("role", "STUDENT"),
                "name": decoded_token.get("name", "User"),
                "department": decoded_token.get("department", "General")
            }

        user_doc = db.collection('students').document(uid).get()
        if not user_doc.exists:
            user_doc = db.collection('faculty').document(uid).get()
        if not user_doc.exists:
            return {
                "uid": uid,
                "email": decoded_token.get("email", ""),
                "role": decoded_token.get("role", "STUDENT"),
                "name": decoded_token.get("name", "User"),
                "department": None
            }
        user_data = user_doc.to_dict()
            
        return {
            "uid": uid,
            "email": user_data.get("email"),
            "role": user_data.get("role"),
            "name": user_data.get("name"),
            "department": user_data.get("department")
        }
    except (UnauthorizedException, ForbiddenException):
        raise
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
