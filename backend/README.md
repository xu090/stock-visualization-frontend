# Backend

## Setup

```powershell
# from repository root
cd backend
python -m venv .venv
.venv\Scripts\Activate.ps1
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

## Endpoints

- `GET /health`
- `POST /api/quotes`

Example request:

```json
{
  "codes": ["600519", "300750"]
}
```

This is a scaffold service for frontend integration. Replace `build_mock_quote` in `app/main.py` with real market-data logic later.
