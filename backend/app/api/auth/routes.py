from fastapi import APIRouter, Depends
from app.schemas.auth import RegisterRequest, UserProfileResponse
from app.services.auth_service import AuthService
from app.core.dependencies import get_current_user

router = APIRouter(prefix="/auth", tags=["Auth"])

@router.post("/register")
def register(data: RegisterRequest, auth_service: AuthService = Depends()):
    return auth_service.register_user(data)

@router.post("/verify-token")
def verify_token(user = Depends(get_current_user)):
    return {"status": "valid", "user": user}

@router.get("/me")
def get_me(user = Depends(get_current_user), auth_service: AuthService = Depends()):
    return auth_service.get_user_profile(user['uid'])
