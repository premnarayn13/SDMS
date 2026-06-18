"""
Demo Auth Service
In-memory authentication for testing without Supabase
"""
from datetime import datetime, timedelta
from typing import Optional, Tuple, Dict
import logging
import uuid
import hashlib

from ...utils.security import jwt_handler
from ...config import settings
logger = logging.getLogger(__name__)

# In-memory storage for demo mode
DEMO_USERS: Dict[str, dict] = {}
DEMO_OTPS: Dict[str, dict] = {}
DEMO_SESSIONS: Dict[str, dict] = {}

# Default demo OTP
DEMO_OTP_CODE = "123456"


def simple_hash(password: str) -> str:
    """Simple password hash for demo mode"""
    return hashlib.sha256(password.encode()).hexdigest()


def verify_simple_hash(password: str, hashed: str) -> bool:
    """Verify simple password hash"""
    return simple_hash(password) == hashed


class DemoAuthService:
    """Demo authentication service using in-memory storage"""
    
    # ==================== REGISTRATION ====================
    
    async def register_user(
        self,
        email: str,
        password: str,
        name: Optional[str] = None
    ) -> Tuple[dict, str]:
        """Register a new user"""
        # Check if user already exists
        if email in DEMO_USERS:
            user = DEMO_USERS[email]
            if user.get("email_verified"):
                raise ValueError("Email already registered")
            else:
                # Resend OTP and return success (allows redirect to verification page)
                otp = DEMO_OTP_CODE
                DEMO_OTPS[email] = {
                    "otp": otp,
                    "purpose": "email_verification",
                    "expires_at": datetime.utcnow() + timedelta(minutes=10)
                }
                return user, otp
        
        # Create user
        user_id = str(uuid.uuid4())
        user_data = {
            "id": user_id,
            "email": email,
            "password_hash": simple_hash(password),
            "name": name or email.split("@")[0],
            "auth_provider": "email",
            "email_verified": False,
            "account_status": "active",
            "created_at": datetime.utcnow().isoformat(),
            "login_attempts": 0
        }
        
        DEMO_USERS[email] = user_data
        
        # Generate OTP (always 123456 in demo mode)
        otp = DEMO_OTP_CODE
        DEMO_OTPS[email] = {
            "otp": otp,
            "purpose": "email_verification",
            "expires_at": datetime.utcnow() + timedelta(minutes=10)
        }
        
        logger.info(f"[DEMO] User registered: {email} - OTP: {otp}")
        print(f"\n{'='*50}")
        print(f"📧 DEMO MODE - Email Verification")
        print(f"{'='*50}")
        print(f"To: {email}")
        print(f"OTP Code: {otp}")
        print(f"{'='*50}\n")
        
        return user_data, otp
    
    async def verify_email(self, email: str, otp: str) -> dict:
        """Verify user's email with OTP"""
        # Check if OTP matches (accept 123456 in demo mode)
        if otp != DEMO_OTP_CODE:
            stored = DEMO_OTPS.get(email, {})
            if stored.get("otp") != otp:
                raise ValueError("Invalid OTP. In demo mode, use: 123456")
        
        # Check if user exists
        if email not in DEMO_USERS:
            raise ValueError("User not found")
        
        # Update user
        DEMO_USERS[email]["email_verified"] = True
        DEMO_USERS[email]["account_status"] = "active"
        
        # Clear OTP
        DEMO_OTPS.pop(email, None)
        
        logger.info(f"[DEMO] Email verified: {email}")
        return DEMO_USERS[email]
    
    async def resend_verification(self, email: str) -> bool:
        """Resend verification email"""
        if email not in DEMO_USERS:
            return True  # Don't reveal if email exists
        
        user = DEMO_USERS[email]
        if user.get("email_verified"):
            raise ValueError("Email already verified")
        
        otp = DEMO_OTP_CODE
        DEMO_OTPS[email] = {
            "otp": otp,
            "purpose": "email_verification",
            "expires_at": datetime.utcnow() + timedelta(minutes=10)
        }
        
        print(f"\n[DEMO] Verification OTP for {email}: {otp}\n")
        return True
    
    # ==================== LOGIN ====================
    
    async def login(
        self,
        email: str,
        password: str,
        ip_address: Optional[str] = None,
        user_agent: Optional[str] = None
    ) -> Tuple[dict, dict]:
        """Login with email/password"""
        # Find user
        if email not in DEMO_USERS:
            raise ValueError("Invalid email or password")
        
        user = DEMO_USERS[email]
        
        # Check account status
        if user.get("account_status") == "pending":
            raise ValueError("Please verify your email first. Use OTP: 123456")
        
        # Verify password
        if not verify_simple_hash(password, user.get("password_hash", "")):
            raise ValueError("Invalid email or password")
        
        # Generate tokens
        tokens = jwt_handler.create_token_pair(str(user["id"]), user["email"])
        
        # Create session
        session_id = str(uuid.uuid4())
        DEMO_SESSIONS[session_id] = {
            "user_id": user["id"],
            "refresh_token": tokens["refresh_token"],
            "ip_address": ip_address,
            "user_agent": user_agent,
            "created_at": datetime.utcnow().isoformat()
        }
        
        logger.info(f"[DEMO] User logged in: {email}")
        return user, tokens
    
    async def logout(self, user_id: str, refresh_token: Optional[str] = None) -> bool:
        """Logout user"""
        # Remove sessions for this user
        to_remove = [sid for sid, sess in DEMO_SESSIONS.items() if sess["user_id"] == user_id]
        for sid in to_remove:
            del DEMO_SESSIONS[sid]
        
        logger.info(f"[DEMO] User logged out: {user_id}")
        return True
    
    async def logout_all(self, user_id: str) -> int:
        """Logout from all devices"""
        count = 0
        to_remove = [sid for sid, sess in DEMO_SESSIONS.items() if sess["user_id"] == user_id]
        for sid in to_remove:
            del DEMO_SESSIONS[sid]
            count += 1
        return count
    
    # ==================== PASSWORD ====================
    
    async def forgot_password(self, email: str) -> bool:
        """Initiate password reset"""
        if email not in DEMO_USERS:
            return True  # Don't reveal if email exists
        
        otp = DEMO_OTP_CODE
        DEMO_OTPS[email] = {
            "otp": otp,
            "purpose": "password_reset",
            "expires_at": datetime.utcnow() + timedelta(minutes=10)
        }
        
        print(f"\n[DEMO] Password reset OTP for {email}: {otp}\n")
        return True
    
    async def reset_password(self, email: str, otp: str, new_password: str) -> bool:
        """Reset password with OTP"""
        if otp != DEMO_OTP_CODE:
            raise ValueError("Invalid OTP. In demo mode, use: 123456")
        
        if email not in DEMO_USERS:
            raise ValueError("User not found")
        
        DEMO_USERS[email]["password_hash"] = simple_hash(new_password)
        DEMO_OTPS.pop(email, None)
        
        return True
    
    async def change_password(self, user_id: str, current_password: str, new_password: str) -> bool:
        """Change password for authenticated user"""
        # Find user by ID
        user = None
        for u in DEMO_USERS.values():
            if u["id"] == user_id:
                user = u
                break
        
        if not user:
            raise ValueError("User not found")
        
        if not verify_simple_hash(current_password, user.get("password_hash", "")):
            raise ValueError("Current password is incorrect")
        
        user["password_hash"] = simple_hash(new_password)
        return True
    
    # ==================== TOKEN ====================
    
    async def refresh_access_token(self, refresh_token: str) -> dict:
        """Refresh access token"""
        # Verify refresh token
        payload = jwt_handler.verify_refresh_token(refresh_token)
        if not payload:
            raise ValueError("Invalid refresh token")
        
        user_id = payload.get("sub")
        email = payload.get("email")
        
        # Generate new access token
        access_token = jwt_handler.create_access_token(user_id, email)
        
        return {
            "access_token": access_token,
            "token_type": "bearer",
            "expires_in": settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60
        }
    
    # ==================== USER ====================
    
    async def get_user_by_id(self, user_id: str) -> Optional[dict]:
        """Get user by ID"""
        for user in DEMO_USERS.values():
            if user["id"] == user_id:
                return user
        return None
    
    async def get_user_by_email(self, email: str) -> Optional[dict]:
        """Get user by email"""
        return DEMO_USERS.get(email)
    
    # ==================== SESSIONS ====================
    
    async def get_user_sessions(self, user_id: str) -> list:
        """Get all sessions for user"""
        sessions = []
        for sid, sess in DEMO_SESSIONS.items():
            if sess["user_id"] == user_id:
                sessions.append({
                    "id": sid,
                    **sess
                })
        return sessions
    
    async def revoke_session(self, user_id: str, session_id: str) -> bool:
        """Revoke a specific session"""
        if session_id in DEMO_SESSIONS and DEMO_SESSIONS[session_id]["user_id"] == user_id:
            del DEMO_SESSIONS[session_id]
            return True
        return False


# Create singleton instance
demo_auth_service = DemoAuthService()
