"""
Execution Planner — Pipeline Stage 5
Converts classified intent + extracted entities into an ordered execution plan.

DESIGN:
  - LLM-driven planning from structured inputs
  - Declares step dependencies explicitly (no implicit chaining)
  - Variable substitution: $stepN.file_id resolved at runtime
  - No regex in planning logic
  - Handles single ops, multi-step chains, and batch operations
"""
import json
import logging
import re
from typing import Any, Dict, List, Optional

from app.services.agent.llm_client import get_llm_client
from app.services.agent.pipeline_models import (
    ClassifiedIntent, ExtractedEntities, ExecutionPlan, PlannedStep
)
from app.services.agent.prompt_templates import EXECUTION_PLANNING_PROMPT

logger = logging.getLogger(__name__)

# Mapping from operation name to default tool
_OP_TO_TOOL: Dict[str, str] = {
    "search": "search_files",
    "open": "open_file",
    "download": "download_file",
    "rename": "rename_file",
    "move": "move_file",
    "copy": "duplicate_file",
    "duplicate": "duplicate_file",
    "restore": "restore_file",
    "favorite": "toggle_favorite",
    "unfavorite": "toggle_favorite",
    "tag": "add_tag",
    "untag": "remove_tag",
    "share": "share_file",
    "unshare": "remove_share",
    "compress": "compress_file",
    "extract": "extract_zip_archive",
    "convert": "convert_docx_to_pdf",
    "merge": "merge_multiple_pdfs",
    "split": "split_pdf_range",
    "encrypt": "protect_document",
    "decrypt": "unprotect_document",
    "get_info": "get_file_info",
    "get_stats": "get_text_stats",
    "get_analytics": "get_analytics",
    "get_storage": "get_storage_info",
    "get_activity": "get_activity_log",
    "get_versions": "get_version_history",
    "extract_text": "extract_text",
    "word_count": "get_text_stats",
    "find_duplicates": "find_duplicates",
    "find_similar": "find_similar",
    "list": "list_files",
    "filter": "filter_files",
    "recent": "list_recent_files",
    "bundle": "bundle_files",
    "create_folder": "create_folder",
    "rename_folder": "rename_folder",
    "move_folder": "move_folder",
    "list_folders": "list_folders",
    "get_folder_tree": "get_folder_tree",
    "batch_move": "batch_move",
    "batch_tag": "batch_tag",
    "batch_rename": "batch_move",  # approximated via batch_move
}


class ExecutionPlanner:
    """
    Converts intent + entities into a fully-specified execution plan.
    Uses LLM for complex multi-step reasoning, with a fast-path for simple ops.
    """

    def __init__(self):
        self.llm = get_llm_client()

    # --------------------------------------------------
    # Public API
    # --------------------------------------------------

    async def plan(
        self,
        intent: ClassifiedIntent,
        entities: ExtractedEntities
    ) -> ExecutionPlan:
        """
        Produce an ordered execution plan.
        
        Args:
            intent: Classification result
            entities: Extracted entities
            
        Returns:
            ExecutionPlan with ordered steps
        """
        # Try fast-path for simple single-operation cases
        simple_plan = self._try_simple_plan(intent, entities)
        if simple_plan:
            logger.info("Using simple (non-LLM) plan: %d step(s)", len(simple_plan.steps))
            return simple_plan

        # Use LLM for complex multi-step or ambiguous cases
        return await self._llm_plan(intent, entities)

    # --------------------------------------------------
    # Fast-path planner (no LLM needed)
    # --------------------------------------------------

    def _try_simple_plan(
        self, intent: ClassifiedIntent, entities: ExtractedEntities
    ) -> Optional[ExecutionPlan]:
        """
        Build a plan without LLM for clear, single-operation requests.
        Returns None if the request is complex enough to need LLM planning.
        """
        ops = entities.operations or intent.operations or []
        if not ops:
            return None

        # Batch operations — always use LLM
        if entities.batch_mode:
            return None

        # Multiple distinct operations — use LLM
        unique_ops = list(dict.fromkeys(ops))  # deduplicate preserving order
        if len(unique_ops) > 2:
            return None

        # Multi-file — use LLM
        if len(entities.file_references) > 1:
            return None

        primary_op = unique_ops[0]
        steps: List[PlannedStep] = []

        file_refs = entities.file_references
        file_name = file_refs[0].name if file_refs else None
        has_exact_file = file_refs and (
            file_refs[0].is_exact_name
            or (file_name and ("." in file_name or len(file_name.strip().split()) == 1))
        )

        # Determine file_id arg value
        if has_exact_file and file_name:
            # Exact filename — backend resolves by name directly
            file_id_arg = file_name
            needs_search = False
        elif file_name and file_name != "$last_search_results":
            # Descriptive name — need to search first
            needs_search = True
            file_id_arg = "$step_1.file_id"
        elif file_name == "$last_search_results":
            needs_search = False
            file_id_arg = None  # batch from search results
        else:
            needs_search = False
            file_id_arg = None

        step_num = 1

        # Add search step if needed
        if needs_search and file_name:
            steps.append(PlannedStep(
                step_id=f"step_{step_num}",
                tool="search_files",
                args={"query": file_name, "limit": 5},
                depends_on=[],
                produces="file_id",
                is_required=True,
                description=f"Search for '{file_name}'"
            ))
            step_num += 1

        search_step_id = "step_1" if needs_search else None

        # Build the primary operation step
        tool = _OP_TO_TOOL.get(primary_op)
        if not tool:
            return None  # Unknown op — delegate to LLM

        args: Dict[str, Any] = {}
        depends_on = [search_step_id] if search_step_id else []
        effective_file_id = f"${search_step_id}.file_id" if search_step_id else file_id_arg

        if primary_op == "rename":
            if not entities.new_name:
                return None  # Need LLM to ask for clarification
            if effective_file_id:
                args["file_id"] = effective_file_id
            args["new_name"] = entities.new_name

        elif primary_op in ("move", "move_file"):
            dest_folders = [f for f in entities.folder_references if f.role in ("destination", "target")]
            if not dest_folders:
                return None
            if effective_file_id:
                args["file_id"] = effective_file_id
            args["folder_name"] = dest_folders[0].name

        elif primary_op in ("favorite", "unfavorite"):
            if effective_file_id:
                args["file_id"] = effective_file_id
            args["desired_state"] = primary_op == "favorite"

        elif primary_op == "tag":
            if not entities.tags:
                return None
            if effective_file_id:
                args["file_id"] = effective_file_id
            args["tag"] = entities.tags[0]

        elif primary_op == "untag":
            if not entities.tags:
                return None
            if effective_file_id:
                args["file_id"] = effective_file_id
            args["tag"] = entities.tags[0]
            tool = "remove_tag"

        elif primary_op in ("open", "download"):
            if effective_file_id:
                args["file_id"] = effective_file_id

        elif primary_op in ("search",):
            query = file_name or (entities.batch_filter.name_pattern if entities.batch_filter else "")
            if not query:
                return None
            return ExecutionPlan(
                steps=[PlannedStep(
                    step_id="step_1",
                    tool="search_files",
                    args={"query": query, "limit": 10},
                    depends_on=[],
                    produces="files",
                    is_required=True,
                    description=f"Search for '{query}'"
                )],
                summary=f"Search for '{query}'",
                is_batch=False
            )

        elif primary_op == "get_info":
            if effective_file_id:
                args["file_id"] = effective_file_id

        elif primary_op in ("get_stats", "word_count"):
            if effective_file_id:
                args["file_id"] = effective_file_id
            tool = "get_text_stats"

        elif primary_op == "get_analytics":
            return ExecutionPlan(
                steps=[PlannedStep(
                    step_id="step_1",
                    tool="get_analytics",
                    args={},
                    depends_on=[],
                    is_required=True,
                    description="Get analytics"
                )],
                summary="Get analytics",
                is_batch=False
            )

        elif primary_op == "get_storage":
            return ExecutionPlan(
                steps=[PlannedStep(
                    step_id="step_1",
                    tool="get_storage_info",
                    args={},
                    depends_on=[],
                    is_required=True,
                    description="Get storage information"
                )],
                summary="Get storage info",
                is_batch=False
            )

        elif primary_op == "recent":
            return ExecutionPlan(
                steps=[PlannedStep(
                    step_id="step_1",
                    tool="list_recent_files",
                    args={"limit": 20},
                    depends_on=[],
                    is_required=True,
                    description="List recent files"
                )],
                summary="List recent files",
                is_batch=False
            )

        elif primary_op == "list":
            return ExecutionPlan(
                steps=[PlannedStep(
                    step_id="step_1",
                    tool="list_files",
                    args={"limit": 50},
                    depends_on=[],
                    is_required=True,
                    description="List all files"
                )],
                summary="List files",
                is_batch=False
            )

        elif primary_op == "list_folders":
            return ExecutionPlan(
                steps=[PlannedStep(
                    step_id="step_1",
                    tool="list_folders",
                    args={},
                    depends_on=[],
                    is_required=True,
                    description="List folders"
                )],
                summary="List folders",
                is_batch=False
            )

        elif primary_op == "create_folder":
            folder_refs = entities.folder_references
            if not folder_refs:
                return None
            folder_args: Dict[str, Any] = {"folder_name": folder_refs[0].name}
            # Check for parent folder
            dest_refs = [f for f in folder_refs if f.role == "destination"]
            if dest_refs:
                folder_args["parent_folder"] = dest_refs[0].name
            return ExecutionPlan(
                steps=[PlannedStep(
                    step_id="step_1",
                    tool="create_folder",
                    args=folder_args,
                    depends_on=[],
                    produces="folder_id",
                    is_required=True,
                    description=f"Create folder '{folder_refs[0].name}'"
                )],
                summary=f"Create folder '{folder_refs[0].name}'",
                is_batch=False
            )

        elif primary_op == "rename_folder":
            folder_refs = entities.folder_references
            if not folder_refs or not entities.new_name:
                return None
            return ExecutionPlan(
                steps=[PlannedStep(
                    step_id="step_1",
                    tool="rename_folder",
                    args={"folder_name": folder_refs[0].name, "new_name": entities.new_name},
                    depends_on=[],
                    is_required=True,
                    description=f"Rename folder to '{entities.new_name}'"
                )],
                summary=f"Rename folder to '{entities.new_name}'",
                is_batch=False
            )

        elif primary_op == "move_folder":
            folder_refs = entities.folder_references
            if len(folder_refs) < 1:
                return None
            source = folder_refs[0]
            dest_refs = [f for f in folder_refs if f.role == "destination"]
            dest_name = dest_refs[0].name if dest_refs else None
            return ExecutionPlan(
                steps=[PlannedStep(
                    step_id="step_1",
                    tool="move_folder",
                    args={"folder_name": source.name, "parent_folder": dest_name},
                    depends_on=[],
                    is_required=True,
                    description=f"Move folder '{source.name}'"
                )],
                summary=f"Move folder '{source.name}'",
                is_batch=False
            )

        elif primary_op == "compress":
            if effective_file_id:
                args["file_id"] = effective_file_id
            if file_name and file_name.lower().endswith(".pdf"):
                tool = "compress_pdf"
            elif file_name and any(file_name.lower().endswith(ext) for ext in [".jpg", ".jpeg", ".png", ".webp"]):
                tool = "compress_image"

        elif primary_op == "convert":
            if effective_file_id:
                args["file_id"] = effective_file_id
            target = (entities.target_format or "pdf").lower()
            if file_name and (file_name.lower().endswith(".docx") or "docx" in (file_refs[0].extension or "")):
                tool = "convert_docx_to_pdf"
            elif target in ("png", "jpg", "image", "images"):
                tool = "convert_pdf_to_images"
            else:
                tool = "convert_docx_to_pdf"

        elif primary_op == "merge":
            # Multi-file merge — let LLM handle
            return None

        elif primary_op == "extract":
            if effective_file_id:
                args["file_id"] = effective_file_id
            tool = "extract_zip_archive"

        elif primary_op == "duplicate":
            if effective_file_id:
                args["file_id"] = effective_file_id

        elif primary_op == "restore":
            if effective_file_id:
                args["file_id"] = effective_file_id

        elif primary_op == "get_versions":
            if effective_file_id:
                args["file_id"] = effective_file_id
            tool = "get_version_history"

        elif primary_op == "share":
            if effective_file_id:
                args["file_id"] = effective_file_id
            if entities.email:
                args["email"] = entities.email

        else:
            # Unknown or complex — use LLM
            return None

        if not args and primary_op not in ("get_analytics", "get_storage", "recent", "list", "list_folders"):
            return None

        op_step = PlannedStep(
            step_id=f"step_{step_num}",
            tool=tool,
            args=args,
            depends_on=depends_on,
            is_required=True,
            description=f"{primary_op.replace('_', ' ').title()} operation"
        )
        steps.append(op_step)

        # Handle secondary operations (e.g. rename + favorite)
        if len(unique_ops) == 2:
            secondary_op = unique_ops[1]
            if secondary_op in ("favorite", "unfavorite") and effective_file_id:
                step_num += 1
                steps.append(PlannedStep(
                    step_id=f"step_{step_num}",
                    tool="toggle_favorite",
                    args={"file_id": effective_file_id, "desired_state": secondary_op == "favorite"},
                    depends_on=[search_step_id] if search_step_id else [],
                    is_required=False,
                    description="Toggle favorite"
                ))

        if not steps:
            return None

        return ExecutionPlan(
            steps=steps,
            summary=f"{', '.join(unique_ops)} operation",
            is_batch=entities.batch_mode
        )

    # --------------------------------------------------
    # LLM-based planner
    # --------------------------------------------------

    async def _llm_plan(
        self, intent: ClassifiedIntent, entities: ExtractedEntities
    ) -> ExecutionPlan:
        """Use LLM to build a plan for complex/multi-step requests."""
        # Build context for LLM
        context = {
            "operations": entities.operations or intent.operations or [],
            "files": [{"name": f.name, "exact": f.is_exact_name, "ext": f.extension} for f in entities.file_references],
            "folders": [{"name": f.name, "role": f.role} for f in entities.folder_references],
            "new_name": entities.new_name,
            "tags": entities.tags,
            "batch_mode": entities.batch_mode,
            "batch_filter": entities.batch_filter.model_dump() if entities.batch_filter else None,
            "target_format": entities.target_format,
            "email": entities.email,
            "password": entities.password,
            "page_range": entities.page_range,
            "bundle_name": entities.bundle_name,
        }

        prompt_user = json.dumps(context, indent=2)

        try:
            response = await self.llm.async_chat_completion(
                messages=[
                    {"role": "system", "content": EXECUTION_PLANNING_PROMPT},
                    {"role": "user", "content": prompt_user}
                ],
                tools=None,
                tool_choice="none",
                temperature=0.0,
                max_tokens=1200
            )

            content = response.get("content", "")
            parsed = self._extract_json(content)

            if not parsed:
                logger.warning("Execution planner: could not parse LLM JSON")
                return self._fallback_plan(intent, entities)

            steps = []
            for raw_step in parsed.get("steps", []):
                steps.append(PlannedStep(
                    step_id=raw_step.get("step_id", f"step_{len(steps)+1}"),
                    tool=raw_step.get("tool", "search_files"),
                    args=raw_step.get("args", {}),
                    depends_on=raw_step.get("depends_on", []),
                    produces=raw_step.get("produces"),
                    is_required=bool(raw_step.get("is_required", True)),
                    description=raw_step.get("description", "")
                ))

            if not steps:
                return self._fallback_plan(intent, entities)

            logger.info("LLM plan generated: %d step(s)", len(steps))
            return ExecutionPlan(
                steps=steps,
                summary=parsed.get("summary", "Execute operations"),
                is_batch=bool(parsed.get("is_batch", entities.batch_mode))
            )

        except Exception as e:
            logger.error("Execution planner LLM error: %s", e, exc_info=True)
            return self._fallback_plan(intent, entities)

    def _fallback_plan(self, intent: ClassifiedIntent, entities: ExtractedEntities) -> ExecutionPlan:
        """Robust fallback when LLM planning is unavailable or throws an error."""
        ops = entities.operations or intent.operations or []
        primary_op = ops[0] if ops else "search"
        tool = _OP_TO_TOOL.get(primary_op, "search_files")

        file_name = entities.file_references[0].name if entities.file_references else None
        folder_name = entities.folder_references[0].name if entities.folder_references else None

        args: Dict[str, Any] = {}
        if file_name:
            args["file_id"] = file_name
        if entities.new_name:
            args["new_name"] = entities.new_name
        if folder_name:
            args["folder_name"] = folder_name
        if entities.tags:
            args["tag"] = entities.tags[0]
        if primary_op in ("favorite", "unfavorite"):
            args["desired_state"] = (primary_op == "favorite")

        if primary_op == "create_folder":
            created_name = folder_name or file_name or "New Folder"
            return ExecutionPlan(
                steps=[PlannedStep(
                    step_id="step_1",
                    tool="create_folder",
                    args={"folder_name": created_name},
                    depends_on=[],
                    produces="folder_id",
                    is_required=True,
                    description=f"Create folder '{created_name}'"
                )],
                summary=f"Create folder '{created_name}'",
                is_batch=False
            )

        step = PlannedStep(
            step_id="step_1",
            tool=tool,
            args=args,
            depends_on=[],
            is_required=True,
            description=f"Execute {primary_op}"
        )
        return ExecutionPlan(steps=[step], summary=f"Execute {primary_op}", is_batch=False)

    def _extract_json(self, text: str) -> Optional[dict]:
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


# Global singleton
_execution_planner: Optional[ExecutionPlanner] = None


def get_execution_planner() -> ExecutionPlanner:
    global _execution_planner
    if _execution_planner is None:
        _execution_planner = ExecutionPlanner()
    return _execution_planner
