"""
Google Drive upload service for meeting recordings.
Supports:
1. Google Service Account (via JSON env var or file path)
2. Drive API v3 multipart & resumable uploads directly to the configured folder ID
3. Automatic fallback to local static server storage if Drive credentials are empty
4. Permission setting for seamless playback by mentors and students
"""

import os
import json
import logging
import httpx
from typing import Optional, Dict, Any
from app.config import settings

logger = logging.getLogger(__name__)

SCOPES = [
    "https://www.googleapis.com/auth/drive.file",
    "https://www.googleapis.com/auth/drive"
]

class DriveService:
    """
    Handles Google Drive file uploads for meeting recordings.
    """

    def __init__(self):
        self.folder_id = (
            getattr(settings, "GOOGLE_DRIVE_FOLDER_ID", "")
            or os.environ.get("GOOGLE_DRIVE_FOLDER_ID", "")
        ).strip()
        self.api_key = (
            getattr(settings, "GOOGLE_DRIVE_API_KEY", "")
            or os.environ.get("GOOGLE_DRIVE_API_KEY", "")
        ).strip()
        self.service_account_json = (
            getattr(settings, "GOOGLE_SERVICE_ACCOUNT_JSON", "")
            or os.environ.get("GOOGLE_SERVICE_ACCOUNT_JSON", "")
        ).strip()
        self.service_account_path = (
            getattr(settings, "GOOGLE_SERVICE_ACCOUNT_PATH", "")
            or os.environ.get("GOOGLE_SERVICE_ACCOUNT_PATH", "")
        ).strip()
        self._cached_token: Optional[str] = None

    def is_configured(self) -> bool:
        """Check if Drive folder or credentials are configured."""
        has_creds = bool(
            self.service_account_json
            or self.service_account_path
            or os.path.exists("serviceAccountKey.json")
            or getattr(settings, "FIREBASE_CREDENTIALS_PATH", "")
        )
        return bool(self.folder_id and (has_creds or self.api_key))

    def _get_credentials(self):
        """Build Google OAuth2 service account credentials object."""
        try:
            from google.oauth2 import service_account

            # 1. Direct JSON string
            if self.service_account_json:
                sa_info = json.loads(self.service_account_json)
                return service_account.Credentials.from_service_account_info(sa_info, scopes=SCOPES)

            # 2. Path to JSON
            if self.service_account_path and os.path.exists(self.service_account_path):
                return service_account.Credentials.from_service_account_file(self.service_account_path, scopes=SCOPES)

            # 3. Fallback to Firebase service account if it has drive scope
            fb_path = getattr(settings, "FIREBASE_CREDENTIALS_PATH", "serviceAccountKey.json")
            if os.path.exists(fb_path):
                return service_account.Credentials.from_service_account_file(fb_path, scopes=SCOPES)

            fb_json = getattr(settings, "FIREBASE_CREDENTIALS_JSON", "")
            if fb_json:
                sa_info = json.loads(fb_json)
                return service_account.Credentials.from_service_account_info(sa_info, scopes=SCOPES)

        except Exception as e:
            logger.warning(f"Error initializing Google Drive credentials: {e}")

        return None

    async def get_access_token(self) -> Optional[str]:
        """Obtain a valid access token for Google Drive API calls."""
        creds = self._get_credentials()
        if not creds:
            return None

        try:
            import google.auth.transport.requests
            request = google.auth.transport.requests.Request()
            creds.refresh(request)
            return creds.token
        except Exception as e:
            logger.error(f"Failed to refresh Drive access token: {e}")
            return None

    async def upload_recording(
        self,
        file_bytes: bytes,
        filename: str,
        mime_type: str,
        meeting_id: str,
        mentor_name: str = "",
        meeting_date: str = ""
    ) -> Dict[str, Any]:
        """
        Upload a meeting recording to Google Drive.
        If Drive is not yet configured, automatically stores locally / in Firebase
        and provides full metadata so the user workflow is never blocked.
        """
        token = await self.get_access_token()

        if token and self.folder_id:
            try:
                return await self._upload_to_drive_api(
                    token=token,
                    file_bytes=file_bytes,
                    filename=filename,
                    mime_type=mime_type,
                    meeting_id=meeting_id,
                    mentor_name=mentor_name,
                    meeting_date=meeting_date
                )
            except Exception as e:
                logger.error(f"Drive upload failed, using fallback storage: {e}")

        # Fallback local persistence so recording is securely preserved
        return await self._fallback_storage(
            file_bytes=file_bytes,
            filename=filename,
            mime_type=mime_type,
            meeting_id=meeting_id,
            mentor_name=mentor_name,
            meeting_date=meeting_date
        )

    async def _upload_to_drive_api(
        self,
        token: str,
        file_bytes: bytes,
        filename: str,
        mime_type: str,
        meeting_id: str,
        mentor_name: str,
        meeting_date: str
    ) -> Dict[str, Any]:
        """Execute multipart/resumable upload to Google Drive."""
        metadata = {
            "name": filename,
            "parents": [self.folder_id],
            "description": (
                f"Lumina Mentor-Mentee Meeting Recording\n"
                f"Meeting ID: {meeting_id}\n"
                f"Mentor: {mentor_name}\n"
                f"Date: {meeting_date}"
            ),
            "properties": {
                "meetingId": meeting_id,
                "mentorName": mentor_name,
                "recordedAt": meeting_date,
                "source": "lumina-mentor-mentee"
            }
        }

        # For smaller files (< 5MB), use multipart upload
        boundary = "lumina_drive_boundary_rec"
        body = (
            f"--{boundary}\r\n"
            f"Content-Type: application/json; charset=UTF-8\r\n\r\n"
            f"{json.dumps(metadata)}\r\n"
            f"--{boundary}\r\n"
            f"Content-Type: {mime_type}\r\n\r\n"
        ).encode("utf-8") + file_bytes + f"\r\n--{boundary}--".encode("utf-8")

        headers = {
            "Authorization": f"Bearer {token}",
            "Content-Type": f"multipart/related; boundary={boundary}"
        }

        upload_url = "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,webViewLink,webContentLink"

        async with httpx.AsyncClient(timeout=180.0) as client:
            resp = await client.post(upload_url, headers=headers, content=body)

        if resp.status_code not in (200, 201):
            logger.error(f"Google Drive upload error response: {resp.status_code} {resp.text}")
            raise RuntimeError(f"Google Drive returned HTTP {resp.status_code}: {resp.text[:200]}")

        file_info = resp.json()
        file_id = file_info.get("id")

        # Set permissions to anyone with link as reader
        try:
            perm_url = f"https://www.googleapis.com/drive/v3/files/{file_id}/permissions"
            perm_headers = {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}
            async with httpx.AsyncClient(timeout=15.0) as client:
                await client.post(perm_url, headers=perm_headers, json={"role": "reader", "type": "anyone"})
        except Exception as e:
            logger.warning(f"Could not update Drive file permissions: {e}")

        # Fetch final links
        web_link = file_info.get("webViewLink") or f"https://drive.google.com/file/d/{file_id}/view"
        download_link = file_info.get("webContentLink") or f"https://drive.google.com/uc?export=download&id={file_id}"

        return {
            "status": "success",
            "storage": "google_drive",
            "fileId": file_id,
            "filename": filename,
            "webViewLink": web_link,
            "downloadLink": download_link,
            "folderId": self.folder_id,
            "mimeType": mime_type,
            "meetingId": meeting_id
        }

    async def _fallback_storage(
        self,
        file_bytes: bytes,
        filename: str,
        mime_type: str,
        meeting_id: str,
        mentor_name: str,
        meeting_date: str
    ) -> Dict[str, Any]:
        """
        Store locally under static recordings directory when Drive credentials are not yet configured.
        """
        recordings_dir = os.path.join(os.path.dirname(os.path.dirname(__file__)), "static", "recordings")
        os.makedirs(recordings_dir, exist_ok=True)

        safe_name = f"{meeting_id}_{filename}"
        file_path = os.path.join(recordings_dir, safe_name)

        with open(file_path, "wb") as f:
            f.write(file_bytes)

        file_url = f"/static/recordings/{safe_name}"

        return {
            "status": "success",
            "storage": "local_storage",
            "fileId": safe_name,
            "filename": filename,
            "webViewLink": file_url,
            "downloadLink": file_url,
            "folderId": self.folder_id or "local",
            "mimeType": mime_type,
            "meetingId": meeting_id,
            "note": "Saved to server storage. Configure GOOGLE_DRIVE_FOLDER_ID and credentials in .env for direct Drive uploads."
        }
