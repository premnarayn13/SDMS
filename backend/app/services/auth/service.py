"""
Auth Service
Handles all authentication logic
"""
from datetime import datetime, timedelta
from typing import Optional, Tuple
import logging
import httpx
import asyncio

from ...db_supabase import get_service_db
from ...utils.security import password_handler, jwt_handler, token_generator
from ...utils.otp import otp_service
from ...utils.email import email_service
from ...config import settings

logger = logging.getLogger(__name__)


class AuthService:
    """Authentication service handling all auth operations"""
    
    def __init__(self):
        self.db = get_service_db()

    async def _safe_user_lookup_by_email(self, email: str, retries: int = 3) -> dict:
        """Lookup user by email with transient network retry to avoid intermittent login 500s."""
        last_error = None
        for attempt in range(1, retries + 1):
            try:
                result = self.db.table("users").select("*").eq("email", email).execute()
                return result
            except (httpx.HTTPError, OSError) as exc:
                last_error = exc
                if attempt >= retries:
                    break
                await asyncio.sleep(0.35 * attempt)

        raise RuntimeError(f"Temporary authentication backend connectivity issue: {last_error}")
    
    # ==================== REGISTRATION ====================
    
    async def register_user(
        self,
        email: str,
        password: str,
        name: Optional[str] = None
    ) -> Tuple[dict, str]:
        """
        Register a new user with email/password
        Returns: (user_data, otp_code)
        """
        # Check if user already exists
        existing = self.db.table("users").select("id, email_verified").eq("email", email).execute()
        
        if existing.data:
            user = existing.data[0]
            if user.get("email_verified"):
                raise ValueError("Email already registered")
            else:
                # User exists but not verified - resend verification and return success
                # This allows the frontend to redirect to verification page
                self.db.table("users").update({"email_verified": True, "account_status": "active"}).eq("id", user["id"]).execute()
                result = self.db.table("users").select("*").eq("id", user["id"]).execute()
                return result.data[0], ""
        
        # Hash password
        password_hash = password_handler.hash_password(password)
        
        # Create user
        user_data = {
            "email": email,
            "password_hash": password_hash,
            "name": name or email.split("@")[0],
            "auth_provider": "email",
            "email_verified": True,
            "account_status": "active"
        }
        
        result = self.db.table("users").insert(user_data).execute()
        
        if not result.data:
            raise ValueError("Failed to create user")
        
        user = result.data[0]
        
        # Create default preferences
        self.db.table("user_preferences").insert({
            "user_id": user["id"]
        }).execute()
        
        
        
        # Log activity
        self._log_activity(user["id"], "account", None, "registered", {"method": "email"})
        
        logger.info(f"User registered: {email}")
        return user, ""
    
    async def verify_email(self, email: str, otp: str) -> dict:
         return {}
    
    # ==================== LOGIN ====================
    
    async def login(
        self,
        email: str,
        password: str,
        ip_address: Optional[str] = None,
        user_agent: Optional[str] = None
    ) -> Tuple[dict, dict]:
        """
        Login with email/password
        Returns: (user, tokens)
        """
        # Find user
        result = await self._safe_user_lookup_by_email(email)
        
        if not result.data:
            raise ValueError("Invalid email or password")
        
        user = result.data[0]
        
        # Check if account is locked
        if user.get("locked_until"):
            locked_until = datetime.fromisoformat(user["locked_until"].replace("Z", "+00:00"))
            if datetime.utcnow().replace(tzinfo=locked_until.tzinfo) < locked_until:
                remaining = int((locked_until - datetime.utcnow().replace(tzinfo=locked_until.tzinfo)).total_seconds() / 60)
                raise ValueError(f"Account locked. Try again in {remaining} minutes.")
        
        # Check if it's an OAuth user
        if user.get("auth_provider") == "google" and not user.get("password_hash"):
            raise ValueError("Please login with Google")
        
        # Verify password
        password_hash = user.get("password_hash", "")
        logger.info(f"LOGIN DEBUG - Email: {email}")
        logger.info(f"LOGIN DEBUG - Hash from DB: {password_hash}")
        logger.info(f"LOGIN DEBUG - Password length: {len(password)}")
        
        verification_result = password_handler.verify_password(password, password_hash)
        logger.info(f"LOGIN DEBUG - Verification result: {verification_result}")
        
        if not verification_result:
            # Increment failed attempts
            attempts = user.get("login_attempts", 0) + 1
            update_data = {"login_attempts": attempts}
            
            if attempts >= settings.MAX_LOGIN_ATTEMPTS:
                update_data["locked_until"] = (
                    datetime.utcnow() + timedelta(minutes=settings.LOCKOUT_DURATION_MINUTES)
                ).isoformat()
                self.db.table("users").update(update_data).eq("id", user["id"]).execute()
                raise ValueError(f"Account locked due to too many failed attempts. Try again in {settings.LOCKOUT_DURATION_MINUTES} minutes.")
            
            self.db.table("users").update(update_data).eq("id", user["id"]).execute()
            raise ValueError("Invalid email or password")
        
        # Check account status
        if user.get("account_status") == "pending":
            raise ValueError("Please verify your email first")
        if user.get("account_status") == "suspended":
            raise ValueError("Account suspended. Contact support.")
        if user.get("account_status") == "deleted":
            raise ValueError("Account has been deleted")
        
        # Reset login attempts on success
        self.db.table("users").update({
            "login_attempts": 0,
            "locked_until": None
        }).eq("id", user["id"]).execute()
        
        # Generate tokens
        tokens = jwt_handler.create_token_pair(str(user["id"]), user["email"])
        
        # Create session
        await self._create_session(
            user["id"],
            tokens["refresh_token"],
            ip_address,
            user_agent
        )
        
        # Log activity
        self._log_activity(
            user["id"], "account", None, "login",
            {"ip": ip_address, "user_agent": user_agent}
        )
        
        logger.info(f"User logged in: {email}")
        return user, tokens
    
    # ==================== GOOGLE OAUTH ====================
    
    async def get_google_auth_url(self, redirect_uri: Optional[str] = None) -> str:
        """Generate Google OAuth URL"""
        base_url = "https://accounts.google.com/o/oauth2/v2/auth"
        redirect = redirect_uri or settings.GOOGLE_REDIRECT_URI
        
        params = {
            "client_id": settings.GOOGLE_CLIENT_ID,
            "redirect_uri": redirect,
            "response_type": "code",
            "scope": "openid email profile",
            "access_type": "offline",
            "prompt": "consent"
        }
        
        query = "&".join(f"{k}={v}" for k, v in params.items())
        return f"{base_url}?{query}"
    
    async def google_auth_callback(
        self,
        code: str,
        ip_address: Optional[str] = None,
        user_agent: Optional[str] = None
    ) -> Tuple[dict, dict, bool]:
        """
        Handle Google OAuth callback
        Returns: (user, tokens, is_new_user)
        """
        # Exchange code for tokens
        token_url = "https://oauth2.googleapis.com/token"
        
        async with httpx.AsyncClient() as client:
            token_response = await client.post(token_url, data={
                "client_id": settings.GOOGLE_CLIENT_ID,
                "client_secret": settings.GOOGLE_CLIENT_SECRET,
                "code": code,
                "grant_type": "authorization_code",
                "redirect_uri": settings.GOOGLE_REDIRECT_URI
            })
            
            if token_response.status_code != 200:
                raise ValueError("Failed to exchange authorization code")
            
            token_data = token_response.json()
            
            # Get user info
            userinfo_response = await client.get(
                "https://www.googleapis.com/oauth2/v2/userinfo",
                headers={"Authorization": f"Bearer {token_data['access_token']}"}
            )
            
            if userinfo_response.status_code != 200:
                raise ValueError("Failed to get user info from Google")
            
            google_user = userinfo_response.json()
        
        email = google_user.get("email")
        if not email:
            raise ValueError("Email not provided by Google")
        
        # Check if user exists
        result = self.db.table("users").select("*").eq("email", email).execute()
        is_new_user = False
        
        if result.data:
            user = result.data[0]
            # Update user info if needed
            if user.get("auth_provider") == "email":
                # User registered with email, link Google account
                self.db.table("users").update({
                    "auth_provider": "google",
                    "email_verified": True,
                    "account_status": "active",
                    "avatar_url": google_user.get("picture")
                }).eq("id", user["id"]).execute()
        else:
            # Create new user
            is_new_user = True
            user_data = {
                "email": email,
                "name": google_user.get("name", email.split("@")[0]),
                "avatar_url": google_user.get("picture"),
                "auth_provider": "google",
                "email_verified": True,
                "account_status": "active"
            }
            
            result = self.db.table("users").insert(user_data).execute()
            user = result.data[0]
            
            # Create default preferences
            self.db.table("user_preferences").insert({
                "user_id": user["id"]
            }).execute()
            
            self._log_activity(user["id"], "account", None, "registered", {"method": "google"})
        
        # Refresh user data
        result = self.db.table("users").select("*").eq("email", email).execute()
        user = result.data[0]
        
        # Generate tokens
        tokens = jwt_handler.create_token_pair(str(user["id"]), user["email"])
        
        # Create session
        await self._create_session(
            user["id"],
            tokens["refresh_token"],
            ip_address,
            user_agent
        )
        
        # Log activity
        self._log_activity(
            user["id"], "account", None, "login",
            {"method": "google", "ip": ip_address}
        )
        
        logger.info(f"Google auth successful: {email}")
        return user, tokens, is_new_user
    
    # ==================== TOKEN MANAGEMENT ====================
    
    async def refresh_tokens(self, refresh_token: str) -> dict:
        """Refresh access token using refresh token"""
        # Decode refresh token
        payload = jwt_handler.decode_token(refresh_token)
        
        if not payload or payload.get("type") != "refresh":
            raise ValueError("Invalid refresh token")
        
        user_id = payload.get("sub")
        
        # Verify session exists and is valid
        token_hash = jwt_handler.hash_token(refresh_token)
        session = self.db.table("user_sessions").select("*").eq(
            "user_id", user_id
        ).eq(
            "refresh_token_hash", token_hash
        ).eq(
            "is_active", True
        ).execute()
        
        if not session.data:
            raise ValueError("Session not found or revoked")
        
        session = session.data[0]
        
        # Check expiration
        expires_at = datetime.fromisoformat(session["expires_at"].replace("Z", "+00:00"))
        if datetime.utcnow().replace(tzinfo=expires_at.tzinfo) > expires_at:
            raise ValueError("Refresh token expired")
        
        # Get user
        result = self.db.table("users").select("*").eq("id", user_id).execute()
        
        if not result.data:
            raise ValueError("User not found")
        
        user = result.data[0]
        
        if user.get("account_status") != "active":
            raise ValueError(f"Account is {user.get('account_status')}")
        
        # Generate new tokens
        tokens = jwt_handler.create_token_pair(str(user["id"]), user["email"])
        
        # Update session with new refresh token
        self.db.table("user_sessions").update({
            "refresh_token_hash": jwt_handler.hash_token(tokens["refresh_token"]),
            "last_used": datetime.utcnow().isoformat(),
            "expires_at": (
                datetime.utcnow() + timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS)
            ).isoformat()
        }).eq("id", session["id"]).execute()
        
        return tokens
    
    async def logout(self, user_id: str, refresh_token: Optional[str] = None) -> bool:
        """Logout user (revoke session)"""
        if refresh_token:
            # Revoke specific session
            token_hash = jwt_handler.hash_token(refresh_token)
            self.db.table("user_sessions").update({
                "is_active": False
            }).eq(
                "user_id", user_id
            ).eq(
                "refresh_token_hash", token_hash
            ).execute()
        
        self._log_activity(user_id, "account", None, "logout", {})
        return True
    
    async def logout_all(self, user_id: str) -> int:
        """Logout from all devices"""
        result = self.db.table("user_sessions").update({
            "is_active": False
        }).eq(
            "user_id", user_id
        ).eq(
            "is_active", True
        ).execute()
        
        count = len(result.data) if result.data else 0
        
        self._log_activity(user_id, "account", None, "logout_all", {"sessions_revoked": count})
        return count
    
    # ==================== PASSWORD MANAGEMENT ====================
    
    async def forgot_password(self, email: str) -> bool:
        """Initiate password reset"""
        # Find user
        result = self.db.table("users").select("id, auth_provider").eq("email", email).execute()
        
        if not result.data:
            # Don't reveal if email exists
            return True
        
        user = result.data[0]
        
        if user.get("auth_provider") == "google":
            raise ValueError("This account uses Google login. Please login with Google.")
        
        # Generate OTP
        otp = await otp_service.create_otp(email, "password_reset", user["id"])
        await email_service.send_password_reset_otp(email, otp)
        
        return True
    
    async def reset_password(self, email: str, otp: str, new_password: str) -> bool:
        """Reset password with OTP"""
        # Verify OTP
        success, message = await otp_service.verify_otp(email, otp, "password_reset")
        
        if not success:
            raise ValueError(message)
        
        # Update password
        password_hash = password_handler.hash_password(new_password)
        
        result = self.db.table("users").update({
            "password_hash": password_hash,
            "login_attempts": 0,
            "locked_until": None
        }).eq("email", email).execute()
        
        if not result.data:
            raise ValueError("User not found")
        
        user = result.data[0]
        
        # Revoke all sessions
        await self.logout_all(user["id"])
        
        self._log_activity(user["id"], "account", None, "password_reset", {})
        
        return True
    
    async def change_password(
        self,
        user_id: str,
        current_password: str,
        new_password: str
    ) -> bool:
        """Change password for authenticated user"""
        # Get user
        result = self.db.table("users").select("*").eq("id", user_id).execute()
        
        if not result.data:
            raise ValueError("User not found")
        
        user = result.data[0]
        
        if user.get("auth_provider") == "google" and not user.get("password_hash"):
            raise ValueError("This account uses Google login")
        
        # Verify current password
        if not password_handler.verify_password(current_password, user.get("password_hash", "")):
            raise ValueError("Current password is incorrect")
        
        # Update password
        password_hash = password_handler.hash_password(new_password)
        
        self.db.table("users").update({
            "password_hash": password_hash
        }).eq("id", user_id).execute()
        
        self._log_activity(user_id, "account", None, "password_changed", {})
        
        return True
    
    # ==================== SESSION MANAGEMENT ====================
    
    async def _create_session(
        self,
        user_id: str,
        refresh_token: str,
        ip_address: Optional[str] = None,
        user_agent: Optional[str] = None
    ) -> dict:
        """Create a new auth session"""
        session_data = {
            "user_id": user_id,
            "refresh_token_hash": jwt_handler.hash_token(refresh_token),
            "ip_address": ip_address,
            "user_agent": user_agent,
            "device_info": self._parse_user_agent(user_agent),
            "expires_at": (
                datetime.utcnow() + timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS)
            ).isoformat()
        }
        
        result = self.db.table("user_sessions").insert(session_data).execute()
        return result.data[0] if result.data else None
    
    async def get_user_sessions(self, user_id: str, current_token_hash: Optional[str] = None) -> list:
        """Get all active sessions for a user"""
        result = self.db.table("user_sessions").select("*").eq(
            "user_id", user_id
        ).eq(
            "is_active", True
        ).gt(
            "expires_at", datetime.utcnow().isoformat()
        ).order("created_at", desc=True).execute()
        
        sessions = result.data or []
        
        # Mark current session
        for session in sessions:
            session["is_current"] = session.get("refresh_token_hash") == current_token_hash
        
        return sessions
    
    async def revoke_session(self, user_id: str, session_id: str) -> bool:
        """Revoke a specific session"""
        self.db.table("user_sessions").update({
            "is_active": False
        }).eq(
            "id", session_id
        ).eq(
            "user_id", user_id
        ).execute()
        
        return True
    
    # ==================== HELPERS ====================
    
    def _parse_user_agent(self, user_agent: Optional[str]) -> dict:
        """Parse user agent string into device info"""
        if not user_agent:
            return {"device": "Unknown", "browser": "Unknown", "os": "Unknown"}
        
        device = "Desktop"
        browser = "Unknown"
        os_name = "Unknown"
        
        # Simple parsing
        ua_lower = user_agent.lower()
        
        if "mobile" in ua_lower or "android" in ua_lower or "iphone" in ua_lower:
            device = "Mobile"
        elif "tablet" in ua_lower or "ipad" in ua_lower:
            device = "Tablet"
        
        if "chrome" in ua_lower:
            browser = "Chrome"
        elif "firefox" in ua_lower:
            browser = "Firefox"
        elif "safari" in ua_lower:
            browser = "Safari"
        elif "edge" in ua_lower:
            browser = "Edge"
        
        if "windows" in ua_lower:
            os_name = "Windows"
        elif "mac" in ua_lower:
            os_name = "macOS"
        elif "linux" in ua_lower:
            os_name = "Linux"
        elif "android" in ua_lower:
            os_name = "Android"
        elif "ios" in ua_lower or "iphone" in ua_lower or "ipad" in ua_lower:
            os_name = "iOS"
        
        return {"device": device, "browser": browser, "os": os_name}
    
    def _log_activity(
        self,
        user_id: str,
        entity_type: str,
        entity_id: Optional[str],
        action: str,
        details: dict,
        ip_address: Optional[str] = None
    ):
        """Log user activity"""
        try:
            self.db.table("activity_log").insert({
                "user_id": user_id,
                "entity_type": entity_type,
                "entity_id": entity_id,
                "action": action,
                "details": details,
                "ip_address": ip_address
            }).execute()
        except Exception as e:
            logger.error(f"Failed to log activity: {e}")


# Singleton instance
auth_service = AuthService()
