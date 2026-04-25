from __future__ import annotations

from datetime import datetime
from typing import Any

from app.cache import app_cache
from app.concept_realtime_service import fetch_concept_macro, fetch_concept_realtime_snapshot
from app.concept_service import (
    _concept_sector_name,
    _fetch_sector_index_rows,
    fetch_concept_profile,
    fetch_concept_stocks,
    fetch_concept_time_sharing,
)
from app.db import get_conn


def _safe_float(value: Any, default: float = 0.0) -> float:
    if value is None:
        return default
    try:
        return float(value)
    except (TypeError, ValueError):
        return default


def _table_exists(table_name: str) -> bool:
    with get_conn() as conn:
        with conn.cursor() as cur:
            cur.execute("SELECT to_regclass(%s) AS regclass", (f"public.{table_name}",))
            row = cur.fetchone()
    return bool(row and row["regclass"])


def _concept_capital_flow_table(concept_id: str) -> str:
    table_map = {
        "semiconductor": "stock_capital_flow_semiconductor",
        "intelligent_driving": "stock_capital_flow_intelligent_driving",
        "robot": "stock_capital_flow_robot",
        "military": "stock_capital_flow_military",
    }
    return table_map.get(str(concept_id or "").strip(), "")


def _build_detail_fallback(concept_id: str) -> dict | None:
    macro = fetch_concept_macro(concept_id)
    if macro is None:
        return None

    stocks = fetch_concept_stocks(concept_id, snapshot_ts=macro.get("latestTs"))
    up_count = sum(1 for item in stocks if _safe_float(item.get("change")) > 0)
    down_count = sum(1 for item in stocks if _safe_float(item.get("change")) < 0)
    leader = None
    ranked = [item for item in stocks if item.get("code")]
    if ranked:
        leader = max(ranked, key=lambda item: _safe_float(item.get("change"), -9999.0))

    curve = macro.get("curve") or []
    latest_point = curve[-1] if curve else {}
    open_price = _safe_float(latest_point.get("open"), latest_point.get("close"))
    close = _safe_float(latest_point.get("close"), 0.0)
    high_price = _safe_float(latest_point.get("high"), latest_point.get("close"))
    low_price = _safe_float(latest_point.get("low"), latest_point.get("close"))
    pre_close = _safe_float(latest_point.get("preClose"), 0.0)
    change_pct = _safe_float(macro.get("change"), 0.0)
    if not pre_close and close and change_pct is not None:
        pre_close = close / (1 + (change_pct / 100)) if change_pct != -100 else 0.0

    return {
        "id": macro["id"],
        "name": macro["name"],
        "stockCount": macro.get("stockCount") or len(macro.get("stockCodes") or []),
        "upCount": up_count,
        "downCount": down_count,
        "avgChange": round(change_pct, 2),
        "leaderStock": {
            "code": leader.get("code"),
            "name": leader.get("name"),
            "change": round(_safe_float(leader.get("change")), 2),
        } if leader else None,
        "open": round(_safe_float(open_price, close), 2),
        "close": round(close, 2),
        "high": round(_safe_float(high_price, close), 2),
        "low": round(_safe_float(low_price, close), 2),
        "preClose": round(pre_close, 2),
        "change": round(close - pre_close, 2),
        "changeRate": round(change_pct, 2),
        "volume": _safe_float(latest_point.get("volume"), 0.0),
        "amount": _safe_float(macro.get("amount"), 0.0),
        "netInflow": None,
        "inflowAmount": None,
        "outflowAmount": None,
        "latestTs": macro.get("latestTs"),
        "updatedAt": int(datetime.now().timestamp() * 1000),
    }


def fetch_concept_market_detail(concept_id: str) -> dict | None:
    normalized_id = str(concept_id or "").strip()
    return app_cache.get_or_set(
        f"concept:market-detail:{normalized_id}",
        ttl_seconds=600,
        factory=lambda: _fetch_concept_market_detail_uncached(normalized_id),
    )


def _fetch_concept_market_detail_uncached(concept_id: str) -> dict | None:
    concept = fetch_concept_profile(concept_id)
    if concept is None:
        return None
    snapshot = fetch_concept_realtime_snapshot(concept_id)
    if snapshot is None:
        return _build_detail_fallback(concept_id)

    return {
        "id": concept_id,
        "name": snapshot.get("name") or concept["name"],
        "stockCount": int(snapshot.get("stockCount") or len(concept.get("stockCodes") or [])),
        "upCount": snapshot.get("upCount"),
        "downCount": snapshot.get("downCount"),
        "avgChange": round(_safe_float(snapshot.get("change")), 2),
        "leaderStock": None,
        "open": round(_safe_float(snapshot.get("open")), 2),
        "close": round(_safe_float(snapshot.get("close")), 2),
        "high": round(_safe_float(snapshot.get("high")), 2),
        "low": round(_safe_float(snapshot.get("low")), 2),
        "preClose": round(_safe_float(snapshot.get("preClose")), 2),
        "change": round(_safe_float(snapshot.get("changeAmount")), 2),
        "changeRate": round(_safe_float(snapshot.get("change")), 2),
        "volume": _safe_float(snapshot.get("volume"), 0.0),
        "amount": _safe_float(snapshot.get("amount"), 0.0),
        "netInflow": None,
        "inflowAmount": None,
        "outflowAmount": None,
        "latestTs": snapshot.get("latestTs"),
        "updatedAt": snapshot.get("updatedAt") or int(datetime.now().timestamp() * 1000),
    }


def fetch_concept_capital_flow_history(concept_id: str) -> dict | None:
    concept = fetch_concept_profile(concept_id)
    if concept is None:
        return None

    table_name = _concept_capital_flow_table(concept_id)
    if table_name and _table_exists(table_name):
        sql = f"""
            SELECT
                flow.trade_date,
                SUM(flow.inflow_amount) AS inflow_amount,
                SUM(flow.outflow_amount) AS outflow_amount,
                SUM(flow.net_inflow) AS net_inflow
            FROM {table_name} flow
            JOIN concept_stocks cs ON cs.stock_code = flow.code
            WHERE cs.concept_id = %s
            GROUP BY flow.trade_date
            ORDER BY flow.trade_date DESC
            LIMIT 7
        """
        try:
            with get_conn() as conn:
                with conn.cursor() as cur:
                    cur.execute(sql, (concept_id,))
                    rows = list(cur.fetchall())
        except Exception:
            rows = []

        if rows:
            rows.reverse()
            return {
                "conceptId": concept_id,
                "derived": False,
                "times": [row["trade_date"].strftime("%m-%d") if row.get("trade_date") else "" for row in rows],
                "inflow": [_safe_float(row.get("inflow_amount"), None) for row in rows],
                "outflow": [_safe_float(row.get("outflow_amount"), None) for row in rows],
                "netInflow": [_safe_float(row.get("net_inflow"), None) for row in rows],
            }

    return {
        "conceptId": concept_id,
        "derived": False,
        "times": [],
        "inflow": [],
        "outflow": [],
        "netInflow": [],
    }


def _compress_rows(rows: list[dict], step: int) -> list[dict]:
    if step <= 1 or len(rows) <= 1:
        return rows
    grouped: list[dict] = []
    for index in range(0, len(rows), step):
        chunk = rows[index:index + step]
        if not chunk:
            continue
        grouped.append(
            {
                "ts": chunk[-1].get("ts"),
                "open": _safe_float(chunk[0].get("open"), 0.0),
                "close": _safe_float(chunk[-1].get("close"), 0.0),
                "high": max(_safe_float(item.get("high"), 0.0) for item in chunk),
                "low": min(_safe_float(item.get("low"), 0.0) for item in chunk),
                "volume": sum(_safe_float(item.get("volume"), 0.0) for item in chunk),
                "amount": sum(_safe_float(item.get("amount"), 0.0) for item in chunk),
                "changePercent": _safe_float(chunk[-1].get("changePercent"), 0.0),
                "amplitude": _safe_float(chunk[-1].get("amplitude"), 0.0),
                "stockCount": _safe_float(chunk[-1].get("stockCount"), 0.0),
            }
        )
    return grouped


def _aggregate_rows_by_minute(rows: list[dict]) -> list[dict]:
    grouped: list[dict] = []
    current_minute: int | None = None
    current_rows: list[dict] = []

    def flush() -> None:
        if not current_rows:
            return
        grouped.append(
            {
                "ts": current_minute,
                "open": _safe_float(current_rows[0].get("open"), 0.0),
                "close": _safe_float(current_rows[-1].get("close"), 0.0),
                "high": max(_safe_float(item.get("high"), 0.0) for item in current_rows),
                "low": min(_safe_float(item.get("low"), 0.0) for item in current_rows),
                "volume": sum(_safe_float(item.get("volume"), 0.0) for item in current_rows),
                "preClose": _safe_float(current_rows[0].get("preClose"), 0.0),
                "amount": sum(_safe_float(item.get("amount"), 0.0) for item in current_rows),
                "changePercent": _safe_float(current_rows[-1].get("changePercent"), 0.0),
                "amplitude": _safe_float(current_rows[-1].get("amplitude"), 0.0),
                "stockCount": _safe_float(current_rows[-1].get("stockCount"), 0.0),
            }
        )

    for row in rows or []:
        ts = row.get("ts")
        if not ts:
            continue
        minute_ts = int(ts) // 60000 * 60000
        if current_minute is None:
            current_minute = minute_ts
        if minute_ts != current_minute:
            flush()
            current_rows = []
            current_minute = minute_ts
        current_rows.append(row)

    flush()
    return grouped


def _normalize_sector_index_rows(rows: list[dict]) -> list[dict]:
    normalized: list[dict] = []
    for row in rows or []:
        ts = row.get("timestamps")
        normalized.append(
            {
                "ts": int(ts.timestamp() * 1000) if ts else None,
                "open": _safe_float(row.get("open"), 0.0),
                "close": _safe_float(row.get("close"), 0.0),
                "high": _safe_float(row.get("high"), 0.0),
                "low": _safe_float(row.get("low"), 0.0),
                "preClose": _safe_float(row.get("ycp"), 0.0),
                "volume": _safe_float(row.get("vol"), 0.0),
                "amount": _safe_float(row.get("amount"), 0.0),
                "changePercent": 0.0,
                "amplitude": 0.0,
                "stockCount": 0.0,
            }
        )
    return normalized


def _clean_kline_rows(rows: list[dict]) -> list[dict]:
    cleaned: list[dict] = []
    for row in rows or []:
        open_price = _safe_float(row.get("open"), 0.0)
        close_price = _safe_float(row.get("close"), 0.0)
        high_price = _safe_float(row.get("high"), 0.0)
        low_price = _safe_float(row.get("low"), 0.0)

        if min(open_price, close_price, high_price, low_price) <= 0:
            continue
        if high_price < max(open_price, close_price) or low_price > min(open_price, close_price):
            continue

        cleaned.append(row)

    return cleaned


def fetch_concept_kline(concept_id: str, period: str = "1m") -> dict | None:
    concept = fetch_concept_profile(concept_id)
    if concept is None:
        return None

    snapshot = fetch_concept_realtime_snapshot(concept_id)
    anchor_ts = snapshot.get("latestTs") if snapshot else None
    sector_name = _concept_sector_name(concept_id, concept.get("name"))
    sector_rows = _normalize_sector_index_rows(_fetch_sector_index_rows(sector_name, limit=240, anchor_ts=anchor_ts))
    cleaned_sector_rows = _clean_kline_rows(_aggregate_rows_by_minute(sector_rows))

    # 如果 sector_index 只清洗剩下极少几个点，说明这批板块索引数据异常或口径不连续，
    # 改用成分股分钟聚合结果，避免前端只画出两三根蜡烛。
    use_sector_rows = bool(cleaned_sector_rows) and (
        len(cleaned_sector_rows) >= 20 or len(cleaned_sector_rows) >= max(3, len(sector_rows) // 3)
    )

    if use_sector_rows:
        rows = cleaned_sector_rows
    else:
        rows = _clean_kline_rows(_aggregate_rows_by_minute(fetch_concept_time_sharing(concept_id, limit=240)))
    if not rows:
        return {"period": period, "times": [], "data": [], "volumes": []}

    step_map = {"1m": 1, "5m": 5, "15m": 15}
    compressed = _compress_rows(rows, step_map.get(period, 1))
    return {
        "period": period,
        "times": [datetime.fromtimestamp(item["ts"] / 1000).strftime("%H:%M") if item.get("ts") else "" for item in compressed],
        "data": [
            [
                round(_safe_float(item.get("open")), 2),
                round(_safe_float(item.get("close")), 2),
                round(_safe_float(item.get("low")), 2),
                round(_safe_float(item.get("high")), 2),
            ]
            for item in compressed
        ],
        "volumes": [round(_safe_float(item.get("volume")), 2) for item in compressed],
        "amounts": [round(_safe_float(item.get("amount")), 2) for item in compressed],
        "changePercents": [round(_safe_float(item.get("changePercent")), 2) for item in compressed],
        "amplitudes": [round(_safe_float(item.get("amplitude")), 2) for item in compressed],
        "stockCounts": [int(_safe_float(item.get("stockCount"))) for item in compressed],
    }
