"""Settings loaded from environment variables (.env in local dev)."""
from __future__ import annotations

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    google_generative_ai_api_key: str = ""
    chat_model: str = "gemini-flash-latest"
    embedding_model: str = "gemini-embedding-001"
    agent_api_key: str = ""
    rate_limit_per_minute: int = 30


settings = Settings()
