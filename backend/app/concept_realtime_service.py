from __future__ import annotations

from datetime import datetime
from typing import Any

from app.concept_service import fetch_concept_profile
from app.db import get_conn


def _safe_num(value: Any, default: float = 0.0) -> float:
    if value is None:
        return default
    try:
        return float(value)
    except (TypeError, ValueError):
        return default


def _fetch_concept_aggregate_rows(concept_ids: list[str] | None = None) -> list[dict]:
    sql = """
        WITH latest_concept_minute AS (
            SELECT
                cs.concept_id,
                MAX(st.ts) AS latest_ts
            FROM concept_stocks cs
            JOIN stock_time_sharing_compat st ON st.stock_code = cs.stock_code
            WHERE st.ts <= NOW()
            GROUP BY cs.concept_id
        ),
        latest_stock_before_anchor AS (
            SELECT DISTINCT ON (cs.concept_id, cs.stock_code)
                cs.concept_id,
                cs.stock_code,
                st.ts,
                st.open,
                st.close,
                st.high,
                st.low,
                st.previous_close,
                st.vol,
                st.amount,
                st.tor,
                st.udz
            FROM concept_stocks cs
            JOIN latest_concept_minute lcm ON lcm.concept_id = cs.concept_id
            JOIN stock_time_sharing_compat st
              ON st.stock_code = cs.stock_code
             AND st.ts <= lcm.latest_ts
             AND st.ts::date = lcm.latest_ts::date
            ORDER BY cs.concept_id, cs.stock_code, st.ts DESC
        )
        SELECT
            c.id,
            c.name,
            c.description,
            c.algorithm,
            c.editable,
            c.favorite,
            c.source,
            ARRAY_AGG(cs.stock_code ORDER BY cs.sort_order ASC, cs.stock_code ASC)
                FILTER (WHERE cs.stock_code IS NOT NULL) AS stock_codes,
            COUNT(cs.stock_code) AS stock_count,
            COUNT(lsa.stock_code) AS active_stock_count,
            AVG(lsa.open) AS open,
            AVG(lsa.close) AS close,
            AVG(lsa.high) AS high,
            AVG(lsa.low) AS low,
            AVG(lsa.previous_close) AS pre_close,
            COALESCE(SUM(lsa.vol), 0) AS volume,
            COALESCE(SUM(lsa.amount), 0) AS amount,
            AVG(lsa.tor) AS turnover,
            AVG(lsa.udz) AS volatility,
            SUM(CASE WHEN lsa.close > lsa.previous_close THEN 1 ELSE 0 END)::float / NULLIF(COUNT(lsa.stock_code), 0) AS up_ratio,
            SUM(CASE WHEN lsa.close > lsa.previous_close THEN 1 ELSE 0 END) AS up_count,
            SUM(CASE WHEN lsa.close < lsa.previous_close THEN 1 ELSE 0 END) AS down_count,
            SUM(CASE WHEN lsa.close >= lsa.previous_close * 1.098 THEN 1 ELSE 0 END) AS limit_up,
            SUM(CASE WHEN lsa.close <= lsa.previous_close * 0.902 THEN 1 ELSE 0 END) AS limit_down,
            MAX(lcm.latest_ts) AS latest_ts
        FROM concepts c
        LEFT JOIN concept_stocks cs ON cs.concept_id = c.id
        LEFT JOIN latest_concept_minute lcm ON lcm.concept_id = c.id
        LEFT JOIN latest_stock_before_anchor lsa
            ON lsa.concept_id = c.id
           AND lsa.stock_code = cs.stock_code
        WHERE (%s::text[] IS NULL OR c.id = ANY(%s::text[]))
        GROUP BY c.id, c.name, c.description, c.algorithm, c.editable, c.favorite, c.source
        ORDER BY c.favorite DESC, c.editable ASC, c.name ASC
    """
    ids = concept_ids if concept_ids else None
    with get_conn() as conn:
        with conn.cursor() as cur:
            cur.execute(sql, (ids, ids))
            return cur.fetchall()


def _build_concept_snapshot(row: dict) -> dict:
    open_price = _safe_num(row.get("open"), 0.0)
    close_price = _safe_num(row.get("close"), 0.0)
    high_price = _safe_num(row.get("high"), close_price)
    low_price = _safe_num(row.get("low"), close_price)
    pre_close = _safe_num(row.get("pre_close"), close_price)
    volume = _safe_num(row.get("volume"), 0.0)
    amount = _safe_num(row.get("amount"), 0.0)
    turnover = _safe_num(row.get("turnover"), 0.0)
    up_ratio = _safe_num(row.get("up_ratio"), 0.0)
    latest_ts = int(row["latest_ts"].timestamp() * 1000) if row.get("latest_ts") else None
    updated_at = int(datetime.now().timestamp() * 1000)

    change_amount = round(close_price - pre_close, 2)
    change = round(((close_price - pre_close) / pre_close) * 100, 2) if pre_close else 0.0
    return {
        "id": row["id"],
        "name": row["name"],
        "description": row.get("description"),
        "algorithm": row.get("algorithm"),
        "editable": row.get("editable"),
        "favorite": row.get("favorite"),
        "source": row.get("source"),
        "stockCodes": row.get("stock_codes") or [],
        "stockCount": int(row.get("stock_count") or 0),
        "activeStockCount": row.get("active_stock_count") or 0,
        "change": change,
        "changeAmount": change_amount,
        "amount": amount,
        "turnover": round(turnover, 2),
        "upRatio": round(up_ratio, 2),
        "upCount": int(row.get("up_count") or 0),
        "downCount": int(row.get("down_count") or 0),
        "limitUp": row.get("limit_up"),
        "limitDown": row.get("limit_down"),
        "strength": None,
        "spike5m": None,
        "volatility": round(_safe_num(row.get("volatility"), 0.0), 2),
        "latestTs": latest_ts,
        "updatedAt": updated_at,
        "open": round(open_price, 2),
        "close": round(close_price, 2),
        "high": round(high_price, 2),
        "low": round(low_price, 2),
        "preClose": round(pre_close, 2),
        "volume": volume,
    }


def fetch_concept_overview() -> list[dict]:
    return [_build_concept_snapshot(row) for row in _fetch_concept_aggregate_rows()]


def fetch_concept_realtime_snapshot(concept_id: str) -> dict | None:
    rows = _fetch_concept_aggregate_rows([str(concept_id or "").strip()])
    if not rows:
        return None
    return _build_concept_snapshot(rows[0])


def fetch_concept_macro(concept_id: str, limit: int = 240) -> dict | None:
    concept = fetch_concept_profile(concept_id)
    if concept is None:
        return None

    sql = """
        WITH concept_minutes AS (
            SELECT
                st.ts,
                AVG(st.close) AS close,
                AVG(st.tor) AS turnover,
                AVG(st.udz) AS volatility,
                SUM(st.amount) AS amount,
                SUM(CASE WHEN st.close > st.previous_close THEN 1 ELSE 0 END)::float / NULLIF(COUNT(*), 0) AS up_ratio,
                COUNT(*) AS stock_count
            FROM stock_time_sharing_compat st
            JOIN concept_stocks cs ON cs.stock_code = st.stock_code
            WHERE cs.concept_id = %s
              AND st.ts >= NOW() - INTERVAL '20 days'
              AND st.ts <= NOW()
            GROUP BY st.ts
        ),
        ranked AS (
            SELECT
                *,
                ROW_NUMBER() OVER (ORDER BY ts DESC) AS rn,
                MAX(close) OVER () AS max_close,
                FIRST_VALUE(close) OVER (ORDER BY ts ASC) AS first_close
            FROM concept_minutes
        )
        SELECT
            latest.ts AS latest_ts,
            latest.close AS latest_close,
            latest.turnover AS turnover,
            latest.volatility AS volatility,
            latest.amount AS amount,
            latest.up_ratio AS up_ratio,
            latest.stock_count AS stock_count,
            prev.close AS prev_close,
            five.close AS five_close,
            latest.first_close,
            latest.max_close
        FROM ranked latest
        LEFT JOIN ranked prev ON prev.rn = 2
        LEFT JOIN ranked five ON five.rn = 6
        WHERE latest.rn = 1
    """
    curve_sql = """
        WITH stock_rows AS (
            SELECT
                st.ts,
                st.stock_code,
                st.open,
                st.close,
                st.high,
                st.low,
                st.previous_close,
                st.vol,
                st.amount,
                LAG(st.close) OVER (PARTITION BY st.stock_code ORDER BY st.ts ASC) AS prev_min_close,
                AVG(NULLIF(st.amount, 0)) OVER (
                    PARTITION BY st.stock_code
                    ORDER BY st.ts ASC
                    ROWS BETWEEN 4 PRECEDING AND CURRENT ROW
                ) AS weight_amount
            FROM stock_time_sharing_compat st
            JOIN concept_stocks cs ON cs.stock_code = st.stock_code
            WHERE cs.concept_id = %s
              AND st.ts >= NOW() - INTERVAL '20 days'
              AND st.ts <= NOW()
        ),
        stock_returns AS (
            SELECT
                *,
                CASE
                    WHEN prev_min_close > 0 THEN close / prev_min_close - 1
                    WHEN previous_close > 0 THEN close / previous_close - 1
                    ELSE NULL
                END AS minute_return
            FROM stock_rows
        ),
        concept_minutes AS (
            SELECT
                ts,
                AVG(open) AS open,
                AVG(close) AS close,
                AVG(high) AS high,
                AVG(low) AS low,
                AVG(previous_close) AS pre_close,
                SUM(vol) AS volume,
                SUM(amount) AS amount,
                AVG(minute_return) AS equal_return,
                SUM(COALESCE(weight_amount, amount, 0) * minute_return)
                    / NULLIF(SUM(CASE WHEN minute_return IS NULL THEN 0 ELSE COALESCE(weight_amount, amount, 0) END), 0)
                    AS weighted_return,
                SUM(CASE WHEN minute_return > 0 THEN 1 ELSE 0 END)::float / NULLIF(COUNT(minute_return), 0) AS up_ratio,
                COUNT(minute_return) AS active_stock_count
            FROM stock_returns
            GROUP BY ts
            ORDER BY ts DESC
            LIMIT %s
        )
        SELECT ts, open, close, high, low, pre_close, volume, amount, equal_return, weighted_return, up_ratio, active_stock_count
        FROM concept_minutes
        ORDER BY ts ASC
    """

    with get_conn() as conn:
        with conn.cursor() as cur:
            cur.execute(sql, (concept_id,))
            row = cur.fetchone()
            cur.execute(curve_sql, (concept_id, limit))
            curve_rows = cur.fetchall()

    if not row:
        return {
            **concept,
            "change": 0.0,
            "changeAmount": 0.0,
            "change1m": 0.0,
            "change5m": 0.0,
            "change20d": 0.0,
            "drawdown20d": 0.0,
            "strength": None,
            "amount": 0.0,
            "turnover": 0.0,
            "upRatio": 0.0,
            "volatility": 0.0,
            "stockCount": len(concept.get("stockCodes") or []),
            "activeStockCount": 0,
            "latestTs": None,
            "curve": [],
        }

    latest_close = _safe_num(row.get("latest_close"), 0.0)
    prev_close = _safe_num(row.get("prev_close"), latest_close)
    five_close = _safe_num(row.get("five_close"), prev_close)
    first_close = _safe_num(row.get("first_close"), latest_close)
    max_close = _safe_num(row.get("max_close"), latest_close)
    change = round(((latest_close - prev_close) / prev_close) * 100, 2) if prev_close else 0.0
    change_amount = round(latest_close - prev_close, 2)
    turnover = _safe_num(row.get("turnover"), 0.0)
    up_ratio = _safe_num(row.get("up_ratio"), 0.0)
    def pct_from(base: float) -> float:
        if not base:
            return 0.0
        return round(((latest_close - base) / base) * 100, 2)

    weighted_index = 1000.0
    equal_index = 1000.0
    indexed_curve = []
    for item in curve_rows:
        weighted_return = _safe_num(item.get("weighted_return"), 0.0)
        equal_return = _safe_num(item.get("equal_return"), 0.0)
        weighted_index *= 1 + weighted_return
        equal_index *= 1 + equal_return
        indexed_curve.append(
            {
                "ts": int(item["ts"].timestamp() * 1000) if item["ts"] else None,
                "open": round(_safe_num(item.get("open"), 0.0), 4),
                "close": round(_safe_num(item.get("close"), 0.0), 4),
                "high": round(_safe_num(item.get("high"), 0.0), 4),
                "low": round(_safe_num(item.get("low"), 0.0), 4),
                "preClose": round(_safe_num(item.get("pre_close"), 0.0), 4),
                "volume": _safe_num(item.get("volume"), 0.0),
                "amount": _safe_num(item.get("amount"), 0.0),
                "equalReturn": round(equal_return * 100, 4),
                "weightedReturn": round(weighted_return * 100, 4),
                "equalIndex": round(equal_index, 4),
                "weightedIndex": round(weighted_index, 4),
                "indexSpread": round(((weighted_index - equal_index) / equal_index) * 100, 4) if equal_index else 0.0,
                "upRatio": round(_safe_num(item.get("up_ratio"), 0.0), 4),
                "activeStockCount": item.get("active_stock_count") or 0,
                "change": round(((_safe_num(item.get("close"), 0.0) - _safe_num(item.get("pre_close"), 0.0)) / _safe_num(item.get("pre_close"), 0.0)) * 100, 2)
                if _safe_num(item.get("pre_close"), 0.0)
                else 0.0,
            }
        )

    return {
        **concept,
        "change": change,
        "changeAmount": change_amount,
        "change1m": pct_from(prev_close),
        "change5m": pct_from(five_close),
        "change20d": pct_from(first_close),
        "drawdown20d": round(((latest_close - max_close) / max_close) * 100, 2) if max_close else 0.0,
        "strength": None,
        "amount": _safe_num(row.get("amount"), 0.0),
        "turnover": round(turnover, 2),
        "upRatio": round(up_ratio, 2),
        "volatility": round(_safe_num(row.get("volatility"), 0.0), 2),
        "stockCount": len(concept.get("stockCodes") or []),
        "activeStockCount": row.get("stock_count") or 0,
        "latestTs": int(row["latest_ts"].timestamp() * 1000) if row.get("latest_ts") else None,
        "weightedIndexChange": round(((weighted_index - 1000.0) / 1000.0) * 100, 2),
        "equalIndexChange": round(((equal_index - 1000.0) / 1000.0) * 100, 2),
        "indexSpread": round(((weighted_index - equal_index) / equal_index) * 100, 2) if equal_index else 0.0,
        "curve": indexed_curve,
    }
