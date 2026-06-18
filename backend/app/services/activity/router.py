"""
Activity & Audit API Router
"""
from fastapi import APIRouter, Depends, HTTPException, Query
from typing import Optional, List

from ...middleware.auth import get_current_user
from .schemas import (
    ActivityLogResponse, ActivityListResponse,
    AuditLogResponse, AuditListResponse,
    StatsResponse
)
from .service import activity_service

router = APIRouter(prefix="/activity", tags=["Activity & Audit"])


@router.get("", response_model=ActivityListResponse)
async def get_activity_logs(
    entity_type: Optional[str] = Query(None, description="Filter by entity type"),
    action: Optional[str] = Query(None, description="Filter by action"),
    days: int = Query(30, ge=1, le=365),
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=100),
    user: dict = Depends(get_current_user)
):
    """Get user activity logs"""
    try:
        activities, total = await activity_service.get_activity_logs(
            user_id=user["id"],
            entity_type=entity_type,
            action=action,
            days=days,
            page=page,
            page_size=page_size
        )
        
        return ActivityListResponse(
            activities=[ActivityLogResponse(**a) for a in activities],
            total=total,
            page=page,
            page_size=page_size
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/audit", response_model=AuditListResponse)
async def get_audit_logs(
    action_type: Optional[str] = Query(None),
    resource_type: Optional[str] = Query(None),
    severity: Optional[str] = Query(None),
    days: int = Query(90, ge=1, le=365),
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=100),
    user: dict = Depends(get_current_user)
):
    """Get user audit logs"""
    try:
        audits, total = await activity_service.get_audit_logs(
            user_id=user["id"],
            action_type=action_type,
            resource_type=resource_type,
            severity=severity,
            days=days,
            page=page,
            page_size=page_size
        )
        
        return AuditListResponse(
            audits=[AuditLogResponse(**a) for a in audits],
            total=total,
            page=page,
            page_size=page_size
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/stats", response_model=StatsResponse)
async def get_user_stats(
    user: dict = Depends(get_current_user)
):
    """Get comprehensive user statistics"""
    try:
        stats = await activity_service.get_user_stats(user["id"])
        return StatsResponse(**stats)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/recent-files")
async def get_recent_files(
    limit: int = Query(10, ge=1, le=50),
    user: dict = Depends(get_current_user)
):
    """Get recently accessed files"""
    try:
        files = await activity_service.get_recent_files(user["id"], limit)
        return {"files": files}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/recent-uploads")
async def get_recent_uploads(
    limit: int = Query(10, ge=1, le=50),
    user: dict = Depends(get_current_user)
):
    """Get recently uploaded files"""
    try:
        files = await activity_service.get_recent_uploads(user["id"], limit)
        return {"files": files}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
