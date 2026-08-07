"""
Reference Resolver — Pipeline Stage 4
Resolves pronouns like "it", "that file", "them" using minimal agent memory.

DESIGN:
  - ONLY activated when IntentClassifier sets needs_history=True
  - Looks at AgentMemory (last file, last search results, last folder)
  - NEVER injects conversation history into LLM calls
  - Returns concrete file_id/folder_id or marks as unresolved
  - If unresolved, pipeline will ask for clarification
"""
import logging
from typing import List, Optional

from app.services.agent.pipeline_models import (
    ExtractedEntities, FileReference, FolderReference,
    ReferenceContext, ResolvedReference
)

logger = logging.getLogger(__name__)

# Words that indicate "the last file touched"
_SINGLE_PRONOUNS = frozenset([
    "it", "that file", "that document", "the file", "the document",
    "this file", "this document", "this", "that", "the one",
    "the previous file", "the previous document", "the previous one"
])

# Words that indicate "multiple files from last search"
_PLURAL_PRONOUNS = frozenset([
    "them", "those files", "those documents", "these files",
    "these documents", "all of them", "those", "these"
])

# Words that indicate "the last folder"
_FOLDER_PRONOUNS = frozenset([
    "that folder", "the folder", "this folder", "it"
])


class ReferenceResolver:
    """
    Resolves pronoun references in extracted entities using agent memory.
    Only consulted when needs_history=True from IntentClassifier.
    """

    def resolve(
        self,
        entities: ExtractedEntities,
        context: ReferenceContext
    ) -> ExtractedEntities:
        """
        Resolve pronoun references in entities using memory context.
        
        Args:
            entities: Extracted entities (may contain pronoun references)
            context: Current agent memory for this user
            
        Returns:
            Updated entities with pronouns replaced by concrete values
        """
        resolved_files = []
        for ref in entities.file_references:
            if ref.is_pronoun:
                resolved = self._resolve_file_pronoun(ref.name, context)
                if resolved:
                    resolved_files.append(resolved)
                    logger.info(
                        "Resolved pronoun '%s' -> file_id=%s (%s)",
                        ref.name, resolved.name, resolved.is_exact_name
                    )
                else:
                    # Keep original as unresolved marker
                    resolved_files.append(ref)
                    logger.warning("Could not resolve pronoun '%s' — no context available", ref.name)
            else:
                resolved_files.append(ref)

        resolved_folders = []
        for ref in entities.folder_references:
            if ref.is_pronoun:
                resolved = self._resolve_folder_pronoun(ref.name, ref.role, context)
                if resolved:
                    resolved_folders.append(resolved)
                else:
                    resolved_folders.append(ref)
            else:
                resolved_folders.append(ref)

        return entities.model_copy(update={
            "file_references": resolved_files,
            "folder_references": resolved_folders
        })

    def _resolve_file_pronoun(
        self, pronoun: str, ctx: ReferenceContext
    ) -> Optional[FileReference]:
        """Resolve a single-file pronoun reference."""
        p = pronoun.strip().lower()

        if p in _PLURAL_PRONOUNS:
            # "them" / "those files" — use last search results
            if ctx.last_search_results:
                # Return a special marker: file list will be resolved in planning
                return FileReference(
                    name="$last_search_results",
                    is_exact_name=False,
                    is_pronoun=False   # resolved — it's now a concrete reference
                )
            return None

        if p in _SINGLE_PRONOUNS:
            # "it" / "that file" — use last touched file
            if ctx.last_file_id:
                return FileReference(
                    name=ctx.last_file_name or ctx.last_file_id,
                    is_exact_name=True,
                    is_pronoun=False
                )
            # Fall back to first result from last search
            if ctx.last_search_results:
                first = ctx.last_search_results[0]
                if isinstance(first, dict):
                    fname = (
                        first.get("original_filename")
                        or first.get("name")
                        or first.get("file_name")
                        or ""
                    )
                    if fname:
                        return FileReference(name=fname, is_exact_name=True, is_pronoun=False)
            return None

        return None

    def _resolve_folder_pronoun(
        self, pronoun: str, role: str, ctx: ReferenceContext
    ) -> Optional[FolderReference]:
        """Resolve a folder pronoun reference."""
        if ctx.last_folder_name:
            return FolderReference(
                name=ctx.last_folder_name,
                role=role,
                is_pronoun=False
            )
        return None

    def has_unresolved_pronouns(self, entities: ExtractedEntities) -> bool:
        """Return True if any pronoun reference could not be resolved."""
        for ref in entities.file_references:
            if ref.is_pronoun:
                return True
        for ref in entities.folder_references:
            if ref.is_pronoun:
                return True
        return False


# Global singleton
_reference_resolver: Optional[ReferenceResolver] = None


def get_reference_resolver() -> ReferenceResolver:
    global _reference_resolver
    if _reference_resolver is None:
        _reference_resolver = ReferenceResolver()
    return _reference_resolver
