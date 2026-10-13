from sqlalchemy import Column, String, Text, ForeignKey, JSON
from sqlalchemy.orm import relationship
from app.database import Base
from app.models.base import TimestampMixin, generate_uuid


class AuditEvent(Base, TimestampMixin):
    __tablename__ = "audit_events"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    user_id = Column(String(36), ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True)
    organization_id = Column(String(36), nullable=True, index=True)
    
    action = Column(String(100), nullable=False, index=True)  # brand.created, scan.reviewed, asset.verified
    resource_type = Column(String(50), nullable=False)        # brand, asset, scan, user
    resource_id = Column(String(36), nullable=True)
    details = Column(JSON, default=dict, nullable=False)
    ip_address = Column(String(45), nullable=True)

    user = relationship("User", back_populates="audit_events")


class ModelVersionRecord(Base, TimestampMixin):
    __tablename__ = "model_versions"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    version = Column(String(100), unique=True, nullable=False)
    model_type = Column(String(50), nullable=False)  # random_forest, rule_engine, ensemble
    artifact_path = Column(String(1024), nullable=True)
    metrics = Column(JSON, default=dict, nullable=False)  # precision, recall, f1, pr_auc
    feature_schema_hash = Column(String(64), nullable=True)
    is_active = Column(String(10), default="true", nullable=False)
    description = Column(Text, nullable=True)
