"""Google Gemini adapter — wraps the Google Generative AI API for the LLM Gateway."""

import os
from google import genai
from google.genai import types
import structlog

logger = structlog.get_logger()

_client = None


def _get_client():
    global _client
    if not _client:
        _client = genai.Client(api_key=os.getenv("GOOGLE_API_KEY", ""))
    return _client


async def google_complete(
    messages: list[dict],
    model: str = "gemini-2.0-flash",
    max_tokens: int = 1024,
    temperature: float = 0.3,
) -> dict:
    """Sends a completion request to Google Gemini."""
    client = _get_client()

    # Convert to Gemini format
    system_instruction = ""
    contents = []
    for msg in messages:
        if msg["role"] == "system":
            system_instruction += msg["content"] + "\n"
        elif msg["role"] == "user":
            contents.append(types.Content(parts=[types.Part(text=msg["content"])], role="user"))
        elif msg["role"] == "assistant":
            contents.append(types.Content(parts=[types.Part(text=msg["content"])], role="model"))

    config = types.GenerateContentConfig(
        max_output_tokens=max_tokens,
        temperature=temperature,
        system_instruction=system_instruction.strip() or None,
    )

    response = await client.aio.models.generate_content(
        model=model,
        contents=contents,
        config=config,
    )

    content = response.text or ""
    usage_meta = response.usage_metadata

    return {
        "content": content,
        "model": model,
        "finish_reason": "stop",
        "usage": {
            "prompt_tokens": usage_meta.prompt_token_count if usage_meta else 0,
            "completion_tokens": usage_meta.candidates_token_count if usage_meta else 0,
            "total_tokens": usage_meta.total_token_count if usage_meta else 0,
        },
    }
