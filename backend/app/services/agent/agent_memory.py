"""
Agent Memory for Docky AI Agent
Minimal, safe, reference-only memory store.

DESIGN PRINCIPLE:
  This replaces the old ContextManager. It stores ONLY the data needed
  to resolve pronouns like "it", "that file", "them" in follow-up messages.
  
  It does NOT store:
  - Full conversation history
  - Previous assistant responses
  - Chat messages
  
  History NEVER influences intent detection or operation selection.
  It is consulted ONLY when the user's current message contains a pronoun
  that the IntentClassifier flags with needs_history=True.
"""
import logging
from typing import Any, Dict, Optional
from app.services.agent.pipeline_models import ReferenceContext

logger = logging.getLogger(__name__)

# In-memory store: user_id -> ReferenceContext
_store: Dict[str, ReferenceContext] = {}


class AgentMemory:
    """
    Minimal per-user memory for reference resolution only.
    Thread-safe for single-process deployments (FastAPI with uvicorn workers).
    """

    def get(self, user_id: str) -> ReferenceContext:
        """Return the current reference context for a user, or an empty one."""
        return _store.get(user_id, ReferenceContext())

    def update_from_execution(
        self,
        user_id: str,
        execution_result: Any,  # ExecutionResult from pipeline_models
        operation: str = ""
    ) -> None:
        """
        Update memory after a successful execution.
        Extracts file_id, file_name, folder_id, folder_name from step results.
        """
        ctx = _store.get(user_id, ReferenceContext())
        ctx.last_operation = operation

        for step in reversed(execution_result.steps):
            if not step.success:
                continue
            data = step.data or {}

            # Try to extract file info
            fid = (
                data.get("file_id")
                or data.get("id")
                or data.get("first_file_id")
            )
            fname = (
                data.get("file_name")
                or data.get("original_filename")
                or data.get("name")
                or data.get("new_name")
            )

            if fid:
                ctx.last_file_id = str(fid)
                if fname:
                    ctx.last_file_name = str(fname)
                break

        # Capture search results for "them" / multi-file resolution
        for step in execution_result.steps:
            if not step.success:
                continue
            data = step.data or {}
            files = data.get("files") or data.get("results") or []
            if isinstance(files, list) and len(files) > 0:
                ctx.last_search_results = files[:20]  # cap at 20
                break

        # Capture folder info
        for step in reversed(execution_result.steps):
            if not step.success:
                continue
            data = step.data or {}
            folder_id = data.get("folder_id") or data.get("id")
            folder_name = data.get("folder_name") or data.get("name")
            if folder_id and "folder" in (step.tool or ""):
                ctx.last_folder_id = str(folder_id)
                if folder_name:
                    ctx.last_folder_name = str(folder_name)
                break

        _store[user_id] = ctx
        logger.debug("Updated agent memory for user %s: last_file=%s op=%s", user_id, ctx.last_file_id, operation)

    def clear(self, user_id: str) -> None:
        """Clear all memory for a user."""
        if user_id in _store:
            del _store[user_id]
            logger.info("Cleared agent memory for user %s", user_id)

    def set_last_file(self, user_id: str, file_id: str, file_name: str = "") -> None:
        """Manually set last file (used by search results)."""
        ctx = _store.get(user_id, ReferenceContext())
        ctx.last_file_id = file_id
        ctx.last_file_name = file_name
        _store[user_id] = ctx

    def set_last_search_results(self, user_id: str, files: list) -> None:
        """Store search results for 'them'/'those files' resolution."""
        ctx = _store.get(user_id, ReferenceContext())
        ctx.last_search_results = files[:20]
        _store[user_id] = ctx


# Global singleton
_agent_memory: Optional[AgentMemory] = None


def get_agent_memory() -> AgentMemory:
    global _agent_memory
    if _agent_memory is None:
        _agent_memory = AgentMemory()
    return _agent_memory
