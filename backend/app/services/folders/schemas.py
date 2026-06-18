"""
Folders Service Schemas
"""
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime


class FolderCreate(BaseModel):
    name: str
    parent_id: Optional[str] = None
    drive_id: Optional[str] = None
    description: Optional[str] = None
    color: Optional[str] = None
    icon: Optional[str] = None


class FolderUpdate(BaseModel):
    """Update folder request"""
    name: Optional[str] = None
    description: Optional[str] = None
    color: Optional[str] = None
    icon: Optional[str] = None
    parent_id: Optional[str] = None


class FolderResponse(BaseModel):
    """Folder response"""
    id: str
    name: str
    parent_id: Optional[str] = None
    drive_id: Optional[str] = None
    description: Optional[str] = None
    color: Optional[str] = None
    icon: Optional[str] = None
    file_count: int = 0
    created_at: datetime
    updated_at: datetime
    
    # UI-compatible fields
    type: str = "folder"
    date: str = ""
    size: int = 0
    
    class Config:
        from_attributes = True


class FolderWithContents(FolderResponse):
    """Folder with children and files"""
    children: List["FolderResponse"] = []
    files: List[dict] = []


class FolderTreeNode(BaseModel):
    """Folder tree node for navigation"""
    id: str
    name: str
    parent_id: Optional[str] = None
    children: List["FolderTreeNode"] = []
    
    class Config:
        from_attributes = True


class BreadcrumbItem(BaseModel):
    """Breadcrumb item"""
    id: str
    name: str


class MoveFolderRequest(BaseModel):
    """Move folder request"""
    target_parent_id: Optional[str] = None


class DeleteFolderRequest(BaseModel):
    """Delete folder with OTP confirmation"""
    otp: str
    recursive: bool = False


# Update forward refs
FolderWithContents.model_rebuild()
FolderTreeNode.model_rebuild()
