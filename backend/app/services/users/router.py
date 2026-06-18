"""
User Router
API endpoints for user management
"""
from fastapi import APIRouter, HTTPException, status, Depends
import logging

from .schemas import (
    UserProfileUpdate, UserPreferencesUpdate, UserPreferencesResponse,
    UserProfileResponse, DeleteAccountRequest, DeleteAccountOTPRequest
)
from .service import user_service
from ...middleware import get_current_user
from ..auth.schemas import MessageResponse

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/users", tags=["Users"])


@router.get("/me", response_model=UserProfileResponse)
async def get_profile(user: dict = Depends(get_current_user)):
    """Get current user's full profile"""
    try:
        profile = await user_service.get_user_profile(user["id"])
        
        return UserProfileResponse(
            id=str(profile["id"]),
            email=profile["email"],
            name=profile.get("name"),
            avatar_url=profile.get("avatar_url"),
            auth_provider=profile.get("auth_provider", "email"),
            email_verified=profile.get("email_verified", True),
            account_status=profile.get("account_status", "active"),
            mfa_enabled=profile.get("mfa_enabled", False),
            created_at=profile["created_at"],
            updated_at=profile["updated_at"],
            preferences=UserPreferencesResponse(**profile["preferences"]) if profile.get("preferences") else None,
            has_linked_drive=profile.get("has_linked_drive", False)
        )
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))


@router.put("/me", response_model=UserProfileResponse)
async def update_profile(
    data: UserProfileUpdate,
    user: dict = Depends(get_current_user)
):
    """Update current user's profile"""
    try:
        profile = await user_service.update_profile(user["id"], data.dict(exclude_unset=True))
        
        return UserProfileResponse(
            id=str(profile["id"]),
            email=profile["email"],
            name=profile.get("name"),
            avatar_url=profile.get("avatar_url"),
            auth_provider=profile.get("auth_provider", "email"),
            email_verified=profile.get("email_verified", True),
            account_status=profile.get("account_status", "active"),
            mfa_enabled=profile.get("mfa_enabled", False),
            created_at=profile["created_at"],
            updated_at=profile["updated_at"],
            preferences=UserPreferencesResponse(**profile["preferences"]) if profile.get("preferences") else None,
            has_linked_drive=profile.get("has_linked_drive", False)
        )
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.get("/me/preferences", response_model=UserPreferencesResponse)
async def get_preferences(user: dict = Depends(get_current_user)):
    """Get current user's preferences"""
    prefs = await user_service.get_preferences(user["id"])
    return UserPreferencesResponse(**prefs)


@router.put("/me/preferences", response_model=UserPreferencesResponse)
async def update_preferences(
    data: UserPreferencesUpdate,
    user: dict = Depends(get_current_user)
):
    """Update current user's preferences"""
    prefs = await user_service.update_preferences(user["id"], data.dict(exclude_unset=True))
    return UserPreferencesResponse(**prefs)


@router.post("/me/delete-request", response_model=MessageResponse)
async def request_account_deletion(
    data: DeleteAccountOTPRequest,
    user: dict = Depends(get_current_user)
):
    """Request OTP for account deletion"""
    try:
        await user_service.request_account_deletion_otp(user["id"], data.password)
        return MessageResponse(message="Deletion confirmation OTP sent to your email.")
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.delete("/me", response_model=MessageResponse)
async def delete_account(
    data: DeleteAccountRequest,
    user: dict = Depends(get_current_user)
):
    """Delete current user's account (requires OTP)"""
    try:
        await user_service.delete_account(user["id"], data.otp)
        return MessageResponse(message="Account deleted successfully.")
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.get("/me/storage")
async def get_storage_usage(user: dict = Depends(get_current_user)):
    """Get current user's storage usage"""
    usage = await user_service.get_storage_usage(user["id"])
    return usage


@router.get("/me/activity")
async def get_activity_log(
    limit: int = 50,
    offset: int = 0,
    user: dict = Depends(get_current_user)
):
    """Get current user's activity log"""
    activities = await user_service.get_activity_log(user["id"], limit, offset)
    return {"activities": activities, "total": len(activities)}


@router.get("/me/login-history")
async def get_login_history(
    limit: int = 20,
    user: dict = Depends(get_current_user)
):
    """Get current user's login history"""
    history = await user_service.get_login_history(user["id"], limit)
    return {"history": history}
