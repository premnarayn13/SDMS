"""
Intelligent Task Planner for Multi-Step Requests
Breaks down complex user requests into actionable steps and identifies
which can be done by AI and which require manual user action.
"""

import logging
import json
from typing import Dict, List, Any, Optional
from dataclasses import dataclass, asdict

from app.services.agent.llm_client import get_llm_client

logger = logging.getLogger(__name__)


@dataclass
class TaskStep:
    """Represents a single step in a multi-step task"""
    step_number: int
    description: str
    action_type: str  # "ai_capable", "manual_only", "ai_with_confirmation"
    required_tool: Optional[str] = None
    manual_reason: Optional[str] = None
    difficulty: str = "easy"  # easy, medium, hard
    
    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)


@dataclass
class TaskPlan:
    """Complete plan for a multi-step task"""
    original_request: str
    steps: List[TaskStep]
    ai_can_do_count: int
    requires_manual_count: int
    total_steps: int
    summary: str
    ask_confirmation: bool
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "original_request": self.original_request,
            "steps": [s.to_dict() for s in self.steps],
            "ai_can_do_count": self.ai_can_do_count,
            "requires_manual_count": self.requires_manual_count,
            "total_steps": self.total_steps,
            "summary": self.summary,
            "ask_confirmation": self.ask_confirmation,
        }


class TaskPlanner:
    """Plans multi-step tasks and identifies restrictions"""
    
    def __init__(self):
        self.llm_client = get_llm_client()
        
        # Task keywords that indicate multi-step operations
        self.multi_step_keywords = [
            "then", "after", "next", "also", "and", "convert to", "save as",
            "add", "put", "place", "move to", "combine with", "merge with",
            "before", "first", "finally", "with", "plus", "plus",
        ]
        
        # Manual operation keywords
        self.manual_keywords = {
            "signature": "requires manual signature",
            "sign": "requires digital signing",
            "form": "form filling",
            "manually": "requires manual action",
            "hand": "hand action",
            "review": "requires manual review",
            "approve": "requires approval",
            "verify": "requires verification",
            "key": "requires key management",
            "password": "password entry",
            "decrypt": "decryption with authentication",
        }
    
    def _contains_manual_operation(self, text: str) -> tuple[bool, str]:
        """Check if text contains manual operation keywords"""
        text_lower = text.lower()
        for keyword, reason in self.manual_keywords.items():
            if keyword in text_lower:
                return True, reason
        return False, ""
    
    def _is_multistep_request(self, request: str) -> bool:
        """Determine if request appears to be multi-step"""
        request_lower = request.lower()
        keyword_count = sum(1 for kw in self.multi_step_keywords if kw in request_lower)
        return keyword_count >= 1 or len(request) > 150  # Longer requests often multi-step
    
    async def create_plan(self, user_request: str) -> TaskPlan:
        """
        Create a detailed plan for a user request.
        
        Args:
            user_request: The user's natural language request
            
        Returns:
            TaskPlan object with steps and recommendations
        """
        try:
            # Check if this is a multi-step request
            is_multistep = self._is_multistep_request(user_request)
            
            if not is_multistep:
                # Single step - just return basic plan
                has_manual, reason = self._contains_manual_operation(user_request)
                step_type = "manual_only" if has_manual else "ai_capable"
                
                steps = [
                    TaskStep(
                        step_number=1,
                        description=user_request,
                        action_type=step_type,
                        manual_reason=reason if has_manual else None,
                    )
                ]
                
                return TaskPlan(
                    original_request=user_request,
                    steps=steps,
                    ai_can_do_count=0 if has_manual else 1,
                    requires_manual_count=1 if has_manual else 0,
                    total_steps=1,
                    summary=f"This is a single step: {user_request}",
                    ask_confirmation=False,
                )
            
            # Multi-step request - use LLM to break it down
            steps = await self._break_down_request(user_request)
            
            # Count AI-capable vs manual steps
            ai_count = sum(1 for s in steps if s.action_type in ["ai_capable", "ai_with_confirmation"])
            manual_count = sum(1 for s in steps if s.action_type == "manual_only")
            
            # Generate summary
            summary = self._generate_plan_summary(steps, ai_count, manual_count)
            
            plan = TaskPlan(
                original_request=user_request,
                steps=steps,
                ai_can_do_count=ai_count,
                requires_manual_count=manual_count,
                total_steps=len(steps),
                summary=summary,
                ask_confirmation=manual_count > 0,  # Ask for confirmation if any manual steps
            )
            
            return plan
            
        except Exception as e:
            logger.error(f"Error creating task plan: {e}")
            # Fallback to simple plan
            steps = [
                TaskStep(
                    step_number=1,
                    description=user_request,
                    action_type="ai_capable",
                )
            ]
            return TaskPlan(
                original_request=user_request,
                steps=steps,
                ai_can_do_count=1,
                requires_manual_count=0,
                total_steps=1,
                summary=user_request,
                ask_confirmation=False,
            )
    
    async def _break_down_request(self, user_request: str) -> List[TaskStep]:
        """
        Use LLM to break down a multi-step request into individual steps.
        """
        breakdown_prompt = f"""Analyze this user request and break it down into individual steps:

Request: "{user_request}"

For each step, identify:
1. What action needs to be done
2. Whether it can be done by an AI agent (signature, form filling, manual approval = NO)
3. Any manual operations required

Respond in JSON format:
{{
    "steps": [
        {{
            "number": 1,
            "description": "Action description",
            "type": "ai_capable" or "manual_only" or "ai_with_confirmation",
            "manual_reason": "reason if manual_only or ai_with_confirmation",
            "difficulty": "easy" or "medium" or "hard"
        }}
    ]
}}

Identify MANUAL operations that include:
- Adding signatures, digital signatures
- Form filling (especially financial or legal forms)
- Password entering/decryption
- Manual review or approval
- Any action requiring legal verification
- Any action modifying original document permanently
"""
        
        try:
            response = await self.llm_client.async_chat_completion(
                messages=[
                    {
                        "role": "system",
                        "content": "You are a task planning assistant. Break down multi-step requests accurately."
                    },
                    {
                        "role": "user",
                        "content": breakdown_prompt
                    }
                ],
                temperature=0.3,
                max_tokens=800,
            )
            
            content = response.get("content", "")
            
            # Extract JSON from response
            json_start = content.find("{")
            json_end = content.rfind("}") + 1
            
            if json_start >= 0 and json_end > json_start:
                json_str = content[json_start:json_end]
                parsed = json.loads(json_str)
                
                steps = []
                for step_data in parsed.get("steps", []):
                    step = TaskStep(
                        step_number=step_data.get("number", len(steps) + 1),
                        description=step_data.get("description", ""),
                        action_type=step_data.get("type", "ai_capable"),
                        manual_reason=step_data.get("manual_reason"),
                        difficulty=step_data.get("difficulty", "easy"),
                    )
                    steps.append(step)
                
                return steps if steps else self._simple_breakdown(user_request)
            
            return self._simple_breakdown(user_request)
            
        except Exception as e:
            logger.error(f"Error breaking down request with LLM: {e}")
            return self._simple_breakdown(user_request)
    
    def _simple_breakdown(self, request: str) -> List[TaskStep]:
        """Simple rule-based breakdown when LLM fails"""
        steps = []
        
        # Split by common multi-step keywords
        parts = request.split(" and ")
        if len(parts) == 1:
            parts = request.split(", then ")
        if len(parts) == 1:
            parts = request.split(" then ")
        if len(parts) == 1:
            # No clear splits, treat as single step
            parts = [request]
        
        for i, part in enumerate(parts):
            part = part.strip()
            has_manual, reason = self._contains_manual_operation(part)
            
            step = TaskStep(
                step_number=i + 1,
                description=part,
                action_type="manual_only" if has_manual else "ai_capable",
                manual_reason=reason if has_manual else None,
            )
            steps.append(step)
        
        return steps
    
    def _generate_plan_summary(self, steps: List[TaskStep], ai_count: int, manual_count: int) -> str:
        """Generate a human-readable summary of the plan"""
        if manual_count == 0:
            return f"I can handle all {len(steps)} steps for you. Let me proceed!"
        
        if ai_count == 0:
            return f"This task requires {manual_count} manual steps that you need to do yourself."
        
        ai_steps = ", ".join([f"step {s.step_number}" for s in steps if s.action_type in ["ai_capable", "ai_with_confirmation"]])
        manual_steps = ", ".join([f"step {s.step_number}" for s in steps if s.action_type == "manual_only"])
        
        return f"I can do {ai_steps}, but you'll need to handle {manual_steps} manually."


def get_task_planner() -> TaskPlanner:
    """Get singleton instance of task planner"""
    if not hasattr(get_task_planner, "_instance"):
        get_task_planner._instance = TaskPlanner()
    return get_task_planner._instance
