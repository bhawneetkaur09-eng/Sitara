from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    database_url: str = "sqlite:///./dev.db"
    jwt_secret: str = "sitara-dev-secret-change-in-production"
    jwt_expiration_days: int = 7
    port: int = 3001
    gemini_api_key: str = ""
    whatsapp_token: str = ""
    whatsapp_phone_number_id: str = ""
    whatsapp_verify_token: str = "sitara-dev-verify"

    model_config = {"env_file": ".env"}


settings = Settings()
