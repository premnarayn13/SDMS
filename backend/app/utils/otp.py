"""
OTP (One-Time Password) Utilities
Generate, store, and verify OTPs
"""
import secrets
import hashlib
from datetime import datetime, timedelta
from typing import Optional, Tuple
import logging

from ..config import settings
from ..db_supabase import get_service_db

logger = logging.getLogger(__name__)


class OTPService:
    """OTP generation and verification service"""
    
    def __init__(self):
        self.db = get_service_db()
        self.otp_length = settings.OTP_LENGTH
        self.expire_minutes = settings.OTP_EXPIRE_MINUTES
    
    def generate_otp(self) -> str:
        """Generate a random numeric OTP"""
        return ''.join(secrets.choice('0123456789') for _ in range(self.otp_length))
    
    def hash_otp(self, otp: str) -> str:
        """Hash OTP for secure storage"""
        return hashlib.sha256(otp.encode()).hexdigest()
    
    async def create_otp(
        self,
        email: str,
        purpose: str,
        user_id: Optional[str] = None
    ) -> str:
        """Create and store a new OTP"""
        # Invalidate any existing OTPs for this email and purpose
        await self.invalidate_existing_otps(email, purpose)
        
        # Generate new OTP
        otp = self.generate_otp()
        otp_hash = self.hash_otp(otp)
        expires_at = datetime.utcnow() + timedelta(minutes=self.expire_minutes)
        
        # Store OTP in database
        otp_data = {
            "email": email,
            "otp_type": purpose,
            "otp_hash": otp_hash,
            "expires_at": expires_at.isoformat(),
        }
        
        if user_id:
            otp_data["user_id"] = user_id
        
        try:
            self.db.table("otp_tokens").insert(otp_data).execute()
            logger.info(f"OTP created for {email} with purpose {purpose}")
            
            # *** TEMPORARY DEBUG: Log OTP to console ***
            if purpose == "drive_link":
                logger.warning(f"🔑 DRIVE OTP for {email}: {otp}")
                print(f"\n{'='*60}")
                print(f"🔑 GOOGLE DRIVE OTP")
                print(f"   Email: {email}")
                print(f"   Code:  {otp}")
                print(f"   Valid: 10 minutes")
                print(f"{'='*60}\n")
            
            return otp
        except Exception as e:
            logger.error(f"Failed to create OTP: {e}")
            raise
    
    async def verify_otp(
        self,
        email: str,
        otp: str,
        purpose: str
    ) -> Tuple[bool, str]:
        """Verify an OTP"""
        otp_hash = self.hash_otp(otp)
        
        try:
            # Find matching OTP
            result = self.db.table("otp_tokens").select("*").eq(
                "email", email
            ).eq(
                "otp_type", purpose
            ).eq(
                "otp_hash", otp_hash
            ).eq(
                "used", False
            ).execute()
            
            if not result.data:
                logger.warning(f"OTP verification failed for {email}: Invalid OTP")
                return False, "Invalid OTP"
            
            otp_record = result.data[0]
            
            # Check expiration
            expires_at = datetime.fromisoformat(otp_record["expires_at"].replace("Z", "+00:00"))
            if datetime.utcnow().replace(tzinfo=expires_at.tzinfo) > expires_at:
                logger.warning(f"OTP verification failed for {email}: Expired")
                return False, "OTP has expired"
            
            # Mark OTP as used
            self.db.table("otp_tokens").update({
                "used": True
            }).eq("id", otp_record["id"]).execute()
            
            logger.info(f"OTP verified successfully for {email}")
            return True, "OTP verified successfully"
            
        except Exception as e:
            logger.error(f"OTP verification error: {e}")
            return False, "Verification failed"
    
    async def invalidate_existing_otps(self, email: str, purpose: str):
        """Invalidate all existing unused OTPs for email and purpose"""
        try:
            self.db.table("otp_tokens").update({
                "used": True
            }).eq(
                "email", email
            ).eq(
                "otp_type", purpose
            ).eq(
                "used", False
            ).execute()
        except Exception as e:
            logger.error(f"Failed to invalidate existing OTPs: {e}")
    
    async def cleanup_expired_otps(self):
        """Remove expired OTPs from database"""
        try:
            self.db.table("otp_tokens").delete().lt(
                "expires_at", datetime.utcnow().isoformat()
            ).execute()
            logger.info("Expired OTPs cleaned up")
        except Exception as e:
            logger.error(f"Failed to cleanup expired OTPs: {e}")


# Singleton instance
otp_service = OTPService()
