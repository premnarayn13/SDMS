"""
Drive Router
API endpoints for Google Drive integration
"""
from fastapi import APIRouter, HTTPException, status, Depends, Request
from fastapi.responses import RedirectResponse
from typing import Optional
import logging
from urllib.parse import quote

from .schemas import (
    DriveConnectInitiate, DriveVerifyOTP, DriveResponse,
    DriveQuotaResponse, DriveUnlinkRequest, PendingDriveInfo,
    DriveListResponse, AllDrivesQuotaResponse, DriveUpdateRequest,
    StorageAllocationRequest
)
from .service import drive_service
from ...middleware import get_current_user, get_verified_user
from ..auth.schemas import MessageResponse
from ...config import settings

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/drive", tags=["Google Drive"])


@router.post("/link/initiate")
async def initiate_drive_link(
    data: Optional[DriveConnectInitiate] = None,
    user: dict = Depends(get_verified_user)
):
    """
    Initiate Google Drive linking.
    Returns URL to redirect user for OAuth consent.
    """
    try:
        auth_url, state = await drive_service.initiate_drive_link(
            user["id"],
            data.display_name if data else None
        )
        
        return {
            "auth_url": auth_url,
            "state": state,
            "message": "Redirect user to auth_url for Google consent"
        }
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.get("/callback")
async def drive_oauth_callback(
    code: str,
    state: str,
    error: Optional[str] = None
):
    """
    Handle OAuth callback from Google.
    Redirects to frontend with pending drive info.
    """
    if error:
        return RedirectResponse(
            url=f"{settings.FRONTEND_URL}/settings/drive?error={error}"
        )
    
    try:
        result = await drive_service.handle_oauth_callback(code, state)

        drive_email = quote(str(result.get("drive_email", "")))
        drive_label = quote(str(result.get("label") or result.get("display_name") or "Drive"))

        # Redirect to frontend success flow (no OTP step required)
        redirect_url = (
            f"{settings.FRONTEND_URL}/settings/drive"
            f"?success=true"
            f"&drive_email={drive_email}"
            f"&drive_label={drive_label}"
        )
        
        return RedirectResponse(url=redirect_url)
    except ValueError as e:
        return RedirectResponse(
            url=f"{settings.FRONTEND_URL}/settings/drive?error={str(e)}"
        )


@router.post("/link/verify", response_model=DriveResponse)
async def verify_drive_link(
    data: DriveVerifyOTP,
    user: dict = Depends(get_verified_user)
):
    """
    Complete drive linking by verifying OTP.
    """
    try:
        drive = await drive_service.verify_and_complete_link(
            user["id"],
            data.pending_drive_id,
            data.otp
        )
        
        return DriveResponse(
            id=str(drive["id"]),
            drive_email=drive["drive_email"],
            folder_id=drive["folder_id"],
            folder_name=drive.get("folder_name"),
            quota_bytes_total=drive.get("quota_bytes_total"),
            quota_bytes_used=drive.get("quota_bytes_used"),
            soft_limit_bytes=drive.get("soft_limit_bytes", settings.DEFAULT_STORAGE_LIMIT_BYTES),
            is_primary=drive.get("is_primary", True),
            verified_at=drive.get("verified_at"),
            created_at=drive["created_at"]
        )
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.get("/status", response_model=Optional[DriveResponse])
async def get_drive_status(user: dict = Depends(get_current_user)):
    """
    Get linked drive status.
    Returns None if no drive is linked.
    """
    drive = await drive_service.get_linked_drive(user["id"])
    
    if not drive:
        return None
    
    return DriveResponse(
        id=str(drive["id"]),
        drive_email=drive["drive_email"],
        folder_id=drive["folder_id"],
        folder_name=drive.get("folder_name"),
        display_name=drive.get("display_name"),
        drive_index=drive.get("drive_index", 0),
        label=drive.get("label"),
        quota_bytes_total=drive.get("quota_bytes_total"),
        quota_bytes_used=drive.get("quota_bytes_used"),
        quota_bytes_available=drive.get("quota_bytes_available"),
        max_allocatable_bytes=drive.get("max_allocatable_bytes"),
        soft_limit_bytes=drive.get("soft_limit_bytes", settings.DEFAULT_STORAGE_LIMIT_BYTES),
        allocated_storage_bytes=drive.get("allocated_storage_bytes", settings.DEFAULT_STORAGE_LIMIT_BYTES),
        status=drive.get("status", "active"),
        color=drive.get("color", "#3b82f6"),
        is_primary=drive.get("is_primary", True),
        verified_at=drive.get("verified_at"),
        created_at=drive["created_at"]
    )


@router.get("/list", response_model=DriveListResponse)
async def get_all_drives(user: dict = Depends(get_current_user)):
    """Get all linked drives for current user."""
    drives = await drive_service.get_all_google_drive_tokens(user["id"])

    drive_models = [
        DriveResponse(
            id=str(d["id"]),
            drive_email=d["drive_email"],
            folder_id=d["folder_id"],
            folder_name=d.get("folder_name"),
            display_name=d.get("display_name"),
            drive_index=d.get("drive_index", 0),
            label=d.get("label"),
            quota_bytes_total=d.get("quota_bytes_total"),
            quota_bytes_used=d.get("quota_bytes_used"),
            quota_bytes_available=d.get("quota_bytes_available"),
            max_allocatable_bytes=d.get("max_allocatable_bytes"),
            soft_limit_bytes=d.get("soft_limit_bytes", settings.DEFAULT_STORAGE_LIMIT_BYTES),
            allocated_storage_bytes=d.get("allocated_storage_bytes", settings.DEFAULT_STORAGE_LIMIT_BYTES),
            is_primary=d.get("is_primary", False),
            status=d.get("status", "active"),
            color=d.get("color", "#3b82f6"),
            verified_at=d.get("verified_at"),
            last_synced_at=d.get("last_synced_at"),
            created_at=d.get("created_at")
        )
        for d in drives
    ]

    return DriveListResponse(
        drives=drive_models,
        total_count=len(drive_models),
        total_allocated_bytes=sum(d.get("allocated_storage_bytes", 0) for d in drives),
        total_used_bytes=sum(d.get("quota_bytes_used", 0) for d in drives)
    )


@router.get("/quota", response_model=DriveQuotaResponse)
async def get_drive_quota(user: dict = Depends(get_current_user)):
    """
    Get current Drive storage quota.
    """
    try:
        quota = await drive_service.get_drive_quota(user["id"])
        
        return DriveQuotaResponse(**quota)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))


@router.get("/quota/all", response_model=AllDrivesQuotaResponse)
async def get_all_drives_quota(user: dict = Depends(get_current_user)):
    """Get combined quota for all linked drives."""
    try:
        return await drive_service.get_all_drives_quota(user["id"])
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.post("/unlink/request", response_model=MessageResponse)
async def request_unlink_otp(
    drive_id: Optional[str] = None,
    user: dict = Depends(get_current_user)
):
    """
    Request OTP for unlinking drive.
    """
    try:
        await drive_service.request_unlink_otp(user["id"], drive_id)
        return MessageResponse(message="OTP sent to your email for confirmation.")
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.post("/unlink", response_model=MessageResponse)
async def unlink_drive(
    data: DriveUnlinkRequest,
    user: dict = Depends(get_current_user)
):
    """
    Unlink drive after OTP verification.
    Files remain in Google Drive but DocMatrix metadata is deleted.
    """
    try:
        await drive_service.unlink_drive(user["id"], data.password, data.drive_id)
        return MessageResponse(message="Drive unlinked successfully. Your files remain in Google Drive.")
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.get("/by-id/{drive_id}", response_model=DriveResponse)
async def get_drive_by_id(drive_id: str, user: dict = Depends(get_current_user)):
    """Get a specific linked drive by ID."""
    drive = await drive_service.get_drive_by_id(user["id"], drive_id)
    if not drive:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Drive not found")

    return DriveResponse(
        id=str(drive["id"]),
        drive_email=drive["drive_email"],
        folder_id=drive["folder_id"],
        folder_name=drive.get("folder_name"),
        display_name=drive.get("display_name"),
        drive_index=drive.get("drive_index", 0),
        label=drive.get("label"),
        quota_bytes_total=drive.get("quota_bytes_total"),
        quota_bytes_used=drive.get("quota_bytes_used"),
        quota_bytes_available=drive.get("quota_bytes_available"),
        max_allocatable_bytes=drive.get("max_allocatable_bytes"),
        soft_limit_bytes=drive.get("soft_limit_bytes", settings.DEFAULT_STORAGE_LIMIT_BYTES),
        allocated_storage_bytes=drive.get("allocated_storage_bytes", settings.DEFAULT_STORAGE_LIMIT_BYTES),
        is_primary=drive.get("is_primary", False),
        status=drive.get("status", "active"),
        color=drive.get("color", "#3b82f6"),
        verified_at=drive.get("verified_at"),
        last_synced_at=drive.get("last_synced_at"),
        created_at=drive.get("created_at")
    )


@router.patch("/by-id/{drive_id}", response_model=DriveResponse)
async def update_drive(drive_id: str, data: DriveUpdateRequest, user: dict = Depends(get_current_user)):
    """Update drive settings."""
    try:
        updated = await drive_service.update_drive_settings(
            user["id"],
            drive_id,
            display_name=data.display_name,
            allocated_storage_bytes=data.allocated_storage_bytes,
            color=data.color,
            is_primary=data.is_primary
        )
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))

    return DriveResponse(
        id=str(updated["id"]),
        drive_email=updated["drive_email"],
        folder_id=updated["folder_id"],
        folder_name=updated.get("folder_name"),
        display_name=updated.get("display_name"),
        drive_index=updated.get("drive_index", 0),
        label=updated.get("label"),
        quota_bytes_total=updated.get("quota_bytes_total"),
        quota_bytes_used=updated.get("quota_bytes_used"),
        quota_bytes_available=updated.get("quota_bytes_available"),
        max_allocatable_bytes=updated.get("max_allocatable_bytes"),
        soft_limit_bytes=updated.get("soft_limit_bytes", settings.DEFAULT_STORAGE_LIMIT_BYTES),
        allocated_storage_bytes=updated.get("allocated_storage_bytes", settings.DEFAULT_STORAGE_LIMIT_BYTES),
        is_primary=updated.get("is_primary", False),
        status=updated.get("status", "active"),
        color=updated.get("color", "#3b82f6"),
        verified_at=updated.get("verified_at"),
        last_synced_at=updated.get("last_synced_at"),
        created_at=updated.get("created_at")
    )


@router.patch("/by-id/{drive_id}/storage", response_model=DriveResponse)
async def update_drive_storage(drive_id: str, data: StorageAllocationRequest, user: dict = Depends(get_current_user)):
    """Update drive storage allocation."""
    try:
        updated = await drive_service.update_drive_settings(
            user["id"],
            drive_id,
            allocated_storage_bytes=data.allocated_bytes
        )
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))

    return DriveResponse(
        id=str(updated["id"]),
        drive_email=updated["drive_email"],
        folder_id=updated["folder_id"],
        folder_name=updated.get("folder_name"),
        display_name=updated.get("display_name"),
        drive_index=updated.get("drive_index", 0),
        label=updated.get("label"),
        quota_bytes_total=updated.get("quota_bytes_total"),
        quota_bytes_used=updated.get("quota_bytes_used"),
        quota_bytes_available=updated.get("quota_bytes_available"),
        max_allocatable_bytes=updated.get("max_allocatable_bytes"),
        soft_limit_bytes=updated.get("soft_limit_bytes", settings.DEFAULT_STORAGE_LIMIT_BYTES),
        allocated_storage_bytes=updated.get("allocated_storage_bytes", settings.DEFAULT_STORAGE_LIMIT_BYTES),
        is_primary=updated.get("is_primary", False),
        status=updated.get("status", "active"),
        color=updated.get("color", "#3b82f6"),
        verified_at=updated.get("verified_at"),
        last_synced_at=updated.get("last_synced_at"),
        created_at=updated.get("created_at")
    )


@router.get("/reauthorize")
async def reauthorize_drive(user: dict = Depends(get_current_user)):
    """
    Get URL to reauthorize drive access.
    Use when drive access has expired or been revoked.
    """
    try:
        auth_url = await drive_service.reauthorize_drive(user["id"])
        return {"auth_url": auth_url}
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.get("/by-id/{drive_id}/reauthorize")
async def reauthorize_specific_drive(drive_id: str, user: dict = Depends(get_current_user)):
    """Get URL to reauthorize a specific linked drive."""
    try:
        auth_url = await drive_service.reauthorize_drive(user["id"], drive_id)
        return {"auth_url": auth_url}
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
