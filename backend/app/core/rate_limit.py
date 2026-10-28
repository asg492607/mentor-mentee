"""Small process-local sliding-window limiter for low-volume public endpoints."""

from collections import deque
from threading import Lock
from time import monotonic

from fastapi import HTTPException

_windows: dict[tuple[str, str, str], tuple[float, deque[float]]] = {}
_lock = Lock()
_MAX_BUCKETS = 20_000
_last_capacity_sweep = 0.0


def enforce_rate_limit(
    namespace: str,
    key: str,
    action: str,
    maximum: int,
    seconds: int,
    detail: str,
) -> None:
    global _last_capacity_sweep
    now = monotonic()
    bucket_key = (namespace, key, action)
    with _lock:
        bucket = _windows.get(bucket_key)
        if bucket is None:
            if len(_windows) >= _MAX_BUCKETS and now - _last_capacity_sweep >= 30:
                expired = [
                    item_key for item_key, (window, timestamps) in _windows.items()
                    if not timestamps or now - timestamps[-1] > window
                ]
                for item_key in expired:
                    _windows.pop(item_key, None)
                _last_capacity_sweep = now
            if len(_windows) >= _MAX_BUCKETS:
                raise HTTPException(status_code=429, detail="Too many requests. Please try again shortly.")
            timestamps: deque[float] = deque()
            bucket = (float(seconds), timestamps)
            _windows[bucket_key] = bucket

        window, timestamps = bucket
        while timestamps and now - timestamps[0] > window:
            timestamps.popleft()
        if len(timestamps) >= maximum:
            raise HTTPException(status_code=429, detail=detail)
        timestamps.append(now)
