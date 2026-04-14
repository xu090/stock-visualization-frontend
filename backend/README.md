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
- `KAFKA_BOOTSTRAP_SERVERS`
- `KAFKA_STOCK_TIME_SHARING_TOPIC`
- `KAFKA_AUTO_OFFSET_RESET`

For first-time backfill into an empty table, set:

```env
KAFKA_AUTO_OFFSET_RESET=earliest
```

After the first successful load, you can switch it back to:

```env
KAFKA_AUTO_OFFSET_RESET=latest
```

## Real-time flow

The backend now consumes Kafka topic `stock-time-sharing-topic` and writes minute-level quotes into PostgreSQL table `stock_time_sharing`.

Frontend quote cards and stock/concept pages read from:

- `POST /api/quotes`
- `GET /api/stocks/{code}/timesharing`
- `GET /api/concepts/overview`
- `GET /api/concepts/{concept_id}`
- `GET /api/concepts/{concept_id}/timesharing`

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
  "consumerEnabled": true
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
SELECT stock_code, market_code, ts, close, vol, amount
FROM stock_time_sharing
ORDER BY ts DESC
LIMIT 20;
```

## Concept APIs

The senior's industry-index code was adapted into concept aggregation logic for this project:

- concept overview metrics are aggregated from `concepts + concept_stocks + stock_time_sharing`
- concept time-sharing curves are equal-weight aggregates of constituent stocks
- no MySQL sector sub-tables are required; everything uses the current PostgreSQL schema

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
