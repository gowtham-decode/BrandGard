from typing import Optional, List, Dict, Any, Literal
from pydantic import AwareDatetime, BaseModel, Field


class SourceObservationRequest(BaseModel):
    source: Literal["apple_app_store_catalog"]
    source_url: str = Field(..., max_length=1024)
    record_id: str = Field(..., min_length=1, max_length=255)
    observed_at: AwareDatetime
    country: str = Field(default="us", min_length=2, max_length=2, pattern=r"^[a-zA-Z]{2}$")


class ScanCreateRequest(BaseModel):
    brand_id: Optional[str] = None
    brand_name: Optional[str] = None
    platform: str = Field(..., description="e.g. instagram, x, facebook, telegram, website")
    target_url: Optional[str] = None
    account_handle: Optional[str] = None
    display_name: Optional[str] = None
    profile_description: Optional[str] = None
    profile_image_url: Optional[str] = None
    additional_evidence: Optional[Dict[str, Any]] = Field(default_factory=dict)
    submission_source: Optional[str] = "dashboard"  # dashboard, extension, api
    source_observation: Optional[SourceObservationRequest] = None


class ScanProvenanceResponse(BaseModel):
    origin: str
    source_name: str
    collection_method: str
    source_url: Optional[str] = None
    source_record_id: Optional[str] = None
    source_observed_at: Optional[str] = None
    attribution_status: str
    received_at: Optional[str] = None


class EvidenceItemResponse(BaseModel):
    id: Optional[str] = None
    signal_name: str
    signal_type: str
    severity: str
    score_contribution: float
    title: str
    description: str
    supporting_data: Dict[str, Any] = {}

    class Config:
        from_attributes = True


class RiskAssessmentResponse(BaseModel):
    risk_score: float
    risk_category: str
    rule_score: float
    ml_score: Optional[float] = None
    is_insufficient_evidence: bool
    uncertainty_level: str
    summary_reason: str
    triggered_rules: List[Dict[str, Any]] = []
    recommended_actions: List[str] = []
    missing_evidence_notes: List[str] = []
    model_version: str
    assessed_at: Optional[str] = None

    class Config:
        from_attributes = True


class ScanReviewRequest(BaseModel):
    verdict: str = Field(..., description="confirmed_impersonation, legitimate_account, inconclusive, false_positive")
    notes: Optional[str] = None
    takedown_requested: Optional[bool] = False


class ScanFeedbackRequest(BaseModel):
    is_false_positive: bool
    comment: Optional[str] = None


class ScanResponse(BaseModel):
    id: str
    organization_id: str
    brand_id: Optional[str] = None
    brand_name: Optional[str] = None
    platform: str
    target_url: Optional[str] = None
    account_handle: Optional[str] = None
    display_name: Optional[str] = None
    profile_description: Optional[str] = None
    profile_image_url: Optional[str] = None
    submission_source: str
    status: str
    created_at: str
    risk_assessment: Optional[RiskAssessmentResponse] = None
    evidence_items: List[EvidenceItemResponse] = []
    extracted_features: Optional[Dict[str, Any]] = None
    source_provenance: Optional[ScanProvenanceResponse] = None

    class Config:
        from_attributes = True


class ScanListResponse(BaseModel):
    total: int
    items: List[ScanResponse]
