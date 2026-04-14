import asyncio
from contextlib import asynccontextmanager
from typing import List

from fastapi import FastAPI
from pydantic import BaseModel

from app.config import ENABLE_KAFKA_CONSUMER
from app.concept_service import (
    fetch_concept_detail,
    fetch_concept_overview,
    fetch_concept_stocks,
    fetch_concept_time_sharing,
)
from app.db import get_conn
from app.kafka_consumer import run_stock_time_sharing_consumer


class QuoteRequest(BaseModel):
    codes: List[str]


def normalize_code(raw: str | None) -> str:
    # 兼容前端常见代码格式：600519.SH / sh600519 / 600519。
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


def map_quote_row(row: dict) -> dict:
    # 把数据库字段转换成前端 store 现在就能直接使用的结构。
    return {
        "code": row["stock_code"],
        "price": row["close"],
        "close": row["close"],
        "preClose": row["previous_close"],
        "open": row["open"],
        "high": row["high"],
        "low": row["low"],
        "changePercent": row["udf"],
        "change": row["udf"],
        "changeAmount": row["udp"],
        "amount": row["amount"],
        "volume": row["vol"],
        "turnover": row["tor"],
        "amplitude": row["udz"],
        "netInflow": None,
        "mainInflow": None,
        "volumeRatio": row["ftor"],
        "orderImbalance": None,
        "pe": None,
        "pb": None,
        "mktCap": None,
        "score": None,
        "limitUp": bool((row["udf"] or 0) >= 9.8),
        "limitDown": bool((row["udf"] or 0) <= -9.8),
        "ts": int(row["ts"].timestamp() * 1000) if row["ts"] else None,
    }


def fetch_quotes_by_codes(codes: list[str]) -> list[dict]:
    # 每只股票只取最新一条分钟数据，作为当前行情摘要返回给前端。
    normalized = [normalize_code(code) for code in codes]
    normalized = [code for code in normalized if code]
    if not normalized:
        return []

    sql = """
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
        FROM stock_time_sharing
        WHERE stock_code = ANY(%s)
        ORDER BY stock_code, ts DESC
    """
    with get_conn() as conn:
        with conn.cursor() as cur:
            cur.execute(sql, (normalized,))
            rows = cur.fetchall()

    by_code = {row["stock_code"]: map_quote_row(row) for row in rows}
    return [by_code[code] for code in normalized if code in by_code]


def fetch_time_sharing(code: str, limit: int = 120) -> list[dict]:
    # 查询最近 N 条分钟数据，并按时间正序返回，前端图表可以直接使用。
    sql = """
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
        ORDER BY ts DESC
        LIMIT %s
    """
    with get_conn() as conn:
        with conn.cursor() as cur:
            cur.execute(sql, (code, limit))
            rows = cur.fetchall()
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


@asynccontextmanager
async def lifespan(_app: FastAPI):
    # FastAPI 生命周期里挂一个后台 Kafka 消费任务，服务启动即开始收数。
    stop_event = asyncio.Event()
    consumer_task = None
    if ENABLE_KAFKA_CONSUMER:
        consumer_task = asyncio.create_task(run_stock_time_sharing_consumer(stop_event))
    try:
        yield
    finally:
        stop_event.set()
        if consumer_task is not None:
            consumer_task.cancel()
            try:
                await consumer_task
            except asyncio.CancelledError:
                pass


app = FastAPI(title="Stock Visualization Backend", lifespan=lifespan)


@app.get("/health")
def health() -> dict:
    # 健康检查先验证 PostgreSQL 是否可连；Kafka 是否启动由服务日志辅助判断。
    try:
        with get_conn() as conn:
            with conn.cursor() as cur:
                cur.execute("SELECT 1")
                cur.fetchone()
        return {"ok": True, "postgres": "connected", "consumerEnabled": ENABLE_KAFKA_CONSUMER}
    except Exception as exc:
        return {"ok": False, "postgres": str(exc), "consumerEnabled": ENABLE_KAFKA_CONSUMER}


@app.post("/api/quotes")
def get_quotes(payload: QuoteRequest) -> dict:
    rows = fetch_quotes_by_codes(payload.codes)
    return {"data": rows}


@app.get("/api/stocks/{code}/timesharing")
def get_stock_time_sharing(code: str, limit: int = 120) -> dict:
    # 对 limit 做边界限制，避免一次查太多分钟数据拖慢接口。
    normalized = normalize_code(code)
    rows = fetch_time_sharing(normalized, min(max(limit, 1), 240))
    return {"data": rows}


@app.get("/api/concepts/overview")
def get_concepts_overview() -> dict:
    rows = fetch_concept_overview()
    return {"data": rows}


@app.get("/api/concepts/{concept_id}")
def get_concept(concept_id: str) -> dict:
    concept = fetch_concept_detail(concept_id)
    stocks = fetch_concept_stocks(concept_id)
    return {"data": {"concept": concept, "stocks": stocks}}


@app.get("/api/concepts/{concept_id}/timesharing")
def get_concept_time_sharing(concept_id: str, limit: int = 120) -> dict:
    rows = fetch_concept_time_sharing(concept_id, min(max(limit, 1), 240))
    return {"data": rows}
