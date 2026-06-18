"""Pydantic schemas for MEGA storage API."""

from datetime import datetime
from pydantic import BaseModel, EmailStr, Field
from typing import List, Optional


class MegaConnectRequest(BaseModel):
    mega_email: EmailStr
    mega_password: str = Field(min_length=1, max_length=512)
    force_reconnect: bool = False


class MegaConnectResponse(BaseModel):
    success: bool
    message: str
    folder_name: str
    connected_at: datetime
    reconnect_required: bool = False


class MegaStatusResponse(BaseModel):
    connected: bool
    mega_email: Optional[str] = None
    folder_name: Optional[str] = None
    connected_at: Optional[datetime] = None
    warning: Optional[str] = None
    security_mode: Optional[str] = None


class MegaFileItem(BaseModel):
    file_id: str
    name: str
    size_bytes: int = 0
    uploaded_at: Optional[datetime] = None


class MegaFileListResponse(BaseModel):
    success: bool
    files: List[MegaFileItem]
    count: int


class MegaActionResponse(BaseModel):
    success: bool
    message: str

