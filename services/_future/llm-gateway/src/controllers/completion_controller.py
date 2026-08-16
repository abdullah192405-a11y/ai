"""Completion controller — unified LLM completion endpoint."""

import time
from typing import Optional
from fastapi import APIRouter, Request, HTTPException
from pydantic import BaseModel, Field
import structlog

from src.services.router_service import route_completion

logger = structlog.get_logger()
router = APIRouter()


class CompletionRequest(BaseModel):
    messages: list[dict] = Field(...)
    model: Optional[str] = None
    max_tokens: int = Field(default=1024, le=4096)
    temperature: float = Field(default=0.3, ge=0.0, le=2.0)
    tenant_id: Optional[str] = None


@router.post("/complete")
async def complete(request: Request, body: CompletionRequest):
    """Routes completion request to the appropriate LLM provider."""
    start_time = time.time()

    try:
        result = await route_completion(
            redis=request.app.state.redis,
            messages=body.messages,
            model=body.model,
            max_tokens=body.max_tokens,
            temperature=body.temperature,
            tenant_id=body.tenant_id,
        )
    except Exception as e:
        logger.error("completion_failed", error=str(e))
        raise HTTPException(status_code=502, detail=f"LLM completion failed: {str(e)}")

    latency_ms = int((time.time() - start_time) * 1000)

    return {
        "data": {
            "content": result["content"],
            "model": result["model"],
            "usage": result.get("usage", {}),
        },
        "meta": {
            "version": "v1",
            "latency_ms": latency_ms,
            "provider": result.get("provider", "unknown"),
        },
    }


@router.get("/models")
async def list_models():
    """Lists all available LLM models."""
    return {
        "data": [
            {"id": "gpt-4o-mini", "provider": "openai", "status": "available"},
            {"id": "gpt-4o", "provider": "openai", "status": "available"},
            {"id": "claude-3-5-sonnet-20241022", "provider": "anthropic", "status": "available"},
            {"id": "gemini-2.0-flash", "provider": "google", "status": "available"},
        ],
        "meta": {"version": "v1"},
    }
