"""
Folders Service Package
"""
from .service import folders_service
from .router import router as folders_router

__all__ = ["folders_service", "folders_router"]
