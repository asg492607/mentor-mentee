import os
import json
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
                credential_source = None
                if settings.FIREBASE_CREDENTIALS_JSON:
                    credential_source = json.loads(settings.FIREBASE_CREDENTIALS_JSON)
                elif settings.FIREBASE_CREDENTIALS_PATH and os.path.exists(settings.FIREBASE_CREDENTIALS_PATH):
                    credential_source = settings.FIREBASE_CREDENTIALS_PATH
                elif os.getenv("GOOGLE_APPLICATION_CREDENTIALS"):
                    credential_source = os.environ["GOOGLE_APPLICATION_CREDENTIALS"]
                if not credential_source:
                    raise RuntimeError("Firebase Admin credentials are not configured")

                cred = credentials.Certificate(credential_source)
                firebase_admin.initialize_app(cred)
                db = firestore.client()
                firebase_auth = auth
                print("Firebase Admin successfully initialized.")
            except Exception as e:
                print(f"Warning: Firebase Admin failed to initialize: {e}")
                db = None
                firebase_auth = None
            _initialized = True

# Try to initialize on import so DB/Auth objects are ready if credentials exist
initialize_firebase()
