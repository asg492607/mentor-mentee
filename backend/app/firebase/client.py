import os
import firebase_admin
from firebase_admin import credentials, firestore, auth
from app.config import settings

_initialized = False
db = None
firebase_auth = None

def initialize_firebase():
    global _initialized, db, firebase_auth
    if not _initialized:
        try:
            firebase_admin.get_app()
            db = firestore.client()
            firebase_auth = auth
            _initialized = True
        except ValueError:
            try:
                if not settings.FIREBASE_CREDENTIALS_PATH or not os.path.exists(settings.FIREBASE_CREDENTIALS_PATH):
                    raise FileNotFoundError(f"Firebase credentials file not found at: {settings.FIREBASE_CREDENTIALS_PATH}")
                
                cred = credentials.Certificate(settings.FIREBASE_CREDENTIALS_PATH)
                firebase_admin.initialize_app(cred)
                db = firestore.client()
                firebase_auth = auth
                print("Firebase Admin successfully initialized.")
            except Exception as e:
                print(f"Warning: Firebase Admin failed to initialize. Running in mock/fallback mode. Error: {e}")
                db = None
                firebase_auth = None
            _initialized = True

# Try to initialize on import so DB/Auth objects are ready if credentials exist
initialize_firebase()
