"""
Entity Extractor — Pipeline Stage 3
Extracts structured entities (files, folders, operations, params) from natural language.

DESIGN:
  - Single focused LLM call with synonym table and examples
  - Returns typed ExtractedEntities model
  - No regex for extraction — pure LLM
  - Understands synonyms, batch references, date references
"""
import json
import logging
import re
from typing import Optional

from app.services.agent.llm_client import get_llm_client
from app.services.agent.pipeline_models import (
    ExtractedEntities, FileReference, FolderReference, BatchFilter, ClassifiedIntent
)
from app.services.agent.prompt_templates import ENTITY_EXTRACTION_PROMPT

logger = logging.getLogger(__name__)


class EntityExtractor:
    """
    Extracts structured entities from natural language using LLM.
    Understands synonyms, batch references, and complex file descriptions.
    """

    def __init__(self):
        self.llm = get_llm_client()

    def _extract_json(self, text: str) -> Optional[dict]:
        """Extract JSON from LLM response."""
        if not text:
            return None
        try:
            return json.loads(text.strip())
        except Exception:
            pass
        match = re.search(r"\{.*\}", text, re.DOTALL)
        if match:
            try:
                return json.loads(match.group())
            except Exception:
                pass
        return None

    def _parse_file_references(self, raw: list) -> list[FileReference]:
        refs = []
        for item in (raw or []):
            if not isinstance(item, dict):
                continue
            refs.append(FileReference(
                name=str(item.get("name", "")).strip(),
                is_exact_name=bool(item.get("is_exact_name", False)),
                extension=item.get("extension"),
                is_pronoun=bool(item.get("is_pronoun", False))
            ))
        return [r for r in refs if r.name]

    def _parse_folder_references(self, raw: list) -> list[FolderReference]:
        refs = []
        for item in (raw or []):
            if not isinstance(item, dict):
                continue
            refs.append(FolderReference(
                name=str(item.get("name", "")).strip(),
                role=str(item.get("role", "target")),
                is_pronoun=bool(item.get("is_pronoun", False))
            ))
        return [r for r in refs if r.name]

    def _parse_batch_filter(self, raw: Optional[dict]) -> Optional[BatchFilter]:
        if not raw or not isinstance(raw, dict):
            return None
        return BatchFilter(
            extension=raw.get("extension"),
            file_type=raw.get("file_type"),
            date_filter=raw.get("date_filter"),
            tag=raw.get("tag"),
            label=raw.get("label"),
            name_pattern=raw.get("name_pattern")
        )

    async def extract(self, message: str, intent: ClassifiedIntent) -> ExtractedEntities:
        """
        Extract entities from a user message.
        
        Args:
            message: Normalized user message
            intent: Classification result from IntentClassifier
            
        Returns:
            ExtractedEntities with all parsed entities
        """
        if not message.strip():
            return ExtractedEntities()

        try:
            # Build the extraction prompt with intent context
            context_hint = ""
            if intent.operations:
                context_hint = f"\nDetected operations: {', '.join(intent.operations)}"

            response = await self.llm.async_chat_completion(
                messages=[
                    {"role": "system", "content": ENTITY_EXTRACTION_PROMPT + context_hint},
                    {"role": "user", "content": message}
                ],
                tools=None,
                tool_choice="none",
                temperature=0.0,
                max_tokens=500
            )

            content = response.get("content", "")
            parsed = self._extract_json(content)

            if not parsed:
                logger.warning("Entity extractor: could not parse LLM JSON for: %s", message[:80])
                return ExtractedEntities(operations=intent.operations or [])

            entities = ExtractedEntities(
                file_references=self._parse_file_references(parsed.get("file_references")),
                folder_references=self._parse_folder_references(parsed.get("folder_references")),
                new_name=parsed.get("new_name"),
                tags=parsed.get("tags") or [],
                operations=parsed.get("operations") or intent.operations or [],
                batch_mode=bool(parsed.get("batch_mode", False)),
                batch_filter=self._parse_batch_filter(parsed.get("batch_filter")),
                email=parsed.get("email"),
                password=parsed.get("password"),
                page_range=parsed.get("page_range"),
                target_format=parsed.get("target_format"),
                bundle_name=parsed.get("bundle_name")
            )

            logger.info(
                "Entities extracted: files=%d folders=%d ops=%s batch=%s",
                len(entities.file_references),
                len(entities.folder_references),
                entities.operations,
                entities.batch_mode
            )
            return entities

        except Exception as e:
            logger.error("Entity extractor LLM error (using local fallback): %s", e)
            return self._extract_local_entities(message, intent)

    def _extract_local_entities(self, message: str, intent: ClassifiedIntent) -> ExtractedEntities:
        import re
        from app.services.agent.pipeline_models import FileReference, FolderReference

        msg = message.strip()
        ops = intent.operations or []

        # 1. Extract new_name for rename operations
        new_name = None
        rename_match = re.search(r'\b(?:rename|call|save|as|relabel)\s+.*?\s+(?:to|as)\s+["\']?([A-Za-z0-9_\-\.]+\.[a-z]{2,4}|[A-Za-z0-9_\-\s]+)["\']?', msg, re.IGNORECASE)
        if not rename_match:
            rename_match = re.search(r'\b(?:to|as)\s+["\']?([A-Za-z0-9_\-\.]+\.[a-z]{2,4}|[A-Za-z0-9_\-\s]+)["\']?', msg, re.IGNORECASE)
        if rename_match:
            candidate_name = rename_match.group(1).strip().strip('"\'')
            if candidate_name and candidate_name.lower() not in ["folder", "favorites", "trash", "myfolder", "new folder"]:
                new_name = candidate_name

        # 2. Extract source file references (excluding new_name)
        files = []
        file_matches = re.findall(r'\b[A-Za-z0-9_\-\.]+\.(?:pdf|docx|doc|txt|xlsx|xls|pptx|ppt|png|jpg|jpeg|zip|csv)\b', msg, re.IGNORECASE)
        for f in file_matches:
            if new_name and f.lower() == new_name.lower():
                continue
            files.append(FileReference(name=f, is_exact_name=True))

        if not files:
            single_match = re.search(r'(?:open|view|show|find|search for|where is|favorite|favourites|star|tag|rename|delete)\s+([A-Za-z0-9_\-\.]+)', msg, re.IGNORECASE)
            if single_match:
                candidate = single_match.group(1).strip()
                if candidate.lower() not in ["for", "documents", "containing", "the", "a", "file", "folder", "my", "to", "as"]:
                    if not (new_name and candidate.lower() == new_name.lower()):
                        files.append(FileReference(name=candidate, is_exact_name=True))

        # 3. Extract folder references
        folders = []
        create_folder_match = re.search(r'(?:create|make|add)(?:\s+new)?\s+folder\s+(?:named|called|title)?\s*["\']?([A-Za-z0-9_\-\s]+?)["\']?\s*$', msg, re.IGNORECASE)
        if create_folder_match:
            folder_name = create_folder_match.group(1).strip().strip('"\'')
            if folder_name and folder_name.lower() not in ["new", "a", "the"]:
                folders.append(FolderReference(name=folder_name, role="created"))
        else:
            folder_match = re.search(r'(?:in|into|to|inside)\s+(?:the\s+)?([A-Za-z0-9_\-]+(?:\s+folder)?)', msg, re.IGNORECASE)
            if folder_match:
                fname = folder_match.group(1).replace("folder", "").strip()
                if fname and fname.lower() not in ["root", "here"]:
                    folders.append(FolderReference(name=fname, role="destination"))

        # 4. Extract tags
        tags = []
        tag_match = re.search(r'\b(?:tag|label|add tag)\s+(?:["\']?([A-Za-z0-9_\-]+)["\']?\s+to\s+|as\s+["\']?([A-Za-z0-9_\-]+)["\']?|urgent|important|final|draft)', msg, re.IGNORECASE)
        if tag_match:
            extracted_tag = (tag_match.group(1) or tag_match.group(2) or tag_match.group(0).split()[-1]).strip().strip('"\'')
            if extracted_tag and extracted_tag.lower() not in ["file", "document", "tag", "add"]:
                tags.append(extracted_tag)

        return ExtractedEntities(
            file_references=files,
            folder_references=folders,
            new_name=new_name,
            tags=tags,
            operations=ops
        )


# Global singleton
_entity_extractor: Optional[EntityExtractor] = None


def get_entity_extractor() -> EntityExtractor:
    global _entity_extractor
    if _entity_extractor is None:
        _entity_extractor = EntityExtractor()
    return _entity_extractor
