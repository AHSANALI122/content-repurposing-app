"""Application settings, loaded from the environment / `.env`."""
from __future__ import annotations

from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env", env_file_encoding="utf-8", extra="ignore"
    )

    # Database
    database_url: str

    # Auth / JWT
    jwt_secret: str
    jwt_algorithm: str = "HS256"
    access_token_expire_minutes: int = 60 * 24  # 24h

    # LLM — OpenAI SDK pointed at Gemini's OpenAI-compatible endpoint.
    # Swap provider/model via env only; the client is built in llm_client.py.
    llm_api_key: str
    llm_base_url: str = "https://generativelanguage.googleapis.com/v1beta/openai/"
    llm_model: str = "gemini-2.5-flash"

    # CORS — comma-separated list of allowed frontend origins
    frontend_origins: str = ""

    @property
    def cors_origins(self) -> list[str]:
        """Parse FRONTEND_ORIGINS into a clean allow-list."""
        return [o.strip() for o in self.frontend_origins.split(",") if o.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()  # type: ignore[call-arg]


settings = get_settings()
