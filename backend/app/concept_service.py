from typing import Any

from app.db import get_conn


def _safe_num(value: Any, default: float = 0.0) -> float:
    if value is None:
        return default
    try:
        return float(value)
    except (TypeError, ValueError):
        return default


def fetch_concept_overview() -> list[dict]:
    # 取每只股票最新一分钟数据，再按 concept 聚合成概念概览。
    sql = """
        WITH latest_stock AS (
            SELECT DISTINCT ON (stock_code)
                stock_code,
                ts,
                close,
                previous_close,
                amount,
                tor,
                udf,
                udz
            FROM stock_time_sharing
            ORDER BY stock_code, ts DESC
        )
        SELECT
            c.id,
            c.name,
            c.description,
            c.algorithm,
            c.editable,
            c.favorite,
            COUNT(cs.stock_code) AS stock_count,
            COUNT(ls.stock_code) AS active_stock_count,
            AVG(ls.udf) AS change,
            COALESCE(SUM(ls.amount), 0) AS amount,
            AVG(ls.tor) AS turnover,
            AVG(ls.udz) AS volatility,
            SUM(CASE WHEN ls.udf > 0 THEN 1 ELSE 0 END)::float / NULLIF(COUNT(ls.stock_code), 0) AS up_ratio,
            SUM(CASE WHEN ls.udf >= 9.8 THEN 1 ELSE 0 END) AS limit_up,
            SUM(CASE WHEN ls.udf <= -9.8 THEN 1 ELSE 0 END) AS limit_down,
            MAX(ls.ts) AS latest_ts
        FROM concepts c
        LEFT JOIN concept_stocks cs ON cs.concept_id = c.id
        LEFT JOIN latest_stock ls ON ls.stock_code = cs.stock_code
        GROUP BY c.id, c.name, c.description, c.algorithm, c.editable, c.favorite
        ORDER BY c.favorite DESC, c.editable ASC, c.name ASC
    """
    with get_conn() as conn:
        with conn.cursor() as cur:
            cur.execute(sql)
            rows = cur.fetchall()

    result = []
    for row in rows:
        change = _safe_num(row["change"], 0.0)
        up_ratio = _safe_num(row["up_ratio"], 0.0)
        turnover = _safe_num(row["turnover"], 0.0)
        amount = _safe_num(row["amount"], 0.0)
        strength = max(0, min(100, round((change * 6) + (up_ratio * 40) + min(turnover, 10) * 2)))
        result.append(
            {
                "id": row["id"],
                "name": row["name"],
                "description": row["description"],
                "algorithm": row["algorithm"],
                "editable": row["editable"],
                "favorite": row["favorite"],
                "stockCount": row["stock_count"],
                "activeStockCount": row["active_stock_count"],
                "change": round(change, 2),
                "amount": amount,
                "turnover": round(turnover, 2),
                "upRatio": round(up_ratio, 2),
                "limitUp": row["limit_up"],
                "limitDown": row["limit_down"],
                "strength": strength,
                "spike5m": round(abs(change) * 8 + up_ratio * 30, 2),
                "volatility": round(_safe_num(row["volatility"], 0.0), 2),
                "latestTs": int(row["latest_ts"].timestamp() * 1000) if row["latest_ts"] else None,
            }
        )
    return result


def fetch_concept_detail(concept_id: str) -> dict | None:
    sql = """
        SELECT id, name, description, algorithm, editable, favorite
        FROM concepts
        WHERE id = %s
    """
    with get_conn() as conn:
        with conn.cursor() as cur:
            cur.execute(sql, (concept_id,))
            row = cur.fetchone()
    if not row:
        return None
    return {
        "id": row["id"],
        "name": row["name"],
        "description": row["description"],
        "algorithm": row["algorithm"],
        "editable": row["editable"],
        "favorite": row["favorite"],
    }


def fetch_concept_stocks(concept_id: str) -> list[dict]:
    # 参考学长行业板块逻辑：每只成分股只取最新一条，便于概念详情页展示。
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
                udf,
                udp,
                udz
            FROM stock_time_sharing
            ORDER BY stock_code, ts DESC
        )
        SELECT
            cs.stock_code,
            s.name AS stock_name,
            ls.ts,
            ls.open,
            ls.close,
            ls.high,
            ls.low,
            ls.previous_close,
            ls.vol,
            ls.amount,
            ls.tor,
            ls.udf,
            ls.udp,
            ls.udz
        FROM concept_stocks cs
        LEFT JOIN stocks s ON s.code = cs.stock_code
        LEFT JOIN latest_stock ls ON ls.stock_code = cs.stock_code
        WHERE cs.concept_id = %s
        ORDER BY cs.stock_code
    """
    with get_conn() as conn:
        with conn.cursor() as cur:
            cur.execute(sql, (concept_id,))
            rows = cur.fetchall()

    result = []
    for row in rows:
        result.append(
            {
                "code": row["stock_code"],
                "name": row["stock_name"] or row["stock_code"],
                "price": _safe_num(row["close"], 0.0),
                "open": _safe_num(row["open"], 0.0),
                "close": _safe_num(row["close"], 0.0),
                "high": _safe_num(row["high"], 0.0),
                "low": _safe_num(row["low"], 0.0),
                "preClose": _safe_num(row["previous_close"], 0.0),
                "changePercent": _safe_num(row["udf"], 0.0),
                "change": _safe_num(row["udf"], 0.0),
                "changeAmount": _safe_num(row["udp"], 0.0),
                "amount": _safe_num(row["amount"], 0.0),
                "volume": row["vol"] or 0,
                "turnover": _safe_num(row["tor"], 0.0),
                "amplitude": _safe_num(row["udz"], 0.0),
                "netInflow": None,
                "mainInflow": None,
                "mktCap": None,
                "ts": int(row["ts"].timestamp() * 1000) if row["ts"] else None,
            }
        )
    return result


def fetch_concept_time_sharing(concept_id: str, limit: int = 120) -> list[dict]:
    # 参考行业指数计算思路，用等权方式按分钟聚合概念曲线。
    sql = """
        WITH concept_rows AS (
            SELECT
                st.ts,
                st.market_code,
                st.open,
                st.close,
                st.high,
                st.low,
                st.previous_close,
                st.vol,
                st.amount,
                st.udf,
                st.udz
            FROM stock_time_sharing st
            JOIN concept_stocks cs ON cs.stock_code = st.stock_code
            WHERE cs.concept_id = %s
        ),
        aggregated AS (
            SELECT
                ts,
                MIN(market_code) AS market_code,
                AVG(open) AS open,
                AVG(close) AS close,
                AVG(high) AS high,
                AVG(low) AS low,
                AVG(previous_close) AS previous_close,
                SUM(vol) AS vol,
                SUM(amount) AS amount,
                AVG(udf) AS udf,
                AVG(udz) AS udz,
                COUNT(*) AS stock_count
            FROM concept_rows
            GROUP BY ts
            ORDER BY ts DESC
            LIMIT %s
        )
        SELECT *
        FROM aggregated
        ORDER BY ts ASC
    """
    with get_conn() as conn:
        with conn.cursor() as cur:
            cur.execute(sql, (concept_id, limit))
            rows = cur.fetchall()

    return [
        {
            "marketCode": row["market_code"],
            "ts": int(row["ts"].timestamp() * 1000) if row["ts"] else None,
            "open": _safe_num(row["open"], 0.0),
            "close": _safe_num(row["close"], 0.0),
            "high": _safe_num(row["high"], 0.0),
            "low": _safe_num(row["low"], 0.0),
            "preClose": _safe_num(row["previous_close"], 0.0),
            "volume": row["vol"] or 0,
            "amount": _safe_num(row["amount"], 0.0),
            "changePercent": _safe_num(row["udf"], 0.0),
            "amplitude": _safe_num(row["udz"], 0.0),
            "stockCount": row["stock_count"],
        }
        for row in rows
    ]
