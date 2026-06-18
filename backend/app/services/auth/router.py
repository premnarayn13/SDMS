"""
Auth Router
API endpoints for authentication
"""
from fastapi import APIRouter, HTTPException, status, Depends, Request, Response
from fastapi.responses import RedirectResponse
from typing import Optional
import logging

from .schemas import (
    RegisterRequest, LoginRequest, GoogleAuthRequest,
    ForgotPasswordRequest, ResetPasswordRequest,
    RefreshTokenRequest, ChangePasswordRequest,
    TokenResponse, UserResponse, AuthResponse, MessageResponse,
    SessionInfo, SessionsResponse
)
from ...config import settings

# Use demo service if DEMO_MODE is enabled
if settings.DEMO_MODE:
    from .demo_service import demo_auth_service as auth_service
else:
    from .service import auth_service

from ...middleware import get_current_user, get_client_ip, get_user_agent, auth_rate_limit

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/auth", tags=["Authentication"])


def _build_auth_response(user: dict, tokens: dict) -> AuthResponse:
    return AuthResponse(
        user=UserResponse(
            id=str(user["id"]),
            email=user["email"],
            name=user.get("name"),
            avatar_url=user.get("avatar_url"),
            auth_provider=user.get("auth_provider", "email"),
            email_verified=user.get("email_verified", True),
            account_status=user.get("account_status", "active"),
            mfa_enabled=user.get("mfa_enabled", False),
            created_at=user["created_at"]
        ),
        tokens=TokenResponse(**tokens)
    )


async def _development_login_fallback(
    email: str,
    password: str,
    ip: Optional[str],
    ua: Optional[str],
) -> Optional[AuthResponse]:
    """Fallback login path for local development when remote auth backend is unavailable."""
    if str(settings.ENVIRONMENT).lower() != "development":
        return None

    try:
        from .demo_service import demo_auth_service, DEMO_OTP_CODE

        try:
            user, tokens = await demo_auth_service.login(
                email=email,
                password=password,
                ip_address=ip,
                user_agent=ua,
            )
            logger.warning("Primary auth backend unavailable; used demo fallback for user %s", email)
            return _build_auth_response(user, tokens)
        except ValueError as login_error:
            message = str(login_error).lower()

            if "verify your email" in message:
                await demo_auth_service.verify_email(email, DEMO_OTP_CODE)
                user, tokens = await demo_auth_service.login(
                    email=email,
                    password=password,
                    ip_address=ip,
                    user_agent=ua,
                )
                logger.warning("Primary auth backend unavailable; verified and used demo fallback for user %s", email)
                return _build_auth_response(user, tokens)

            if "invalid email or password" in message:
                await demo_auth_service.register_user(
                    email=email,
                    password=password,
                    name=email.split("@")[0] if "@" in email else email,
                )
                await demo_auth_service.verify_email(email, DEMO_OTP_CODE)
                user, tokens = await demo_auth_service.login(
                    email=email,
                    password=password,
                    ip_address=ip,
                    user_agent=ua,
                )
                logger.warning("Primary auth backend unavailable; auto-provisioned demo fallback for user %s", email)
                return _build_auth_response(user, tokens)

            raise
    except Exception as fallback_error:
        logger.error("Development login fallback failed: %s", fallback_error)
        return None


# ==================== REGISTRATION ====================

@router.post("/register", response_model=MessageResponse, status_code=status.HTTP_201_CREATED)
async def register(
    request: Request,
    data: RegisterRequest
):
    """
    Register a new user with email and password.
    Sends verification OTP to email.
    """
    await auth_rate_limit(request)
    
    try:
        user, otp = await auth_service.register_user(
            email=data.email,
            password=data.password,
            name=data.name
        )
        
        return MessageResponse(
            message="Registration successful",
            success=True
        )
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except Exception as e:
        import traceback
        logger.error(f"Registration error: {e}\n{traceback.format_exc()}")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Registration failed: {str(e)}")


# ==================== LOGIN ====================

@router.post("/login", response_model=AuthResponse)
async def login(
    request: Request,
    data: LoginRequest
):
    """
    Login with email and password.
    Returns access and refresh tokens.
    """
    await auth_rate_limit(request)
    
    ip = get_client_ip(request)
    ua = get_user_agent(request)
    
    try:
        user, tokens = await auth_service.login(
            email=data.email,
            password=data.password,
            ip_address=ip,
            user_agent=ua
        )

        return _build_auth_response(user, tokens)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=str(e))
    except RuntimeError as e:
        fallback_response = await _development_login_fallback(data.email, data.password, ip, ua)
        if fallback_response is not None:
            return fallback_response

        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Login temporarily unavailable. Please retry in a few seconds."
        ) from e


# ==================== GOOGLE OAUTH ====================

@router.get("/google")
async def google_auth():
    """
    Initiate Google OAuth flow.
    Redirects to Google consent page.
    """
    auth_url = await auth_service.get_google_auth_url()
    return RedirectResponse(url=auth_url)


@router.get("/google/callback")
async def google_callback(
    request: Request,
    code: str,
    error: Optional[str] = None
):
    """
    Handle Google OAuth callback.
    Redirects to frontend with tokens.
    """
    if error:
        return RedirectResponse(
            url=f"{settings.FRONTEND_URL}/login?error={error}"
        )
    
    ip = get_client_ip(request)
    ua = get_user_agent(request)
    
    try:
        user, tokens, is_new = await auth_service.google_auth_callback(
            code=code,
            ip_address=ip,
            user_agent=ua
        )
        
        # Redirect to frontend with tokens
        redirect_url = (
            f"{settings.FRONTEND_URL}/auth/google/callback"
            f"?access_token={tokens['access_token']}"
            f"&refresh_token={tokens['refresh_token']}"
            f"&is_new={str(is_new).lower()}"
        )
        
        return RedirectResponse(url=redirect_url)
    except ValueError as e:
        return RedirectResponse(
            url=f"{settings.FRONTEND_URL}/login?error={str(e)}"
        )


@router.post("/google/token", response_model=AuthResponse)
async def google_token_auth(
    request: Request,
    data: GoogleAuthRequest
):
    """
    Exchange Google auth code for tokens (for SPA flows).
    """
    ip = get_client_ip(request)
    ua = get_user_agent(request)
    
    try:
        user, tokens, is_new = await auth_service.google_auth_callback(
            code=data.code,
            ip_address=ip,
            user_agent=ua
        )
        
        return AuthResponse(
            user=UserResponse(
                id=str(user["id"]),
                email=user["email"],
                name=user.get("name"),
                avatar_url=user.get("avatar_url"),
                auth_provider=user.get("auth_provider", "google"),
                email_verified=user.get("email_verified", True),
                account_status=user.get("account_status", "active"),
                mfa_enabled=user.get("mfa_enabled", False),
                created_at=user["created_at"]
            ),
            tokens=TokenResponse(**tokens)
        )
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


# ==================== TOKEN MANAGEMENT ====================

@router.post("/refresh", response_model=TokenResponse)
async def refresh_token(data: RefreshTokenRequest):
    """
    Refresh access token using refresh token.
    """
    try:
        tokens = await auth_service.refresh_tokens(data.refresh_token)
        return TokenResponse(**tokens)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=str(e))


@router.post("/logout", response_model=MessageResponse)
async def logout(
    user: dict = Depends(get_current_user),
    data: Optional[RefreshTokenRequest] = None
):
    """
    Logout from current session.
    """
    refresh_token = data.refresh_token if data else None
    await auth_service.logout(user["id"], refresh_token)
    return MessageResponse(message="Logged out successfully")


@router.post("/logout-all", response_model=MessageResponse)
async def logout_all(user: dict = Depends(get_current_user)):
    """
    Logout from all devices/sessions.
    """
    count = await auth_service.logout_all(user["id"])
    return MessageResponse(message=f"Logged out from {count} sessions")


# ==================== PASSWORD MANAGEMENT ====================

@router.post("/forgot-password", response_model=MessageResponse)
async def forgot_password(
    request: Request,
    data: ForgotPasswordRequest
):
    """
    Request password reset OTP.
    """
    await auth_rate_limit(request)
    
    try:
        await auth_service.forgot_password(data.email)
        return MessageResponse(message="Password reset OTP sent if account exists.")
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.post("/reset-password", response_model=MessageResponse)
async def reset_password(
    request: Request,
    data: ResetPasswordRequest
):
    """
    Reset password with OTP.
    """
    await auth_rate_limit(request)
    
    try:
        await auth_service.reset_password(data.email, data.otp, data.new_password)
        return MessageResponse(message="Password reset successful. Please login with your new password.")
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.post("/change-password", response_model=MessageResponse)
async def change_password(
    data: ChangePasswordRequest,
    user: dict = Depends(get_current_user)
):
    """
    Change password for authenticated user.
    """
    try:
        await auth_service.change_password(
            user["id"],
            data.current_password,
            data.new_password
        )
        return MessageResponse(message="Password changed successfully")
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


# ==================== SESSION MANAGEMENT ====================

@router.get("/sessions", response_model=SessionsResponse)
async def get_sessions(user: dict = Depends(get_current_user)):
    """
    Get all active sessions for current user.
    """
    sessions = await auth_service.get_user_sessions(user["id"])
    
    return SessionsResponse(
        sessions=[
            SessionInfo(
                id=str(s["id"]),
                device_info=s.get("device_info"),
                ip_address=s.get("ip_address"),
                created_at=s["created_at"],
                expires_at=s["expires_at"],
                is_current=s.get("is_current", False)
            )
            for s in sessions
        ],
        total=len(sessions)
    )


@router.delete("/sessions/{session_id}", response_model=MessageResponse)
async def revoke_session(
    session_id: str,
    user: dict = Depends(get_current_user)
):
    """
    Revoke a specific session.
    """
    await auth_service.revoke_session(user["id"], session_id)
    return MessageResponse(message="Session revoked")


# ==================== USER INFO ====================

@router.get("/me", response_model=UserResponse)
async def get_current_user_info(user: dict = Depends(get_current_user)):
    """
    Get current authenticated user info.
    """
    return UserResponse(
        id=str(user["id"]),
        email=user["email"],
        name=user.get("name"),
        avatar_url=user.get("avatar_url"),
        auth_provider=user.get("auth_provider", "email"),
        email_verified=user.get("email_verified", True),
        account_status=user.get("account_status", "active"),
        mfa_enabled=user.get("mfa_enabled", False),
        created_at=user["created_at"]
    )
