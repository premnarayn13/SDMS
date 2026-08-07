"""
Execution Engine — Pipeline Stage 7
Executes the validated plan step by step with dependency resolution.

DESIGN:
  - Declarative dependency resolution: $step_N.file_id is resolved at runtime
  - Each step result is stored and available to dependent steps
  - Steps marked is_required=False continue chain even on failure
  - Updates AgentMemory after execution for future reference resolution
  - No regex, no pattern matching — pure execution
"""
import logging
import re
import inspect
from typing import Any, Dict, List, Optional

from app.services.agent.tool_registry import get_tool_registry
from app.services.agent.pipeline_models import (
    ExecutionPlan, ExecutionResult, PlannedStep, StepResult, StepStatus
)

logger = logging.getLogger(__name__)

# Pattern to match $stepN.field_name
_DEP_PATTERN = re.compile(r"\$(?P<step_id>step_\d+)\.(?P<field>\w+)")


class ExecutionEngine:
    """
    Executes an ordered execution plan, resolving dependencies between steps.
    """

    def __init__(self):
        self.tool_registry = get_tool_registry()

    async def execute_plan(
        self, plan: ExecutionPlan, user_id: str
    ) -> ExecutionResult:
        """
        Execute all steps in the plan in dependency order.
        
        Args:
            plan: Validated execution plan
            user_id: User performing the operations
            
        Returns:
            ExecutionResult with per-step results
        """
        step_results: Dict[str, StepResult] = {}
        ordered_steps = self._topological_sort(plan.steps)
        all_success = True
        failed_at = None

        for step in ordered_steps:
            # Resolve variable references from previous step outputs
            try:
                resolved_args = self._resolve_args(step.args, step_results)
            except ValueError as e:
                logger.warning("Arg resolution failed for step %s: %s", step.step_id, e)
                result = StepResult(
                    step_id=step.step_id,
                    tool=step.tool,
                    success=False,
                    error=str(e)
                )
                step_results[step.step_id] = result
                if step.is_required:
                    all_success = False
                    failed_at = step.step_id
                continue

            logger.info("Executing step %s: tool=%s args=%s", step.step_id, step.tool, list(resolved_args.keys()))

            # Get tool function
            tool_func = self.tool_registry.get_tool(step.tool)
            if not tool_func:
                result = StepResult(
                    step_id=step.step_id,
                    tool=step.tool,
                    success=False,
                    error=f"Tool '{step.tool}' not found in registry"
                )
                step_results[step.step_id] = result
                if step.is_required:
                    all_success = False
                    failed_at = step.step_id
                continue

            # Execute (handle both sync and async tools)
            try:
                if inspect.iscoroutinefunction(tool_func):
                    raw_result = await tool_func(user_id=user_id, **resolved_args)
                else:
                    raw_result = tool_func(user_id=user_id, **resolved_args)
                result = StepResult(
                    step_id=step.step_id,
                    tool=step.tool,
                    success=True,
                    data=raw_result if isinstance(raw_result, dict) else {"result": raw_result}
                )
                logger.info("Step %s succeeded: %s", step.step_id, step.tool)
            except Exception as e:
                logger.error("Step %s failed: %s — %s", step.step_id, step.tool, e, exc_info=True)
                result = StepResult(
                    step_id=step.step_id,
                    tool=step.tool,
                    success=False,
                    error=self._friendly_error(str(e), step, resolved_args)
                )
                if step.is_required:
                    all_success = False
                    failed_at = step.step_id

            step_results[step.step_id] = result

            # If a required step fails, stop execution
            if not result.success and step.is_required:
                logger.warning("Required step %s failed — stopping execution", step.step_id)
                break

        step_list = list(step_results.values())
        return ExecutionResult(
            all_success=all_success,
            steps=step_list,
            failed_at=failed_at,
            partial=not all_success and len([s for s in step_list if s.success]) > 0
        )

    def _resolve_args(
        self,
        args: Dict[str, Any],
        step_results: Dict[str, StepResult]
    ) -> Dict[str, Any]:
        """
        Resolve $stepN.field_name variable references in step arguments.
        
        Example: {"file_id": "$step_1.file_id"} -> {"file_id": "abc123"}
        """
        resolved = {}
        for key, value in args.items():
            if isinstance(value, str) and value.startswith("$"):
                resolved[key] = self._resolve_reference(value, step_results)
            elif isinstance(value, list):
                # Handle lists of references (e.g. file_ids: ["$step_1.files"])
                resolved_list = []
                for item in value:
                    if isinstance(item, str) and item.startswith("$"):
                        result = self._resolve_reference(item, step_results)
                        if isinstance(result, list):
                            resolved_list.extend(result)
                        else:
                            resolved_list.append(result)
                    else:
                        resolved_list.append(item)
                resolved[key] = resolved_list
            else:
                resolved[key] = value
        return resolved

    def _resolve_reference(self, ref: str, step_results: Dict[str, StepResult]) -> Any:
        """
        Resolve a single $stepN.field reference.
        
        Handles:
        - $step_1.file_id -> first file_id from step 1 data
        - $step_1.files -> list of files from step 1 data
        - $step_1.folder_id -> folder_id from step 1 data
        """
        match = _DEP_PATTERN.match(ref)
        if not match:
            return ref  # Not a reference, return as-is

        step_id = match.group("step_id")
        field = match.group("field")

        if step_id not in step_results:
            raise ValueError(f"Dependency step '{step_id}' has not been executed yet")

        step_result = step_results[step_id]
        if not step_result.success:
            raise ValueError(f"Dependency step '{step_id}' failed — cannot resolve '{ref}'")

        data = step_result.data or {}

        # Resolve common fields
        if field == "file_id":
            value = (
                data.get("file_id")
                or data.get("id")
                or data.get("first_file_id")
            )
            if not value and data.get("files"):
                files = data["files"]
                if isinstance(files, list) and files:
                    first = files[0]
                    value = first.get("id") if isinstance(first, dict) else str(first)
            if not value:
                raise ValueError(f"Could not extract file_id from step '{step_id}' result")
            return str(value)

        elif field == "files":
            files = data.get("files") or data.get("results") or []
            if isinstance(files, list):
                # Return list of file IDs
                ids = []
                for f in files:
                    if isinstance(f, dict):
                        fid = f.get("id") or f.get("file_id")
                        if fid:
                            ids.append(str(fid))
                    elif isinstance(f, str):
                        ids.append(f)
                return ids
            return []

        elif field == "folder_id":
            value = data.get("folder_id") or data.get("id")
            if not value:
                raise ValueError(f"Could not extract folder_id from step '{step_id}' result")
            return str(value)

        elif field == "name" or field == "file_name":
            return (
                data.get("file_name")
                or data.get("original_filename")
                or data.get("name")
                or data.get("new_name")
                or ""
            )

        else:
            # Generic field lookup
            value = data.get(field)
            if value is None:
                raise ValueError(f"Field '{field}' not found in step '{step_id}' result")
            return value

    def _topological_sort(self, steps: List[PlannedStep]) -> List[PlannedStep]:
        """Sort steps by dependencies (topological order)."""
        step_map = {s.step_id: s for s in steps}
        visited = set()
        order = []

        def visit(step_id: str):
            if step_id in visited:
                return
            visited.add(step_id)
            step = step_map.get(step_id)
            if step:
                for dep in step.depends_on:
                    if dep:
                        visit(dep)
                order.append(step)

        for step in steps:
            visit(step.step_id)

        return order

    def _friendly_error(
        self, raw_error: str, step: PlannedStep, args: Dict[str, Any]
    ) -> str:
        """Convert raw exception messages to user-friendly errors."""
        err_lower = raw_error.lower()

        if "not found" in err_lower or "does not exist" in err_lower:
            target = args.get("file_id") or args.get("folder_name") or "the file"
            return f"'{target}' was not found. Please check the name and try again."

        if "already exists" in err_lower:
            new_name = args.get("new_name") or args.get("folder_name") or "that name"
            return f"A file or folder named '{new_name}' already exists. Please choose a different name."

        if "permission" in err_lower or "unauthorized" in err_lower or "forbidden" in err_lower:
            return "You don't have permission to perform this operation."

        if "storage" in err_lower and "limit" in err_lower:
            return "Storage limit reached. Please free up space before continuing."

        if "timeout" in err_lower:
            return "The operation timed out. Please try again."

        if "rate" in err_lower and "limit" in err_lower:
            return "Too many requests. Please wait a moment and try again."

        # Fallback
        return f"Operation failed: {raw_error[:200]}"


# Global singleton
_execution_engine: Optional[ExecutionEngine] = None


def get_execution_engine() -> ExecutionEngine:
    global _execution_engine
    if _execution_engine is None:
        _execution_engine = ExecutionEngine()
    return _execution_engine
