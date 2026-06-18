"""
Agent Router
FastAPI routes for Docky AI Agent.
"""
from fastapi import APIRouter, Depends, HTTPException, status, WebSocket, WebSocketDisconnect, Query
from typing import List
import logging
import re
import json
import asyncio

from ...middleware.auth import get_current_user, get_verified_user
from ...db_supabase import get_service_db
from ...utils.security import jwt_handler
from .service import AgentService
from .schemas import *

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/agent", tags=["agent"])

_DESTRUCTIVE_PATTERNS = {
    "delete_file": re.compile(r"\b(delete|remove|trash|erase)\b", flags=re.IGNORECASE),
    "delete_folder": re.compile(r"\b(delete\s+folder|remove\s+folder|trash\s+folder)\b", flags=re.IGNORECASE),
    "empty_trash": re.compile(r"\b(empty\s+trash|clear\s+trash|permanently\s+delete)\b", flags=re.IGNORECASE),
}


def _detect_destructive_actions(text: str) -> List[str]:
    message = (text or "").strip()
    if not message:
        return []

    matches: List[str] = []
    for action_name, pattern in _DESTRUCTIVE_PATTERNS.items():
        if pattern.search(message):
            matches.append(action_name)
    return matches


def _build_confirmation_response(message: str, blocked_actions: List[str]) -> dict:
    return {
        "message": (
            "Safety mode is ON. I detected a potentially destructive request "
            f"({', '.join(blocked_actions)}). Confirm to proceed."
        ),
        "actions_executed": [],
        "status": "needs_confirmation",
        "tool_calls_count": 0,
        "successful_count": 0,
        "no_tools_needed": False,
        "confirmation_required": True,
        "blocked_actions": blocked_actions,
        "suggested_confirmation_message": message,
    }


def _extract_access_token_from_websocket(websocket: WebSocket, query_token: str | None) -> str | None:
    if query_token:
        return query_token

    auth_header = websocket.headers.get("authorization") or websocket.headers.get("Authorization")
    if auth_header and auth_header.lower().startswith("bearer "):
        return auth_header.split(" ", 1)[1].strip()
    return None


def _is_chat_only_request(text: str) -> bool:
    message = (text or "").strip().lower()
    if not message:
        return True

    action_verbs = [
        "open", "download", "rename", "move", "delete", "trash", "tag", "favorite", "favourite",
        "star", "create folder", "share", "convert", "extract", "find duplicates", "search files",
        "list recent", "analytics", "storage", "batch", "restore", "upload",
    ]
    if any(verb in message for verb in action_verbs):
        return False

    if re.search(r"\b[A-Za-z0-9 _-]+\.(pdf|docx?|xlsx?|pptx?|txt|csv|md|png|jpe?g|gif|bmp|webp)\b", message, flags=re.IGNORECASE):
        return False

    chat_markers = [
        "hi", "hello", "hey", "who are you", "what is your name", "what can you do", "how can you help",
        "how could you help", "help me", "can you chat", "talk to me", "thank you", "thanks", "how are you",
    ]
    if any(marker in message for marker in chat_markers):
        return True

    return "?" in message and len(message.split()) <= 30


def _build_chat_only_response(text: str) -> str:
    message = (text or "").strip().lower()
    if any(marker in message for marker in ["name", "who are you"]):
        return "I’m Docky, your AI assistant in DocMatrix. I can chat with you and also help manage files when you ask for actions."
    if any(marker in message for marker in ["help", "what can you do", "how can you help", "how could you help"]):
        return "I can help in two ways: normal chat responses, and file actions like search, rename, move, tag, favorite, and conversions when you ask explicitly."
    if any(marker in message for marker in ["hi", "hello", "hey", "how are you"]):
        return "Hi! I’m here and ready. You can chat normally, or tell me a file task to execute."
    return "I understand. I’m here to chat and help. If you want an action, tell me clearly what file operation to run."


def get_agent_service() -> AgentService:
    """Dependency: Get AgentService instance"""
    db = get_service_db()
    return AgentService(db)


# =====================================================
# CHAT & VOICE ENDPOINTS
# =====================================================

@router.post("/chat", response_model=ChatResponse)
async def chat(
    message: ChatMessage,
    user: dict = Depends(get_verified_user),
    agent: AgentService = Depends(get_agent_service)
):
    """
    Send message to Docky agent.
    
    Accepts both text and voice commands.
    """
    try:
        response = await agent.process_chat_message(
            user_id=user["id"],
            message=message.message,
            is_voice=message.is_voice
        )
        return response
    except Exception as e:
        logger.error(f"Chat endpoint error: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Chat processing failed: {str(e)}"
        )


@router.post("/execute", response_model=AgentExecutionResponse)
async def execute_autonomous_action(
    request: AgentExecutionRequest,
    user: dict = Depends(get_verified_user),
    agent: AgentService = Depends(get_agent_service)
):
    """
    Execute autonomous agent action.
    
    This endpoint uses the LLM-powered orchestrator to understand
    natural language requests and execute multi-step actions.
    
    Replaces the pattern-matching chat endpoint with full autonomy.
    """
    from .orchestrator import get_orchestrator
    
    try:
        if request.safe_mode and not request.confirmed:
            blocked_actions = _detect_destructive_actions(request.message)
            if blocked_actions:
                response = _build_confirmation_response(request.message, blocked_actions)
                await agent.save_autonomous_execution(
                    user_id=user["id"],
                    user_message=request.message,
                    execution_response=response
                )
                return AgentExecutionResponse(**response)

        if _is_chat_only_request(request.message):
            response = {
                "message": _build_chat_only_response(request.message),
                "actions_executed": [],
                "status": "completed",
                "tool_calls_count": 0,
                "successful_count": 0,
                "no_tools_needed": True,
            }
            await agent.save_autonomous_execution(
                user_id=user["id"],
                user_message=request.message,
                execution_response=response
            )
            return AgentExecutionResponse(**response)

        orchestrator = get_orchestrator()
        
        response = await orchestrator.process_message(
            user_id=user["id"],
            message=request.message,
            include_context=request.include_context
        )

        await agent.save_autonomous_execution(
            user_id=user["id"],
            user_message=request.message,
            execution_response=response
        )
        
        return AgentExecutionResponse(**response)
        
    except Exception as e:
        logger.error(f"Execute endpoint error: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Agent execution failed: {str(e)}"
        )


@router.websocket("/realtime/ws")
async def realtime_agent_websocket(
    websocket: WebSocket,
    token: str | None = Query(default=None),
):
    await websocket.accept()

    access_token = _extract_access_token_from_websocket(websocket, token)
    payload = jwt_handler.decode_token(access_token) if access_token else None
    user_id = payload.get("sub") if payload else None

    if not payload or payload.get("type") != "access" or not user_id:
        await websocket.send_json({"type": "error", "message": "Unauthorized websocket connection"})
        await websocket.close(code=4401)
        return

    from .orchestrator import get_orchestrator
    orchestrator = get_orchestrator()
    agent = AgentService(get_service_db())
    send_lock = asyncio.Lock()
    active_task: asyncio.Task | None = None
    active_request_id: str | None = None

    async def safe_send(payload: dict) -> None:
        async with send_lock:
            await websocket.send_json(payload)

    async def run_execute(request_id: str, user_message: str, include_context: bool, safe_mode: bool, confirmed: bool) -> None:
        nonlocal active_request_id
        try:
            await safe_send({"type": "status", "request_id": request_id, "stage": "planning"})

            if safe_mode and not confirmed:
                blocked_actions = _detect_destructive_actions(user_message)
                if blocked_actions:
                    response = _build_confirmation_response(user_message, blocked_actions)
                    await agent.save_autonomous_execution(
                        user_id=user_id,
                        user_message=user_message,
                        execution_response=response
                    )
                    await safe_send({"type": "final", "request_id": request_id, "response": response})
                    return

            if _is_chat_only_request(user_message):
                response = {
                    "message": _build_chat_only_response(user_message),
                    "actions_executed": [],
                    "status": "completed",
                    "tool_calls_count": 0,
                    "successful_count": 0,
                    "no_tools_needed": True,
                }
            else:
                await safe_send({"type": "status", "request_id": request_id, "stage": "executing"})
                response = await orchestrator.process_message(
                    user_id=user_id,
                    message=user_message,
                    include_context=include_context
                )

            await agent.save_autonomous_execution(
                user_id=user_id,
                user_message=user_message,
                execution_response=response
            )

            for idx, action in enumerate(response.get("actions_executed", []) or []):
                await safe_send({
                    "type": "action",
                    "request_id": request_id,
                    "index": idx,
                    "function_name": action.get("function_name"),
                    "success": bool(action.get("success")),
                    "error": action.get("error"),
                })

            await safe_send({"type": "final", "request_id": request_id, "response": response})
        except asyncio.CancelledError:
            await safe_send({"type": "interrupted", "request_id": request_id, "message": "Execution interrupted"})
            raise
        except Exception as exec_error:
            logger.error("Realtime execute error: %s", exec_error, exc_info=True)
            error_response = {
                "message": f"Agent execution failed: {str(exec_error)}",
                "actions_executed": [],
                "status": "error",
                "tool_calls_count": 0,
                "successful_count": 0,
                "error": str(exec_error),
            }
            await safe_send({"type": "final", "request_id": request_id, "response": error_response})
        finally:
            if active_request_id == request_id:
                active_request_id = None

    try:
        while True:
            raw_message = await websocket.receive_text()
            try:
                incoming = json.loads(raw_message)
            except json.JSONDecodeError:
                await websocket.send_json({"type": "error", "message": "Invalid JSON payload"})
                continue

            message_type = incoming.get("type")
            request_id = str(incoming.get("request_id") or "")

            if message_type == "ping":
                await websocket.send_json({"type": "pong"})
                continue

            if message_type == "transcript_partial":
                await safe_send({
                    "type": "transcript_ack",
                    "request_id": request_id,
                    "text": str(incoming.get("transcript") or "")[:200],
                })
                continue

            if message_type == "interrupt":
                target_request_id = str(incoming.get("target_request_id") or active_request_id or "")
                if active_task and not active_task.done():
                    active_task.cancel()
                    try:
                        await active_task
                    except asyncio.CancelledError:
                        pass
                active_task = None
                active_request_id = None
                await safe_send({
                    "type": "interrupted",
                    "request_id": target_request_id,
                    "message": "Interrupted by user",
                })
                continue

            if message_type != "execute":
                await safe_send({"type": "error", "message": f"Unsupported message type: {message_type}"})
                continue

            user_message = str(incoming.get("message") or "").strip()
            include_context = bool(incoming.get("include_context", True))
            safe_mode = bool(incoming.get("safe_mode", False))
            confirmed = bool(incoming.get("confirmed", False))

            if active_task and not active_task.done():
                active_task.cancel()
                try:
                    await active_task
                except asyncio.CancelledError:
                    pass

            active_request_id = request_id
            active_task = asyncio.create_task(
                run_execute(request_id, user_message, include_context, safe_mode, confirmed)
            )

    except WebSocketDisconnect:
        logger.info("Realtime websocket disconnected for user %s", user_id)
        if active_task and not active_task.done():
            active_task.cancel()
    except Exception as ws_error:
        logger.error("Realtime websocket error: %s", ws_error, exc_info=True)
        if active_task and not active_task.done():
            active_task.cancel()
        try:
            await websocket.close(code=1011)
        except Exception:
            pass


@router.post("/voice", response_model=VoiceCommandResponse)
async def process_voice_command(
    command: VoiceCommandRequest,
    user: dict = Depends(get_verified_user)
):
    """
    Process voice command and return structured response.
    
    This endpoint parses voice input without executing commands.
    Use /chat for full command execution.
    """
    from .voice_commands import voice_parser
    
    try:
        parsed = voice_parser.parse(command.transcript)
        
        return VoiceCommandResponse(
            understood=parsed.get('confidence', 0) > 0.5,
            command=parsed.get('command'),
            action=parsed.get('action'),
            message=f"I understood: {parsed.get('action')}"
        )
    except Exception as e:
        logger.error(f"Voice command error: {str(e)}")
        return VoiceCommandResponse(
            understood=False,
            command=None,
            action=None,
            message=f"Sorry, I didn't understand that: {str(e)}"
        )


@router.get("/chat/history", response_model=List[ChatHistoryItem])
async def get_chat_history(
    limit: int = 50,
    user: dict = Depends(get_verified_user),
    agent: AgentService = Depends(get_agent_service)
):
    """Get chat history for current user."""
    try:
        history = await agent.get_chat_history(user["id"], limit)
        return history
    except Exception as e:
        logger.error(f"Get history error: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )


@router.get("/actions/history", response_model=List[AgentActionLogItem])
async def get_action_history(
    limit: int = 50,
    user: dict = Depends(get_verified_user),
    agent: AgentService = Depends(get_agent_service)
):
    """Get autonomous action execution logs for current user."""
    try:
        history = await agent.get_action_history(user["id"], limit)
        return history
    except Exception as e:
        logger.error(f"Get action history error: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )


@router.delete("/chat/history")
async def clear_chat_history(
    user: dict = Depends(get_verified_user),
    agent: AgentService = Depends(get_agent_service)
):
    """Clear chat history for current user."""
    try:
        await agent.clear_chat_history(user["id"])
        return {"message": "Chat history cleared"}
    except Exception as e:
        logger.error(f"Clear history error: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )


# =====================================================
# SEARCH ENDPOINTS
# =====================================================

@router.post("/search", response_model=SearchResponse)
async def search_files(
    request: SearchRequest,
    user: dict = Depends(get_verified_user),
    agent: AgentService = Depends(get_agent_service)
):
    """
    Full-text search across documents.
    
    Search types:
    - all: Search filenames, content, and tags
    - filename: Only search filenames
    - content: Only search file content
    - tags: Only search tags
    """
    try:
        results = await agent.search_engine.full_text_search(
            user_id=user["id"],
            query=request.query,
            search_type=request.search_type,
            limit=request.limit
        )
        
        return SearchResponse(
            results=results.get('results', []),
            total=results.get('total', 0),
            query=request.query,
            search_time_ms=results.get('search_time_ms', 0)
        )
    except Exception as e:
        logger.error(f"Search error: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Search failed: {str(e)}"
        )


@router.get("/similar/{file_id}")
async def get_similar_files(
    file_id: str,
    limit: int = 10,
    user: dict = Depends(get_verified_user),
    agent: AgentService = Depends(get_agent_service)
):
    """Find files similar to the specified file."""
    try:
        results = await agent.search_engine.get_similar_files(
            user_id=user["id"],
            file_id=file_id,
            limit=limit
        )
        return {"similar_files": results}
    except Exception as e:
        logger.error(f"Similar files error: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )


# =====================================================
# ANALYTICS ENDPOINTS
# =====================================================

@router.get("/analytics", response_model=AnalyticsResponse)
async def get_analytics(
    period: str = "7d",
    user: dict = Depends(get_verified_user),
    agent: AgentService = Depends(get_agent_service)
):
    """
    Get dashboard analytics.
    
    Periods: 24h, 7d, 30d, 90d, 1y, all
    """
    try:
        analytics = await agent.analytics.get_dashboard_analytics(
            user_id=user["id"],
            period=period
        )
        return AnalyticsResponse(**analytics)
    except Exception as e:
        logger.error(f"Analytics error: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Analytics failed: {str(e)}"
        )


# =====================================================
# FILE INTELLIGENCE ENDPOINTS
# =====================================================

@router.get("/file/{file_id}/intelligence")
async def get_file_intelligence(
    file_id: str,
    user: dict = Depends(get_verified_user)
):
    """
    Get extracted intelligence for a file.
    
    Returns: text preview, entities, keywords, language
    """
    try:
        db = get_service_db()
        
        # Get extracted text
        text_data = db.table('file_extracted_text') \
            .select('text, language, word_count') \
            .eq('file_id', file_id) \
            .maybe_single() \
            .execute()
        
        # Get entities
        entities = db.table('file_entities') \
            .select('entity_type, entity_text, confidence, position') \
            .eq('file_id', file_id) \
            .order('position') \
            .execute()
        
        # Get keywords
        keywords = db.table('file_keywords') \
            .select('keyword, score, rank') \
            .eq('file_id', file_id) \
            .order('rank') \
            .execute()
        
        # Get file metadata
        file_meta = db.table('file_metadata') \
            .select('display_name') \
            .eq('id', file_id) \
            .single() \
            .execute()
        
        text_info = text_data.data if text_data.data else {}
        
        from .text_extractor import text_extractor
        preview = text_extractor.get_preview(text_info.get('text', ''), 500)
        
        return FileIntelligence(
            file_id=file_id,
            filename=file_meta.data.get('display_name', 'Unknown'),
            text_preview=preview,
            language=text_info.get('language'),
            word_count=text_info.get('word_count'),
            entities=[EntityItem(**e) for e in entities.data],
            keywords=[KeywordItem(**k) for k in keywords.data]
        )
    
    except Exception as e:
        logger.error(f"File intelligence error: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )


# =====================================================
# BATCH OPERATIONS ENDPOINTS
# =====================================================

@router.post("/batch/move", response_model=BatchOperationResponse)
async def batch_move_files(
    request: BatchMoveRequest,
    user: dict = Depends(get_verified_user)
):
    """Move multiple files to a folder."""
    try:
        db = get_service_db()
        processed = 0
        failed = 0
        errors = []
        
        for file_id in request.file_ids:
            try:
                db.table('file_metadata') \
                    .update({'folder_id': request.target_folder_id}) \
                    .eq('id', str(file_id)) \
                    .eq('user_id', str(user["id"])) \
                    .execute()
                processed += 1
            except Exception as e:
                failed += 1
                errors.append(f"File {file_id}: {str(e)}")
        
        return BatchOperationResponse(
            success=failed == 0,
            processed=processed,
            failed=failed,
            errors=errors if errors else None,
            message=f"Moved {processed} files successfully"
        )
    
    except Exception as e:
        logger.error(f"Batch move error: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )


@router.post("/batch/tag", response_model=BatchOperationResponse)
async def batch_tag_files(
    request: BatchTagRequest,
    user: dict = Depends(get_verified_user)
):
    """Add tags to multiple files."""
    try:
        db = get_service_db()
        processed = 0
        failed = 0
        errors = []
        
        for file_id in request.file_ids:
            try:
                # Get existing tags
                file = db.table('file_metadata') \
                    .select('tags') \
                    .eq('id', str(file_id)) \
                    .eq('user_id', str(user["id"])) \
                    .single() \
                    .execute()
                
                existing_tags = file.data.get('tags', []) or []
                new_tags = list(set(existing_tags + request.tags))
                
                db.table('file_metadata') \
                    .update({'tags': new_tags}) \
                    .eq('id', str(file_id)) \
                    .execute()
                
                processed += 1
            except Exception as e:
                failed += 1
                errors.append(f"File {file_id}: {str(e)}")
        
        return BatchOperationResponse(
            success=failed == 0,
            processed=processed,
            failed=failed,
            errors=errors if errors else None,
            message=f"Tagged {processed} files successfully"
        )
    
    except Exception as e:
        logger.error(f"Batch tag error: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )


@router.post("/batch/delete", response_model=BatchOperationResponse)
async def batch_delete_files(
    request: BatchDeleteRequest,
    user: dict = Depends(get_verified_user)
):
    """Delete multiple files."""
    try:
        db = get_service_db()
        processed = 0
        failed = 0
        errors = []
        
        for file_id in request.file_ids:
            try:
                db.table('file_metadata') \
                    .delete() \
                    .eq('id', str(file_id)) \
                    .eq('user_id', str(user["id"])) \
                    .execute()
                processed += 1
            except Exception as e:
                failed += 1
                errors.append(f"File {file_id}: {str(e)}")
        
        return BatchOperationResponse(
            success=failed == 0,
            processed=processed,
            failed=failed,
            errors=errors if errors else None,
            message=f"Deleted {processed} files successfully"
        )
    
    except Exception as e:
        logger.error(f"Batch delete error: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )


# =====================================================
# UTILITY ENDPOINTS
# =====================================================

@router.get("/commands")
async def get_available_commands():
    """Get list of available voice/chat commands."""
    return {
        "categories": [
            {
                "name": "Search & Filter",
                "commands": [
                    "Search for [query]",
                    "Find files containing [text]",
                    "Show files with tag [tag]",
                    "Filter by [type]"
                ]
            },
            {
                "name": "Organization",
                "commands": [
                    "Show recent files",
                    "Find duplicates",
                    "Organize my files",
                    "Move [file] to [folder]"
                ]
            },
            {
                "name": "Analytics",
                "commands": [
                    "Show analytics",
                    "How much storage",
                    "Show statistics",
                    "What are my most viewed files"
                ]
            },
            {
                "name": "File Operations",
                "commands": [
                    "Upload a file",
                    "Download [filename]",
                    "Delete [filename]",
                    "Rename [old] to [new]"
                ]
            }
        ],
        "examples": [
            "Find all PDF files from last week",
            "Show me my storage usage",
            "Search for contract documents",
            "What files did I upload today"
        ]
    }


@router.get("/health")
async def agent_health_check():
    """Check agent service health and dependencies."""
    from .nlp_service import nlp_service
    from .text_extractor import text_extractor
    
    # Check NLP service
    nlp_service._lazy_init()
    nlp_available = nlp_service._initialized
    
    return {
        "status": "healthy",
        "features": {
            "chat": True,
            "voice_commands": True,
            "text_extraction": True,
            "nlp": nlp_available,
            "search": True,
            "analytics": True,
            "batch_operations": True
        },
        "version": "1.0.0"
    }
