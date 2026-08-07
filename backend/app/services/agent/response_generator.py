"""
Response Generator — Pipeline Stage 8
Generates natural, human-friendly responses from execution results.

DESIGN:
  - LLM generates conversational responses from structured results
  - Template fallbacks for when LLM is unavailable
  - Handles success, partial, failure, and clarification states
  - Formats search results, analytics, and file lists naturally
"""
import logging
from typing import Any, Dict, List, Optional

from app.services.agent.llm_client import get_llm_client
from app.services.agent.pipeline_models import AgentResponse, ExecutionResult
from app.services.agent.prompt_templates import RESPONSE_GENERATION_PROMPT, CHAT_SYSTEM_PROMPT

logger = logging.getLogger(__name__)


class ResponseGenerator:
    """
    Generates natural language responses from execution results.
    Uses LLM for rich responses, with template fallbacks.
    """

    def __init__(self):
        self.llm = get_llm_client()

    async def generate(
        self,
        user_message: str,
        execution_result: ExecutionResult
    ) -> AgentResponse:
        """
        Generate a natural language response from an execution result.
        
        Args:
            user_message: Original user message
            execution_result: Result from ExecutionEngine
            
        Returns:
            AgentResponse with message and metadata
        """
        successful = execution_result.successful_steps()
        failed = execution_result.failed_steps()

        # Build structured result summary for LLM
        result_summary = self._build_result_summary(execution_result)

        # Try LLM response generation
        try:
            response_text = await self._llm_response(user_message, result_summary)
        except Exception as e:
            logger.warning("Response generator LLM failed: %s — using template", e)
            response_text = self._template_response(execution_result)

        actions_executed = [
            {
                "tool_call_id": s.step_id,
                "function_name": s.tool,   # required by ActionExecutionResult schema
                "tool": s.tool,
                "success": s.success,
                "data": s.data,
                "error": s.error
            }
            for s in execution_result.steps
        ]

        status = "completed"
        if not execution_result.all_success:
            status = "partial" if execution_result.partial else "error"

        return AgentResponse(
            message=response_text,
            actions_executed=actions_executed,
            status=status,
            tool_calls_count=len(execution_result.steps),
            successful_count=len(successful),
            no_tools_needed=False
        )

    async def chat_response(self, message: str) -> AgentResponse:
        """Generate a pure conversational response (no tools needed)."""
        try:
            response = await self.llm.async_chat_completion(
                messages=[
                    {"role": "system", "content": CHAT_SYSTEM_PROMPT},
                    {"role": "user", "content": message}
                ],
                tools=None,
                tool_choice="none",
                temperature=0.4,
                max_tokens=200
            )
            text = response.get("content") or self._default_chat_response(message)
        except Exception as e:
            logger.warning("Chat LLM failed: %s", e)
            text = self._default_chat_response(message)

        return AgentResponse(
            message=text,
            actions_executed=[],
            status="completed",
            no_tools_needed=True
        )

    def clarification_response(self, question: str) -> AgentResponse:
        """Generate a clarification request response."""
        return AgentResponse(
            message=question,
            actions_executed=[],
            status="clarification_needed",
            needs_clarification=True,
            clarification_question=question,
            no_tools_needed=True
        )

    def error_response(self, reason: str, suggestion: Optional[str] = None) -> AgentResponse:
        """Generate an error response."""
        message = f"❌ {reason}"
        if suggestion:
            message += f"\n\n💡 {suggestion}"
        return AgentResponse(
            message=message,
            actions_executed=[],
            status="error",
            no_tools_needed=True
        )

    def blocked_response(self, reason: str, suggestion: Optional[str] = None) -> AgentResponse:
        """Generate a blocked-operation response."""
        message = f"🔒 {reason}"
        if suggestion:
            message += f"\n\n💡 {suggestion}"
        return AgentResponse(
            message=message,
            actions_executed=[],
            status="blocked",
            no_tools_needed=True
        )

    # --------------------------------------------------
    # Internal helpers
    # --------------------------------------------------

    async def _llm_response(self, user_message: str, result_summary: str) -> str:
        """Use LLM to generate natural response from result summary."""
        prompt = f"""User asked: {user_message}

Results:
{result_summary}

Generate a concise, natural response."""

        response = await self.llm.async_chat_completion(
            messages=[
                {"role": "system", "content": RESPONSE_GENERATION_PROMPT},
                {"role": "user", "content": prompt}
            ],
            tools=None,
            tool_choice="none",
            temperature=0.3,
            max_tokens=300
        )
        return response.get("content") or self._template_response_from_summary(result_summary)

    def _build_result_summary(self, result: ExecutionResult) -> str:
        """Build a concise text summary of execution results for the LLM."""
        lines = []
        for step in result.steps:
            if step.success:
                # Extract meaningful data
                data = step.data or {}
                action = data.get("action") or step.tool
                name = (
                    data.get("file_name")
                    or data.get("original_filename")
                    or data.get("name")
                    or data.get("new_name")
                    or ""
                )
                count = data.get("count") or data.get("moved_count") or data.get("tagged_count")
                files = data.get("files") or []

                if action in ("search", "filter_files", "list_files"):
                    file_names = [
                        f.get("original_filename") or f.get("name") or "?"
                        for f in files[:5]
                        if isinstance(f, dict)
                    ]
                    if file_names:
                        lines.append(f"SUCCESS: Found {count or len(files)} files: {', '.join(file_names)}")
                    else:
                        lines.append(f"SUCCESS: Found {count or 0} files")
                elif action == "recent_files" or step.tool == "list_recent_files":
                    file_names = [
                        f.get("original_filename") or f.get("name") or "?"
                        for f in files[:5]
                        if isinstance(f, dict)
                    ]
                    lines.append(f"SUCCESS: {len(files)} recent files: {', '.join(file_names)}")
                elif action == "rename":
                    lines.append(f"SUCCESS: Renamed to '{name or data.get('new_name', '')}'")
                elif action == "move":
                    lines.append(f"SUCCESS: Moved '{name}' to '{data.get('folder_name', '')}'")
                elif action == "favorite":
                    state = "Added to" if data.get("is_favorite") else "Removed from"
                    lines.append(f"SUCCESS: {state} favorites")
                elif action == "create_folder":
                    lines.append(f"SUCCESS: Created folder '{name or data.get('folder_name', '')}'")
                elif action in ("text_stats", "word_count"):
                    stats = data.get("stats") or {}
                    words = stats.get("word_count", 0)
                    chars = stats.get("char_count", 0)
                    lines.append(f"SUCCESS: {name} — {words:,} words, {chars:,} characters")
                elif action == "analytics":
                    analytics = data.get("analytics") or {}
                    file_stats = analytics.get("file_stats") or {}
                    lines.append(f"SUCCESS: {file_stats.get('total_files', 0)} files, {file_stats.get('total_size_readable', '0 B')} used")
                elif action == "storage":
                    storage = data.get("storage") or {}
                    lines.append(f"SUCCESS: {storage.get('used_readable', '0 B')} / {storage.get('total_readable', '0 B')} used")
                elif count:
                    lines.append(f"SUCCESS: {step.tool.replace('_', ' ').title()} — {count} items processed")
                else:
                    lines.append(f"SUCCESS: {step.tool.replace('_', ' ').title()}" + (f" — '{name}'" if name else ""))
            else:
                lines.append(f"FAILED: {step.tool} — {step.error or 'Unknown error'}")

        return "\n".join(lines) if lines else "No steps executed"

    def _template_response(self, result: ExecutionResult) -> str:
        """Template-based fallback response."""
        successful = result.successful_steps()
        failed = result.failed_steps()

        if not successful and failed:
            errors = [s.error or "Unknown error" for s in failed[:2]]
            return "❌ " + " | ".join(errors)

        if not failed:
            if len(successful) == 1:
                s = successful[0]
                data = s.data or {}
                action = data.get("action") or s.tool

                # Search / list results
                files = data.get("files") or []
                count = data.get("count") or len(files)
                if files and action in ("search", "filter", "list_files", "recent_files"):
                    names = [
                        f.get("original_filename") or f.get("name") or "?"
                        for f in files[:5]
                        if isinstance(f, dict)
                    ]
                    return f"✅ Found {count} file{'s' if count != 1 else ''}: {', '.join(names)}"

                # Action responses
                if action == "rename":
                    return f"✅ Renamed to '{data.get('new_name', '')}'"
                if action == "move":
                    return f"✅ Moved to '{data.get('folder_name', '')}'"
                if action == "create_folder":
                    return f"✅ Created folder '{data.get('folder_name') or data.get('name', '')}'"
                if action == "favorite":
                    state = "added to" if data.get("is_favorite") else "removed from"
                    return f"✅ File {state} favorites"
                if action in ("text_stats", "word_count"):
                    stats = data.get("stats") or {}
                    words = stats.get("word_count", 0)
                    chars = stats.get("char_count", 0)
                    sents = stats.get("sentence_count", 0)
                    return (
                        f"📊 **Text Statistics**:\n"
                        f"• Words: {words:,}\n"
                        f"• Characters: {chars:,}\n"
                        f"• Sentences: {sents:,}"
                    )
                return f"✅ {action.replace('_', ' ').title()} completed successfully"

            # Multiple successes
            ops = [s.tool.replace("_", " ") for s in successful]
            return f"✅ Completed {len(successful)} operations: {', '.join(ops[:3])}"

        # Partial success
        return (
            f"✅ Completed {len(successful)} operation(s). "
            f"❌ {len(failed)} operation(s) failed: {failed[0].error or 'unknown error'}"
        )

    def _template_response_from_summary(self, summary: str) -> str:
        if "SUCCESS" in summary and "FAILED" not in summary:
            return "✅ " + summary.replace("SUCCESS: ", "").split("\n")[0]
        return summary

    def _default_chat_response(self, message: str) -> str:
        """Default conversational response when LLM unavailable."""
        msg = message.strip().lower()
        if any(w in msg for w in ["hi", "hello", "hey"]):
            return "Hi! I'm Docky, your document assistant. What would you like to do today?"
        if any(w in msg for w in ["what can you do", "help", "capabilities"]):
            return (
                "I can help you rename, move, search, compress, convert, merge, "
                "tag, and organize your files and folders. Just tell me what you need!"
            )
        if any(w in msg for w in ["who are you", "what are you"]):
            return "I'm Docky, an AI document management assistant for DocMatrix."
        if any(w in msg for w in ["thanks", "thank you"]):
            return "You're welcome! Let me know if there's anything else I can help with."
        return "I'm here to help with your documents. What would you like to do?"


# Global singleton
_response_generator: Optional[ResponseGenerator] = None


def get_response_generator() -> ResponseGenerator:
    global _response_generator
    if _response_generator is None:
        _response_generator = ResponseGenerator()
    return _response_generator
