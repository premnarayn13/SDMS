"""
Orchestrator for Docky Autonomous Agent
The main brain that coordinates LLM, planning, and execution
"""
import logging
import json
import re
import ast
from typing import Dict, List, Any, Optional
from datetime import datetime

from app.services.agent.llm_client import get_llm_client
from app.services.agent.tool_definitions import get_tool_definitions
from app.services.agent.action_executor import get_action_executor
from app.services.agent.context_manager import get_context_manager
from app.services.agent.prompt_templates import SYSTEM_PROMPT, CHAT_SYSTEM_PROMPT, USER_CONTEXT_TEMPLATE
from app.services.agent.tool_restrictions import get_restriction_manager
from app.services.agent.task_planner import get_task_planner

logger = logging.getLogger(__name__)


class AgentOrchestrator:
    """
    Main orchestrator for the Docky autonomous agent.
    Coordinates LLM interaction, tool selection, and action execution.
    Includes intelligent task planning and tool execution restrictions.
    """
    
    def __init__(self):
        """Initialize orchestrator"""
        self.llm_client = get_llm_client()
        self.tool_definitions = get_tool_definitions()
        self.action_executor = get_action_executor()
        self.context_manager = get_context_manager()
        self.restriction_manager = get_restriction_manager()
        self.task_planner = get_task_planner()
        
        logger.info("Agent Orchestrator initialized with restrictions and task planning")
    
    async def process_message(
        self,
        user_id: str,
        message: str,
        include_context: bool = True
    ) -> Dict[str, Any]:
        """
        Process a user message and execute requested actions.
        
        Args:
            user_id: User ID
            message: User's natural language message
            include_context: Whether to include conversation history
            
        Returns:
            Response dict with message, actions_executed, and status
        """
        try:
            logger.info(f"Processing message from user {user_id}: {message[:100]}")
            
            # Add user message to context
            self.context_manager.add_message(user_id, "user", message)

            if self._is_chat_only_request(message):
                response_text = await self._generate_conversational_response(
                    user_id=user_id,
                    current_message=message,
                    include_context=include_context,
                )
                self.context_manager.add_message(user_id, "assistant", response_text, metadata={
                    "no_tools_needed": True,
                    "mode": "conversation",
                })
                return {
                    "message": response_text,
                    "actions_executed": [],
                    "status": "completed",
                    "no_tools_needed": True,
                }

            if self._should_use_fast_path(message):
                fast_tool_calls = self._build_deterministic_tool_calls(message)
                if fast_tool_calls:
                    logger.info("Using deterministic fast-path with %s tool call(s)", len(fast_tool_calls))
                    execution_results = await self.action_executor.execute_tool_calls(
                        user_id, fast_tool_calls, user_message=message
                    )

                    follow_up_results = await self._execute_follow_up_actions(
                        user_id=user_id,
                        user_message=message,
                        execution_results=execution_results
                    )
                    if follow_up_results:
                        execution_results.extend(follow_up_results)
                        fast_tool_calls.extend([{"id": r.get("tool_call_id", "follow_up")} for r in follow_up_results])

                    response_text = self._generate_response(user_id, message, fast_tool_calls, execution_results)
                    action_signatures = self._extract_action_signatures(execution_results)
                    self.context_manager.add_message(user_id, "assistant", response_text, metadata={
                        "tool_calls": len(fast_tool_calls),
                        "successful": sum(1 for r in execution_results if r["success"]),
                        "mode": "fast_path",
                        "action_signatures": action_signatures,
                    })

                    return {
                        "message": response_text,
                        "actions_executed": execution_results,
                        "status": "completed" if all(r["success"] for r in execution_results) else "partial",
                        "tool_calls_count": len(fast_tool_calls),
                        "successful_count": sum(1 for r in execution_results if r["success"]),
                    }
            
            # Build messages for LLM
            messages = self._build_messages(user_id, message, include_context)
            
            # Get plan from LLM
            try:
                llm_response = await self.llm_client.async_chat_completion(
                    messages=messages,
                    tools=self.tool_definitions,
                    tool_choice="auto",
                    temperature=0.1,
                    max_tokens=700
                )
            except Exception as llm_error:
                recovered_tool_calls = self._recover_tool_calls_from_error(str(llm_error))
                if not recovered_tool_calls:
                    recovered_tool_calls = self._build_deterministic_tool_calls(message)
                if not recovered_tool_calls:
                    raise

                logger.warning(
                    "Recovered %s tool call(s) from LLM error payload",
                    len(recovered_tool_calls)
                )
                llm_response = {
                    "content": None,
                    "tool_calls": recovered_tool_calls,
                    "finish_reason": "tool_calls_recovered"
                }
            
            # Check if LLM wants to call tools
            tool_calls = llm_response.get("tool_calls", [])

            if tool_calls and self._is_chat_only_request(message):
                response_text = await self._generate_conversational_response(
                    user_id=user_id,
                    current_message=message,
                    include_context=include_context,
                )
                self.context_manager.add_message(user_id, "assistant", response_text, metadata={
                    "no_tools_needed": True,
                    "mode": "conversation_guard",
                })
                return {
                    "message": response_text,
                    "actions_executed": [],
                    "status": "completed",
                    "no_tools_needed": True,
                }
            
            if not tool_calls:
                # LLM responded with text only (no tools needed)
                response_text = llm_response.get("content", "I'm not sure how to help with that.")
                
                # Save assistant response
                self.context_manager.add_message(user_id, "assistant", response_text)
                
                return {
                    "message": response_text,
                    "actions_executed": [],
                    "status": "completed",
                    "no_tools_needed": True
                }
            
            # Check for tool restrictions and create execution plan
            restriction_analysis = self.restriction_manager.analyze_tool_calls(tool_calls)
            
            logger.info(
                f"Tool restriction analysis: {len(restriction_analysis['allowed_calls'])} allowed, "
                f"{len(restriction_analysis['restricted_calls'])} restricted, "
                f"{len(restriction_analysis['confirmation_calls'])} need confirmation"
            )
            
            # If there are restricted operations, ask for user confirmation
            if restriction_analysis["has_restrictions"]:
                planning_response = self._generate_restriction_response(
                    user_message=message,
                    analysis=restriction_analysis
                )
                
                self.context_manager.add_message(user_id, "assistant", planning_response, metadata={
                    "mode": "planning_with_restrictions",
                    "tool_calls_count": len(tool_calls),
                    "allowed_count": len(restriction_analysis['allowed_calls']),
                    "restricted_count": len(restriction_analysis['restricted_calls']),
                })
                
                return {
                    "message": planning_response,
                    "actions_executed": [],
                    "status": "awaiting_confirmation",
                    "has_restrictions": True,
                    "allowed_operations": len(restriction_analysis['allowed_calls']),
                    "restricted_operations": len(restriction_analysis['restricted_calls']),
                    "restrictions_detail": [
                        {
                            "tool": r["tool"],
                            "reason": r["reason"],
                            "action": r["action"]
                        } for r in restriction_analysis['restricted_calls']
                    ]
                }
            
            # All tools are allowed - proceed with execution
            # Filter to only allowed tools
            allowed_calls = restriction_analysis['allowed_calls']
            
            if not allowed_calls:
                response_text = "I cannot perform this operation as it requires manual intervention. Please handle this manually."
                self.context_manager.add_message(user_id, "assistant", response_text, metadata={
                    "mode": "no_allowed_tools",
                })
                return {
                    "message": response_text,
                    "actions_executed": [],
                    "status": "completed",
                }
            
            # Execute tool calls
            logger.info(f"Executing {len(allowed_calls)} allowed tool calls")
            execution_results = await self.action_executor.execute_tool_calls(
                user_id, allowed_calls, user_message=message
            )

            follow_up_results = await self._execute_follow_up_actions(
                user_id=user_id,
                user_message=message,
                execution_results=execution_results
            )
            if follow_up_results:
                execution_results.extend(follow_up_results)
                allowed_calls.extend([{"id": r.get("tool_call_id", "follow_up")} for r in follow_up_results])
            
            # Generate response from execution results
            response_text = self._generate_response(user_id, message, allowed_calls, execution_results)
            action_signatures = self._extract_action_signatures(execution_results)
            
            # Save assistant response
            self.context_manager.add_message(user_id, "assistant", response_text, metadata={
                "tool_calls": len(allowed_calls),
                "successful": sum(1 for r in execution_results if r["success"]),
                "action_signatures": action_signatures,
            })
            
            # Prepare response
            return {
                "message": response_text,
                "actions_executed": execution_results,
                "status": "completed" if all(r["success"] for r in execution_results) else "partial",
                    "tool_calls_count": len(allowed_calls),
                "successful_count": sum(1 for r in execution_results if r["success"])
            }
            
        except Exception as e:
            logger.error(f"Orchestrator error: {e}", exc_info=True)
            error_message = f"I encountered an error while processing your request: {str(e)}"
            
            self.context_manager.add_message(user_id, "assistant", error_message, metadata={
                "error": True,
                "error_type": type(e).__name__
            })
            
            return {
                "message": error_message,
                "actions_executed": [],
                "status": "error",
                "error": str(e)
            }
    
    def _build_messages(
        self,
        user_id: str,
        current_message: str,
        include_context: bool
    ) -> List[Dict[str, str]]:
        """
        Build message list for LLM including system prompt and context.
        
        Args:
            user_id: User ID
            current_message: Current user message
            include_context: Whether to include conversation history
            
        Returns:
            List of message dicts
        """
        messages = [
            {"role": "system", "content": SYSTEM_PROMPT}
        ]
        
        # Add conversation context if requested
        if include_context:
            context_messages = self.context_manager.get_formatted_context(user_id)
            # Only include last 5 exchanges to keep context window manageable
            recent_context = context_messages[-10:] if len(context_messages) > 10 else context_messages
            messages.extend(recent_context)
        
        # Add current message if not already in context
        if not include_context or not messages or messages[-1]["content"] != current_message:
            messages.append({"role": "user", "content": current_message})
        
        return messages

    async def _generate_conversational_response(
        self,
        user_id: str,
        current_message: str,
        include_context: bool,
    ) -> str:
        messages: List[Dict[str, str]] = [{"role": "system", "content": CHAT_SYSTEM_PROMPT}]

        if include_context:
            context_messages = self.context_manager.get_formatted_context(user_id)
            recent_context = context_messages[-6:] if len(context_messages) > 6 else context_messages
            messages.extend(recent_context)

        messages.append({"role": "user", "content": current_message})

        response = await self.llm_client.async_chat_completion(
            messages=messages,
            tools=None,
            tool_choice="none",
            temperature=0.35,
            max_tokens=280,
        )
        return response.get("content") or "Hi! I'm Docky. I can help you find, organize, and work with your documents."
    
    def _generate_response(
        self,
        user_id: str,
        user_message: str,
        tool_calls: List[Dict[str, Any]],
        results: List[Dict[str, Any]]
    ) -> str:
        """
        Generate natural language response from execution results.
        
        Args:
            user_message: Original user message
            tool_calls: List of tool calls that were made
            results: List of execution results
            
        Returns:
            Natural language response
        """
        successful = [r for r in results if r["success"]]
        failed = [r for r in results if not r["success"]]
        blocked = [r for r in results if r.get("blocked_by_safety")]
        
        # Handle safety blocks
        if blocked:
            block_messages = []
            for result in blocked:
                block_messages.append(result.get("error", "Operation blocked for safety"))
            return "\n".join(block_messages)
        
        # Handle all failures
        if not successful:
            if len(failed) == 1:
                return f"❌ I couldn't complete that action: {failed[0].get('error', 'Unknown error')}"
            else:
                return f"❌ I encountered errors with all {len(failed)} actions. Please try rephrasing your request."
        
        # Generate success message
        if len(successful) == 1:
            result = successful[0]
            data = result["data"]
            action = data.get("action")
            recent_repeat = self._was_similar_action_recently(user_id, action, data)
            response = "✅ I have completed the requested action."
            
            # Custom messages per action type
            if action == "open":
                response = f"✅ I have completed the action: opened '{data.get('file_name')}'."
            elif action == "download":
                response = f"✅ I have completed the action: started download for '{data.get('file_name')}'."
            elif action == "rename":
                response = f"✅ I have completed the action: renamed the file to '{data.get('new_name')}'."
            elif action == "move":
                response = f"✅ I have completed the action: moved the file to '{data.get('folder_name')}' folder."
            elif action == "duplicate":
                response = f"✅ I have completed the action: created a copy '{data.get('new_file_name')}'."
            elif action == "delete":
                response = "✅ I have completed the action: moved the file to trash."
            elif action == "restore":
                response = "✅ I have completed the action: restored the file from trash."
            elif action == "favorite":
                status = "Added to" if data.get("is_favorite") else "Removed from"
                response = f"✅ I have completed the action: {status.lower()} favorites."
            elif action == "add_tag":
                response = f"✅ I have completed the action: added tag '{data.get('tag')}'."
            elif action == "remove_tag":
                response = f"✅ I have completed the action: removed tag '{data.get('tag')}'."
            elif action == "share":
                response = f"✅ I have completed the action: shared with {data.get('shared_with')} ({data.get('permission')} access)."
            elif action == "create_folder":
                response = f"✅ I have completed the action: created folder '{data.get('folder_name')}'."
            elif action == "rename_folder":
                response = f"✅ I have completed the action: renamed folder to '{data.get('new_name')}'."
            elif action == "move_folder":
                response = f"✅ I have completed the action: moved folder '{data.get('folder_name')}' to '{data.get('parent_folder')}'."
            elif action == "delete_folder":
                response = f"✅ I have completed the action: deleted folder '{data.get('folder_name')}'."
            elif action == "set_color":
                response = f"✅ I have completed the action: updated folder color for '{data.get('folder_name')}'."
            elif action == "list_folders":
                response = f"✅ I found {data.get('count', 0)} folders."
            elif action == "folder_tree":
                response = "✅ I have fetched the folder hierarchy successfully."
            elif action in ["search", "filter"]:
                count = data.get("count", 0)
                if count == 0:
                    response = "I checked, but no files matched your request."
                elif count == 1:
                    file = data["files"][0] if data.get("files") else {}
                    name = file.get('original_filename') or file.get('name') or 'Unknown'
                    response = f"I found 1 matching file: '{name}'."
                else:
                    response = f"I found {count} matching files."
            elif action == "recent_files":
                files = data.get("files") or []
                count = data.get("count", len(files))
                if count == 0:
                    response = "I checked, but there are no recent files to list."
                else:
                    file_names = []
                    for file_item in files[:5]:
                        if isinstance(file_item, dict):
                            file_names.append(file_item.get("name") or file_item.get("original_filename") or "Unknown")

                    if file_names:
                        response = f"I found {count} recent file{'s' if count != 1 else ''}: {', '.join(file_names)}."
                    else:
                        response = f"I found {count} recent file{'s' if count != 1 else ''}."
            elif action == "list_files":
                files = data.get("files") or []
                count = data.get("count", len(files))
                if count == 0:
                    response = "I checked, but there are no files to list."
                else:
                    file_names = []
                    for file_item in files[:5]:
                        if isinstance(file_item, dict):
                            file_names.append(file_item.get("name") or file_item.get("original_filename") or "Unknown")

                    if file_names:
                        response = f"I found {count} file{'s' if count != 1 else ''}: {', '.join(file_names)}."
                    else:
                        response = f"I found {count} file{'s' if count != 1 else ''}."
            elif action == "analytics":
                analytics = data.get("analytics", {})
                stats = analytics.get("file_stats", {})
                response = f"📊 **Analytics**: {stats.get('total_files', 0)} files, {stats.get('total_size_readable', '0 B')} used"
            elif action == "storage":
                storage = data.get("storage", {})
                response = f"💾 **Storage**: {storage.get('used_readable', '0 B')} / {storage.get('total_readable', '0 B')} used"
            elif action in ["batch_move", "batch_tag", "batch_delete"]:
                count = data.get("moved_count") or data.get("tagged_count") or data.get("deleted_count")
                total = data.get("total_count")
                response = f"✅ I have completed batch operation on {count}/{total} files."

            if recent_repeat:
                return response + " This is similar to the action we already completed earlier on the same file."
            return response
        
        # Multiple successful actions
        action_names = [
            (r.get("data") or {}).get("action", r.get("function_name"))
            for r in successful
        ]

        if "recent_files" in action_names and "storage" in action_names:
            recent_payload = next(((r.get("data") or {}) for r in successful if (r.get("data") or {}).get("action") == "recent_files"), {})
            storage_payload = next(((r.get("data") or {}) for r in successful if (r.get("data") or {}).get("action") == "storage"), {})

            files = recent_payload.get("files") or []
            file_names = []
            for file_item in files[:3]:
                if isinstance(file_item, dict):
                    file_names.append(file_item.get("name") or file_item.get("original_filename") or "Unknown")

            storage = storage_payload.get("storage") or {}
            count = recent_payload.get("count", len(files))
            used = storage.get("used_readable", "0 B")
            total = storage.get("total_readable", "0 B")
            percent = storage.get("percent_used", 0)

            sample = f" Top recent: {', '.join(file_names)}." if file_names else ""
            response = f"✅ Found {count} recent files. Storage usage: {used} / {total} ({percent}%).{sample}"
            if failed:
                response += f" ({len(failed)} action{'s' if len(failed) > 1 else ''} failed)"
            return response

        action_summaries = []
        for result in successful:
            data = result["data"]
            action = data.get("action", result["function_name"])
            
            if action == "open":
                action_summaries.append(f"opened '{data.get('file_name')}'")
            elif action == "rename":
                action_summaries.append(f"renamed to '{data.get('new_name')}'")
            elif action == "move":
                action_summaries.append(f"moved to '{data.get('folder_name')}'")
            elif action == "add_tag":
                action_summaries.append(f"tagged as '{data.get('tag')}'")
            elif action == "delete":
                action_summaries.append("moved to trash")
            elif action == "favorite":
                action_summaries.append("favorited")
            else:
                action_summaries.append(action.replace("_", " "))
        
        # Combine summaries
        if len(action_summaries) <= 3:
            summary = ", ".join(action_summaries)
            response = f"✅ I have completed these actions: {summary}"
        else:
            response = f"✅ Completed {len(action_summaries)} actions successfully"
        
        # Add failure note if any failed
        if failed:
            response += f" ({len(failed)} action{'s' if len(failed) > 1 else ''} failed)"
        
        return response
    
    async def clear_context(self, user_id: str):
        """Clear conversation context for user"""
        self.context_manager.clear_context(user_id)
        logger.info(f"Cleared context for user {user_id}")

    async def _execute_follow_up_actions(
        self,
        user_id: str,
        user_message: str,
        execution_results: List[Dict[str, Any]]
    ) -> List[Dict[str, Any]]:
        """
        Execute deterministic follow-up actions for common multi-intent requests.
        This improves robustness when upstream tool-calling returns only a partial plan.
        """
        if not execution_results:
            return []

        mentioned_files = self._extract_file_mentions(user_message)
        if len(mentioned_files) > 1:
            return []

        file_id = None
        for result in execution_results:
            if not isinstance(result, dict) or not result.get("success"):
                continue
            data = result.get("data") or {}

            candidate = data.get("file_id") or data.get("first_file_id")
            if not candidate:
                files = data.get("files") or []
                if files and isinstance(files[0], dict):
                    candidate = files[0].get("id")

            if candidate:
                file_id = str(candidate)
                break

        if not file_id:
            return []

        lower = (user_message or "").lower()
        follow_ups: List[Dict[str, Any]] = []
        executed_functions = {
            r.get("function_name")
            for r in execution_results
            if isinstance(r, dict) and r.get("success")
        }

        tag_match = re.search(r"(?:tag\s+(?:it\s+)?as|add\s+tag\s+)([a-zA-Z0-9_-]+)", lower)
        if tag_match and "add_tag" not in executed_functions:
            follow_ups.append({
                "id": "follow_add_tag",
                "type": "function",
                "function": {
                    "name": "add_tag",
                    "arguments": {"file_id": file_id, "tag": tag_match.group(1)}
                }
            })

        wants_favorite = any(term in lower for term in ["favorite", "favourite", "star"])
        if wants_favorite and "toggle_favorite" not in executed_functions:
            desired_state = None
            if any(phrase in lower for phrase in ["add to favorite", "add to favourites", "add to favorite", "mark as favorite", "mark as favourite", "favorite it", "favourite it", "star it"]):
                desired_state = True
            elif any(phrase in lower for phrase in ["remove from favorite", "remove from favourites", "unfavorite", "unfavourite", "unstar"]):
                desired_state = False

            favorite_args = {"file_id": file_id}
            if desired_state is not None:
                favorite_args["desired_state"] = desired_state

            follow_ups.append({
                "id": "follow_favorite",
                "type": "function",
                "function": {
                    "name": "toggle_favorite",
                    "arguments": favorite_args
                }
            })

        move_match = re.search(r"move\s+(?:it\s+)?to\s+([a-zA-Z0-9 _-]+?)(?:\.|,|$)", user_message or "", flags=re.IGNORECASE)
        push_match = None
        if not move_match:
            push_match = re.search(
                r"(?:push|put)\s+(?:it\s+|the\s+file\s+)?(?:into|to|in)\s+(?:the\s+)?folder\s+([a-zA-Z0-9 _-]+?)(?:\.|,|$)",
                user_message or "",
                flags=re.IGNORECASE
            )

        root_only_match = re.search(r"(?:move|put|push|bring|take)\s+(?:it\s+|the\s+file\s+)?(?:out\s+of\s+|from\s+)?(?:the\s+)?(?:folder\s+[a-zA-Z0-9 _-]+\s+)?(?:to\s+)?(?:root|my drive|home)(?:\.|,|$)", user_message or "", flags=re.IGNORECASE)
        folder_target = move_match or push_match
        dest_folder = "root" if root_only_match else (folder_target.group(1).strip() if folder_target else None)

        if dest_folder and "move_file" not in executed_functions:
            follow_ups.append({
                "id": "follow_move",
                "type": "function",
                "function": {
                    "name": "move_file",
                    "arguments": {"file_id": file_id, "folder_name": dest_folder}
                }
            })

        if "open" in lower and "open_file" not in executed_functions:
            follow_ups.append({
                "id": "follow_open",
                "type": "function",
                "function": {
                    "name": "open_file",
                    "arguments": {"file_id": file_id}
                }
            })

        if ("delete" in lower or "trash" in lower) and "delete_file" not in executed_functions:
            follow_ups.append({
                "id": "follow_delete",
                "type": "function",
                "function": {
                    "name": "delete_file",
                    "arguments": {"file_id": file_id}
                }
            })

        results: List[Dict[str, Any]] = []
        for tool_call in follow_ups:
            result = await self.action_executor.execute_tool_call(user_id, tool_call)
            results.append(result)

        return results

    def _recover_tool_calls_from_error(self, error_text: str) -> List[Dict[str, Any]]:
        """
        Recover tool calls from provider errors that include failed_generation markup.

        Example payload segment:
        <function=search_files {"query":"budget.pdf"}</function>
        """
        if not error_text:
            return []

        matches = re.findall(
            r"<function\s*=\s*([a-zA-Z0-9_]+)\s*(\{.*?\})\s*</function>",
            error_text,
            flags=re.DOTALL
        )

        if not matches:
            matches = re.findall(
                r"<function\s*=\s*([a-zA-Z0-9_]+)\s*(\{.*?\})(?:\s*>|\s*$)",
                error_text,
                flags=re.DOTALL
            )

        recovered: List[Dict[str, Any]] = []
        for idx, (function_name, arg_blob) in enumerate(matches):
            arguments = self._parse_argument_blob(arg_blob)
            if arguments is None:
                logger.warning("Could not parse recovered tool args for %s", function_name)
                continue

            recovered.append({
                "id": f"recovered_{idx}",
                "type": "function",
                "function": {
                    "name": function_name,
                    "arguments": arguments
                }
            })

        return recovered

    def _parse_argument_blob(self, arg_blob: str) -> Optional[Dict[str, Any]]:
        """Parse function argument blobs from provider error payloads."""
        if not arg_blob:
            return None

        payload = arg_blob.strip()

        try:
            parsed = json.loads(payload)
            return parsed if isinstance(parsed, dict) else None
        except Exception:
            pass

        normalized = payload.replace('\\"', '"')
        try:
            parsed = json.loads(normalized)
            return parsed if isinstance(parsed, dict) else None
        except Exception:
            pass

        try:
            parsed = ast.literal_eval(normalized)
            return parsed if isinstance(parsed, dict) else None
        except Exception:
            return None

    def _build_deterministic_tool_calls(self, user_message: str) -> List[Dict[str, Any]]:
        """Fallback planner when provider tool-calling fails; handles common single/multi file actions."""
        message = (user_message or "").strip()
        lower = message.lower()
        if not message:
            return []

        multi_target_calls = self._build_multi_target_tool_calls(message)
        if multi_target_calls:
            return multi_target_calls

        file_hint = self._extract_file_hint(message)
        tool_calls: List[Dict[str, Any]] = []

        list_view_map = {
            "recent": "recent",
            "favorites": "favorites",
            "favourites": "favorites",
            "shared": "shared",
            "trash": "trash",
            "deleted": "trash",
        }

        list_match = re.search(r"\b(list|show|display)\b\s+(?:all\s+)?(files|documents)\b", lower)
        list_view_match = re.search(r"\b(list|show|display)\b\s+(recent|favorites|favourites|shared|trash|deleted)\b", lower)
        if list_view_match:
            view = list_view_map.get(list_view_match.group(2), "all")
            return [{
                "id": "fallback_list_files",
                "type": "function",
                "function": {
                    "name": "list_files",
                    "arguments": {"view": view, "limit": 50}
                }
            }]
        if list_match:
            return [{
                "id": "fallback_list_files",
                "type": "function",
                "function": {
                    "name": "list_files",
                    "arguments": {"view": "all", "limit": 50}
                }
            }]

        text_move_match = re.search(
            r"(?:move|push|put|bring|take)\s+(?:all\s+)?text\s+files?\s+(?:from\s+storage\s+)?(?:into|to|in)\s+(?:the\s+)?(?:folder\s+)?([a-zA-Z0-9 _-]+)",
            message,
            flags=re.IGNORECASE,
        )
        if text_move_match:
            dest_folder = text_move_match.group(1).strip()
            return [
                {
                    "id": "fallback_filter_text_files",
                    "type": "function",
                    "function": {
                        "name": "filter_files",
                        "arguments": {"file_type": "text", "limit": 500}
                    }
                },
                {
                    "id": "fallback_batch_move_text_files",
                    "type": "function",
                    "function": {
                        "name": "batch_move",
                        "arguments": {"file_ids": "$result_0.files", "folder_name": dest_folder}
                    }
                }
            ]

        rename_folder_match = re.search(
            r"rename\s+(?:the\s+)?folder\s+(?:named\s+)?['\"]?(.+?)['\"]?\s+(?:to|as)\s+['\"]?(.+?)['\"]?$",
            message,
            flags=re.IGNORECASE,
        )
        if rename_folder_match:
            current_folder = rename_folder_match.group(1).strip()
            new_name = rename_folder_match.group(2).strip()
            if current_folder and new_name:
                return [{
                    "id": "fallback_rename_folder",
                    "type": "function",
                    "function": {
                        "name": "rename_folder",
                        "arguments": {"folder_name": current_folder, "new_name": new_name}
                    }
                }]

        move_folder_match = re.search(
            r"move\s+(?:the\s+)?folder\s+(?:named\s+)?['\"]?(.+?)['\"]?\s+(?:to|under|inside|into)\s+['\"]?(.+?)['\"]?$",
            message,
            flags=re.IGNORECASE,
        )
        push_folder_match = re.search(
            r"(?:push|put|place|bring|take)\s+(?:the\s+)?folder\s+(?:named\s+)?['\"]?(.+?)['\"]?\s+(?:into|to|in)\s+(?:the\s+)?folder\s+['\"]?(.+?)['\"]?$",
            message,
            flags=re.IGNORECASE,
        )
        out_folder_match = re.search(
            r"(?:move|bring|take|pull)\s+(?:the\s+)?folder\s+(?:named\s+)?['\"]?(.+?)['\"]?\s+(?:out\s+of|from)\s+(?:the\s+)?folder\s+['\"]?(.+?)['\"]?$",
            message,
            flags=re.IGNORECASE,
        )

        folder_move = move_folder_match or push_folder_match or out_folder_match
        if folder_move:
            folder_name = folder_move.group(1).strip()
            parent_folder = folder_move.group(2).strip() if folder_move.group(2) else None
            if folder_name:
                return [{
                    "id": "fallback_move_folder",
                    "type": "function",
                    "function": {
                        "name": "move_folder",
                        "arguments": {"folder_name": folder_name, "parent_folder": parent_folder}
                    }
                }]

        create_folder_match = re.search(
            r"(?:create|make|add)\s+(?:a\s+)?folder\s+['\"]?(.+?)['\"]?(?:\s+(?:in|under|inside)\s+['\"]?(.+?)['\"]?)?$",
            message,
            flags=re.IGNORECASE,
        )
        if create_folder_match:
            folder_name = create_folder_match.group(1).strip()
            parent_folder = (create_folder_match.group(2) or "").strip() or None
            if folder_name:
                return [{
                    "id": "fallback_create_folder",
                    "type": "function",
                    "function": {
                        "name": "create_folder",
                        "arguments": {"folder_name": folder_name, "parent_folder": parent_folder}
                    }
                }]

        delete_folder_match = re.search(
            r"(?:delete|remove|trash)\s+(?:the\s+)?folder\s+(?:named\s+)?['\"]?(.+?)['\"]?$",
            message,
            flags=re.IGNORECASE,
        )
        if delete_folder_match:
            folder_name = delete_folder_match.group(1).strip()
            if folder_name:
                return [{
                    "id": "fallback_delete_folder",
                    "type": "function",
                    "function": {
                        "name": "delete_folder",
                        "arguments": {"folder_name": folder_name, "recursive": True}
                    }
                }]

        needs_file = any(word in lower for word in [
            "open", "download", "rename", "move", "tag", "favorite", "favourite", "star", "delete", "trash", "share"
        ])

        if needs_file:
            query = file_hint or message
            tool_calls.append({
                "id": "fallback_search",
                "type": "function",
                "function": {
                    "name": "search_files",
                    "arguments": {"query": query, "search_type": "filename", "limit": 5}
                }
            })

        if "open" in lower:
            tool_calls.append({
                "id": "fallback_open",
                "type": "function",
                "function": {
                    "name": "open_file",
                    "arguments": {"file_id": "{search_results_id}"}
                }
            })

        if "download" in lower:
            tool_calls.append({
                "id": "fallback_download",
                "type": "function",
                "function": {
                    "name": "download_file",
                    "arguments": {"file_id": "{search_results_id}"}
                }
            })

        rename_match = re.search(
            r"rename\s+(?:the\s+file\s+)?(?:named\s+as\s+|named\s+)?(.+?)\s+(?:to|as)\s+(.+?)(?:\s+and\s+also\s+|\s+and\s+|$)",
            message,
            flags=re.IGNORECASE,
        )
        if rename_match:
            new_name = rename_match.group(2).strip().strip('"\'')
            if new_name:
                tool_calls.append({
                    "id": "fallback_rename",
                    "type": "function",
                    "function": {
                        "name": "rename_file",
                        "arguments": {"file_id": "{search_results_id}", "new_name": new_name}
                    }
                })

        move_match = re.search(
            r"move\s+(.+?)\s+(?:to|into|in)\s+(?:the\s+)?(?:folder\s+)?['\"]?(.+?)['\"]?$",
            message,
            flags=re.IGNORECASE
        )
        push_match = re.search(
            r"(?:push|put|bring|take)\s+(?:it\s+|the\s+file\s+)?(?:into|to|in)\s+(?:the\s+)?folder\s+(.+)$",
            message,
            flags=re.IGNORECASE,
        )
        root_only_match = re.search(
            r"(?:move|push|put|bring|take)\s+(?:it\s+|the\s+file\s+)?(?:out\s+of\s+|from\s+)?(?:the\s+)?(?:folder\s+.+\s+)?(?:to\s+)?(?:root|my drive|home)$",
            message,
            flags=re.IGNORECASE,
        )

        dest_folder = None
        if root_only_match:
            dest_folder = "root"
        elif move_match:
            dest_folder = move_match.group(2).strip().strip("'\"")
            logger.warning(f"MOVE DESTINATION = [{dest_folder}]")
        elif push_match:
            dest_folder = push_match.group(1).strip().strip("'\"")
        logger.warning(
        "MOVE PARSE -> move_match=%s push_match=%s dest_folder=%s",
            bool(move_match),
            bool(push_match),
            dest_folder
        )

        if dest_folder:
            logger.warning(
                "MOVE TOOL GENERATED -> file=%s folder=%s",
                file_hint,
                dest_folder
            )

            tool_calls.append({
                "id": "fallback_move",
                "type": "function",
                "function": {
                    "name": "move_file",
                    "arguments": {"file_id": "{search_results_id}", "folder_name": dest_folder}
                }
            })

        tag_match = re.search(r"tag\s+(.+?)\s+(?:as|with)\s+([a-zA-Z0-9_-]+)", message, flags=re.IGNORECASE)
        if tag_match:
            tag_name = tag_match.group(2).strip()
            if tag_name:
                tool_calls.append({
                    "id": "fallback_tag",
                    "type": "function",
                    "function": {
                        "name": "add_tag",
                        "arguments": {"file_id": "{search_results_id}", "tag": tag_name}
                    }
                })

        if any(word in lower for word in ["favorite", "favourite", "star"]):
            tool_calls.append({
                "id": "fallback_favorite",
                "type": "function",
                "function": {
                    "name": "toggle_favorite",
                    "arguments": {"file_id": "{search_results_id}", "desired_state": True}
                }
            })

        if any(word in lower for word in ["delete", "trash"]):
            tool_calls.append({
                "id": "fallback_delete",
                "type": "function",
                "function": {
                    "name": "delete_file",
                    "arguments": {"file_id": "{search_results_id}"}
                }
            })

        if not tool_calls and file_hint:
            tool_calls = [
                {
                    "id": "fallback_search_only",
                    "type": "function",
                    "function": {
                        "name": "search_files",
                        "arguments": {"query": file_hint, "search_type": "filename", "limit": 5}
                    }
                }
            ]

        return tool_calls

    def _build_multi_target_tool_calls(self, message: str) -> List[Dict[str, Any]]:
        clauses = [segment.strip() for segment in re.split(r"\s+(?:and then|and also|also|and)\s+", message, flags=re.IGNORECASE) if segment.strip()]
        if len(clauses) < 2:
            return []

        calls: List[Dict[str, Any]] = []
        step = 1

        for clause in clauses:
            lower = clause.lower()

            rename_folder_match = re.search(r"rename\s+(?:the\s+)?folder\s+(?:named\s+)?['\"]?(.+?)['\"]?\s+(?:to|as)\s+['\"]?(.+?)['\"]?$", clause, flags=re.IGNORECASE)
            if rename_folder_match:
                source = rename_folder_match.group(1).strip()
                new_name = rename_folder_match.group(2).strip()
                calls.append({
                    "id": f"fallback_{step}",
                    "type": "function",
                    "function": {
                        "name": "rename_folder",
                        "arguments": {"folder_name": source, "new_name": new_name}
                    }
                })
                step += 1
                continue

            rename_match = re.search(r"rename\s+(?:the\s+file\s+)?(?:named\s+)?['\"]?(.+?)['\"]?\s+(?:to|as)\s+['\"]?(.+?)['\"]?$", clause, flags=re.IGNORECASE)
            if rename_match:
                source = rename_match.group(1).strip()
                new_name = rename_match.group(2).strip()
                calls.append({
                    "id": f"fallback_{step}",
                    "type": "function",
                    "function": {
                        "name": "rename_file",
                        "arguments": {"file_id": source, "new_name": new_name}
                    }
                })
                step += 1
                continue

            favorite_match = re.search(r"(?:favorite|favourite|star)\s+(?:the\s+file\s+)?(?:named\s+)?['\"]?(.+?)['\"]?$", clause, flags=re.IGNORECASE)
            put_fav_match = re.search(r"put\s+(?:the\s+file\s+)?(?:named\s+)?['\"]?(.+?)['\"]?\s+(?:into|in|to)\s+(?:the\s+)?favo(?:u)?rites?", clause, flags=re.IGNORECASE)
            target_file = None
            if favorite_match:
                target_file = favorite_match.group(1).strip()
            elif put_fav_match:
                target_file = put_fav_match.group(1).strip()
            if target_file:
                calls.append({
                    "id": f"fallback_{step}",
                    "type": "function",
                    "function": {
                        "name": "toggle_favorite",
                        "arguments": {"file_id": target_file, "desired_state": True}
                    }
                })
                step += 1
                continue

            tag_match = re.search(r"tag\s+(?:the\s+file\s+)?(?:named\s+)?['\"]?(.+?)['\"]?\s+(?:as|with)\s+([a-zA-Z0-9_-]+)", clause, flags=re.IGNORECASE)
            if tag_match:
                calls.append({
                    "id": f"fallback_{step}",
                    "type": "function",
                    "function": {
                        "name": "add_tag",
                        "arguments": {"file_id": tag_match.group(1).strip(), "tag": tag_match.group(2).strip()}
                    }
                })
                step += 1
                continue

            move_folder_match = re.search(r"move\s+(?:the\s+)?folder\s+(?:named\s+)?['\"]?(.+?)['\"]?\s+(?:to|under|inside|into)\s+['\"]?(.+?)['\"]?$", clause, flags=re.IGNORECASE)
            if move_folder_match:
                calls.append({
                    "id": f"fallback_{step}",
                    "type": "function",
                    "function": {
                        "name": "move_folder",
                        "arguments": {"folder_name": move_folder_match.group(1).strip(), "parent_folder": move_folder_match.group(2).strip()}
                    }
                })
                step += 1
                continue

            move_match = re.search(r"move\s+(?:the\s+file\s+)?(?:named\s+)?['\"]?(.+?)['\"]?\s+to\s+['\"]?(.+?)['\"]?$", clause, flags=re.IGNORECASE)
            push_match = re.search(r"(?:push|put|bring|take)\s+(?:the\s+file\s+)?['\"]?(.+?)['\"]?\s+(?:into|to|in)\s+(?:the\s+)?folder\s+['\"]?(.+?)['\"]?$", clause, flags=re.IGNORECASE)
            root_only_match = re.search(
                r"(?:move|push|put|bring|take)\s+(?:the\s+file\s+)?['\"]?(.+?)['\"]?\s+(?:out\s+of\s+|from\s+)?(?:the\s+)?(?:folder\s+['\"]?.+?['\"]?\s+)?(?:to\s+)?(?:root|my drive|home)$",
                clause,
                flags=re.IGNORECASE,
            )

            if root_only_match:
                calls.append({
                    "id": f"fallback_{step}",
                    "type": "function",
                    "function": {
                        "name": "move_file",
                        "arguments": {"file_id": root_only_match.group(1).strip(), "folder_name": "root"}
                    }
                })
                step += 1
                continue

            if move_match or push_match:
                calls.append({
                    "id": f"fallback_{step}",
                    "type": "function",
                    "function": {
                        "name": "move_file",
                        "arguments": {
                            "file_id": (move_match or push_match).group(1).strip(),
                            "folder_name": (move_match.group(2) if move_match else push_match.group(2)).strip()
                        }
                    }
                })
                step += 1
                continue

            convert_match = re.search(r"convert\s+(?:the\s+file\s+)?(?:named\s+)?['\"]?(.+?)['\"]?\s+to\s+([a-zA-Z0-9]+)", clause, flags=re.IGNORECASE)
            if convert_match:
                calls.append({
                    "id": f"fallback_{step}",
                    "type": "function",
                    "function": {
                        "name": "run_power_tool",
                        "arguments": {
                            "file_id": convert_match.group(1).strip(),
                            "operation": "convert",
                            "target_format": convert_match.group(2).strip().lower(),
                            "save_to_storage": True,
                            "export": True,
                        }
                    }
                })
                step += 1

        return calls if len(calls) >= 2 else []

    def _generate_restriction_response(self, user_message: str, analysis: Dict[str, Any]) -> str:
        """
        Generate a user-friendly response explaining what can and cannot be done.
        
        Args:
            user_message: Original user message
            analysis: Tool restriction analysis from restriction_manager
            
        Returns:
            User-friendly explanation with recommendations
        """
        allowed_count = len(analysis["allowed_calls"])
        restricted_count = len(analysis["restricted_calls"])
        
        response_parts = []
        
        # Greeting and acknowledgment
        response_parts.append("I've analyzed your request and here's what I can do:\n")
        
        # What I CAN do
        if allowed_count > 0:
            response_parts.append(f"✅ **I can help with {allowed_count} operation(s)**:")
            for call in analysis["allowed_calls"]:
                tool_name = call.get("function", {}).get("name") if isinstance(call.get("function"), dict) else call.get("name", "unknown")
                # Make tool names human-readable
                human_name = tool_name.replace("_", " ").title()
                response_parts.append(f"  • {human_name}")
            response_parts.append("")
        
        # What I CANNOT do
        if restricted_count > 0:
            response_parts.append(f"❌ **I cannot handle {restricted_count} operation(s) - these require your manual action**:\n")
            for restriction in analysis["restricted_calls"]:
                tool_name = restriction["tool"].replace("_", " ").title()
                reason = restriction["reason"]
                action = restriction["action"]
                response_parts.append(f"  • **{tool_name}**\n")
                response_parts.append(f"    - Why: {reason}\n")
                response_parts.append(f"    - What to do: {action}\n")
        
        # Recommendation
        response_parts.append("\n**My recommendation:**\n")
        if allowed_count > 0 and restricted_count > 0:
            response_parts.append(f"I can proceed with the {allowed_count} operations I can handle, and you'll do the {restricted_count} restricted operations manually. ")
            response_parts.append("This way, we can complete most of your request efficiently.\n")
            response_parts.append("👉 **Should I proceed with the operations I can do?** Just say 'yes' or 'go ahead'.")
        elif allowed_count > 0:
            response_parts.append("I can handle all of these operations! Let me proceed.")
        else:
            response_parts.append("Unfortunately, all the operations you've requested require manual action. Here's why and what you need to do:")
            for restriction in analysis["restricted_calls"]:
                response_parts.append(f"\n• {restriction['action']}")
        
        return "\n".join(response_parts)

    def _extract_file_mentions(self, text: str) -> List[str]:
        if not text:
            return []
        matches = re.findall(r"[A-Za-z0-9 _-]+\.(?:pdf|docx?|xlsx?|pptx?|txt|csv|md|png|jpe?g|gif|bmp|webp)", text, flags=re.IGNORECASE)
        normalized = []
        seen = set()
        for item in matches:
            cleaned = item.strip().lower()
            if cleaned and cleaned not in seen:
                seen.add(cleaned)
                normalized.append(cleaned)
        return normalized

    def _extract_file_hint(self, text: str) -> Optional[str]:
        quoted = re.search(r'"([^"]{2,})"|\'([^\']{2,})\'', text)
        if quoted:
            return (quoted.group(1) or quoted.group(2) or "").strip()

        match = re.search(r"(?:open|download|rename|move|delete|tag|share)\s+(?:the\s+file\s+)?(?:named\s+)?([a-zA-Z0-9 _.-]+)", text, flags=re.IGNORECASE)
        if match:
            candidate = match.group(1).strip()
            candidate = re.sub(r"\s+(to|as|with)\s+.*$", "", candidate, flags=re.IGNORECASE).strip()
            return candidate

        ext_match = re.search(r"\b([a-zA-Z0-9 _-]+\.(?:txt|docx?|pdf|xlsx?|pptx?|csv|md))\b", text, flags=re.IGNORECASE)
        if ext_match:
            return ext_match.group(1).strip()

        return None

    def _is_chat_only_request(self, text: str) -> bool:
        message = (text or "").strip().lower()
        if not message:
            return True

        action_verbs = [
            "open", "download", "rename", "move", "delete", "trash", "tag", "favorite", "favourite",
            "star", "create folder", "rename folder", "move folder", "delete folder", "share", "convert", "extract", "find duplicates", "search files",
            "list recent", "analytics", "storage", "batch", "restore",
        ]
        if any(verb in message for verb in action_verbs):
            return False

        if re.search(r"\b[A-Za-z0-9 _-]+\.(pdf|docx?|xlsx?|pptx?|txt|csv|md|png|jpe?g|gif|bmp|webp)\b", message, flags=re.IGNORECASE):
            return False

        conversational_markers = [
            "hi", "hello", "hey", "who are you", "what can you do", "help", "thanks", "thank you",
            "how are you", "good morning", "good evening", "what is your name", "can you chat",
            "chat with me", "talk to me", "how can you help", "help me understand",
        ]
        if any(marker in message for marker in conversational_markers):
            return True

        return "?" in message and len(message.split()) <= 25

    def _is_conversational_message(self, text: str) -> bool:
        return self._is_chat_only_request(text)

    def _extract_action_signatures(self, execution_results: List[Dict[str, Any]]) -> List[str]:
        signatures: List[str] = []
        for result in execution_results:
            if not isinstance(result, dict) or not result.get("success"):
                continue
            data = result.get("data") or {}
            action = (data.get("action") or result.get("function_name") or "unknown").lower()
            target = (
                data.get("file_id")
                or data.get("filename")
                or data.get("file_name")
                or data.get("new_name")
                or ""
            )
            signatures.append(f"{action}:{str(target).lower()}")
        return signatures

    def _was_similar_action_recently(self, user_id: str, action: str, data: Dict[str, Any]) -> bool:
        if not user_id or not action:
            return False

        target = (
            data.get("file_id")
            or data.get("filename")
            or data.get("file_name")
            or data.get("new_name")
            or ""
        )
        current_signature = f"{str(action).lower()}:{str(target).lower()}"

        context = self.context_manager.get_context(user_id)
        for msg in reversed(context[-12:]):
            if msg.get("role") != "assistant":
                continue
            metadata = msg.get("metadata") or {}
            signatures = metadata.get("action_signatures") or []
            if current_signature in signatures:
                return True

        return False

    def _should_use_fast_path(self, text: str) -> bool:
        message = (text or "").strip().lower()
        if not message:
            return False

        if any(token in message for token in ["summarize", "analyse", "analyze", "insight", "explain why", "strategy"]):
            return False

        explicit_actions = [
            "open", "download", "rename", "move", "delete", "tag", "favorite", "favourite", "star", "convert",
            "create folder", "rename folder", "move folder", "delete folder", "push", "put", "bring", "take",
        ]
        return any(action in message for action in explicit_actions)

    def _is_unsupported_conversion_request(self, text: str) -> bool:
        return False
    
    async def get_context_summary(self, user_id: str) -> Dict[str, Any]:
        """Get conversation context summary"""
        return self.context_manager.get_context_summary(user_id)


# Global orchestrator instance
_orchestrator: AgentOrchestrator = None


def get_orchestrator() -> AgentOrchestrator:
    """Get or create global orchestrator"""
    global _orchestrator
    if _orchestrator is None:
        _orchestrator = AgentOrchestrator()
    return _orchestrator
