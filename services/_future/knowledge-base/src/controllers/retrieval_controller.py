"""Retrieval controller — semantic search over the knowledge base."""

from typing import Optional
from fastapi import APIRouter, Request
from pydantic import BaseModel, Field
import structlog

from src.services.retrieval_service import semantic_search

logger = structlog.get_logger()
router = APIRouter()


class RetrievalRequest(BaseModel):
    question: str = Field(..., max_length=2000)
    domain: str = Field(...)
    page_url: Optional[str] = None
    top_k: int = Field(default=5, le=20)
    tenant_id: Optional[str] = None


@router.post("/retrieve")
async def retrieve_chunks(request: Request, body: RetrievalRequest):
    """Retrieves the most relevant knowledge base chunks for a given question."""
    chunks = await semantic_search(
        qdrant=request.app.state.qdrant,
        redis=request.app.state.redis,
        question=body.question,
        domain=body.domain,
        page_url=body.page_url,
        top_k=body.top_k,
        tenant_id=body.tenant_id,
    )

    return {
        "data": {"chunks": chunks, "count": len(chunks)},
        "meta": {"version": "v1"},
    }
