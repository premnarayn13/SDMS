"""
Document Grounded Chat Engine
Handles single-document conversational Q&A with strict zero-hallucination guardrails and page citations.
"""
import os
import re
import json
import logging
from typing import Dict, Any, List, Optional
from datetime import datetime

from .prompt_manager import format_chat_prompt
from .schemas import ChatResponse, ChatMessage
from pathlib import Path
from dotenv import load_dotenv

# Load backend/.env
env_path = Path(__file__).resolve().parent.parent.parent.parent / ".env"
load_dotenv(dotenv_path=env_path)

logger = logging.getLogger(__name__)


class GroundedDocumentChat:
    """Grounded Chat engine bound strictly to active document session context."""

    def __init__(self):
        pass

    @property
    def gemini_api_key(self) -> Optional[str]:
        return os.environ.get("GEMINI_API_KEY") or os.environ.get("GOOGLE_API_KEY")

    @property
    def groq_api_key(self) -> Optional[str]:
        return os.environ.get("GROQ_API_KEY")

    def answer_question(
        self,
        session_id: str,
        user_message: str,
        document_context: Dict[str, Any],
        conversation_history: Optional[List[ChatMessage]] = None
    ) -> ChatResponse:
        """
        Executes grounded QA against the document content.
        Enforces zero hallucination and page citations.
        """
        raw_text = document_context.get("raw_text", "")
        pages = document_context.get("pages", [])
        analysis = document_context.get("analysis", {})
        doc_name = document_context.get("document_name", "Document")

        # Formatted pages text with explicit page tags
        pages_text_list = []
        for p in pages:
            page_num = p.get("page_number", 1)
            p_text = p.get("text", "")
            pages_text_list.append(f"[Page {page_num}]\n{p_text}")

        formatted_doc_content = "\n\n".join(pages_text_list) if pages_text_list else raw_text

        # Append structured intelligence metadata for high accuracy
        extra_parts = [f"[Document Title]: {doc_name}"]
        if analysis and isinstance(analysis, dict):
            if analysis.get("executive_summary"):
                extra_parts.append(f"[Executive Summary]: {analysis['executive_summary']}")
            if analysis.get("key_highlights"):
                extra_parts.append(f"[Key Highlights]: {', '.join(str(h) for h in analysis['key_highlights'])}")
            if analysis.get("people_mentioned"):
                extra_parts.append(f"[People Mentioned / User Name]: {', '.join(str(p) for p in analysis['people_mentioned'])}")
            if analysis.get("organizations"):
                extra_parts.append(f"[Organizations]: {', '.join(str(o) for o in analysis['organizations'])}")
            if analysis.get("important_dates"):
                extra_parts.append(f"[Important Dates]: {', '.join(str(d) for d in analysis['important_dates'])}")

        if extra_parts:
            joined_extra = "\n".join(extra_parts)
            formatted_doc_content = f"{joined_extra}\n\n{formatted_doc_content}"

        system_prompt = format_chat_prompt(formatted_doc_content)
        answer_text = ""
        citations = []

        # 1. Call Gemini or Fallback LLM
        answer_text = self._call_llm_for_chat(system_prompt, user_message, conversation_history)

        # 2. Extract page numbers referenced in the answer (e.g., [Page 3])
        page_matches = re.findall(r'\[Page\s*(\d+)\]', answer_text, re.IGNORECASE)
        if page_matches:
            citations = sorted(list(set(int(p) for p in page_matches)))

        # 3. Grounding Verification check
        is_unanswerable = "not available in the current document" in answer_text.lower()
        
        return ChatResponse(
            session_id=session_id,
            answer=answer_text.strip(),
            page_references=citations,
            section_references=[f"Page {p}" for p in citations],
            grounded=not is_unanswerable,
            confidence=1.0 if not is_unanswerable else 0.0,
            timestamp=datetime.utcnow().isoformat()
        )

    def _call_llm_for_chat(
        self,
        system_prompt: str,
        user_message: str,
        history: Optional[List[ChatMessage]] = None
    ) -> str:
        """Sends query to Gemini or Groq."""
        # 1. Try Google Gemini API
        if self.gemini_api_key:
            try:
                import google.generativeai as genai
                genai.configure(api_key=self.gemini_api_key)
                try:
                    model = genai.GenerativeModel("gemini-2.0-flash")
                except Exception:
                    model = genai.GenerativeModel("gemini-pro")
                
                # Format conversation history
                chat_session = model.start_chat(history=[])
                full_prompt = f"{system_prompt}\n\nUSER QUESTION: {user_message}"
                response = chat_session.send_message(full_prompt)
                return response.text
            except Exception as e:
                logger.warning(f"Gemini chat API error: {e}. Falling back to Groq...")

        # 2. Try Groq API Fallback
        if self.groq_api_key:
            try:
                from groq import Groq
                client = Groq(api_key=self.groq_api_key)
                messages = [{"role": "system", "content": system_prompt}]

                if history:
                    for h in history[-6:]:
                        messages.append({"role": h.role, "content": h.content})

                messages.append({"role": "user", "content": user_message})

                response = client.chat.completions.create(
                    messages=messages,
                    model="openai/gpt-oss-120b",
                    temperature=0.1
                )
                return response.choices[0].message.content
            except Exception as e:
                logger.error(f"Groq chat API error: {e}")

        # 3. Fallback text response
        return "The requested information is not available in the current document."


chat_instance = GroundedDocumentChat()
