"""Retrieval service — semantic search with embedding-based similarity."""

import hashlib
import json
import os
from typing import Optional

from qdrant_client.models import Filter, FieldCondition, MatchValue
import structlog

from src.services.embedding_service import generate_embeddings, COLLECTION_NAME

logger = structlog.get_logger()

CACHE_TTL = int(os.getenv("EMBEDDING_CACHE_TTL", "86400"))


async def semantic_search(
    qdrant,
    redis,
    question: str,
    domain: str,
    page_url: Optional[str] = None,
    top_k: int = 5,
    tenant_id: Optional[str] = None,
) -> list[dict]:
    """
    Performs semantic search over the knowledge base.
    Steps: Embed question → Search Qdrant → Rerank → Return top chunks.
    """

    # Check cache for question embedding
    cache_key = f"emb:{hashlib.sha256(question.encode()).hexdigest()}"
    cached_embedding = await redis.get(cache_key)

    if cached_embedding:
        query_embedding = json.loads(cached_embedding)
    else:
        embeddings = await generate_embeddings([question])
        query_embedding = embeddings[0]
        await redis.setex(cache_key, CACHE_TTL, json.dumps(query_embedding))

    # Build Qdrant filter
    must_conditions = []
    if tenant_id:
        must_conditions.append(FieldCondition(key="tenant_id", match=MatchValue(value=tenant_id)))

    query_filter = Filter(must=must_conditions) if must_conditions else None

    # Search Qdrant
    results = await qdrant.search(
        collection_name=COLLECTION_NAME,
        query_vector=query_embedding,
        query_filter=query_filter,
        limit=top_k * 2,  # Fetch more for reranking
        score_threshold=0.3,
    )

    # Simple reranking: boost chunks from the current page
    scored_results = []
    for result in results:
        score = result.score
        payload = result.payload

        # Boost if source URL matches current page
        if page_url and payload.get("source_url", "").lower() in page_url.lower():
            score *= 1.2

        scored_results.append({
            "text": payload.get("text", ""),
            "chunk_text": payload.get("text", ""),
            "title": payload.get("title", ""),
            "source_url": payload.get("source_url", ""),
            "source_type": payload.get("source_type", ""),
            "score": round(score, 4),
            "doc_id": payload.get("doc_id", ""),
            "chunk_index": payload.get("chunk_index", 0),
        })

    # Sort by score and return top_k
    scored_results.sort(key=lambda x: x["score"], reverse=True)
    return scored_results[:top_k]
