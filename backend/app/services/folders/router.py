"""
Folders API Router
"""
from fastapi import APIRouter, Depends, HTTPException, Query
from typing import Optional, List

from ...middleware.auth import get_current_user, get_verified_user
from .schemas import (
    FolderCreate, FolderUpdate, FolderResponse, FolderWithContents,
    FolderTreeNode, BreadcrumbItem, MoveFolderRequest, DeleteFolderRequest
)
from .service import folders_service

router = APIRouter(prefix="/folders", tags=["Folders"])


@router.post("", response_model=FolderResponse)
async def create_folder(
    request: FolderCreate,
    user: dict = Depends(get_current_user)
):
    """Create a new folder"""
    try:
        folder = await folders_service.create_folder(
            user_id=user["id"],
            name=request.name,
            parent_id=request.parent_id,
            drive_id=request.drive_id,
            description=request.description,
            color=request.color,
            icon=request.icon
        )
        return FolderResponse(**folder)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("", response_model=List[FolderResponse])
async def list_folders(
    parent_id: Optional[str] = Query(None, description="Parent folder ID (null for root)"),
    user: dict = Depends(get_current_user)
):
    """List folders in a parent"""
    try:
        folders = await folders_service.get_folders(user["id"], parent_id)
        return [FolderResponse(**f) for f in folders]
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/tree", response_model=List[FolderTreeNode])
async def get_folder_tree(
    user: dict = Depends(get_current_user)
):
    """Get complete folder tree"""
    try:
        tree = await folders_service.get_folder_tree(user["id"])
        return tree
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/{folder_id}", response_model=FolderResponse)
async def get_folder(
    folder_id: str,
    user: dict = Depends(get_current_user)
):
    """Get folder details"""
    try:
        folder = await folders_service.get_folder(user["id"], folder_id)
        return FolderResponse(**folder)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.get("/{folder_id}/contents", response_model=FolderWithContents)
async def get_folder_contents(
    folder_id: str,
    user: dict = Depends(get_current_user)
):
    """Get folder with children and files"""
    try:
        folder = await folders_service.get_folder_with_contents(user["id"], folder_id)
        return FolderWithContents(**folder)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.get("/{folder_id}/breadcrumbs", response_model=List[BreadcrumbItem])
async def get_breadcrumbs(
    folder_id: str,
    user: dict = Depends(get_current_user)
):
    """Get folder breadcrumbs"""
    try:
        breadcrumbs = await folders_service.get_breadcrumbs(user["id"], folder_id)
        return [BreadcrumbItem(**b) for b in breadcrumbs]
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.patch("/{folder_id}", response_model=FolderResponse)
async def update_folder(
    folder_id: str,
    updates: FolderUpdate,
    user: dict = Depends(get_current_user)
):
    """Update folder"""
    try:
        folder = await folders_service.update_folder(
            user["id"],
            folder_id,
            updates.model_dump(exclude_unset=True)
        )
        return FolderResponse(**folder)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/{folder_id}/move", response_model=FolderResponse)
async def move_folder(
    folder_id: str,
    request: MoveFolderRequest,
    user: dict = Depends(get_current_user)
):
    """Move folder to new parent"""
    try:
        folder = await folders_service.move_folder(
            user["id"],
            folder_id,
            request.target_parent_id
        )
        return FolderResponse(**folder)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/{folder_id}/request-delete-otp")
async def request_delete_otp(
    folder_id: str,
    user: dict = Depends(get_verified_user)
):
    """Request OTP for folder deletion"""
    try:
        await folders_service.request_delete_otp(user["id"], folder_id)
        return {"message": "OTP sent to your email"}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.delete("/{folder_id}")
async def delete_folder(
    folder_id: str,
    recursive: bool = Query(False),
    otp: Optional[str] = Query(None),
    user: dict = Depends(get_current_user)
):
    """Delete folder"""
    try:
        await folders_service.delete_folder(
            user["id"],
            folder_id,
            recursive=recursive,
            otp=otp
        )
        return {"message": "Folder deleted successfully"}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
