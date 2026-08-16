"""Session service — manages conversation sessions in Redis."""

import json
import os

SESSION_TTL = int(os.getenv("SESSION_TTL_SECONDS", "1800"))
MAX_TURNS = int(os.getenv("MAX_CONVERSATION_TURNS", "20"))


async def load_session(redis, session_id: str) -> list:
    """Loads conversation history from Redis."""
    data = await redis.get(f"session:{session_id}")
    if data:
        history = json.loads(data)
        return history[-(MAX_TURNS * 2):]  # Trim to max turns
    return []


async def save_session(redis, session_id: str, history: list):
    """Saves conversation history to Redis with TTL."""
    trimmed = history[-(MAX_TURNS * 2):]
    await redis.setex(f"session:{session_id}", SESSION_TTL, json.dumps(trimmed))
