from __future__ import annotations

import math
from collections import defaultdict
from datetime import date
from statistics import fmean
from typing import Any

from app.cache import app_cache
from app.concept_service import fetch_concept_profile
from app.db import get_conn


def _safe_float(value: Any, default: float | None = 0.0) -> float | None:
    if value is None:
        return default
    try:
        return float(value)
    except (TypeError, ValueError):
        return default


def _round(value: float | None, digits: int = 2) -> float:
    number = _safe_float(value, 0.0) or 0.0
    return round(number, digits)


def _mean(values: list[float]) -> float:
    if not values:
        return 0.0
    return fmean(values)


def _stdev(values: list[float]) -> float:
    if len(values) < 2:
        return 0.0
    avg = _mean(values)
    variance = sum((value - avg) ** 2 for value in values) / (len(values) - 1)
    return math.sqrt(max(variance, 0.0))


def _covariance(xs: list[float], ys: list[float]) -> float:
    size = min(len(xs), len(ys))
    if size < 2:
        return 0.0
    x_values = xs[:size]
    y_values = ys[:size]
    x_mean = _mean(x_values)
    y_mean = _mean(y_values)
    return sum((x - x_mean) * (y - y_mean) for x, y in zip(x_values, y_values)) / (size - 1)


def _pearson(xs: list[float], ys: list[float]) -> float:
    size = min(len(xs), len(ys))
    if size < 2:
        return 0.0
    x_values = xs[:size]
    y_values = ys[:size]
    x_std = _stdev(x_values)
    y_std = _stdev(y_values)
    if x_std <= 0 or y_std <= 0:
        return 0.0
    return _covariance(x_values, y_values) / (x_std * y_std)


def _beta(stock_returns: list[float], concept_returns: list[float]) -> float:
    variance = _stdev(concept_returns) ** 2
    if variance <= 0:
        return 0.0
    return _covariance(stock_returns, concept_returns) / variance


def _linear_slope(values: list[float]) -> float:
    series = [value for value in values if value is not None]
    size = len(series)
    if size < 2:
        return 0.0
    xs = list(range(size))
    x_mean = _mean(xs)
    y_mean = _mean(series)
    numerator = sum((x - x_mean) * (y - y_mean) for x, y in zip(xs, series))
    denominator = sum((x - x_mean) ** 2 for x in xs)
    if denominator == 0:
        return 0.0
    return numerator / denominator


def _quantile(values: list[float], q: float, default: float = 0.0) -> float:
    clean = sorted(value for value in values if isinstance(value, (int, float)) and math.isfinite(value))
    if not clean:
        return default
    if len(clean) == 1:
        return clean[0]
    q = min(max(q, 0.0), 1.0)
    pos = (len(clean) - 1) * q
    lower = math.floor(pos)
    upper = math.ceil(pos)
    if lower == upper:
        return clean[lower]
    weight = pos - lower
    return clean[lower] * (1 - weight) + clean[upper] * weight


def _normalize_to_base(series: list[float | None], base: float = 1000.0) -> list[float | None]:
    first = next((value for value in series if value is not None and value > 0), None)
    if first is None:
        return [None for _ in series]
    return [round((value / first) * base, 2) if value is not None else None for value in series]


def _moving_average(series: list[float | None], period: int) -> list[float | None]:
    output: list[float | None] = []
    history: list[float] = []
    for value in series:
        if value is not None:
            history.append(value)
        if value is None or len(history) < period:
            output.append(None)
            continue
        window = history[-period:]
        output.append(round(_mean(window), 2))
    return output


def _series_pct_change(series: list[float | None], lookback: int | None = None) -> float:
    values = [value for value in series if value is not None and value > 0]
    if len(values) < 2:
        return 0.0
    if lookback is not None and lookback > 0 and len(values) > lookback:
        start = values[-(lookback + 1)]
        end = values[-1]
    else:
        start = values[0]
        end = values[-1]
    if not start:
        return 0.0
    return ((end - start) / start) * 100


def _classify_correlation(correlation: float) -> dict:
    if correlation >= 0.8:
        return {"key": "strong-positive", "label": "强相关", "type": "danger"}
    if correlation >= 0.45:
        return {"key": "weak-positive", "label": "中等相关", "type": "warning"}
    if correlation >= 0.15:
        return {"key": "neutral", "label": "弱相关", "type": "info"}
    return {"key": "negative", "label": "低同步", "type": "success"}


def _classify_trend_direction(normalized_close: list[float | None], ma20: list[float | None]) -> str:
    valid_close = [value for value in normalized_close if value is not None]
    if len(valid_close) < 5:
        return "flat"
    tail = valid_close[-8:]
    slope = _linear_slope(tail)
    avg = _mean(tail)
    slope_pct = (slope / avg) * 100 if avg else 0.0
    last_close = valid_close[-1]
    last_ma20 = next((value for value in reversed(ma20) if value is not None), None)

    if slope_pct >= 0.18 and (last_ma20 is None or last_close >= last_ma20):
        return "up"
    if slope_pct <= -0.18 and (last_ma20 is None or last_close <= last_ma20):
        return "down"
    return "flat"


def _classify_ma_pattern(series: dict[str, list[float | None]]) -> dict:
    close = series.get("close") or []
    ma5 = series.get("ma5") or []
    ma10 = series.get("ma10") or []
    ma20 = series.get("ma20") or []
    ma30 = series.get("ma30") or []
    if not close:
        return {"key": "mixed", "label": "均线缠绕", "type": "info"}

    last_index = len(close) - 1
    last_close = close[last_index]
    values = [ma5[last_index], ma10[last_index], ma20[last_index], ma30[last_index]]
    if any(value is None for value in values) or last_close in {None, 0}:
        return {"key": "mixed", "label": "均线缠绕", "type": "info"}

    ma5_last, ma10_last, ma20_last, ma30_last = [float(value) for value in values]
    max_spread_pct = ((max(values) - min(values)) / float(last_close)) * 100 if last_close else 0.0
    ma5_slope = _linear_slope([value for value in ma5[-5:] if value is not None])
    ma10_slope = _linear_slope([value for value in ma10[-5:] if value is not None])
    ma20_slope = _linear_slope([value for value in ma20[-5:] if value is not None])

    if ma5_last > ma10_last > ma20_last > ma30_last and min(ma5_slope, ma10_slope, ma20_slope) > 0:
        return {"key": "bullish-stack", "label": "多头排列", "type": "danger"}
    if ma5_last < ma10_last < ma20_last < ma30_last and max(ma5_slope, ma10_slope, ma20_slope) < 0:
        return {"key": "bearish-stack", "label": "空头排列", "type": "success"}

    prev_ma5 = ma5[last_index - 1] if last_index >= 1 else None
    prev_ma10 = ma10[last_index - 1] if last_index >= 1 else None
    if prev_ma5 is not None and prev_ma10 is not None:
        if prev_ma5 <= prev_ma10 and ma5_last > ma10_last:
            return {"key": "golden-cross", "label": "黄金交叉", "type": "warning"}
        if prev_ma5 >= prev_ma10 and ma5_last < ma10_last:
            return {"key": "death-cross", "label": "死叉压制", "type": "info"}

    if max_spread_pct <= 1.5:
        return {"key": "mixed", "label": "均线缠绕", "type": "info"}
    return {"key": "mixed", "label": "均线分化", "type": "info"}


def _format_trade_day(trade_day: date) -> str:
    return trade_day.strftime("%m-%d")


def _fetch_concept_daily_rows(concept_id: str, lookback_days: int) -> list[dict]:
    sql = """
        WITH trade_days AS (
            SELECT DISTINCT ts::date AS trade_day
            FROM stock_time_sharing_compat st
            JOIN concept_stocks cs ON cs.stock_code = st.stock_code
            WHERE cs.concept_id = %s
              AND st.ts <= NOW()
            ORDER BY trade_day DESC
            LIMIT %s
        ),
        intraday_rows AS (
            SELECT
                cs.stock_code,
                COALESCE(s.name, cs.stock_code) AS stock_name,
                st.ts::date AS trade_day,
                st.ts,
                st.open,
                st.high,
                st.low,
                st.close
            FROM concept_stocks cs
            LEFT JOIN stocks s ON s.code = cs.stock_code
            JOIN stock_time_sharing_compat st ON st.stock_code = cs.stock_code
            WHERE cs.concept_id = %s
              AND st.ts::date IN (SELECT trade_day FROM trade_days)
        ),
        daily_rows AS (
            SELECT DISTINCT
                stock_code,
                stock_name,
                trade_day,
                FIRST_VALUE(open) OVER day_window AS open,
                MAX(high) OVER day_window AS high,
                MIN(low) OVER day_window AS low,
                FIRST_VALUE(close) OVER day_window_desc AS close
            FROM intraday_rows
            WINDOW
                day_window AS (
                    PARTITION BY stock_code, trade_day
                    ORDER BY ts ASC
                    ROWS BETWEEN UNBOUNDED PRECEDING AND UNBOUNDED FOLLOWING
                ),
                day_window_desc AS (
                    PARTITION BY stock_code, trade_day
                    ORDER BY ts DESC
                    ROWS BETWEEN UNBOUNDED PRECEDING AND UNBOUNDED FOLLOWING
                )
        )
        SELECT stock_code, stock_name, trade_day, open, high, low, close
        FROM daily_rows
        ORDER BY trade_day ASC, stock_code ASC
    """
    with get_conn() as conn:
        with conn.cursor() as cur:
            cur.execute(sql, (concept_id, lookback_days, concept_id))
            return cur.fetchall()


def _fetch_concept_intraday_rows(concept_id: str) -> list[dict]:
    sql = """
        WITH latest_trade_day AS (
            SELECT MAX(st.ts::date) AS trade_day
            FROM stock_time_sharing_compat st
            JOIN concept_stocks cs ON cs.stock_code = st.stock_code
            WHERE cs.concept_id = %s
              AND st.ts <= NOW()
        )
        SELECT
            cs.stock_code,
            COALESCE(s.name, cs.stock_code) AS stock_name,
            st.ts,
            st.close
        FROM concept_stocks cs
        LEFT JOIN stocks s ON s.code = cs.stock_code
        JOIN stock_time_sharing_compat st ON st.stock_code = cs.stock_code
        WHERE cs.concept_id = %s
          AND st.ts::date = (SELECT trade_day FROM latest_trade_day)
          AND st.ts <= NOW()
        ORDER BY cs.stock_code ASC, st.ts ASC
    """
    with get_conn() as conn:
        with conn.cursor() as cur:
            cur.execute(sql, (concept_id, concept_id))
            return cur.fetchall()


def _build_intraday_return_context(concept_id: str) -> dict:
    rows = _fetch_concept_intraday_rows(concept_id)
    price_by_stock: dict[str, dict[Any, float]] = defaultdict(dict)
    for row in rows:
        code = str(row.get("stock_code") or "")
        ts = row.get("ts")
        close = _safe_float(row.get("close"), None)
        if not code or ts is None or close is None or close <= 0:
            continue
        price_by_stock[code][ts] = close

    returns_by_stock: dict[str, dict[Any, float]] = {}
    for code, price_map in price_by_stock.items():
        previous_close: float | None = None
        returns: dict[Any, float] = {}
        for ts in sorted(price_map):
            close = price_map[ts]
            if previous_close and previous_close > 0:
                returns[ts] = (close / previous_close) - 1
            previous_close = close
        returns_by_stock[code] = returns

    concept_return_by_ts: dict[Any, float] = {}
    timestamps = sorted({ts for return_map in returns_by_stock.values() for ts in return_map})
    for ts in timestamps:
        values = [
            return_map[ts]
            for return_map in returns_by_stock.values()
            if ts in return_map and math.isfinite(return_map[ts])
        ]
        if values:
            concept_return_by_ts[ts] = _mean(values)

    return {
        "returnsByStock": returns_by_stock,
        "conceptReturnByTs": concept_return_by_ts,
        "pointCount": len(concept_return_by_ts),
    }


def _build_concept_analysis(concept_id: str, window: int = 30) -> dict | None:
    concept = fetch_concept_profile(concept_id)
    if concept is None:
        return None

    window = min(max(int(window or 30), 20), 90)
    lookback_days = max(window + 35, 70)
    rows = _fetch_concept_daily_rows(concept_id, lookback_days)
    if not rows:
        return {
            "id": concept["id"],
            "name": concept["name"],
            "days": window,
            "dataQuality": {
                "source": "postgres.stock_time_sharing",
                "tradeDayCount": 0,
                "activeStockCount": 0,
                "requestedWindow": window,
            },
            "conceptDirection": "flat",
            "conceptChangePct": 0.0,
            "conceptMaPattern": {"key": "mixed", "label": "均线缠绕", "type": "info"},
            "conceptSeries": {
                "dates": [],
                "open": [],
                "high": [],
                "low": [],
                "close": [],
                "ma4": [],
                "ma5": [],
                "ma8": [],
                "ma10": [],
                "ma12": [],
                "ma16": [],
                "ma20": [],
                "ma30": [],
            },
            "stocks": [],
        }

    stock_name_map: dict[str, str] = {}
    stock_day_close_map: dict[str, dict[date, float]] = defaultdict(dict)
    concept_ohlc_ratio_by_day: dict[date, dict[str, list[float]]] = defaultdict(lambda: {"open": [], "high": [], "low": []})
    trade_days_set: set[date] = set()
    for row in rows:
        code = str(row["stock_code"])
        trade_day = row["trade_day"]
        open_price = _safe_float(row.get("open"), None)
        high_price = _safe_float(row.get("high"), None)
        low_price = _safe_float(row.get("low"), None)
        close = _safe_float(row.get("close"), None)
        if not code or trade_day is None or close is None or close <= 0:
            continue
        stock_name_map[code] = str(row.get("stock_name") or code)
        stock_day_close_map[code][trade_day] = close
        if open_price is not None and open_price > 0:
            concept_ohlc_ratio_by_day[trade_day]["open"].append(open_price / close)
        if high_price is not None and high_price > 0:
            concept_ohlc_ratio_by_day[trade_day]["high"].append(high_price / close)
        if low_price is not None and low_price > 0:
            concept_ohlc_ratio_by_day[trade_day]["low"].append(low_price / close)
        trade_days_set.add(trade_day)

    trade_days = sorted(trade_days_set)
    if len(trade_days) < 2:
        return None

    daily_returns_by_stock: dict[str, dict[date, float]] = {}
    for code, close_map in stock_day_close_map.items():
        returns_map: dict[date, float] = {}
        previous_close: float | None = None
        for trade_day in sorted(close_map):
            close = close_map[trade_day]
            if previous_close and previous_close > 0:
                returns_map[trade_day] = (close / previous_close) - 1
            previous_close = close
        daily_returns_by_stock[code] = returns_map

    concept_return_by_day: dict[date, float] = {}
    for trade_day in trade_days:
        values = [
            return_map[trade_day]
            for return_map in daily_returns_by_stock.values()
            if trade_day in return_map and math.isfinite(return_map[trade_day])
        ]
        if values:
            concept_return_by_day[trade_day] = _mean(values)

    concept_index_by_day: dict[date, float] = {}
    index_value = 1000.0
    for idx, trade_day in enumerate(trade_days):
        if idx == 0:
            concept_index_by_day[trade_day] = round(index_value, 2)
            continue
        daily_return = concept_return_by_day.get(trade_day, 0.0)
        index_value *= (1 + daily_return)
        concept_index_by_day[trade_day] = round(index_value, 2)

    visible_days = trade_days[-window:]
    visible_dates = [_format_trade_day(day) for day in visible_days]
    concept_close_all = [concept_index_by_day.get(day) for day in trade_days]
    concept_open_all: list[float | None] = []
    concept_high_all: list[float | None] = []
    concept_low_all: list[float | None] = []
    for day, close in zip(trade_days, concept_close_all):
        if close is None:
            concept_open_all.append(None)
            concept_high_all.append(None)
            concept_low_all.append(None)
            continue
        ratios = concept_ohlc_ratio_by_day.get(day, {})
        open_value = close * _mean(ratios.get("open", [])) if ratios.get("open") else close
        high_value = close * _mean(ratios.get("high", [])) if ratios.get("high") else max(open_value, close)
        low_value = close * _mean(ratios.get("low", [])) if ratios.get("low") else min(open_value, close)
        high_value = max(high_value, open_value, close)
        low_value = min(low_value, open_value, close)
        concept_open_all.append(round(open_value, 2))
        concept_high_all.append(round(high_value, 2))
        concept_low_all.append(round(low_value, 2))
    visible_start = len(trade_days) - len(visible_days)
    concept_series = {
        "dates": visible_dates,
        "open": concept_open_all[visible_start:],
        "high": concept_high_all[visible_start:],
        "low": concept_low_all[visible_start:],
        "close": concept_close_all[visible_start:],
    }
    concept_series["ma5"] = _moving_average(concept_close_all, 5)[visible_start:]
    concept_series["ma4"] = _moving_average(concept_close_all, 4)[visible_start:]
    concept_series["ma8"] = _moving_average(concept_close_all, 8)[visible_start:]
    concept_series["ma10"] = _moving_average(concept_close_all, 10)[visible_start:]
    concept_series["ma12"] = _moving_average(concept_close_all, 12)[visible_start:]
    concept_series["ma16"] = _moving_average(concept_close_all, 16)[visible_start:]
    concept_series["ma20"] = _moving_average(concept_close_all, 20)[visible_start:]
    concept_series["ma30"] = _moving_average(concept_close_all, 30)[visible_start:]

    concept_close = concept_series["close"]
    concept_direction = _classify_trend_direction(concept_close, concept_series["ma20"])
    concept_change_pct = _round(_series_pct_change(concept_close), 2)
    intraday_context = _build_intraday_return_context(concept_id)
    intraday_returns_by_stock = intraday_context["returnsByStock"]
    intraday_concept_return_by_ts = intraday_context["conceptReturnByTs"]

    raw_metrics: list[dict] = []
    for code in sorted(stock_day_close_map):
        close_map = stock_day_close_map[code]
        aligned_close_all = [close_map.get(day) for day in trade_days]
        normalized_close_all = _normalize_to_base(aligned_close_all, base=1000.0)
        aligned_close = aligned_close_all[visible_start:]
        normalized_close = normalized_close_all[visible_start:]
        series = {
            "dates": visible_dates,
            "close": normalized_close,
        }
        series["ma5"] = _moving_average(normalized_close_all, 5)[visible_start:]
        series["ma10"] = _moving_average(normalized_close_all, 10)[visible_start:]
        series["ma20"] = _moving_average(normalized_close_all, 20)[visible_start:]
        series["ma30"] = _moving_average(normalized_close_all, 30)[visible_start:]

        overlap_stock_returns: list[float] = []
        overlap_concept_returns: list[float] = []
        for ts in sorted(intraday_returns_by_stock.get(code, {})):
            stock_return = intraday_returns_by_stock.get(code, {}).get(ts)
            concept_return = intraday_concept_return_by_ts.get(ts)
            if stock_return is None or concept_return is None:
                continue
            overlap_stock_returns.append(stock_return)
            overlap_concept_returns.append(concept_return)

        correlation = _pearson(overlap_stock_returns, overlap_concept_returns) if len(overlap_stock_returns) >= 5 else 0.0
        beta = _beta(overlap_stock_returns, overlap_concept_returns) if len(overlap_stock_returns) >= 5 else 0.0
        agreement_ratio = 0.0
        if overlap_stock_returns:
            same_direction_count = sum(
                1
                for stock_return, concept_return in zip(overlap_stock_returns, overlap_concept_returns)
                if stock_return == 0 or concept_return == 0 or (stock_return > 0 and concept_return > 0) or (stock_return < 0 and concept_return < 0)
            )
            agreement_ratio = same_direction_count / len(overlap_stock_returns)

        stock_vol = _stdev(overlap_stock_returns)
        residuals = [stock_return - (beta * concept_return) for stock_return, concept_return in zip(overlap_stock_returns, overlap_concept_returns)]
        tracking_error = _stdev(residuals)
        tracking_error_ratio = tracking_error / stock_vol if stock_vol > 0 else 0.0
        recent_change_pct = _round(_series_pct_change(aligned_close), 2)
        stock_change_5d = _series_pct_change(aligned_close, lookback=5)
        concept_change_5d = _series_pct_change(concept_close, lookback=5)
        excess_return_5d = stock_change_5d - concept_change_5d
        ma_pattern = _classify_ma_pattern(series)
        trend_direction = _classify_trend_direction(normalized_close, series["ma20"])
        raw_metrics.append(
            {
                "code": code,
                "name": stock_name_map.get(code, code),
                "history": series,
                "correlation": round(correlation, 4),
                "beta": round(beta, 4),
                "rSquared": round(max(correlation, -1.0) ** 2, 4),
                "agreementRatio": round(agreement_ratio, 4),
                "trackingError": round(tracking_error * 100, 4),
                "trackingErrorRatio": round(tracking_error_ratio, 4),
                "excessReturn5d": round(excess_return_5d, 2),
                "recentChangePct": recent_change_pct,
                "maPatternMeta": ma_pattern,
                "trendDirection": trend_direction,
            }
        )

    correlations = [item["correlation"] for item in raw_metrics]
    agreements = [item["agreementRatio"] for item in raw_metrics]
    tracking_ratios = [item["trackingErrorRatio"] for item in raw_metrics]
    excess_returns = [item["excessReturn5d"] for item in raw_metrics]

    strong_corr_threshold = max(0.7, _quantile(correlations, 0.75, 0.7))
    weak_corr_threshold = min(0.2, _quantile(correlations, 0.25, 0.2))
    strong_agreement_threshold = max(0.6, _quantile(agreements, 0.75, 0.6))
    weak_agreement_threshold = min(0.45, _quantile(agreements, 0.25, 0.45))
    stable_tracking_threshold = min(0.9, _quantile(tracking_ratios, 0.25, 0.9))
    leader_excess_threshold = max(2.5, _quantile(excess_returns, 0.75, 2.5))
    divergent_excess_threshold = max(3.0, _quantile([abs(value) for value in excess_returns], 0.75, 3.0))

    stocks: list[dict] = []
    for item in raw_metrics:
        correlation_meta = _classify_correlation(item["correlation"])
        role_label = "跟随股"
        if (
            item["correlation"] >= strong_corr_threshold
            and item["agreementRatio"] >= strong_agreement_threshold
            and item["trackingErrorRatio"] <= stable_tracking_threshold
        ):
            role_label = "核心联动股"
        if item["excessReturn5d"] >= leader_excess_threshold and item["correlation"] >= max(0.45, weak_corr_threshold):
            role_label = "领涨股"
        if (
            item["correlation"] <= weak_corr_threshold
            or item["agreementRatio"] <= weak_agreement_threshold
            or (abs(item["excessReturn5d"]) >= divergent_excess_threshold and item["excessReturn5d"] < 0)
        ):
            role_label = "背离股"

        trend_direction = item["trendDirection"]
        stocks.append(
            {
                "code": item["code"],
                "name": item["name"],
                "history": item["history"],
                "correlation": item["correlation"],
                "correlationLabel": correlation_meta["label"],
                "correlationType": correlation_meta["type"],
                "correlationCategory": correlation_meta["key"],
                "beta": item["beta"],
                "rSquared": item["rSquared"],
                "agreementRatio": item["agreementRatio"],
                "trackingError": item["trackingError"],
                "trackingErrorRatio": item["trackingErrorRatio"],
                "excessReturn5d": item["excessReturn5d"],
                "maPattern": item["maPatternMeta"]["label"],
                "maPatternType": item["maPatternMeta"]["type"],
                "maPatternKey": item["maPatternMeta"]["key"],
                "trendDirection": trend_direction,
                "trendLabel": "上涨" if trend_direction == "up" else "下跌" if trend_direction == "down" else "震荡",
                "roleLabel": role_label,
                "recentChangePct": item["recentChangePct"],
            }
        )

    stocks.sort(key=lambda item: (item["correlation"], item["recentChangePct"]), reverse=True)

    return {
        "id": concept["id"],
        "name": concept["name"],
        "days": window,
        "dataQuality": {
            "source": "postgres.stock_time_sharing",
            "tradeDayCount": len(trade_days),
            "activeStockCount": len(stocks),
            "requestedWindow": window,
            "correlationSource": "intraday",
            "correlationPointCount": intraday_context["pointCount"],
        },
        "conceptDirection": concept_direction,
        "conceptChangePct": concept_change_pct,
        "conceptMaPattern": _classify_ma_pattern(concept_series),
        "conceptSeries": concept_series,
        "stocks": stocks,
    }


def fetch_concept_analysis(concept_id: str, window: int = 30) -> dict | None:
    normalized_id = str(concept_id or "").strip()
    normalized_window = min(max(int(window or 30), 20), 90)
    return app_cache.get_or_set(
        f"concept:analysis:v5-intraday:{normalized_id}:{normalized_window}",
        ttl_seconds=60,
        factory=lambda: _build_concept_analysis(normalized_id, normalized_window),
    )
