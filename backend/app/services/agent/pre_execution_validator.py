"""
Pre-Execution Validator — Pipeline Stage 6
Validates each planned step before any execution occurs.

DESIGN:
  - Validates required parameters, operation support, and safety constraints
  - Never silent-fails — always returns specific error with suggestion
  - Blocks DELETE operations entirely (moved to trash is OK, permanent delete is not)
  - Does not make any API calls — pure static validation of the plan structure
"""
import logging
from typing import Optional, Set

from app.services.agent.pipeline_models import (
    ExecutionPlan, PlannedStep, ValidationResult
)

logger = logging.getLogger(__name__)

# Tools that require a file_id argument
_REQUIRES_FILE_ID: Set[str] = {
    "open_file", "download_file", "rename_file", "move_file", "duplicate_file",
    "restore_file", "toggle_favorite", "add_tag", "remove_tag", "share_file",
    "remove_share", "get_file_info", "get_version_history", "extract_text",
    "extract_entities", "extract_keywords", "detect_language", "get_text_stats",
    "compress_file", "compress_pdf", "compress_image", "extract_zip_archive",
    "convert_docx_to_pdf", "convert_pdf_to_images", "extract_pdf_text",
    "extract_docx_text", "split_pdf_range", "split_pdf_pages",
    "password_protect_pdf", "remove_pdf_password", "protect_document",
    "unprotect_document", "add_pdf_watermark", "rotate_pdf_pages",
    "remove_pdf_pages", "reorder_pdf_pages", "duplicate_pdf_pages",
    "run_power_tool",
}

# Tools that are completely blocked
_BLOCKED_TOOLS: Set[str] = {
    "delete_file",             # Move to trash via UI only
    "permanent_delete_file",   # Requires OTP
    "delete_account",
    "change_password",
    "manage_sessions",
    "unlink_drive",
}

# Tools that require folder_name argument
_REQUIRES_FOLDER_NAME: Set[str] = {
    "create_folder", "rename_folder", "move_folder",
}

# Valid tool names (must exist in tool_registry)
_KNOWN_TOOLS: Set[str] = {
    "search_files", "open_file", "download_file", "rename_file", "move_file",
    "duplicate_file", "delete_file", "restore_file", "toggle_favorite", "add_tag", "remove_tag",
    "share_file", "remove_share", "get_file_info", "run_power_tool",
    "create_folder", "rename_folder", "move_folder", "delete_folder",
    "set_folder_color", "list_folders", "get_folder_tree",
    "find_similar", "find_duplicates", "list_files", "list_recent_files",
    "filter_files", "get_analytics", "get_storage_info", "get_activity_log",
    "get_version_history", "extract_text", "extract_entities", "extract_keywords",
    "detect_language", "get_text_stats", "update_preferences", "get_preferences",
    "batch_move", "batch_tag",
    "extract_zip_archive", "bundle_files", "compress_file",
    "extract_pdf_text", "convert_pdf_to_images", "merge_multiple_pdfs",
    "split_pdf_range", "split_pdf_pages", "compress_pdf", "compress_image",
    "rotate_pdf_pages", "remove_pdf_pages", "reorder_pdf_pages",
    "duplicate_pdf_pages", "password_protect_pdf", "remove_pdf_password",
    "protect_document", "unprotect_document", "add_pdf_watermark",
    "extract_docx_text", "convert_docx_to_pdf", "merge_word_documents",
    "replace_docx_text", "encrypt_docx", "decrypt_docx", "add_docx_watermark",
    "split_docx", "convert_docx_to_txt",
}


class PreExecutionValidator:
    """
    Validates an execution plan before any tool calls are made.
    Returns ValidationResult with specific error and suggestion on failure.
    """

    def validate(self, plan: ExecutionPlan, user_id: str) -> ValidationResult:
        """
        Validate a complete execution plan.
        
        Args:
            plan: The plan to validate
            user_id: User ID (for future permission checks)
            
        Returns:
            ValidationResult with valid=True or specific error
        """
        if not plan.steps:
            return ValidationResult(
                valid=False,
                reason="No steps in execution plan. Please clarify what you'd like to do.",
                suggestion="Try rephrasing your request, for example: 'rename report.pdf to Final Report'"
            )

        # Validate each step
        step_ids = {s.step_id for s in plan.steps}
        for step in plan.steps:
            result = self._validate_step(step, step_ids)
            if not result.valid:
                return result

        # Validate dependency graph (no cycles, all deps exist)
        cycle_result = self._validate_dependencies(plan)
        if not cycle_result.valid:
            return cycle_result

        logger.info("Plan validation passed: %d step(s)", len(plan.steps))
        return ValidationResult(valid=True)

    def _validate_step(self, step: PlannedStep, all_step_ids: Set[str]) -> ValidationResult:
        """Validate a single planned step."""

        # Check: tool must be known
        if step.tool not in _KNOWN_TOOLS:
            return ValidationResult(
                valid=False,
                reason=f"Operation '{step.tool}' is not supported.",
                suggestion="Please check the operation name or try a different approach.",
                blocking_step=step.step_id
            )

        # Check: tool must not be blocked
        if step.tool in _BLOCKED_TOOLS:
            friendly = step.tool.replace("_", " ").title()
            return ValidationResult(
                valid=False,
                reason=f"'{friendly}' is not available through the assistant for security reasons.",
                suggestion="Please use the application interface directly for this operation.",
                blocking_step=step.step_id
            )

        # Check: file_id required but missing (only flag if no dependency that will provide it)
        if step.tool in _REQUIRES_FILE_ID:
            file_id_arg = step.args.get("file_id")
            if not file_id_arg and not step.depends_on:
                return ValidationResult(
                    valid=False,
                    reason=f"No file specified for '{step.tool}' operation.",
                    suggestion="Please specify a filename, e.g. 'rename report.pdf to Final Report'",
                    blocking_step=step.step_id
                )

        # Check: rename requires new_name
        if step.tool == "rename_file":
            new_name = step.args.get("new_name")
            if not new_name or not str(new_name).strip():
                return ValidationResult(
                    valid=False,
                    reason="Rename operation requires a new name.",
                    suggestion="Please specify the new name, e.g. 'rename report.pdf to Final Report'",
                    blocking_step=step.step_id
                )

        # Check: move requires folder_name
        if step.tool == "move_file":
            folder_name = step.args.get("folder_name")
            if not folder_name and not any(k.startswith("$") for k in str(step.args.get("folder_name", ""))):
                return ValidationResult(
                    valid=False,
                    reason="Move operation requires a destination folder.",
                    suggestion="Please specify the destination, e.g. 'move report.pdf to Archive'",
                    blocking_step=step.step_id
                )

        # Check: folder operations require folder_name
        if step.tool in _REQUIRES_FOLDER_NAME:
            fn = step.args.get("folder_name") or step.args.get("name")
            if not fn:
                return ValidationResult(
                    valid=False,
                    reason=f"Folder operation '{step.tool}' requires a folder name.",
                    suggestion="Please specify the folder name.",
                    blocking_step=step.step_id
                )

        # Check: rename_folder requires new_name
        if step.tool == "rename_folder":
            if not step.args.get("new_name"):
                return ValidationResult(
                    valid=False,
                    reason="Folder rename requires a new name.",
                    suggestion="Please specify the new name, e.g. 'rename folder Projects to My Projects'",
                    blocking_step=step.step_id
                )

        # Check: add_tag / remove_tag require tag
        if step.tool in ("add_tag", "remove_tag"):
            if not step.args.get("tag"):
                return ValidationResult(
                    valid=False,
                    reason="Tag operation requires a tag name.",
                    suggestion="Please specify the tag, e.g. 'tag report.pdf as urgent'",
                    blocking_step=step.step_id
                )

        # Check: password_protect requires password
        if step.tool in ("password_protect_pdf", "protect_document", "encrypt_docx"):
            if not step.args.get("password"):
                return ValidationResult(
                    valid=False,
                    reason="Password protection requires a password.",
                    suggestion="Please provide the password, e.g. 'protect report.pdf with password MyPass123'",
                    blocking_step=step.step_id
                )

        # Check: dependencies reference valid step IDs
        for dep_id in step.depends_on:
            if dep_id and dep_id not in all_step_ids:
                return ValidationResult(
                    valid=False,
                    reason=f"Step '{step.step_id}' depends on unknown step '{dep_id}'.",
                    blocking_step=step.step_id
                )

        return ValidationResult(valid=True)

    def _validate_dependencies(self, plan: ExecutionPlan) -> ValidationResult:
        """Check that the dependency graph has no cycles."""
        # Build adjacency
        adj: dict = {s.step_id: list(s.depends_on) for s in plan.steps}
        visited: Set[str] = set()
        in_stack: Set[str] = set()

        def has_cycle(node: str) -> bool:
            visited.add(node)
            in_stack.add(node)
            for dep in adj.get(node, []):
                if dep not in visited:
                    if has_cycle(dep):
                        return True
                elif dep in in_stack:
                    return True
            in_stack.discard(node)
            return False

        for step_id in adj:
            if step_id not in visited:
                if has_cycle(step_id):
                    return ValidationResult(
                        valid=False,
                        reason="Circular dependency detected in execution plan.",
                        suggestion="Please rephrase your request to avoid circular operations."
                    )

        return ValidationResult(valid=True)


# Global singleton
_pre_execution_validator: Optional[PreExecutionValidator] = None


def get_pre_execution_validator() -> PreExecutionValidator:
    global _pre_execution_validator
    if _pre_execution_validator is None:
        _pre_execution_validator = PreExecutionValidator()
    return _pre_execution_validator
