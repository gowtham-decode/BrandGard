from sqlalchemy import Column, String, Boolean, ForeignKey, Index
from sqlalchemy.orm import relationship
from app.database import Base
from app.models.base import TimestampMixin, generate_uuid


class Organization(Base, TimestampMixin):
    __tablename__ = "organizations"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    name = Column(String(255), nullable=False, unique=True, index=True)
    slug = Column(String(255), nullable=False, unique=True, index=True)
    is_active = Column(Boolean, default=True, nullable=False)

    memberships = relationship("OrgMembership", back_populates="organization", cascade="all, delete-orphan")
    brands = relationship("Brand", back_populates="organization", cascade="all, delete-orphan")
    scans = relationship("ScanSubmission", back_populates="organization", cascade="all, delete-orphan")


class User(Base, TimestampMixin):
    __tablename__ = "users"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    email = Column(String(255), unique=True, nullable=False, index=True)
    hashed_password = Column(String(255), nullable=False)
    full_name = Column(String(255), nullable=True)
    role = Column(String(50), default="analyst", nullable=False)  # admin, analyst, viewer
    is_active = Column(Boolean, default=True, nullable=False)

    memberships = relationship("OrgMembership", back_populates="user", cascade="all, delete-orphan")
    reviews = relationship("AnalystReview", back_populates="analyst")
    audit_events = relationship("AuditEvent", back_populates="user")


class OrgMembership(Base, TimestampMixin):
    __tablename__ = "org_memberships"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    user_id = Column(String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    organization_id = Column(String(36), ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False, index=True)
    role = Column(String(50), default="member", nullable=False)  # owner, admin, member

    user = relationship("User", back_populates="memberships")
    organization = relationship("Organization", back_populates="memberships")

    __table_args__ = (
        Index("ix_org_user_unique", "organization_id", "user_id", unique=True),
    )
