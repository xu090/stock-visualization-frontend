from __future__ import annotations

from datetime import datetime
from typing import Any

from app.db import get_conn
from app.stock_service import fetch_stock_detail


def _safe_float(value: Any, default: float | None = 0.0) -> float | None:
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


def _fetch_time_sharing(code: str, limit: int = 240) -> list[dict]:
    sql = """
        WITH latest_trade_day AS (
            SELECT MAX(ts::date) AS trade_day
            FROM stock_time_sharing
            WHERE stock_code = %s
              AND ts <= NOW()
        )
        SELECT
            stock_code,
            market_code,
            ts,
            open,
            close,
            high,
            low,
            vol,
            amount,
            previous_close,
            udf,
            udz
        FROM stock_time_sharing
        WHERE stock_code = %s
          AND ts::date = (SELECT trade_day FROM latest_trade_day)
          AND ts <= NOW()
        ORDER BY ts DESC
        LIMIT %s
    """
    rows = _query_all(sql, (code, code, limit))
    rows.reverse()
    return [
        {
            "code": row["stock_code"],
            "marketCode": row["market_code"],
            "ts": int(row["ts"].timestamp() * 1000) if row["ts"] else None,
            "open": row["open"],
            "close": row["close"],
            "high": row["high"],
            "low": row["low"],
            "volume": row["vol"],
            "amount": row["amount"],
            "preClose": row["previous_close"],
            "changePercent": row["udf"],
            "amplitude": row["udz"],
        }
        for row in rows
    ]


def _concept_map(concept_id: str) -> dict[str, str]:
    stock_capital_flow_table_map = {
        "semiconductor": "stock_capital_flow_semiconductor",
        "intelligent_driving": "stock_capital_flow_intelligent_driving",
        "robot": "stock_capital_flow_robot",
        "military": "stock_capital_flow_military",
    }
    return {
        "stock_capital_flow_table": stock_capital_flow_table_map.get(concept_id, ""),
    }


def resolve_stock_concept(code: str, concept_id: str | None = None, sector_name: str | None = None) -> dict | None:
    if concept_id:
        sql = """
            SELECT c.id, c.name, c.favorite, c.editable
            FROM concepts c
            WHERE c.id = %s
            LIMIT 1
        """
        row = _query_one(sql, (concept_id,))
        if row:
            return {"id": row["id"], "name": row["name"], "favorite": row["favorite"], "editable": row["editable"]}

    if sector_name:
        sql = """
            SELECT c.id, c.name, c.favorite, c.editable
            FROM concepts c
            WHERE c.name = %s
            LIMIT 1
        """
        row = _query_one(sql, (sector_name,))
        if row:
            return {"id": row["id"], "name": row["name"], "favorite": row["favorite"], "editable": row["editable"]}

    sql = """
        SELECT c.id, c.name, c.favorite, c.editable
        FROM concept_stocks cs
        JOIN concepts c ON c.id = cs.concept_id
        WHERE cs.stock_code = %s
        ORDER BY c.favorite DESC, c.editable ASC, c.name ASC
        LIMIT 1
    """
    row = _query_one(sql, (code,))
    if not row:
        return None
    return {"id": row["id"], "name": row["name"], "favorite": row["favorite"], "editable": row["editable"]}


def fetch_stock_market_detail(code: str, concept_id: str | None = None, sector_name: str | None = None) -> dict | None:
    stock = fetch_stock_detail(code)
    if stock is None:
        return None

    concept = resolve_stock_concept(code, concept_id=concept_id, sector_name=sector_name)
    result = {
        **stock,
        "industry": concept["name"] if concept else "",
        "concept": concept,
        "netInflow": None,
        "mainInflow": None,
        "mktCap": stock.get("mktCap"),
        "pe": stock.get("pe"),
        "pb": stock.get("pb"),
        "orderImbalance": None,
    }

    if concept:
        mapping = _concept_map(concept["id"])
        table_name = mapping.get("stock_capital_flow_table")
        if table_name and _table_exists(table_name):
            sql = f"""
                SELECT
                    inflow_amount,
                    outflow_amount,
                    net_inflow,
                    inflow_ratio,
                    total_amount
                FROM {table_name}
                WHERE code = %s
                ORDER BY trade_date DESC
                LIMIT 1
            """
            try:
                row = _query_one(sql, (code,))
            except Exception:
                row = None
            if row:
                result["netInflow"] = _safe_float(row.get("net_inflow"), None)
                inflow_amount = _safe_float(row.get("inflow_amount"), None)
                outflow_amount = _safe_float(row.get("outflow_amount"), None)
                result["mainInflow"] = result["netInflow"]
                result["inflowAmount"] = inflow_amount
                result["outflowAmount"] = outflow_amount

    return result


def fetch_stock_capital_flow_history(code: str, concept_id: str | None = None, sector_name: str | None = None) -> dict | None:
    concept = resolve_stock_concept(code, concept_id=concept_id, sector_name=sector_name)
    if concept:
        table_name = _concept_map(concept["id"]).get("stock_capital_flow_table")
        if table_name and _table_exists(table_name):
            sql = f"""
                SELECT
                    trade_date,
                    inflow_amount,
                    outflow_amount,
                    net_inflow
                FROM {table_name}
                WHERE code = %s
                ORDER BY trade_date DESC
                LIMIT 7
            """
            try:
                rows = _query_all(sql, (code,))
            except Exception:
                rows = []
            if rows:
                rows = list(reversed(rows))
                return {
                    "code": code,
                    "derived": False,
                    "times": [row["trade_date"].strftime("%m-%d") if row.get("trade_date") else "" for row in rows],
                    "inflow": [_safe_float(row.get("inflow_amount"), None) for row in rows],
                    "outflow": [_safe_float(row.get("outflow_amount"), None) for row in rows],
                    "netInflow": [_safe_float(row.get("net_inflow"), None) for row in rows],
                }

    rows = _fetch_time_sharing(code, limit=8)
    if not rows:
        return {"code": code, "derived": True, "times": [], "inflow": [], "outflow": [], "netInflow": []}

    times: list[str] = []
    inflow: list[float] = []
    outflow: list[float] = []
    net_inflow: list[float] = []
    for row in rows:
        amount = _safe_float(row.get("amount"), 0.0) or 0.0
        change_pct = _safe_float(row.get("changePercent"), 0.0) or 0.0
        net = round(amount * (change_pct / 100.0), 2)
        times.append(datetime.fromtimestamp(row["ts"] / 1000).strftime("%H:%M") if row.get("ts") else "")
        inflow.append(round(amount + max(net, 0.0), 2))
        outflow.append(round(max(amount - net, 0.0), 2))
        net_inflow.append(net)

    return {
        "code": code,
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
                "high": max((_safe_float(item.get("high"), 0.0) or 0.0) for item in chunk),
                "low": min((_safe_float(item.get("low"), 0.0) or 0.0) for item in chunk),
                "volume": sum((_safe_float(item.get("volume"), 0.0) or 0.0) for item in chunk),
            }
        )
    return grouped


def fetch_stock_kline(code: str, period: str = "1m") -> dict:
    rows = _fetch_time_sharing(code, limit=240)
    if not rows:
        return {"period": period, "times": [], "data": [], "volumes": []}

    step_map = {"1m": 1, "5m": 5, "15m": 15}
    compressed = _compress_rows(rows, step_map.get(period, 1))
    return {
        "period": period,
        "times": [datetime.fromtimestamp(item["ts"] / 1000).strftime("%H:%M") if item.get("ts") else "" for item in compressed],
        "data": [
            [
                round(_safe_float(item.get("open"), 0.0) or 0.0, 2),
                round(_safe_float(item.get("close"), 0.0) or 0.0, 2),
                round(_safe_float(item.get("low"), 0.0) or 0.0, 2),
                round(_safe_float(item.get("high"), 0.0) or 0.0, 2),
            ]
            for item in compressed
        ],
        "volumes": [round(_safe_float(item.get("volume"), 0.0) or 0.0, 2) for item in compressed],
    }
