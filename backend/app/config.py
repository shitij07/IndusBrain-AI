from pathlib import Path
from pydantic_settings import BaseSettings
from functools import lru_cache
import os

def _find_env_file() -> str:
    candidates = [
        Path(".env"),
        Path(__file__).parent.parent / ".env",
        Path(__file__).parent.parent.parent / ".env",
    ]
    for p in candidates:
        if p.exists():
            return str(p.resolve())
    return ".env"

class Settings(BaseSettings):
    DATABASE_URL: str = "postgresql://indusbrain:indusbrain@localhost:5432/indusbrain"
    SECRET_KEY: str = "default-secret-key"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    DEBUG: bool = True
    UPLOAD_DIR: str = "uploads"
    MAX_UPLOAD_SIZE_MB: int = 50
    GEMINI_API_KEY: str = ""
    CHROMA_PERSIST_DIR: str = "chroma_data"
    CHROMA_COLLECTION_NAME: str = "indusbrain_docs"
    CHUNK_SIZE: int = 1000
    CHUNK_OVERLAP: int = 200
    EMBEDDING_MODEL: str = "models/gemini-embedding-001"
    GEMINI_CHAT_MODEL: str = "models/gemini-2.5-flash"
    NEO4J_URI: str = "bolt://localhost:7687"
    NEO4J_USER: str = "neo4j"
    NEO4J_PASSWORD: str = "indusbrain"
    ADMIN_EMAIL: str = "admin@indusbrain.com"
    ADMIN_PASSWORD: str = "admin123"
    ADMIN_NAME: str = "Admin"

    class Config:
        env_file = _find_env_file()
        env_file_encoding = "utf-8"
        extra = "ignore"

@lru_cache()
def get_settings() -> Settings:
    return Settings()
