from app.db import get_conn


def _safe_num(value, default: float = 0.0) -> float:
    if value is None:
        return default
    try:
        return float(value)
    except (TypeError, ValueError):
        return default


def _calc_change_metrics(close_value, pre_close_value, raw_change=None, raw_change_percent=None) -> tuple[float, float]:
    close = _safe_num(close_value, 0.0)
    pre_close = _safe_num(pre_close_value, 0.0)
    if close > 0 and pre_close > 0:
      change_amount = round(close - pre_close, 2)
      change_percent = round((change_amount / pre_close) * 100, 2)
      return change_amount, change_percent

    change_amount = round(_safe_num(raw_change, 0.0), 2)
    change_percent = round(_safe_num(raw_change_percent, 0.0), 2)
    return change_amount, change_percent


def _map_stock_row(row: dict) -> dict:
    close = _safe_num(row["close"], 0.0)
    pre_close = _safe_num(row["previous_close"], 0.0)
    change_amount, change_percent = _calc_change_metrics(
        close,
        pre_close,
        raw_change=row.get("udp"),
        raw_change_percent=row.get("udf"),
    )
    return {
        "code": row["code"],
        "name": row["name"] or row["code"],
        "marketCode": row["market_code"],
        "price": close,
        "preClose": pre_close,
        "open": _safe_num(row["open"], 0.0),
        "close": close,
        "high": _safe_num(row["high"], 0.0),
        "low": _safe_num(row["low"], 0.0),
        "changePercent": change_percent,
        "change": change_percent,
        "changeAmount": change_amount,
        "amount": _safe_num(row["amount"], 0.0),
        "volume": row["vol"] or 0,
        "turnover": _safe_num(row["tor"], 0.0),
        "amplitude": _safe_num(row["udz"], 0.0),
        "volumeRatio": _safe_num(row["ftor"], 0.0),
        "ts": int(row["ts"].timestamp() * 1000) if row["ts"] else None,
    }


def search_stocks(query: str, limit: int = 20) -> list[dict]:
    keyword = (query or "").strip()
    if not keyword:
        return []

    sql = """
        WITH latest_stock AS (
            SELECT DISTINCT ON (stock_code)
                stock_code,
                ts,
                open,
                close,
                high,
                low,
                previous_close,
                vol,
                amount,
                tor,
                ftor,
                udp,
                udf,
                udz
            FROM stock_time_sharing_compat
            ORDER BY stock_code, ts DESC
        )
        SELECT
            s.code,
            s.name,
            s.market_code,
            ls.ts,
            ls.open,
            ls.close,
            ls.high,
            ls.low,
            ls.previous_close,
            ls.vol,
            ls.amount,
            ls.tor,
            ls.ftor,
            ls.udp,
            ls.udf,
            ls.udz
        FROM stocks s
        LEFT JOIN latest_stock ls ON ls.stock_code = s.code
        WHERE s.code ILIKE %s OR s.name ILIKE %s
        ORDER BY
            CASE
                WHEN s.code = %s THEN 0
                WHEN s.code LIKE %s THEN 1
                WHEN s.name ILIKE %s THEN 2
                ELSE 3
            END,
            s.code ASC
        LIMIT %s
    """
    params = (
        f"%{keyword}%",
        f"%{keyword}%",
        keyword,
        f"{keyword}%",
        f"{keyword}%",
        limit,
    )
    with get_conn() as conn:
        with conn.cursor() as cur:
            cur.execute(sql, params)
            rows = cur.fetchall()
    return [_map_stock_row(row) for row in rows]


def fetch_stock_detail(code: str) -> dict | None:
    sql = """
        WITH latest_stock AS (
            SELECT DISTINCT ON (stock_code)
                stock_code,
                ts,
                open,
                close,
                high,
                low,
                previous_close,
                vol,
                amount,
                tor,
                ftor,
                udp,
                udf,
                udz
            FROM stock_time_sharing_compat
            ORDER BY stock_code, ts DESC
        )
        SELECT
            s.code,
            s.name,
            s.market_code,
            ls.ts,
            ls.open,
            ls.close,
            ls.high,
            ls.low,
            ls.previous_close,
            ls.vol,
            ls.amount,
            ls.tor,
            ls.ftor,
            ls.udp,
            ls.udf,
            ls.udz
        FROM stocks s
        LEFT JOIN latest_stock ls ON ls.stock_code = s.code
        WHERE s.code = %s
    """
    with get_conn() as conn:
        with conn.cursor() as cur:
            cur.execute(sql, (code,))
            row = cur.fetchone()
    if not row:
        return None
    return _map_stock_row(row)
