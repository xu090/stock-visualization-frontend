from __future__ import annotations

import copy
import time
from threading import RLock
from typing import Any, Callable, TypeVar

T = TypeVar("T")


class TtlCache:
    def __init__(self, maxsize: int = 512) -> None:
        self.maxsize = maxsize
        self._items: dict[str, tuple[float, Any]] = {}
        self._lock = RLock()

    def get_or_set(self, key: str, ttl_seconds: int, factory: Callable[[], T]) -> T:
        now = time.monotonic()
        with self._lock:
            item = self._items.get(key)
            if item and item[0] > now:
                return copy.deepcopy(item[1])

        value = factory()
        expires_at = now + max(ttl_seconds, 1)
        with self._lock:
            if len(self._items) >= self.maxsize:
                self._evict_expired_or_oldest(now)
            self._items[key] = (expires_at, copy.deepcopy(value))
        return value

    def invalidate_prefix(self, prefix: str) -> None:
        with self._lock:
            for key in list(self._items):
                if key.startswith(prefix):
                    self._items.pop(key, None)

    def clear(self) -> None:
        with self._lock:
            self._items.clear()

    def _evict_expired_or_oldest(self, now: float) -> None:
        expired = [key for key, (expires_at, _) in self._items.items() if expires_at <= now]
        if expired:
            for key in expired:
                self._items.pop(key, None)
            return

        oldest_key = min(self._items, key=lambda key: self._items[key][0], default=None)
        if oldest_key is not None:
            self._items.pop(oldest_key, None)


app_cache = TtlCache()


def invalidate_concept_cache(concept_id: str | None = None) -> None:
    if concept_id:
        normalized = str(concept_id).strip()
        app_cache.invalidate_prefix(f"concept:stocks:{normalized}:")
        app_cache.invalidate_prefix(f"concept:analysis:{normalized}:")
        app_cache.invalidate_prefix(f"concept:profile:{normalized}:")
        app_cache.invalidate_prefix(f"concept:market-detail:{normalized}")
    else:
        app_cache.invalidate_prefix("concept:")
