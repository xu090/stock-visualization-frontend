from typing import List

from fastapi import FastAPI
from pydantic import BaseModel


app = FastAPI(title="Stock Visualization Backend")


class QuoteRequest(BaseModel):
    codes: List[str]


def build_mock_quote(code: str) -> dict:
    seed = sum(ord(ch) for ch in code) or 1
    change_percent = round(((seed % 1200) / 100) - 6, 2)
    price = round(8 + (seed % 3000) / 100, 2)
    pre_close = round(price / (1 + change_percent / 100), 2) if change_percent != -100 else price
    change_amount = round(price - pre_close, 2)
    net_inflow = ((seed % 6000) - 3000) * 10000
    main_inflow = ((seed % 4000) - 2000) * 10000
    amount = ((seed % 50000) + 5000) * 10000
    volume_ratio = round(((seed % 240) / 100) + 0.6, 2)

    return {
        "code": code,
        "price": price,
        "close": price,
        "preClose": pre_close,
        "changePercent": change_percent,
        "change": change_percent,
        "changeAmount": change_amount,
        "netInflow": net_inflow,
        "mainInflow": main_inflow,
        "amount": amount,
        "volumeRatio": volume_ratio,
    }


@app.get("/health")
def health() -> dict:
    return {"ok": True}


@app.post("/api/quotes")
def get_quotes(payload: QuoteRequest) -> dict:
    rows = [build_mock_quote(code.strip()) for code in payload.codes if code and code.strip()]
    return {"data": rows}
