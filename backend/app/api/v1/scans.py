from typing import Optional, List
from datetime import datetime, timezone
from urllib.parse import urlsplit
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session, joinedload, selectinload
from sqlalchemy import desc
import httpx

from app.database import get_db
from app.models.user import User, Organization
from app.models.brand import Brand, OfficialAsset
from app.models.scan import (
    ScanSubmission,
    ExtractedFeatures,
    RiskAssessment,
    EvidenceItem,
    AnalystReview,
    ScanFeedback,
    ScanProvenance,
)
from app.models.audit import AuditEvent
from app.core.security import get_current_user_optional, get_current_user
from app.api.v1.brands import get_user_org_id
from app.detection.risk_engine import assess_target_risk
from app.schemas.scan import (
    ScanCreateRequest,
    ScanResponse,
    ScanListResponse,
    ScanReviewRequest,
    ScanFeedbackRequest,
    RiskAssessmentResponse,
    EvidenceItemResponse,
    ScanProvenanceResponse,
)

router = APIRouter(prefix="/scans", tags=["Scans & Detection"])


@router.get("/app-store/search")
def search_apple_app_store(
    term: str = Query(..., min_length=2, max_length=100),
    country: str = Query("us", pattern=r"^[a-zA-Z]{2}$"),
    user: User = Depends(get_current_user),
):
    """Search Apple's public catalog; returned listings are observations, not verified assets."""
    try:
        response = httpx.get(
            "https://itunes.apple.com/search",
            params={
                "term": term.strip(),
                "country": country.lower(),
                "media": "software",
                "entity": "software",
                "limit": 20,
            },
            timeout=8.0,
            follow_redirects=False,
        )
        response.raise_for_status()
        payload = response.json()
    except (httpx.TimeoutException, httpx.RequestError) as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Apple's app catalog is temporarily unavailable. Try again later.",
        ) from exc
    except httpx.HTTPStatusError as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Apple's app catalog returned an error. Try again later.",
        ) from exc
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Apple's app catalog returned an invalid response.",
        ) from exc

    if not isinstance(payload, dict) or not isinstance(payload.get("results"), list):
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Apple's app catalog returned an invalid response.",
        )

    observed_at = datetime.now(timezone.utc).isoformat()
    items = []
    for result in payload["results"]:
        if not isinstance(result, dict):
            continue
        listing_url = result.get("trackViewUrl")
        if not isinstance(listing_url, str) or not listing_url.startswith("https://apps.apple.com/"):
            continue
        items.append({
            "listing_id": str(result.get("trackId", "")),
            "name": str(result.get("trackName", "")),
            "publisher": str(result.get("sellerName", "")),
            "listing_url": listing_url,
            "artwork_url": result.get("artworkUrl100"),
            "description": result.get("description"),
            "observed_at": observed_at,
            "country": country.lower(),
        })

    return {"source": "Apple App Store", "total": len(items), "items": items}


def get_request_org_id(
    user: Optional[User],
    db: Session,
    create_for_anonymous: bool = False,
) -> Optional[str]:
    if user:
        return get_user_org_id(user, db)

    organization = db.query(Organization).filter(
        Organization.slug == "brandguard-hq",
    ).first()
    if not organization:
        organization = db.query(Organization).order_by(Organization.created_at).first()
    if organization or not create_for_anonymous:
        return organization.id if organization else None

    organization = Organization(name="Default Security Org", slug="default-org")
    db.add(organization)
    db.commit()
    db.refresh(organization)
    return organization.id


def serialize_scan(scan: ScanSubmission) -> ScanResponse:
    assessment_resp = None
    if scan.risk_assessment:
        ra = scan.risk_assessment
        assessment_resp = RiskAssessmentResponse(
            risk_score=ra.risk_score,
            risk_category=ra.risk_category,
            rule_score=ra.rule_score,
            ml_score=ra.ml_score,
            is_insufficient_evidence=ra.is_insufficient_evidence,
            uncertainty_level=ra.uncertainty_level,
            summary_reason=ra.summary_reason,
            triggered_rules=ra.triggered_rules or [],
            recommended_actions=ra.recommended_actions or [],
            missing_evidence_notes=ra.missing_evidence_notes or [],
            model_version=ra.model_version,
            assessed_at=ra.created_at.isoformat() if ra.created_at else None
        )

    evidence_resp = []
    for ei in scan.evidence_items:
        evidence_resp.append(
            EvidenceItemResponse(
                id=ei.id,
                signal_name=ei.signal_name,
                signal_type=ei.signal_type,
                severity=ei.severity,
                score_contribution=ei.score_contribution,
                title=ei.title,
                description=ei.description,
                supporting_data=ei.supporting_data or {}
            )
        )

    features_dict = scan.extracted_features.features if scan.extracted_features else None
    provenance = scan.provenance

    return ScanResponse(
        id=scan.id,
        organization_id=scan.organization_id,
        brand_id=scan.brand_id,
        brand_name=scan.brand.name if scan.brand else "Unknown Brand",
        platform=scan.platform,
        target_url=scan.target_url,
        account_handle=scan.account_handle,
        display_name=scan.display_name,
        profile_description=scan.profile_description,
        profile_image_url=scan.profile_image_url,
        submission_source=scan.submission_source,
        status=scan.status,
        created_at=scan.created_at.isoformat() if scan.created_at else "",
        risk_assessment=assessment_resp,
        evidence_items=evidence_resp,
        extracted_features=features_dict,
        source_provenance=ScanProvenanceResponse(
            origin=provenance.origin,
            source_name=provenance.source_name,
            collection_method=provenance.collection_method,
            source_url=provenance.source_url,
            source_record_id=provenance.source_record_id,
            source_observed_at=provenance.source_observed_at,
            attribution_status=provenance.attribution_status,
            received_at=provenance.created_at.isoformat() if provenance.created_at else None,
        ) if provenance else None,
    )


@router.post("", response_model=ScanResponse, status_code=status.HTTP_201_CREATED)
def submit_scan(
    req: ScanCreateRequest,
    db: Session = Depends(get_db),
    user: Optional[User] = Depends(get_current_user_optional)
):
    org_id = get_request_org_id(user, db, create_for_anonymous=True)
    if org_id is None:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Unable to determine the scan workspace.",
        )

    # Find registered brand or candidate
    brand = None
    if req.brand_id:
        brand = db.query(Brand).filter(
            Brand.id == req.brand_id,
            Brand.organization_id == org_id,
        ).first()
        if not brand:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Brand not found")
    elif req.brand_name:
        brand = db.query(Brand).filter(Brand.organization_id == org_id, Brand.name.ilike(req.brand_name)).first()

    # Use a default brand only when the caller did not select one by ID or name.
    if not brand:
        if not req.brand_id and not req.brand_name:
            brand = db.query(Brand).filter(Brand.organization_id == org_id).first()
    
    brand_name = brand.name if brand else (req.brand_name or "TargetBrand")

    # Gather official handles and domains
    official_handles = []
    official_domains = []
    official_app_identifiers = []
    official_app_publishers = []
    app_platforms = {"app_store", "apple_app_store", "google_play"}
    platform_aliases = {"twitter": "x", "web": "website"}
    requested_platform = platform_aliases.get(req.platform.lower().strip(), req.platform.lower().strip())
    if brand:
        for asset in brand.official_assets:
            if not asset.is_verified:
                continue
            if asset.platform in ("website", "web"):
                official_domains.append(asset.normalized_identifier)
            elif asset.platform in app_platforms:
                official_app_identifiers.extend(
                    identifier for identifier in (asset.raw_identifier, asset.url)
                    if identifier
                )
                if asset.display_name:
                    official_app_publishers.append(asset.display_name)
            elif platform_aliases.get(asset.platform, asset.platform) == requested_platform:
                official_handles.append(asset.normalized_identifier)

    # Execute AI Risk Detection Pipeline
    detection_result = assess_target_risk(
        platform=req.platform,
        target_url=req.target_url,
        account_handle=req.account_handle,
        display_name=req.display_name,
        profile_description=req.profile_description,
        brand_name=brand_name,
        official_handles=official_handles,
        official_domains=official_domains,
        official_app_identifiers=official_app_identifiers,
        official_app_publishers=official_app_publishers,
        additional_evidence=req.additional_evidence
    )

    source_observation = req.source_observation
    if source_observation:
        try:
            source_parts = urlsplit(source_observation.source_url)
            is_apple_listing = (
                source_parts.scheme == "https"
                and source_parts.hostname == "apps.apple.com"
                and source_observation.source_url == req.target_url
            )
        except ValueError:
            is_apple_listing = False
        if requested_platform != "apple_app_store" or not is_apple_listing:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="Apple catalog provenance must match an Apple App Store listing submitted for that platform.",
            )

    # Persist scan submission
    scan = ScanSubmission(
        organization_id=org_id,
        brand_id=brand.id if brand else None,
        platform=req.platform.lower().strip(),
        target_url=req.target_url,
        account_handle=req.account_handle,
        display_name=req.display_name,
        profile_description=req.profile_description,
        profile_image_url=req.profile_image_url,
        additional_evidence=req.additional_evidence or {},
        submission_source=req.submission_source or "dashboard",
        status="completed"
    )
    db.add(scan)
    db.flush()

    if source_observation:
        provenance = ScanProvenance(
            scan_id=scan.id,
            origin="apple_app_store_catalog",
            source_name="Apple App Store",
            collection_method="on_demand_catalog_search",
            source_url=source_observation.source_url,
            source_record_id=source_observation.record_id,
            source_observed_at=source_observation.observed_at.isoformat(),
            attribution_status="client_reported_catalog_selection",
            details={"country": source_observation.country.lower()},
        )
    else:
        provenance = ScanProvenance(
            scan_id=scan.id,
            origin="analyst_submission",
            source_name="Analyst-submitted candidate",
            collection_method=(
                "user_initiated_browser_extension"
                if req.submission_source == "extension"
                else "manual_dashboard_or_api_submission"
            ),
            source_url=req.target_url,
            attribution_status="submitter_provided",
            details={"submission_source": req.submission_source or "dashboard"},
        )
    db.add(provenance)

    # Persist Extracted Features
    features_record = ExtractedFeatures(
        scan_id=scan.id,
        feature_version="1.0.0",
        features=detection_result.get("extracted_features", {}),
        missing_features=detection_result.get("missing_evidence", []),
        evidence_completeness_ratio=detection_result.get("extracted_features", {}).get("evidence_completeness", 1.0)
    )
    db.add(features_record)

    # Persist Risk Assessment
    assessment_record = RiskAssessment(
        scan_id=scan.id,
        risk_score=detection_result.get("risk_score", 0.0),
        risk_category=detection_result.get("risk_category", "Low"),
        rule_score=detection_result.get("rule_score", 0.0),
        ml_score=detection_result.get("ml_score"),
        is_insufficient_evidence=detection_result.get("is_insufficient_evidence", False),
        uncertainty_level=detection_result.get("uncertainty_level", "low"),
        summary_reason=detection_result.get("summary_reason", ""),
        triggered_rules=detection_result.get("triggered_rules", []),
        recommended_actions=detection_result.get("recommended_actions", []),
        missing_evidence_notes=detection_result.get("missing_evidence", []),
        model_version=detection_result.get("model_version", "hybrid_v1.0.0")
    )
    db.add(assessment_record)

    # Persist Evidence Items
    for ei in detection_result.get("evidence_items", []):
        db_ei = EvidenceItem(
            scan_id=scan.id,
            signal_name=ei.get("signal_name", "generic"),
            signal_type=ei.get("signal_type", "rule"),
            severity=ei.get("severity", "info"),
            score_contribution=ei.get("score_contribution", 0.0),
            title=ei.get("title", ""),
            description=ei.get("description", ""),
            supporting_data=ei.get("supporting_data", {})
        )
        db.add(db_ei)

    # Audit log entry
    if user:
        audit = AuditEvent(
            user_id=user.id,
            organization_id=org_id,
            action="scan.created",
            resource_type="scan",
            resource_id=scan.id,
            details={"risk_score": detection_result.get("risk_score"), "category": detection_result.get("risk_category")}
        )
        db.add(audit)

    db.commit()
    db.refresh(scan)

    return serialize_scan(scan)


@router.get("", response_model=ScanListResponse)
def list_scans(
    platform: Optional[str] = None,
    risk_category: Optional[str] = None,
    search: Optional[str] = None,
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db),
    user: Optional[User] = Depends(get_current_user_optional)
):
    org_id = get_request_org_id(user, db)
    query = db.query(ScanSubmission).filter(
        ScanSubmission.organization_id == (org_id or "__no_accessible_workspace__")
    ).order_by(desc(ScanSubmission.created_at))

    if platform:
        query = query.filter(ScanSubmission.platform == platform.lower().strip())

    if search:
        search_pattern = f"%{search.strip()}%"
        query = query.filter(
            (ScanSubmission.account_handle.ilike(search_pattern)) |
            (ScanSubmission.target_url.ilike(search_pattern)) |
            (ScanSubmission.display_name.ilike(search_pattern))
        )

    if risk_category:
        query = query.join(RiskAssessment).filter(RiskAssessment.risk_category == risk_category)

    total = query.count()
    items = query.options(
        joinedload(ScanSubmission.brand),
        joinedload(ScanSubmission.risk_assessment),
        selectinload(ScanSubmission.extracted_features),
        selectinload(ScanSubmission.evidence_items),
    ).offset(offset).limit(limit).all()

    return ScanListResponse(
        total=total,
        items=[serialize_scan(s) for s in items]
    )


@router.get("/{scan_id}", response_model=ScanResponse)
def get_scan(
    scan_id: str,
    db: Session = Depends(get_db),
    user: Optional[User] = Depends(get_current_user_optional),
):
    org_id = get_request_org_id(user, db)
    scan = db.query(ScanSubmission).filter(
        ScanSubmission.id == scan_id,
        ScanSubmission.organization_id == (org_id or "__no_accessible_workspace__"),
    ).options(
        joinedload(ScanSubmission.brand),
        joinedload(ScanSubmission.risk_assessment),
        selectinload(ScanSubmission.extracted_features),
        selectinload(ScanSubmission.evidence_items),
    ).first()
    if not scan:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Scan not found")
    return serialize_scan(scan)


@router.post("/{scan_id}/review", response_model=ScanResponse)
def review_scan(
    scan_id: str,
    req: ScanReviewRequest,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user)
):
    org_id = get_request_org_id(user, db)
    scan = db.query(ScanSubmission).filter(
        ScanSubmission.id == scan_id,
        ScanSubmission.organization_id == (org_id or "__no_accessible_workspace__"),
    ).first()
    if not scan:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Scan not found")

    review = AnalystReview(
        scan_id=scan.id,
        analyst_id=user.id,
        verdict=req.verdict,
        notes=req.notes,
        takedown_requested=req.takedown_requested or False
    )
    db.add(review)
    scan.status = "reviewed"
    db.commit()
    db.refresh(scan)
    return serialize_scan(scan)


@router.post("/{scan_id}/feedback")
def submit_feedback(
    scan_id: str,
    req: ScanFeedbackRequest,
    db: Session = Depends(get_db),
    user: Optional[User] = Depends(get_current_user_optional)
):
    org_id = get_request_org_id(user, db)
    scan = db.query(ScanSubmission).filter(
        ScanSubmission.id == scan_id,
        ScanSubmission.organization_id == (org_id or "__no_accessible_workspace__"),
    ).first()
    if not scan:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Scan not found")

    feedback = ScanFeedback(
        scan_id=scan.id,
        user_id=user.id if user else None,
        is_false_positive=req.is_false_positive,
        comment=req.comment
    )
    db.add(feedback)
    db.commit()
    return {"status": "success", "message": "Feedback recorded successfully."}
