from app.db import get_conn


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

    return [
        {
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
        for row in rows
    ]


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
        "raw": row["raw"],
        "createdAt": int(row["created_at"].timestamp() * 1000) if row["created_at"] else None,
    }
