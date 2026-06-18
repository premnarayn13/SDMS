"""
Drive Service Schemas
Multi-Drive Support with adjustable storage limits
"""
from pydantic import BaseModel, EmailStr, Field, validator
from typing import Optional, List
from datetime import datetime


# Available colors for drive visual distinction
DRIVE_COLORS = [
    "#3b82f6",  # Blue
    "#8b5cf6",  # Purple 
    "#10b981",  # Green
    "#f59e0b",  # Amber
    "#ef4444",  # Red
    "#ec4899",  # Pink
    "#6366f1",  # Indigo
    "#14b8a6",  # Teal
]


class DriveConnectInitiate(BaseModel):
    """Initiate drive connection"""
    redirect_uri: Optional[str] = None
    display_name: Optional[str] = None  # Custom name for the drive


class DriveConnectCallback(BaseModel):
    """Drive OAuth callback data"""
    code: str
    state: Optional[str] = None


class DriveVerifyOTP(BaseModel):
    """Verify OTP for drive linking"""
    otp: str
    pending_drive_id: str
    display_name: Optional[str] = None  # Optional custom name


# Reserve 2GB for user's personal Drive usage
DRIVE_RESERVE_BYTES = 2 * 1024 * 1024 * 1024  # 2GB
MIN_ALLOCATION_BYTES = 1 * 1024 * 1024 * 1024  # 1GB minimum
MAX_DRIVE_STORAGE_BYTES = 15 * 1024 * 1024 * 1024  # 15GB max (free Google Drive)
MAX_ALLOCATABLE_BYTES = 13 * 1024 * 1024 * 1024  # 13GB max allocation (15GB - 2GB reserve)


class DriveResponse(BaseModel):
    """Linked drive response"""
    id: str
    drive_email: str
    folder_id: str
    folder_name: Optional[str] = None
    display_name: Optional[str] = None
    drive_index: int = 0
    label: Optional[str] = None  # Auto-generated: "Drive A", "Drive B", etc.
    quota_bytes_total: Optional[int] = None
    quota_bytes_used: Optional[int] = None
    quota_bytes_available: Optional[int] = None  # Actual available in Drive
    max_allocatable_bytes: Optional[int] = None  # Max we can allocate (available - 2GB reserve)
    soft_limit_bytes: int
    allocated_storage_bytes: int = 10737418240  # 10GB default
    is_primary: bool
    status: str = "active"
    color: str = "#3b82f6"
    verified_at: Optional[datetime] = None
    last_synced_at: Optional[datetime] = None
    created_at: datetime
    
    @property
    def computed_label(self) -> str:
        """Get display label for the drive"""
        if self.display_name:
            return self.display_name
        return f"Drive {chr(65 + self.drive_index)}"  # A, B, C, etc.


class DriveListResponse(BaseModel):
    """List of all linked drives"""
    drives: List[DriveResponse]
    total_count: int
    total_allocated_bytes: int
    total_used_bytes: int


class DriveQuotaResponse(BaseModel):
    """Drive quota response"""
    drive_id: str
    total_bytes: int
    used_bytes: int
    available_bytes: int
    max_allocatable_bytes: int  # Max allocation allowed (available - 2GB reserve)
    soft_limit_bytes: int
    allocated_storage_bytes: int
    percent_used: float
    percent_of_limit: float
    percent_of_allocation: float


class AllDrivesQuotaResponse(BaseModel):
    """Combined quota for all drives"""
    drives: List[DriveQuotaResponse]
    combined_total_bytes: int
    combined_used_bytes: int
    combined_allocated_bytes: int
    combined_available_bytes: int
    combined_percent_used: float


class DriveUpdateRequest(BaseModel):
    """Update drive settings"""
    display_name: Optional[str] = Field(None, max_length=100)
    allocated_storage_bytes: Optional[int] = Field(None, ge=1073741824)  # Min 1GB
    color: Optional[str] = None
    is_primary: Optional[bool] = None
    
    @validator('allocated_storage_bytes')
    def validate_allocation(cls, v):
        if v is not None:
            # Max 100GB allocation per drive
            max_bytes = 100 * 1024 * 1024 * 1024
            if v > max_bytes:
                raise ValueError(f"Maximum allocation is 100GB")
        return v
    
    @validator('color')
    def validate_color(cls, v):
        if v is not None and not v.startswith('#'):
            raise ValueError("Color must be a hex color code")
        return v


class DriveUnlinkRequest(BaseModel):
    """Request to unlink drive"""
    drive_id: str  # Specify which drive to unlink
    password: str  # OTP confirmation required


class PendingDriveInfo(BaseModel):
    """Pending drive link info"""
    pending_drive_id: str
    drive_email: str
    folder_name: Optional[str] = None
    message: str


class StorageAllocationRequest(BaseModel):
    """Adjust storage allocation for a drive"""
    allocated_bytes: int = Field(..., ge=1073741824)  # Min 1GB, max validated against actual drive space
    
    @validator('allocated_bytes')
    def validate_allocation(cls, v):
        # Must be in GB increments
        gb = 1024 * 1024 * 1024
        if v % gb != 0:
            # Round to nearest GB
            v = round(v / gb) * gb
        # Minimum is 1GB
        if v < gb:
            v = gb
        return v
