from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    GEMINI_API_KEY: str
    GEMINI_LIVE_MODEL: str = "gemini-2.5-flash-native-audio-preview-12-2025"
    DATABASE_URL: str = "postgresql://postgres:postgres@localhost:5432/eduforge"
    REDIS_URL: str = "redis://localhost:6379"
    LIVEKIT_URL: str = "ws://localhost:7880"
    LIVEKIT_API_KEY: str = "devkey"
    LIVEKIT_API_SECRET: str = "devsecret"
    JWT_SECRET: str = "dev-secret-change-me"
    DATA_DIR: str = "../data"

    model_config = {"env_file": ".env", "env_file_encoding": "utf-8"}


settings = Settings()
