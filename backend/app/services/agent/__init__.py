"""
Docky AI Agent Service
Provides intelligent document management capabilities without LLM dependencies.
"""

from .service import AgentService
from .router import router as agent_router
from .schemas import (
    ChatMessage,
    ChatResponse,
    VoiceCommandRequest,
    SearchRequest,
    AnalyticsRequest
)

__all__ = [
    'AgentService',
    'agent_router',
    'ChatMessage',
    'ChatResponse',
    'VoiceCommandRequest',
    'SearchRequest',
    'AnalyticsRequest'
]
