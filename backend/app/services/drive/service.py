"""
Drive Service
Multi-Drive Google Drive integration management
Supports connecting multiple Google Drive accounts with adjustable storage limits
"""
from datetime import datetime, timedelta
from typing import Optional, Tuple, List
import logging
import secrets
import json

from ...db_supabase import get_service_db
from ...utils.security import token_encryption, password_handler
from ...utils.otp import otp_service
from ...utils.email import email_service
from ...config import settings
from .oauth import google_drive_oauth, GoogleDriveAPI
from .schemas import DRIVE_COLORS, DRIVE_RESERVE_BYTES, MIN_ALLOCATION_BYTES, MAX_ALLOCATABLE_BYTES

logger = logging.getLogger(__name__)


def calculate_max_allocatable(quota_total: int, quota_used: int) -> int:
    """Calculate maximum allocatable bytes based on actual Drive space.
    Reserves 2GB for user's personal use. Max is 13GB (15GB total - 2GB reserve).
    """
    if quota_total <= 0:
        return 0
    available = quota_total - quota_used
    max_allocatable = available - DRIVE_RESERVE_BYTES
    # Ensure at least 0, round down to nearest GB, cap at 13GB
    max_allocatable = max(0, max_allocatable)
    gb = 1024 * 1024 * 1024
    max_allocatable = (max_allocatable // gb) * gb
    # Cap at 13GB maximum
    max_allocatable = min(max_allocatable, MAX_ALLOCATABLE_BYTES)
    return max_allocatable


class DriveService:
    """Multi-Drive Google Drive integration service"""
    
    def __init__(self):
        self.db = get_service_db()
        self.pending_links = {}  # Temporary storage for pending drive links

    def _create_oauth_state(self, user_id: str, display_name: Optional[str] = None) -> str:
        """Create stateless encrypted OAuth state token."""
        payload = {
            "user_id": user_id,
            "display_name": display_name,
            "issued_at": datetime.utcnow().isoformat(),
            "nonce": secrets.token_urlsafe(8)
        }
        return token_encryption.encrypt(json.dumps(payload))

    def _parse_oauth_state(self, state: str) -> Optional[dict]:
        """Parse and validate stateless OAuth state token."""
        try:
            decrypted = token_encryption.decrypt(state)
            payload = json.loads(decrypted)
            issued_at = payload.get("issued_at")
            if not issued_at:
                return None

            issued_dt = datetime.fromisoformat(issued_at)
            # State token valid for 30 minutes
            if datetime.utcnow() - issued_dt > timedelta(minutes=30):
                return None

            if not payload.get("user_id"):
                return None

            return payload
        except Exception:
            return None
    
    def _get_drive_label(self, drive_index: int, display_name: Optional[str] = None) -> str:
        """Generate drive label (Drive A, Drive B, etc.)"""
        if display_name:
            return display_name
        return f"Drive {chr(65 + drive_index)}"  # A, B, C...
    
    def _get_next_drive_index(self, user_id: str) -> int:
        """Get the next available drive index for a user"""
        result = self.db.table("google_drive_tokens").select("drive_index").eq("user_id", user_id).execute()
        if not result.data:
            return 0
        existing_indices = [d.get("drive_index", 0) for d in result.data]
        return max(existing_indices) + 1
    
    def _get_next_color(self, user_id: str) -> str:
        """Get the next available color for a drive"""
        result = self.db.table("google_drive_tokens").select("color").eq("user_id", user_id).execute()
        used_colors = [d.get("color") for d in result.data] if result.data else []
        
        for color in DRIVE_COLORS:
            if color not in used_colors:
                return color
        
        # All colors used, cycle through
        drive_count = len(result.data) if result.data else 0
        return DRIVE_COLORS[drive_count % len(DRIVE_COLORS)]
    
    async def initiate_drive_link(self, user_id: str, display_name: Optional[str] = None) -> Tuple[str, str]:
        """
        Initiate Google Drive linking process
        Returns: (auth_url, state)
        Now allows multiple drives per user
        """
        # Generate state token (stateless, survives process restart)
        state = self._create_oauth_state(user_id, display_name)
        
        # Keep in-memory copy for backward compatibility/debug visibility
        self.pending_links[state] = {
            "user_id": user_id,
            "display_name": display_name,
            "created_at": datetime.utcnow()
        }
        
        # Generate auth URL
        auth_url = google_drive_oauth.get_auth_url(state)
        
        return auth_url, state
    
    async def handle_oauth_callback(
        self,
        code: str,
        state: str
    ) -> dict:
        """
        Handle OAuth callback from Google
        Directly completes drive linking without OTP (for multi-drive support)
        """
        pending = self.pending_links.pop(state, None)
        if pending:
            user_id = pending["user_id"]
            display_name = pending.get("display_name")
        else:
            parsed_state = self._parse_oauth_state(state)
            if not parsed_state:
                raise ValueError("Invalid or expired state token")
            user_id = parsed_state["user_id"]
            display_name = parsed_state.get("display_name")

        token_data = await google_drive_oauth.exchange_code(code)
        access_token = token_data.get("access_token")
        refresh_token = token_data.get("refresh_token")
        expires_in = token_data.get("expires_in", 3600)

        if not access_token:
            raise ValueError("Failed to obtain access token from Google")

        drive_api = GoogleDriveAPI(access_token)
        about = await drive_api.get_about()
        drive_user = about.get("user", {})
        drive_email = drive_user.get("emailAddress")

        existing_result = self.db.table("google_drive_tokens").select("*").eq("user_id", user_id).eq("drive_email", drive_email).execute()
        existing_drive = existing_result.data[0] if existing_result.data else None

        if not refresh_token and existing_drive:
            try:
                refresh_token = token_encryption.decrypt(existing_drive["refresh_token_encrypted"])
            except Exception:
                refresh_token = None

        if not refresh_token:
            raise ValueError("Failed to obtain refresh token from Google")

        quota = about.get("storageQuota", {})
        quota_total = int(quota.get("limit", 0))
        quota_used = int(quota.get("usage", 0))

        encrypted_access = token_encryption.encrypt(access_token)
        encrypted_refresh = token_encryption.encrypt(refresh_token)

        if existing_drive:
            drive_index = existing_drive.get("drive_index", 0)
            drive_color = existing_drive.get("color") or self._get_next_color(user_id)
            folder_id = existing_drive.get("folder_id") or "root"
            folder_name = existing_drive.get("folder_name") or "My Drive"
        else:
            drive_index = self._get_next_drive_index(user_id)
            drive_color = self._get_next_color(user_id)
            try:
                docmatrix_folder = await drive_api.create_folder("DocMatrix")
                folder_id = docmatrix_folder["id"]
                folder_name = "DocMatrix"
                logger.info(f"Created DocMatrix folder {folder_id} for user {user_id}")
            except Exception as e:
                logger.warning(f"Could not create DocMatrix folder: {e}. Using root.")
                folder_id = "root"
                folder_name = "My Drive"

        max_allocatable = calculate_max_allocatable(quota_total, quota_used)
        initial_allocation = min(settings.DEFAULT_STORAGE_LIMIT_BYTES, max_allocatable)
        if initial_allocation < MIN_ALLOCATION_BYTES:
            initial_allocation = MIN_ALLOCATION_BYTES

        drive_data = {
            "user_id": user_id,
            "drive_email": drive_email,
            "folder_id": folder_id,
            "folder_name": folder_name,
            "display_name": display_name,
            "drive_index": drive_index,
            "color": drive_color,
            "access_token_encrypted": encrypted_access,
            "refresh_token_encrypted": encrypted_refresh,
            "token_expiry": (datetime.utcnow() + timedelta(seconds=expires_in)).isoformat(),
            "quota_bytes_total": quota_total,
            "quota_bytes_used": quota_used,
            "soft_limit_bytes": initial_allocation,
            "allocated_storage_bytes": initial_allocation,
            "is_primary": existing_drive.get("is_primary", drive_index == 0) if existing_drive else (drive_index == 0),
            "status": "active",
            "verified_at": datetime.utcnow().isoformat()
        }

        if existing_drive:
            result = self.db.table("google_drive_tokens").update(drive_data).eq("id", existing_drive["id"]).execute()
            if not result.data:
                raise ValueError("Failed to reconnect drive")
            linked_drive = result.data[0]
        else:
            result = self.db.table("google_drive_tokens").insert(drive_data).execute()
            if not result.data:
                raise ValueError("Failed to link drive")
            linked_drive = result.data[0]

        self._log_activity(user_id, "drive", linked_drive["id"], "drive_linked", {
            "drive_email": drive_email,
            "drive_index": drive_index
        })

        logger.info(f"Drive linked for user {user_id}: {drive_email}")

        linked_drive["label"] = self._get_drive_label(drive_index, display_name)
        linked_drive.pop("access_token_encrypted", None)
        linked_drive.pop("refresh_token_encrypted", None)

        return linked_drive
    
    async def verify_and_complete_link(
        self,
        user_id: str,
        pending_drive_id: str,
        otp: str
    ) -> dict:
        """Complete drive linking after OTP verification"""
        # Get pending drive info
        pending = self.pending_links.get(pending_drive_id)
        if not pending:
            raise ValueError("Invalid or expired pending drive link")
        
        if pending["user_id"] != user_id:
            raise ValueError("Invalid pending drive link")
        
        # Get user email
        user_result = self.db.table("users").select("email").eq("id", user_id).execute()
        if not user_result.data:
            raise ValueError("User not found")
        
        user_email = user_result.data[0]["email"]
        
        # Verify OTP
        success, message = await otp_service.verify_otp(user_email, otp, "drive_link")
        if not success:
            raise ValueError(message)
        
        # Create DocMatrix folder in their Drive
        access_token = token_encryption.decrypt(pending["access_token_encrypted"])
        drive_api = GoogleDriveAPI(access_token)
        
        try:
            docmatrix_folder = await drive_api.create_folder("DocMatrix")
            folder_id = docmatrix_folder["id"]
            folder_name = "DocMatrix"
            logger.info(f"Created DocMatrix folder {folder_id} for user {user_id}")
        except Exception as e:
            logger.warning(f"Could not create DocMatrix folder: {e}. Using root.")
            folder_id = "root"
            folder_name = "My Drive"
        
        # Calculate smart initial allocation based on available space
        quota_total = pending["quota_bytes_total"]
        quota_used = pending["quota_bytes_used"]
        max_allocatable = calculate_max_allocatable(quota_total, quota_used)
        
        # Default to min of (10GB, max_allocatable) or MIN_ALLOCATION if space is tight
        initial_allocation = min(settings.DEFAULT_STORAGE_LIMIT_BYTES, max_allocatable)
        if initial_allocation < MIN_ALLOCATION_BYTES:
            initial_allocation = MIN_ALLOCATION_BYTES
        
        # Create linked drive record
        drive_data = {
            "user_id": user_id,
            "drive_email": pending["drive_email"],
            "folder_id": folder_id,
            "folder_name": folder_name,
            "display_name": pending.get("display_name"),
            "drive_index": pending.get("drive_index", 0),
            "color": pending.get("color", "#3b82f6"),
            "access_token_encrypted": pending["access_token_encrypted"],
            "refresh_token_encrypted": pending["refresh_token_encrypted"],
            "token_expiry": pending["token_expires_at"].isoformat(),
            "quota_bytes_total": quota_total,
            "quota_bytes_used": quota_used,
            "soft_limit_bytes": initial_allocation,
            "allocated_storage_bytes": initial_allocation,  # Dynamic based on available space
            "is_primary": pending.get("drive_index", 0) == 0,  # First drive is primary
            "status": "active",
            "verified_at": datetime.utcnow().isoformat()
        }
        
        result = self.db.table("google_drive_tokens").insert(drive_data).execute()
        
        if not result.data:
            raise ValueError("Failed to link drive")
        
        # Clean up pending link
        del self.pending_links[pending_drive_id]
        
        linked_drive = result.data[0]
        
        # Log activity
        self._log_activity(user_id, "drive", linked_drive["id"], "drive_linked", {
            "drive_email": pending["drive_email"]
        })
        
        logger.info(f"Drive linked for user {user_id}: {pending['drive_email']}")
        
        return linked_drive
    
    async def get_linked_drive(self, user_id: str) -> Optional[dict]:
        """Get user's primary linked drive (for backward compatibility)"""
        result = self.db.table("google_drive_tokens").select("*").eq("user_id", user_id).eq("is_primary", True).execute()
        
        if not result.data:
            # Try to get any drive
            result = self.db.table("google_drive_tokens").select("*").eq("user_id", user_id).limit(1).execute()
        
        if not result.data:
            return None
        
        drive = result.data[0]
        
        # Add label
        drive["label"] = self._get_drive_label(drive.get("drive_index", 0), drive.get("display_name"))
        
        # Remove encrypted tokens from response
        drive.pop("access_token_encrypted", None)
        drive.pop("refresh_token_encrypted", None)
        
        return drive
    
    async def get_all_google_drive_tokens(self, user_id: str) -> List[dict]:
        """Get all linked drives for a user with real-time quota"""
        result = self.db.table("google_drive_tokens").select("*").eq("user_id", user_id).order("drive_index").execute()
        
        if not result.data:
            return []
        
        drives = []
        for drive in result.data:
            # Add label
            drive["label"] = self._get_drive_label(drive.get("drive_index", 0), drive.get("display_name"))
            
            # Calculate available and max allocatable
            quota_total = drive.get("quota_bytes_total", 0)
            quota_used = drive.get("quota_bytes_used", 0)
            drive["quota_bytes_available"] = max(0, quota_total - quota_used)
            drive["max_allocatable_bytes"] = calculate_max_allocatable(quota_total, quota_used)
            
            # Remove encrypted tokens from response
            drive.pop("access_token_encrypted", None)
            drive.pop("refresh_token_encrypted", None)
            drives.append(drive)
        
        return drives
    
    async def get_drive_by_id(self, user_id: str, drive_id: str) -> Optional[dict]:
        """Get a specific drive by ID with calculated max allocatable"""
        result = self.db.table("google_drive_tokens").select("*").eq("id", drive_id).eq("user_id", user_id).execute()
        
        if not result.data:
            return None
        
        drive = result.data[0]
        drive["label"] = self._get_drive_label(drive.get("drive_index", 0), drive.get("display_name"))
        
        # Calculate available and max allocatable
        quota_total = drive.get("quota_bytes_total", 0)
        quota_used = drive.get("quota_bytes_used", 0)
        drive["quota_bytes_available"] = max(0, quota_total - quota_used)
        drive["max_allocatable_bytes"] = calculate_max_allocatable(quota_total, quota_used)
        
        # Remove encrypted tokens from response
        drive.pop("access_token_encrypted", None)
        drive.pop("refresh_token_encrypted", None)
        
        return drive
    
    async def update_drive_settings(
        self,
        user_id: str,
        drive_id: str,
        display_name: Optional[str] = None,
        allocated_storage_bytes: Optional[int] = None,
        color: Optional[str] = None,
        is_primary: Optional[bool] = None
    ) -> dict:
        """Update drive settings (name, storage allocation, color, etc.)"""
        # Verify drive belongs to user
        result = self.db.table("google_drive_tokens").select("*").eq("id", drive_id).eq("user_id", user_id).execute()
        
        if not result.data:
            raise ValueError("Drive not found")
        
        drive = result.data[0]
        update_data = {}
        
        if display_name is not None:
            update_data["display_name"] = display_name
        
        if allocated_storage_bytes is not None:
            # Validate allocation against actual drive space
            quota_total = drive.get("quota_bytes_total", 0)
            quota_used = drive.get("quota_bytes_used", 0)
            max_allocatable = calculate_max_allocatable(quota_total, quota_used)
            
            min_bytes = MIN_ALLOCATION_BYTES  # 1GB
            
            if allocated_storage_bytes < min_bytes:
                raise ValueError(f"Minimum storage allocation is 1GB")
            
            if max_allocatable <= 0:
                raise ValueError("Not enough space in Google Drive. Need at least 3GB available (1GB allocation + 2GB reserve).")
            
            if allocated_storage_bytes > max_allocatable:
                max_gb = max_allocatable / (1024 * 1024 * 1024)
                raise ValueError(f"Cannot allocate more than {max_gb:.0f}GB. Your Drive has limited available space (2GB reserved for personal use).")
            
            update_data["allocated_storage_bytes"] = allocated_storage_bytes
            update_data["soft_limit_bytes"] = allocated_storage_bytes
        
        if color is not None:
            update_data["color"] = color
        
        if is_primary is not None and is_primary:
            # Unset primary on other drives first
            self.db.table("google_drive_tokens").update({"is_primary": False}).eq("user_id", user_id).execute()
            update_data["is_primary"] = True
        
        if not update_data:
            raise ValueError("No updates provided")
        
        result = self.db.table("google_drive_tokens").update(update_data).eq("id", drive_id).execute()
        
        if not result.data:
            raise ValueError("Failed to update drive")
        
        updated_drive = result.data[0]
        updated_drive["label"] = self._get_drive_label(
            updated_drive.get("drive_index", 0), 
            updated_drive.get("display_name")
        )
        
        # Add max allocatable to response
        quota_total = updated_drive.get("quota_bytes_total", 0)
        quota_used = updated_drive.get("quota_bytes_used", 0)
        updated_drive["quota_bytes_available"] = max(0, quota_total - quota_used)
        updated_drive["max_allocatable_bytes"] = calculate_max_allocatable(quota_total, quota_used)
        
        # Remove encrypted tokens from response
        updated_drive.pop("access_token_encrypted", None)
        updated_drive.pop("refresh_token_encrypted", None)
        
        self._log_activity(user_id, "drive", drive_id, "drive_settings_updated", update_data)
        
        return updated_drive
    
    async def get_drive_quota(self, user_id: str, drive_id: Optional[str] = None) -> dict:
        """Get drive quota information for a specific drive or primary drive"""
        if drive_id:
            drive = await self._get_drive_with_tokens_by_id(user_id, drive_id)
        else:
            drive = await self._get_drive_with_tokens(user_id)
        
        if not drive:
            raise ValueError("No linked drive found")
        
        # Get fresh quota from Google Drive
        access_token = await self._get_valid_access_token(drive)
        drive_api = GoogleDriveAPI(access_token)
        
        try:
            quota_info = await drive_api.get_storage_quota()
            
            # Update stored quota
            self.db.table("google_drive_tokens").update({
                "quota_bytes_total": quota_info["total"],
                "quota_bytes_used": quota_info["used"],
                "last_synced_at": datetime.utcnow().isoformat()
            }).eq("id", drive["id"]).execute()
            
            soft_limit = drive.get("soft_limit_bytes", settings.DEFAULT_STORAGE_LIMIT_BYTES)
            allocated = drive.get("allocated_storage_bytes", settings.DEFAULT_STORAGE_LIMIT_BYTES)
            max_allocatable = calculate_max_allocatable(quota_info["total"], quota_info["used"])
            
            return {
                "drive_id": str(drive["id"]),
                "total_bytes": quota_info["total"],
                "used_bytes": quota_info["used"],
                "available_bytes": quota_info["available"],
                "max_allocatable_bytes": max_allocatable,
                "soft_limit_bytes": soft_limit,
                "allocated_storage_bytes": allocated,
                "percent_used": (quota_info["used"] / quota_info["total"] * 100) if quota_info["total"] > 0 else 0,
                "percent_of_limit": (quota_info["used"] / soft_limit * 100) if soft_limit > 0 else 0,
                "percent_of_allocation": (quota_info["used"] / allocated * 100) if allocated > 0 else 0
            }
        except Exception as e:
            logger.error(f"Failed to get Drive quota: {e}")
            # Return cached quota
            soft_limit = drive.get("soft_limit_bytes", settings.DEFAULT_STORAGE_LIMIT_BYTES)
            allocated = drive.get("allocated_storage_bytes", settings.DEFAULT_STORAGE_LIMIT_BYTES)
            quota_total = drive.get("quota_bytes_total", 0)
            quota_used = drive.get("quota_bytes_used", 0)
            return {
                "drive_id": str(drive["id"]),
                "total_bytes": quota_total,
                "used_bytes": quota_used,
                "available_bytes": max(0, quota_total - quota_used),
                "max_allocatable_bytes": calculate_max_allocatable(quota_total, quota_used),
                "soft_limit_bytes": soft_limit,
                "allocated_storage_bytes": allocated,
                "percent_used": 0,
                "percent_of_limit": 0,
                "percent_of_allocation": 0
            }
    
    async def get_all_drives_quota(self, user_id: str) -> dict:
        """Get combined quota information for all drives"""
        drives = await self.get_all_google_drive_tokens(user_id)
        
        if not drives:
            return {
                "drives": [],
                "combined_total_bytes": 0,
                "combined_used_bytes": 0,
                "combined_allocated_bytes": 0,
                "combined_available_bytes": 0,
                "combined_percent_used": 0
            }
        
        drive_quotas = []
        combined_total = 0
        combined_used = 0
        combined_allocated = 0
        
        for drive in drives:
            try:
                quota = await self.get_drive_quota(user_id, drive["id"])
                drive_quotas.append(quota)
                combined_total += quota["total_bytes"]
                combined_used += quota["used_bytes"]
                combined_allocated += quota["allocated_storage_bytes"]
            except Exception as e:
                logger.error(f"Failed to get quota for drive {drive['id']}: {e}")
        
        return {
            "drives": drive_quotas,
            "combined_total_bytes": combined_total,
            "combined_used_bytes": combined_used,
            "combined_allocated_bytes": combined_allocated,
            "combined_available_bytes": combined_total - combined_used,
            "combined_percent_used": (combined_used / combined_total * 100) if combined_total > 0 else 0
        }
    
    async def request_unlink_otp(self, user_id: str, drive_id: Optional[str] = None) -> bool:
        """Request OTP for unlinking a specific drive"""
        if drive_id:
            drive = await self.get_drive_by_id(user_id, drive_id)
        else:
            drive = await self.get_linked_drive(user_id)
        
        if not drive:
            raise ValueError("No linked drive found")
        
        # Get user email
        user_result = self.db.table("users").select("email").eq("id", user_id).execute()
        if not user_result.data:
            raise ValueError("User not found")
        
        user_email = user_result.data[0]["email"]
        
        # Generate OTP
        otp = await otp_service.create_otp(user_email, "drive_link", user_id)
        await email_service.send_critical_action_otp(
            user_email,
            otp,
            "Unlink Google Drive",
            f"Drive account: {drive['drive_email']}. Files will remain in Google Drive but DocMatrix metadata will be deleted."
        )
        
        return True
    
    async def unlink_drive(
        self,
        user_id: str,
        password: str,
        drive_id: Optional[str] = None ) -> bool:
        """Unlink a specific drive after password verification"""

        if drive_id:
            drive = await self._get_drive_with_tokens_by_id(user_id, drive_id)
        else:
            drive = await self._get_drive_with_tokens(user_id)

        if not drive:
            raise ValueError("No linked drive found")

        # Get user
        user_result = (
            self.db.table("users")
            .select("*")
            .eq("id", user_id)
            .execute()
        )

        if not user_result.data:
            raise ValueError("User not found")

        user = user_result.data[0]

        # Verify password
        if not password_handler.verify_password(
            password,
            user.get("password_hash", "")
        ):
            raise ValueError("Incorrect password")

        # Revoke Google token
        try:
            refresh_token = token_encryption.decrypt(
                drive["refresh_token_encrypted"]
            )
            await google_drive_oauth.revoke_token(refresh_token)

        except Exception as e:
            logger.warning(f"Failed to revoke Google token: {e}")

        logger.warning("=" * 80)
        logger.warning("UNLINK DRIVE STARTED")
        logger.warning("USER ID = %s", user_id)
        logger.warning("DRIVE ID = %s", drive["id"])
        logger.warning("DRIVE EMAIL = %s", drive["drive_email"])
        logger.warning("=" * 80)

        # Count files before delete
        files_before = (
            self.db.table("file_metadata")
            .select("id, drive_id")
            .eq("drive_id", drive["id"])
            .execute()
        )

        logger.warning(
            "FILES FOUND FOR THIS DRIVE = %s",
            len(files_before.data or [])
        )

        

        # =====================================================
        # DELETE FILES FIRST
        # =====================================================

        file_delete_result = (
            self.db.table("file_metadata")
            .delete()
            .eq("drive_id", drive["id"])
            .execute()
        )

        logger.warning(
            "FILE DELETE RESULT = %s",
            file_delete_result.data
        )

        # =====================================================
        # DELETE DRIVE RECORD AFTER FILES
        # =====================================================

        (
            self.db.table("google_drive_tokens")
            .delete()
            .eq("id", drive["id"])
            .execute()
        )

        logger.warning(
            "GOOGLE DRIVE TOKEN RECORD DELETED FOR DRIVE = %s",
            drive["id"]
        )

        # Verify deletion
        files_after = (
            self.db.table("file_metadata")
            .select("id")
            .eq("drive_id", drive["id"])
            .execute()
        )

        logger.warning(
            "FILES REMAINING AFTER DELETE = %s",
            len(files_after.data or [])
        )

        # Check NULL drive_id records
        null_drive_files = (
            self.db.table("file_metadata")
            .select("id")
            .is_("drive_id", "null")
            .execute()
        )

        logger.warning(
            "FILES WITH NULL DRIVE_ID = %s",
            len(null_drive_files.data or [])
        )

        # Log activity
        self._log_activity(
            user_id,
            "drive",
            drive["id"],
            "drive_unlinked",
            {
                "drive_email": drive["drive_email"]
            }
        )

        logger.info(f"Drive unlinked for user {user_id}")

        return True


    async def reauthorize_drive(self, user_id: str, drive_id: Optional[str] = None) -> str:
        """Get URL to reauthorize a specific drive access"""
        if drive_id:
            drive = await self.get_drive_by_id(user_id, drive_id)
        else:
            drive = await self.get_linked_drive(user_id)
        
        if not drive:
            raise ValueError("No linked drive found")
        
        # Generate state with reauth flag
        state = f"reauth_{secrets.token_urlsafe(16)}"
        
        self.pending_links[state] = {
            "user_id": user_id,
            "drive_id": drive["id"],
            "is_reauth": True,
            "created_at": datetime.utcnow()
        }
        
        return google_drive_oauth.get_auth_url(state)
    
    async def _get_drive_with_tokens(self, user_id: str) -> Optional[dict]:
        """Get primary linked drive with encrypted tokens"""
        result = self.db.table("google_drive_tokens").select("*").eq("user_id", user_id).eq("is_primary", True).execute()
        if not result.data:
            # Try any drive
            result = self.db.table("google_drive_tokens").select("*").eq("user_id", user_id).limit(1).execute()
        return result.data[0] if result.data else None
    
    async def _get_drive_with_tokens_by_id(self, user_id: str, drive_id: str) -> Optional[dict]:
        """Get specific drive with encrypted tokens"""
        result = self.db.table("google_drive_tokens").select("*").eq("id", drive_id).eq("user_id", user_id).execute()
        return result.data[0] if result.data else None
    
    async def _get_valid_access_token(self, drive: dict) -> str:
        """Get valid access token, refreshing if needed"""
        encrypted_access = drive.get("access_token_encrypted")
        decrypted_access = token_encryption.decrypt(encrypted_access) if encrypted_access else None
        token_expires = drive.get("token_expiry")
        
        if token_expires:
            if isinstance(token_expires, str):
                expires_at = datetime.fromisoformat(token_expires.replace("Z", "+00:00"))
            else:
                expires_at = token_expires
            
            # Check if token is still valid (with 5 min buffer)
            if datetime.utcnow().replace(tzinfo=expires_at.tzinfo) < expires_at - timedelta(minutes=5):
                return decrypted_access
        
        # Refresh token
        refresh_token = token_encryption.decrypt(drive["refresh_token_encrypted"])
        try:
            token_data = await google_drive_oauth.refresh_access_token(refresh_token)
        except Exception as refresh_error:
            if decrypted_access:
                logger.warning("Token refresh failed, using stored access token for drive %s: %s", drive.get("id"), refresh_error)
                return decrypted_access
            raise
        
        new_access_token = token_data["access_token"]
        expires_in = token_data.get("expires_in", 3600)
        
        # Update stored token
        self.db.table("google_drive_tokens").update({
            "access_token_encrypted": token_encryption.encrypt(new_access_token),
            "token_expiry": (datetime.utcnow() + timedelta(seconds=expires_in)).isoformat()
        }).eq("id", drive["id"]).execute()
        
        return new_access_token
    
    async def get_drive_api(self, user_id: str, drive_id: Optional[str] = None) -> GoogleDriveAPI:
        """Get authenticated Drive API instance for a specific drive"""
        if drive_id:
            drive = await self._get_drive_with_tokens_by_id(user_id, drive_id)
        else:
            drive = await self._get_drive_with_tokens(user_id)
        
        if not drive:
            raise ValueError("No linked drive found")
        
        access_token = await self._get_valid_access_token(drive)
        return GoogleDriveAPI(access_token)
    
    async def get_drive_api_by_drive_id(self, user_id: str, drive_id: str) -> Tuple[GoogleDriveAPI, dict]:
        """Get authenticated Drive API instance and drive info for a specific drive"""
        drive = await self._get_drive_with_tokens_by_id(user_id, drive_id)
        
        if not drive:
            raise ValueError("Drive not found")
        
        access_token = await self._get_valid_access_token(drive)
        
        # Create safe drive info (without tokens)
        drive_info = {
            "id": drive["id"],
            "drive_email": drive["drive_email"],
            "folder_id": drive.get("folder_id"),
            "folder_name": drive.get("folder_name"),
            "display_name": drive.get("display_name"),
            "drive_index": drive.get("drive_index", 0),
            "label": self._get_drive_label(drive.get("drive_index", 0), drive.get("display_name")),
        }
        
        return GoogleDriveAPI(access_token), drive_info
    
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
drive_service = DriveService()
