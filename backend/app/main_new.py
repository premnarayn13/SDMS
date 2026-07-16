"""
DocMatrix API - Enterprise Cloud Document Management System
Main Application Entry Point

This file maintains backward compatibility with the existing frontend
while adding new API v1 endpoints for cloud features.
"""
from fastapi import FastAPI, HTTPException, UploadFile, File, Form, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from typing import Optional
from contextlib import asynccontextmanager
import base64
import logging

# Legacy imports (for backward compatibility)
from .database import db
from .models import (
    DocumentCreate, DocumentUpdate,
    FolderCreate as LegacyFolderCreate,
    ShareRequest, TagRequest, MoveRequest, RenameRequest,
    User, StorageInfo
)

# New imports
from .config import settings
from .services import (
    auth_router,
    users_router,
    drive_router,
    documents_router,
    folders_router,
    activity_router,
    mega_router,
)
from .services.agent import agent_router

# Configure logging
logging.basicConfig(
    level=logging.INFO if not settings.DEBUG else logging.DEBUG,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s"
)
logger = logging.getLogger(__name__)
print("DEBUG MODE =", settings.DEBUG)

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan events"""
    # Startup
    logger.info("🚀 DocMatrix API starting up...")
    logger.info(f"Environment: {'Development' if settings.DEBUG else 'Production'}")
    logger.info(f"Frontend URL: {settings.FRONTEND_URL}")
    
    yield
    
    # Shutdown
    logger.info("👋 DocMatrix API shutting down...")


# Create FastAPI application
app = FastAPI(
    title="DocMatrix API",
    description="Enterprise Cloud Document Management System with Google Drive BYOS",
    version="2.0.0",
    lifespan=lifespan,
    docs_url="/docs" if settings.DEBUG else None,
    redoc_url="/redoc" if settings.DEBUG else None
)


# =====================================================
# MIDDLEWARE CONFIGURATION
# =====================================================

# CORS Middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://localhost:3001",
        "http://localhost:3002",
        "http://localhost:3003",
        "http://localhost:3004",
        "http://localhost:3005",
        "http://localhost:5173",
        "http://localhost:5174",
        "http://127.0.0.1:3000",
        "http://127.0.0.1:3001",
        "http://127.0.0.1:5173",
        "http://127.0.0.1:5174",
        "http://127.0.0.1:8000",
        settings.FRONTEND_URL
    ],
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS", "HEAD"],
    allow_headers=["*"],
    expose_headers=["Content-Disposition", "X-Total-Count"],
    max_age=600,
)


# =====================================================
# GLOBAL EXCEPTION HANDLERS
# =====================================================

@app.exception_handler(ValueError)
async def value_error_handler(request: Request, exc: ValueError):
    return JSONResponse(
        status_code=400,
        content={"detail": str(exc)}
    )


@app.exception_handler(Exception)
async def general_exception_handler(request: Request, exc: Exception):
    logger.error(f"Unhandled exception: {exc}", exc_info=True)
    if settings.DEBUG:
        return JSONResponse(
            status_code=500,
            content={"detail": str(exc)}
        )
    return JSONResponse(
        status_code=500,
        content={"detail": "An internal error occurred"}
    )


# =====================================================
# API V1 ROUTES (NEW CLOUD FEATURES)
# =====================================================

# Mount new API routers under /api/v1
app.include_router(auth_router, prefix="/api/v1")
app.include_router(users_router, prefix="/api/v1")
app.include_router(drive_router, prefix="/api/v1")
app.include_router(documents_router, prefix="/api/v1")
app.include_router(folders_router, prefix="/api/v1")
app.include_router(activity_router, prefix="/api/v1")
app.include_router(mega_router, prefix="/api/v1")
app.include_router(agent_router, prefix="/api/v1")  # Docky AI Agent


# =====================================================
# ROOT ENDPOINTS
# =====================================================

@app.get("/")
def root():
    """API root endpoint"""
    return {
        "message": "DocMatrix API",
        "version": "2.0.0",
        "status": "running",
        "features": [
            "Cloud Storage (Google Drive BYOS)",
            "Email Authentication",
            "OAuth 2.0 (Google)",
            "OTP Verification",
            "Secure File Sharing"
        ]
    }


@app.get("/health")
def health_check():
    """Health check endpoint for deployment monitoring"""
    return {
        "status": "healthy",
        "version": "2.0.0",
        "environment": "development" if settings.DEBUG else "production"
    }


# =====================================================
# LEGACY API ROUTES (BACKWARD COMPATIBILITY)
# =====================================================
# These endpoints maintain compatibility with the existing frontend
# They will be migrated to use the new backend services gradually


# ========== DOCUMENTS ENDPOINTS ==========

@app.get("/api/documents")
def get_documents(
    view: str = "home",
    parentId: Optional[int] = None,
    search: Optional[str] = None,
    tag: Optional[str] = None
):
    """Get documents based on view type or filters"""
    if search:
        return db.search_items(search)
    
    if tag:
        return db.get_items_by_tag(tag)
    
    if view == "home" or view == "folder":
        return db.get_items_by_parent(parentId)
    elif view == "all":
        return [item for item in db.get_all_items() if item["type"] == "file" and not item.get("trash", False)]
    elif view == "recent":
        return db.get_recent_files()
    elif view == "favorites":
        return db.get_favorites()
    elif view == "shared":
        return db.get_shared_items()
    elif view == "trash":
        return db.get_trash_items()
    
    return db.get_items_by_parent(parentId)


@app.get("/api/documents/{item_id}")
def get_document(item_id: int):
    """Get a single document by ID"""
    item = db.get_item(item_id)
    if not item:
        raise HTTPException(status_code=404, detail="Document not found")
    return item


@app.post("/api/documents")
def create_document(document: DocumentCreate):
    """Create a new document"""
    item_data = document.dict()
    return db.create_item(item_data)


@app.put("/api/documents/{item_id}")
def update_document(item_id: int, updates: DocumentUpdate):
    """Update a document"""
    item = db.update_item(item_id, updates.dict(exclude_unset=True))
    if not item:
        raise HTTPException(status_code=404, detail="Document not found")
    return item


@app.delete("/api/documents/{item_id}")
def delete_document(item_id: int, permanent: bool = False):
    """Move document to trash or permanently delete"""
    item = db.get_item(item_id)
    if not item:
        raise HTTPException(status_code=404, detail="Document not found")
    
    if permanent:
        db.delete_item(item_id)
        return {"message": "Permanently deleted"}
    else:
        db.update_item(item_id, {"trash": True})
        db.add_history(item_id, "Moved to trash")
        return {"message": "Moved to trash"}


# ========== FOLDER OPERATIONS ==========

@app.post("/api/folders")
def create_folder(folder: LegacyFolderCreate):
    """Create a new folder"""
    item_data = {
        "name": folder.name,
        "type": "folder",
        "parentId": folder.parentId,
        "size": 0
    }
    return db.create_item(item_data)


@app.get("/api/folders")
def get_folders():
    """Get all folders (for move dialog, etc.)"""
    return [item for item in db.get_all_items() if item["type"] == "folder" and not item.get("trash", False)]


# ========== FILE UPLOAD ==========

@app.post("/api/upload")
async def upload_file(
    file: UploadFile = File(...),
    parentId: Optional[int] = Form(None)
):
    """Upload a file"""
    content = await file.read()
    
    # Determine file type
    file_extension = file.filename.split('.')[-1].lower() if '.' in file.filename else ''
    file_type_map = {
        'pdf': 'PDF',
        'doc': 'Word', 'docx': 'Word',
        'xls': 'Excel', 'xlsx': 'Excel',
        'ppt': 'PowerPoint', 'pptx': 'PowerPoint',
        'jpg': 'Image', 'jpeg': 'Image', 'png': 'Image', 'gif': 'Image',
        'txt': 'Text', 'md': 'Text'
    }
    file_type = file_type_map.get(file_extension, 'Document')
    
    # Check if text file
    is_text = file.content_type and file.content_type.startswith('text/') or \
              file_extension in ['txt', 'js', 'css', 'html', 'json', 'xml', 'csv', 'md', 'py', 'java', 'c', 'cpp', 'h', 'sql', 'log']
    
    item_data = {
        "name": file.filename,
        "type": "file",
        "fileType": file_type,
        "size": len(content),
        "parentId": parentId,
        "mimeType": file.content_type,
    }
    
    if is_text:
        try:
            item_data["content"] = content.decode('utf-8')
        except:
            item_data["dataUrl"] = f"data:{file.content_type};base64,{base64.b64encode(content).decode()}"
    else:
        item_data["dataUrl"] = f"data:{file.content_type};base64,{base64.b64encode(content).decode()}"
    
    return db.create_item(item_data)


# ========== FILE OPERATIONS ==========

@app.post("/api/documents/{item_id}/rename")
def rename_document(item_id: int, request: RenameRequest):
    """Rename a document"""
    item = db.get_item(item_id)
    if not item:
        raise HTTPException(status_code=404, detail="Document not found")
    
    old_name = item["name"]
    db.update_item(item_id, {"name": request.newName})
    db.add_history(item_id, f"Renamed from \"{old_name}\"")
    return db.get_item(item_id)


@app.post("/api/documents/{item_id}/move")
def move_document(item_id: int, request: MoveRequest):
    """Move a document to another folder"""
    item = db.get_item(item_id)
    if not item:
        raise HTTPException(status_code=404, detail="Document not found")
    
    db.update_item(item_id, {"parentId": request.targetFolderId})
    db.add_history(item_id, "Moved")
    return db.get_item(item_id)


@app.post("/api/documents/{item_id}/duplicate")
def duplicate_document(item_id: int):
    """Duplicate a document"""
    item = db.get_item(item_id)
    if not item:
        raise HTTPException(status_code=404, detail="Document not found")
    
    new_name = item["name"]
    if '.' in new_name:
        parts = new_name.rsplit('.', 1)
        new_name = f"{parts[0]} - Copy.{parts[1]}"
    else:
        new_name = f"{new_name} - Copy"
    
    new_item = {
        "name": new_name,
        "type": item["type"],
        "fileType": item.get("fileType"),
        "size": item.get("size", 0),
        "parentId": item.get("parentId"),
        "tags": item.get("tags", []).copy(),
        "content": item.get("content"),
        "dataUrl": item.get("dataUrl"),
        "mimeType": item.get("mimeType")
    }
    
    return db.create_item(new_item)


@app.post("/api/documents/{item_id}/favorite")
def toggle_favorite(item_id: int):
    """Toggle favorite status"""
    item = db.get_item(item_id)
    if not item:
        raise HTTPException(status_code=404, detail="Document not found")
    
    new_favorite = not item.get("favorite", False)
    db.update_item(item_id, {"favorite": new_favorite})
    action = "Added to favorites" if new_favorite else "Removed from favorites"
    db.add_history(item_id, action)
    return db.get_item(item_id)


# ========== SHARING ==========

@app.post("/api/documents/{item_id}/share")
def add_share(item_id: int, request: ShareRequest):
    """Add a person to share with"""
    item = db.get_item(item_id)
    if not item:
        raise HTTPException(status_code=404, detail="Document not found")
    
    shared = item.get("shared", [])
    if any(s["email"] == request.email for s in shared):
        raise HTTPException(status_code=400, detail="Already shared with this person")
    
    shared.append({"email": request.email, "permission": request.permission})
    db.update_item(item_id, {"shared": shared})
    db.add_history(item_id, f"Shared with {request.email}")
    return db.get_item(item_id)


@app.delete("/api/documents/{item_id}/share/{email}")
def remove_share(item_id: int, email: str):
    """Remove a person from sharing"""
    item = db.get_item(item_id)
    if not item:
        raise HTTPException(status_code=404, detail="Document not found")
    
    shared = [s for s in item.get("shared", []) if s["email"] != email]
    db.update_item(item_id, {"shared": shared})
    db.add_history(item_id, f"Removed {email} from sharing")
    return db.get_item(item_id)


# ========== TAGS ==========

@app.post("/api/documents/{item_id}/tags")
def add_tag(item_id: int, request: TagRequest):
    """Add a tag to a document"""
    item = db.get_item(item_id)
    if not item:
        raise HTTPException(status_code=404, detail="Document not found")
    
    tags = item.get("tags", [])
    if request.tag not in tags:
        tags.append(request.tag)
        db.update_item(item_id, {"tags": tags})
        db.add_history(item_id, f"Added tag: {request.tag}")
    
    return db.get_item(item_id)


@app.delete("/api/documents/{item_id}/tags/{tag}")
def remove_tag(item_id: int, tag: str):
    """Remove a tag from a document"""
    item = db.get_item(item_id)
    if not item:
        raise HTTPException(status_code=404, detail="Document not found")
    
    tags = [t for t in item.get("tags", []) if t != tag]
    db.update_item(item_id, {"tags": tags})
    db.add_history(item_id, f"Removed tag: {tag}")
    return db.get_item(item_id)


# ========== TRASH OPERATIONS ==========

@app.post("/api/documents/{item_id}/restore")
def restore_document(item_id: int):
    """Restore a document from trash"""
    item = db.get_item(item_id)
    if not item:
        raise HTTPException(status_code=404, detail="Document not found")
    
    db.update_item(item_id, {"trash": False})
    db.add_history(item_id, "Restored from trash")
    return db.get_item(item_id)


@app.post("/api/trash/restore-all")
def restore_all_trash():
    """Restore all items from trash"""
    db.restore_all_trash()
    return {"message": "All items restored"}


@app.delete("/api/trash/empty")
def empty_trash():
    """Empty the trash"""
    db.empty_trash()
    return {"message": "Trash emptied"}


# ========== CONTENT ==========

@app.put("/api/documents/{item_id}/content")
def update_content(item_id: int, content: str):
    """Update file content"""
    item = db.get_item(item_id)
    if not item:
        raise HTTPException(status_code=404, detail="Document not found")
    
    db.update_item(item_id, {"content": content, "size": len(content.encode('utf-8'))})
    db.add_history(item_id, "Edited")
    return db.get_item(item_id)


# ========== HISTORY ==========

@app.post("/api/documents/{item_id}/history")
def add_history_entry(item_id: int, action: str):
    """Add a history entry"""
    item = db.get_item(item_id)
    if not item:
        raise HTTPException(status_code=404, detail="Document not found")
    
    db.add_history(item_id, action)
    return db.get_item(item_id)


# ========== USER & STORAGE ==========

@app.get("/api/user")
def get_user():
    """Get current user info (legacy - returns mock data)"""
    return User()


@app.get("/api/storage")
def get_storage():
    """Get storage information"""
    return db.get_storage_info()


@app.get("/api/trash/count")
def get_trash_count():
    """Get trash item count"""
    return {"count": db.get_trash_count()}


# ========== BREADCRUMB ==========

@app.get("/api/breadcrumb/{item_id}")
def get_breadcrumb(item_id: int):
    """Get breadcrumb path for an item"""
    path = []
    current = db.get_item(item_id)
    
    while current:
        path.insert(0, {"id": current["id"], "name": current["name"]})
        if current.get("parentId"):
            current = db.get_item(current["parentId"])
        else:
            break
    
    return path
