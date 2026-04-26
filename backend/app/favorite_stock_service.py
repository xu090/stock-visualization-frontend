from datetime import datetime
from typing import Any

from app.db import get_conn
from app.stock_names import get_stock_name


def normalize_stock_code(raw: str | None) -> str:
    if raw is None:
        return ""
    text = str(raw).strip()
    if not text:
        return ""
    if "." in text:
        text = text.split(".")[0]
    if text[:2].lower() in {"sh", "sz", "bj"}:
        text = text[2:]
    return text


def _infer_market_code(code: str) -> str:
    if code.startswith(("6", "9")):
        return "SH"
    if code.startswith(("4", "8")):
        return "BJ"
    return "SZ"


def ensure_favorite_stocks_table() -> None:
    with get_conn() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                CREATE TABLE IF NOT EXISTS favorite_stocks (
                    stock_code VARCHAR(16) PRIMARY KEY,
                    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
                )
                """
            )
            cur.execute("ALTER TABLE favorite_stocks ADD COLUMN IF NOT EXISTS user_id BIGINT NULL")
            cur.execute(
                """
                DO $$
                BEGIN
                    IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'favorite_stocks_pkey') THEN
                        ALTER TABLE favorite_stocks DROP CONSTRAINT favorite_stocks_pkey;
                    END IF;
                END $$;
                """
            )
            cur.execute(
                """
                CREATE UNIQUE INDEX IF NOT EXISTS ux_favorite_stocks_user_code
                ON favorite_stocks (COALESCE(user_id, 0), stock_code)
                """
            )
            cur.execute(
                """
                CREATE INDEX IF NOT EXISTS idx_favorite_stocks_created_at
                ON favorite_stocks (created_at DESC)
                """
            )
        conn.commit()


def _ensure_stock_row(cur, code: str) -> None:
    cur.execute(
        """
        INSERT INTO stocks (code, name, market_code, is_active, created_at, updated_at)
        VALUES (%s, %s, %s, TRUE, NOW(), NOW())
        ON CONFLICT (code) DO UPDATE
        SET name = COALESCE(NULLIF(stocks.name, ''), EXCLUDED.name),
            market_code = COALESCE(NULLIF(stocks.market_code, ''), EXCLUDED.market_code),
            updated_at = NOW()
        """,
        (code, get_stock_name(code), _infer_market_code(code)),
    )


def _map_row(row: dict[str, Any]) -> dict[str, Any]:
    created_at = row.get("created_at")
    return {
        "code": row["stock_code"],
        "name": row.get("stock_name") or get_stock_name(row["stock_code"]),
        "createdAt": int(created_at.timestamp() * 1000) if isinstance(created_at, datetime) else None,
    }


def fetch_favorite_stocks(user_id: int | None = None) -> list[dict[str, Any]]:
    ensure_favorite_stocks_table()
    with get_conn() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT
                    fs.stock_code,
                    fs.created_at,
                    s.name AS stock_name
                FROM favorite_stocks fs
                LEFT JOIN stocks s ON s.code = fs.stock_code
                WHERE COALESCE(fs.user_id, 0) = COALESCE(%s, 0)
                ORDER BY fs.created_at ASC, fs.stock_code ASC
                """
                ,
                (user_id,),
            )
            rows = cur.fetchall()
    return [_map_row(row) for row in rows]


def add_favorite_stock(code: str, user_id: int | None = None) -> dict[str, Any]:
    normalized = normalize_stock_code(code)
    if not normalized:
        raise ValueError("stock code is required")

    ensure_favorite_stocks_table()
    with get_conn() as conn:
        with conn.cursor() as cur:
            _ensure_stock_row(cur, normalized)
            cur.execute(
                """
                INSERT INTO favorite_stocks (stock_code, user_id)
                VALUES (%s, %s)
                ON CONFLICT (COALESCE(user_id, 0), stock_code) DO UPDATE
                SET stock_code = EXCLUDED.stock_code
                RETURNING stock_code, created_at
                """,
                (normalized, user_id),
            )
            row = cur.fetchone()
            cur.execute("SELECT name AS stock_name FROM stocks WHERE code = %s", (normalized,))
            stock_row = cur.fetchone() or {}
        conn.commit()

    return _map_row({**row, **stock_row})


def remove_favorite_stock(code: str, user_id: int | None = None) -> bool:
    normalized = normalize_stock_code(code)
    if not normalized:
        return False

    ensure_favorite_stocks_table()
    with get_conn() as conn:
        with conn.cursor() as cur:
            cur.execute(
                "DELETE FROM favorite_stocks WHERE stock_code = %s AND COALESCE(user_id, 0) = COALESCE(%s, 0)",
                (normalized, user_id),
            )
            deleted = cur.rowcount > 0
        conn.commit()
    return deleted
