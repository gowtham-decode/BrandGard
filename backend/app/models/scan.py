from sqlalchemy import Column, String, Text, Boolean, Float, ForeignKey, Index, JSON
from sqlalchemy.orm import relationship
from app.database import Base
from app.models.base import TimestampMixin, generate_uuid


class ScanSubmission(Base, TimestampMixin):
    __tablename__ = "scan_submissions"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    organization_id = Column(String(36), ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False, index=True)
    brand_id = Column(String(36), ForeignKey("brands.id", ondelete="SET NULL"), nullable=True, index=True)
    
    # Target details
    platform = Column(String(50), nullable=False, index=True)  # instagram, x, telegram, website, etc.
    target_url = Column(String(1024), nullable=True)
    account_handle = Column(String(255), nullable=True, index=True)
    display_name = Column(String(255), nullable=True)
    profile_description = Column(Text, nullable=True)
    profile_image_url = Column(String(1024), nullable=True)
    
    # Raw submitted evidence from user
    additional_evidence = Column(JSON, default=dict, nullable=False)
    submission_source = Column(String(50), default="dashboard", nullable=False)  # dashboard, extension, api

    # Status: pending, analyzing, completed, review_pending, resolved, failed
    status = Column(String(50), default="completed", nullable=False, index=True)

    # Relationships
    organization = relationship("Organization", back_populates="scans")
    brand = relationship("Brand", back_populates="scans")
    extracted_features = relationship("ExtractedFeatures", uselist=False, back_populates="scan", cascade="all, delete-orphan")
    risk_assessment = relationship("RiskAssessment", uselist=False, back_populates="scan", cascade="all, delete-orphan")
    evidence_items = relationship("EvidenceItem", back_populates="scan", cascade="all, delete-orphan")
    analyst_reviews = relationship("AnalystReview", back_populates="scan", cascade="all, delete-orphan")
    feedbacks = relationship("ScanFeedback", back_populates="scan", cascade="all, delete-orphan")
    provenance = relationship("ScanProvenance", uselist=False, back_populates="scan", cascade="all, delete-orphan")


class ScanProvenance(Base, TimestampMixin):
    __tablename__ = "scan_provenance"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    scan_id = Column(String(36), ForeignKey("scan_submissions.id", ondelete="CASCADE"), nullable=False, unique=True, index=True)
    origin = Column(String(50), nullable=False)
    source_name = Column(String(100), nullable=False)
    collection_method = Column(String(100), nullable=False)
    source_url = Column(String(1024), nullable=True)
    source_record_id = Column(String(255), nullable=True)
    source_observed_at = Column(String(50), nullable=True)
    attribution_status = Column(String(50), nullable=False)
    details = Column(JSON, default=dict, nullable=False)

    scan = relationship("ScanSubmission", back_populates="provenance")


class ExtractedFeatures(Base, TimestampMixin):
    __tablename__ = "extracted_features"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    scan_id = Column(String(36), ForeignKey("scan_submissions.id", ondelete="CASCADE"), nullable=False, unique=True, index=True)
    
    feature_version = Column(String(50), default="1.0.0", nullable=False)
    features = Column(JSON, default=dict, nullable=False)
    missing_features = Column(JSON, default=list, nullable=False)
    evidence_completeness_ratio = Column(Float, default=1.0, nullable=False)

    scan = relationship("ScanSubmission", back_populates="extracted_features")


class RiskAssessment(Base, TimestampMixin):
    __tablename__ = "risk_assessments"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    scan_id = Column(String(36), ForeignKey("scan_submissions.id", ondelete="CASCADE"), nullable=False, unique=True, index=True)
    
    risk_score = Column(Float, nullable=False, index=True)  # 0.0 to 100.0
    risk_category = Column(String(50), nullable=False, index=True)  # Low, Medium, High, Critical
    
    rule_score = Column(Float, nullable=False)
    ml_score = Column(Float, nullable=True)  # Calibrated model probability or score
    
    is_insufficient_evidence = Column(Boolean, default=False, nullable=False)
    uncertainty_level = Column(String(50), default="low", nullable=False)  # low, medium, high
    
    summary_reason = Column(Text, nullable=False)
    triggered_rules = Column(JSON, default=list, nullable=False)
    recommended_actions = Column(JSON, default=list, nullable=False)
    missing_evidence_notes = Column(JSON, default=list, nullable=False)
    
    model_version = Column(String(100), default="rule_engine_v1", nullable=False)

    scan = relationship("ScanSubmission", back_populates="risk_assessment")


class EvidenceItem(Base, TimestampMixin):
    __tablename__ = "evidence_items"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    scan_id = Column(String(36), ForeignKey("scan_submissions.id", ondelete="CASCADE"), nullable=False, index=True)
    
    signal_name = Column(String(100), nullable=False)
    signal_type = Column(String(50), nullable=False)  # similarity, domain, content, behavioral, rule
    severity = Column(String(50), default="info", nullable=False)  # info, low, medium, high, critical
    score_contribution = Column(Float, default=0.0, nullable=False)
    title = Column(String(255), nullable=False)
    description = Column(Text, nullable=False)
    supporting_data = Column(JSON, default=dict, nullable=False)

    scan = relationship("ScanSubmission", back_populates="evidence_items")


class AnalystReview(Base, TimestampMixin):
    __tablename__ = "analyst_reviews"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    scan_id = Column(String(36), ForeignKey("scan_submissions.id", ondelete="CASCADE"), nullable=False, index=True)
    analyst_id = Column(String(36), ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True)
    
    # Verdict: confirmed_impersonation, legitimate_account, inconclusive, false_positive
    verdict = Column(String(50), nullable=False, index=True)
    notes = Column(Text, nullable=True)
    takedown_requested = Column(Boolean, default=False, nullable=False)

    scan = relationship("ScanSubmission", back_populates="analyst_reviews")
    analyst = relationship("User", back_populates="reviews")


class ScanFeedback(Base, TimestampMixin):
    __tablename__ = "scan_feedbacks"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    scan_id = Column(String(36), ForeignKey("scan_submissions.id", ondelete="CASCADE"), nullable=False, index=True)
    user_id = Column(String(36), nullable=True)
    
    is_false_positive = Column(Boolean, default=False, nullable=False)
    comment = Column(Text, nullable=True)

    scan = relationship("ScanSubmission", back_populates="feedbacks")
