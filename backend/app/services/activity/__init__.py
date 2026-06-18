"""
Activity & Audit Service Package
"""
from .service import activity_service
from .router import router as activity_router

__all__ = ["activity_service", "activity_router"]
