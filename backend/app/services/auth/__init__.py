"""
Auth Service Package
"""
from .router import router
from .service import auth_service
from .schemas import (
    RegisterRequest, LoginRequest, GoogleAuthRequest,
     ForgotPasswordRequest, ResetPasswordRequest,
    TokenResponse, UserResponse, AuthResponse
)

__all__ = [
    'router',
    'auth_service',
    'RegisterRequest',
    'LoginRequest',
    'GoogleAuthRequest', 
    'VerifyEmailRequest',
    'ForgotPasswordRequest',
    'ResetPasswordRequest',
    'TokenResponse',
    'UserResponse',
    'AuthResponse'
]
