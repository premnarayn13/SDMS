"""
Rate Limiting Middleware
Prevents abuse and ensures fair usage
"""
from fastapi import Request, HTTPException, status
from collections import defaultdict
from datetime import datetime, timedelta
from typing import Dict, Tuple
import asyncio

from ..config import settings


class RateLimiter:
    """Simple in-memory rate limiter"""
    
    def __init__(self):
        self.requests: Dict[str, list] = defaultdict(list)
        self.lock = asyncio.Lock()
    
    async def is_rate_limited(
        self,
        key: str,
        max_requests: int,
        window_seconds: int
    ) -> Tuple[bool, int]:
        """
        Check if request should be rate limited
        Returns: (is_limited, retry_after_seconds)
        """
        async with self.lock:
            now = datetime.utcnow()
            window_start = now - timedelta(seconds=window_seconds)
            
            # Clean old requests
            self.requests[key] = [
                req_time for req_time in self.requests[key]
                if req_time > window_start
            ]
            
            # Check limit
            if len(self.requests[key]) >= max_requests:
                oldest = min(self.requests[key])
                retry_after = int((oldest + timedelta(seconds=window_seconds) - now).total_seconds())
                return True, max(retry_after, 1)
            
            # Add current request
            self.requests[key].append(now)
            return False, 0
    
    async def cleanup(self):
        """Remove old entries to prevent memory bloat"""
        async with self.lock:
            cutoff = datetime.utcnow() - timedelta(hours=1)
            keys_to_remove = []
            
            for key, times in self.requests.items():
                self.requests[key] = [t for t in times if t > cutoff]
                if not self.requests[key]:
                    keys_to_remove.append(key)
            
            for key in keys_to_remove:
                del self.requests[key]


# Global rate limiter instance
rate_limiter = RateLimiter()


async def rate_limit_middleware(
    request: Request,
    max_requests: int = None,
    window_seconds: int = 60
):
    """Rate limiting dependency"""
    if max_requests is None:
        max_requests = settings.RATE_LIMIT_PER_MINUTE
    
    # Use IP + path as rate limit key
    client_ip = request.headers.get("X-Forwarded-For", request.client.host if request.client else "unknown")
    key = f"{client_ip}:{request.url.path}"
    
    is_limited, retry_after = await rate_limiter.is_rate_limited(
        key, max_requests, window_seconds
    )
    
    if is_limited:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=f"Too many requests. Retry after {retry_after} seconds.",
            headers={"Retry-After": str(retry_after)}
        )


async def strict_rate_limit(request: Request):
    """Strict rate limit for sensitive endpoints (login, register, etc.)"""
    await rate_limit_middleware(request, max_requests=10, window_seconds=60)


async def auth_rate_limit(request: Request):
    """Rate limit specifically for auth endpoints"""
    await rate_limit_middleware(request, max_requests=5, window_seconds=60)
