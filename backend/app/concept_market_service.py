from __future__ import annotations

from datetime import datetime
from typing import Any

from app.concept_service import fetch_concept_macro, fetch_concept_profile, fetch_concept_stocks, fetch_concept_time_sharing
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


def _query_one(sql: str, params: tuple[Any, ...]) -> dict | None:
    with get_conn() as conn:
        with conn.cursor() as cur:
            cur.execute(sql, params)
            return cur.fetchone()


def _query_all(sql: str, params: tuple[Any, ...]) -> list[dict]:
    with get_conn() as conn:
        with conn.cursor() as cur:
            cur.execute(sql, params)
            return cur.fetchall()


def _concept_map(concept_id: str, concept_name: str) -> dict[str, str]:
    stock_table_map = {
        "semiconductor": "stock_semiconductor",
        "intelligent_driving": "stock_intelligent_driving",
        "robot": "stock_robot",
        "military": "stock_military",
    }
    capital_flow_table_map = {
        "semiconductor": "stock_capital_flow_semiconductor",
        "intelligent_driving": "stock_capital_flow_intelligent_driving",
        "robot": "stock_capital_flow_robot",
        "military": "stock_capital_flow_military",
    }
    return {
        "sector_name": concept_name,
        "stock_table": stock_table_map.get(concept_id, ""),
        "stock_capital_flow_table": capital_flow_table_map.get(concept_id, ""),
    }


def _build_detail_fallback(concept_id: str) -> dict | None:
    macro = fetch_concept_macro(concept_id)
    if macro is None:
        return None

    stocks = fetch_concept_stocks(concept_id)
    up_count = sum(1 for item in stocks if _safe_float(item.get("change")) > 0)
    down_count = sum(1 for item in stocks if _safe_float(item.get("change")) < 0)
    leader = None
    ranked = [item for item in stocks if item.get("code")]
    if ranked:
        leader = max(ranked, key=lambda item: _safe_float(item.get("change"), -9999.0))

    curve = macro.get("curve") or []
    latest_point = curve[-1] if curve else {}
    pre_close = 0.0
    close = _safe_float(latest_point.get("close"), 0.0)
    change_pct = _safe_float(macro.get("change"), 0.0)
    if close and change_pct is not None:
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
        "open": round(_safe_float(latest_point.get("close"), close), 2),
        "close": round(close, 2),
        "high": round(_safe_float(latest_point.get("close"), close), 2),
        "low": round(_safe_float(latest_point.get("close"), close), 2),
        "preClose": round(pre_close, 2),
        "change": round(close - pre_close, 2),
        "changeRate": round(change_pct, 2),
        "volume": 0.0,
        "amount": _safe_float(macro.get("amount"), 0.0),
        "netInflow": None,
        "inflowAmount": None,
        "outflowAmount": None,
        "latestTs": macro.get("latestTs"),
    }


def fetch_concept_market_detail(concept_id: str) -> dict | None:
    concept = fetch_concept_profile(concept_id)
    if concept is None:
        return None

    mapping = _concept_map(concept_id, concept["name"])
    if _table_exists("sector_index"):
        sql = """
            SELECT
                si.sector_key,
                si.sector_name,
                si.timestamps,
                si.begin,
                si.open,
                si.close,
                si.high,
                si.low,
                si.ycp,
                si.vol,
                si.amount,
                si.change,
                si.change_pct,
                si.stock_count,
                scf.inflow_amount,
                scf.outflow_amount,
                scf.net_inflow,
                scf.inflow_ratio
            FROM sector_index si
            LEFT JOIN sector_capital_flow scf
              ON si.sector_key = scf.sector_key
             AND si.timestamps = scf.timestamps
            WHERE si.sector_name = %s
            ORDER BY si.timestamps DESC
            LIMIT 1
        """
        try:
            row = _query_one(sql, (mapping["sector_name"],))
        except Exception:
            row = None
        if row:
            stocks = fetch_concept_stocks(concept_id)
            up_count = sum(1 for item in stocks if _safe_float(item.get("change")) > 0)
            down_count = sum(1 for item in stocks if _safe_float(item.get("change")) < 0)
            leader = max(stocks, key=lambda item: _safe_float(item.get("change"), -9999.0), default=None)
            return {
                "id": concept_id,
                "name": row["sector_name"] or concept["name"],
                "stockCount": int(row["stock_count"] or len(stocks)),
                "upCount": up_count,
                "downCount": down_count,
                "avgChange": round(_safe_float(row["change_pct"]), 2),
                "leaderStock": {
                    "code": leader.get("code"),
                    "name": leader.get("name"),
                    "change": round(_safe_float(leader.get("change")), 2),
                } if leader else None,
                "open": round(_safe_float(row["open"]), 2),
                "close": round(_safe_float(row["close"]), 2),
                "high": round(_safe_float(row["high"]), 2),
                "low": round(_safe_float(row["low"]), 2),
                "preClose": round(_safe_float(row["ycp"]), 2),
                "change": round(_safe_float(row["change"]), 2),
                "changeRate": round(_safe_float(row["change_pct"]), 2),
                "volume": _safe_float(row["vol"], 0.0),
                "amount": _safe_float(row["amount"], 0.0),
                "netInflow": _safe_float(row.get("net_inflow"), None),
                "inflowAmount": _safe_float(row.get("inflow_amount"), None),
                "outflowAmount": _safe_float(row.get("outflow_amount"), None),
                "latestTs": int(row["timestamps"].timestamp() * 1000) if row.get("timestamps") else None,
            }

    return _build_detail_fallback(concept_id)


def fetch_concept_capital_flow_history(concept_id: str) -> dict | None:
    concept = fetch_concept_profile(concept_id)
    if concept is None:
        return None

    mapping = _concept_map(concept_id, concept["name"])
    if _table_exists("sector_capital_flow"):
        sql = """
            SELECT timestamps, inflow_amount, outflow_amount, net_inflow
            FROM sector_capital_flow
            WHERE sector_name = %s
            ORDER BY timestamps DESC
            LIMIT 60
        """
        try:
            rows = _query_all(sql, (mapping["sector_name"],))
        except Exception:
            rows = []
        if rows:
            rows = list(reversed(rows[-10:]))
            return {
                "conceptId": concept_id,
                "derived": False,
                "times": [row["timestamps"].strftime("%H:%M") if row.get("timestamps") else "" for row in rows],
                "inflow": [_safe_float(row.get("inflow_amount"), None) for row in rows],
                "outflow": [_safe_float(row.get("outflow_amount"), None) for row in rows],
                "netInflow": [_safe_float(row.get("net_inflow"), None) for row in rows],
            }

    curve = fetch_concept_time_sharing(concept_id, limit=10)
    if not curve:
        return {
            "conceptId": concept_id,
            "derived": True,
            "times": [],
            "inflow": [],
            "outflow": [],
            "netInflow": [],
        }

    inflow: list[float] = []
    outflow: list[float] = []
    net_inflow: list[float] = []
    times: list[str] = []
    for item in curve:
        ts = item.get("ts")
        amount = _safe_float(item.get("amount"), 0.0)
        change_pct = _safe_float(item.get("changePercent"), 0.0)
        net = round(amount * (change_pct / 100.0), 2)
        inflow.append(round(amount + max(net, 0.0), 2))
        outflow.append(round(max(amount - net, 0.0), 2))
        net_inflow.append(net)
        times.append(datetime.fromtimestamp(ts / 1000).strftime("%H:%M") if ts else "")

    return {
        "conceptId": concept_id,
        "derived": True,
        "times": times,
        "inflow": inflow,
        "outflow": outflow,
        "netInflow": net_inflow,
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
            }
        )
    return grouped


def fetch_concept_kline(concept_id: str, period: str = "1m") -> dict | None:
    concept = fetch_concept_profile(concept_id)
    if concept is None:
        return None

    rows = fetch_concept_time_sharing(concept_id, limit=240)
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
    }

