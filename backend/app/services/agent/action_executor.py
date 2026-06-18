"""
Action Executor for Docky Agent
Executes tool calls from the LLM against actual service functions
"""
import logging
import json
import re
from typing import Dict, List, Any, Optional
from app.services.agent.tool_registry import get_tool_registry
from app.services.agent.safety_guard import get_safety_guard

logger = logging.getLogger(__name__)


class ActionExecutor:
    """
    Executes actions (tool calls) from the LLM orchestrator.
    Validates safety, calls appropriate tools, and returns results.
    """
    
    def __init__(self):
        """Initialize action executor"""
        self.tool_registry = get_tool_registry()
        self.safety_guard = get_safety_guard()
        self._file_target_tools = {
            "open_file",
            "download_file",
            "rename_file",
            "move_file",
            "duplicate_file",
            "run_power_tool",
            "delete_file",
            "restore_file",
            "toggle_favorite",
            "add_tag",
            "remove_tag",
            "share_file",
            "remove_share",
            "get_file_info",
            "get_version_history",
            "extract_text",
            "extract_entities",
            "extract_keywords",
            "detect_language",
            "get_text_stats",
        }
        logger.info("Action Executor initialized")
    
    async def execute_tool_call(
        self,
        user_id: str,
        tool_call: Dict[str, Any],
        context: Dict[str, Any] = None
    ) -> Dict[str, Any]:
        """
        Execute a single tool call.
        
        Args:
            user_id: User ID
            tool_call: Tool call dict with 'function' containing 'name' and 'arguments'
            context: Optional context from previous tool calls
            
        Returns:
            Result dict with 'success', 'data', and optional 'error'
        """
        try:
            function = tool_call.get("function") or {}
            function_name = function.get("name", "unknown")
            raw_arguments = function.get("arguments")

            if raw_arguments is None:
                arguments = {}
            elif isinstance(raw_arguments, dict):
                arguments = raw_arguments
            elif isinstance(raw_arguments, str):
                try:
                    parsed = json.loads(raw_arguments)
                    arguments = parsed if isinstance(parsed, dict) else {}
                except Exception:
                    arguments = {}
            else:
                arguments = {}
            
            logger.info(f"Executing tool: {function_name} with args: {list(arguments.keys())}")
            
            # Check safety before execution
            is_safe, blocked_reason = self.safety_guard.check_operation(function_name, arguments)
            
            if not is_safe:
                logger.warning(f"Tool {function_name} blocked by safety guard: {blocked_reason}")
                return {
                    "tool_call_id": tool_call.get("id"),
                    "function_name": function_name,
                    "success": False,
                    "error": blocked_reason,
                    "blocked_by_safety": True
                }
            
            # Resolve variable references from context (e.g., $result_0.file_id)
            resolved_args = self._resolve_arguments(arguments, context)
            resolved_args = self._normalize_arguments(function_name, resolved_args, context)

            if context and function_name in self._file_target_tools:
                query_hints = self._build_recovery_queries(function_name, resolved_args, context)
                if query_hints:
                    context["_last_file_query"] = query_hints[0]
            
            # Get tool function
            tool_func = self.tool_registry.get_tool(function_name)
            
            if not tool_func:
                logger.error(f"Tool not found: {function_name}")
                return {
                    "tool_call_id": tool_call.get("id"),
                    "function_name": function_name,
                    "success": False,
                    "error": f"Tool '{function_name}' not found in registry"
                }
            
            # Execute tool
            result = await tool_func(user_id=user_id, **resolved_args)

            if (
                function_name in self._file_target_tools
                and not result.get("success", False)
                and str(result.get("error") or "").lower().find("file not found") >= 0
            ):
                recovered = await self._recover_file_target_action(
                    user_id=user_id,
                    function_name=function_name,
                    tool_func=tool_func,
                    resolved_args=resolved_args,
                    context=context,
                )
                if recovered is not None:
                    result = recovered
            
            logger.info(f"Tool {function_name} executed: success={result.get('success')}")
            
            return {
                "tool_call_id": tool_call.get("id"),
                "function_name": function_name,
                "success": result.get("success", False),
                "data": result,
                "error": result.get("error")
            }
            
        except Exception as e:
            logger.error(f"Tool execution error: {e}", exc_info=True)
            return {
                "tool_call_id": tool_call.get("id", "unknown"),
                "function_name": tool_call.get("function", {}).get("name", "unknown"),
                "success": False,
                "error": f"Tool execution failed: {str(e)}"
            }
    
    async def execute_tool_calls(
        self,
        user_id: str,
        tool_calls: List[Dict[str, Any]],
        user_message: Optional[str] = None
    ) -> List[Dict[str, Any]]:
        """
        Execute multiple tool calls in sequence.
        
        Args:
            user_id: User ID
            tool_calls: List of tool call dicts
            
        Returns:
            List of result dicts
        """
        results = []
        context = {}
        if user_message:
            context["_user_message"] = user_message
        
        for i, tool_call in enumerate(tool_calls):
            result = await self.execute_tool_call(user_id, tool_call, context)
            results.append(result)

            data = result.get("data") if isinstance(result.get("data"), dict) else {}
            file_id = data.get("file_id")
            if file_id:
                context["_last_file_id"] = file_id
            
            # Store result in context for next tool calls to reference
            context[f"result_{i}"] = result.get("data", {})
            
            # If tool failed and it's critical, optionally stop execution
            if not result["success"] and result.get("blocked_by_safety"):
                logger.info(f"Stopping execution after safety block at step {i+1}")
                break

            if result.get("success") and result.get("function_name") == "search_files":
                await self._retry_pending_file_actions(user_id, tool_calls, results, context)
        
        return results

    async def _retry_pending_file_actions(
        self,
        user_id: str,
        tool_calls: List[Dict[str, Any]],
        results: List[Dict[str, Any]],
        context: Dict[str, Any],
    ) -> None:
        """Retry previously failed file actions after search context becomes available."""
        for idx, prior in enumerate(results):
            if idx >= len(tool_calls):
                continue

            original_tool_call = tool_calls[idx]
            if not self._should_retry_with_context(prior, original_tool_call):
                continue

            retry_result = await self.execute_tool_call(user_id, original_tool_call, context)
            if retry_result.get("success"):
                retry_result["retried"] = True
                retry_result["retried_after"] = "search_files"
                results[idx] = retry_result
                context[f"result_{idx}"] = retry_result.get("data", {})

    def _should_retry_with_context(
        self,
        result: Dict[str, Any],
        tool_call: Dict[str, Any],
    ) -> bool:
        """Return true when a failed file-target action is likely due to missing placeholder resolution."""
        if result.get("success"):
            return False

        function_name = (tool_call.get("function") or {}).get("name")
        if function_name not in self._file_target_tools:
            return False

        error_text = str(result.get("error") or "").lower()
        if "file not found" not in error_text:
            return False

        arguments = self._parse_tool_arguments(tool_call)
        file_id = arguments.get("file_id")

        if not file_id:
            return True

        return self._looks_like_placeholder(file_id)

    def _parse_tool_arguments(self, tool_call: Dict[str, Any]) -> Dict[str, Any]:
        """Parse tool-call arguments safely into a dictionary."""
        function = tool_call.get("function") or {}
        raw_arguments = function.get("arguments")

        if raw_arguments is None:
            return {}

        if isinstance(raw_arguments, dict):
            return raw_arguments

        if isinstance(raw_arguments, str):
            try:
                parsed = json.loads(raw_arguments)
                return parsed if isinstance(parsed, dict) else {}
            except Exception:
                return {}

        return {}
    
    def _resolve_arguments(
        self,
        arguments: Dict[str, Any],
        context: Optional[Dict[str, Any]]
    ) -> Dict[str, Any]:
        """
        Resolve variable references in arguments (e.g., $result_0.file_id).
        
        Args:
            arguments: Tool arguments that may contain references
            context: Context dict with previous results
            
        Returns:
            Resolved arguments dict
        """
        if not isinstance(arguments, dict):
            return {}

        if not context:
            return arguments

        return self._resolve_value(arguments, context)

    def _resolve_value(self, value: Any, context: Dict[str, Any]) -> Any:
        """Recursively resolve string references in dict/list/scalar argument values."""
        if isinstance(value, str):
            text = value.strip()

            if text.startswith("$"):
                resolved_value = self._resolve_reference(text, context)
                return resolved_value if resolved_value is not None else value

            brace_ref = re.fullmatch(r"\{\s*([^{}]+?)\s*\}", text)
            if brace_ref:
                inner = brace_ref.group(1).strip()
                resolved_value = self._resolve_reference(f"${inner}", context)
                if resolved_value is not None:
                    return resolved_value

            placeholder_value = self._resolve_placeholder_value(text, context)
            if placeholder_value is not None:
                return placeholder_value

        if isinstance(value, dict):
            return {k: self._resolve_value(v, context) for k, v in value.items()}

        if isinstance(value, list):
            return [self._resolve_value(item, context) for item in value]

        return value
    
    def _resolve_reference(
        self,
        reference: str,
        context: Dict[str, Any]
    ) -> Any:
        """
        Resolve a single reference string.
        
        Args:
            reference: Reference string like "$result_0.file_id"
            context: Context dict
            
        Returns:
            Resolved value or None
        """
        try:
            # Remove $ prefix
            ref = reference[1:] if reference.startswith("$") else reference

            tokens = []
            for part in ref.split("."):
                if not part:
                    continue
                match = re.match(r"^([a-zA-Z0-9_]+)", part)
                if not match:
                    continue

                tokens.append(match.group(1))
                indexes = re.findall(r"\[(\d+)\]", part)
                for idx in indexes:
                    tokens.append(int(idx))

            if not tokens:
                return None

            value = context
            for token in tokens:
                if isinstance(token, int):
                    if isinstance(value, list) and 0 <= token < len(value):
                        value = value[token]
                    else:
                        return None
                else:
                    if isinstance(value, dict):
                        value = value.get(token)
                    else:
                        return None
            
            return value
            
        except Exception as e:
            logger.warning(f"Failed to resolve reference {reference}: {e}")
            return None

    def _normalize_arguments(
        self,
        function_name: str,
        arguments: Dict[str, Any],
        context: Optional[Dict[str, Any]]
    ) -> Dict[str, Any]:
        """Normalize malformed/placeholder arguments to increase autonomous tool-call reliability."""
        if not isinstance(arguments, dict):
            return {}

        normalized = dict(arguments)

        if function_name in self._file_target_tools:
            file_id = normalized.get("file_id")
            if not file_id or self._looks_like_placeholder(file_id) or self._is_implicit_reference(file_id):
                fallback = None

                if context and self._is_implicit_reference(file_id):
                    fallback = context.get("_last_file_id")

                if not fallback:
                    fallback = self._extract_file_ref_from_args(normalized)
                if not fallback and context:
                    fallback = self._get_latest_file_ref(context)
                if fallback:
                    normalized["file_id"] = fallback

        return normalized

    def _resolve_placeholder_value(self, text: str, context: Dict[str, Any]) -> Optional[Any]:
        """Resolve common LLM placeholders like {search_results_id} to a concrete value from context."""
        normalized = text.strip().strip("{} ").lower()
        alias_tokens = {
            "search_results_id",
            "search_result_id",
            "result_file_id",
            "selected_file_id",
            "first_file_id",
            "file_id_from_search",
            "found_file_id",
        }

        if normalized in alias_tokens:
            return self._get_latest_file_ref(context)

        return None

    def _extract_file_ref_from_args(self, arguments: Dict[str, Any]) -> Optional[Any]:
        for key in [
            "document_id",
            "id",
            "file_name",
            "filename",
            "name",
            "file",
            "query",
            "target_file",
            "old_name",
            "source_name",
            "current_name",
        ]:
            value = arguments.get(key)
            if value:
                return value
        return None

    def _get_latest_file_ref(self, context: Dict[str, Any]) -> Optional[Any]:
        """Pick the best file reference from latest context entries."""
        if not isinstance(context, dict):
            return None

        result_keys = []
        for key in context.keys():
            match = re.match(r"result_(\d+)$", str(key))
            if match:
                result_keys.append((int(match.group(1)), key))

        result_keys.sort(reverse=True)
        for _, key in result_keys:
            candidate = self._extract_file_ref_from_result(context.get(key))
            if candidate:
                return candidate

        return None

    def _extract_file_ref_from_result(self, payload: Any) -> Optional[Any]:
        if isinstance(payload, dict):
            for key in ["first_file_id", "file_id", "id", "document_id"]:
                value = payload.get(key)
                if value:
                    return value

            files = payload.get("files")
            if isinstance(files, list) and files:
                first = files[0]
                if isinstance(first, dict):
                    for key in ["id", "file_id"]:
                        value = first.get(key)
                        if value:
                            return value

        return None

    def _looks_like_placeholder(self, value: Any) -> bool:
        if not isinstance(value, str):
            return False

        text = value.strip().lower()
        if not text:
            return False

        return (
            text.startswith("$")
            or (text.startswith("{") and text.endswith("}"))
            or "search_result" in text
            or "from_search" in text
            or "placeholder" in text
            or text in {"file_id", "selected_file", "current_file"}
        )

    def _is_implicit_reference(self, value: Any) -> bool:
        if not isinstance(value, str):
            return False
        text = value.strip().lower()
        return text in {
            "it",
            "this",
            "that",
            "same",
            "same file",
            "that file",
            "this file",
            "the file",
            "selected file",
            "current file",
        }

    async def _recover_file_target_action(
        self,
        user_id: str,
        function_name: str,
        tool_func,
        resolved_args: Dict[str, Any],
        context: Optional[Dict[str, Any]] = None,
    ) -> Optional[Dict[str, Any]]:
        """Recover failed file actions by searching a normalized filename and retrying once."""
        search_queries = self._build_recovery_queries(function_name, resolved_args, context)
        if not search_queries:
            return None

        search_tool = self.tool_registry.get_tool("search_files")
        if not search_tool:
            return None

        recovered_file_id = None
        chosen_query = None
        for search_query in search_queries:
            try:
                search_result = await search_tool(
                    user_id=user_id,
                    query=search_query,
                    search_type="filename",
                    limit=5,
                )
            except Exception:
                continue

            if not search_result or not search_result.get("success"):
                continue

            candidate_file_id = search_result.get("first_file_id")
            if not candidate_file_id:
                files = search_result.get("files") or []
                if files and isinstance(files[0], dict):
                    candidate_file_id = files[0].get("id") or files[0].get("file_id")

            if candidate_file_id:
                recovered_file_id = candidate_file_id
                chosen_query = search_query
                break

        if not recovered_file_id:
            return None

        retry_args = dict(resolved_args)
        retry_args["file_id"] = str(recovered_file_id)

        try:
            retry_result = await tool_func(user_id=user_id, **retry_args)
        except Exception:
            return None

        if not retry_result.get("success", False):
            return None

        retry_result["recovered_via_search"] = True
        retry_result["recovery_query"] = chosen_query
        return retry_result

    def _build_recovery_queries(
        self,
        function_name: str,
        args: Dict[str, Any],
        context: Optional[Dict[str, Any]] = None,
    ) -> List[str]:
        """Build robust filename query candidates from noisy inputs."""
        queries: List[str] = []

        def add(value: Optional[str]):
            if not value:
                return
            normalized = value.strip()
            if not normalized:
                return
            if normalized.lower() in {q.lower() for q in queries}:
                return
            queries.append(normalized)

        if context:
            user_message = context.get("_user_message")
            if isinstance(user_message, str) and user_message.strip():
                add(self._derive_query_from_user_message(function_name, user_message))

            add(context.get("_last_file_query"))

        primary = self._derive_recovery_query(args)
        add(primary)
        if not queries:
            return []

        add(primary)

        without_ext = re.sub(r"\.[a-zA-Z0-9]{2,6}$", "", primary).strip()
        add(without_ext)

        compact = re.sub(r"[^a-zA-Z0-9]+", "", without_ext or primary).strip()
        add(compact)

        spaced = re.sub(r"([a-z])([A-Z])", r"\1 \2", without_ext or primary).strip()
        add(spaced)

        return queries[:4]

    def _derive_query_from_user_message(self, function_name: str, user_message: str) -> Optional[str]:
        """Extract likely source filename from raw user message for robust fallback recovery."""
        text = (user_message or "").strip()
        if not text:
            return None

        quoted_values = re.findall(r'"([^\"]{2,})"|\'([^\']{2,})\'', text)
        flattened = [(a or b).strip() for a, b in quoted_values if (a or b)]

        if function_name in {"rename_file", "toggle_favorite", "open_file", "download_file", "add_tag", "move_file", "run_power_tool"}:
            if flattened:
                return flattened[0]

        if function_name == "run_power_tool":
            convert_match = re.search(
                r"convert\s+(?:the\s+file\s+)?(?:named\s+)?['\"]?(.+?)['\"]?\s+to\s+[a-zA-Z0-9]+",
                text,
                flags=re.IGNORECASE,
            )
            if convert_match:
                return convert_match.group(1).strip().strip('"\'')

        rename_match = re.search(
            r"rename\s+(?:the\s+file\s+)?(?:named\s+as\s+|named\s+)?(.+?)\s+(?:to|as)\s+",
            text,
            flags=re.IGNORECASE,
        )
        if rename_match:
            return rename_match.group(1).strip().strip('"\'')

        return None

    def _derive_recovery_query(self, args: Dict[str, Any]) -> Optional[str]:
        """Extract a usable filename/query from noisy file-target arguments."""
        raw = (
            args.get("file_id")
            or args.get("file_name")
            or args.get("filename")
            or args.get("name")
            or args.get("file")
            or args.get("query")
        )

        if not raw:
            return None

        text = str(raw).strip()
        if not text:
            return None

        if self._is_implicit_reference(text):
            return None

        quoted = re.search(r'"([^"]{2,})"|\'([^\']{2,})\'', text)
        if quoted:
            text = (quoted.group(1) or quoted.group(2) or "").strip()

        text = text.strip('"\'')
        lowered = text.lower()

        for prefix in [
            "open the file named ",
            "open file named ",
            "open the file ",
            "open file ",
            "the file named ",
            "file named ",
            "named ",
            "open ",
            "rename the file named as ",
            "rename file named as ",
            "rename file named ",
            "rename the file named ",
            "rename file ",
            "rename ",
            "make favourite ",
            "make favorite ",
        ]:
            if lowered.startswith(prefix):
                text = text[len(prefix):].strip()
                lowered = text.lower()

        text = text.strip('"\'').strip()
        text = re.sub(r"^[=:]+", "", text).strip()
        text = re.sub(r"\s+as\s+.+$", "", text, flags=re.IGNORECASE).strip()
        text = re.sub(r"\s+to\s+.+$", "", text, flags=re.IGNORECASE).strip()
        text = re.sub(r"\s+and\s+.+$", "", text, flags=re.IGNORECASE).strip()
        text = re.sub(r"\s+(please|now)$", "", text, flags=re.IGNORECASE).strip()

        ext_match = re.search(r"\b([a-zA-Z0-9 _-]+\.(?:txt|docx?|pdf|xlsx?|pptx?|csv|md))\b", text, flags=re.IGNORECASE)
        if ext_match:
            return ext_match.group(1).strip()

        if len(re.sub(r"\s+", "", text)) < 3:
            return None

        return text or None
    
    def generate_execution_summary(
        self,
        results: List[Dict[str, Any]]
    ) -> Dict[str, Any]:
        """
        Generate a summary of tool execution results.
        
        Args:
            results: List of execution result dicts
            
        Returns:
            Summary dict
        """
        total = len(results)
        successful = sum(1 for r in results if r["success"])
        failed = total - successful
        blocked = sum(1 for r in results if r.get("blocked_by_safety"))
        
        return {
            "total_actions": total,
            "successful": successful,
            "failed": failed,
            "blocked_by_safety": blocked,
            "success_rate": (successful / total * 100) if total > 0 else 0
        }


# Global executor instance
_action_executor: ActionExecutor = None


def get_action_executor() -> ActionExecutor:
    """Get or create global action executor"""
    global _action_executor
    if _action_executor is None:
        _action_executor = ActionExecutor()
    return _action_executor
