from fastapi import APIRouter
from app.services.api_key_manager import get_key_manager

router = APIRouter(tags=["health"])

@router.get("/health")
async def health_check():
    return {"status": "ok", "service": "IndusBrain AI"}

@router.get("/health/keys")
async def key_pool_stats():
    manager = get_key_manager()
    stats = manager.get_stats()
    return {
        "status": "ok",
        "pool": stats,
    }
