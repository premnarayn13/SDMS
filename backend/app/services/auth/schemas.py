"""
Auth Service Schemas
Request and response models for authentication
"""
from pydantic import BaseModel, EmailStr, Field, validator
from typing import Optional
from datetime import datetime
import os

# Check if demo mode is enabled
DEMO_MODE = os.getenv("DEMO_MODE", "true").lower() == "true"


# ==================== REQUEST SCHEMAS ====================

class RegisterRequest(BaseModel):
    """User registration request"""
    email: EmailStr
    password: str = Field(..., min_length=6)
    name: Optional[str] = None
    
    @validator('password')
    def validate_password(cls, v):
        if len(v) < 6:
            raise ValueError('Password must be at least 6 characters')
        # Skip complex validation in demo mode
        if not DEMO_MODE:
            if not any(c.isupper() for c in v):
                raise ValueError('Password must contain at least one uppercase letter')
            if not any(c.islower() for c in v):
                raise ValueError('Password must contain at least one lowercase letter')
            if not any(c.isdigit() for c in v):
                raise ValueError('Password must contain at least one digit')
        return v


class LoginRequest(BaseModel):
    """User login request"""
    email: EmailStr
    password: str


class GoogleAuthRequest(BaseModel):
    """Google OAuth login/register request"""
    code: str  # Authorization code from Google





class ForgotPasswordRequest(BaseModel):
    """Forgot password request"""
    email: EmailStr


class ResetPasswordRequest(BaseModel):
    """Reset password request"""
    email: EmailStr
    otp: str = Field(..., min_length=6, max_length=6)
    new_password: str = Field(..., min_length=6)
    
    @validator('new_password')
    def validate_password(cls, v):
        if len(v) < 6:
            raise ValueError('Password must be at least 6 characters')
        # Skip complex validation in demo mode
        if not DEMO_MODE:
            if not any(c.isupper() for c in v):
                raise ValueError('Password must contain at least one uppercase letter')
            if not any(c.islower() for c in v):
                raise ValueError('Password must contain at least one lowercase letter')
            if not any(c.isdigit() for c in v):
                raise ValueError('Password must contain at least one digit')
        return v


class RefreshTokenRequest(BaseModel):
    """Token refresh request"""
    refresh_token: str


class ChangePasswordRequest(BaseModel):
    """Change password request"""
    current_password: str
    new_password: str = Field(..., min_length=8)
    
    @validator('new_password')
    def validate_password(cls, v):
        if len(v) < 8:
            raise ValueError('Password must be at least 8 characters')
        if not any(c.isupper() for c in v):
            raise ValueError('Password must contain at least one uppercase letter')
        if not any(c.islower() for c in v):
            raise ValueError('Password must contain at least one lowercase letter')
        if not any(c.isdigit() for c in v):
            raise ValueError('Password must contain at least one digit')
        return v


# ==================== RESPONSE SCHEMAS ====================

class TokenResponse(BaseModel):
    """Token pair response"""
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    expires_in: int


class UserResponse(BaseModel):
    """User information response"""
    id: str
    email: str
    name: Optional[str] = None
    avatar_url: Optional[str] = None
    auth_provider: str
    email_verified: bool
    account_status: str
    mfa_enabled: bool
    created_at: datetime
    
    class Config:
        from_attributes = True


class AuthResponse(BaseModel):
    """Full authentication response"""
    user: UserResponse
    tokens: TokenResponse


class MessageResponse(BaseModel):
    """Simple message response"""
    message: str
    success: bool = True


class SessionInfo(BaseModel):
    """Session information"""
    id: str
    device_info: Optional[dict] = None
    ip_address: Optional[str] = None
    created_at: datetime
    expires_at: datetime
    is_current: bool = False


class SessionsResponse(BaseModel):
    """List of active sessions"""
    sessions: list[SessionInfo]
    total: int
