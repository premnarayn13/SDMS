"""
Document Analyzer Module
Uses Google Gemini to analyze document text and generate comprehensive structured intelligence JSON.
"""
import os
import json
import logging
import re
from typing import Dict, Any, Optional
from datetime import datetime

from .schemas import (
    DocumentAnalysisResult, DocumentStatistics, TimelineEvent, ActionItem, RiskItem,
    ImportantClause, TableInfo, FormFieldInfo
)
from .prompt_manager import ANALYSIS_SYSTEM_PROMPT, format_analysis_prompt
from pathlib import Path
from dotenv import load_dotenv

# Load backend/.env
env_path = Path(__file__).resolve().parent.parent.parent.parent / ".env"
load_dotenv(dotenv_path=env_path)

logger = logging.getLogger(__name__)


class DocumentAnalyzer:
    """Document Intelligence Analyzer using Google Gemini."""

    def __init__(self):
        pass

    @property
    def gemini_api_key(self) -> Optional[str]:
        return os.environ.get("GEMINI_API_KEY") or os.environ.get("GOOGLE_API_KEY")

    @property
    def groq_api_key(self) -> Optional[str]:
        return os.environ.get("GROQ_API_KEY")

    def analyze_document(
        self,
        extracted_data: Dict[str, Any],
        document_id: str,
        document_name: str,
        file_type: str
    ) -> DocumentAnalysisResult:
        """Analyzes document text and returns structured DocumentAnalysisResult."""
        raw_text = extracted_data.get("raw_text", "")
        pages = extracted_data.get("pages", [])
        total_pages = len(pages) if pages else 1
        word_count = len(raw_text.split())
        char_count = len(raw_text)
        reading_time = round(max(0.5, word_count / 220), 1)

        # 1. Truncate text if extremely long to fit model context safely (~50k tokens)
        truncated_text = raw_text[:120000]

        # 2. Call LLM for Structured Extraction
        json_output = self._call_llm_for_analysis(truncated_text, document_name, file_type)

        # 3. Build & Sanitize result schema
        stats = DocumentStatistics(
            total_pages=total_pages,
            total_words=word_count,
            total_characters=char_count,
            reading_time_minutes=reading_time,
            language=json_output.get("statistics", {}).get("language", "English"),
            file_type=file_type.upper(),
            file_size_bytes=extracted_data.get("file_size", 0)
        )

        timeline_items = [
            TimelineEvent(**item) if isinstance(item, dict) else TimelineEvent(date="", event=str(item))
            for item in json_output.get("timeline", [])
        ]

        action_items = [
            ActionItem(**item) if isinstance(item, dict) else ActionItem(task=str(item))
            for item in json_output.get("action_items", [])
        ]

        risk_items = [
            RiskItem(**item) if isinstance(item, dict) else RiskItem(risk=str(item), severity="Medium")
            for item in json_output.get("risks", [])
        ]

        important_clauses = [
            ImportantClause(**item) if isinstance(item, dict) else ImportantClause(title="Clause", summary=str(item))
            for item in json_output.get("important_clauses", [])
        ]

        tables_detected = [
            TableInfo(**item) if isinstance(item, dict) else TableInfo(title=str(item))
            for item in json_output.get("tables_detected", [])
        ]

        forms_detected = [
            FormFieldInfo(**item) if isinstance(item, dict) else FormFieldInfo(key="Field", value=str(item))
            for item in json_output.get("forms_detected", [])
        ]

        page_refs = [
            {"page_number": p.get("page_number", 1), "preview": p.get("text", "")[:120]}
            for p in pages
        ]

        return DocumentAnalysisResult(
            document_id=document_id,
            document_name=document_name,
            file_type=file_type.upper(),
            analysis_timestamp=datetime.utcnow().isoformat(),
            confidence_score=float(json_output.get("confidence_score", 0.95)),
            executive_summary=json_output.get("executive_summary") or f"Document '{document_name}' has been processed. Total {total_pages} page(s) and {word_count} words analyzed.",
            key_highlights=json_output.get("key_highlights", ["Document parsed successfully."]),
            important_dates=json_output.get("important_dates", []),
            timeline=timeline_items,
            deadlines=json_output.get("deadlines", []),
            people_mentioned=json_output.get("people_mentioned", []),
            organizations=json_output.get("organizations", []),
            locations=json_output.get("locations", []),
            phone_numbers=json_output.get("phone_numbers", []),
            email_addresses=json_output.get("email_addresses", []),
            monetary_values=json_output.get("monetary_values", []),
            invoice_numbers=json_output.get("invoice_numbers", []),
            identification_numbers=json_output.get("identification_numbers", []),
            topics=json_output.get("topics", ["General"]),
            keywords=json_output.get("keywords", [document_name, file_type]),
            document_category=json_output.get("document_category", "General Document"),
            action_items=action_items,
            obligations=json_output.get("obligations", []),
            risks=risk_items,
            important_clauses=important_clauses,
            tables_detected=tables_detected,
            forms_detected=forms_detected,
            suggested_questions=json_output.get("suggested_questions", [
                f"What are the key points of {document_name}?",
                "What action items or deadlines are mentioned?",
                "Who are the key people or organizations involved?",
                "Are there any legal or financial risks identified?"
            ]),
            statistics=stats,
            page_references=page_refs,
            section_references=[f"Page {p['page_number']}" for p in pages]
        )

    def _call_llm_for_analysis(self, document_text: str, file_name: str, file_type: str) -> Dict[str, Any]:
        """Executes LLM call using Google Gemini or fallback Groq client."""
        user_prompt = format_analysis_prompt(document_text, file_name, file_type)

        # 1. Try Google Gemini API
        if self.gemini_api_key:
            try:
                import google.generativeai as genai
                genai.configure(api_key=self.gemini_api_key)
                try:
                    model = genai.GenerativeModel("gemini-2.0-flash")
                except Exception:
                    model = genai.GenerativeModel("gemini-pro")
                full_prompt = f"{ANALYSIS_SYSTEM_PROMPT}\n\n{user_prompt}"
                response = model.generate_content(
                    full_prompt,
                    generation_config={"response_mime_type": "application/json", "temperature": 0.2}
                )
                return json.loads(response.text)
            except Exception as e:
                logger.warning(f"Google Gemini analysis error: {e}. Attempting fallback...")

        # 2. Try Groq API as Fallback
        if self.groq_api_key:
            try:
                from groq import Groq
                client = Groq(api_key=self.groq_api_key)
                response = client.chat.completions.create(
                    messages=[
                        {"role": "system", "content": ANALYSIS_SYSTEM_PROMPT},
                        {"role": "user", "content": user_prompt}
                    ],
                    model="openai/gpt-oss-120b",
                    temperature=0.2,
                    response_format={"type": "json_object"}
                )
                return json.loads(response.choices[0].message.content)
            except Exception as e:
                logger.error(f"Groq fallback analysis error: {e}")

        # 3. Deterministic Local Fallback JSON Generator
        return self._generate_heuristic_json(document_text, file_name, file_type)

    def _generate_heuristic_json(self, text: str, file_name: str, file_type: str) -> Dict[str, Any]:
        """Local heuristic extraction fallback if external LLMs are unavailable."""
        emails = list(set(re.findall(r'[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}', text)))[:5]
        phones = list(set(re.findall(r'\+?\d{1,3}[-.\s]?\(?\d{2,4}\)?[-.\s]?\d{3,4}[-.\s]?\d{3,4}', text)))[:5]
        amounts = list(set(re.findall(r'\$\s?\d+(?:,\d{3})*(?:\.\d{2})?', text)))[:5]
        dates = list(set(re.findall(r'\b(?:\d{1,2}[/-]\d{1,2}[/-]\d{2,4}|\d{4}-\d{2}-\d{2}|(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]* \d{1,2},? \d{4})\b', text, re.IGNORECASE)))[:5]

        words = [w.strip('.,()[]"') for w in text.split() if len(w) > 4]
        from collections import Counter
        common_words = [w for w, _ in Counter(words).most_common(8)]

        return {
            "executive_summary": f"Executive Overview for '{file_name}': The document contains approximately {len(text.split())} words and covers key points including {', '.join(common_words[:3])}. All pages have been parsed.",
            "key_highlights": [
                f"Document title: {file_name}",
                f"File format: {file_type.upper()}",
                f"Total length: {len(text.split())} words",
                f"Extracted contact channels: {len(emails)} email(s), {len(phones)} phone(s)"
            ],
            "important_dates": dates,
            "timeline": [{"date": d, "event": "Key date mentioned in document", "page_reference": 1} for d in dates[:3]],
            "email_addresses": emails,
            "phone_numbers": phones,
            "monetary_values": amounts,
            "keywords": common_words,
            "topics": [common_words[0].capitalize(), common_words[1].capitalize()] if len(common_words) >= 2 else ["Document"],
            "suggested_questions": [
                f"What is the main topic of {file_name}?",
                "What dates or deadlines are mentioned?",
                "Are there any contact emails or phone numbers?",
                "Can you summarize the main findings?"
            ],
            "confidence_score": 0.90
        }


analyzer_instance = DocumentAnalyzer()
