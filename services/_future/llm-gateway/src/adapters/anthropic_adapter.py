"""Anthropic adapter — wraps the Anthropic API for the LLM Gateway."""

import os
from anthropic import AsyncAnthropic
import structlog

logger = structlog.get_logger()

_client = None


def _get_client():
    global _client
    if not _client:
        _client = AsyncAnthropic(api_key=os.getenv("ANTHROPIC_API_KEY", ""))
    return _client


async def anthropic_complete(
    messages: list[dict],
    model: str = "claude-3-5-sonnet-20241022",
    max_tokens: int = 1024,
    temperature: float = 0.3,
) -> dict:
    """Sends a completion request to Anthropic Claude."""
    client = _get_client()

    # Extract system message (Anthropic uses a separate system param)
    system_content = ""
    chat_messages = []
    for msg in messages:
        if msg["role"] == "system":
            system_content += msg["content"] + "\n"
        else:
            chat_messages.append({"role": msg["role"], "content": msg["content"]})

    response = await client.messages.create(
        model=model,
        max_tokens=max_tokens,
        temperature=temperature,
        system=system_content.strip() or None,
        messages=chat_messages,
    )

    content = response.content[0].text if response.content else ""

    return {
        "content": content,
        "model": response.model,
        "finish_reason": response.stop_reason,
        "usage": {
            "prompt_tokens": response.usage.input_tokens,
            "completion_tokens": response.usage.output_tokens,
            "total_tokens": response.usage.input_tokens + response.usage.output_tokens,
        },
    }
