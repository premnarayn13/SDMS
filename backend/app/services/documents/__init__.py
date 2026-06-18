"""
Documents Service Package
"""
from .service import documents_service
from .router import router as documents_router

__all__ = ["documents_service", "documents_router"]
