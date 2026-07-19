import enum
import threading
import time
import os
from dataclasses import dataclass, field
from typing import Optional

from app.config import get_settings


class APIKeyState(enum.Enum):
    ACTIVE = "active"
    RATE_LIMITED = "rate_limited"
    QUOTA_EXHAUSTED = "quota_exhausted"
    ERROR = "error"


COOLDOWN_SECONDS = {
    APIKeyState.RATE_LIMITED: 60,
    APIKeyState.QUOTA_EXHAUSTED: 3600,
    APIKeyState.ERROR: 30,
}


@dataclass
class APIKeySlot:
    key: str
    state: APIKeyState = APIKeyState.ACTIVE
    cooldown_until: float = 0.0
    total_calls: int = 0
    failed_calls: int = 0
    consecutive_failures: int = 0
    last_error: str = ""


def _resolve_keys() -> list[str]:
    settings = get_settings()
    keys: list[str] = []

    raw = getattr(settings, "GEMINI_API_KEYS", "") or os.getenv("GEMINI_API_KEYS", "")
    if raw:
        keys.extend(k.strip() for k in raw.split(",") if k.strip())

    single = settings.GEMINI_API_KEY or os.getenv("GEMINI_API_KEY", "") or os.getenv("GOOGLE_API_KEY", "")
    if single and single not in keys:
        keys.insert(0, single)

    return keys


class APIKeyManager:
    def __init__(self, keys: Optional[list[str]] = None):
        resolved = keys if keys is not None else _resolve_keys()
        if not resolved:
            resolved = []
        self._lock = threading.RLock()
        self._keys = [APIKeySlot(key=k) for k in resolved]
        self._index = 0

    @property
    def key_count(self) -> int:
        return len(self._keys)

    def is_configured(self) -> bool:
        return len(self._keys) > 0

    def get_key(self) -> str:
        with self._lock:
            if not self._keys:
                raise RuntimeError(
                    "No Gemini API keys configured. "
                    "Set GEMINI_API_KEY or GEMINI_API_KEYS in .env"
                )
            now = time.time()
            for _ in range(len(self._keys)):
                slot = self._keys[self._index]
                self._index = (self._index + 1) % len(self._keys)
                if slot.state == APIKeyState.ACTIVE or now >= slot.cooldown_until:
                    if slot.state != APIKeyState.ACTIVE:
                        slot.state = APIKeyState.ACTIVE
                        slot.cooldown_until = 0.0
                    slot.total_calls += 1
                    return slot.key
            min_cooldown = min(s.cooldown_until for s in self._keys)
            retry_after = max(0.0, min_cooldown - now)
            raise RuntimeError(
                f"All {len(self._keys)} API key(s) are in cooldown. "
                f"Next key available in {retry_after:.0f}s. "
                "Set additional keys via GEMINI_API_KEYS in .env"
            )

    def report_success(self, key: str):
        with self._lock:
            for slot in self._keys:
                if slot.key == key:
                    slot.consecutive_failures = 0
                    slot.state = APIKeyState.ACTIVE
                    slot.cooldown_until = 0.0
                    break

    def report_error(self, key: str, error: Exception):
        with self._lock:
            err_str = str(error)
            for slot in self._keys:
                if slot.key == key:
                    slot.failed_calls += 1
                    slot.consecutive_failures += 1
                    slot.last_error = err_str
                    if "429" in err_str or "RESOURCE_EXHAUSTED" in err_str or "quota" in err_str.lower():
                        if "quota" in err_str.lower() or "exhausted" in err_str.lower():
                            slot.state = APIKeyState.QUOTA_EXHAUSTED
                            slot.cooldown_until = time.time() + COOLDOWN_SECONDS[APIKeyState.QUOTA_EXHAUSTED]
                        else:
                            slot.state = APIKeyState.RATE_LIMITED
                            slot.cooldown_until = time.time() + COOLDOWN_SECONDS[APIKeyState.RATE_LIMITED]
                    else:
                        slot.state = APIKeyState.ERROR
                        slot.cooldown_until = time.time() + COOLDOWN_SECONDS[APIKeyState.ERROR]
                    break

    def report_error_type(self, key: str, error_type: str):
        with self._lock:
            for slot in self._keys:
                if slot.key == key:
                    slot.failed_calls += 1
                    slot.consecutive_failures += 1
                    slot.last_error = error_type
                    if error_type in ("rate_limited", "quota_exhausted"):
                        state = APIKeyState.RATE_LIMITED if error_type == "rate_limited" else APIKeyState.QUOTA_EXHAUSTED
                        slot.state = state
                        slot.cooldown_until = time.time() + COOLDOWN_SECONDS[state]
                    else:
                        slot.state = APIKeyState.ERROR
                        slot.cooldown_until = time.time() + COOLDOWN_SECONDS[APIKeyState.ERROR]
                    break

    def get_stats(self) -> dict:
        with self._lock:
            now = time.time()
            return {
                "total_keys": len(self._keys),
                "keys": [
                    {
                        "key_masked": (
                            k.key[:8] + "..." + k.key[-4:]
                            if len(k.key) > 12
                            else "***"
                        ),
                        "state": k.state.value,
                        "total_calls": k.total_calls,
                        "failed_calls": k.failed_calls,
                        "consecutive_failures": k.consecutive_failures,
                        "last_error": k.last_error,
                        "cooldown_remaining": round(max(0.0, k.cooldown_until - now), 1),
                    }
                    for k in self._keys
                ],
                "active_count": sum(
                    1 for k in self._keys
                    if k.state == APIKeyState.ACTIVE or now >= k.cooldown_until
                ),
            }


_manager_instance: Optional[APIKeyManager] = None
_manager_lock = threading.Lock()


def get_key_manager() -> APIKeyManager:
    global _manager_instance
    if _manager_instance is None:
        with _manager_lock:
            if _manager_instance is None:
                _manager_instance = APIKeyManager()
    return _manager_instance
