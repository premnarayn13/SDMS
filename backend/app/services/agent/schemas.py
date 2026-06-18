"""
Pydantic schemas for Docky Agent
"""
from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
from datetime import datetime
from uuid import UUID


# =====================================================
# Chat Schemas
# =====================================================
class ChatMessage(BaseModel):
    message: str = Field(..., min_length=1, max_length=5000)
    is_voice: bool = False


class ChatResponse(BaseModel):
    message: str
    command_type: Optional[str] = None
    results: Optional[Dict[str, Any]] = None
    action_data: Optional[Dict[str, Any]] = None
    suggestions: Optional[List[str]] = None
    timestamp: datetime = Field(default_factory=datetime.utcnow)


class ChatHistoryItem(BaseModel):
    id: UUID
    message: str
    role: str
    command_type: Optional[str]
    results: Optional[Dict]
    actions_executed: Optional[List[Dict[str, Any]]] = None
    status: Optional[str] = None
    tool_calls_count: Optional[int] = 0
    successful_count: Optional[int] = 0
    created_at: datetime

    class Config:
        from_attributes = True


# =====================================================
# Voice Command Schemas
# =====================================================
class VoiceCommandRequest(BaseModel):
    transcript: str = Field(..., min_length=1)


class VoiceCommandResponse(BaseModel):
    understood: bool
    command: Optional[str]
    action: Optional[str]
    message: str


# =====================================================
# Search Schemas
# =====================================================
class SearchRequest(BaseModel):
    query: str = Field(..., min_length=1, max_length=500)
    search_type: str = Field(default="all")  # all, filename, content, tags
    limit: int = Field(default=20, ge=1, le=100)


class SearchResult(BaseModel):
    file_id: str
    filename: str
    match_score: float
    match_type: str
    snippet: Optional[str] = None
    highlighted: Optional[str] = None
    size: Optional[int] = None


class SearchResponse(BaseModel):
    results: List[SearchResult]
    total: int
    query: str
    search_time_ms: int


# =====================================================
# Analytics Schemas
# =====================================================
class AnalyticsRequest(BaseModel):
    period: str = Field(default="7d")  # 24h, 7d, 30d, 90d, 1y
    metric_types: Optional[List[str]] = None


class FileStats(BaseModel):
    total_files: int
    total_size: int
    total_size_readable: Optional[str] = None
    by_type: Dict[str, int]
    by_drive: Dict[str, int]
    average_file_size: Optional[int] = 0


class ActivityStats(BaseModel):
    total_actions: int
    uploads: int
    downloads: int
    views: int
    shares: int
    deletes: Optional[int] = 0
    timeline: List[Dict[str, Any]]


class TopFiles(BaseModel):
    most_viewed: List[Dict[str, Any]]
    recently_added: List[Dict[str, Any]]
    largest_files: List[Dict[str, Any]]


class AnalyticsResponse(BaseModel):
    file_stats: FileStats
    activity_stats: ActivityStats
    top_files: TopFiles
    storage_breakdown: Optional[Dict[str, Any]] = None
    period: str
    generated_at: Optional[str] = None


# =====================================================
# Entity & Keyword Schemas
# =====================================================
class EntityItem(BaseModel):
    type: str
    text: str
    confidence: float
    position: int


class KeywordItem(BaseModel):
    keyword: str
    score: float
    rank: int


class FileIntelligence(BaseModel):
    file_id: UUID
    filename: str
    text_preview: Optional[str]
    language: Optional[str]
    word_count: Optional[int]
    entities: List[EntityItem]
    keywords: List[KeywordItem]


# =====================================================
# Duplicate Detection Schemas
# =====================================================
class DuplicateGroup(BaseModel):
    hash: str
    file_ids: List[UUID]
    file_count: int
    total_size: int
    created_at: datetime


class DuplicateReport(BaseModel):
    groups: List[DuplicateGroup]
    total_duplicates: int
    space_wasted: int


# =====================================================
# Batch Operations Schemas
# =====================================================
class BatchMoveRequest(BaseModel):
    file_ids: List[UUID] = Field(..., min_length=1, max_length=100)
    target_folder_id: str


class BatchTagRequest(BaseModel):
    file_ids: List[UUID] = Field(..., min_length=1, max_length=100)
    tags: List[str] = Field(..., min_length=1, max_length=10)


class BatchDeleteRequest(BaseModel):
    file_ids: List[UUID] = Field(..., min_length=1, max_length=100)


class BatchOperationResponse(BaseModel):
    success: bool
    processed: int
    failed: int
    errors: Optional[List[str]]
    message: str


# =====================================================
# Autonomous Agent Schemas (NEW)
# =====================================================
class AgentExecutionRequest(BaseModel):
    """Request for autonomous agent execution"""
    message: str = Field(..., min_length=1, max_length=2000, description="Natural language instruction")
    include_context: bool = Field(default=True, description="Include conversation history")
    safe_mode: bool = Field(default=False, description="Require confirmation for destructive actions")
    confirmed: bool = Field(default=False, description="Confirms a previously flagged destructive request")


class ActionExecutionResult(BaseModel):
    """Result of a single action execution"""
    tool_call_id: Optional[str] = None
    function_name: str
    success: bool
    data: Optional[Dict[str, Any]] = None
    error: Optional[str] = None
    blocked_by_safety: Optional[bool] = False


class AgentExecutionResponse(BaseModel):
    """Response from autonomous agent"""
    message: str = Field(..., description="Natural language response to user")
    actions_executed: List[ActionExecutionResult] = Field(default_factory=list)
    status: str = Field(..., description="completed | partial | error")
    tool_calls_count: Optional[int] = 0
    successful_count: Optional[int] = 0
    error: Optional[str] = None
    no_tools_needed: Optional[bool] = False
    confirmation_required: Optional[bool] = False
    blocked_actions: Optional[List[str]] = None
    suggested_confirmation_message: Optional[str] = None
    timestamp: datetime = Field(default_factory=datetime.utcnow)


class AgentActionLogItem(BaseModel):
    id: UUID
    message: str
    status: str
    actions_executed: List[Dict[str, Any]] = Field(default_factory=list)
    tool_calls_count: int = 0
    successful_count: int = 0
    created_at: datetime
