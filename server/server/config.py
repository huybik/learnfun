from pathlib import Path

from pydantic_settings import BaseSettings

_ROOT_DIR = Path(__file__).resolve().parent.parent.parent


class Settings(BaseSettings):
    GEMINI_API_KEY: str
    GEMINI_LIVE_MODEL: str = "gemini-2.5-flash-native-audio-preview-12-2025"
    GEMINI_AFFECTIVE_DIALOG: bool = True
    GEMINI_PROACTIVE_AUDIO: bool = True
    DATABASE_URL: str = "postgresql://postgres:postgres@localhost:5432/learnfun"
    REDIS_URL: str = "redis://localhost:6379"
    LIVEKIT_URL: str = "ws://localhost:7880"
    LIVEKIT_API_KEY: str = "devkey"
    LIVEKIT_API_SECRET: str = "devsecret"
    JWT_SECRET: str = "dev-secret-change-me"
    DATA_DIR: str = str(_ROOT_DIR / "data")

    model_config = {"env_file": str(_ROOT_DIR / ".env"), "env_file_encoding": "utf-8", "extra": "ignore"}


settings = Settings()
