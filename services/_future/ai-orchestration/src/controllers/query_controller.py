"""Query controller — handles the main assistant query endpoint."""

import hashlib
import json
import time
import uuid
from typing import Optional

import httpx
import structlog
from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel, Field

from src.services.context_service import build_context
from src.services.session_service import load_session, save_session
from src.prompts.system_prompt import build_system_prompt

logger = structlog.get_logger()
router = APIRouter()

KNOWLEDGE_BASE_URL = None
LLM_GATEWAY_URL = None

def _get_urls():
    import os
    global KNOWLEDGE_BASE_URL, LLM_GATEWAY_URL
    if not KNOWLEDGE_BASE_URL:
        KNOWLEDGE_BASE_URL = os.getenv("KNOWLEDGE_BASE_URL", "http://localhost:8002")
        LLM_GATEWAY_URL = os.getenv("LLM_GATEWAY_URL", "http://localhost:8003")


class QueryRequest(BaseModel):
    domain: str = Field(..., min_length=3)
    page_url: str = Field(...)
    question: str = Field(..., max_length=2000)
    session_id: Optional[str] = None


class ActionSuggestion(BaseModel):
    type: str
    target: str
    label: str


class QueryResponse(BaseModel):
    answer: str
    sources: list = []
    actions: list[ActionSuggestion] = []
    session_id: str


@router.post("/query")
async def query_assistant(request: Request, body: QueryRequest):
    """Main AI assistant query endpoint — the core product feature."""
    _get_urls()
    start_time = time.time()
    redis = request.app.state.redis
    request_id = str(uuid.uuid4())

    logger.info("query_received", request_id=request_id, domain=body.domain, page_url=body.page_url)

    # Step 1: Session Management
    session_id = body.session_id or str(uuid.uuid4())
    conversation_history = await load_session(redis, session_id)

    # Step 2: Response Cache Check
    cache_key = f"resp:{hashlib.sha256(f'{body.domain}:{body.page_url}:{body.question}'.encode()).hexdigest()}"
    cached = await redis.get(cache_key)
    if cached:
        logger.info("cache_hit", request_id=request_id)
        data = json.loads(cached)
        data["session_id"] = session_id
        return {"data": data, "meta": {"request_id": request_id, "cached": True, "latency_ms": int((time.time() - start_time) * 1000)}}

    # Step 3: Context Assembly
    context = build_context(body.domain, body.page_url, body.question, conversation_history)

    # Step 4: Knowledge Retrieval (RAG)
    knowledge_chunks = []
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            kb_response = await client.post(
                f"{KNOWLEDGE_BASE_URL}/v1/knowledge/retrieve",
                json={"question": body.question, "domain": body.domain, "page_url": body.page_url, "top_k": 5},
            )
            if kb_response.status_code == 200:
                knowledge_chunks = kb_response.json().get("data", {}).get("chunks", [])
    except Exception as e:
        logger.warning("knowledge_retrieval_failed", error=str(e))

    # Step 5: Build Prompt
    system_prompt = build_system_prompt(
        domain=body.domain,
        page_url=body.page_url,
        knowledge_chunks=knowledge_chunks,
    )

    messages = [{"role": "system", "content": system_prompt}]
    for msg in conversation_history[-10:]:
        messages.append({"role": msg["role"], "content": msg["content"]})
    messages.append({"role": "user", "content": body.question})

    # Step 6: LLM Invocation
    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            llm_response = await client.post(
                f"{LLM_GATEWAY_URL}/v1/llm/complete",
                json={"messages": messages, "max_tokens": 1024, "temperature": 0.3},
            )
            llm_response.raise_for_status()
            llm_data = llm_response.json()
    except Exception as e:
        logger.error("llm_invocation_failed", error=str(e))
        raise HTTPException(status_code=502, detail="AI service temporarily unavailable")

    answer = llm_data.get("data", {}).get("content", "I'm sorry, I couldn't generate a response.")
    sources = [{"title": c.get("title", ""), "url": c.get("source_url", "")} for c in knowledge_chunks[:3]]

    # Step 7: Update Session
    conversation_history.append({"role": "user", "content": body.question})
    conversation_history.append({"role": "assistant", "content": answer})
    await save_session(redis, session_id, conversation_history)

    # Step 8: Cache Response
    response_data = {"answer": answer, "sources": sources, "actions": [], "session_id": session_id}
    await redis.setex(cache_key, 900, json.dumps({"answer": answer, "sources": sources, "actions": []}))

    latency_ms = int((time.time() - start_time) * 1000)
    logger.info("query_completed", request_id=request_id, latency_ms=latency_ms)

    return {"data": response_data, "meta": {"request_id": request_id, "cached": False, "latency_ms": latency_ms}}
