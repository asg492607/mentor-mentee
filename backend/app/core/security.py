from app.firebase.client import firebase_auth

def verify_firebase_token(token: str) -> dict:
    if not firebase_auth:
        raise RuntimeError("Firebase authentication is not configured")
    return firebase_auth.verify_id_token(token)

def set_custom_claims(uid: str, claims: dict):
    firebase_auth.set_custom_user_claims(uid, claims)
