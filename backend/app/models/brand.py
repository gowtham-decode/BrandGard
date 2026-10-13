from sqlalchemy import Column, String, Text, Boolean, ForeignKey, Index, JSON
from sqlalchemy.orm import relationship
from app.database import Base
from app.models.base import TimestampMixin, generate_uuid


class Brand(Base, TimestampMixin):
    __tablename__ = "brands"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    organization_id = Column(String(36), ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False, index=True)
    name = Column(String(255), nullable=False, index=True)
    slug = Column(String(255), nullable=False, index=True)
    description = Column(Text, nullable=True)
    category = Column(String(100), nullable=True)  # finance, tech, ecommerce, healthcare, etc.
    logo_url = Column(String(1024), nullable=True)
    
    # JSON list of alternate/previous brand names or aliases
    alternate_names = Column(JSON, default=list, nullable=False)
    
    # Authorized contact/owner details
    authorized_contact = Column(JSON, default=dict, nullable=False)
    is_active = Column(Boolean, default=True, nullable=False)

    organization = relationship("Organization", back_populates="brands")
    official_assets = relationship("OfficialAsset", back_populates="brand", cascade="all, delete-orphan")
    scans = relationship("ScanSubmission", back_populates="brand")

    __table_args__ = (
        Index("ix_brand_org_name", "organization_id", "name"),
    )


class OfficialAsset(Base, TimestampMixin):
    __tablename__ = "official_assets"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    brand_id = Column(String(36), ForeignKey("brands.id", ondelete="CASCADE"), nullable=False, index=True)
    
    # Asset type: website, instagram, facebook, x, telegram, etc.
    platform = Column(String(50), nullable=False, index=True)
    
    # Raw entered value and normalised value
    raw_identifier = Column(String(1024), nullable=False)
    normalized_identifier = Column(String(1024), nullable=False, index=True)  # handle or domain
    url = Column(String(1024), nullable=True)
    display_name = Column(String(255), nullable=True)
    
    # Verification status: unverified, pending, verified, rejected
    verification_status = Column(String(50), default="unverified", nullable=False, index=True)
    is_verified = Column(Boolean, default=False, nullable=False)

    brand = relationship("Brand", back_populates="official_assets")
    verification_records = relationship("VerificationRecord", back_populates="asset", cascade="all, delete-orphan")


class VerificationRecord(Base, TimestampMixin):
    __tablename__ = "verification_records"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    asset_id = Column(String(36), ForeignKey("official_assets.id", ondelete="CASCADE"), nullable=False, index=True)
    
    # Verification method: dns_txt or manual_review
    verification_method = Column(String(50), nullable=False)
    
    # Verification token or expected value
    verification_token = Column(String(255), nullable=False)
    expected_location = Column(String(1024), nullable=True)
    
    status = Column(String(50), default="pending", nullable=False)  # pending, verified, failed
    notes = Column(Text, nullable=True)
    verified_at = Column(String(50), nullable=True)

    asset = relationship("OfficialAsset", back_populates="verification_records")
