# Stock Visualization

This repository now uses a clearer full-stack layout with separate frontend and backend apps.

## Directory structure

```text
.
├─ frontend/   # Vue 3 application
├─ backend/    # FastAPI service
├─ docs/
└─ mockups/
```

## Frontend

```powershell
cd frontend
npm install
npm run serve
```

Build for production:

```powershell
cd frontend
npm run build
```

## Backend

```powershell
cd backend
python -m venv .venv
.venv\Scripts\Activate.ps1
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

## Notes

- The frontend dev server proxies `/api` and `/health` to `http://127.0.0.1:8000`.
- Existing root-level `node_modules/` and `dist/` are leftover artifacts from the old layout and can be removed later if you no longer need them.
