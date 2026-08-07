"""
Intent Classifier — Pipeline Stage 2
Classifies user messages into OPERATION | CONVERSATION | AMBIGUOUS.

DESIGN:
  - Single focused LLM call with short, structured prompt
  - Returns structured ClassifiedIntent model
  - No keyword matching, no regex
  - Replaces _is_chat_only_request() and _should_use_fast_path() from orchestrator.py
"""
import json
import logging
import re
from typing import List, Optional

from app.services.agent.llm_client import get_llm_client
from app.services.agent.pipeline_models import ClassifiedIntent, IntentType
from app.services.agent.prompt_templates import INTENT_CLASSIFICATION_PROMPT

logger = logging.getLogger(__name__)

# Fast-path: phrases that are definitely conversational and need no LLM call
_DEFINITELY_CHAT = frozenset([
    "hi", "hello", "hey", "good morning", "good evening", "good afternoon",
    "how are you", "who are you", "what are you", "what is your name",
    "what can you do", "how can you help", "help me", "thanks", "thank you",
    "bye", "goodbye", "ok", "okay", "cool", "great", "nice", "awesome",
    "what's up", "sup",
])

# Pronouns that trigger needs_history=True
_PRONOUN_PATTERNS = re.compile(
    r"\b(it|that file|that document|that folder|the file|the document|the folder|"
    r"them|those files|those documents|those folders|these files|"
    r"the previous|the one|the same|this file|this document)\b",
    re.IGNORECASE
)


class IntentClassifier:
    """
    Classifies user messages into structured intents using LLM.
    Uses a short focused prompt with few-shot examples.
    Avoids keyword matching for intent detection entirely.
    """

    def __init__(self):
        self.llm = get_llm_client()

    def _is_definitely_chat(self, message: str) -> bool:
        """Fast pre-check: if message is clearly conversational, skip LLM."""
        clean = message.strip().lower().rstrip("!?.,")
        if clean in _DEFINITELY_CHAT:
            return True
        # Single short question with no file-action words
        words = clean.split()
        if len(words) <= 4 and "?" in message:
            has_action = any(w in clean for w in ["find", "search", "rename", "open", "move", "show", "list", "get"])
            if not has_action:
                return True
        return False

    def _has_pronoun_reference(self, message: str) -> bool:
        """Check if message has pronouns requiring history lookup."""
        return bool(_PRONOUN_PATTERNS.search(message))

    def _extract_json(self, text: str) -> Optional[dict]:
        """Extract JSON from LLM response text."""
        if not text:
            return None
        # Try direct parse
        try:
            return json.loads(text.strip())
        except Exception:
            pass
        # Try to extract JSON block
        match = re.search(r"\{.*\}", text, re.DOTALL)
        if match:
            try:
                return json.loads(match.group())
            except Exception:
                pass
        return None

    async def classify(self, message: str) -> ClassifiedIntent:
        """
        Classify a user message into intent type.
        
        Args:
            message: Raw user message
            
        Returns:
            ClassifiedIntent with intent type and metadata
        """
        if not message or not message.strip():
            return ClassifiedIntent(
                intent=IntentType.CONVERSATION,
                confidence=1.0,
                raw_message=message or ""
            )

        # Fast path for definitely conversational messages
        if self._is_definitely_chat(message):
            logger.debug("Intent fast-path: CONVERSATION (definite chat)")
            return ClassifiedIntent(
                intent=IntentType.CONVERSATION,
                confidence=0.99,
                needs_history=False,
                raw_message=message
            )

        try:
            response = await self.llm.async_chat_completion(
                messages=[
                    {"role": "system", "content": INTENT_CLASSIFICATION_PROMPT},
                    {"role": "user", "content": message}
                ],
                tools=None,
                tool_choice="none",
                temperature=0.0,
                max_tokens=200
            )

            content = response.get("content", "")
            parsed = self._extract_json(content)

            if not parsed:
                logger.warning("Intent classifier: could not parse LLM JSON, defaulting to OPERATION")
                return ClassifiedIntent(
                    intent=IntentType.OPERATION,
                    confidence=0.5,
                    needs_history=self._has_pronoun_reference(message),
                    raw_message=message
                )

            intent_str = parsed.get("intent", "OPERATION").upper()
            try:
                intent = IntentType(intent_str)
            except ValueError:
                intent = IntentType.OPERATION

            # Override needs_history with our own pronoun check as a safety net
            needs_history = parsed.get("needs_history", False) or self._has_pronoun_reference(message)

            result = ClassifiedIntent(
                intent=intent,
                operations=parsed.get("operations") or [],
                needs_history=needs_history,
                confidence=float(parsed.get("confidence", 0.9)),
                clarification_question=parsed.get("clarification_question"),
                raw_message=message
            )

            logger.info(
                "Intent classified: %s | ops=%s | needs_history=%s | confidence=%.2f",
                result.intent, result.operations, result.needs_history, result.confidence
            )
            return result

        except Exception as e:
            logger.error("Intent classifier LLM error (using local fallback): %s", e)
            detected_ops = self._detect_local_operations(message)
            has_pronoun = self._has_pronoun_reference(message)
            has_op = bool(detected_ops) or has_pronoun
            return ClassifiedIntent(
                intent=IntentType.OPERATION if has_op else IntentType.CONVERSATION,
                operations=detected_ops,
                confidence=0.7,
                needs_history=has_pronoun,
                raw_message=message
            )

    def _detect_local_operations(self, message: str) -> List[str]:
        msg = message.lower()
        ops = []
        if any(w in msg for w in ["open", "view", "show me", "preview"]):
            ops.append("open")
        if any(w in msg for w in ["rename", "call it", "relabel", "change name", "name it"]):
            ops.append("rename")
        if any(w in msg for w in ["move", "put", "place", "transfer"]):
            ops.append("move")
        if any(w in msg for w in ["delete", "remove", "trash"]):
            ops.append("delete")
        if any(w in msg for w in ["download", "export", "get"]):
            ops.append("download")
        if any(w in msg for w in ["star", "favorite", "favourite", "favourites", "favorites", "bookmark", "add to fav"]):
            ops.append("favorite")
        if any(w in msg for w in ["tag", "label", "add tag"]):
            ops.append("tag")
        if any(w in msg for w in ["search", "find", "locate", "where is"]):
            ops.append("search")
        if any(w in msg for w in ["convert"]):
            ops.append("convert")
        if any(w in msg for w in ["create folder", "new folder", "create new folder", "make folder", "add folder"]):
            ops.append("create_folder")
        if any(w in msg for w in ["word count", "character count", "stats"]):
            ops.append("get_stats")
        return ops


# Global singleton
_intent_classifier: Optional[IntentClassifier] = None


def get_intent_classifier() -> IntentClassifier:
    global _intent_classifier
    if _intent_classifier is None:
        _intent_classifier = IntentClassifier()
    return _intent_classifier
