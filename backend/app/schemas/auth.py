from pydantic import BaseModel
from typing import Optional
from app.models.enums import UserRole
from datetime import datetime

class RegisterRequest(BaseModel):
    email: str
    password: str
    name: str
    role: UserRole
    department: Optional[str] = None
    year: Optional[int] = None
    rollNumber: Optional[str] = None

class UserProfileResponse(BaseModel):
    uid: str
    email: str
    name: str
    role: UserRole
    department: Optional[str] = None
    createdAt: datetime

class TokenResponse(BaseModel):
    token: str
    user: UserProfileResponse
