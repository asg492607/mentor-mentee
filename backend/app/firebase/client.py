import os
import json
import firebase_admin
import logging
from firebase_admin import credentials, firestore, auth
from app.config import settings

_initialized = False
db = None
firebase_auth = None
logger = logging.getLogger(__name__)

def initialize_firebase():
    global _initialized, db, firebase_auth
    if not _initialized:
        try:
            app = firebase_admin.get_app()
            if app.project_id and app.project_id != settings.FIREBASE_PROJECT_ID:
                raise RuntimeError("Firebase Admin project does not match FIREBASE_PROJECT_ID")
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
                credential_project = getattr(cred, "project_id", None)
                if credential_project and settings.FIREBASE_PROJECT_ID and credential_project != settings.FIREBASE_PROJECT_ID:
                    raise RuntimeError("Firebase service account project does not match FIREBASE_PROJECT_ID")
                options = {"projectId": settings.FIREBASE_PROJECT_ID} if settings.FIREBASE_PROJECT_ID else None
                firebase_admin.initialize_app(cred, options)
                db = firestore.client()
                firebase_auth = auth
                logger.info("Firebase Admin initialized")
            except Exception as exc:
                # Avoid echoing credential parser errors or configuration values
                # into public deployment logs.
                logger.error("Firebase Admin failed to initialize (%s)", type(exc).__name__)
                db = None
                firebase_auth = None
            _initialized = True

# Try to initialize on import so DB/Auth objects are ready if credentials exist
initialize_firebase()
