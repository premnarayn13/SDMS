"""
DocMatrix Configuration Module
Environment-based configuration for all services
"""
import os
from pathlib import Path
from typing import Optional
from pydantic_settings import BaseSettings
from functools import lru_cache

# Get the directory where this config file is located
CONFIG_DIR = Path(__file__).parent
BACKEND_DIR = CONFIG_DIR.parent
ENV_FILE = BACKEND_DIR / ".env"


class Settings(BaseSettings):
    """Application settings loaded from environment variables"""
    
    # Application
    APP_NAME: str = "DocMatrix"
    APP_VERSION: str = "2.0.0"
    DEBUG: bool = False
    ENVIRONMENT: str = "development"  # development, staging, production
    DEMO_MODE: bool = False  # Demo mode - set to True for testing without Supabase
    
    # API
    API_V1_PREFIX: str = "/api/v1"
    
    # CORS
    CORS_ORIGINS: list = [
        "http://localhost:3000",
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "https://doc-matrix.vercel.app"
    ]
    
    # Supabase
    SUPABASE_URL: str 
    SUPABASE_ANON_KEY: str
    SUPABASE_SERVICE_ROLE_KEY: str
    SUPABASE_JWT_SECRET: str 
    
    # JWT Configuration
    JWT_SECRET_KEY: str
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 15
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7
    
    # Google OAuth
    GOOGLE_CLIENT_ID: str
    GOOGLE_CLIENT_SECRET: str
    GOOGLE_REDIRECT_URI: str 
    GOOGLE_DRIVE_REDIRECT_URI: str = "http://localhost:8000/api/v1/drive/callback"
    
    # Resend Email Service
    RESEND_API_KEY: str # Add your Resend API key
    FROM_EMAIL: str = "onboarding@resend.dev"
    
    # OTP Configuration
    OTP_LENGTH: int = 6
    OTP_EXPIRE_MINUTES: int = 10
    
    # Storage Limits
    DEFAULT_STORAGE_LIMIT_GB: int = 10
    DEFAULT_STORAGE_LIMIT_BYTES: int = 10 * 1024 * 1024 * 1024  # 10GB
    
    # Rate Limiting
    RATE_LIMIT_PER_MINUTE: int = 60
    RATE_LIMIT_PER_HOUR: int = 1000
    
    # Security
    PASSWORD_MIN_LENGTH: int = 8
    MAX_LOGIN_ATTEMPTS: int = 5
    LOCKOUT_DURATION_MINUTES: int = 30
    
    # Frontend URL (for email links)
    FRONTEND_URL: str = "http://localhost:3000"

    # MEGA integration
    MEGA_SECURITY_MODE: str = "prototype"  # prototype | secure
    MEGA_ENABLE_TIMING_LOGS: bool = True
    MEGA_SLOW_REQUEST_MS: int = 3000
    
    # =====================================================
    # AI AGENT CONFIGURATION (Docky Autonomous Agent)
    # =====================================================
    # Groq LLM API
    GROQ_API_KEY: Optional[str] = None
    
    # Agent Settings
    AGENT_LLM_PROVIDER: str = "groq"  # Primary provider
    AGENT_LLM_MODEL: str = "llama-3.3-70b-versatile"
    AGENT_MAX_RETRIES: int = 3
    AGENT_TIMEOUT_SECONDS: int = 30
    AGENT_MAX_CONTEXT_MESSAGES: int = 10  # Number of conversation messages to keep in context
    
    class Config:
        env_file = str(ENV_FILE)
        case_sensitive = True
        extra = "ignore"  # Ignore extra fields from .env


@lru_cache()
def get_settings() -> Settings:
    """Get cached settings instance"""
    return Settings()


settings = get_settings()
