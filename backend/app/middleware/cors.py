"""
CORS Middleware Configuration
"""
from fastapi.middleware.cors import CORSMiddleware
from ..config import settings


def setup_cors(app):
    """Configure CORS middleware for the application"""
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.CORS_ORIGINS,
        allow_credentials=True,
        allow_methods=["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
        allow_headers=[
            "Authorization",
            "Content-Type",
            "Accept",
            "Origin",
            "X-Requested-With",
            "X-CSRF-Token"
        ],
        expose_headers=[
            "X-Total-Count",
            "X-Page-Count",
            "Content-Disposition"
        ],
        max_age=600  # Cache preflight for 10 minutes
    )
