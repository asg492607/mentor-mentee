from datetime import datetime
from uuid import uuid4

def get_timestamp() -> str:
    return datetime.utcnow().isoformat()

def generate_id() -> str:
    return str(uuid4())

def parse_date(date_str: str) -> datetime:
    return datetime.fromisoformat(date_str.replace('Z', '+00:00'))
