import asyncio
from contextlib import asynccontextmanager
from datetime import datetime
from typing import Any, List

from fastapi import Depends, FastAPI, Header, HTTPException, Request
from pydantic import BaseModel

from app.config import AUTO_BOOTSTRAP_CONCEPTS
from app.auth_service import (
    authenticate_user,
    create_session,
    create_user,
    delete_session,
    ensure_auth_tables,
    optional_current_user,
    require_admin,
    require_current_user,
    update_user_account,
)
from app.operation_log_service import (
    ensure_operation_log_table,
    fetch_operation_logs,
    get_operation_log_stats,
    log_operation,
)
from app.concept_analysis_service import fetch_concept_analysis
from app.concept_seed import bootstrap_default_concepts, ensure_default_concepts
from app.concept_market_service import (
    fetch_concept_capital_flow_history,
    fetch_concept_kline,
    fetch_concept_market_detail,
)
from app.concept_realtime_service import (
    fetch_concept_macro,
    fetch_concept_overview,
)
from app.concept_service import (
    create_user_concept,
    delete_user_concept,
    fetch_concept_detail,
    fetch_concept_profile,
    fetch_concept_stocks,
    fetch_concept_time_sharing,
    ensure_user_concept_tables,
    update_user_concept,
)
from app.db import get_conn
from app.db_indexes import ensure_query_indexes
from app.favorite_stock_service import (
    add_favorite_stock,
    ensure_favorite_stocks_table,
    fetch_favorite_stocks,
    remove_favorite_stock,
)
from app.market_data_schema import ensure_stock_time_sharing_compat_view
from app.news_service import fetch_concept_news, fetch_news_detail, fetch_news_feed, fetch_news_list
from app.stock_names import backfill_stock_names
from app.stock_market_service import (
    fetch_stock_capital_flow_history,
    fetch_stock_kline,
    fetch_stock_market_detail,
)
from app.stock_market_caps import get_stock_market_cap
from app.stock_service import fetch_stock_base_list, fetch_stock_detail, search_stocks
from app.strategy_service import (
    bootstrap_select_strategies,
    create_select_strategy,
    delete_select_strategy,
    ensure_select_strategies,
    ensure_strategies_table,
    fetch_select_strategies,
    fetch_select_strategy,
    update_select_strategy,
)


class QuoteRequest(BaseModel):
    codes: List[str]
    snapshotTs: int | None = None


class FavoriteStockPayload(BaseModel):
    code: str


class AuthPayload(BaseModel):
    username: str
    password: str


class AuthUpdatePayload(BaseModel):
    username: str | None = None
    currentPassword: str | None = None
    newPassword: str | None = None
    confirmPassword: str | None = None


class SelectStrategyPayload(BaseModel):
    name: str
    desc: str | None = None
    isFavorite: bool = False
    isCustom: bool = True
    enabled: bool = True
    snapshot: dict


class SelectStrategyPatch(BaseModel):
    name: str | None = None
    desc: str | None = None
    isFavorite: bool | None = None
    isCustom: bool | None = None
    enabled: bool | None = None
    snapshot: dict | None = None


class ConceptPayload(BaseModel):
    id: str
    name: str
    description: str | None = ""
    stockCodes: list[str] = []
    algorithm: str | None = ""
    favorite: bool = False


class ConceptPatch(BaseModel):
    name: str | None = None
    description: str | None = None
    stockCodes: list[str] | None = None
    algorithm: str | None = None
    favorite: bool | None = None
    enabled: bool | None = None


def _log_user_action(
    user: dict | None,
    action: str,
    resource: str,
    details: str,
    resource_id: str | None = None,
    result: str = "success",
    error_message: str | None = None,
    request: Any = None,
) -> None:
    """记录用户操作日志"""
    if not user:
        return

    ip = None
    user_agent = None

    if request:
        # 尝试从请求中获取IP和User-Agent
        client_host = request.client.host if request.client else None
        ip = client_host
        user_agent = request.headers.get("user-agent")

    log_operation(
        user_id=user.get("id"),
        username=user.get("username"),
        role=user.get("role"),
        action=action,
        resource=resource,
        resource_id=resource_id,
        details=details,
        ip=ip,
        user_agent=user_agent,
        result=result,
        error_message=error_message,
    )


def normalize_code(raw: str | None) -> str:
    # 兼容前端常见代码格式，例如 600519.SH / sh600519 / 600519。
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
    # 把数据库字段转换成前端当前 store 能直接使用的结构。
    close = float(row["close"] or 0)
    pre_close = float(row["previous_close"] or 0)
    if close > 0 and pre_close > 0:
        change_amount = round(close - pre_close, 2)
        change_percent = round((change_amount / pre_close) * 100, 2)
    else:
        change_percent = float(row["udf"] or 0)
        change_amount = float(row["udp"] or 0)
    return {
        "code": row["stock_code"],
        "price": close,
        "close": close,
        "preClose": pre_close,
        "open": row["open"],
        "high": row["high"],
        "low": row["low"],
        "changePercent": change_percent,
        "change": change_percent,
        "changeAmount": change_amount,
        "amount": row["amount"],
        "vol": row["vol"],
        "volume": row["vol"],
        "turnover": row["tor"],
        "amplitude": row["udz"],
        "netInflow": None,
        "mainInflow": None,
        "volumeRatio": row["ftor"],
        "orderImbalance": None,
        "pe": None,
        "pb": None,
        "mktCap": get_stock_market_cap(row["stock_code"]),
        "score": None,
        "limitUp": bool(change_percent >= 9.8),
        "limitDown": bool(change_percent <= -9.8),
        "ts": int(row["ts"].timestamp() * 1000) if row["ts"] else None,
    }


def fetch_quotes_by_codes(codes: list[str], snapshot_ts: int | None = None) -> list[dict]:
    # 每只股票只取最新一条分钟数据，作为当前行情摘要返回给前端。
    normalized = [normalize_code(code) for code in codes]
    normalized = [code for code in normalized if code]
    if not normalized:
        return []

    params: tuple = (normalized,)
    if snapshot_ts:
        snapshot_dt = datetime.fromtimestamp(snapshot_ts / 1000)
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
            FROM stock_time_sharing_compat
            WHERE stock_code = ANY(%s)
              AND ts <= %s
            ORDER BY stock_code, ts DESC
        """
        params = (normalized, snapshot_dt)
    else:
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
            FROM stock_time_sharing_compat
            WHERE stock_code = ANY(%s)
              AND ts <= NOW()
            ORDER BY stock_code, ts DESC
        """
    with get_conn() as conn:
        with conn.cursor() as cur:
            cur.execute(sql, params)
            rows = cur.fetchall()

    by_code = {row["stock_code"]: map_quote_row(row) for row in rows}
    return [by_code[code] for code in normalized if code in by_code]


def fetch_time_sharing(code: str, limit: int = 120) -> list[dict]:
    # 查询最近 N 条分钟数据，并按时间正序返回，图表可以直接消费。
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
        FROM stock_time_sharing_compat
        WHERE stock_code = %s
          AND ts <= NOW()
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
    # 启动时先保证基础主数据和行情兼容视图可用。
    if AUTO_BOOTSTRAP_CONCEPTS:
        await asyncio.to_thread(ensure_default_concepts)
    await asyncio.to_thread(ensure_strategies_table)
    await asyncio.to_thread(ensure_select_strategies)
    await asyncio.to_thread(ensure_auth_tables)
    await asyncio.to_thread(ensure_user_concept_tables)
    await asyncio.to_thread(ensure_favorite_stocks_table)
    await asyncio.to_thread(ensure_stock_time_sharing_compat_view)
    await asyncio.to_thread(ensure_query_indexes)
    await asyncio.to_thread(ensure_operation_log_table)

    try:
        yield
    finally:
        pass


app = FastAPI(title="Stock Visualization Backend", lifespan=lifespan)


@app.get("/health")
def health() -> dict:
    # 用于快速确认服务本身、数据库连接和消费者开关是否正常。
    try:
        with get_conn() as conn:
            with conn.cursor() as cur:
                cur.execute("SELECT 1")
                cur.fetchone()
        return {"ok": True, "postgres": "connected", "consumerEnabled": False}
    except Exception as exc:
        return {"ok": False, "postgres": str(exc), "consumerEnabled": False}


@app.post("/api/auth/register")
def register_api(payload: AuthPayload, request: Request = None) -> dict:
    try:
        user = create_user(payload.username, payload.password)
        _log_user_action(
            user=user,
            action="register",
            resource="user",
            details=f"用户注册: {payload.username}",
            resource_id=str(user.get("id")),
            request=request,
        )
    except FileExistsError as exc:
        # 尝试记录日志，但用户可能不存在
        _log_user_action(
            user={"username": payload.username, "role": "unknown", "id": None},
            action="register",
            resource="user",
            details=f"用户注册失败: {payload.username} (用户已存在)",
            result="failed",
            error_message=str(exc),
            request=request,
        )
        raise HTTPException(status_code=409, detail=str(exc)) from exc
    except ValueError as exc:
        _log_user_action(
            user={"username": payload.username, "role": "unknown", "id": None},
            action="register",
            resource="user",
            details=f"用户注册失败: {payload.username} (参数错误)",
            result="failed",
            error_message=str(exc),
            request=request,
        )
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    token = create_session(user["id"])
    return {"data": {"user": user, "token": token}}


@app.post("/api/auth/login")
def login_api(payload: AuthPayload, request: Request = None) -> dict:
    user = authenticate_user(payload.username, payload.password)
    if not user:
        # 记录失败的登录尝试
        _log_user_action(
            user={"username": payload.username, "role": "unknown", "id": None},
            action="login",
            resource="user",
            details=f"登录失败: {payload.username} (用户名或密码错误)",
            result="failed",
            error_message="用户名或密码错误",
            request=request,
        )
        raise HTTPException(status_code=401, detail="用户名或密码错误")
    token = create_session(user["id"])
    _log_user_action(
        user=user,
        action="login",
        resource="user",
        details=f"用户登录: {payload.username}",
        resource_id=str(user.get("id")),
        request=request,
    )
    return {"data": {"user": user, "token": token}}


@app.get("/api/auth/me")
def me_api(user: dict | None = Depends(optional_current_user)) -> dict:
    return {"data": {"user": user}}


@app.patch("/api/auth/me")
def update_me_api(payload: AuthUpdatePayload, user: dict = Depends(require_current_user)) -> dict:
    if payload.newPassword is not None and payload.newPassword != payload.confirmPassword:
        raise HTTPException(status_code=400, detail="两次输入的新密码不一致")
    try:
        updated = update_user_account(
            user_id=user["id"],
            username=payload.username,
            current_password=payload.currentPassword,
            new_password=payload.newPassword,
        )
    except FileExistsError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc
    except PermissionError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return {"data": {"user": updated}}


@app.post("/api/auth/logout")
def logout_api(user: dict = Depends(require_current_user), authorization: str | None = Header(default=None), request: Request = None) -> dict:
    token = str(authorization or "").removeprefix("Bearer ").strip()
    delete_session(token)
    _log_user_action(
        user=user,
        action="logout",
        resource="user",
        details=f"用户登出: {user.get('username')}",
        resource_id=str(user.get("id")),
        request=request,
    )
    return {"ok": True, "data": {"user": user}}


@app.post("/api/quotes")
def get_quotes(payload: QuoteRequest) -> dict:
    rows = fetch_quotes_by_codes(payload.codes, snapshot_ts=payload.snapshotTs)
    return {"data": rows}


@app.get("/api/stocks/search")
def search_stock_api(q: str, limit: int = 20) -> dict:
    rows = search_stocks(q, min(max(limit, 1), 50))
    return {"data": rows}


@app.get("/api/stocks/base")
def get_stock_base_api() -> dict:
    return {"data": fetch_stock_base_list()}


@app.get("/api/favorite-stocks")
def get_favorite_stocks_api(user: dict | None = Depends(optional_current_user)) -> dict:
    return {"data": fetch_favorite_stocks(user_id=user["id"] if user else None)}


@app.post("/api/favorite-stocks")
def post_favorite_stock_api(payload: FavoriteStockPayload, user: dict = Depends(require_current_user)) -> dict:
    try:
        row = add_favorite_stock(payload.code, user_id=user["id"])
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return {"data": row}


@app.delete("/api/favorite-stocks/{code}")
def delete_favorite_stock_api(code: str, user: dict = Depends(require_current_user)) -> dict:
    remove_favorite_stock(code, user_id=user["id"])
    return {"ok": True}


@app.get("/api/stocks/{code}")
def get_stock_detail_api(code: str) -> dict:
    row = fetch_stock_detail(normalize_code(code))
    if row is None:
        raise HTTPException(status_code=404, detail="stock not found")
    return {"data": row}


@app.get("/api/stocks/{code}/market-detail")
def get_stock_market_detail_api(code: str, concept_id: str | None = None, sector: str | None = None) -> dict:
    row = fetch_stock_market_detail(normalize_code(code), concept_id=concept_id, sector_name=sector)
    if row is None:
        raise HTTPException(status_code=404, detail="stock not found")
    return {"data": row}


@app.get("/api/stocks/{code}/timesharing")
def get_stock_time_sharing(code: str, limit: int = 120) -> dict:
    # 对 limit 做边界保护，避免一次查太多分钟数据。
    normalized = normalize_code(code)
    rows = fetch_time_sharing(normalized, min(max(limit, 1), 240))
    return {"data": rows}


@app.get("/api/stocks/{code}/capital-flow-history")
def get_stock_capital_flow_history_api(code: str, concept_id: str | None = None, sector: str | None = None) -> dict:
    row = fetch_stock_capital_flow_history(normalize_code(code), concept_id=concept_id, sector_name=sector)
    return {"data": row}


@app.get("/api/stocks/{code}/kline")
def get_stock_kline_api(code: str, period: str = "1m") -> dict:
    row = fetch_stock_kline(normalize_code(code), period=period)
    return {"data": row}


@app.get("/api/concepts/overview")
def get_concepts_overview(user: dict | None = Depends(optional_current_user)) -> dict:
    rows = fetch_concept_overview(user_id=user["id"] if user else None)
    return {"data": rows}


@app.post("/api/concepts")
def post_concept(payload: ConceptPayload, user: dict = Depends(require_current_user), request: Request = None) -> dict:
    try:
        row = create_user_concept(payload.model_dump(), user_id=user["id"])
        _log_user_action(
            user=user,
            action="create",
            resource="concept",
            details=f"创建概念'{payload.name}'",
            resource_id=row.get("id") if row else None,
            request=request,
        )
    except FileExistsError as exc:
        _log_user_action(
            user=user,
            action="create",
            resource="concept",
            details=f"创建概念'{payload.name}'失败",
            result="failed",
            error_message=str(exc),
            request=request,
        )
        raise HTTPException(status_code=409, detail=str(exc)) from exc
    except ValueError as exc:
        _log_user_action(
            user=user,
            action="create",
            resource="concept",
            details=f"创建概念'{payload.name}'失败",
            result="failed",
            error_message=str(exc),
            request=request,
        )
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return {"data": row}


@app.get("/api/concepts/{concept_id}/profile")
def get_concept_profile_api(concept_id: str, user: dict | None = Depends(optional_current_user)) -> dict:
    row = fetch_concept_profile(concept_id, user_id=user["id"] if user else None)
    if row is None:
        raise HTTPException(status_code=404, detail="concept not found")
    return {"data": row}


@app.get("/api/concepts/{concept_id}")
def get_concept(concept_id: str, user: dict | None = Depends(optional_current_user)) -> dict:
    concept = fetch_concept_detail(concept_id, user_id=user["id"] if user else None)
    if concept is None:
        raise HTTPException(status_code=404, detail="concept not found")
    stocks = fetch_concept_stocks(concept_id)
    return {"data": {"concept": concept, "stocks": stocks}}


@app.patch("/api/concepts/{concept_id}")
def patch_concept(concept_id: str, payload: ConceptPatch, user: dict = Depends(require_current_user), request: Request = None) -> dict:
    try:
        row = update_user_concept(concept_id, payload.model_dump(exclude_none=True), user_id=user["id"])
        _log_user_action(
            user=user,
            action="update",
            resource="concept",
            details=f"更新概念'{concept_id}'",
            resource_id=concept_id,
            request=request,
        )
    except PermissionError as exc:
        _log_user_action(
            user=user,
            action="update",
            resource="concept",
            details=f"更新概念'{concept_id}'失败",
            resource_id=concept_id,
            result="failed",
            error_message=str(exc),
            request=request,
        )
        raise HTTPException(status_code=403, detail=str(exc)) from exc
    except ValueError as exc:
        _log_user_action(
            user=user,
            action="update",
            resource="concept",
            details=f"更新概念'{concept_id}'失败",
            resource_id=concept_id,
            result="failed",
            error_message=str(exc),
            request=request,
        )
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    if row is None:
        _log_user_action(
            user=user,
            action="update",
            resource="concept",
            details=f"更新概念'{concept_id}'失败-概念不存在",
            resource_id=concept_id,
            result="failed",
            error_message="concept not found",
            request=request,
        )
        raise HTTPException(status_code=404, detail="concept not found")
    return {"data": row}


@app.delete("/api/concepts/{concept_id}")
def remove_concept(concept_id: str, user: dict = Depends(require_current_user), request: Request = None) -> dict:
    try:
        deleted = delete_user_concept(concept_id, user_id=user["id"])
        if deleted:
            _log_user_action(
                user=user,
                action="delete",
                resource="concept",
                details=f"删除概念'{concept_id}'",
                resource_id=concept_id,
                request=request,
            )
    except PermissionError as exc:
        _log_user_action(
            user=user,
            action="delete",
            resource="concept",
            details=f"删除概念'{concept_id}'失败-权限不足",
            resource_id=concept_id,
            result="failed",
            error_message=str(exc),
            request=request,
        )
        raise HTTPException(status_code=403, detail=str(exc)) from exc
    if not deleted:
        _log_user_action(
            user=user,
            action="delete",
            resource="concept",
            details=f"删除概念'{concept_id}'失败-概念不存在",
            resource_id=concept_id,
            result="failed",
            error_message="concept not found",
            request=request,
        )
        raise HTTPException(status_code=404, detail="concept not found")
    return {"ok": True}


@app.get("/api/concepts/{concept_id}/macro")
def get_concept_macro_api(concept_id: str, limit: int = 240, days: int = 20, user: dict | None = Depends(optional_current_user)) -> dict:
    row = fetch_concept_macro(
        concept_id,
        min(max(limit, 20), 1000),
        days=min(max(days, 1), 120),
        user_id=user["id"] if user else None,
    )
    if row is None:
        raise HTTPException(status_code=404, detail="concept not found")
    return {"data": row}


@app.get("/api/concepts/{concept_id}/ma-analysis")
def get_concept_ma_analysis_api(concept_id: str, window: int = 30) -> dict:
    row = fetch_concept_analysis(concept_id, min(max(window, 20), 90))
    if row is None:
        raise HTTPException(status_code=404, detail="concept analysis not found")
    return {"data": row}


@app.get("/api/concepts/{concept_id}/timesharing")
def get_concept_time_sharing(concept_id: str, limit: int = 120) -> dict:
    rows = fetch_concept_time_sharing(concept_id, min(max(limit, 1), 240))
    return {"data": rows}


@app.get("/api/concepts/{concept_id}/market-detail")
def get_concept_market_detail_api(concept_id: str) -> dict:
    row = fetch_concept_market_detail(concept_id)
    if row is None:
        raise HTTPException(status_code=404, detail="concept not found")
    return {"data": row}


@app.get("/api/concepts/{concept_id}/capital-flow-history")
def get_concept_capital_flow_history_api(concept_id: str) -> dict:
    row = fetch_concept_capital_flow_history(concept_id)
    if row is None:
        raise HTTPException(status_code=404, detail="concept not found")
    return {"data": row}


@app.get("/api/concepts/{concept_id}/kline")
def get_concept_kline_api(concept_id: str, period: str = "1m") -> dict:
    row = fetch_concept_kline(concept_id, period=period)
    if row is None:
        raise HTTPException(status_code=404, detail="concept not found")
    return {"data": row}


@app.get("/api/concepts/{concept_id}/news")
def get_concept_news_api(concept_id: str, limit: int = 20) -> dict:
    rows = fetch_concept_news(concept_id, min(max(limit, 1), 100))
    return {"data": rows}


@app.get("/api/news")
def get_news(limit: int = 50, stock_code: str | None = None, keyword: str | None = None) -> dict:
    rows = fetch_news_list(limit=min(max(limit, 1), 200), stock_code=normalize_code(stock_code), keyword=keyword)
    return {"data": rows}


@app.get("/api/news/feed")
def get_news_feed_api(concept_id: str = "semiconductor", limit: int = 10, policy_limit: int = 5) -> dict:
    data = fetch_news_feed(
        concept_id=concept_id,
        limit=min(max(limit, 1), 50),
        policy_limit=min(max(policy_limit, 1), 20),
    )
    return {"data": data}


@app.get("/api/news/{external_id}")
def get_news_detail(external_id: str) -> dict:
    row = fetch_news_detail(external_id)
    return {"data": row}


@app.post("/api/admin/bootstrap/concepts")
def bootstrap_concepts(_user: dict = Depends(require_admin)) -> dict:
    # 允许手动重刷默认概念，便于调试或对齐前端概念定义。
    result = bootstrap_default_concepts()
    return {"ok": True, "data": result}


@app.post("/api/admin/backfill-stock-names")
def sync_stock_names(_user: dict = Depends(require_admin)) -> dict:
    # 把外部股票名称映射回填到当前 stocks 表中，修复早期只写代码不写中文名的记录。
    result = backfill_stock_names()
    return {"ok": True, "data": result}


@app.post("/api/admin/db-indexes")
def sync_db_indexes(_user: dict = Depends(require_admin)) -> dict:
    result = ensure_query_indexes()
    return {"ok": True, "data": result}


@app.get("/api/admin/concepts")
def get_admin_concepts(_user: dict = Depends(require_admin)) -> dict:
    from app.concept_service import fetch_concept_overview
    from app.db import get_conn

    with get_conn() as conn:
        with conn.cursor() as cur:
            cur.execute("""
                SELECT
                    c.id,
                    c.name,
                    c.description,
                    c.algorithm,
                    c.editable,
                    c.enabled,
                    c.source,
                    ARRAY_AGG(cs.stock_code ORDER BY cs.sort_order ASC, cs.stock_code ASC)
                        FILTER (WHERE cs.stock_code IS NOT NULL) AS stock_codes,
                    COUNT(cs.stock_code) AS stock_count
                FROM concepts c
                LEFT JOIN concept_stocks cs ON cs.concept_id = c.id
                WHERE c.user_id IS NULL
                GROUP BY c.id, c.name, c.description, c.algorithm, c.editable, c.enabled, c.source
                ORDER BY c.name ASC
            """)
            rows = cur.fetchall()

    concepts = []
    for row in rows:
        concepts.append({
            "id": row["id"],
            "name": row["name"],
            "description": row["description"],
            "algorithm": row["algorithm"],
            "editable": row["editable"],
            "enabled": row["enabled"],
            "isSystem": True,
            "source": row["source"],
            "stockCodes": row.get("stock_codes") or [],
            "stockCount": row.get("stock_count") or 0,
        })

    return {"data": concepts}


@app.post("/api/admin/concepts")
def post_admin_concept(payload: ConceptPayload, _user: dict = Depends(require_admin), request: Request = None) -> dict:
    try:
        row = create_user_concept(payload.model_dump(), user_id=None)
        _log_user_action(
            user=_user,
            action="create",
            resource="admin_concept",
            details=f"管理员创建概念'{payload.name}'",
            resource_id=row.get("id") if row else None,
            request=request,
        )
    except FileExistsError as exc:
        _log_user_action(
            user=_user,
            action="create",
            resource="admin_concept",
            details=f"管理员创建概念'{payload.name}'失败",
            result="failed",
            error_message=str(exc),
            request=request,
        )
        raise HTTPException(status_code=409, detail=str(exc)) from exc
    except ValueError as exc:
        _log_user_action(
            user=_user,
            action="create",
            resource="admin_concept",
            details=f"管理员创建概念'{payload.name}'失败",
            result="failed",
            error_message=str(exc),
            request=request,
        )
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return {"data": row}


@app.patch("/api/admin/concepts/{concept_id}")
def patch_admin_concept(concept_id: str, payload: ConceptPatch, _user: dict = Depends(require_admin), request: Request = None) -> dict:
    try:
        row = update_user_concept(concept_id, payload.model_dump(exclude_none=True), user_id=None, is_admin=True)
        _log_user_action(
            user=_user,
            action="update",
            resource="admin_concept",
            details=f"管理员更新概念'{concept_id}'",
            resource_id=concept_id,
            request=request,
        )
    except PermissionError as exc:
        _log_user_action(
            user=_user,
            action="update",
            resource="admin_concept",
            details=f"管理员更新概念'{concept_id}'失败",
            resource_id=concept_id,
            result="failed",
            error_message=str(exc),
            request=request,
        )
        raise HTTPException(status_code=403, detail=str(exc)) from exc
    except ValueError as exc:
        _log_user_action(
            user=_user,
            action="update",
            resource="admin_concept",
            details=f"管理员更新概念'{concept_id}'失败",
            resource_id=concept_id,
            result="failed",
            error_message=str(exc),
            request=request,
        )
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    if row is None:
        _log_user_action(
            user=_user,
            action="update",
            resource="admin_concept",
            details=f"管理员更新概念'{concept_id}'失败-概念不存在",
            resource_id=concept_id,
            result="failed",
            error_message="concept not found",
            request=request,
        )
        raise HTTPException(status_code=404, detail="concept not found")
    return {"data": row}


@app.delete("/api/admin/concepts/{concept_id}")
def remove_admin_concept(concept_id: str, _user: dict = Depends(require_admin), request: Request = None) -> dict:
    try:
        deleted = delete_user_concept(concept_id, user_id=None, is_admin=True)
        if deleted:
            _log_user_action(
                user=_user,
                action="delete",
                resource="admin_concept",
                details=f"管理员删除概念'{concept_id}'",
                resource_id=concept_id,
                request=request,
            )
    except PermissionError as exc:
        _log_user_action(
            user=_user,
            action="delete",
            resource="admin_concept",
            details=f"管理员删除概念'{concept_id}'失败-权限不足",
            resource_id=concept_id,
            result="failed",
            error_message=str(exc),
            request=request,
        )
        raise HTTPException(status_code=403, detail=str(exc)) from exc
    if not deleted:
        _log_user_action(
            user=_user,
            action="delete",
            resource="admin_concept",
            details=f"管理员删除概念'{concept_id}'失败-概念不存在",
            resource_id=concept_id,
            result="failed",
            error_message="concept not found",
            request=request,
        )
        raise HTTPException(status_code=404, detail="concept not found")
    return {"ok": True}


@app.get("/api/select-strategies")
def get_select_strategies(user: dict | None = Depends(optional_current_user)) -> dict:
    return {"data": fetch_select_strategies(user_id=user["id"] if user else None)}


@app.get("/api/select-strategies/{strategy_id}")
def get_select_strategy(strategy_id: int, user: dict | None = Depends(optional_current_user)) -> dict:
    row = fetch_select_strategy(strategy_id, user_id=user["id"] if user else None)
    if row is None:
        raise HTTPException(status_code=404, detail="strategy not found")
    return {"data": row}


@app.post("/api/select-strategies")
def post_select_strategy(payload: SelectStrategyPayload, user: dict = Depends(require_current_user), request: Request = None) -> dict:
    try:
        row = create_select_strategy(payload.model_dump(), user_id=user["id"])
        _log_user_action(
            user=user,
            action="create",
            resource="strategy",
            details=f"创建策略'{payload.name}'",
            resource_id=str(row.get("id")) if row else None,
            request=request,
        )
        return {"data": row}
    except Exception as exc:
        _log_user_action(
            user=user,
            action="create",
            resource="strategy",
            details=f"创建策略'{payload.name}'失败",
            result="failed",
            error_message=str(exc),
            request=request,
        )
        raise


@app.patch("/api/select-strategies/{strategy_id}")
def patch_select_strategy(strategy_id: int, payload: SelectStrategyPatch, user: dict = Depends(require_current_user), request: Request = None) -> dict:
    try:
        row = update_select_strategy(
            strategy_id,
            payload.model_dump(exclude_none=True),
            user_id=user["id"],
            is_admin=user.get("role") == "admin",
        )
        _log_user_action(
            user=user,
            action="update",
            resource="strategy",
            details=f"更新策略'{strategy_id}'",
            resource_id=str(strategy_id),
            request=request,
        )
    except PermissionError as exc:
        _log_user_action(
            user=user,
            action="update",
            resource="strategy",
            details=f"更新策略'{strategy_id}'失败",
            resource_id=str(strategy_id),
            result="failed",
            error_message=str(exc),
            request=request,
        )
        raise HTTPException(status_code=403, detail=str(exc)) from exc
    if row is None:
        _log_user_action(
            user=user,
            action="update",
            resource="strategy",
            details=f"更新策略'{strategy_id}'失败-策略不存在",
            resource_id=str(strategy_id),
            result="failed",
            error_message="strategy not found",
            request=request,
        )
        raise HTTPException(status_code=404, detail="strategy not found")
    return {"data": row}


@app.delete("/api/select-strategies/{strategy_id}")
def remove_select_strategy(strategy_id: int, user: dict = Depends(require_current_user), request: Request = None) -> dict:
    try:
        deleted = delete_select_strategy(strategy_id, user_id=user["id"], is_admin=user.get("role") == "admin")
        if deleted:
            _log_user_action(
                user=user,
                action="delete",
                resource="strategy",
                details=f"删除策略'{strategy_id}'",
                resource_id=str(strategy_id),
                request=request,
            )
    except PermissionError as exc:
        _log_user_action(
            user=user,
            action="delete",
            resource="strategy",
            details=f"删除策略'{strategy_id}'失败-权限不足",
            resource_id=str(strategy_id),
            result="failed",
            error_message=str(exc),
            request=request,
        )
        raise
    except Exception as exc:
        _log_user_action(
            user=user,
            action="delete",
            resource="strategy",
            details=f"删除策略'{strategy_id}'失败",
            resource_id=str(strategy_id),
            result="failed",
            error_message=str(exc),
            request=request,
        )
        raise
    return {"ok": deleted}


@app.post("/api/admin/bootstrap/select-strategies")
def bootstrap_select_strategy_api(_user: dict = Depends(require_admin)) -> dict:
    return {"ok": True, "data": bootstrap_select_strategies()}


@app.get("/api/admin/select-strategies")
def get_admin_select_strategies(_user: dict = Depends(require_admin)) -> dict:
    from app.strategy_service import fetch_select_strategies
    from app.db import get_conn

    with get_conn() as conn:
        with conn.cursor() as cur:
            cur.execute("""
                SELECT
                    id,
                    name,
                    description,
                    is_favorite,
                    is_custom,
                    enabled,
                    snapshot,
                    created_at,
                    updated_at,
                    user_id
                FROM strategies
                WHERE strategy_type = 'select' AND user_id IS NULL
                ORDER BY id ASC
            """)
            rows = cur.fetchall()

    from app.strategy_service import _map_strategy
    strategies = [_map_strategy(row) for row in rows]

    return {"data": strategies}


@app.post("/api/admin/select-strategies")
def post_admin_select_strategy(payload: SelectStrategyPayload, _user: dict = Depends(require_admin), request: Request = None) -> dict:
    try:
        row = create_select_strategy(payload.model_dump(), user_id=None)
        _log_user_action(
            user=_user,
            action="create",
            resource="admin_strategy",
            details=f"管理员创建策略'{payload.name}'",
            resource_id=str(row.get("id")) if row else None,
            request=request,
        )
        return {"data": row}
    except Exception as exc:
        _log_user_action(
            user=_user,
            action="create",
            resource="admin_strategy",
            details=f"管理员创建策略'{payload.name}'失败",
            result="failed",
            error_message=str(exc),
            request=request,
        )
        raise


@app.patch("/api/admin/select-strategies/{strategy_id}")
def patch_admin_select_strategy(
    strategy_id: int,
    payload: SelectStrategyPatch,
    _user: dict = Depends(require_admin),
    request: Request = None,
) -> dict:
    try:
        row = update_select_strategy(strategy_id, payload.model_dump(exclude_none=True), user_id=None, is_admin=True)
        _log_user_action(
            user=_user,
            action="update",
            resource="admin_strategy",
            details=f"管理员更新策略'{strategy_id}'",
            resource_id=str(strategy_id),
            request=request,
        )
    except Exception as exc:
        _log_user_action(
            user=_user,
            action="update",
            resource="admin_strategy",
            details=f"管理员更新策略'{strategy_id}'失败",
            resource_id=str(strategy_id),
            result="failed",
            error_message=str(exc),
            request=request,
        )
        raise
    if row is None:
        _log_user_action(
            user=_user,
            action="update",
            resource="admin_strategy",
            details=f"管理员更新策略'{strategy_id}'失败-策略不存在",
            resource_id=str(strategy_id),
            result="failed",
            error_message="strategy not found",
            request=request,
        )
        raise HTTPException(status_code=404, detail="strategy not found")
    return {"data": row}


@app.delete("/api/admin/select-strategies/{strategy_id}")
def remove_admin_select_strategy(strategy_id: int, _user: dict = Depends(require_admin), request: Request = None) -> dict:
    try:
        deleted = delete_select_strategy(strategy_id, user_id=None, is_admin=True)
        if deleted:
            _log_user_action(
                user=_user,
                action="delete",
                resource="admin_strategy",
                details=f"管理员删除策略'{strategy_id}'",
                resource_id=str(strategy_id),
                request=request,
            )
    except Exception as exc:
        _log_user_action(
            user=_user,
            action="delete",
            resource="admin_strategy",
            details=f"管理员删除策略'{strategy_id}'失败",
            resource_id=str(strategy_id),
            result="failed",
            error_message=str(exc),
            request=request,
        )
        raise
    return {"ok": deleted}


# 操作日志相关API
@app.get("/api/admin/operation-logs")
def get_operation_logs_api(
    user_id: int | None = None,
    action: str | None = None,
    resource: str | None = None,
    limit: int = 100,
    offset: int = 0,
    _user: dict = Depends(require_admin),
) -> dict:
    """获取操作日志"""
    print(f"[DEBUG] 获取操作日志请求 - 用户: {_user.get('username')}, 参数: user_id={user_id}, action={action}, resource={resource}, limit={limit}, offset={offset}")

    logs = fetch_operation_logs(
        user_id=user_id,
        action=action,
        resource=resource,
        limit=min(max(limit, 1), 500),
        offset=offset,
    )

    print(f"[DEBUG] 返回 {len(logs)} 条操作日志")

    return {"data": logs}


@app.get("/api/admin/operation-logs/stats")
def get_operation_logs_stats_api(_user: dict = Depends(require_admin)) -> dict:
    """获取操作日志统计信息"""
    print(f"[DEBUG] 获取操作日志统计请求 - 用户: {_user.get('username')}")

    stats = get_operation_log_stats()
    print(f"[DEBUG] 统计信息: {stats}")

    return {"data": stats}
