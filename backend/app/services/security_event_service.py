"""Server-side access logging for the admin security activity view."""

import ipaddress
import logging
from collections import deque
from datetime import datetime, timezone
from threading import Lock
from time import monotonic

from app.firebase.client import db
from app.core.exceptions import ServiceUnavailableException

logger = logging.getLogger(__name__)
_unauthenticated_event_windows: dict[str, deque[float]] = {}
_event_window_lock = Lock()


class SecurityEventService:
    COLLECTION = "security_events"

    @staticmethod
    def _clean_text(value: str | None, maximum: int) -> str:
        return "".join(character for character in (value or "") if character.isprintable())[:maximum]

    @classmethod
    def build_api_event(cls, request, status_code: int, duration_ms: int) -> dict:
        route = request.scope.get("route")
        route_path = getattr(route, "path", None) or request.url.path
        actor = getattr(request.state, "audit_actor", {}) or {}
        forwarded_ips = []
        for candidate in request.headers.get("x-forwarded-for", "").split(",")[:8]:
            candidate = candidate.strip()
            try:
                forwarded_ips.append(str(ipaddress.ip_address(candidate)))
            except ValueError:
                continue

        is_page_view = getattr(request.state, "audit_event_type", None) == "portal_page_view"
        suspicious_status = int(status_code) in {401, 403, 404, 429, 500}
        event = {
            "eventType": "portal_page_view" if is_page_view else "suspicious_access" if suspicious_status else "api_access",
            "createdAt": datetime.now(timezone.utc).isoformat(),
            "actorId": cls._clean_text(actor.get("uid"), 128) or None,
            "actorName": cls._clean_text(actor.get("name"), 120) or None,
            "actorRole": cls._clean_text(actor.get("role"), 40) or None,
            "authenticated": bool(actor.get("uid")),
            "method": cls._clean_text(request.method, 12),
            "route": cls._clean_text(route_path, 180),
            "portalPage": cls._clean_text(getattr(request.state, "audit_page", None), 120) or None,
            "statusCode": int(status_code),
            "durationMs": max(0, int(duration_ms)),
            "peerIp": cls._clean_text(request.client.host if request.client else None, 64) or None,
            # Forwarding headers are retained for investigation but can be spoofed
            # unless the hosting proxy is configured to overwrite them.
            "reportedForwardedIps": forwarded_ips,
            "forwardedIpsVerified": False,
            "userAgent": cls._clean_text(request.headers.get("user-agent"), 512) or None,
            "vpnStatus": "unknown",
            "suspiciousStatus": suspicious_status,
        }
        return event

    @staticmethod
    def _allow_unauthenticated_event(event: dict) -> bool:
        # Keep an unauthenticated scan from turning logging into an unbounded
        # Firestore write surface. Authenticated app activity remains complete.
        peer_ip = event.get("peerIp") or "unknown"
        now = monotonic()
        with _event_window_lock:
            expired = [
                key for key, timestamps in _unauthenticated_event_windows.items()
                if not timestamps or now - timestamps[-1] > 60
            ]
            for key in expired:
                _unauthenticated_event_windows.pop(key, None)
            if len(_unauthenticated_event_windows) >= 4096 and peer_ip not in _unauthenticated_event_windows:
                return False
            timestamps = _unauthenticated_event_windows.setdefault(peer_ip, deque())
            while timestamps and now - timestamps[0] > 60:
                timestamps.popleft()
            if len(timestamps) >= 30:
                return False
            timestamps.append(now)
            return True

    @classmethod
    def write_event(cls, event: dict) -> None:
        if not event.get("authenticated") and not cls._allow_unauthenticated_event(event):
            return
        if not db:
            logger.warning("Security event could not be persisted: Firestore is unavailable")
            return
        try:
            db.collection(cls.COLLECTION).add(event)
        except Exception:
            # Logging must not turn a successful application request into a failure.
            logger.exception("Could not persist a security event")

    @classmethod
    def recent_events(cls, limit: int = 150) -> list[dict]:
        if not db:
            raise ServiceUnavailableException("Security log storage is not configured")
        try:
            from google.cloud.firestore_v1 import Query

            documents = db.collection(cls.COLLECTION).order_by(
                "createdAt", direction=Query.DESCENDING
            ).limit(limit).stream()
            return [{"id": document.id, **document.to_dict()} for document in documents]
        except ServiceUnavailableException:
            raise
        except Exception as error:
            logger.exception("Could not read security events")
            raise ServiceUnavailableException("Security logs are temporarily unavailable") from error
