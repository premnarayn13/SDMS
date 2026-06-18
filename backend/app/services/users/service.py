"""
User Service
Handles user profile and preferences
"""
from datetime import datetime
from typing import Optional
import logging

from ...db_supabase import get_service_db
from ...utils.security import password_handler
from ...utils.otp import otp_service
from ...utils.email import email_service

logger = logging.getLogger(__name__)


class UserService:
    """User management service"""
    
    def __init__(self):
        self.db = get_service_db()
    
    async def get_user_profile(self, user_id: str) -> dict:
        """Get user profile with preferences"""
        # Get user
        result = self.db.table("users").select("*").eq("id", user_id).execute()
        
        if not result.data:
            raise ValueError("User not found")
        
        user = result.data[0]
        
        # Get preferences
        prefs_result = self.db.table("user_preferences").select("*").eq("user_id", user_id).execute()
        preferences = prefs_result.data[0] if prefs_result.data else None
        
        # Check if user has linked drive
        drive_result = self.db.table("google_drive_tokens").select("id").eq("user_id", user_id).limit(1).execute()
        has_linked_drive = bool(drive_result.data)
        
        return {
            **user,
            "preferences": preferences,
            "has_linked_drive": has_linked_drive
        }
    
    async def update_profile(self, user_id: str, updates: dict) -> dict:
        """Update user profile"""
        # Filter allowed fields
        allowed_fields = {"name", "avatar_url"}
        filtered_updates = {k: v for k, v in updates.items() if k in allowed_fields and v is not None}
        
        if not filtered_updates:
            return await self.get_user_profile(user_id)
        
        result = self.db.table("users").update(filtered_updates).eq("id", user_id).execute()
        
        if not result.data:
            raise ValueError("User not found")
        
        # Log activity
        self._log_activity(user_id, "account", None, "profile_updated", filtered_updates)
        
        return await self.get_user_profile(user_id)
    
    async def get_preferences(self, user_id: str) -> dict:
        """Get user preferences"""
        result = self.db.table("user_preferences").select("*").eq("user_id", user_id).execute()
        
        if not result.data:
            # Create default preferences
            default_prefs = {
                "user_id": user_id,
                "theme": "light",
                "view_mode": "grid",
                "sort_by": "name",
                "sort_order": "asc",
                "notifications_enabled": True,
                "email_notifications": True,
                "sidebar_collapsed": False,
                "custom_settings": {}
            }
            self.db.table("user_preferences").insert(default_prefs).execute()
            return default_prefs
        
        return result.data[0]
    
    async def update_preferences(self, user_id: str, updates: dict) -> dict:
        """Update user preferences"""
        # Filter allowed fields
        allowed_fields = {
            "theme", "view_mode", "sort_by", "sort_order",
            "notifications_enabled", "email_notifications",
            "sidebar_collapsed", "custom_settings"
        }
        filtered_updates = {k: v for k, v in updates.items() if k in allowed_fields and v is not None}
        
        if not filtered_updates:
            return await self.get_preferences(user_id)
        
        # Check if preferences exist
        existing = self.db.table("user_preferences").select("id").eq("user_id", user_id).execute()
        
        if existing.data:
            result = self.db.table("user_preferences").update(filtered_updates).eq("user_id", user_id).execute()
        else:
            filtered_updates["user_id"] = user_id
            result = self.db.table("user_preferences").insert(filtered_updates).execute()
        
        return await self.get_preferences(user_id)
    
    async def request_account_deletion_otp(self, user_id: str, password: Optional[str] = None) -> bool:
        """Request OTP for account deletion"""
        # Get user
        result = self.db.table("users").select("*").eq("id", user_id).execute()
        
        if not result.data:
            raise ValueError("User not found")
        
        user = result.data[0]
        
        # Verify password for email auth users
        if user.get("auth_provider") == "email":
            if not password:
                raise ValueError("Password required for email accounts")
            if not password_handler.verify_password(password, user.get("password_hash", "")):
                raise ValueError("Incorrect password")
        
        # Generate OTP
        otp = await otp_service.create_otp(user["email"], "delete_account", user_id)
        await email_service.send_critical_action_otp(
            user["email"],
            otp,
            "Account Deletion",
            "This action will permanently delete your DocMatrix account and all associated data."
        )
        
        return True
    
    async def delete_account(self, user_id: str, otp: str) -> bool:
        """Delete user account after OTP verification"""
        # Get user
        result = self.db.table("users").select("*").eq("id", user_id).execute()
        
        if not result.data:
            raise ValueError("User not found")
        
        user = result.data[0]
        
        # Verify OTP
        success, message = await otp_service.verify_otp(user["email"], otp, "delete_account")
        
        if not success:
            raise ValueError(message)
        
        # Revoke all drive access tokens (but don't delete Drive files)
        drives = self.db.table("google_drive_tokens").select("id").eq("user_id", user_id).execute()
        
        # Note: In a real implementation, you would revoke Google OAuth tokens here
        
        # Soft delete user (mark as deleted, keep for audit)
        self.db.table("users").update({
            "account_status": "deleted",
            "deleted_at": datetime.utcnow().isoformat(),
            "email": f"deleted_{user_id}@deleted.docmatrix.local"  # Anonymize email
        }).eq("id", user_id).execute()
        
        # Delete sessions
        self.db.table("user_sessions").delete().eq("user_id", user_id).execute()
        
        # Log activity (as audit log, not activity log since user is deleted)
        self.db.table("audit_log").insert({
            "user_id": user_id,
            "action": "account_deleted",
            "resource_type": "account",
            "resource_id": user_id,
            "old_value": {"email": user["email"]},
            "new_value": {"status": "deleted"}
        }).execute()
        
        logger.info(f"Account deleted: {user['email']}")
        return True
    
    async def get_storage_usage(self, user_id: str) -> dict:
        """Get user's storage usage across linked drives"""
        # Get linked drives with quota info
        result = self.db.table("google_drive_tokens").select(
            "quota_bytes_total, quota_bytes_used, soft_limit_bytes"
        ).eq("user_id", user_id).execute()
        
        if not result.data:
            return {
                "total_used": 0,
                "total_limit": 10737418240,  # 10GB default
                "percent_used": 0,
                "drives": []
            }
        
        total_used = sum(d.get("quota_bytes_used", 0) or 0 for d in result.data)
        total_limit = sum(d.get("soft_limit_bytes", 10737418240) for d in result.data)
        
        return {
            "total_used": total_used,
            "total_limit": total_limit,
            "percent_used": (total_used / total_limit * 100) if total_limit > 0 else 0,
            "drives": result.data
        }
    
    async def get_activity_log(self, user_id: str, limit: int = 50, offset: int = 0) -> list:
        """Get user's activity log"""
        result = self.db.table("activity_log").select("*").eq(
            "user_id", user_id
        ).order(
            "created_at", desc=True
        ).range(offset, offset + limit - 1).execute()
        
        return result.data or []
    
    async def get_login_history(self, user_id: str, limit: int = 20) -> list:
        """Get user's login history"""
        result = self.db.table("activity_log").select("*").eq(
            "user_id", user_id
        ).eq(
            "action", "login"
        ).order(
            "created_at", desc=True
        ).limit(limit).execute()
        
        return result.data or []
    
    def _log_activity(
        self,
        user_id: str,
        entity_type: str,
        entity_id: Optional[str],
        action: str,
        details: dict
    ):
        """Log user activity"""
        try:
            self.db.table("activity_log").insert({
                "user_id": user_id,
                "entity_type": entity_type,
                "entity_id": entity_id,
                "action": action,
                "details": details
            }).execute()
        except Exception as e:
            logger.error(f"Failed to log activity: {e}")


# Singleton instance
user_service = UserService()
