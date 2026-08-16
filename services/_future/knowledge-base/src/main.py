"""Knowledge Base Service — RAG pipeline: ingestion, chunking, embedding, retrieval."""

import os
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import redis.asyncio as redis
from qdrant_client import AsyncQdrantClient
import structlog

from src.controllers.ingestion_controller import router as ingestion_router
from src.controllers.retrieval_controller import router as retrieval_router
from src.controllers.health_controller import router as health_router

logger = structlog.get_logger()


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup and shutdown lifecycle."""
    redis_url = os.getenv("REDIS_URL", "redis://localhost:6379")
    qdrant_url = os.getenv("QDRANT_URL", "http://localhost:6333")

    app.state.redis = redis.from_url(redis_url, decode_responses=True)
    app.state.qdrant = AsyncQdrantClient(url=qdrant_url)

    # Ensure collection exists
    from src.services.embedding_service import ensure_collection
    await ensure_collection(app.state.qdrant)

    logger.info("knowledge_base_started")
    yield
    await app.state.redis.aclose()
    await app.state.qdrant.close()
    logger.info("knowledge_base_stopped")


app = FastAPI(title="WBA Knowledge Base Service", version="1.0.0", lifespan=lifespan)
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])

app.include_router(health_router, prefix="/health", tags=["Health"])
app.include_router(ingestion_router, prefix="/v1/knowledge", tags=["Ingestion"])
app.include_router(retrieval_router, prefix="/v1/knowledge", tags=["Retrieval"])

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("src.main:app", host="0.0.0.0", port=int(os.getenv("PORT", "8002")), reload=True)
