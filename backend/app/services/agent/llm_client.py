"""
LLM Client for Docky Autonomous Agent
Handles communication with Groq API for natural language understanding
"""
import json
import logging
from typing import Dict, List, Any, Optional
from groq import Groq, AsyncGroq
from app.config import settings

logger = logging.getLogger(__name__)


class LLMClient:
    """
    Client for interacting with Groq LLM API.
    Handles function calling for tool execution.
    """
    
    def __init__(self):
        """Initialize Groq client"""
        if not settings.GROQ_API_KEY:
            raise ValueError("GROQ_API_KEY not found in environment variables")
        
        self.client = Groq(api_key=settings.GROQ_API_KEY)
        self.async_client = AsyncGroq(api_key=settings.GROQ_API_KEY)
        self.model = settings.AGENT_LLM_MODEL
        self.fallback_models = self._build_fallback_models()
        self.max_retries = settings.AGENT_MAX_RETRIES
        self.timeout = settings.AGENT_TIMEOUT_SECONDS
        
        logger.info(
            "LLM Client initialized with model: %s | fallbacks: %s",
            self.model,
            self.fallback_models,
        )

    def _build_fallback_models(self) -> List[str]:
        raw = getattr(settings, "AGENT_LLM_FALLBACK_MODELS", None)
        if isinstance(raw, str) and raw.strip():
            parsed = [model.strip() for model in raw.split(",") if model.strip()]
        else:
            parsed = [
                "llama-3.1-8b-instant",
                "llama3-8b-8192",
            ]

        return [model for model in parsed if model and model != settings.AGENT_LLM_MODEL]

    def _is_rate_limit_error(self, error: Exception) -> bool:
        text = str(error).lower()
        return (
            "rate_limit" in text
            or "rate limit" in text
            or "rate_limit_exceeded" in text
            or "status code: 429" in text
            or "429" in text and "tokens per day" in text
        )

    def _extract_response(self, response: Any) -> Dict[str, Any]:
        message = response.choices[0].message

        result = {
            "content": message.content,
            "role": message.role,
            "finish_reason": response.choices[0].finish_reason,
        }

        if hasattr(message, "tool_calls") and message.tool_calls:
            result["tool_calls"] = [
                {
                    "id": tc.id,
                    "type": tc.type,
                    "function": {
                        "name": tc.function.name,
                        "arguments": json.loads(tc.function.arguments),
                    },
                }
                for tc in message.tool_calls
            ]

        return result

    def _build_request_kwargs(
        self,
        model: str,
        messages: List[Dict[str, str]],
        tools: Optional[List[Dict[str, Any]]],
        tool_choice: str,
        temperature: float,
        max_tokens: int,
    ) -> Dict[str, Any]:
        kwargs = {
            "model": model,
            "messages": messages,
            "temperature": temperature,
            "max_tokens": max_tokens,
            "timeout": self.timeout,
        }

        if tools:
            kwargs["tools"] = tools
            kwargs["tool_choice"] = tool_choice

        return kwargs
    
    def chat_completion(
        self,
        messages: List[Dict[str, str]],
        tools: Optional[List[Dict[str, Any]]] = None,
        tool_choice: str = "auto",
        temperature: float = 0.1,
        max_tokens: int = 2000
    ) -> Dict[str, Any]:
        """
        Send chat completion request to Groq.
        
        Args:
            messages: List of message dicts with 'role' and 'content'
            tools: Optional list of tool definitions for function calling
            tool_choice: "auto", "none", or specific tool name
            temperature: Sampling temperature (0-2)
            max_tokens: Maximum tokens in response
            
        Returns:
            Response dict with message and optional tool calls
        """
        models_to_try = [self.model, *self.fallback_models]
        last_error: Optional[Exception] = None

        for idx, model in enumerate(models_to_try):
            try:
                kwargs = self._build_request_kwargs(
                    model=model,
                    messages=messages,
                    tools=tools,
                    tool_choice=tool_choice,
                    temperature=temperature,
                    max_tokens=max_tokens,
                )
                response = self.client.chat.completions.create(**kwargs)
                result = self._extract_response(response)

                logger.info(
                    "LLM response: model=%s finish_reason=%s tool_calls=%s",
                    model,
                    result["finish_reason"],
                    len(result.get("tool_calls", [])),
                )
                return result
            except Exception as e:
                last_error = e
                if idx < len(models_to_try) - 1 and self._is_rate_limit_error(e):
                    logger.warning(
                        "Primary model rate-limited (%s). Retrying with fallback model: %s",
                        model,
                        models_to_try[idx + 1],
                    )
                    continue
                logger.error("LLM API error (model=%s): %s", model, str(e))
                raise

        if last_error:
            raise last_error
        raise RuntimeError("LLM request failed without a concrete error")
    
    async def async_chat_completion(
        self,
        messages: List[Dict[str, str]],
        tools: Optional[List[Dict[str, Any]]] = None,
        tool_choice: str = "auto",
        temperature: float = 0.1,
        max_tokens: int = 2000
    ) -> Dict[str, Any]:
        """Async version of chat_completion"""
        models_to_try = [self.model, *self.fallback_models]
        last_error: Optional[Exception] = None

        for idx, model in enumerate(models_to_try):
            try:
                kwargs = self._build_request_kwargs(
                    model=model,
                    messages=messages,
                    tools=tools,
                    tool_choice=tool_choice,
                    temperature=temperature,
                    max_tokens=max_tokens,
                )
                response = await self.async_client.chat.completions.create(**kwargs)
                result = self._extract_response(response)
                return result
            except Exception as e:
                last_error = e
                if idx < len(models_to_try) - 1 and self._is_rate_limit_error(e):
                    logger.warning(
                        "Async model rate-limited (%s). Retrying with fallback model: %s",
                        model,
                        models_to_try[idx + 1],
                    )
                    continue
                logger.error("Async LLM API error (model=%s): %s", model, str(e))
                raise

        if last_error:
            raise last_error
        raise RuntimeError("Async LLM request failed without a concrete error")
    
    def validate_function_call(self, function_call: Dict[str, Any]) -> bool:
        """
        Validate that a function call has required fields.
        
        Args:
            function_call: Dict with 'name' and 'arguments'
            
        Returns:
            True if valid, False otherwise
        """
        if not isinstance(function_call, dict):
            return False
        
        if "name" not in function_call or "arguments" not in function_call:
            return False
        
        if not isinstance(function_call["arguments"], dict):
            return False
        
        return True


# Global client instance
_llm_client: Optional[LLMClient] = None


def get_llm_client() -> LLMClient:
    """Get or create global LLM client instance"""
    global _llm_client
    if _llm_client is None:
        _llm_client = LLMClient()
    return _llm_client
