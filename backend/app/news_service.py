import re
from datetime import datetime

from app.db import get_conn


def _map_news_row(row: dict) -> dict:
    return {
        "id": row["external_id"],
        "uuid": row["uuid"],
        "title": row["title"],
        "brief": row["brief"],
        "content": row["content"],
        "source": row["source"],
        "stocks": row["stocks"],
        "publishTime": int(row["publish_time"].timestamp() * 1000) if row["publish_time"] else None,
        "thirdPartySource": row["third_party_source"],
        "thirdPartyTable": row["third_party_table"],
        "thirdPartyId": row["third_party_id"],
        "type": row["event_type"],
        "subType": row["sub_type"],
        "recommend": row["recommend"],
        "createdAt": int(row["created_at"].timestamp() * 1000) if row["created_at"] else None,
    }


def _extract_stock_codes(stocks) -> list[str]:
    text = ""
    if isinstance(stocks, list):
        text = " ".join(str(item) for item in stocks)
    elif stocks is not None:
        text = str(stocks)
    return sorted(set(re.findall(r"\b\d{6}\b", text)))


def _format_front_time(publish_time_ms: int | None) -> str:
    if not publish_time_ms:
        return ""
    return datetime.fromtimestamp(publish_time_ms / 1000).strftime("%Y-%m-%d %H:%M:%S")


def _content_to_paragraphs(content: str | None, brief: str | None) -> list[str]:
    paragraphs = []
    if brief:
        paragraphs.append(str(brief))
    if content:
        for item in re.split(r"[\r\n]+", str(content)):
            text = item.strip()
            if text and text not in paragraphs:
                paragraphs.append(text)
    return paragraphs


def _infer_sentiment(row: dict) -> str:
    text = f"{row.get('title') or ''} {row.get('brief') or ''} {row.get('content') or ''}"
    if any(word in text for word in ("利好", "上涨", "走强", "增长", "突破", "支持")):
        return "positive"
    if any(word in text for word in ("利空", "下跌", "走弱", "风险", "回落", "亏损")):
        return "negative"
    return "neutral"


def _concept_ids_for_stock_codes(stock_codes: list[str]) -> list[str]:
    if not stock_codes:
        return []
    sql = """
        SELECT DISTINCT concept_id
        FROM concept_stocks
        WHERE stock_code = ANY(%s)
        ORDER BY concept_id
    """
    with get_conn() as conn:
        with conn.cursor() as cur:
            cur.execute(sql, (stock_codes,))
            rows = cur.fetchall()
    return [row["concept_id"] for row in rows]


def _to_front_news(row: dict, fallback_concept_id: str | None = None, category: str = "概念") -> dict:
    stock_codes = _extract_stock_codes(row.get("stocks"))
    concept_ids = _concept_ids_for_stock_codes(stock_codes)
    if fallback_concept_id and fallback_concept_id not in concept_ids:
        concept_ids.insert(0, fallback_concept_id)

    brief = row.get("brief") or ""
    return {
        "id": row["id"],
        "category": category,
        "title": row.get("title") or "",
        "source": row.get("source") or row.get("thirdPartySource") or "",
        "time": _format_front_time(row.get("publishTime")),
        "brief": brief,
        "sentiment": _infer_sentiment(row),
        "heat": 80 if row.get("recommend") else 55,
        "conceptIds": concept_ids,
        "keyPoints": [brief] if brief else [],
        "whatToWatch": ["关注后续公告、成交量变化和概念内成分股扩散情况"],
        "relatedStocks": stock_codes,
        "content": _content_to_paragraphs(row.get("content"), brief),
        "raw": row,
    }


def fetch_news_list(limit: int = 50, stock_code: str | None = None, keyword: str | None = None) -> list[dict]:
    clauses = []
    params: list[object] = []

    if stock_code:
        clauses.append("stocks LIKE %s")
        params.append(f"%{stock_code}%")

    if keyword:
        clauses.append("(title ILIKE %s OR brief ILIKE %s OR content ILIKE %s)")
        keyword_param = f"%{keyword}%"
        params.extend([keyword_param, keyword_param, keyword_param])

    where_sql = f"WHERE {' AND '.join(clauses)}" if clauses else ""
    sql = f"""
        SELECT
            external_id,
            uuid,
            title,
            brief,
            content,
            source,
            stocks,
            publish_time,
            third_party_source,
            third_party_table,
            third_party_id,
            event_type,
            sub_type,
            recommend,
            created_at
        FROM news_events
        {where_sql}
        ORDER BY publish_time DESC NULLS LAST, created_at DESC
        LIMIT %s
    """
    params.append(limit)

    with get_conn() as conn:
        with conn.cursor() as cur:
            cur.execute(sql, tuple(params))
            rows = cur.fetchall()

    return [_map_news_row(row) for row in rows]


def fetch_concept_news(concept_id: str, limit: int = 20) -> list[dict]:
    sql = """
        SELECT DISTINCT
            ne.external_id,
            ne.uuid,
            ne.title,
            ne.brief,
            ne.content,
            ne.source,
            ne.stocks,
            ne.publish_time,
            ne.third_party_source,
            ne.third_party_table,
            ne.third_party_id,
            ne.event_type,
            ne.sub_type,
            ne.recommend,
            ne.created_at
        FROM news_events ne
        WHERE EXISTS (
            SELECT 1
            FROM concept_stocks cs
            WHERE cs.concept_id = %s
              AND ne.stocks LIKE '%%' || cs.stock_code || '%%'
        )
        ORDER BY ne.publish_time DESC NULLS LAST, ne.created_at DESC
        LIMIT %s
    """
    with get_conn() as conn:
        with conn.cursor() as cur:
            cur.execute(sql, (concept_id, limit))
            rows = cur.fetchall()

    return [_map_news_row(row) for row in rows]


def fetch_news_feed(concept_id: str = "semiconductor", limit: int = 10, policy_limit: int = 5) -> dict:
    policy_rows = fetch_news_list(limit=policy_limit, keyword="政策")
    if not policy_rows:
        policy_rows = fetch_news_list(limit=policy_limit)

    dynamic_rows = fetch_concept_news(concept_id, limit=limit)

    return {
        "context": {"type": "concept", "conceptId": concept_id},
        "policyNews": [_to_front_news(row, category="政策") for row in policy_rows],
        "dynamicNews": [_to_front_news(row, fallback_concept_id=concept_id, category="概念") for row in dynamic_rows],
    }


def fetch_news_detail(external_id: str) -> dict | None:
    sql = """
        SELECT
            external_id,
            uuid,
            title,
            brief,
            content,
            source,
            stocks,
            publish_time,
            third_party_source,
            third_party_table,
            third_party_id,
            event_type,
            sub_type,
            recommend,
            raw,
            created_at
        FROM news_events
        WHERE external_id = %s
    """
    with get_conn() as conn:
        with conn.cursor() as cur:
            cur.execute(sql, (external_id,))
            row = cur.fetchone()

    if not row:
        return None

    result = _map_news_row(row)
    result["raw"] = row["raw"]
    return result
