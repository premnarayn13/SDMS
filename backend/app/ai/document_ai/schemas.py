"""
Document AI Assistant Schemas
Pydantic data models for extraction, structured analysis, session management, and single-document chat.
"""
from typing import List, Dict, Any, Optional
from pydantic import BaseModel, Field
from datetime import datetime


# ==========================================
# SUB-MODELS FOR STRUCTURED ANALYSIS
# ==========================================

class EntityItem(BaseModel):
    name: str
    category: str  # Person, Organization, Location, Phone, Email, Amount, Invoice, ID, Date
    context: Optional[str] = None
    page_reference: Optional[int] = None


class TimelineEvent(BaseModel):
    date: str
    event: str
    impact: Optional[str] = None
    page_reference: Optional[int] = None


class ActionItem(BaseModel):
    task: str
    assignee: Optional[str] = "Unassigned"
    deadline: Optional[str] = "Not specified"
    priority: Optional[str] = "Medium"  # High, Medium, Low
    page_reference: Optional[int] = None


class RiskItem(BaseModel):
    risk: str
    severity: str  # Critical, High, Medium, Low
    clause_reference: Optional[str] = None
    mitigation: Optional[str] = None
    page_reference: Optional[int] = None


class ImportantClause(BaseModel):
    title: str
    summary: str
    clause_number: Optional[str] = None
    page_reference: Optional[int] = None


class TableInfo(BaseModel):
    title: str
    columns: List[str] = []
    row_count: int = 0
    sample_data: List[Dict[str, Any]] = []
    page_reference: Optional[int] = None


class FormFieldInfo(BaseModel):
    key: str
    value: str
    confidence: float = 1.0
    page_reference: Optional[int] = None


class DocumentStatistics(BaseModel):
    total_pages: int = 1
    total_words: int = 0
    total_characters: int = 0
    reading_time_minutes: float = 0.5
    language: str = "English"
    file_type: str = "Unknown"
    file_size_bytes: int = 0


# ==========================================
# MAIN ANALYSIS OUTPUT SCHEMA
# ==========================================

class DocumentAnalysisResult(BaseModel):
    document_id: str
    document_name: str
    file_type: str
    analysis_timestamp: str = Field(default_factory=lambda: datetime.utcnow().isoformat())
    confidence_score: float = Field(default=0.95, ge=0.0, le=1.0)
    
    # Executive Summary & Highlights
    executive_summary: str
    key_highlights: List[str] = []
    
    # Timeline & Important Dates
    important_dates: List[str] = []
    timeline: List[TimelineEvent] = []
    deadlines: List[str] = []
    
    # Named Entities
    people_mentioned: List[str] = []
    organizations: List[str] = []
    locations: List[str] = []
    phone_numbers: List[str] = []
    email_addresses: List[str] = []
    monetary_values: List[str] = []
    invoice_numbers: List[str] = []
    identification_numbers: List[str] = []
    
    # Topics & Keywords
    topics: List[str] = []
    keywords: List[str] = []
    document_category: str = "General Document"
    
    # Action Items & Governance
    action_items: List[ActionItem] = []
    obligations: List[str] = []
    risks: List[RiskItem] = []
    important_clauses: List[ImportantClause] = []
    
    # Structure & Extractions
    tables_detected: List[TableInfo] = []
    forms_detected: List[FormFieldInfo] = []
    
    # Interactive Assistants & Stats
    suggested_questions: List[str] = []
    statistics: DocumentStatistics = Field(default_factory=DocumentStatistics)
    
    # References
    page_references: List[Dict[str, Any]] = []
    section_references: List[str] = []


# ==========================================
# API REQUEST & RESPONSE SCHEMAS
# ==========================================

class AnalyzeDocumentRequest(BaseModel):
    document_id: Optional[str] = None
    file_name: Optional[str] = None
    file_path: Optional[str] = None
    content_base64: Optional[str] = None
    file_type: Optional[str] = None


class AnalyzeDocumentResponse(BaseModel):
    session_id: str
    document_id: str
    status: str  # "completed", "failed", "processing"
    analysis: DocumentAnalysisResult
    message: str = "Document successfully analyzed"


class ChatMessage(BaseModel):
    role: str  # "user" or "assistant"
    content: str
    timestamp: str = Field(default_factory=lambda: datetime.utcnow().isoformat())
    page_references: List[int] = []
    section_references: List[str] = []
    confidence: float = 1.0


class ChatRequest(BaseModel):
    session_id: str
    message: str
    conversation_history: List[ChatMessage] = []


class ChatResponse(BaseModel):
    session_id: str
    answer: str
    page_references: List[int] = []
    section_references: List[str] = []
    grounded: bool = True
    confidence: float = 1.0
    timestamp: str = Field(default_factory=lambda: datetime.utcnow().isoformat())


class SessionStatusResponse(BaseModel):
    session_id: str
    document_id: str
    document_name: str
    status: str
    created_at: str
    last_accessed: str
    is_active: bool
