"""
Google OAuth Helper for Drive Integration
"""
import httpx
from typing import Optional, Tuple
import logging
from urllib.parse import urlencode
import secrets

from ...config import settings

logger = logging.getLogger(__name__)


class GoogleDriveOAuth:
    """Google Drive OAuth helper"""
    
    # Scopes for Drive access - using non-sensitive scopes that work in testing mode
    SCOPES = [
        "https://www.googleapis.com/auth/drive.file",  # Manage files created by app
        "https://www.googleapis.com/auth/drive.appdata",  # App data folder
        "https://www.googleapis.com/auth/userinfo.email",
        "https://www.googleapis.com/auth/userinfo.profile"
    ]
    
    def __init__(self):
        self.client_id = settings.GOOGLE_CLIENT_ID
        self.client_secret = settings.GOOGLE_CLIENT_SECRET
        self.redirect_uri = settings.GOOGLE_DRIVE_REDIRECT_URI
    
    def get_auth_url(self, state: Optional[str] = None) -> str:
        """Generate Google OAuth URL for Drive access"""
        if not state:
            state = secrets.token_urlsafe(32)
        
        params = {
            "client_id": self.client_id,
            "redirect_uri": self.redirect_uri,
            "response_type": "code",
            "scope": " ".join(self.SCOPES),
            "access_type": "offline",
            "prompt": "consent",
            "state": state
        }
        
        return f"https://accounts.google.com/o/oauth2/v2/auth?{urlencode(params)}"
    
    async def exchange_code(self, code: str) -> dict:
        """Exchange authorization code for tokens"""
        async with httpx.AsyncClient() as client:
            response = await client.post(
                "https://oauth2.googleapis.com/token",
                data={
                    "client_id": self.client_id,
                    "client_secret": self.client_secret,
                    "code": code,
                    "grant_type": "authorization_code",
                    "redirect_uri": self.redirect_uri
                }
            )
            
            if response.status_code != 200:
                logger.error(f"Token exchange failed: {response.text}")
                raise ValueError("Failed to exchange authorization code")
            
            return response.json()
    
    async def refresh_access_token(self, refresh_token: str) -> dict:
        """Refresh access token"""
        async with httpx.AsyncClient() as client:
            response = await client.post(
                "https://oauth2.googleapis.com/token",
                data={
                    "client_id": self.client_id,
                    "client_secret": self.client_secret,
                    "refresh_token": refresh_token,
                    "grant_type": "refresh_token"
                }
            )
            
            if response.status_code != 200:
                logger.error(f"Token refresh failed: {response.text}")
                raise ValueError("Failed to refresh access token")
            
            return response.json()
    
    async def get_user_info(self, access_token: str) -> dict:
        """Get Google user info"""
        async with httpx.AsyncClient() as client:
            response = await client.get(
                "https://www.googleapis.com/oauth2/v2/userinfo",
                headers={"Authorization": f"Bearer {access_token}"}
            )
            
            if response.status_code != 200:
                raise ValueError("Failed to get user info")
            
            return response.json()
    
    async def revoke_token(self, token: str) -> bool:
        """Revoke OAuth token"""
        async with httpx.AsyncClient() as client:
            response = await client.post(
                f"https://oauth2.googleapis.com/revoke?token={token}"
            )
            return response.status_code == 200


class GoogleDriveAPI:
    """Google Drive API wrapper"""
    
    def __init__(self, access_token: str):
        self.access_token = access_token
        self.base_url = "https://www.googleapis.com/drive/v3"
        self.upload_url = "https://www.googleapis.com/upload/drive/v3"
    
    async def _request(
        self,
        method: str,
        endpoint: str,
        **kwargs
    ) -> dict:
        """Make authenticated request to Drive API"""
        headers = kwargs.pop("headers", {})
        headers["Authorization"] = f"Bearer {self.access_token}"
        
        async with httpx.AsyncClient() as client:
            response = await client.request(
                method,
                f"{self.base_url}/{endpoint}",
                headers=headers,
                **kwargs
            )
            
            if response.status_code == 401:
                raise ValueError("Access token expired or invalid")
            
            if response.status_code >= 400:
                logger.error(f"Drive API error: {response.text}")
                raise ValueError(f"Drive API error: {response.status_code}")
            
            return response.json() if response.content else {}
    
    async def get_about(self) -> dict:
        """Get Drive about info including quota"""
        return await self._request(
            "GET",
            "about",
            params={"fields": "user,storageQuota"}
        )
    
    async def get_storage_quota(self) -> dict:
        """Get storage quota information"""
        about = await self.get_about()
        quota = about.get("storageQuota", {})
        
        return {
            "total": int(quota.get("limit", 0)),
            "used": int(quota.get("usage", 0)),
            "available": int(quota.get("limit", 0)) - int(quota.get("usage", 0))
        }
    
    async def get_file(self, file_id: str, fields: str = "*") -> dict:
        """Get file metadata"""
        return await self._request(
            "GET",
            f"files/{file_id}",
            params={"fields": fields}
        )
    
    async def get_folder(self, folder_id: str) -> dict:
        """Get folder metadata"""
        return await self.get_file(folder_id, "id,name,mimeType,parents")
    
    async def list_files(
        self,
        folder_id: Optional[str] = None,
        query: Optional[str] = None,
        page_size: int = 100,
        page_token: Optional[str] = None
    ) -> dict:
        """List files in folder or by query"""
        q_parts = ["trashed = false"]
        
        if folder_id:
            q_parts.append(f"'{folder_id}' in parents")
        
        if query:
            q_parts.append(query)
        
        params = {
            "q": " and ".join(q_parts),
            "pageSize": page_size,
            "fields": "nextPageToken,files(id,name,mimeType,size,createdTime,modifiedTime,parents,webViewLink)"
        }
        
        if page_token:
            params["pageToken"] = page_token
        
        return await self._request("GET", "files", params=params)
    
    async def create_file(
        self,
        name: str,
        content: bytes,
        mime_type: str,
        parent_id: Optional[str] = None
    ) -> dict:
        """Upload a file to Drive"""
        metadata = {
            "name": name,
            "mimeType": mime_type
        }
        
        if parent_id:
            metadata["parents"] = [parent_id]
        
        async with httpx.AsyncClient() as client:
            # Multipart upload
            response = await client.post(
                f"{self.upload_url}/files",
                params={"uploadType": "multipart", "fields": "id,name,mimeType,size,webViewLink"},
                headers={"Authorization": f"Bearer {self.access_token}"},
                files={
                    "metadata": ("metadata", str(metadata).replace("'", '"'), "application/json"),
                    "file": (name, content, mime_type)
                }
            )
            
            if response.status_code >= 400:
                raise ValueError(f"Upload failed: {response.text}")
            
            return response.json()
    
    async def update_file(
        self,
        file_id: str,
        content: bytes,
        mime_type: str
    ) -> dict:
        """Update file content"""
        async with httpx.AsyncClient() as client:
            response = await client.patch(
                f"{self.upload_url}/files/{file_id}",
                params={"uploadType": "media", "fields": "id,name,mimeType,size,modifiedTime"},
                headers={
                    "Authorization": f"Bearer {self.access_token}",
                    "Content-Type": mime_type
                },
                content=content
            )
            
            if response.status_code >= 400:
                raise ValueError(f"Update failed: {response.text}")
            
            return response.json()
    
    async def delete_file(self, file_id: str) -> bool:
        """Delete a file (move to trash)"""
        await self._request("DELETE", f"files/{file_id}")
        return True
    
    async def get_download_url(self, file_id: str) -> str:
        """Get download URL for a file"""
        return f"https://www.googleapis.com/drive/v3/files/{file_id}?alt=media"
    
    async def download_file(self, file_id: str) -> bytes:
        """Download file content"""
        async with httpx.AsyncClient(timeout=None) as client:
            response = await client.get(
                f"{self.base_url}/files/{file_id}",
                params={"alt": "media"},
                headers={"Authorization": f"Bearer {self.access_token}"}
            )
            
            if response.status_code >= 400:
                raise ValueError(f"Download failed: {response.text}")
            
            return response.content

    async def download_file_stream(self, file_id: str):
        """Stream file content"""
        async with httpx.AsyncClient(timeout=None) as client:
            async with client.stream(
                "GET",
                f"{self.base_url}/files/{file_id}",
                params={"alt": "media"},
                headers={"Authorization": f"Bearer {self.access_token}"}
            ) as response:
                if response.status_code >= 400:
                    raise ValueError(f"Download failed: {await response.aread()}")

                async for chunk in response.aiter_bytes():
                    yield chunk
    
    async def create_folder(self, name: str, parent_id: Optional[str] = None) -> dict:
        """Create a folder"""
        metadata = {
            "name": name,
            "mimeType": "application/vnd.google-apps.folder"
        }
        
        if parent_id:
            metadata["parents"] = [parent_id]
        
        async with httpx.AsyncClient() as client:
            response = await client.post(
                f"{self.base_url}/files",
                headers={
                    "Authorization": f"Bearer {self.access_token}",
                    "Content-Type": "application/json"
                },
                json=metadata,
                params={"fields": "id,name,mimeType"}
            )
            
            if response.status_code >= 400:
                raise ValueError(f"Folder creation failed: {response.text}")
            
            return response.json()


# Singleton OAuth instance
google_drive_oauth = GoogleDriveOAuth()
