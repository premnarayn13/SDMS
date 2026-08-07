"""
Ephemeral Session Manager
Thread-safe in-memory session manager handling temporary AI sessions with TTL cleanup.
"""
import uuid
import time
import threading
import logging
from typing import Dict, Any, Optional
from datetime import datetime, timedelta

from .schemas import DocumentAnalysisResult

logger = logging.getLogger(__name__)


class AISession:
    """Represents a single ephemeral document AI session."""

    def __init__(
        self,
        session_id: str,
        document_id: str,
        document_name: str,
        file_path: str,
        extracted_data: Dict[str, Any],
        analysis: DocumentAnalysisResult,
        ttl_minutes: int = 60
    ):
        self.session_id = session_id
        self.document_id = document_id
        self.document_name = document_name
        self.file_path = file_path
        self.extracted_data = extracted_data
        self.analysis = analysis
        self.created_at = datetime.utcnow()
        self.last_accessed = datetime.utcnow()
        self.ttl_minutes = ttl_minutes

    def is_expired(self) -> bool:
        """Checks if session exceeded TTL."""
        expiration_time = self.last_accessed + timedelta(minutes=self.ttl_minutes)
        return datetime.utcnow() > expiration_time

    def touch(self):
        """Updates last accessed timestamp."""
        self.last_accessed = datetime.utcnow()


class AISessionManager:
    """Thread-safe in-memory storage for active document AI sessions."""

    def __init__(self):
        self._sessions: Dict[str, AISession] = {}
        self._lock = threading.Lock()

    def create_session(
        self,
        document_id: str,
        document_name: str,
        file_path: str,
        extracted_data: Dict[str, Any],
        analysis: DocumentAnalysisResult,
        ttl_minutes: int = 60
    ) -> str:
        """Creates a new ephemeral session and returns unique session_id."""
        session_id = f"aisess_{uuid.uuid4().hex}"
        session = AISession(
            session_id=session_id,
            document_id=document_id,
            document_name=document_name,
            file_path=file_path,
            extracted_data=extracted_data,
            analysis=analysis,
            ttl_minutes=ttl_minutes
        )

        with self._lock:
            self._cleanup_expired_sessions_locked()
            self._sessions[session_id] = session

        logger.info(f"Created ephemeral AI session {session_id} for document '{document_name}' (ID: {document_id})")
        return session_id

    def get_session(self, session_id: str) -> Optional[AISession]:
        """Retrieves active session by session_id and touches access time."""
        with self._lock:
            session = self._sessions.get(session_id)
            if not session:
                return None

            if session.is_expired():
                del self._sessions[session_id]
                logger.info(f"Session {session_id} expired and was purged.")
                return None

            session.touch()
            return session

    def destroy_session(self, session_id: str) -> bool:
        """Purges active session immediately upon document close."""
        with self._lock:
            if session_id in self._sessions:
                del self._sessions[session_id]
                logger.info(f"Destroyed AI session {session_id}.")
                return True
            return False

    def _cleanup_expired_sessions_locked(self):
        """Internal helper to purge expired sessions."""
        expired_ids = [sid for sid, sess in self._sessions.items() if sess.is_expired()]
        for sid in expired_ids:
            del self._sessions[sid]
        if expired_ids:
            logger.info(f"Purged {len(expired_ids)} expired AI sessions.")


session_manager_instance = AISessionManager()
