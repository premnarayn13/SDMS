"""
Pipeline Models for Docky AI Agent
Typed Pydantic models used across all pipeline stages.
Every stage has a well-defined input/output contract.
"""
from __future__ import annotations

from enum import Enum
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field


# =====================================================
# ENUMS
# =====================================================

class IntentType(str, Enum):
    OPERATION = "OPERATION"
    CONVERSATION = "CONVERSATION"
    AMBIGUOUS = "AMBIGUOUS"


class OperationKind(str, Enum):
    # File operations
    SEARCH = "search"
    OPEN = "open"
    DOWNLOAD = "download"
    RENAME = "rename"
    MOVE = "move"
    COPY = "copy"
    DUPLICATE = "duplicate"
    DELETE = "delete"          # blocked at safety layer — included for classification only
    RESTORE = "restore"
    FAVORITE = "favorite"
    UNFAVORITE = "unfavorite"
    TAG = "tag"
    UNTAG = "untag"
    SHARE = "share"
    UNSHARE = "unshare"
    COMPRESS = "compress"
    EXTRACT = "extract"
    CONVERT = "convert"
    MERGE = "merge"
    SPLIT = "split"
    ENCRYPT = "encrypt"
    DECRYPT = "decrypt"
    PIN = "pin"
    UNPIN = "unpin"
    # Info / analysis
    GET_INFO = "get_info"
    GET_STATS = "get_stats"
    GET_ANALYTICS = "get_analytics"
    GET_STORAGE = "get_storage"
    GET_ACTIVITY = "get_activity"
    GET_VERSIONS = "get_versions"
    EXTRACT_TEXT = "extract_text"
    EXTRACT_ENTITIES = "extract_entities"
    EXTRACT_KEYWORDS = "extract_keywords"
    DETECT_LANGUAGE = "detect_language"
    FIND_DUPLICATES = "find_duplicates"
    FIND_SIMILAR = "find_similar"
    # List / filter
    LIST = "list"
    FILTER = "filter"
    RECENT = "recent"
    # Folder operations
    CREATE_FOLDER = "create_folder"
    RENAME_FOLDER = "rename_folder"
    MOVE_FOLDER = "move_folder"
    DELETE_FOLDER = "delete_folder"
    LIST_FOLDERS = "list_folders"
    GET_FOLDER_TREE = "get_folder_tree"
    # Batch operations
    BATCH_RENAME = "batch_rename"
    BATCH_MOVE = "batch_move"
    BATCH_TAG = "batch_tag"
    BATCH_FAVORITE = "batch_favorite"
    BATCH_DELETE = "batch_delete"
    # Power tools
    BUNDLE = "bundle"
    WORD_COUNT = "word_count"
    ADD_WATERMARK = "add_watermark"
    ROTATE = "rotate"
    REMOVE_PAGES = "remove_pages"
    PASSWORD_PROTECT = "password_protect"
    REMOVE_PASSWORD = "remove_password"
    # Misc
    UNKNOWN = "unknown"


class StepStatus(str, Enum):
    PENDING = "pending"
    RUNNING = "running"
    SUCCESS = "success"
    FAILED = "failed"
    SKIPPED = "skipped"


# =====================================================
# STAGE 2 — INTENT CLASSIFICATION
# =====================================================

class ClassifiedIntent(BaseModel):
    """Output of IntentClassifier"""
    intent: IntentType
    operations: List[str] = Field(default_factory=list, description="Detected operation keywords")
    needs_history: bool = Field(
        default=False,
        description="True only when message contains pronouns like 'it', 'that file', 'them'"
    )
    confidence: float = Field(default=1.0, ge=0.0, le=1.0)
    clarification_question: Optional[str] = Field(
        default=None,
        description="Question to ask user when AMBIGUOUS"
    )
    raw_message: str = ""


# =====================================================
# STAGE 3 — ENTITY EXTRACTION
# =====================================================

class FileReference(BaseModel):
    """A reference to a file extracted from user message"""
    name: str
    is_exact_name: bool = False       # True if quoted or very specific
    extension: Optional[str] = None   # e.g. "pdf", "docx"
    is_pronoun: bool = False          # True if "it", "that file" etc.


class FolderReference(BaseModel):
    """A reference to a folder extracted from user message"""
    name: str
    role: str = "target"   # "source" | "destination" | "target"
    is_pronoun: bool = False


class BatchFilter(BaseModel):
    """Criteria for batch/bulk operations"""
    extension: Optional[str] = None
    file_type: Optional[str] = None   # e.g. "image", "document", "video"
    date_filter: Optional[str] = None # e.g. "today", "this week", "last month"
    tag: Optional[str] = None
    label: Optional[str] = None
    name_pattern: Optional[str] = None


class ExtractedEntities(BaseModel):
    """Output of EntityExtractor"""
    file_references: List[FileReference] = Field(default_factory=list)
    folder_references: List[FolderReference] = Field(default_factory=list)
    new_name: Optional[str] = None
    tags: List[str] = Field(default_factory=list)
    operations: List[str] = Field(default_factory=list)
    batch_mode: bool = False
    batch_filter: Optional[BatchFilter] = None
    email: Optional[str] = None             # for share operations
    password: Optional[str] = None          # for encrypt/decrypt
    page_range: Optional[str] = None        # for split/extract page ops
    target_format: Optional[str] = None     # for convert operations
    bundle_name: Optional[str] = None       # for bundle/zip ops


# =====================================================
# STAGE 4 — REFERENCE RESOLUTION
# =====================================================

class ResolvedReference(BaseModel):
    """A pronoun/reference that has been resolved to a concrete entity"""
    original: str            # "it", "that file", "them"
    resolved_file_id: Optional[str] = None
    resolved_file_name: Optional[str] = None
    resolved_folder_id: Optional[str] = None
    resolved_folder_name: Optional[str] = None
    resolved_file_ids: List[str] = Field(default_factory=list)  # for "them"
    method: str = ""         # "last_search", "last_operation", "last_file"
    unresolved: bool = False # True if could not resolve


# =====================================================
# STAGE 5 — EXECUTION PLANNING
# =====================================================

class PlannedStep(BaseModel):
    """A single step in the execution plan"""
    step_id: str                              # e.g. "step_1"
    tool: str                                 # Tool name from tool_registry
    args: Dict[str, Any] = Field(default_factory=dict)
    depends_on: List[str] = Field(default_factory=list)   # step_ids this step depends on
    produces: Optional[str] = None            # what variable name this produces (e.g. "file_id")
    is_required: bool = True                  # if False, failure doesn't stop chain
    description: str = ""                     # human-readable description
    status: StepStatus = StepStatus.PENDING


class ExecutionPlan(BaseModel):
    """Complete ordered plan produced by ExecutionPlanner"""
    steps: List[PlannedStep]
    summary: str = ""   # human-readable plan summary
    is_batch: bool = False


# =====================================================
# STAGE 6 — PRE-EXECUTION VALIDATION
# =====================================================

class ValidationResult(BaseModel):
    """Output of PreExecutionValidator"""
    valid: bool
    reason: Optional[str] = None
    suggestion: Optional[str] = None
    blocking_step: Optional[str] = None  # step_id that failed validation
    amended_plan: Optional[ExecutionPlan] = None  # plan with auto-corrections applied


# =====================================================
# STAGE 7 — EXECUTION
# =====================================================

class StepResult(BaseModel):
    """Result of a single executed step"""
    step_id: str
    tool: str
    success: bool
    data: Dict[str, Any] = Field(default_factory=dict)
    error: Optional[str] = None
    blocked_by_safety: bool = False


class ExecutionResult(BaseModel):
    """Complete output of ExecutionEngine"""
    all_success: bool
    steps: List[StepResult] = Field(default_factory=list)
    failed_at: Optional[str] = None   # step_id of first failure
    partial: bool = False
    
    def successful_steps(self) -> List[StepResult]:
        return [s for s in self.steps if s.success]
    
    def failed_steps(self) -> List[StepResult]:
        return [s for s in self.steps if not s.success]
    
    def get_step_data(self, step_id: str) -> Dict[str, Any]:
        for s in self.steps:
            if s.step_id == step_id:
                return s.data
        return {}


# =====================================================
# AGENT MEMORY
# =====================================================

class ReferenceContext(BaseModel):
    """Minimal context stored per user for reference resolution"""
    last_file_id: Optional[str] = None
    last_file_name: Optional[str] = None
    last_folder_id: Optional[str] = None
    last_folder_name: Optional[str] = None
    last_search_results: List[Dict[str, Any]] = Field(default_factory=list)
    last_operation: Optional[str] = None


# =====================================================
# FINAL AGENT RESPONSE
# =====================================================

class AgentResponse(BaseModel):
    """Final response from the agent pipeline"""
    message: str
    actions_executed: List[Dict[str, Any]] = Field(default_factory=list)
    status: str = "completed"          # "completed" | "partial" | "error" | "clarification_needed" | "blocked"
    needs_clarification: bool = False
    clarification_question: Optional[str] = None
    tool_calls_count: int = 0
    successful_count: int = 0
    no_tools_needed: bool = False
    # Preserve compatibility fields for existing router response_model
    error: Optional[str] = None
    has_restrictions: bool = False
