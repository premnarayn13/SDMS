"""
Activity & Audit Service
"""
from datetime import datetime, timedelta
from typing import Optional, List, Tuple
import logging

from ...db_supabase import get_service_db
from ...config import settings

logger = logging.getLogger(__name__)


class ActivityService:
    """Activity and audit log service"""
    
    def __init__(self):
        self.db = get_service_db()
    
    async def get_activity_logs(
        self,
        user_id: str,
        entity_type: Optional[str] = None,
        action: Optional[str] = None,
        days: int = 30,
        page: int = 1,
        page_size: int = 50
    ) -> Tuple[List[dict], int]:
        """Get user activity logs"""
        query = self.db.table("activity_log").select("*").eq("user_id", user_id)
        
        if entity_type:
            query = query.eq("entity_type", entity_type)
        
        if action:
            query = query.eq("action", action)
        
        # Time filter
        since = (datetime.utcnow() - timedelta(days=days)).isoformat()
        query = query.gte("created_at", since)
        
        # Pagination
        offset = (page - 1) * page_size
        query = query.order("created_at", desc=True).range(offset, offset + page_size - 1)
        
        result = query.execute()
        
        # Get total count
        count_query = self.db.table("activity_log").select(
            "id", count="exact"
        ).eq("user_id", user_id).gte("created_at", since)
        
        if entity_type:
            count_query = count_query.eq("entity_type", entity_type)
        if action:
            count_query = count_query.eq("action", action)
        
        count_result = count_query.execute()
        total = count_result.count if hasattr(count_result, 'count') else len(result.data or [])
        
        return result.data or [], total
    
    async def get_audit_logs(
        self,
        user_id: str,
        action_type: Optional[str] = None,
        resource_type: Optional[str] = None,
        severity: Optional[str] = None,
        days: int = 90,
        page: int = 1,
        page_size: int = 50
    ) -> Tuple[List[dict], int]:
        """Get user audit logs"""
        query = self.db.table("audit_log").select("*").eq("user_id", user_id)
        
        if action_type:
            query = query.eq("action_type", action_type)
        
        if resource_type:
            query = query.eq("resource_type", resource_type)
        
        if severity:
            query = query.eq("severity", severity)
        
        # Time filter
        since = (datetime.utcnow() - timedelta(days=days)).isoformat()
        query = query.gte("created_at", since)
        
        # Pagination
        offset = (page - 1) * page_size
        query = query.order("created_at", desc=True).range(offset, offset + page_size - 1)
        
        result = query.execute()
        
        # Get total count
        count_query = self.db.table("audit_log").select(
            "id", count="exact"
        ).eq("user_id", user_id).gte("created_at", since)
        
        count_result = count_query.execute()
        total = count_result.count if hasattr(count_result, 'count') else len(result.data or [])
        
        return result.data or [], total
    
    async def get_user_stats(self, user_id: str) -> dict:
        """Get comprehensive user statistics"""
        # Total files
        files_result = self.db.table("file_metadata").select(
            "id, file_type, size_bytes, is_favorite",
            count="exact"
        ).eq("user_id", user_id).is_("deleted_at", "null").execute()
        
        total_files = files_result.count if hasattr(files_result, 'count') else len(files_result.data or [])
        files = files_result.data or []
        
        # Calculate storage and file types
        total_storage = 0
        files_by_type = {}
        favorite_count = 0
        
        for f in files:
            size = f.get("size_bytes", 0) or 0
            total_storage += size
            
            ftype = f.get("file_type", "Other")
            files_by_type[ftype] = files_by_type.get(ftype, 0) + 1
            
            if f.get("is_favorite"):
                favorite_count += 1
        
        # Total folders
        folders_result = self.db.table("virtual_folders").select(
            "id", count="exact"
        ).eq("user_id", user_id).execute()
        total_folders = folders_result.count if hasattr(folders_result, 'count') else 0
        
        # Storage limit
        drive_result = self.db.table("google_drive_tokens").select(
            "soft_limit_bytes, quota_bytes_used"
        ).eq("user_id", user_id).execute()
        
        storage_limit = settings.DEFAULT_STORAGE_LIMIT_BYTES
        if drive_result.data:
            storage_limit = drive_result.data[0].get(
                "soft_limit_bytes", settings.DEFAULT_STORAGE_LIMIT_BYTES
            )
        
        storage_percent = (total_storage / storage_limit * 100) if storage_limit > 0 else 0
        
        # Recent activity count (last 7 days)
        week_ago = (datetime.utcnow() - timedelta(days=7)).isoformat()
        activity_result = self.db.table("activity_log").select(
            "id", count="exact"
        ).eq("user_id", user_id).gte("created_at", week_ago).execute()
        recent_activity = activity_result.count if hasattr(activity_result, 'count') else 0
        
        # Shared files count
        shares_result = self.db.table("file_shares").select(
            "file_id", count="exact"
        ).eq("shared_by", user_id).execute()
        shared_count = shares_result.count if hasattr(shares_result, 'count') else 0
        
        return {
            "total_files": total_files,
            "total_folders": total_folders,
            "total_storage_bytes": total_storage,
            "storage_limit_bytes": storage_limit,
            "storage_used_percent": round(storage_percent, 2),
            "files_by_type": files_by_type,
            "recent_activity_count": recent_activity,
            "shared_files_count": shared_count,
            "favorite_files_count": favorite_count
        }
    
    async def log_activity(
        self,
        user_id: str,
        entity_type: str,
        entity_id: Optional[str],
        action: str,
        details: Optional[dict] = None,
        ip_address: Optional[str] = None,
        user_agent: Optional[str] = None
    ) -> dict:
        """Create activity log entry"""
        result = self.db.table("activity_log").insert({
            "user_id": user_id,
            "entity_type": entity_type,
            "entity_id": entity_id,
            "action": action,
            "details": details or {},
            "ip_address": ip_address,
            "user_agent": user_agent
        }).execute()
        
        return result.data[0] if result.data else {}
    
    async def log_audit(
        self,
        user_id: str,
        action_type: str,
        resource_type: str,
        resource_id: Optional[str] = None,
        details: Optional[dict] = None,
        severity: str = "info",
        ip_address: Optional[str] = None,
        user_agent: Optional[str] = None
    ) -> dict:
        """Create audit log entry"""
        result = self.db.table("audit_log").insert({
            "user_id": user_id,
            "action_type": action_type,
            "resource_type": resource_type,
            "resource_id": resource_id,
            "details": details or {},
            "severity": severity,
            "ip_address": ip_address,
            "user_agent": user_agent
        }).execute()
        
        return result.data[0] if result.data else {}
    
    async def get_recent_files(self, user_id: str, limit: int = 10) -> List[dict]:
        """Get recently accessed files"""
        result = self.db.table("file_metadata").select("*").eq(
            "user_id", user_id
        ).is_("deleted_at", "null").order(
            "last_accessed_at", desc=True, nullsfirst=False
        ).limit(limit).execute()
        
        return result.data or []
    
    async def get_recent_uploads(self, user_id: str, limit: int = 10) -> List[dict]:
        """Get recently uploaded files"""
        result = self.db.table("file_metadata").select("*").eq(
            "user_id", user_id
        ).is_("deleted_at", "null").order(
            "created_at", desc=True
        ).limit(limit).execute()
        
        return result.data or []


# Singleton instance
activity_service = ActivityService()
