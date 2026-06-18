"""
Documents Service
File metadata and Drive operations
"""
from datetime import datetime
from typing import Optional, List, Tuple
import logging
import hashlib
import uuid
import re
import secrets

from ...db_supabase import get_service_db
from ...utils.otp import otp_service
from ...utils.email import email_service
from ...config import settings
from ..drive.service import drive_service
from ..drive.oauth import GoogleDriveAPI
from datetime import datetime

logger = logging.getLogger(__name__)


# File type mappings
FILE_TYPE_MAP = {
    'pdf': 'PDF',
    'doc': 'Word', 'docx': 'Word',
    'xls': 'Excel', 'xlsx': 'Excel', 'csv': 'CSV',
    'ppt': 'PowerPoint', 'pptx': 'PowerPoint',
    'jpg': 'Image', 'jpeg': 'Image', 'png': 'Image', 'gif': 'Image', 'bmp': 'Image', 'webp': 'Image', 'svg': 'Image',
    'mp4': 'Video', 'avi': 'Video', 'mov': 'Video', 'wmv': 'Video', 'mkv': 'Video', 'webm': 'Video', 'm4v': 'Video', 'ogv': 'Video',
    'mp3': 'Audio', 'wav': 'Audio', 'ogg': 'Audio', 'flac': 'Audio', 'm4a': 'Audio', 'aac': 'Audio', 'wma': 'Audio',
    'txt': 'Text', 'md': 'Text', 'rtf': 'Text',
    'js': 'Code', 'ts': 'Code', 'py': 'Code', 'java': 'Code', 'c': 'Code', 'cpp': 'Code', 
    'html': 'Code', 'css': 'Code', 'json': 'Code', 'xml': 'Code', 'sql': 'Code',
    'zip': 'Archive', 'rar': 'Archive', '7z': 'Archive', 'tar': 'Archive', 'gz': 'Archive'
}


class DocumentsService:
    """Document management service"""
    
    def __init__(self):
        self.db = get_service_db()
    
    def _get_file_type(self, filename: str) -> str:
        """Determine file type from extension"""
        if '.' not in filename:
            return 'Other'
        ext = filename.rsplit('.', 1)[1].lower()
        return FILE_TYPE_MAP.get(ext, 'Other')
    
    def _get_extension(self, filename: str) -> str:
        """Get file extension"""
        if '.' not in filename:
            return ''
        return filename.rsplit('.', 1)[1].lower()
    
    async def upload_file(
        self,
        user_id: str,
        file_content: bytes,
        filename: str,
        mime_type: str,
        drive_id: Optional[str] = None,
        virtual_folder_id: Optional[str] = None,
        description: Optional[str] = None,
        tags: List[str] = []
    ) -> dict:
        """
        Upload file to Google Drive and create metadata
        """
        # Get user's linked drive (specific one if requested)
        drive_query = self.db.table("google_drive_tokens").select("*").eq("user_id", user_id)
        if drive_id:
            drive_query = drive_query.eq("id", drive_id)

        drive = drive_query.execute()

        if not drive.data:
            raise ValueError("No linked drive. Please link a Google Drive first.")

        drive_info = drive.data[0]
        
        # Check DocMatrix allocation quota (app usage only, not total Google Drive usage)
        soft_limit = drive_info.get("soft_limit_bytes", settings.DEFAULT_STORAGE_LIMIT_BYTES)
        app_usage_result = self.db.table("file_metadata").select("size_bytes").eq(
            "drive_id", drive_info["id"]
        ).is_(
            "deleted_at", "null"
        ).execute()
        used = sum((f.get("size_bytes") or 0) for f in (app_usage_result.data or []))
        file_size = len(file_content)
        
        if used + file_size > soft_limit:
            raise ValueError(
                f"Storage allocation exceeded. DocMatrix used: {used} bytes, "
                f"allocation: {soft_limit} bytes. Increase allocation in Drive Settings."
            )
        
        # Generate UUID-based filename for storage
        file_ext = self._get_extension(filename)
        storage_name = f"{uuid.uuid4()}.{file_ext}" if file_ext else str(uuid.uuid4())
        # Get Drive API for the selected drive, not just the primary drive.
        drive_api = await drive_service.get_drive_api(user_id, drive_info["id"])

        # Ensure DocMatrix folder exists and is valid on this specific drive.
        folder_id = await self._ensure_docmatrix_folder(user_id, drive_info, drive_api)
        
        # Upload to Drive
        drive_file = await drive_api.create_file(
            name=storage_name,
            content=file_content,
            mime_type=mime_type,
            parent_id=folder_id if folder_id and folder_id != "root" else None
        )
        
        # Calculate checksum
        checksum = hashlib.sha256(file_content).hexdigest()
        
        # Create metadata
        file_metadata = {
            "user_id": user_id,
            "drive_id": drive_info["id"],
            "drive_file_id": drive_file["id"],
            "original_name": filename,
            "display_name": filename,
            "file_type": self._get_file_type(filename),
            "mime_type": mime_type,
            "file_extension": file_ext,
            "size_bytes": file_size,
            "checksum_sha256": checksum,
            "virtual_folder_id": virtual_folder_id,
            "description": description,
            "tags": tags,
            "status": "active",
            "sensitivity": "normal"
        }
        
        result = self.db.table("file_metadata").insert(file_metadata).execute()
        
        if not result.data:
            # Rollback: delete from Drive
            await drive_api.delete_file(drive_file["id"])
            raise ValueError("Failed to create file metadata")
        
        metadata = result.data[0]
        
        # Create initial version
        self.db.table("file_versions").insert({
            "file_id": metadata["id"],
            "version_number": "v1.0",
            "drive_version_id": drive_file["id"],
            "size_bytes": file_size,
            "checksum_sha256": checksum,
            "change_description": "Initial upload",
            "created_by": user_id
        }).execute()
        
        # Keep cached app usage for quick UI display
        self.db.table("google_drive_tokens").update({
            "last_synced_at": datetime.utcnow().isoformat()
        }).eq("id", drive_info["id"]).execute()
        
        # Log activity
        self._log_activity(user_id, "file", metadata["id"], "uploaded", {
            "filename": filename,
            "size": file_size
        })
        
        return metadata

    async def _ensure_docmatrix_folder(self, user_id: str, drive_info: dict, drive_api: GoogleDriveAPI) -> Optional[str]:
        """Ensure uploads are stored under a visible DocMatrix folder for the selected drive."""
        stored_folder_id = drive_info.get("folder_id")

        # If we already have a non-root folder, verify it still exists and is a folder.
        if stored_folder_id and stored_folder_id != "root":
            try:
                folder = await drive_api.get_folder(stored_folder_id)
                if folder.get("mimeType") == "application/vnd.google-apps.folder":
                    return stored_folder_id
            except Exception:
                logger.warning("Stored DocMatrix folder id %s is no longer valid for drive %s", stored_folder_id, drive_info.get("id"))

        # Try to reuse an existing top-level DocMatrix folder before creating a new one.
        try:
            existing = await drive_api.list_files(
                query="mimeType = 'application/vnd.google-apps.folder' and name = 'DocMatrix' and 'root' in parents",
                page_size=1,
            )
            existing_folders = existing.get("files", [])
            if existing_folders:
                folder_id = existing_folders[0]["id"]
                self.db.table("google_drive_tokens").update({
                    "folder_id": folder_id,
                    "folder_name": "DocMatrix"
                }).eq("id", drive_info["id"]).execute()
                return folder_id
        except Exception as e:
            logger.warning("Failed searching existing DocMatrix folder: %s", e)

        # Create a dedicated DocMatrix folder at Drive root.
        try:
            docmatrix_folder = await drive_api.create_folder("DocMatrix")
            folder_id = docmatrix_folder["id"]
            self.db.table("google_drive_tokens").update({
                "folder_id": folder_id,
                "folder_name": "DocMatrix"
            }).eq("id", drive_info["id"]).execute()
            logger.info("Created DocMatrix folder %s for user %s on drive %s", folder_id, user_id, drive_info.get("id"))
            return folder_id
        except Exception as e:
            logger.warning("Could not create DocMatrix folder for drive %s: %s. Using Drive root.", drive_info.get("id"), e)
            return None
    
    async def get_documents(
        self,
        user_id: str,
        view: str = "home",
        folder_id: Optional[str] = None,
        search: Optional[str] = None,
        tag: Optional[str] = None,
        file_type: Optional[str] = None,
        page: int = 1,
        page_size: int = 50
    ) -> Tuple[List[dict], int]:
        """Get documents with filters"""
        query = self.db.table("file_metadata").select("*").eq("user_id", user_id)
        
        # Base filter - not deleted
        query = query.is_("deleted_at", "null")
        
        if search:
            query = query.ilike("display_name", f"%{search}%")
        elif view == "folder" or view == "home":
            if folder_id:
                query = query.eq("virtual_folder_id", folder_id)
            else:
                query = query.is_("virtual_folder_id", "null")
        elif view == "all":
            pass  # No additional filter
        elif view == "favorites":
            query = query.eq("is_favorite", True)
        elif view == "trash":
            # Override to show deleted
            query = self.db.table("file_metadata").select("*").eq(
                "user_id", user_id
            ).not_.is_("deleted_at", "null")
        elif view == "recent":
            query = query.order("updated_at", desc=True).limit(10)
        
        if tag:
            query = query.contains("tags", [tag])
        
        if file_type:
            query = query.eq("file_type", file_type)
        
        # Pagination
        offset = (page - 1) * page_size
        query = query.range(offset, offset + page_size - 1)
        
        result = query.execute()
        documents = result.data or []
        
        # Get folder names
        folder_ids = [d["virtual_folder_id"] for d in documents if d.get("virtual_folder_id")]
        folders = {}
        if folder_ids:
            folder_result = self.db.table("virtual_folders").select("id, name").in_("id", folder_ids).execute()
            folders = {f["id"]: f["name"] for f in (folder_result.data or [])}
        
        # Enrich documents
        for doc in documents:
            doc["virtual_folder_name"] = folders.get(doc.get("virtual_folder_id"))
            # Add UI-compatible fields
            doc["type"] = "file"
            doc["name"] = doc["display_name"]
            doc["date"] = doc["updated_at"][:10] if doc.get("updated_at") else ""
            doc["size"] = doc.get("size_bytes", 0)
            doc["favorite"] = doc.get("is_favorite", False)
            doc["fileType"] = doc.get("file_type")
            doc["parentId"] = doc.get("virtual_folder_id")
            doc["trash"] = doc.get("deleted_at") is not None
        
        # Get total count
        count_result = self.db.table("file_metadata").select(
            "id", count="exact"
        ).eq("user_id", user_id).is_("deleted_at", "null").execute()
        
        total = count_result.count if hasattr(count_result, 'count') else len(documents)
        
        return documents, total
    
    async def get_document(self, user_id: str, document_id: str) -> dict:
        """Get single document"""
        result = self.db.table("file_metadata").select("*").eq(
            "id", document_id
        ).eq(
            "user_id", user_id
        ).execute()
        
        if not result.data:
            raise ValueError("Document not found")
        
        doc = result.data[0]
        
        # Update last accessed
        self.db.table("file_metadata").update({
            "last_accessed_at": datetime.utcnow().isoformat()
        }).eq("id", document_id).execute()
        
        # Add UI-compatible fields
        doc["type"] = "file"
        doc["name"] = doc["display_name"]
        doc["date"] = doc["updated_at"][:10] if doc.get("updated_at") else ""
        doc["size"] = doc.get("size_bytes", 0)
        doc["favorite"] = doc.get("is_favorite", False)
        doc["fileType"] = doc.get("file_type")
        doc["parentId"] = doc.get("virtual_folder_id")
        doc["trash"] = doc.get("deleted_at") is not None
        
        return doc
    
    async def get_download_url(self, user_id: str, document_id: str) -> str:
        """Get download URL for document"""
        doc = await self.get_document(user_id, document_id)

        drive_api, resolved_drive_id = await self._resolve_drive_api_for_document(user_id, doc)
        if resolved_drive_id and not doc.get("drive_id"):
            self.db.table("file_metadata").update({"drive_id": resolved_drive_id}).eq("id", document_id).execute()

        return await drive_api.get_download_url(doc["drive_file_id"])
    
    async def download_document(self, user_id: str, document_id: str) -> Tuple[bytes, str, str]:
        """Download document content"""
        doc = await self.get_document(user_id, document_id)

        drive_api, resolved_drive_id = await self._resolve_drive_api_for_document(user_id, doc)
        if resolved_drive_id and not doc.get("drive_id"):
            self.db.table("file_metadata").update({"drive_id": resolved_drive_id}).eq("id", document_id).execute()

        content = await drive_api.download_file(doc["drive_file_id"])

        return content, doc["original_name"], doc.get("mime_type", "application/octet-stream")

    async def download_document_stream(self, user_id: str, document_id: str):
        """Stream document content"""
        doc = await self.get_document(user_id, document_id)

        drive_api, resolved_drive_id = await self._resolve_drive_api_for_document(user_id, doc)
        if resolved_drive_id and not doc.get("drive_id"):
            self.db.table("file_metadata").update({"drive_id": resolved_drive_id}).eq("id", document_id).execute()

        stream = drive_api.download_file_stream(doc["drive_file_id"])

        return stream, doc["original_name"], doc.get("mime_type", "application/octet-stream")

    async def _resolve_drive_api_for_document(self, user_id: str, doc: dict):
        """Resolve the correct drive API for a document, including legacy rows with missing drive_id."""
        preferred_drive_id = doc.get("drive_id")
        drive_ids = []
        if preferred_drive_id:
            drive_ids.append(preferred_drive_id)

        drives_result = self.db.table("google_drive_tokens").select("id").eq("user_id", user_id).execute()
        for drive in drives_result.data or []:
            drive_id = drive.get("id")
            if drive_id and drive_id not in drive_ids:
                drive_ids.append(drive_id)

        last_error = None
        for drive_id in drive_ids:
            try:
                drive_api = await drive_service.get_drive_api(user_id, drive_id)
                await drive_api.get_file(doc["drive_file_id"], fields="id")
                return drive_api, drive_id
            except Exception as error:
                last_error = error

        if preferred_drive_id:
            if last_error:
                raise ValueError(f"Could not resolve Drive for this document: {last_error}")
            drive_api = await drive_service.get_drive_api(user_id, preferred_drive_id)
            return drive_api, preferred_drive_id

        if last_error:
            raise ValueError(f"Could not resolve Drive for this document: {last_error}")
        raise ValueError("No linked drive found for this document")
    
    async def update_document(
        self,
        user_id: str,
        document_id: str,
        updates: dict
    ) -> dict:
        """Update document metadata"""
        # Verify ownership
        existing = self.db.table("file_metadata").select("id").eq(
            "id", document_id
        ).eq(
            "user_id", user_id
        ).execute()
        
        if not existing.data:
            raise ValueError("Document not found")
        
        # Filter allowed updates
        allowed = {
            "display_name", "virtual_folder_id", "description", "tags",
            "category", "sensitivity", "status", "is_favorite", "notes", "custom_metadata"
        }
        filtered = {k: v for k, v in updates.items() if k in allowed and v is not None}
        
        if not filtered:
            return await self.get_document(user_id, document_id)
        
        result = self.db.table("file_metadata").update(filtered).eq(
            "id", document_id
        ).execute()
        
        # Log activity
        self._log_activity(user_id, "file", document_id, "updated", filtered)
        
        return await self.get_document(user_id, document_id)
    
    async def toggle_favorite(self, user_id: str, document_id: str) -> dict:
        """Toggle favorite status"""
        doc = await self.get_document(user_id, document_id)
        new_favorite = not doc.get("is_favorite", False)
        
        self.db.table("file_metadata").update({
            "is_favorite": new_favorite
        }).eq("id", document_id).execute()
        
        action = "favorited" if new_favorite else "unfavorited"
        self._log_activity(user_id, "file", document_id, action, {})
        
        return await self.get_document(user_id, document_id)
    
    async def move_document(
        self,
        user_id: str,
        document_id: str,
        target_folder_id: Optional[str]
    ) -> dict:
        """Move document to folder"""
        # Verify ownership
        doc = await self.get_document(user_id, document_id)
        
        # Verify target folder if specified
        if target_folder_id:
            folder = self.db.table("virtual_folders").select("id").eq(
                "id", target_folder_id
            ).eq(
                "user_id", user_id
            ).execute()
            
            if not folder.data:
                raise ValueError("Target folder not found")
        
        self.db.table("file_metadata").update({
            "virtual_folder_id": target_folder_id
        }).eq("id", document_id).execute()
        
        self._log_activity(user_id, "file", document_id, "moved", {
            "to_folder": target_folder_id
        })
        
        return await self.get_document(user_id, document_id)
    
    async def duplicate_document(self, user_id: str, document_id: str) -> dict:
        """Duplicate a document"""
        doc = await self.get_document(user_id, document_id)
        
        # Download original
        content, _, mime_type = await self.download_document(user_id, document_id)
        
        # Create new name
        name = doc["display_name"]
        if '.' in name:
            base, ext = name.rsplit('.', 1)
            new_name = f"{base} - Copy.{ext}"
        else:
            new_name = f"{name} - Copy"
        
        # Upload as new file
        new_doc = await self.upload_file(
            user_id=user_id,
            file_content=content,
            filename=new_name,
            mime_type=mime_type,
            virtual_folder_id=doc.get("virtual_folder_id"),
            description=doc.get("description"),
            tags=doc.get("tags", [])
        )
        
        self._log_activity(user_id, "file", new_doc["id"], "duplicated", {
            "from": document_id
        })
        
        return new_doc
    
    async def request_delete_otp(self, user_id: str, document_id: str) -> bool:
        """Request OTP for permanent deletion"""
        doc = await self.get_document(user_id, document_id)
        
        # Get user email
        user = self.db.table("users").select("email").eq("id", user_id).execute()
        if not user.data:
            raise ValueError("User not found")
        
        email = user.data[0]["email"]
        
        otp = await otp_service.create_otp(email, "delete_file", user_id)
        await email_service.send_critical_action_otp(
            email,
            otp,
            "Delete File",
            f"File: {doc['display_name']}"
        )
        
        return True
    
    async def delete_document(
        self,
        user_id: str,
        document_id: str,
        permanent: bool = False,
        otp: Optional[str] = None
    ) -> bool:
        """Delete document (soft or permanent)"""
        doc = await self.get_document(user_id, document_id)
        
        if permanent:
            # Require OTP for permanent deletion
            if not otp:
                raise ValueError("OTP required for permanent deletion")
            
            user = self.db.table("users").select("email").eq("id", user_id).execute()
            if not user.data:
                raise ValueError("User not found")
            
            email = user.data[0]["email"]
            
            success, message = await otp_service.verify_otp(email, otp, "delete_file")
            if not success:
                raise ValueError(message)
            
            # Delete from Drive
            try:
                drive_api = await drive_service.get_drive_api(user_id, doc.get("drive_id"))
                await drive_api.delete_file(doc["drive_file_id"])
            except Exception as e:
                logger.warning(f"Failed to delete from Drive: {e}")
            
            # Delete metadata
            self.db.table("file_metadata").delete().eq("id", document_id).execute()
            
            # Update quota
            drive = self.db.table("google_drive_tokens").select("id, quota_bytes_used").eq(
                "user_id", user_id
            ).execute()
            
            if drive.data:
                used = drive.data[0].get("quota_bytes_used", 0) or 0
                new_used = max(0, used - (doc.get("size_bytes", 0) or 0))
                self.db.table("google_drive_tokens").update({
                    "quota_bytes_used": new_used
                }).eq("id", drive.data[0]["id"]).execute()
            
            self._log_activity(user_id, "file", document_id, "permanently_deleted", {
                "filename": doc["display_name"]
            })
        else:
            # Soft delete (move to trash)
            self.db.table("file_metadata").update({
                "deleted_at": datetime.utcnow().isoformat()
            }).eq("id", document_id).execute()
            
            self._log_activity(user_id, "file", document_id, "trashed", {})
        
        return True
    
    async def restore_document(self, user_id: str, document_id: str) -> dict:
        """Restore document from trash"""
        # Check document exists and is in trash
        result = self.db.table("file_metadata").select("*").eq(
            "id", document_id
        ).eq(
            "user_id", user_id
        ).not_.is_("deleted_at", "null").execute()
        
        if not result.data:
            raise ValueError("Document not found in trash")
        
        self.db.table("file_metadata").update({
            "deleted_at": None
        }).eq("id", document_id).execute()
        
        self._log_activity(user_id, "file", document_id, "restored", {})
        
        return await self.get_document(user_id, document_id)
    
    async def get_versions(self, user_id: str, document_id: str) -> List[dict]:
        """Get document version history"""
        # Verify ownership
        await self.get_document(user_id, document_id)
        
        result = self.db.table("file_versions").select("*").eq(
            "file_id", document_id
        ).order("created_at", desc=True).execute()
        
        return result.data or []

    def _next_version_number(self, previous_version: Optional[str]) -> str:
        if not previous_version:
            return "v1.1"

        match = re.match(r"^v?(\d+)(?:\.(\d+))?$", str(previous_version).strip(), re.IGNORECASE)
        if not match:
            return "v1.1"

        major = int(match.group(1))
        minor = int(match.group(2) or 0) + 1
        return f"v{major}.{minor}"

    async def upload_version(
        self,
        user_id: str,
        document_id: str,
        file_content: bytes,
        mime_type: str,
        change_description: Optional[str] = None
    ) -> dict:
        """Upload a new version for an existing document by updating the same Drive file."""
        if not file_content:
            raise ValueError("Version file content is empty")

        doc = await self.get_document(user_id, document_id)

        drive_api, resolved_drive_id = await self._resolve_drive_api_for_document(user_id, doc)
        if resolved_drive_id and not doc.get("drive_id"):
            self.db.table("file_metadata").update({"drive_id": resolved_drive_id}).eq("id", document_id).execute()

        effective_mime_type = mime_type or doc.get("mime_type") or "application/octet-stream"
        updated_drive_file = await drive_api.update_file(
            file_id=doc["drive_file_id"],
            content=file_content,
            mime_type=effective_mime_type,
        )

        size_bytes = len(file_content)
        checksum = hashlib.sha256(file_content).hexdigest()

        self.db.table("file_metadata").update({
            "size_bytes": size_bytes,
            "checksum_sha256": checksum,
            "mime_type": effective_mime_type,
            "updated_at": datetime.utcnow().isoformat(),
        }).eq("id", document_id).execute()

        latest_version_result = self.db.table("file_versions").select("version_number").eq(
            "file_id", document_id
        ).order("created_at", desc=True).limit(1).execute()

        previous_version = None
        if latest_version_result.data:
            previous_version = latest_version_result.data[0].get("version_number")

        version_number = self._next_version_number(previous_version)

        insert_result = self.db.table("file_versions").insert({
            "file_id": document_id,
            "version_number": version_number,
            "drive_version_id": updated_drive_file.get("id", doc["drive_file_id"]),
            "size_bytes": size_bytes,
            "checksum_sha256": checksum,
            "change_description": change_description or "Edited with PDF Power Tools",
            "created_by": user_id,
        }).execute()

        if not insert_result.data:
            raise ValueError("Failed to record document version")

        version = insert_result.data[0]

        self._log_activity(user_id, "file", document_id, "version_uploaded", {
            "version_number": version_number,
            "size": size_bytes,
            "change_description": version.get("change_description"),
        })

        return version
    
    async def add_share(
        self,
        user_id: str,
        document_id: str,
        email: str,
        permission: str = "viewer"
    ) -> dict:
        """Share document with another user"""
        doc = await self.get_document(user_id, document_id)
        
        # Check if already shared
        existing = self.db.table("file_shares").select("id").eq(
            "file_id", document_id
        ).eq(
            "shared_with_email", email
        ).execute()
        
        if existing.data:
            raise ValueError("Already shared with this email")
        
        result = self.db.table("file_shares").insert({
            "file_id": document_id,
            "shared_by": user_id,
            "shared_with_email": email,
            "permission": permission
        }).execute()
        
        self._log_activity(user_id, "share", document_id, "shared", {
            "with": email,
            "permission": permission
        })
        
        return result.data[0] if result.data else {}
    
    async def generate_public_link(
        self,
        user_id: str,
        document_id: str
    ):
        """
        Create public share link
        """

        doc = await self.get_document(user_id, document_id)

        existing = self.db.table(
            "document_public_links"
        ).select("*").eq(
           "document_id",
           document_id
        ).execute()

        if existing.data:
            token = existing.data[0]["token"]
        else:
            token = secrets.token_urlsafe(32)

            self.db.table(
                "document_public_links"
            ).insert({
                "document_id": document_id,
                "token": token,
                "created_by": user_id
            }).execute()

        return {
            "token": token
        }
    
    async def get_public_document(
        self,
        token: str
    ):
        """
        Resolve public token to document
        """

        result = self.db.table(
            "document_public_links"
        ).select("*").eq(
            "token",
            token
        ).execute()

        if not result.data:
            raise ValueError("Invalid share link")

        document_id = result.data[0]["document_id"]

        doc = self.db.table(
            "file_metadata"
        ).select("*").eq(
            "id",
            document_id
        ).execute()

        if not doc.data:
            raise ValueError("Document not found")

        return doc.data[0]

    async def remove_share(self, user_id: str, document_id: str, email: str) -> bool:
        """Remove share from document"""
        await self.get_document(user_id, document_id)
        
        self.db.table("file_shares").delete().eq(
            "file_id", document_id
        ).eq(
            "shared_with_email", email
        ).execute()
        
        self._log_activity(user_id, "share", document_id, "unshared", {
            "with": email
        })
        
        return True
    
    async def get_shares(self, user_id: str, document_id: str) -> List[dict]:
        """Get document shares"""
        await self.get_document(user_id, document_id)
        
        result = self.db.table("file_shares").select("*").eq(
            "file_id", document_id
        ).execute()
        
        return result.data or []
    
    async def add_tag(self, user_id: str, document_id: str, tag: str) -> dict:
        """Add tag to document"""
        doc = await self.get_document(user_id, document_id)
        
        tags = doc.get("tags", [])
        if tag not in tags:
            tags.append(tag)
            self.db.table("file_metadata").update({
                "tags": tags
            }).eq("id", document_id).execute()
            
            self._log_activity(user_id, "file", document_id, "tag_added", {"tag": tag})
        
        return await self.get_document(user_id, document_id)
    
    async def remove_tag(self, user_id: str, document_id: str, tag: str) -> dict:
        """Remove tag from document"""
        doc = await self.get_document(user_id, document_id)
        
        tags = [t for t in doc.get("tags", []) if t != tag]
        self.db.table("file_metadata").update({
            "tags": tags
        }).eq("id", document_id).execute()
        
        self._log_activity(user_id, "file", document_id, "tag_removed", {"tag": tag})
        
        return await self.get_document(user_id, document_id)
    
    def _log_activity(
        self,
        user_id: str,
        entity_type: str,
        entity_id: Optional[str],
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
documents_service = DocumentsService()
