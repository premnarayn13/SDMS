from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime

class HistoryItem(BaseModel):
    action: str
    date: str
    user: str

class SharedItem(BaseModel):
    email: str
    permission: str = "viewer"

class DocumentBase(BaseModel):
    name: str
    type: str  # 'file' or 'folder'
    fileType: Optional[str] = None
    size: int = 0
    parentId: Optional[int] = None
    favorite: bool = False
    tags: List[str] = []
    content: Optional[str] = None
    dataUrl: Optional[str] = None
    mimeType: Optional[str] = None

class DocumentCreate(DocumentBase):
    pass

class DocumentUpdate(BaseModel):
    name: Optional[str] = None
    parentId: Optional[int] = None
    favorite: Optional[bool] = None
    tags: Optional[List[str]] = None
    trash: Optional[bool] = None
    content: Optional[str] = None

class Document(DocumentBase):
    id: int
    date: str
    created: str
    trash: bool = False
    shared: List[SharedItem] = []
    history: List[HistoryItem] = []

    class Config:
        from_attributes = True

class FolderCreate(BaseModel):
    name: str
    parentId: Optional[int] = None

class ShareRequest(BaseModel):
    email: str
    permission: str = "viewer"

class TagRequest(BaseModel):
    tag: str

class MoveRequest(BaseModel):
    targetFolderId: Optional[int] = None

class RenameRequest(BaseModel):
    newName: str

class User(BaseModel):
    name: str = "Admin User"
    email: str = "admin@docmatrix.com"
    avatar: str = "A"

class StorageInfo(BaseModel):
    used: int
    total: int
    percent: float
