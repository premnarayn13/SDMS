"""
Services Package
All API services consolidated
"""
from .auth import router as auth_router
from .users import router as users_router
from .drive import router as drive_router
from .documents import documents_router
from .folders import folders_router
from .activity import activity_router
#from .mega.router import router as mega_router

__all__ = [
    "auth_router",
    "users_router", 
    "drive_router",
    "documents_router",
    "folders_router",
    "activity_router",
    "mega_router"
]
