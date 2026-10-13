from typing import Dict, List, Any
from pydantic import BaseModel


class RiskCount(BaseModel):
    category: str
    count: int


class PlatformCount(BaseModel):
    platform: str
    count: int


class RecentDetection(BaseModel):
    id: str
    target: str
    platform: str
    brand_name: str
    risk_score: float
    risk_category: str
    created_at: str


class DashboardSummaryResponse(BaseModel):
    total_submissions: int
    high_risk_cases: int
    critical_risk_cases: int
    pending_human_reviews: int
    monitored_brands: int
    verified_assets: int
    risk_distribution: Dict[str, int]
    platform_distribution: Dict[str, int]
    recent_detections: List[RecentDetection]
