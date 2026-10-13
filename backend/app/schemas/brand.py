from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field


class OfficialAssetCreate(BaseModel):
    platform: str = Field(..., description="e.g. website, instagram, x, telegram, facebook")
    raw_identifier: str = Field(..., description="Handle or URL or domain")
    display_name: Optional[str] = None


class OfficialAssetResponse(BaseModel):
    id: str
    brand_id: str
    platform: str
    raw_identifier: str
    normalized_identifier: str
    url: Optional[str] = None
    display_name: Optional[str] = None
    verification_status: str
    is_verified: bool
    created_at: str

    class Config:
        from_attributes = True


class VerificationInitResponse(BaseModel):
    asset_id: str
    verification_method: str
    verification_token: str
    expected_location: str
    instructions: str


class BrandCreateRequest(BaseModel):
    name: str = Field(..., min_length=2, max_length=255)
    description: Optional[str] = None
    category: Optional[str] = "tech"
    logo_url: Optional[str] = None
    alternate_names: Optional[List[str]] = Field(default_factory=list)
    authorized_contact: Optional[Dict[str, Any]] = Field(default_factory=dict)
    initial_assets: Optional[List[OfficialAssetCreate]] = Field(default_factory=list)


class BrandResponse(BaseModel):
    id: str
    organization_id: str
    name: str
    slug: str
    description: Optional[str] = None
    category: Optional[str] = None
    logo_url: Optional[str] = None
    alternate_names: List[str] = []
    authorized_contact: Dict[str, Any] = {}
    is_active: bool
    official_assets: List[OfficialAssetResponse] = []
    created_at: str

    class Config:
        from_attributes = True
