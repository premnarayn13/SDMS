"""
Database Models for DocMatrix
SQLAlchemy-style models mapped to Supabase tables
"""
from pydantic import BaseModel, Field, EmailStr
from typing import Optional, List, Any
from datetime import datetime
from uuid import UUID, uuid4
from enum import Enum


# ==================== ENUMS ====================

class AuthProvider(str, Enum):
    EMAIL = "email"
    GOOGLE = "google"


class AccountStatus(str, Enum):
    PENDING = "pending"
    ACTIVE = "active"
    SUSPENDED = "suspended"
    DELETED = "deleted"


class EntityType(str, Enum):
    FILE = "file"
    FOLDER = "folder"
    DRIVE = "drive"
    ACCOUNT = "account"


class Permission(str, Enum):
    VIEWER = "viewer"
    EDITOR = "editor"


class OTPPurpose(str, Enum):
    EMAIL_VERIFICATION = "email_verification"
    DRIVE_LINK = "drive_link"
    DELETE_FILE = "delete_file"
    DELETE_ACCOUNT = "delete_account"
    PASSWORD_RESET = "password_reset"
    MFA = "mfa"


class FileSensitivity(str, Enum):
    NORMAL = "normal"
    INTERNAL = "internal"
    CONFIDENTIAL = "confidential"
    RESTRICTED = "restricted"


class FileStatus(str, Enum):
    ACTIVE = "active"
    ARCHIVED = "archived"
    DRAFT = "draft"
    FINAL = "final"


# ==================== USER MODELS ====================

class UserBase(BaseModel):
    email: EmailStr
    name: Optional[str] = None
    avatar_url: Optional[str] = None


class UserCreate(UserBase):
    password: Optional[str] = None  # None for OAuth users
    auth_provider: AuthProvider = AuthProvider.EMAIL


class UserUpdate(BaseModel):
    name: Optional[str] = None
    avatar_url: Optional[str] = None


class User(UserBase):
    id: UUID
    auth_provider: AuthProvider = AuthProvider.EMAIL
    email_verified: bool = False
    account_status: AccountStatus = AccountStatus.PENDING
    mfa_enabled: bool = False
    created_at: datetime
    updated_at: datetime
    
    class Config:
        from_attributes = True


class UserInDB(User):
    password_hash: Optional[str] = None
    mfa_secret: Optional[str] = None


# ==================== AUTH MODELS ====================

class AuthSession(BaseModel):
    id: UUID = Field(default_factory=uuid4)
    user_id: UUID
    refresh_token_hash: str
    device_info: Optional[dict] = None
    ip_address: Optional[str] = None
    expires_at: datetime
    created_at: datetime = Field(default_factory=datetime.utcnow)
    revoked_at: Optional[datetime] = None


class TokenPair(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    expires_in: int


class TokenPayload(BaseModel):
    sub: str  # User ID
    exp: datetime
    iat: datetime
    type: str  # "access" or "refresh"
    email: Optional[str] = None


# ==================== OTP MODELS ====================

class OTPToken(BaseModel):
    id: UUID = Field(default_factory=uuid4)
    user_id: UUID
    purpose: OTPPurpose
    token_hash: str
    expires_at: datetime
    used_at: Optional[datetime] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)


class OTPVerify(BaseModel):
    email: EmailStr
    otp: str
    purpose: OTPPurpose


# ==================== DRIVE MODELS ====================

class LinkedDriveBase(BaseModel):
    drive_email: EmailStr
    folder_id: str
    folder_name: Optional[str] = None


class LinkedDriveCreate(LinkedDriveBase):
    access_token_encrypted: str
    refresh_token_encrypted: str
    token_expires_at: Optional[datetime] = None


class LinkedDrive(LinkedDriveBase):
    id: UUID
    user_id: UUID
    quota_bytes_total: Optional[int] = None
    quota_bytes_used: Optional[int] = None
    soft_limit_bytes: int = 10737418240  # 10GB
    is_primary: bool = True
    verified_at: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime
    
    class Config:
        from_attributes = True


class DriveQuota(BaseModel):
    total_bytes: int
    used_bytes: int
    available_bytes: int
    soft_limit_bytes: int
    percent_used: float


# ==================== VIRTUAL FOLDER MODELS ====================

class VirtualFolderBase(BaseModel):
    name: str
    parent_id: Optional[UUID] = None
    color: Optional[str] = None
    icon: Optional[str] = None


class VirtualFolderCreate(VirtualFolderBase):
    pass


class VirtualFolderUpdate(BaseModel):
    name: Optional[str] = None
    parent_id: Optional[UUID] = None
    color: Optional[str] = None
    icon: Optional[str] = None
    is_favorite: Optional[bool] = None


class VirtualFolder(VirtualFolderBase):
    id: UUID
    user_id: UUID
    is_favorite: bool = False
    created_at: datetime
    updated_at: datetime
    deleted_at: Optional[datetime] = None
    
    class Config:
        from_attributes = True


# ==================== FILE METADATA MODELS ====================

class FileMetadataBase(BaseModel):
    display_name: str
    file_type: Optional[str] = None
    mime_type: Optional[str] = None
    file_extension: Optional[str] = None
    description: Optional[str] = None
    tags: List[str] = []
    category: Optional[str] = None
    sensitivity: FileSensitivity = FileSensitivity.NORMAL
    custom_metadata: Optional[dict] = None


class FileMetadataCreate(FileMetadataBase):
    original_name: str
    drive_file_id: str
    virtual_folder_id: Optional[UUID] = None
    size_bytes: Optional[int] = None
    checksum_sha256: Optional[str] = None


class FileMetadataUpdate(BaseModel):
    display_name: Optional[str] = None
    virtual_folder_id: Optional[UUID] = None
    description: Optional[str] = None
    tags: Optional[List[str]] = None
    category: Optional[str] = None
    sensitivity: Optional[FileSensitivity] = None
    status: Optional[FileStatus] = None
    is_favorite: Optional[bool] = None
    custom_metadata: Optional[dict] = None


class FileMetadata(FileMetadataBase):
    id: UUID
    user_id: UUID
    drive_id: UUID
    drive_file_id: str
    virtual_folder_id: Optional[UUID] = None
    original_name: str
    size_bytes: Optional[int] = None
    checksum_sha256: Optional[str] = None
    is_favorite: bool = False
    status: FileStatus = FileStatus.ACTIVE
    created_at: datetime
    updated_at: datetime
    last_accessed_at: Optional[datetime] = None
    deleted_at: Optional[datetime] = None
    
    class Config:
        from_attributes = True


# ==================== FILE VERSION MODELS ====================

class FileVersionCreate(BaseModel):
    file_id: UUID
    version_number: str
    drive_version_id: Optional[str] = None
    size_bytes: Optional[int] = None
    checksum_sha256: Optional[str] = None
    change_description: Optional[str] = None


class FileVersion(FileVersionCreate):
    id: UUID
    created_by: UUID
    created_at: datetime
    
    class Config:
        from_attributes = True


# ==================== FILE SHARE MODELS ====================

class FileShareCreate(BaseModel):
    file_id: UUID
    shared_with_email: EmailStr
    permission: Permission = Permission.VIEWER
    expires_at: Optional[datetime] = None


class FileShare(FileShareCreate):
    id: UUID
    created_at: datetime
    
    class Config:
        from_attributes = True


# ==================== ACTIVITY LOG MODELS ====================

class ActivityLogCreate(BaseModel):
    user_id: UUID
    entity_type: EntityType
    entity_id: Optional[UUID] = None
    action: str
    details: Optional[dict] = None
    ip_address: Optional[str] = None


class ActivityLog(ActivityLogCreate):
    id: UUID
    created_at: datetime
    
    class Config:
        from_attributes = True


# ==================== AUDIT LOG MODELS ====================

class AuditLogCreate(BaseModel):
    user_id: Optional[UUID] = None
    action: str
    resource_type: Optional[str] = None
    resource_id: Optional[UUID] = None
    old_value: Optional[dict] = None
    new_value: Optional[dict] = None
    ip_address: Optional[str] = None
    user_agent: Optional[str] = None


class AuditLog(AuditLogCreate):
    id: UUID
    created_at: datetime
    
    class Config:
        from_attributes = True


# ==================== RESPONSE MODELS ====================

class MessageResponse(BaseModel):
    message: str
    success: bool = True


class PaginatedResponse(BaseModel):
    data: List[Any]
    total: int
    page: int
    page_size: int
    total_pages: int


class StorageInfo(BaseModel):
    used: int
    total: int
    percent: float
    drive_used: Optional[int] = None
    drive_total: Optional[int] = None
