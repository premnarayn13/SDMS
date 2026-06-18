"""
Context Manager for Docky Agent
Maintains conversation history for multi-turn interactions
"""
import logging
from typing import List, Dict, Any
from datetime import datetime
from app.config import settings

logger = logging.getLogger(__name__)


class ContextManager:
    """
    Manages conversation context for the agent.
    Keeps track of recent messages to provide continuity in multi-turn conversations.
    """
    
    def __init__(self, max_messages: int = None):
        """
        Initialize context manager.
        
        Args:
            max_messages: Maximum number of messages to keep in context
        """
        self.max_messages = max_messages or settings.AGENT_MAX_CONTEXT_MESSAGES
        self.contexts: Dict[str, List[Dict[str, Any]]] = {}  # user_id -> messages
        
    def add_message(self, user_id: str, role: str, content: str, metadata: Dict = None):
        """
        Add a message to user's conversation context.
        
        Args:
            user_id: User identifier
            role: "user" or "assistant"
            content: Message content
            metadata: Optional metadata dict
        """
        if user_id not in self.contexts:
            self.contexts[user_id] = []
        
        message = {
            "role": role,
            "content": content,
            "timestamp": datetime.utcnow().isoformat(),
            "metadata": metadata or {}
        }
        
        self.contexts[user_id].append(message)
        
        # Trim to max messages (keep most recent)
        if len(self.contexts[user_id]) > self.max_messages:
            self.contexts[user_id] = self.contexts[user_id][-self.max_messages:]
        
        logger.debug(f"Added {role} message to context for user {user_id}")
    
    def get_context(self, user_id: str) -> List[Dict[str, Any]]:
        """
        Get conversation context for a user.
        
        Args:
            user_id: User identifier
            
        Returns:
            List of message dicts
        """
        return self.contexts.get(user_id, [])
    
    def get_formatted_context(self, user_id: str, include_metadata: bool = False) -> List[Dict[str, str]]:
        """
        Get context formatted for LLM (role + content only).
        
        Args:
            user_id: User identifier
            include_metadata: Whether to include metadata in content
            
        Returns:
            List of dicts with 'role' and 'content' keys
        """
        context = self.get_context(user_id)
        formatted = []
        
        for msg in context:
            formatted_msg = {
                "role": msg["role"],
                "content": msg["content"]
            }
            
            if include_metadata and msg.get("metadata"):
                # Append metadata as context
                meta_str = f"\n[Context: {msg['metadata']}]"
                formatted_msg["content"] += meta_str
            
            formatted.append(formatted_msg)
        
        return formatted
    
    def clear_context(self, user_id: str):
        """
        Clear conversation context for a user.
        
        Args:
            user_id: User identifier
        """
        if user_id in self.contexts:
            del self.contexts[user_id]
            logger.info(f"Cleared context for user {user_id}")
    
    def get_last_user_message(self, user_id: str) -> str:
        """
        Get the last user message.
        
        Args:
            user_id: User identifier
            
        Returns:
            Last user message content, or empty string
        """
        context = self.get_context(user_id)
        for msg in reversed(context):
            if msg["role"] == "user":
                return msg["content"]
        return ""
    
    def get_context_summary(self, user_id: str) -> Dict[str, Any]:
        """
        Get a summary of the conversation context.
        
        Args:
            user_id: User identifier
            
        Returns:
            Dict with context statistics
        """
        context = self.get_context(user_id)
        
        user_messages = [m for m in context if m["role"] == "user"]
        assistant_messages = [m for m in context if m["role"] == "assistant"]
        
        return {
            "total_messages": len(context),
            "user_messages": len(user_messages),
            "assistant_messages": len(assistant_messages),
            "oldest_timestamp": context[0]["timestamp"] if context else None,
            "newest_timestamp": context[-1]["timestamp"] if context else None
        }


# Global context manager instance
_context_manager: ContextManager = None


def get_context_manager() -> ContextManager:
    """Get or create global context manager"""
    global _context_manager
    if _context_manager is None:
        _context_manager = ContextManager()
    return _context_manager
