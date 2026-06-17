import firebase_admin
from firebase_admin import credentials, firestore, auth
from app.config import settings

_initialized = False

def initialize_firebase():
    global _initialized
    if not _initialized:
        try:
            firebase_admin.get_app()
        except ValueError:
            try:
                cred = credentials.Certificate(settings.FIREBASE_CREDENTIALS_PATH)
                firebase_admin.initialize_app(cred)
            except Exception as e:
                print(f"Failed to initialize Firebase: {e}")
        _initialized = True

try:
    initialize_firebase()
    db = firestore.client()
    firebase_auth = auth
except Exception:
    db = None
    firebase_auth = None
