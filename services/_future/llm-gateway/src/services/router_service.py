"""Router service — determines which LLM provider to use and manages fallback chains."""

import os
from typing import Optional
import structlog

from src.adapters.openai_adapter import openai_complete
from src.adapters.anthropic_adapter import anthropic_complete
from src.adapters.google_adapter import google_complete
from src.services.circuit_breaker import CircuitBreaker

logger = structlog.get_logger()

DEFAULT_MODEL = os.getenv("DEFAULT_MODEL", "gpt-4o-mini")

# Circuit breakers per provider
circuit_breakers = {
    "openai": CircuitBreaker("openai"),
    "anthropic": CircuitBreaker("anthropic"),
    "google": CircuitBreaker("google"),
}

# Model → provider mapping
MODEL_PROVIDERS = {
    "gpt-4o-mini": "openai",
    "gpt-4o": "openai",
    "gpt-4-turbo": "openai",
    "claude-3-5-sonnet-20241022": "anthropic",
    "claude-3-haiku-20240307": "anthropic",
    "gemini-2.0-flash": "google",
    "gemini-2.0-pro": "google",
}

# Fallback chains
FALLBACK_CHAINS = {
    "openai": ["anthropic", "google"],
    "anthropic": ["openai", "google"],
    "google": ["openai", "anthropic"],
}

# Default models per provider (for fallback)
PROVIDER_DEFAULT_MODELS = {
    "openai": "gpt-4o-mini",
    "anthropic": "claude-3-5-sonnet-20241022",
    "google": "gemini-2.0-flash",
}

# Provider → completion function
PROVIDER_FUNCTIONS = {
    "openai": openai_complete,
    "anthropic": anthropic_complete,
    "google": google_complete,
}


async def route_completion(
    redis,
    messages: list[dict],
    model: Optional[str] = None,
    max_tokens: int = 1024,
    temperature: float = 0.3,
    tenant_id: Optional[str] = None,
) -> dict:
    """Routes the completion request to the appropriate provider with fallback."""
    target_model = model or DEFAULT_MODEL
    primary_provider = MODEL_PROVIDERS.get(target_model, "openai")

    # Build provider chain: primary + fallbacks
    provider_chain = [primary_provider] + FALLBACK_CHAINS.get(primary_provider, [])

    last_error = None

    for provider in provider_chain:
        cb = circuit_breakers[provider]

        if not cb.is_available():
            logger.warning("circuit_breaker_open", provider=provider)
            continue

        current_model = target_model if provider == primary_provider else PROVIDER_DEFAULT_MODELS[provider]
        complete_fn = PROVIDER_FUNCTIONS[provider]

        try:
            result = await complete_fn(
                messages=messages,
                model=current_model,
                max_tokens=max_tokens,
                temperature=temperature,
            )
            cb.record_success()

            # Track cost asynchronously
            if redis and tenant_id:
                usage = result.get("usage", {})
                await redis.hincrby(f"usage:{tenant_id}", "total_tokens", usage.get("total_tokens", 0))

            return {**result, "provider": provider}

        except Exception as e:
            cb.record_failure()
            last_error = e
            logger.error("provider_failed", provider=provider, model=current_model, error=str(e))
            continue

    raise Exception(f"All LLM providers failed. Last error: {last_error}")
