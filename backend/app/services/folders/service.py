"""
Folders Service
Virtual folder management (DB-driven, not Drive folders)
"""
from datetime import datetime
from typing import Optional, List
import logging

from ...db_supabase import get_service_db
from ...utils.otp import otp_service
from ...utils.email import email_service

logger = logging.getLogger(__name__)


class FoldersService:
    """Virtual folder management service"""
    
    def __init__(self):
        self.db = get_service_db()
    
    async def create_folder(
        self,
        user_id: str,
        name: str,
        parent_id: Optional[str] = None,
        drive_id: Optional[str] = None,
        description: Optional[str] = None,
        color: Optional[str] = None,
        icon: Optional[str] = None
    ) -> dict:
        """Create a virtual folder"""
        # Check for duplicate name in same parent
        existing = self.db.table("virtual_folders").select("id").eq(
            "user_id", user_id
        ).eq("name", name)
        
        if parent_id:
            existing = existing.eq("parent_id", parent_id)
        else:
            existing = existing.is_("parent_id", "null")
        
        if existing.execute().data:
            raise ValueError(f"Folder '{name}' already exists in this location")
        
        # Verify parent exists
        if parent_id:
            parent = self.db.table("virtual_folders").select("id").eq(
                "id", parent_id
            ).eq("user_id", user_id).execute()
            
            if not parent.data:
                raise ValueError("Parent folder not found")
        
        result = self.db.table("virtual_folders").insert({
            "user_id": user_id,
            "name": name,
            "parent_id": parent_id,
            "drive_id": drive_id,
            "description": description,
            "color": color,
            "icon": icon
        }).execute()
        
        if not result.data:
            raise ValueError("Failed to create folder")
        
        folder = result.data[0]
        self._log_activity(user_id, "folder", folder["id"], "created", {"name": name})
        
        return self._enrich_folder(folder)
    
    async def get_folders(
        self,
        user_id: str,
        parent_id: Optional[str] = None
    ) -> List[dict]:
        """Get folders in a parent (or root)"""
        query = self.db.table("virtual_folders").select("*").eq("user_id", user_id)
        
        if parent_id:
            query = query.eq("parent_id", parent_id)
        else:
            query = query.is_("parent_id", "null")
        
        result = query.order("name").execute()
        folders = result.data or []
        
        # Get file counts
        folder_ids = [f["id"] for f in folders]
        if folder_ids:
            for folder in folders:
                count = self.db.table("file_metadata").select(
                    "id", count="exact"
                ).eq("virtual_folder_id", folder["id"]).is_(
                    "deleted_at", "null"
                ).execute()
                folder["file_count"] = count.count if hasattr(count, 'count') else 0
        
        return [self._enrich_folder(f) for f in folders]
    
    async def get_folder(self, user_id: str, folder_id: str) -> dict:
        """Get single folder"""
        result = self.db.table("virtual_folders").select("*").eq(
            "id", folder_id
        ).eq("user_id", user_id).execute()
        
        if not result.data:
            raise ValueError("Folder not found")
        
        folder = result.data[0]
        
        # Get file count
        count = self.db.table("file_metadata").select(
            "id", count="exact"
        ).eq("virtual_folder_id", folder_id).is_(
            "deleted_at", "null"
        ).execute()
        folder["file_count"] = count.count if hasattr(count, 'count') else 0
        
        return self._enrich_folder(folder)
    
    async def get_folder_with_contents(self, user_id: str, folder_id: str) -> dict:
        """Get folder with children and files"""
        folder = await self.get_folder(user_id, folder_id)
        
        # Get children
        children = await self.get_folders(user_id, folder_id)
        
        # Get files
        files = self.db.table("file_metadata").select("*").eq(
            "user_id", user_id
        ).eq("virtual_folder_id", folder_id).is_(
            "deleted_at", "null"
        ).execute()
        
        folder["children"] = children
        folder["files"] = files.data or []
        
        return folder
    
    async def update_folder(
        self,
        user_id: str,
        folder_id: str,
        updates: dict
    ) -> dict:
        """Update folder"""
        # Verify ownership
        existing = self.db.table("virtual_folders").select("*").eq(
            "id", folder_id
        ).eq("user_id", user_id).execute()
        
        if not existing.data:
            raise ValueError("Folder not found")
        
        current = existing.data[0]
        
        # Filter allowed updates
        allowed = {"name", "description", "color", "icon"}
        filtered = {k: v for k, v in updates.items() if k in allowed and v is not None}
        
        # Check for duplicate name if renaming
        if "name" in filtered and filtered["name"] != current["name"]:
            dup_check = self.db.table("virtual_folders").select("id").eq(
                "user_id", user_id
            ).eq("name", filtered["name"])
            
            if current.get("parent_id"):
                dup_check = dup_check.eq("parent_id", current["parent_id"])
            else:
                dup_check = dup_check.is_("parent_id", "null")
            
            if dup_check.execute().data:
                raise ValueError(f"Folder '{filtered['name']}' already exists")
            
        if filtered:
            self.db.table("virtual_folders").update(filtered).eq(
                "id", folder_id
            ).execute()
            
            self._log_activity(user_id, "folder", folder_id, "updated", filtered)
        
        return await self.get_folder(user_id, folder_id)
    
    async def move_folder(
        self,
        user_id: str,
        folder_id: str,
        target_parent_id: Optional[str]
    ) -> dict:
        """Move folder to new parent"""
        folder = await self.get_folder(user_id, folder_id)
        
        # Prevent moving to itself or descendant
        if target_parent_id:
            if target_parent_id == folder_id:
                raise ValueError("Cannot move folder into itself")
            
            # Check if target is a descendant
            descendants = await self._get_descendant_ids(folder_id)
            if target_parent_id in descendants:
                raise ValueError("Cannot move folder into its descendant")
            
            # Verify target exists
            target = self.db.table("virtual_folders").select("id").eq(
                "id", target_parent_id
            ).eq("user_id", user_id).execute()
            
            if not target.data:
                raise ValueError("Target folder not found")
        
        # Check for duplicate name in target
        dup_check = self.db.table("virtual_folders").select("id").eq(
            "user_id", user_id
        ).eq("name", folder["name"]).neq("id", folder_id)
        
        if target_parent_id:
            dup_check = dup_check.eq("parent_id", target_parent_id)
        else:
            dup_check = dup_check.is_("parent_id", "null")
        
        if dup_check.execute().data:
            raise ValueError(f"Folder '{folder['name']}' already exists in target")
        
        self.db.table("virtual_folders").update({
            "parent_id": target_parent_id
        }).eq("id", folder_id).execute()
        
        self._log_activity(user_id, "folder", folder_id, "moved", {
            "to_parent": target_parent_id
        })
        
        return await self.get_folder(user_id, folder_id)
    
    async def delete_folder(
        self,
        user_id: str,
        folder_id: str,
        recursive: bool = False,
        otp: Optional[str] = None
    ) -> bool:
        """Delete folder (requires OTP for recursive)"""
        folder = await self.get_folder(user_id, folder_id)
        
        # Check for contents
        children = self.db.table("virtual_folders").select("id").eq(
            "parent_id", folder_id
        ).execute()
        
        files = self.db.table("file_metadata").select("id").eq(
            "virtual_folder_id", folder_id
        ).is_("deleted_at", "null").execute()
        
        has_contents = bool(children.data or files.data)
        
        if has_contents:
            if not recursive:
                raise ValueError("Folder is not empty. Use recursive delete.")
            
            # Require OTP for recursive delete
            if not otp:
                raise ValueError("OTP required for recursive delete")
            
            user = self.db.table("users").select("email").eq("id", user_id).execute()
            if not user.data:
                raise ValueError("User not found")
            
            email = user.data[0]["email"]
            success, message = await otp_service.verify_otp(email, otp, "delete_folder")
            
            if not success:
                raise ValueError(message)
            
            # Delete all contents recursively
            await self._delete_folder_recursive(user_id, folder_id)
        else:
            # Just delete the empty folder
            self.db.table("virtual_folders").delete().eq("id", folder_id).execute()
        
        self._log_activity(user_id, "folder", folder_id, "deleted", {
            "name": folder["name"],
            "recursive": recursive
        })
        
        return True
    
    async def request_delete_otp(self, user_id: str, folder_id: str) -> bool:
        """Request OTP for folder deletion"""
        folder = await self.get_folder(user_id, folder_id)
        
        user = self.db.table("users").select("email").eq("id", user_id).execute()
        if not user.data:
            raise ValueError("User not found")
        
        email = user.data[0]["email"]
        
        otp = await otp_service.create_otp(email, "delete_folder", user_id)
        await email_service.send_critical_action_otp(
            email,
            otp,
            "Delete Folder",
            f"Folder: {folder['name']} (and all contents)"
        )
        
        return True
    
    async def get_folder_tree(self, user_id: str) -> List[dict]:
        """Get complete folder tree"""
        all_folders = self.db.table("virtual_folders").select(
            "id, name, parent_id, driver_id"
        ).eq("user_id", user_id).order("name").execute()
        
        folders = all_folders.data or []
        
        # Build tree
        folder_map = {f["id"]: {**f, "children": []} for f in folders}
        roots = []
        
        for folder in folders:
            if folder.get("parent_id"):
                parent = folder_map.get(folder["parent_id"])
                if parent:
                    parent["children"].append(folder_map[folder["id"]])
            else:
                roots.append(folder_map[folder["id"]])
        
        return roots
    
    async def get_breadcrumbs(self, user_id: str, folder_id: str) -> List[dict]:
        """Get breadcrumbs for folder"""
        breadcrumbs = []
        current_id = folder_id
        
        while current_id:
            folder = self.db.table("virtual_folders").select(
                "id, name, parent_id"
            ).eq("id", current_id).eq("user_id", user_id).execute()
            
            if not folder.data:
                break
            
            breadcrumbs.insert(0, {
                "id": folder.data[0]["id"],
                "name": folder.data[0]["name"]
            })
            current_id = folder.data[0].get("parent_id")
        
        # Add root
        breadcrumbs.insert(0, {"id": None, "name": "Home"})
        
        return breadcrumbs
    
    async def _get_descendant_ids(self, folder_id: str) -> set:
        """Get all descendant folder IDs"""
        descendants = set()
        to_process = [folder_id]
        
        while to_process:
            current = to_process.pop()
            children = self.db.table("virtual_folders").select("id").eq(
                "parent_id", current
            ).execute()
            
            for child in (children.data or []):
                descendants.add(child["id"])
                to_process.append(child["id"])
        
        return descendants
    
    async def _delete_folder_recursive(self, user_id: str, folder_id: str):
        """Delete folder and all contents recursively"""
        from .documents.service import documents_service
        
        # Delete files in this folder (soft delete)
        files = self.db.table("file_metadata").select("id").eq(
            "virtual_folder_id", folder_id
        ).is_("deleted_at", "null").execute()
        
        for file in (files.data or []):
            self.db.table("file_metadata").update({
                "deleted_at": datetime.utcnow().isoformat()
            }).eq("id", file["id"]).execute()
        
        # Get and delete children
        children = self.db.table("virtual_folders").select("id").eq(
            "parent_id", folder_id
        ).execute()
        
        for child in (children.data or []):
            await self._delete_folder_recursive(user_id, child["id"])
        
        # Delete this folder
        self.db.table("virtual_folders").delete().eq("id", folder_id).execute()
    
    def _enrich_folder(self, folder: dict) -> dict:
        """Add UI-compatible fields"""
        folder.pop("folder_path", None)
        folder["type"] = "folder"
        folder["date"] = folder["updated_at"][:10] if folder.get("updated_at") else ""
        folder["size"] = 0
        return folder
    
    def _log_activity(
        self,
        user_id: str,
        entity_type: str,
        entity_id: str,
        action: str,
        details: dict
    ):
        """Log activity"""
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
folders_service = FoldersService()
