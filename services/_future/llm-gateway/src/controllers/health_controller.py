"""Health check controller."""

from fastapi import APIRouter, Request

router = APIRouter()


@router.get("/")
async def health_check(request: Request):
    checks = {}
    try:
        await request.app.state.redis.ping()
        checks["redis"] = "healthy"
    except Exception:
        checks["redis"] = "unhealthy"
    is_healthy = all(v == "healthy" for v in checks.values())
    return {"status": "healthy" if is_healthy else "degraded", "service": "llm-gateway", "checks": checks}
