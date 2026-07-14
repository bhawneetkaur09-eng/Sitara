from typing import List

from pydantic import field_validator
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    # --- Environment ---
    # "development" relaxes cookie security so localhost (http) works.
    # Set to "production" to force Secure cookies.
    environment: str = "development"

    database_url: str = "sqlite:///./dev.db"

    # --- JWT ---
    jwt_secret: str = "sitara-dev-secret-change-in-production"
    # Short-lived access token (minutes) — carried in the Authorization header.
    access_token_expire_minutes: int = 15
    # Long-lived refresh token (days) — httpOnly cookie, rotated on every use.
    refresh_token_expire_days: int = 30

    port: int = 3001

    # --- CORS ---
    # Comma-separated list of allowed origins, e.g.
    # "https://app.sitara.in,https://sitara.in"
    cors_origins: List[str] = ["http://localhost:3000"]

    # --- Frontend (used for OAuth redirects back into the dashboard) ---
    frontend_url: str = "http://localhost:3000"

    # --- Integrations ---
    gemini_api_key: str = ""
    whatsapp_token: str = ""
    whatsapp_phone_number_id: str = ""
    whatsapp_verify_token: str = "sitara-dev-verify"

    # --- Google Business Profile (OAuth) ---
    google_client_id: str = ""
    google_client_secret: str = ""
    google_redirect_uri: str = ""
    # Fernet key used to encrypt stored refresh tokens at rest. Generate with:
    #   python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"
    integration_enc_key: str = "QNJSMkXKoTkccyagqX_ETWOJ_15LAXMMp6oVHxhq4vQ="

    model_config = {"env_file": ".env"}

    @field_validator("cors_origins", mode="before")
    @classmethod
    def _split_origins(cls, value):
        if isinstance(value, str):
            return [origin.strip() for origin in value.split(",") if origin.strip()]
        return value

    @property
    def is_production(self) -> bool:
        return self.environment.lower() == "production"

    @property
    def cookie_secure(self) -> bool:
        # Secure cookies require HTTPS; only enforce in production so local dev works.
        return self.is_production

    @property
    def cookie_samesite(self) -> str:
        # "none" is required for cross-site cookies (separate API domain) but only
        # valid alongside Secure=true, which we have in production.
        return "none" if self.is_production else "lax"

    def validate_for_production(self) -> None:
        """Fail fast on unsafe defaults when running in production."""
        if self.is_production and self.jwt_secret == "sitara-dev-secret-change-in-production":
            raise RuntimeError(
                "JWT_SECRET must be set to a strong, unique value in production. "
                "Refusing to start with the default development secret."
            )


settings = Settings()
settings.validate_for_production()
