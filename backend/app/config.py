import os
from typing import List, Union
from pydantic_settings import BaseSettings
from pydantic import Field, field_validator


class Settings(BaseSettings):
    PROJECT_NAME: str = "BrandGuard AI Digital Risk Protection"
    VERSION: str = "1.0.0"
    ENVIRONMENT: str = "development"
    DEBUG: bool = True
    API_V1_STR: str = "/api/v1"

    # Database
    DATABASE_URL: str = "sqlite:///./brandguard.db"

    # Security
    SECRET_KEY: str = "brandguard-dev-super-secret-key-change-in-production-at-least-32-chars"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 1440
    DEMO_ADMIN_PASSWORD: str | None = None

    # CORS
    CORS_ORIGINS: Union[List[str], str] = ["*"]

    # Rate limiting
    RATE_LIMIT_PER_MINUTE: int = 60

    # ML Model path
    MODEL_PATH: str = "ml/models/baseline_rf_v1.json"
    MODEL_VERSION: str = "1.1.0-numpy-logistic"

    # Platforms supported
    SUPPORTED_PLATFORMS: List[str] = [
        "instagram",
        "facebook",
        "x",
        "twitter",
        "telegram",
        "website"
    ]

    @field_validator("CORS_ORIGINS", mode="before")
    @classmethod
    def assemble_cors_origins(cls, v):
        if isinstance(v, str) and not v.startswith("["):
            return [i.strip() for i in v.split(",")]
        elif isinstance(v, (list, str)):
            return v
        return ["*"]

    class Config:
        env_file = ".env"
        extra = "ignore"


settings = Settings()
