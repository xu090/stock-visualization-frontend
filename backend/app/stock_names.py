import importlib.util
from pathlib import Path

from app.config import STOCK_NAME_MAPPING_FILE
from app.db import get_conn


def _load_mapping() -> dict[str, str]:
    mapping_path = Path(STOCK_NAME_MAPPING_FILE or "")
    if not mapping_path.exists():
        return {}

    spec = importlib.util.spec_from_file_location("external_stock_name_mapping", mapping_path)
    if spec is None or spec.loader is None:
        return {}

    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    mapping = getattr(module, "STOCK_NAME_MAPPING", {})
    if not isinstance(mapping, dict):
        return {}
    return {str(code): str(name).strip() for code, name in mapping.items()}


STOCK_NAME_MAPPING = _load_mapping()


def get_stock_name(code: str) -> str:
    return STOCK_NAME_MAPPING.get(str(code), str(code))


def backfill_stock_names() -> dict[str, int]:
    if not STOCK_NAME_MAPPING:
        return {"updated": 0}

    updated = 0
    with get_conn() as conn:
        with conn.cursor() as cur:
            for code, name in STOCK_NAME_MAPPING.items():
                cur.execute(
                    """
                    UPDATE stocks
                    SET name = %s,
                        updated_at = NOW()
                    WHERE code = %s
                      AND (name IS NULL OR name = '' OR name = code)
                    """,
                    (name, code),
                )
                updated += cur.rowcount or 0
        conn.commit()
    return {"updated": updated}
