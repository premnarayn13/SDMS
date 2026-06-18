"""
Authentication Middleware
JWT validation and user extraction
"""
from fastapi import Request, HTTPException, status, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from typing import Optional
import logging

from ..utils.security import jwt_handler
from ..config import settings

logger = logging.getLogger(__name__)

security = HTTPBearer(auto_error=False)


def get_user_store():
    """Get the appropriate user store based on mode"""
    if settings.DEMO_MODE:
        from ..services.auth.demo_service import DEMO_USERS
        return DEMO_USERS
    else:
        from ..db_supabase import get_service_db
        return get_service_db()


class AuthMiddleware:
    """Authentication middleware for protected routes"""
    
    @staticmethod
    async def get_current_user(
        credentials: HTTPAuthorizationCredentials = Depends(security)
    ) -> dict:
        """Get current authenticated user from JWT token"""
        if not credentials:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Authentication required",
                headers={"WWW-Authenticate": "Bearer"}
            )
        
        token = credentials.credentials
        payload = jwt_handler.decode_token(token)
        
        if not payload:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid or expired token",
                headers={"WWW-Authenticate": "Bearer"}
            )
        
        if payload.get("type") != "access":
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid token type",
                headers={"WWW-Authenticate": "Bearer"}
            )
        
        user_id = payload.get("sub")
        if not user_id:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid token payload",
                headers={"WWW-Authenticate": "Bearer"}
            )
        
        # Fetch user from storage
        if settings.DEMO_MODE:
            from ..services.auth.demo_service import DEMO_USERS
            user = None
            for u in DEMO_USERS.values():
                if u["id"] == user_id:
                    user = u
                    break
            if not user:
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="User not found",
                    headers={"WWW-Authenticate": "Bearer"}
                )
        else:
            from ..db_supabase import get_service_db
            db = get_service_db()
            try:
                result = db.table("users").select("*").eq("id", user_id).execute()

                if not result.data:
                    raise HTTPException(
                        status_code=status.HTTP_401_UNAUTHORIZED,
                        detail="User not found",
                        headers={"WWW-Authenticate": "Bearer"}
                    )

                user = result.data[0]
            except HTTPException:
                raise
            except Exception as e:
                logger.warning(
                    "Falling back to token-derived user due to user store error: %s",
                    e
                )
                user = {
                    "id": user_id,
                    "email": payload.get("email", "offline@docmatrix.local"),
                    "name": "Offline User",
                    "email_verified": True,
                    "account_status": "active",
                    "auth_provider": "email"
                }
        
        # Check account status
        if user.get("account_status") != "active":
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Account is {user.get('account_status')}"
            )
        
        return user
    
    @staticmethod
    async def get_current_user_optional(
        credentials: HTTPAuthorizationCredentials = Depends(security)
    ) -> Optional[dict]:
        """Get current user if authenticated, None otherwise"""
        if not credentials:
            return None
        
        try:
            return await AuthMiddleware.get_current_user(credentials)
        except HTTPException:
            return None
    
    @staticmethod
    async def verify_email_verified(
        user: dict = Depends(get_current_user)
    ) -> dict:
        """Ensure user has verified email"""
        if not user.get("email_verified"):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Email verification required"
            )
        return user


# Dependency functions
async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security)
) -> dict:
    """Dependency for getting current user"""
    return await AuthMiddleware.get_current_user(credentials)


async def get_current_user_optional(
    credentials: HTTPAuthorizationCredentials = Depends(security)
) -> Optional[dict]:
    """Dependency for optionally getting current user"""
    return await AuthMiddleware.get_current_user_optional(credentials)


async def get_verified_user(
    credentials: HTTPAuthorizationCredentials = Depends(security)
) -> dict:
    """Dependency for getting verified user"""
    user = await AuthMiddleware.get_current_user(credentials)
    return await AuthMiddleware.verify_email_verified(user)


def get_client_ip(request: Request) -> str:
    """Extract client IP from request"""
    forwarded = request.headers.get("X-Forwarded-For")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.client.host if request.client else "unknown"


def get_user_agent(request: Request) -> str:
    """Extract user agent from request"""
    return request.headers.get("User-Agent", "unknown")
