import uuid
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.database import get_db
from app.models.user import User, Organization, OrgMembership
from app.core.security import (
    hash_password,
    verify_password,
    create_access_token,
    get_current_user,
)
from app.schemas.auth import (
    UserRegisterRequest,
    UserLoginRequest,
    TokenResponse,
    UserResponse,
)

router = APIRouter(prefix="/auth", tags=["Authentication"])


@router.post("/register", response_model=TokenResponse, status_code=status.HTTP_201_CREATED)
def register_user(req: UserRegisterRequest, db: Session = Depends(get_db)):
    # Check if user already exists
    existing = db.query(User).filter(User.email == req.email.lower().strip()).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="A user with this email address already exists."
        )

    # Every self-serve registration starts a private workspace. Organization
    # names are labels, not invitations to join an existing tenant.
    org_name = req.organization_name or f"{req.email.split('@')[0].capitalize()}'s Team"
    if db.query(Organization).filter(Organization.name == org_name).first():
        org_name = f"{org_name[:220]} ({uuid.uuid4().hex[:8]})"
    slug_base = "-".join(
        segment for segment in "".join(
            char.lower() if char.isalnum() else "-" for char in org_name
        ).split("-") if segment
    )[:230]
    slug = f"{slug_base or 'workspace'}-{uuid.uuid4().hex[:8]}"
    org = Organization(name=org_name, slug=slug)
    db.add(org)
    db.flush()

    # Create user
    user = User(
        email=req.email.lower().strip(),
        hashed_password=hash_password(req.password),
        full_name=req.full_name or req.email.split("@")[0],
        role="admin"
    )
    db.add(user)
    db.flush()

    # Create membership
    membership = OrgMembership(
        user_id=user.id,
        organization_id=org.id,
        role="owner"
    )
    db.add(membership)
    db.commit()
    db.refresh(user)

    token = create_access_token(user.id)
    return TokenResponse(
        access_token=token,
        token_type="bearer",
        user_id=user.id,
        email=user.email,
        organization_id=org.id
    )


@router.post("/login", response_model=TokenResponse)
def login_user(req: UserLoginRequest, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == req.email.lower().strip()).first()
    if not user or not verify_password(req.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password."
        )

    membership = db.query(OrgMembership).filter(OrgMembership.user_id == user.id).first()
    org_id = membership.organization_id if membership else None

    token = create_access_token(user.id)
    return TokenResponse(
        access_token=token,
        token_type="bearer",
        user_id=user.id,
        email=user.email,
        organization_id=org_id
    )


@router.get("/me", response_model=UserResponse)
def get_current_user_profile(user: User = Depends(get_current_user)):
    return UserResponse(
        id=user.id,
        email=user.email,
        full_name=user.full_name,
        role=user.role,
        is_active=user.is_active,
        created_at=user.created_at.isoformat() if user.created_at else ""
    )
