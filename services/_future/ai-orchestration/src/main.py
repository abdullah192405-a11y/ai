"""AI Orchestration Service — Request lifecycle, context assembly, response generation."""

import os
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import redis.asyncio as redis
import structlog

from src.controllers.query_controller import router as query_router
from src.controllers.health_controller import router as health_router

logger = structlog.get_logger()

redis_client = None


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup and shutdown lifecycle."""
    global redis_client
    redis_url = os.getenv("REDIS_URL", "redis://localhost:6379")
    redis_client = redis.from_url(redis_url, decode_responses=True)
    app.state.redis = redis_client
    logger.info("ai_orchestration_started", port=os.getenv("PORT", "8001"))
    yield
    await redis_client.aclose()
    logger.info("ai_orchestration_stopped")


app = FastAPI(
    title="WBA AI Orchestration Service",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(health_router, prefix="/health", tags=["Health"])
app.include_router(query_router, prefix="/v1/assistant", tags=["Assistant"])


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("src.main:app", host="0.0.0.0", port=int(os.getenv("PORT", "8001")), reload=True)
