"""
Documents Service Schemas
"""
from pydantic import BaseModel
from typing import Optional, List, Any
from datetime import datetime
from enum import Enum


class FileType(str, Enum):
    PDF = "PDF"
    WORD = "Word"
    EXCEL = "Excel"
    POWERPOINT = "PowerPoint"
    IMAGE = "Image"
    VIDEO = "Video"
    AUDIO = "Audio"
    TEXT = "Text"
    CODE = "Code"
    ARCHIVE = "Archive"
    OTHER = "Other"


class DocumentCreate(BaseModel):
    """Create document metadata after upload"""
    display_name: str
    virtual_folder_id: Optional[str] = None
    description: Optional[str] = None
    tags: List[str] = []
    category: Optional[str] = None
    sensitivity: Optional[str] = "normal"


class DocumentUpdate(BaseModel):
    """Update document metadata"""
    display_name: Optional[str] = None
    virtual_folder_id: Optional[str] = None
    description: Optional[str] = None
    tags: Optional[List[str]] = None
    category: Optional[str] = None
    sensitivity: Optional[str] = None
    status: Optional[str] = None
    is_favorite: Optional[bool] = None
    notes: Optional[str] = None
    custom_metadata: Optional[dict] = None


class DocumentResponse(BaseModel):
    """Document metadata response"""
    id: str
    drive_file_id: str
    original_name: str
    display_name: str
    file_type: Optional[str] = None
    mime_type: Optional[str] = None
    file_extension: Optional[str] = None
    size_bytes: Optional[int] = None
    checksum_sha256: Optional[str] = None
    is_favorite: bool = False
    tags: List[str] = []
    category: Optional[str] = None
    status: str = "active"
    sensitivity: str = "normal"
    description: Optional[str] = None
    notes: Optional[str] = None
    custom_metadata: Optional[dict] = None
    drive_id: Optional[str] = None
    virtual_folder_id: Optional[str] = None
    virtual_folder_name: Optional[str] = None
    created_at: datetime
    updated_at: datetime
    last_accessed_at: Optional[datetime] = None
    
    # Computed fields for UI compatibility
    type: str = "file"
    name: str = ""
    date: str = ""
    size: int = 0
    
    class Config:
        from_attributes = True


class DocumentListResponse(BaseModel):
    """List of documents response"""
    documents: List[DocumentResponse]
    total: int
    page: int
    page_size: int


class UploadResponse(BaseModel):
    """Upload response"""
    document: DocumentResponse
    message: str


class MoveDocumentRequest(BaseModel):
    """Move document to folder"""
    target_folder_id: Optional[str] = None


class ShareDocumentRequest(BaseModel):
    """Share document request"""
    email: str
    permission: str = "viewer"


class ShareResponse(BaseModel):
    """Share response"""
    id: str
    file_id: str
    shared_with_email: str
    permission: str
    created_at: datetime


class VersionResponse(BaseModel):
    """Version response"""
    id: str
    version_number: str
    size_bytes: Optional[int] = None
    change_description: Optional[str] = None
    created_at: datetime


class DeleteConfirmRequest(BaseModel):
    """Delete confirmation with OTP"""
    otp: str
    permanent: bool = False
