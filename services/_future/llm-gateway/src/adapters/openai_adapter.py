"""OpenAI adapter — wraps the OpenAI API for the LLM Gateway."""

import os
from openai import AsyncOpenAI
import structlog

logger = structlog.get_logger()

_client = None


def _get_client():
    global _client
    if not _client:
        _client = AsyncOpenAI(api_key=os.getenv("OPENAI_API_KEY", ""))
    return _client


async def openai_complete(
    messages: list[dict],
    model: str = "gpt-4o-mini",
    max_tokens: int = 1024,
    temperature: float = 0.3,
) -> dict:
    """Sends a completion request to OpenAI."""
    client = _get_client()

    response = await client.chat.completions.create(
        model=model,
        messages=messages,
        max_tokens=max_tokens,
        temperature=temperature,
    )

    choice = response.choices[0]

    return {
        "content": choice.message.content or "",
        "model": response.model,
        "finish_reason": choice.finish_reason,
        "usage": {
            "prompt_tokens": response.usage.prompt_tokens if response.usage else 0,
            "completion_tokens": response.usage.completion_tokens if response.usage else 0,
            "total_tokens": response.usage.total_tokens if response.usage else 0,
        },
    }
