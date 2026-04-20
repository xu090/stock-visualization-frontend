from typing import Any

from app.db import get_conn
from app.stock_names import get_stock_name


def _safe_num(value: Any, default: float = 0.0) -> float:
    if value is None:
        return default
    try:
        return float(value)
    except (TypeError, ValueError):
        return default


def _normalize_code(raw: str | None) -> str:
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
    if code.startswith(("600", "601", "603", "605", "688")):
        return "SH"
    if code.startswith(("000", "001", "002", "003", "300", "301", "302")):
        return "SZ"
    if code.startswith(("430", "830", "831", "832", "833", "835", "836", "837", "838", "839", "871", "873", "920")):
        return "BJ"
    return ""


def _normalize_stock_codes(codes: list[str] | None) -> list[str]:
    normalized: list[str] = []
    seen: set[str] = set()
    for item in codes or []:
        code = _normalize_code(item)
        if not code or code in seen:
            continue
        seen.add(code)
        normalized.append(code)
    return normalized


def _concept_sector_name(concept_id: str, concept_name: str | None = None) -> str:
    mapping = {
        "semiconductor": "半导体",
        "intelligent_driving": "智能驾驶",
        "robot": "人形机器人",
        "military": "国防军工",
    }
    return mapping.get(str(concept_id or "").strip(), str(concept_name or "").strip())


def _fetch_sector_snapshot_map() -> dict[str, dict]:
    sql = """
        SELECT DISTINCT ON (sector_name)
            sector_name,
            open,
            close,
            high,
            low,
            ycp,
            vol,
            amount,
            stock_count,
            change,
            change_pct,
            timestamps
        FROM sector_index
        ORDER BY sector_name, timestamps DESC
    """
    try:
        with get_conn() as conn:
            with conn.cursor() as cur:
                cur.execute("SELECT to_regclass('public.sector_index') AS regclass")
                exists_row = cur.fetchone()
                if not exists_row or not exists_row["regclass"]:
                    return {}
                cur.execute(sql)
                rows = cur.fetchall()
    except Exception:
        return {}

    result: dict[str, dict] = {}
    for row in rows:
        name = str(row.get("sector_name") or "").strip()
        if not name:
            continue
        result[name] = row
    return result


def _fetch_concept_aggregate_rows(concept_ids: list[str] | None = None) -> list[dict]:
    sql = """
        WITH latest_stock AS (
            SELECT DISTINCT ON (stock_code)
                stock_code,
                ts,
                close,
                previous_close,
                amount,
                tor,
                udp,
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
            c.source,
            ARRAY_AGG(cs.stock_code ORDER BY cs.sort_order ASC, cs.stock_code ASC)
                FILTER (WHERE cs.stock_code IS NOT NULL) AS stock_codes,
            COUNT(cs.stock_code) AS stock_count,
            COUNT(ls.stock_code) AS active_stock_count,
            AVG(ls.udf) AS change,
            AVG(ls.udp) AS change_amount,
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
        WHERE (%s IS NULL OR c.id = ANY(%s))
        GROUP BY c.id, c.name, c.description, c.algorithm, c.editable, c.favorite, c.source
        ORDER BY c.favorite DESC, c.editable ASC, c.name ASC
    """
    ids = concept_ids if concept_ids else None
    with get_conn() as conn:
        with conn.cursor() as cur:
            cur.execute(sql, (ids, ids))
            return cur.fetchall()


def _build_concept_realtime_snapshot(row: dict, sector_snapshot_map: dict[str, dict] | None = None) -> dict:
    sector_snapshot_map = sector_snapshot_map or {}
    change = _safe_num(row.get("change"), 0.0)
    up_ratio = _safe_num(row.get("up_ratio"), 0.0)
    turnover = _safe_num(row.get("turnover"), 0.0)
    amount = _safe_num(row.get("amount"), 0.0)
    change_amount = _safe_num(row.get("change_amount"), 0.0)

    sector_name = _concept_sector_name(row.get("id"), row.get("name"))
    sector_snapshot = sector_snapshot_map.get(sector_name)
    open_price = close_price = high_price = low_price = pre_close = volume = latest_ts = None
    stock_count = row.get("stock_count")

    if sector_snapshot:
        change = _safe_num(sector_snapshot.get("change_pct"), change)
        change_amount = _safe_num(sector_snapshot.get("change"), change_amount)
        open_price = round(_safe_num(sector_snapshot.get("open"), 0.0), 2)
        close_price = round(_safe_num(sector_snapshot.get("close"), 0.0), 2)
        high_price = round(_safe_num(sector_snapshot.get("high"), 0.0), 2)
        low_price = round(_safe_num(sector_snapshot.get("low"), 0.0), 2)
        pre_close = round(_safe_num(sector_snapshot.get("ycp"), 0.0), 2)
        volume = _safe_num(sector_snapshot.get("vol"), 0.0)
        amount = _safe_num(sector_snapshot.get("amount"), amount)
        stock_count = sector_snapshot.get("stock_count") or stock_count
        latest_ts = int(sector_snapshot["timestamps"].timestamp() * 1000) if sector_snapshot.get("timestamps") else None
    else:
        latest_ts = int(row["latest_ts"].timestamp() * 1000) if row.get("latest_ts") else None

    strength = max(0, min(100, round((change * 6) + (up_ratio * 40) + min(turnover, 10) * 2)))
    return {
        "id": row["id"],
        "name": row["name"],
        "description": row.get("description"),
        "algorithm": row.get("algorithm"),
        "editable": row.get("editable"),
        "favorite": row.get("favorite"),
        "source": row.get("source"),
        "stockCodes": row.get("stock_codes") or [],
        "stockCount": int(stock_count or 0),
        "activeStockCount": row.get("active_stock_count") or 0,
        "change": round(change, 2),
        "changeAmount": round(change_amount, 2),
        "amount": amount,
        "turnover": round(turnover, 2),
        "upRatio": round(up_ratio, 2),
        "limitUp": row.get("limit_up"),
        "limitDown": row.get("limit_down"),
        "strength": strength,
        "spike5m": round(abs(change) * 8 + up_ratio * 30, 2),
        "volatility": round(_safe_num(row.get("volatility"), 0.0), 2),
        "latestTs": latest_ts,
        "open": open_price,
        "close": close_price,
        "high": high_price,
        "low": low_price,
        "preClose": pre_close,
        "volume": volume,
    }


def fetch_concept_realtime_snapshot(concept_id: str) -> dict | None:
    rows = _fetch_concept_aggregate_rows([str(concept_id or "").strip()])
    if not rows:
        return None
    sector_snapshot_map = _fetch_sector_snapshot_map()
    return _build_concept_realtime_snapshot(rows[0], sector_snapshot_map)


def _map_concept_row(row: dict, stock_codes: list[str] | None = None) -> dict:
    result = {
        "id": row["id"],
        "name": row["name"],
        "description": row["description"],
        "algorithm": row["algorithm"],
        "editable": row["editable"],
        "favorite": row["favorite"],
        "source": row.get("source"),
    }
    if stock_codes is not None:
        result["stockCodes"] = stock_codes
    return result


def _ensure_stock_rows(cur, stock_codes: list[str]) -> None:
    for code in stock_codes:
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


def _replace_concept_stocks(cur, concept_id: str, stock_codes: list[str]) -> None:
    cur.execute("DELETE FROM concept_stocks WHERE concept_id = %s", (concept_id,))
    for sort_order, code in enumerate(stock_codes, start=1):
        cur.execute(
            """
            INSERT INTO concept_stocks (concept_id, stock_code, sort_order, created_at)
            VALUES (%s, %s, %s, NOW())
            ON CONFLICT (concept_id, stock_code) DO UPDATE
            SET sort_order = EXCLUDED.sort_order
            """,
            (concept_id, code, sort_order),
        )


def _fetch_concept_stock_codes(cur, concept_id: str) -> list[str]:
    cur.execute(
        """
        SELECT stock_code
        FROM concept_stocks
        WHERE concept_id = %s
        ORDER BY sort_order ASC, stock_code ASC
        """,
        (concept_id,),
    )
    return [row["stock_code"] for row in cur.fetchall()]


def fetch_concept_overview() -> list[dict]:
    rows = _fetch_concept_aggregate_rows()
    sector_snapshot_map = _fetch_sector_snapshot_map()
    return [_build_concept_realtime_snapshot(row, sector_snapshot_map) for row in rows]


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


def fetch_concept_profile(concept_id: str) -> dict | None:
    sql = """
        SELECT id, name, description, algorithm, editable, favorite, source
        FROM concepts
        WHERE id = %s
    """
    with get_conn() as conn:
        with conn.cursor() as cur:
            cur.execute(sql, (concept_id,))
            row = cur.fetchone()
            if not row:
                return None
            stock_codes = _fetch_concept_stock_codes(cur, concept_id)
    return _map_concept_row(row, stock_codes)


def create_user_concept(payload: dict) -> dict:
    concept_id = str(payload.get("id") or "").strip()
    name = str(payload.get("name") or "").strip()
    if not concept_id:
        raise ValueError("concept id is required")
    if not name:
        raise ValueError("concept name is required")

    stock_codes = _normalize_stock_codes(payload.get("stockCodes"))
    description = str(payload.get("description") or "").strip()
    algorithm = str(payload.get("algorithm") or "").strip()
    favorite = bool(payload.get("favorite", False))

    with get_conn() as conn:
        with conn.cursor() as cur:
            cur.execute("SELECT 1 FROM concepts WHERE id = %s", (concept_id,))
            if cur.fetchone():
                raise FileExistsError("concept already exists")

            _ensure_stock_rows(cur, stock_codes)
            cur.execute(
                """
                INSERT INTO concepts (
                    id, name, description, algorithm, editable, favorite, source, created_at, updated_at
                )
                VALUES (%s, %s, %s, %s, TRUE, %s, 'user', NOW(), NOW())
                RETURNING id, name, description, algorithm, editable, favorite, source
                """,
                (concept_id, name, description, algorithm, favorite),
            )
            row = cur.fetchone()
            _replace_concept_stocks(cur, concept_id, stock_codes)
        conn.commit()

    return _map_concept_row(row, stock_codes)


def update_user_concept(concept_id: str, payload: dict) -> dict | None:
    concept_id = str(concept_id or "").strip()
    if not concept_id:
        return None

    with get_conn() as conn:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT id, editable FROM concepts WHERE id = %s",
                (concept_id,),
            )
            existing = cur.fetchone()
            if not existing:
                return None
            # 系统内置概念不允许改名称、描述、算法和成分股，但收藏状态属于用户侧偏好，
            # 前端首页/概念列表需要能够持久化这个开关。
            payload_keys = set(payload.keys())
            if not existing["editable"] and payload_keys - {"favorite"}:
                raise PermissionError("system concept cannot be modified")

            fields: list[str] = []
            params: list[object] = []
            if "name" in payload:
                name = str(payload.get("name") or "").strip()
                if not name:
                    raise ValueError("concept name is required")
                fields.append("name = %s")
                params.append(name)
            if "description" in payload:
                fields.append("description = %s")
                params.append(str(payload.get("description") or "").strip())
            if "algorithm" in payload:
                fields.append("algorithm = %s")
                params.append(str(payload.get("algorithm") or "").strip())
            if "favorite" in payload:
                fields.append("favorite = %s")
                params.append(bool(payload.get("favorite")))

            stock_codes: list[str] | None = None
            if "stockCodes" in payload:
                stock_codes = _normalize_stock_codes(payload.get("stockCodes"))
                _ensure_stock_rows(cur, stock_codes)
                _replace_concept_stocks(cur, concept_id, stock_codes)
                cur.execute("UPDATE concepts SET updated_at = NOW() WHERE id = %s", (concept_id,))

            if fields:
                fields.append("updated_at = NOW()")
                params.append(concept_id)
                cur.execute(
                    f"""
                    UPDATE concepts
                    SET {', '.join(fields)}
                    WHERE id = %s
                    RETURNING id, name, description, algorithm, editable, favorite, source
                    """,
                    tuple(params),
                )
                row = cur.fetchone()
            else:
                cur.execute(
                    """
                    SELECT id, name, description, algorithm, editable, favorite, source
                    FROM concepts
                    WHERE id = %s
                    """,
                    (concept_id,),
                )
                row = cur.fetchone()

            if stock_codes is None:
                stock_codes = _fetch_concept_stock_codes(cur, concept_id)
        conn.commit()

    return _map_concept_row(row, stock_codes)


def delete_user_concept(concept_id: str) -> bool:
    concept_id = str(concept_id or "").strip()
    if not concept_id:
        return False

    with get_conn() as conn:
        with conn.cursor() as cur:
            cur.execute("SELECT editable FROM concepts WHERE id = %s", (concept_id,))
            row = cur.fetchone()
            if not row:
                return False
            if not row["editable"]:
                raise PermissionError("system concept cannot be deleted")

            cur.execute("DELETE FROM concept_stocks WHERE concept_id = %s", (concept_id,))
            cur.execute("DELETE FROM concepts WHERE id = %s", (concept_id,))
        conn.commit()

    return True


def fetch_concept_stocks(concept_id: str) -> list[dict]:
    # 每只成分股只取最新一条分钟数据，便于概念详情页展示。
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
    # 用等权方式按分钟聚合概念曲线，适合前端做概念分时展示。
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


def fetch_concept_macro(concept_id: str, limit: int = 240) -> dict | None:
    concept = fetch_concept_profile(concept_id)
    if concept is None:
        return None

    sector_snapshot_map = _fetch_sector_snapshot_map()
    sector_snapshot = sector_snapshot_map.get(_concept_sector_name(concept_id, concept.get("name")))

    sql = """
        WITH concept_minutes AS (
            SELECT
                st.ts,
                AVG(st.close) AS close,
                AVG(st.udf) AS change,
                AVG(st.tor) AS turnover,
                AVG(st.udz) AS volatility,
                SUM(st.amount) AS amount,
                SUM(CASE WHEN st.udf > 0 THEN 1 ELSE 0 END)::float / NULLIF(COUNT(*), 0) AS up_ratio,
                COUNT(*) AS stock_count
            FROM stock_time_sharing st
            JOIN concept_stocks cs ON cs.stock_code = st.stock_code
            WHERE cs.concept_id = %s
              AND st.ts >= NOW() - INTERVAL '20 days'
            GROUP BY st.ts
        ),
        ranked AS (
            SELECT
                *,
                ROW_NUMBER() OVER (ORDER BY ts DESC) AS rn,
                MAX(close) OVER () AS max_close,
                MIN(close) OVER () AS min_close,
                FIRST_VALUE(close) OVER (ORDER BY ts ASC) AS first_close
            FROM concept_minutes
        )
        SELECT
            latest.ts AS latest_ts,
            latest.close AS latest_close,
            latest.change AS change,
            latest.turnover AS turnover,
            latest.volatility AS volatility,
            latest.amount AS amount,
            latest.up_ratio AS up_ratio,
            latest.stock_count AS stock_count,
            prev.close AS prev_close,
            five.close AS five_close,
            latest.first_close,
            latest.max_close,
            latest.min_close
        FROM ranked latest
        LEFT JOIN ranked prev ON prev.rn = 2
        LEFT JOIN ranked five ON five.rn = 6
        WHERE latest.rn = 1
    """
    curve_sql = """
        WITH concept_minutes AS (
            SELECT
                st.ts,
                AVG(st.close) AS close,
                AVG(st.udf) AS change
            FROM stock_time_sharing st
            JOIN concept_stocks cs ON cs.stock_code = st.stock_code
            WHERE cs.concept_id = %s
              AND st.ts >= NOW() - INTERVAL '20 days'
            GROUP BY st.ts
            ORDER BY st.ts DESC
            LIMIT %s
        )
        SELECT ts, close, change
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
            "change1m": 0.0,
            "change5m": 0.0,
            "change20d": 0.0,
            "drawdown20d": 0.0,
            "strength": 0,
            "amount": 0.0,
            "turnover": 0.0,
            "upRatio": 0.0,
            "volatility": 0.0,
            "stockCount": len(concept.get("stockCodes") or []),
            "activeStockCount": 0,
            "latestTs": None,
            "curve": [],
        }

    latest_close = _safe_num(row["latest_close"], 0.0)
    prev_close = _safe_num(row["prev_close"], latest_close)
    five_close = _safe_num(row["five_close"], prev_close)
    first_close = _safe_num(row["first_close"], latest_close)
    max_close = _safe_num(row["max_close"], latest_close)
    change = _safe_num(row["change"], 0.0)
    change_amount = round(latest_close - prev_close, 2)
    if sector_snapshot:
        change = _safe_num(sector_snapshot.get("change_pct"), change)
        change_amount = round(_safe_num(sector_snapshot.get("change"), change_amount), 2)
    turnover = _safe_num(row["turnover"], 0.0)
    up_ratio = _safe_num(row["up_ratio"], 0.0)
    strength = max(0, min(100, round((change * 6) + (up_ratio * 40) + min(turnover, 10) * 2)))

    def pct_from(base: float) -> float:
        if not base:
            return 0.0
        return round(((latest_close - base) / base) * 100, 2)

    return {
        **concept,
        "change": round(change, 2),
        "changeAmount": change_amount,
        "change1m": pct_from(prev_close),
        "change5m": pct_from(five_close),
        "change20d": pct_from(first_close),
        "drawdown20d": round(((latest_close - max_close) / max_close) * 100, 2) if max_close else 0.0,
        "strength": strength,
        "amount": _safe_num(row["amount"], 0.0),
        "turnover": round(turnover, 2),
        "upRatio": round(up_ratio, 2),
        "volatility": round(_safe_num(row["volatility"], 0.0), 2),
        "stockCount": len(concept.get("stockCodes") or []),
        "activeStockCount": row["stock_count"] or 0,
        "latestTs": int(row["latest_ts"].timestamp() * 1000) if row["latest_ts"] else None,
        "curve": [
            {
                "ts": int(item["ts"].timestamp() * 1000) if item["ts"] else None,
                "close": round(_safe_num(item["close"], 0.0), 4),
                "change": round(_safe_num(item["change"], 0.0), 2),
            }
            for item in curve_rows
        ],
    }
