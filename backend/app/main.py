import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.config import settings
from app.database import engine, Base, SessionLocal
from app.models import (
    User, Organization, OrgMembership, Brand, OfficialAsset
)
from app.core.security import hash_password
from app.api.v1 import api_v1_router

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s"
)
logger = logging.getLogger("brandguard")


def seed_default_data():
    """Initializes tables and seeds the reference brand and optional demo analyst."""
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        # Check if default org exists
        demo_org = db.query(Organization).filter(Organization.slug == "brandguard-hq").first()
        if not demo_org:
            logger.info("Seeding initial BrandGuard organization...")
            demo_org = Organization(
                name="BrandGuard Global",
                slug="brandguard-hq"
            )
            db.add(demo_org)
            db.flush()

            if settings.DEMO_ADMIN_PASSWORD:
                admin_user = User(
                    email="security@brandguard.io",
                    hashed_password=hash_password(settings.DEMO_ADMIN_PASSWORD),
                    full_name="Chief Security Analyst",
                    role="admin"
                )
                db.add(admin_user)
                db.flush()

                membership = OrgMembership(
                    user_id=admin_user.id,
                    organization_id=demo_org.id,
                    role="owner"
                )
                db.add(membership)

            # Seed BrandGuard reference brand
            brand = Brand(
                organization_id=demo_org.id,
                name="BrandGuard",
                slug="brandguard",
                description="AI-Powered Digital Risk Protection Platform",
                category="cybersecurity",
                alternate_names=["BrandGuard AI", "Brand Guard"],
                authorized_contact={"email": "security@brandguard.io", "team": "SOC"}
            )
            db.add(brand)
            db.flush()

            # Seed official assets for BrandGuard
            assets = [
                OfficialAsset(
                    brand_id=brand.id,
                    platform="website",
                    raw_identifier="https://brandguard.io",
                    normalized_identifier="brandguard.io",
                    url="https://brandguard.io",
                    display_name="Official Website",
                    verification_status="verified",
                    is_verified=True
                ),
                OfficialAsset(
                    brand_id=brand.id,
                    platform="x",
                    raw_identifier="@brandguard_sec",
                    normalized_identifier="brandguard_sec",
                    url="https://x.com/brandguard_sec",
                    display_name="BrandGuard Security",
                    verification_status="verified",
                    is_verified=True
                ),
                OfficialAsset(
                    brand_id=brand.id,
                    platform="instagram",
                    raw_identifier="brandguard.official",
                    normalized_identifier="brandguard.official",
                    url="https://instagram.com/brandguard.official",
                    display_name="BrandGuard Instagram",
                    verification_status="verified",
                    is_verified=True
                ),
            ]
            db.add_all(assets)
            db.commit()
            logger.info("Seed data initialized successfully.")
    except Exception as exc:
        logger.error(f"Error during initial seed: {exc}")
        db.rollback()
    finally:
        db.close()


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup:
    logger.info(f"Starting {settings.PROJECT_NAME} v{settings.VERSION}")
    seed_default_data()
    yield
    # Shutdown:
    logger.info("Shutting down BrandGuard backend service.")


app = FastAPI(
    title=settings.PROJECT_NAME,
    version=settings.VERSION,
    description="Production-oriented AI Digital Risk Protection backend for impersonation detection.",
    docs_url="/docs",
    redoc_url="/redoc",
    openapi_url="/api/v1/openapi.json",
    lifespan=lifespan
)

# CORS middleware configuration
origins = settings.CORS_ORIGINS
if isinstance(origins, str):
    origins = [origins]

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"] if "*" in origins else origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.middleware("http")
async def audit_logging_middleware(request: Request, call_next):
    # Simple structured access logger
    response = await call_next(request)
    logger.info(f"{request.method} {request.url.path} - Status: {response.status_code}")
    return response


@app.exception_handler(Exception)
async def generic_exception_handler(request: Request, exc: Exception):
    logger.error(f"Unhandled exception on {request.url.path}: {exc}", exc_info=True)
    return JSONResponse(
        status_code=500,
        content={"detail": "An internal server error occurred. Please consult backend logs."}
    )

from pathlib import Path
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse

STATIC_DIR = Path(__file__).resolve().parent / "static"
if STATIC_DIR.exists():
    app.mount("/static", StaticFiles(directory=str(STATIC_DIR)), name="static")

# Include API v1 router
app.include_router(api_v1_router, prefix=settings.API_V1_STR)


@app.get("/", include_in_schema=False)
@app.get("/dashboard", include_in_schema=False)
def serve_dashboard():
    index_file = STATIC_DIR / "index.html"
    if index_file.exists():
        return FileResponse(index_file)
    return {
        "service": settings.PROJECT_NAME,
        "version": settings.VERSION,
        "api_docs": "/docs",
        "health_check": f"{settings.API_V1_STR}/health"
    }


@app.get("/api")
def api_info():
    return {
        "service": settings.PROJECT_NAME,
        "version": settings.VERSION,
        "api_docs": "/docs",
        "health_check": f"{settings.API_V1_STR}/health"
    }
