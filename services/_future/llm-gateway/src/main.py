"""LLM Gateway Service — Multi-provider abstraction layer with circuit breaker."""

import os
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import redis.asyncio as redis
import structlog

from src.controllers.completion_controller import router as completion_router
from src.controllers.health_controller import router as health_router

logger = structlog.get_logger()


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup and shutdown lifecycle."""
    redis_url = os.getenv("REDIS_URL", "redis://localhost:6379")
    app.state.redis = redis.from_url(redis_url, decode_responses=True)
    logger.info("llm_gateway_started")
    yield
    await app.state.redis.aclose()
    logger.info("llm_gateway_stopped")


app = FastAPI(title="WBA LLM Gateway", version="1.0.0", lifespan=lifespan)
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])

app.include_router(health_router, prefix="/health", tags=["Health"])
app.include_router(completion_router, prefix="/v1/llm", tags=["LLM"])

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("src.main:app", host="0.0.0.0", port=int(os.getenv("PORT", "8003")), reload=True)
