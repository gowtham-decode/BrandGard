from datetime import datetime, timezone
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import text
from app.database import get_db
from app.config import settings

router = APIRouter(tags=["Health"])


@router.get("/health")
def get_health(db: Session = Depends(get_db)):
    """Health check endpoint validating database connectivity and engine state."""
    db_status = "healthy"
    try:
        db.execute(text("SELECT 1"))
    except Exception as exc:
        db_status = f"unhealthy: {str(exc)}"

    return {
        "status": "healthy" if db_status == "healthy" else "degraded",
        "service": settings.PROJECT_NAME,
        "version": settings.VERSION,
        "database": db_status,
        "model_version": settings.MODEL_VERSION,
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }
