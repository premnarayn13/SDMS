"""
Activity & Audit Service Schemas
"""
from pydantic import BaseModel
from typing import Optional, List, Any
from datetime import datetime


class ActivityLogResponse(BaseModel):
    """Activity log entry"""
    id: str
    entity_type: str
    entity_id: Optional[str] = None
    action: str
    details: Optional[dict] = None
    ip_address: Optional[str] = None
    user_agent: Optional[str] = None
    created_at: datetime


class ActivityListResponse(BaseModel):
    """List of activity logs"""
    activities: List[ActivityLogResponse]
    total: int
    page: int
    page_size: int


class AuditLogResponse(BaseModel):
    """Audit log entry"""
    id: str
    action_type: str
    resource_type: str
    resource_id: Optional[str] = None
    details: Optional[dict] = None
    severity: str = "info"
    ip_address: Optional[str] = None
    user_agent: Optional[str] = None
    created_at: datetime


class AuditListResponse(BaseModel):
    """List of audit logs"""
    audits: List[AuditLogResponse]
    total: int
    page: int
    page_size: int


class StatsResponse(BaseModel):
    """User statistics"""
    total_files: int
    total_folders: int
    total_storage_bytes: int
    storage_limit_bytes: int
    storage_used_percent: float
    files_by_type: dict
    recent_activity_count: int
    shared_files_count: int
    favorite_files_count: int
