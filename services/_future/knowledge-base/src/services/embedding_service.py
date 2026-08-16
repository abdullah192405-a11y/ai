"""Embedding service — generates embeddings and stores vectors in Qdrant."""

import os
import uuid
from openai import AsyncOpenAI
from qdrant_client.models import Distance, VectorParams, PointStruct, Filter, FieldCondition, MatchValue
import structlog

logger = structlog.get_logger()

EMBEDDING_MODEL = os.getenv("EMBEDDING_MODEL", "text-embedding-3-large")
EMBEDDING_DIMS = int(os.getenv("EMBEDDING_DIMENSIONS", "1536"))
COLLECTION_NAME = os.getenv("QDRANT_COLLECTION", "knowledge_embeddings")

_openai_client = None


def _get_openai():
    global _openai_client
    if not _openai_client:
        _openai_client = AsyncOpenAI(api_key=os.getenv("OPENAI_API_KEY", ""))
    return _openai_client


async def ensure_collection(qdrant):
    """Creates the Qdrant collection if it doesn't exist."""
    collections = await qdrant.get_collections()
    existing = [c.name for c in collections.collections]
    if COLLECTION_NAME not in existing:
        await qdrant.create_collection(
            collection_name=COLLECTION_NAME,
            vectors_config=VectorParams(size=EMBEDDING_DIMS, distance=Distance.COSINE),
        )
        logger.info("qdrant_collection_created", collection=COLLECTION_NAME)


async def generate_embeddings(texts: list[str]) -> list[list[float]]:
    """Generates embeddings for a batch of texts using OpenAI."""
    client = _get_openai()
    response = await client.embeddings.create(
        model=EMBEDDING_MODEL,
        input=texts,
        dimensions=EMBEDDING_DIMS,
    )
    return [item.embedding for item in response.data]


async def embed_and_store(qdrant, chunks: list[dict], tenant_id: str, doc_id: str, source_type: str, source_url: str) -> int:
    """Embeds text chunks and stores them in Qdrant."""
    if not chunks:
        return 0

    texts = [c["text"] for c in chunks]

    # Batch embed (max 2048 per call)
    all_embeddings = []
    batch_size = 100
    for i in range(0, len(texts), batch_size):
        batch = texts[i:i + batch_size]
        embeddings = await generate_embeddings(batch)
        all_embeddings.extend(embeddings)

    # Build points
    points = []
    for i, (chunk, embedding) in enumerate(zip(chunks, all_embeddings)):
        points.append(
            PointStruct(
                id=str(uuid.uuid4()),
                vector=embedding,
                payload={
                    "tenant_id": tenant_id,
                    "doc_id": doc_id,
                    "text": chunk["text"],
                    "title": chunk.get("title", ""),
                    "source_type": source_type,
                    "source_url": source_url,
                    "chunk_index": chunk.get("index", i),
                    "total_chunks": chunk.get("total_chunks", len(chunks)),
                },
            )
        )

    # Upsert to Qdrant
    await qdrant.upsert(collection_name=COLLECTION_NAME, points=points)

    return len(points)
