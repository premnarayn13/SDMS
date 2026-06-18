"""
Security Utilities
Password hashing, JWT handling, encryption
"""
import hashlib
import secrets
import logging
import bcrypt
from datetime import datetime, timedelta
from typing import Optional, Tuple
from jose import JWTError, jwt
from cryptography.fernet import Fernet
import base64

from ..config import settings

# Configure logger
logger = logging.getLogger(__name__)


class PasswordHandler:
    """Password hashing and verification using bcrypt directly"""
    
    @staticmethod
    def hash_password(password: str) -> str:
        """
        Hash a password using bcrypt directly
        Handles 72-byte limit gracefully
        """
        try:
            # Encode password and truncate to 72 bytes if needed
            password_bytes = password.encode('utf-8')
            if len(password_bytes) > 72:
                password_bytes = password_bytes[:72]
            
            # Generate salt and hash
            salt = bcrypt.gensalt()
            hashed = bcrypt.hashpw(password_bytes, salt)
            return hashed.decode('utf-8')
        except Exception as e:
            logger.error(f"Password hashing error: {str(e)}")
            raise
    
    @staticmethod
    def verify_password(plain_password: str, hashed_password: str) -> bool:
        """
        Verify a password against its hash using bcrypt directly
        Handles bcrypt's 72-byte limit gracefully
        """
        try:
            # Encode password and truncate to 72 bytes if needed
            password_bytes = plain_password.encode('utf-8')
            if len(password_bytes) > 72:
                password_bytes = password_bytes[:72]
            
            # Encode the hash
            hashed_bytes = hashed_password.encode('utf-8')
            
            return bcrypt.checkpw(password_bytes, hashed_bytes)
        except Exception as e:
            # Log the error but don't expose internal details
            logger.error(f"Password verification error: {str(e)}")
            return False
    
    @staticmethod
    def validate_password_strength(password: str) -> Tuple[bool, str]:
        """Validate password meets security requirements"""
        if len(password) < settings.PASSWORD_MIN_LENGTH:
            return False, f"Password must be at least {settings.PASSWORD_MIN_LENGTH} characters"
        if not any(c.isupper() for c in password):
            return False, "Password must contain at least one uppercase letter"
        if not any(c.islower() for c in password):
            return False, "Password must contain at least one lowercase letter"
        if not any(c.isdigit() for c in password):
            return False, "Password must contain at least one digit"
        if not any(c in "!@#$%^&*()_+-=[]{}|;:,.<>?" for c in password):
            return False, "Password must contain at least one special character"
        return True, "Password is strong"


class JWTHandler:
    """JWT token creation and verification"""
    
    @staticmethod
    def create_access_token(
        user_id: str,
        email: str,
        expires_delta: Optional[timedelta] = None
    ) -> str:
        """Create a new access token"""
        if expires_delta:
            expire = datetime.utcnow() + expires_delta
        else:
            expire = datetime.utcnow() + timedelta(
                minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES
            )
        
        to_encode = {
            "sub": str(user_id),
            "email": email,
            "exp": expire,
            "iat": datetime.utcnow(),
            "type": "access"
        }
        
        return jwt.encode(
            to_encode,
            settings.JWT_SECRET_KEY,
            algorithm=settings.JWT_ALGORITHM
        )
    
    @staticmethod
    def create_refresh_token(
        user_id: str,
        expires_delta: Optional[timedelta] = None
    ) -> str:
        """Create a new refresh token"""
        if expires_delta:
            expire = datetime.utcnow() + expires_delta
        else:
            expire = datetime.utcnow() + timedelta(
                days=settings.REFRESH_TOKEN_EXPIRE_DAYS
            )
        
        to_encode = {
            "sub": str(user_id),
            "exp": expire,
            "iat": datetime.utcnow(),
            "type": "refresh",
            "jti": secrets.token_urlsafe(32)  # Unique token ID
        }
        
        return jwt.encode(
            to_encode,
            settings.JWT_SECRET_KEY,
            algorithm=settings.JWT_ALGORITHM
        )
    
    @staticmethod
    def decode_token(token: str) -> Optional[dict]:
        """Decode and verify a JWT token"""
        try:
            payload = jwt.decode(
                token,
                settings.JWT_SECRET_KEY,
                algorithms=[settings.JWT_ALGORITHM]
            )
            return payload
        except JWTError:
            return None
    
    @staticmethod
    def create_token_pair(user_id: str, email: str) -> dict:
        """Create both access and refresh tokens"""
        access_token = JWTHandler.create_access_token(user_id, email)
        refresh_token = JWTHandler.create_refresh_token(user_id)
        
        return {
            "access_token": access_token,
            "refresh_token": refresh_token,
            "token_type": "bearer",
            "expires_in": settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60
        }
    
    @staticmethod
    def hash_token(token: str) -> str:
        """Hash a token for secure storage"""
        return hashlib.sha256(token.encode()).hexdigest()


class TokenEncryption:
    """Encryption for sensitive tokens (OAuth tokens, etc.)"""
    
    _key: Optional[bytes] = None
    
    @classmethod
    def _get_key(cls) -> bytes:
        """Get or generate encryption key"""
        if cls._key is None:
            # Derive key from JWT secret
            key_material = settings.JWT_SECRET_KEY.encode()
            cls._key = base64.urlsafe_b64encode(
                hashlib.sha256(key_material).digest()
            )
        return cls._key
    
    @classmethod
    def encrypt(cls, plaintext: str) -> str:
        """Encrypt a string"""
        f = Fernet(cls._get_key())
        return f.encrypt(plaintext.encode()).decode()
    
    @classmethod
    def decrypt(cls, ciphertext: str) -> str:
        """Decrypt a string"""
        f = Fernet(cls._get_key())
        return f.decrypt(ciphertext.encode()).decode()


class SecureTokenGenerator:
    """Generate secure random tokens"""
    
    @staticmethod
    def generate_verification_token() -> str:
        """Generate a secure URL-safe verification token"""
        return secrets.token_urlsafe(32)
    
    @staticmethod
    def generate_otp(length: int = 6) -> str:
        """Generate a numeric OTP"""
        return ''.join(secrets.choice('0123456789') for _ in range(length))
    
    @staticmethod
    def generate_session_id() -> str:
        """Generate a unique session identifier"""
        return secrets.token_urlsafe(32)


# Convenience instances
password_handler = PasswordHandler()
jwt_handler = JWTHandler()
token_encryption = TokenEncryption()
token_generator = SecureTokenGenerator()
