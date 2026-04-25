import importlib.util
from pathlib import Path
from typing import Any

from app.config import STOCK_MARKET_CAP_MAPPING_FILE


def _safe_num(value: Any, default: float | None = None) -> float | None:
    if value is None:
        return default
    try:
        return float(value)
    except (TypeError, ValueError):
        return default


def _normalize_code(raw: Any) -> str:
    if raw is None:
        return ""
    text = str(raw).strip()
    if not text:
        return ""
    if "." in text:
        text = text.split(".")[0]
    if text[:2].lower() in {"sh", "sz", "bj"}:
        text = text[2:]
    return text.zfill(6) if text.isdigit() and len(text) < 6 else text


def _load_mapping() -> dict[str, float]:
    mapping_path = Path(STOCK_MARKET_CAP_MAPPING_FILE or "")
    if not mapping_path.exists():
        return {}

    spec = importlib.util.spec_from_file_location("external_stock_market_cap_mapping", mapping_path)
    if spec is None or spec.loader is None:
        return {}

    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    mapping = getattr(module, "STOCK_MARKET_CAP_MAPPING", {})
    if not isinstance(mapping, dict):
        return {}

    normalized: dict[str, float] = {}
    for code, market_cap in mapping.items():
        normalized_code = _normalize_code(code)
        value = _safe_num(market_cap)
        if normalized_code and value is not None:
            normalized[normalized_code] = value
    return normalized


STOCK_MARKET_CAP_MAPPING = _load_mapping()


def get_stock_market_cap(code: str) -> float | None:
    return STOCK_MARKET_CAP_MAPPING.get(_normalize_code(code))
