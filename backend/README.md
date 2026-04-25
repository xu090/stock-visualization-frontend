# Backend

## Setup

```powershell
cd backend
python -m venv .venv
.venv\Scripts\Activate.ps1
pip install -r requirements.txt
Copy-Item .env.example .env
uvicorn app.main:app --reload --port 8000
```

Then edit `backend\.env` and fill in:

- `POSTGRES_DSN`
- `STOCK_NAME_MAPPING_FILE`
- `STOCK_MARKET_CAP_MAPPING_FILE`
- `AUTO_BOOTSTRAP_CONCEPTS`

## Real-time flow

The backend reads market data directly from PostgreSQL table `stock_time_sharing`.
News data is read directly from PostgreSQL table `news_events`.

When `AUTO_BOOTSTRAP_CONCEPTS=true`, the backend will also initialize the built-in concept definitions into:

- `concepts`
- `concept_stocks`
- `stocks` (placeholder rows for missing constituent stocks)

Frontend quote cards and stock/concept pages read from:

- `POST /api/quotes`
- `GET /api/stocks/{code}/timesharing`
- `GET /api/concepts/overview`
- `GET /api/concepts/{concept_id}`
- `GET /api/concepts/{concept_id}/timesharing`
- `GET /api/news`
- `GET /api/news/{external_id}`
- `GET /api/select-strategies`
- `GET /api/select-strategies/{id}`
- `POST /api/select-strategies`
- `PATCH /api/select-strategies/{id}`
- `DELETE /api/select-strategies/{id}`
- `POST /api/admin/bootstrap/concepts`
- `POST /api/admin/backfill-stock-names`
- `POST /api/admin/bootstrap/select-strategies`

## Endpoints

- `GET /health`
- `POST /api/quotes`
- `GET /api/stocks/{code}/timesharing?limit=120`
- `GET /api/concepts/overview`
- `GET /api/concepts/{concept_id}`
- `GET /api/concepts/{concept_id}/timesharing?limit=120`

## Postman testing

### 1. Health check

`GET http://127.0.0.1:8000/health`

Expected response:

```json
{
  "ok": true,
  "postgres": "connected",
  "consumerEnabled": false
}
```

### 2. Latest quotes

`POST http://127.0.0.1:8000/api/quotes`

Headers:

```text
Content-Type: application/json
```

Body:

```json
{
  "codes": ["600801", "603501", "600841"]
}
```

Response example:

```json
{
  "data": [
    {
      "code": "600801",
      "price": 22.8,
      "close": 22.8,
      "preClose": 22.8,
      "open": 22.8,
      "high": 22.81,
      "low": 22.78,
      "changePercent": -1.3,
      "change": -1.3,
      "changeAmount": -0.3,
      "amount": 2180834.0,
      "volume": 95700,
      "turnover": 0.005,
      "amplitude": 0.13,
      "volumeRatio": 0.007,
      "ts": 1776136860000
    }
  ]
}
```

### 3. Minute time-sharing data

`GET http://127.0.0.1:8000/api/stocks/600801/timesharing?limit=10`

Response example:

```json
{
  "data": [
    {
      "code": "600801",
      "marketCode": "SH",
      "ts": 1776136860000,
      "open": 22.8,
      "close": 22.8,
      "high": 22.81,
      "low": 22.78,
      "volume": 95700,
      "amount": 2180834.0,
      "preClose": 22.8,
      "changePercent": -1.3,
      "amplitude": 0.13
    }
  ]
}
```

### 4. Verify the database directly

Run in PostgreSQL:

```sql
SELECT COUNT(*) FROM stock_time_sharing;
```

```sql
SELECT code, market_code, timestamps, close, vol, amount
FROM stock_time_sharing
ORDER BY timestamps DESC
LIMIT 20;
```

## Concept APIs

The senior's industry-index code was adapted into concept aggregation logic for this project:

- concept overview metrics are aggregated from `concepts + concept_stocks + stock_time_sharing`
- concept time-sharing curves are equal-weight aggregates of constituent stocks
- no MySQL sector sub-tables are required; everything uses the current PostgreSQL schema

If you want to manually re-sync the default concept definitions, call:

`POST http://127.0.0.1:8000/api/admin/bootstrap/concepts`

Example response:

```json
{
  "ok": true,
  "data": {
    "conceptCount": 17,
    "stockCount": 30,
    "relationCount": 75
  }
}
```

## News APIs

### 1. Latest news list

`GET http://127.0.0.1:8000/api/news?limit=20`

You can also filter by stock code:

`GET http://127.0.0.1:8000/api/news?stock_code=688167&limit=20`

Or search by keyword:

`GET http://127.0.0.1:8000/api/news?keyword=半导体&limit=20`

### 2. News detail

`GET http://127.0.0.1:8000/api/news/10000002343173`

### 3. Verify the database directly

```sql
SELECT external_id, title, source, stocks, publish_time
FROM news_events
ORDER BY publish_time DESC
LIMIT 20;
```

## Select Strategy APIs

### 1. Strategy list

`GET http://127.0.0.1:8000/api/select-strategies`

### 2. Strategy detail

`GET http://127.0.0.1:8000/api/select-strategies/1001`

### 3. Create custom strategy

`POST http://127.0.0.1:8000/api/select-strategies`

```json
{
  "name": "我的放量突破",
  "desc": "自定义筛选策略",
  "isFavorite": false,
  "isCustom": true,
  "enabled": true,
  "snapshot": {
    "scope": "all",
    "searchQuery": "",
    "selectedMetrics": ["change", "volRatio"],
    "filters": {
      "minChange": 1,
      "minVolRatio": 1.5,
      "minAmountY": 8
    }
  }
}
```

### 4. Update favorite/enabled/snapshot

`PATCH http://127.0.0.1:8000/api/select-strategies/1001`

```json
{
  "isFavorite": false,
  "enabled": true
}
```

### 5. Delete strategy

`DELETE http://127.0.0.1:8000/api/select-strategies/1007`

### 6. Re-sync preset select strategies

`POST http://127.0.0.1:8000/api/admin/bootstrap/select-strategies`

If you want to backfill Chinese stock names into existing rows in `stocks`, call:

`POST http://127.0.0.1:8000/api/admin/backfill-stock-names`

Example response:

```json
{
  "ok": true,
  "data": {
    "updated": 123
  }
}
```

To refresh stock market-cap data from AkShare, run:

```powershell
cd backend
.venv\Scripts\python.exe scripts\update_stock_market_cap_mapping.py
```

The generated mapping file is read from `STOCK_MARKET_CAP_MAPPING_FILE` and fills `mktCap` in quote, stock detail, and concept constituent responses. The source is `akshare.stock_zh_a_spot_em()`, and the unit is yuan.

### 1. Concept overview

`GET http://127.0.0.1:8000/api/concepts/overview`

Response example:

```json
{
  "data": [
    {
      "id": "semiconductor",
      "name": "半导体",
      "stockCount": 6,
      "activeStockCount": 6,
      "change": 1.42,
      "amount": 4567890123.0,
      "turnover": 2.31,
      "upRatio": 0.67,
      "limitUp": 1,
      "limitDown": 0,
      "strength": 61,
      "spike5m": 21.52,
      "volatility": 4.23,
      "latestTs": 1776136860000
    }
  ]
}
```

### 2. Concept detail with constituents

`GET http://127.0.0.1:8000/api/concepts/semiconductor`

Response shape:

```json
{
  "data": {
    "concept": {
      "id": "semiconductor",
      "name": "半导体"
    },
    "stocks": [
      {
        "code": "600703",
        "name": "三安光电",
        "price": 22.8,
        "changePercent": 1.3,
        "amount": 2180834.0
      }
    ]
  }
}
```

### 3. Concept minute curve

`GET http://127.0.0.1:8000/api/concepts/semiconductor/timesharing?limit=60`

Response shape:

```json
{
  "data": [
    {
      "marketCode": "SH",
      "ts": 1776136860000,
      "open": 22.31,
      "close": 22.44,
      "high": 22.56,
      "low": 22.18,
      "preClose": 22.05,
      "volume": 1234567,
      "amount": 98765432.0,
      "changePercent": 1.76,
      "amplitude": 2.31,
      "stockCount": 6
    }
  ]
}
```
