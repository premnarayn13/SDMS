"""
User Service Schemas
"""
from pydantic import BaseModel, EmailStr
from typing import Optional
from datetime import datetime


class UserProfileUpdate(BaseModel):
    """Update user profile"""
    name: Optional[str] = None
    avatar_url: Optional[str] = None


class UserPreferencesUpdate(BaseModel):
    """Update user preferences"""
    theme: Optional[str] = None
    view_mode: Optional[str] = None
    sort_by: Optional[str] = None
    sort_order: Optional[str] = None
    notifications_enabled: Optional[bool] = None
    email_notifications: Optional[bool] = None
    sidebar_collapsed: Optional[bool] = None
    custom_settings: Optional[dict] = None


class UserPreferencesResponse(BaseModel):
    """User preferences response"""
    theme: str = "light"
    view_mode: str = "grid"
    sort_by: str = "name"
    sort_order: str = "asc"
    notifications_enabled: bool = True
    email_notifications: bool = True
    sidebar_collapsed: bool = False
    custom_settings: dict = {}


class UserProfileResponse(BaseModel):
    """Full user profile response"""
    id: str
    email: str
    name: Optional[str] = None
    avatar_url: Optional[str] = None
    auth_provider: str
    email_verified: bool
    account_status: str
    mfa_enabled: bool
    created_at: datetime
    updated_at: datetime
    preferences: Optional[UserPreferencesResponse] = None
    has_linked_drive: bool = False


class DeleteAccountRequest(BaseModel):
    """Request to delete account"""
    password: Optional[str] = None  # Required for email auth
    otp: str  # Required OTP confirmation


class DeleteAccountOTPRequest(BaseModel):
    """Request OTP for account deletion"""
    password: Optional[str] = None  # Required for email auth
