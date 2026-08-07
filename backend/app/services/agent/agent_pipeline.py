"""
Agent Pipeline — Core Orchestrator
Replaces the old orchestrator.py with a clean, modular 9-stage pipeline.

PIPELINE STAGES:
  1. Query Normalization
  2. Intent Classification (LLM)
  3. Entity Extraction (LLM)
  4. Reference Resolution (memory-only, no history)
  5. Execution Planning (LLM or fast-path)
  6. Pre-Execution Validation
  7. Execution (step-by-step with dependency resolution)
  8. Memory Update
  9. Response Generation (LLM or template)

DESIGN:
  - Every stage is independent and unit-testable
  - No keyword matching, no regex-based routing
  - No conversation history injected into operations
  - Memory is consulted ONLY for pronoun resolution
  - All operations are declarative (plan-first, then execute)
  - Full error recovery at every stage
"""
import logging
import re
from typing import Optional

from app.services.agent.intent_classifier import get_intent_classifier
from app.services.agent.entity_extractor import get_entity_extractor
from app.services.agent.reference_resolver import get_reference_resolver
from app.services.agent.execution_planner import get_execution_planner
from app.services.agent.pre_execution_validator import get_pre_execution_validator
from app.services.agent.execution_engine import get_execution_engine
from app.services.agent.response_generator import get_response_generator
from app.services.agent.agent_memory import get_agent_memory
from app.services.agent.pipeline_models import AgentResponse, IntentType

logger = logging.getLogger(__name__)


def _normalize_query(message: str) -> str:
    """
    Stage 1: Normalize the incoming query.
    - Strip leading/trailing whitespace
    - Collapse multiple spaces
    - No lowercasing (preserve filename case for entity extraction)
    """
    if not message:
        return ""
    normalized = re.sub(r"[ \t\r\n]+", " ", message.strip())
    return normalized


class AgentPipeline:
    """
    Production-grade, modular document operation agent pipeline.
    
    This is the main entry point that replaces orchestrator.py.
    All intelligence is delegated to focused, single-responsibility stages.
    """

    def __init__(self):
        self.intent_classifier = get_intent_classifier()
        self.entity_extractor = get_entity_extractor()
        self.reference_resolver = get_reference_resolver()
        self.execution_planner = get_execution_planner()
        self.validator = get_pre_execution_validator()
        self.execution_engine = get_execution_engine()
        self.response_generator = get_response_generator()
        self.memory = get_agent_memory()
        logger.info("AgentPipeline initialized — all 9 stages ready")

    async def process(self, user_id: str, message: str) -> AgentResponse:
        """
        Process a user message through the complete agent pipeline.
        
        Args:
            user_id: Authenticated user ID
            message: Raw user message
            
        Returns:
            AgentResponse with message, actions, and status
        """
        try:
            # ─── Stage 1: Normalize ─────────────────────────────────────────
            normalized = _normalize_query(message)
            if not normalized:
                return self.response_generator.error_response(
                    "I didn't receive any message. Please try again."
                )
            logger.info("Pipeline start | user=%s | message=%s", user_id, normalized[:100])

            # ─── Stage 2: Intent Classification ─────────────────────────────
            intent = await self.intent_classifier.classify(normalized)
            logger.info("Intent: %s | confidence=%.2f | needs_history=%s",
                        intent.intent, intent.confidence, intent.needs_history)

            # ─── Stage 3: Handle pure conversation immediately ───────────────
            if intent.intent == IntentType.CONVERSATION:
                return await self.response_generator.chat_response(normalized)

            # ─── Stage 4: Handle ambiguous — ask for clarification ───────────
            if intent.intent == IntentType.AMBIGUOUS:
                question = (
                    intent.clarification_question
                    or "I'm not sure what you'd like to do. Could you clarify?"
                )
                return self.response_generator.clarification_response(question)

            # ─── Stage 5: Entity Extraction ──────────────────────────────────
            entities = await self.entity_extractor.extract(normalized, intent)
            logger.info("Entities: files=%d folders=%d ops=%s batch=%s",
                        len(entities.file_references),
                        len(entities.folder_references),
                        entities.operations,
                        entities.batch_mode)

            # ─── Stage 6: Reference Resolution (only if pronouns detected) ───
            if intent.needs_history:
                ctx = self.memory.get(user_id)
                entities = self.reference_resolver.resolve(entities, ctx)

                # If pronouns remain unresolved, ask for clarification
                if self.reference_resolver.has_unresolved_pronouns(entities):
                    return self.response_generator.clarification_response(
                        "Which file did you mean? Please specify the filename so I can help you."
                    )

            # ─── Stage 7: Execution Planning ─────────────────────────────────
            plan = await self.execution_planner.plan(intent, entities)
            logger.info("Plan: %d step(s) | batch=%s | summary=%s",
                        len(plan.steps), plan.is_batch, plan.summary[:80])

            if not plan.steps:
                return self.response_generator.error_response(
                    "I wasn't able to determine what action to take.",
                    suggestion="Please be more specific, e.g. 'rename report.pdf to Final Report'"
                )

            # ─── Stage 8: Pre-Execution Validation ───────────────────────────
            validation = self.validator.validate(plan, user_id)
            if not validation.valid:
                logger.warning("Plan validation failed: %s", validation.reason)
                return self.response_generator.error_response(
                    validation.reason or "The requested operation cannot be performed.",
                    suggestion=validation.suggestion
                )

            # ─── Stage 9: Execute ─────────────────────────────────────────────
            execution_result = await self.execution_engine.execute_plan(plan, user_id)
            logger.info(
                "Execution done: success=%s partial=%s steps=%d",
                execution_result.all_success,
                execution_result.partial,
                len(execution_result.steps)
            )

            # ─── Stage 10: Update Memory ─────────────────────────────────────
            self.memory.update_from_execution(
                user_id, execution_result,
                operation=entities.operations[0] if entities.operations else "unknown"
            )

            # ─── Stage 11: Generate Response ─────────────────────────────────
            return await self.response_generator.generate(normalized, execution_result)

        except Exception as e:
            logger.error("AgentPipeline unhandled error: %s", e, exc_info=True)
            return AgentResponse(
                message=(
                    "I encountered an unexpected error while processing your request. "
                    "Please try again or rephrase your request."
                ),
                actions_executed=[],
                status="error",
                error=str(e)
            )

    async def clear_context(self, user_id: str) -> None:
        """Clear agent memory for a user (e.g., when user logs out)."""
        self.memory.clear(user_id)
        logger.info("Cleared agent context for user %s", user_id)

    async def get_context_summary(self, user_id: str) -> dict:
        """Return a summary of current memory state for the user."""
        ctx = self.memory.get(user_id)
        return {
            "last_file_id": ctx.last_file_id,
            "last_file_name": ctx.last_file_name,
            "last_folder_id": ctx.last_folder_id,
            "last_folder_name": ctx.last_folder_name,
            "last_operation": ctx.last_operation,
            "search_results_count": len(ctx.last_search_results)
        }


# ─── Global singleton ─────────────────────────────────────────────────────────

_pipeline: Optional[AgentPipeline] = None


def get_agent_pipeline() -> AgentPipeline:
    """Get or create the global agent pipeline instance."""
    global _pipeline
    if _pipeline is None:
        _pipeline = AgentPipeline()
    return _pipeline


# ─── Backward compatibility shim ──────────────────────────────────────────────
# The old code used get_orchestrator(). This alias makes migration painless.
get_orchestrator = get_agent_pipeline
