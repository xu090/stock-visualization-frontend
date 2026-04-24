from __future__ import annotations

from app.db import get_conn


def _table_columns(table_name: str) -> set[str]:
    with get_conn() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT column_name
                FROM information_schema.columns
                WHERE table_schema = 'public'
                  AND table_name = %s
                """,
                (table_name,),
            )
            return {row["column_name"] for row in cur.fetchall()}


def _index_exists(index_name: str) -> bool:
    with get_conn() as conn:
        with conn.cursor() as cur:
            cur.execute("SELECT to_regclass(%s) AS regclass", (f"public.{index_name}",))
            row = cur.fetchone()
            return bool(row and row["regclass"])


def _create_index_concurrently(index_name: str, sql: str) -> tuple[bool, str | None]:
    if _index_exists(index_name):
        return False, None

    try:
        with get_conn(autocommit=True) as conn:
            with conn.cursor() as cur:
                cur.execute(sql)
    except Exception as exc:
        return False, str(exc)
    return True, None


def ensure_query_indexes() -> dict[str, list[str]]:
    created: list[str] = []
    skipped: list[str] = []

    stock_columns = _table_columns("stock_time_sharing")
    if {"stock_code", "ts"}.issubset(stock_columns):
        indexes = [
            (
                "idx_stock_time_sharing_stock_code_ts_desc",
                """
                CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_stock_time_sharing_stock_code_ts_desc
                ON stock_time_sharing (stock_code, ts DESC)
                """,
            ),
            (
                "idx_stock_time_sharing_stock_code_day_ts_desc",
                """
                CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_stock_time_sharing_stock_code_day_ts_desc
                ON stock_time_sharing (stock_code, (ts::date), ts DESC)
                """,
            ),
            (
                "idx_stock_time_sharing_ts_desc",
                """
                CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_stock_time_sharing_ts_desc
                ON stock_time_sharing (ts DESC)
                """,
            ),
        ]
    elif {"code", "timestamps"}.issubset(stock_columns):
        indexes = [
            (
                "idx_stock_time_sharing_code_timestamps_desc",
                """
                CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_stock_time_sharing_code_timestamps_desc
                ON stock_time_sharing (code, timestamps DESC)
                """,
            ),
            (
                "idx_stock_time_sharing_code_day_timestamps_desc",
                """
                CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_stock_time_sharing_code_day_timestamps_desc
                ON stock_time_sharing (code, (timestamps::date), timestamps DESC)
                """,
            ),
            (
                "idx_stock_time_sharing_timestamps_desc",
                """
                CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_stock_time_sharing_timestamps_desc
                ON stock_time_sharing (timestamps DESC)
                """,
            ),
        ]
    else:
        indexes = []
        skipped.append("stock_time_sharing: unsupported columns")

    concept_columns = _table_columns("concept_stocks")
    if {"concept_id", "stock_code"}.issubset(concept_columns):
        indexes.extend(
            [
                (
                    "idx_concept_stocks_concept_stock",
                    """
                    CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_concept_stocks_concept_stock
                    ON concept_stocks (concept_id, stock_code)
                    """,
                ),
                (
                    "idx_concept_stocks_stock_concept",
                    """
                    CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_concept_stocks_stock_concept
                    ON concept_stocks (stock_code, concept_id)
                    """,
                ),
            ]
        )
    else:
        skipped.append("concept_stocks: unsupported columns")

    for index_name, sql in indexes:
        created_index, error = _create_index_concurrently(index_name, sql)
        if created_index:
            created.append(index_name)
        elif error:
            skipped.append(f"{index_name}: {error}")
        else:
            skipped.append(index_name)

    return {"created": created, "skipped": skipped}
