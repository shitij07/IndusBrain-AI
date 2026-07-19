import logging
import time
from typing import Optional, Callable, TypeVar

import google.generativeai as genai

from app.config import get_settings
from app.services.api_key_manager import get_key_manager, APIKeyManager

logger = logging.getLogger(__name__)

T = TypeVar("T")

settings = get_settings()


class GeminiClientError(Exception):
    pass


class AllKeysExhaustedError(GeminiClientError):
    def __init__(self, last_error: Exception, attempts: int):
        self.last_error = last_error
        self.attempts = attempts
        super().__init__(
            f"All {attempts} API key(s) exhausted. Last error: {last_error}"
        )


class GeminiClient:
    def __init__(
        self,
        key_manager: Optional[APIKeyManager] = None,
        chat_model: Optional[str] = None,
        embedding_model: Optional[str] = None,
    ):
        self._key_manager = key_manager or get_key_manager()
        self._chat_model = chat_model or settings.GEMINI_CHAT_MODEL
        self._embedding_model = embedding_model or settings.EMBEDDING_MODEL

    def _assert_configured(self):
        if not self._key_manager.is_configured():
            raise GeminiClientError(
                "No Gemini API keys configured. "
                "Set GEMINI_API_KEY or GEMINI_API_KEYS in .env"
            )

    def generate_content(
        self,
        prompt: str,
        max_retries: Optional[int] = None,
    ) -> str:
        self._assert_configured()
        if max_retries is None:
            max_retries = max(self._key_manager.key_count, 1)

        last_error: Optional[Exception] = None

        for attempt in range(max_retries):
            key = self._key_manager.get_key()
            try:
                genai.configure(api_key=key)
                model = genai.GenerativeModel(self._chat_model)
                response = model.generate_content(prompt)
                self._key_manager.report_success(key)
                return response.text
            except Exception as e:
                self._key_manager.report_error(key, e)
                last_error = e
                logger.warning(
                    "Gemini call failed on key attempt %d/%d: %s",
                    attempt + 1, max_retries, e,
                )

        raise AllKeysExhaustedError(last_error, max_retries) from last_error

    def generate_content_with_response(
        self,
        prompt: str,
        max_retries: Optional[int] = None,
    ):
        self._assert_configured()
        if max_retries is None:
            max_retries = max(self._key_manager.key_count, 1)

        last_error: Optional[Exception] = None

        for attempt in range(max_retries):
            key = self._key_manager.get_key()
            try:
                genai.configure(api_key=key)
                model = genai.GenerativeModel(self._chat_model)
                response = model.generate_content(prompt)
                self._key_manager.report_success(key)
                return response
            except Exception as e:
                self._key_manager.report_error(key, e)
                last_error = e
                logger.warning(
                    "Gemini call (raw) failed on key attempt %d/%d: %s",
                    attempt + 1, max_retries, e,
                )

        raise AllKeysExhaustedError(last_error, max_retries) from last_error

    def embed_content(self, text: str) -> list[float]:
        self._assert_configured()

        key = self._key_manager.get_key()
        try:
            genai.configure(api_key=key)
            result = genai.embed_content(
                model=self._embedding_model,
                content=text,
            )
            self._key_manager.report_success(key)
            return result["embedding"]
        except Exception as e:
            self._key_manager.report_error(key, e)
            raise GeminiClientError(
                f"Embedding failed: {e}"
            ) from e

    @property
    def key_manager(self) -> APIKeyManager:
        return self._key_manager


_client_instance: Optional[GeminiClient] = None


def get_gemini_client() -> GeminiClient:
    global _client_instance
    if _client_instance is None:
        _client_instance = GeminiClient()
    return _client_instance
