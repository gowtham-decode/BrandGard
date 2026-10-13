import secrets
from typing import List, Optional
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session, selectinload

from app.database import get_db
from app.models.user import User, OrgMembership, Organization
from app.models.brand import Brand, OfficialAsset, VerificationRecord
from app.models.audit import AuditEvent
from app.core.security import get_current_user
from app.detection.normalizer import normalize_handle, normalize_domain
from app.schemas.brand import (
    BrandCreateRequest,
    BrandResponse,
    OfficialAssetCreate,
    OfficialAssetResponse,
    VerificationInitResponse,
)
from pydantic import BaseModel, Field, field_validator
import dns.exception
import dns.resolver

router = APIRouter(prefix="/brands", tags=["Brand Management"])


class ManualAssetVerificationRequest(BaseModel):
    notes: str = Field(..., min_length=10, max_length=2000)

    @field_validator("notes")
    @classmethod
    def notes_must_include_review_details(cls, value: str) -> str:
        value = value.strip()
        if len(value) < 10:
            raise ValueError("Describe the ownership evidence reviewed (at least 10 characters).")
        return value


def get_user_org_id(user: User, db: Session) -> str:
    membership = db.query(OrgMembership).filter(OrgMembership.user_id == user.id).first()
    if membership:
        return membership.organization_id
    # Fallback: create default organization for user
    org = Organization(name=f"{user.email.split('@')[0].capitalize()}'s Org", slug=user.id[:8])
    db.add(org)
    db.flush()
    mem = OrgMembership(user_id=user.id, organization_id=org.id, role="owner")
    db.add(mem)
    db.commit()
    return org.id


def format_asset_response(asset: OfficialAsset) -> OfficialAssetResponse:
    return OfficialAssetResponse(
        id=asset.id,
        brand_id=asset.brand_id,
        platform=asset.platform,
        raw_identifier=asset.raw_identifier,
        normalized_identifier=asset.normalized_identifier,
        url=asset.url,
        display_name=asset.display_name,
        verification_status=asset.verification_status,
        is_verified=asset.is_verified,
        created_at=asset.created_at.isoformat() if asset.created_at else ""
    )


def format_brand_response(brand: Brand) -> BrandResponse:
    return BrandResponse(
        id=brand.id,
        organization_id=brand.organization_id,
        name=brand.name,
        slug=brand.slug,
        description=brand.description,
        category=brand.category,
        logo_url=brand.logo_url,
        alternate_names=brand.alternate_names or [],
        authorized_contact=brand.authorized_contact or {},
        is_active=brand.is_active,
        official_assets=[format_asset_response(a) for a in brand.official_assets],
        created_at=brand.created_at.isoformat() if brand.created_at else ""
    )


@router.get("", response_model=List[BrandResponse])
def list_brands(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user)
):
    org_id = get_user_org_id(user, db)
    brands = db.query(Brand).options(
        selectinload(Brand.official_assets),
    ).filter(Brand.organization_id == org_id, Brand.is_active == True).all()
    return [format_brand_response(b) for b in brands]


@router.post("", response_model=BrandResponse, status_code=status.HTTP_201_CREATED)
def create_brand(
    req: BrandCreateRequest,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user)
):
    org_id = get_user_org_id(user, db)
    slug = req.name.lower().strip().replace(" ", "-")

    # Check for duplicate brand in org
    existing = db.query(Brand).filter(Brand.organization_id == org_id, Brand.slug == slug).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"A brand with name '{req.name}' is already registered in your organization."
        )

    brand = Brand(
        organization_id=org_id,
        name=req.name.strip(),
        slug=slug,
        description=req.description,
        category=req.category,
        logo_url=req.logo_url,
        alternate_names=req.alternate_names or [],
        authorized_contact=req.authorized_contact or {},
    )
    db.add(brand)
    db.flush()

    # Add initial assets if provided
    for asset_in in req.initial_assets or []:
        norm_id = normalize_domain(asset_in.raw_identifier)[2] if asset_in.platform in ("website", "web") else normalize_handle(asset_in.raw_identifier)
        asset = OfficialAsset(
            brand_id=brand.id,
            platform=asset_in.platform.lower().strip(),
            raw_identifier=asset_in.raw_identifier.strip(),
            normalized_identifier=norm_id,
            display_name=asset_in.display_name,
            verification_status="unverified",
            is_verified=False
        )
        db.add(asset)

    db.commit()
    db.refresh(brand)
    return format_brand_response(brand)


@router.get("/{brand_id}", response_model=BrandResponse)
def get_brand(
    brand_id: str,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user)
):
    org_id = get_user_org_id(user, db)
    brand = db.query(Brand).filter(Brand.id == brand_id, Brand.organization_id == org_id).first()
    if not brand:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Brand not found")
    return format_brand_response(brand)


@router.post("/{brand_id}/assets", response_model=OfficialAssetResponse, status_code=status.HTTP_201_CREATED)
def add_brand_asset(
    brand_id: str,
    asset_in: OfficialAssetCreate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user)
):
    org_id = get_user_org_id(user, db)
    brand = db.query(Brand).filter(Brand.id == brand_id, Brand.organization_id == org_id).first()
    if not brand:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Brand not found")

    norm_id = normalize_domain(asset_in.raw_identifier)[2] if asset_in.platform in ("website", "web") else normalize_handle(asset_in.raw_identifier)
    
    asset = OfficialAsset(
        brand_id=brand.id,
        platform=asset_in.platform.lower().strip(),
        raw_identifier=asset_in.raw_identifier.strip(),
        normalized_identifier=norm_id,
        display_name=asset_in.display_name,
        verification_status="unverified",
        is_verified=False
    )
    db.add(asset)
    db.commit()
    db.refresh(asset)
    return format_asset_response(asset)


@router.post("/{brand_id}/assets/{asset_id}/verify", response_model=VerificationInitResponse)
def init_asset_verification(
    brand_id: str,
    asset_id: str,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user)
):
    org_id = get_user_org_id(user, db)
    brand = db.query(Brand).filter(Brand.id == brand_id, Brand.organization_id == org_id).first()
    if not brand:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Brand not found")

    asset = db.query(OfficialAsset).filter(OfficialAsset.id == asset_id, OfficialAsset.brand_id == brand.id).first()
    if not asset:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Asset not found")

    if asset.platform not in ("website", "web"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Automated verification currently supports website DNS ownership only. Use manual review for other asset types.",
        )

    token = f"brandguard-verify-{secrets.token_hex(12)}"
    
    # Store or update verification record
    record = db.query(VerificationRecord).filter(VerificationRecord.asset_id == asset.id).first()
    if not record:
        record = VerificationRecord(
            asset_id=asset.id,
            verification_method="dns_txt",
            verification_token=token,
            expected_location=f"_brandguard-challenge.{asset.normalized_identifier}",
            status="pending"
        )
        db.add(record)
    else:
        record.verification_token = token
        record.status = "pending"

    asset.verification_status = "pending"
    asset.is_verified = False

    db.commit()

    return VerificationInitResponse(
        asset_id=asset.id,
        verification_method=record.verification_method,
        verification_token=token,
        expected_location=record.expected_location or "",
        instructions=f"Add a DNS TXT record at '{record.expected_location}' containing '{token}'."
    )


@router.post(
    "/{brand_id}/assets/{asset_id}/verify/dns",
    response_model=OfficialAssetResponse,
)
def complete_dns_asset_verification(
    brand_id: str,
    asset_id: str,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    org_id = get_user_org_id(user, db)
    brand = db.query(Brand).filter(
        Brand.id == brand_id,
        Brand.organization_id == org_id,
    ).first()
    if not brand:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Brand not found")

    asset = db.query(OfficialAsset).filter(
        OfficialAsset.id == asset_id,
        OfficialAsset.brand_id == brand.id,
    ).first()
    if not asset:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Asset not found")
    if asset.platform not in ("website", "web"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="DNS verification is available only for website assets.",
        )

    record = db.query(VerificationRecord).filter(
        VerificationRecord.asset_id == asset.id,
        VerificationRecord.verification_method == "dns_txt",
        VerificationRecord.status == "pending",
    ).first()
    if not record or not record.expected_location or not record.verification_token:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Start a new DNS verification challenge before completing verification.",
        )

    try:
        answers = dns.resolver.resolve(record.expected_location, "TXT", lifetime=5.0)
    except (dns.resolver.NXDOMAIN, dns.resolver.NoAnswer):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="The DNS TXT challenge was not found. Publish the exact token and try again.",
        )
    except (dns.resolver.LifetimeTimeout, dns.resolver.NoNameservers, dns.exception.Timeout) as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="DNS could not be checked right now. Try again later.",
        ) from exc

    published_values = {
        b"".join(answer.strings).decode("utf-8", errors="replace").strip('"')
        for answer in answers
    }
    if record.verification_token not in published_values:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="The DNS TXT record does not contain the expected verification token.",
        )

    now = datetime.now(timezone.utc).isoformat()
    record.status = "verified"
    record.verified_at = now
    record.notes = "Ownership verified by matching the published DNS TXT challenge."
    asset.verification_status = "verified"
    asset.is_verified = True
    db.add(AuditEvent(
        user_id=user.id,
        organization_id=org_id,
        action="asset.dns_verified",
        resource_type="asset",
        resource_id=asset.id,
        details={"domain": asset.normalized_identifier, "verification_method": "dns_txt"},
    ))
    db.commit()
    db.refresh(asset)
    return format_asset_response(asset)


@router.post(
    "/{brand_id}/assets/{asset_id}/verify/manual",
    response_model=OfficialAssetResponse,
)
def manually_verify_asset(
    brand_id: str,
    asset_id: str,
    req: ManualAssetVerificationRequest,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    org_id = get_user_org_id(user, db)
    brand = db.query(Brand).filter(
        Brand.id == brand_id,
        Brand.organization_id == org_id,
    ).first()
    if not brand:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Brand not found")

    asset = db.query(OfficialAsset).filter(
        OfficialAsset.id == asset_id,
        OfficialAsset.brand_id == brand.id,
    ).first()
    if not asset:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Asset not found")

    record = db.query(VerificationRecord).filter(
        VerificationRecord.asset_id == asset.id,
    ).first()
    if not record:
        record = VerificationRecord(
            asset_id=asset.id,
            verification_method="manual_review",
            verification_token="",
            expected_location=None,
        )
        db.add(record)

    now = datetime.now(timezone.utc).isoformat()
    record.verification_method = "manual_review"
    record.status = "verified"
    record.notes = req.notes.strip()
    record.verified_at = now
    asset.verification_status = "verified"
    asset.is_verified = True
    db.add(AuditEvent(
        user_id=user.id,
        organization_id=org_id,
        action="asset.manually_verified",
        resource_type="asset",
        resource_id=asset.id,
        details={"verification_method": "manual_review"},
    ))

    db.commit()
    db.refresh(asset)
    return format_asset_response(asset)
