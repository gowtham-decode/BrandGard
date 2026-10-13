from typing import Dict
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import func, desc

from app.database import get_db
from app.models.user import User, Organization
from app.models.brand import Brand, OfficialAsset
from app.models.scan import ScanSubmission, RiskAssessment, AnalystReview
from app.core.security import get_current_user_optional
from app.schemas.dashboard import DashboardSummaryResponse, RecentDetection
from app.api.v1.scans import get_request_org_id

router = APIRouter(prefix="/dashboard", tags=["Dashboard"])


@router.get("/summary", response_model=DashboardSummaryResponse)
def get_dashboard_summary(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user_optional)
):
    """
    Computes real metrics within the caller's workspace.
    """
    org_id = get_request_org_id(user, db)
    if org_id is None:
        org_id = db.query(Organization.id).filter(
            Organization.slug == "brandguard-hq",
        ).scalar()

    # Total submissions
    total_scans = db.query(func.count(ScanSubmission.id)).filter(
        ScanSubmission.organization_id == (org_id or "__no_accessible_workspace__")
    ).scalar() or 0

    # High and Critical risk counts
    high_risk_count = db.query(func.count(RiskAssessment.id)).join(ScanSubmission).filter(
        ScanSubmission.organization_id == (org_id or "__no_accessible_workspace__"),
        RiskAssessment.risk_category == "High",
    ).scalar() or 0

    critical_risk_count = db.query(func.count(RiskAssessment.id)).join(ScanSubmission).filter(
        ScanSubmission.organization_id == (org_id or "__no_accessible_workspace__"),
        RiskAssessment.risk_category == "Critical",
    ).scalar() or 0

    # Pending human reviews (scans completed but not reviewed yet)
    reviewed_scan_ids = db.query(AnalystReview.scan_id).distinct()
    pending_reviews = db.query(func.count(ScanSubmission.id)).filter(
        ScanSubmission.organization_id == (org_id or "__no_accessible_workspace__"),
        ~ScanSubmission.id.in_(reviewed_scan_ids),
        ScanSubmission.status != "resolved"
    ).scalar() or 0

    # Monitored brands and verified assets
    monitored_brands = db.query(func.count(Brand.id)).filter(
        Brand.organization_id == (org_id or "__no_accessible_workspace__"),
        Brand.is_active == True,
    ).scalar() or 0
    verified_assets = db.query(func.count(OfficialAsset.id)).join(Brand).filter(
        Brand.organization_id == (org_id or "__no_accessible_workspace__"),
        OfficialAsset.is_verified == True,
    ).scalar() or 0

    # Risk Distribution
    risk_dist_rows = db.query(
        RiskAssessment.risk_category,
        func.count(RiskAssessment.id)
    ).join(ScanSubmission).filter(
        ScanSubmission.organization_id == (org_id or "__no_accessible_workspace__")
    ).group_by(RiskAssessment.risk_category).all()
    risk_distribution: Dict[str, int] = {"Low": 0, "Medium": 0, "High": 0, "Critical": 0}
    for cat, count in risk_dist_rows:
        if cat in risk_distribution:
            risk_distribution[cat] = count

    # Platform Distribution
    platform_dist_rows = db.query(
        ScanSubmission.platform,
        func.count(ScanSubmission.id)
    ).filter(
        ScanSubmission.organization_id == (org_id or "__no_accessible_workspace__")
    ).group_by(ScanSubmission.platform).all()
    platform_distribution: Dict[str, int] = {}
    for plat, count in platform_dist_rows:
        platform_distribution[plat] = count

    # Recent Detections (Top 10)
    recent_scans = db.query(ScanSubmission).filter(
        ScanSubmission.organization_id == (org_id or "__no_accessible_workspace__")
    ).order_by(desc(ScanSubmission.created_at)).limit(10).all()
    recent_list = []
    for s in recent_scans:
        target_display = s.account_handle or s.target_url or s.display_name or "Unknown Target"
        score = s.risk_assessment.risk_score if s.risk_assessment else 0.0
        cat = s.risk_assessment.risk_category if s.risk_assessment else "Low"
        b_name = s.brand.name if s.brand else "Target Brand"

        recent_list.append(
            RecentDetection(
                id=s.id,
                target=target_display,
                platform=s.platform,
                brand_name=b_name,
                risk_score=score,
                risk_category=cat,
                created_at=s.created_at.isoformat() if s.created_at else ""
            )
        )

    return DashboardSummaryResponse(
        total_submissions=total_scans,
        high_risk_cases=high_risk_count,
        critical_risk_cases=critical_risk_count,
        pending_human_reviews=pending_reviews,
        monitored_brands=monitored_brands,
        verified_assets=verified_assets,
        risk_distribution=risk_distribution,
        platform_distribution=platform_distribution,
        recent_detections=recent_list
    )
