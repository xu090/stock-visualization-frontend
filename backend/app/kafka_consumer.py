import asyncio
import json
import logging
from datetime import UTC, datetime
from decimal import Decimal
from typing import Any
from zoneinfo import ZoneInfo

from aiokafka import AIOKafkaConsumer

from app.config import (
    KAFKA_AUTO_OFFSET_RESET,
    KAFKA_BOOTSTRAP_SERVERS,
    KAFKA_EVENT_TOPIC,
    KAFKA_GROUP_ID,
    KAFKA_STOCK_TIME_SHARING_TOPIC,
)
from app.db import get_conn
from app.stock_names import get_stock_name


logger = logging.getLogger(__name__)
SH_TZ = ZoneInfo("Asia/Shanghai")

# 先保证 stocks 主表里有这只股票，再写分钟行情表，避免外键和关联查询出问题。
UPSERT_STOCK_SQL = """
INSERT INTO stocks (code, market_code, name, created_at, updated_at)
VALUES (%s, %s, %s, NOW(), NOW())
ON CONFLICT (code) DO UPDATE
SET market_code = EXCLUDED.market_code,
    updated_at = NOW()
"""

UPSERT_TIME_SHARING_SQL = """
INSERT INTO stock_time_sharing (
    market_code, category, stock_code, status, ts,
    begin_price, open, close, high, low, ycp,
    vol, amount, tos, fos, tor, ftor, udp, udf, udz, mfs, tsc,
    last_quantity, last_amount, min_quantity, max_quantity, min_amount, max_amount,
    previous_close, previous_vol, previous_amount, raw, created_at
) VALUES (
    %(market_code)s, %(category)s, %(stock_code)s, %(status)s, %(ts)s,
    %(begin_price)s, %(open)s, %(close)s, %(high)s, %(low)s, %(ycp)s,
    %(vol)s, %(amount)s, %(tos)s, %(fos)s, %(tor)s, %(ftor)s, %(udp)s, %(udf)s, %(udz)s, %(mfs)s, %(tsc)s,
    %(last_quantity)s, %(last_amount)s, %(min_quantity)s, %(max_quantity)s, %(min_amount)s, %(max_amount)s,
    %(previous_close)s, %(previous_vol)s, %(previous_amount)s, %(raw)s::jsonb, NOW()
)
ON CONFLICT (stock_code, ts) DO UPDATE
SET
    market_code = EXCLUDED.market_code,
    category = EXCLUDED.category,
    status = EXCLUDED.status,
    begin_price = EXCLUDED.begin_price,
    open = EXCLUDED.open,
    close = EXCLUDED.close,
    high = EXCLUDED.high,
    low = EXCLUDED.low,
    ycp = EXCLUDED.ycp,
    vol = EXCLUDED.vol,
    amount = EXCLUDED.amount,
    tos = EXCLUDED.tos,
    fos = EXCLUDED.fos,
    tor = EXCLUDED.tor,
    ftor = EXCLUDED.ftor,
    udp = EXCLUDED.udp,
    udf = EXCLUDED.udf,
    udz = EXCLUDED.udz,
    mfs = EXCLUDED.mfs,
    tsc = EXCLUDED.tsc,
    last_quantity = EXCLUDED.last_quantity,
    last_amount = EXCLUDED.last_amount,
    min_quantity = EXCLUDED.min_quantity,
    max_quantity = EXCLUDED.max_quantity,
    min_amount = EXCLUDED.min_amount,
    max_amount = EXCLUDED.max_amount,
    previous_close = EXCLUDED.previous_close,
    previous_vol = EXCLUDED.previous_vol,
    previous_amount = EXCLUDED.previous_amount,
    raw = EXCLUDED.raw
"""

UPSERT_NEWS_SQL = """
INSERT INTO news_events (
    external_id, uuid, title, brief, content, source, stocks, publish_time,
    third_party_source, third_party_table, third_party_id, event_type, sub_type,
    recommend, raw, created_at
) VALUES (
    %(external_id)s, %(uuid)s, %(title)s, %(brief)s, %(content)s, %(source)s, %(stocks)s, %(publish_time)s,
    %(third_party_source)s, %(third_party_table)s, %(third_party_id)s, %(event_type)s, %(sub_type)s,
    %(recommend)s, %(raw)s::jsonb, NOW()
)
ON CONFLICT (external_id) DO UPDATE
SET
    uuid = EXCLUDED.uuid,
    title = EXCLUDED.title,
    brief = EXCLUDED.brief,
    content = EXCLUDED.content,
    source = EXCLUDED.source,
    stocks = EXCLUDED.stocks,
    publish_time = EXCLUDED.publish_time,
    third_party_source = EXCLUDED.third_party_source,
    third_party_table = EXCLUDED.third_party_table,
    third_party_id = EXCLUDED.third_party_id,
    event_type = EXCLUDED.event_type,
    sub_type = EXCLUDED.sub_type,
    recommend = EXCLUDED.recommend,
    raw = EXCLUDED.raw
"""


def parse_millis(value: Any) -> datetime | None:
    # Kafka 里的时间戳是毫秒级 Unix 时间。
    if value is None:
        return None
    return datetime.fromtimestamp(int(value) / 1000, tz=UTC)


def parse_event_publish_time(value: Any) -> datetime | None:
    if not value:
        return None
    if isinstance(value, (int, float)):
        return datetime.fromtimestamp(int(value) / 1000, tz=UTC)
    if isinstance(value, str):
        try:
            return datetime.strptime(value, "%b %d, %Y, %I:%M:%S %p").replace(tzinfo=SH_TZ)
        except ValueError:
            return None
    return None


def as_decimal(value: Any) -> Decimal | None:
    if value is None:
        return None
    return Decimal(str(value))


def build_time_sharing_row(payload: dict, raw: str) -> dict:
    # 常用字段拆成结构化列，方便查询；同时保留原始 JSON 便于排查问题。
    return {
        "market_code": payload.get("marketCode"),
        "category": payload.get("category"),
        "stock_code": payload.get("code"),
        "status": payload.get("status"),
        "ts": parse_millis(payload.get("timestamps")),
        "begin_price": as_decimal(payload.get("begin")),
        "open": as_decimal(payload.get("open")),
        "close": as_decimal(payload.get("close")),
        "high": as_decimal(payload.get("high")),
        "low": as_decimal(payload.get("low")),
        "ycp": as_decimal(payload.get("ycp")),
        "vol": payload.get("vol"),
        "amount": as_decimal(payload.get("amount")),
        "tos": payload.get("tos"),
        "fos": payload.get("fos"),
        "tor": as_decimal(payload.get("tor")),
        "ftor": as_decimal(payload.get("ftor")),
        "udp": as_decimal(payload.get("udp")),
        "udf": as_decimal(payload.get("udf")),
        "udz": as_decimal(payload.get("udz")),
        "mfs": payload.get("mfs"),
        "tsc": payload.get("tsc"),
        "last_quantity": payload.get("lastQuantity"),
        "last_amount": as_decimal(payload.get("lastAmount")),
        "min_quantity": payload.get("minQuantity"),
        "max_quantity": payload.get("maxQuantity"),
        "min_amount": as_decimal(payload.get("minAmount")),
        "max_amount": as_decimal(payload.get("maxAmount")),
        "previous_close": as_decimal(payload.get("previousClose")),
        "previous_vol": payload.get("previousVol"),
        "previous_amount": as_decimal(payload.get("previousAmount")),
        "raw": raw,
    }


def save_message(payload: dict) -> None:
    # 当前版本先落股票分钟行情；指数行情后续可按需要扩展。
    code = payload.get("code")
    market_code = payload.get("marketCode")
    category = payload.get("category")
    if not code or not market_code or category != "stock":
        return

    raw = json.dumps(payload, ensure_ascii=False)
    row = build_time_sharing_row(payload, raw)
    if row["ts"] is None:
        return

    with get_conn() as conn:
        with conn.cursor() as cur:
            cur.execute(UPSERT_STOCK_SQL, (code, market_code, get_stock_name(code)))
            cur.execute(UPSERT_TIME_SHARING_SQL, row)
        conn.commit()


def build_news_row(payload: dict, raw: str) -> dict:
    return {
        "external_id": payload.get("id") or payload.get("uuid"),
        "uuid": payload.get("uuid"),
        "title": payload.get("title"),
        "brief": payload.get("brief"),
        "content": payload.get("content"),
        "source": payload.get("source"),
        "stocks": payload.get("stocks"),
        "publish_time": parse_event_publish_time(payload.get("publishTime")),
        "third_party_source": payload.get("thirdPartySource"),
        "third_party_table": payload.get("thirdPartyTable"),
        "third_party_id": payload.get("thirdPartyId"),
        "event_type": payload.get("type"),
        "sub_type": payload.get("subType"),
        "recommend": payload.get("recommend"),
        "raw": raw,
    }


def save_event_message(payload: dict) -> None:
    row = build_news_row(payload, json.dumps(payload, ensure_ascii=False))
    if not row["external_id"] or not row["title"]:
        return
    with get_conn() as conn:
        with conn.cursor() as cur:
            cur.execute(UPSERT_NEWS_SQL, row)
        conn.commit()


async def run_stock_time_sharing_consumer(stop_event: asyncio.Event) -> None:
    # 消费器和 FastAPI 进程一起启动，服务起来后就开始接收分钟行情。
    consumer = AIOKafkaConsumer(
        KAFKA_STOCK_TIME_SHARING_TOPIC,
        bootstrap_servers=KAFKA_BOOTSTRAP_SERVERS.split(","),
        group_id=KAFKA_GROUP_ID,
        auto_offset_reset=KAFKA_AUTO_OFFSET_RESET,
        enable_auto_commit=True,
        value_deserializer=lambda raw: json.loads(raw.decode("utf-8")),
    )

    await consumer.start()
    logger.info("Kafka consumer started for topic %s", KAFKA_STOCK_TIME_SHARING_TOPIC)
    try:
        while not stop_event.is_set():
            partitions = consumer.assignment()
            if partitions:
                await consumer.seek_to_end(*partitions)
                logger.info(
                    "Kafka consumer aligned to latest offsets for %s partitions on topic %s",
                    len(partitions),
                    KAFKA_STOCK_TIME_SHARING_TOPIC,
                )
                break
            await asyncio.sleep(0.2)

        while not stop_event.is_set():
            # 批量拉取消息，减少高频行情下的数据库提交开销。
            batch = await consumer.getmany(timeout_ms=1000, max_records=500)
            empty = True
            for _topic_partition, messages in batch.items():
                if not messages:
                    continue
                empty = False
                for message in messages:
                    # 数据库写入是阻塞操作，这里丢到线程里，避免卡住事件循环。
                    await asyncio.to_thread(save_message, message.value)
            if empty:
                await asyncio.sleep(0.2)
    except asyncio.CancelledError:
        raise
    except Exception:
        logger.exception("Kafka consumer stopped unexpectedly")
        raise
    finally:
        await consumer.stop()
        logger.info("Kafka consumer stopped")


async def run_event_consumer(stop_event: asyncio.Event) -> None:
    consumer = AIOKafkaConsumer(
        KAFKA_EVENT_TOPIC,
        bootstrap_servers=KAFKA_BOOTSTRAP_SERVERS.split(","),
        group_id=f"{KAFKA_GROUP_ID}-event",
        auto_offset_reset=KAFKA_AUTO_OFFSET_RESET,
        enable_auto_commit=True,
        value_deserializer=lambda raw: json.loads(raw.decode("utf-8")),
    )

    await consumer.start()
    logger.info("Kafka consumer started for topic %s", KAFKA_EVENT_TOPIC)
    try:
        while not stop_event.is_set():
            batch = await consumer.getmany(timeout_ms=1000, max_records=200)
            empty = True
            for _topic_partition, messages in batch.items():
                if not messages:
                    continue
                empty = False
                for message in messages:
                    await asyncio.to_thread(save_event_message, message.value)
            if empty:
                await asyncio.sleep(0.2)
    except asyncio.CancelledError:
        raise
    except Exception:
        logger.exception("Event consumer stopped unexpectedly")
        raise
    finally:
        await consumer.stop()
        logger.info("Event consumer stopped")
