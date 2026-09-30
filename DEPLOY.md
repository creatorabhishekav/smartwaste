# Deploying SmartWaste 360 to Render

Render blueprint lives in [`render.yaml`](./render.yaml) and defines both services
from this one repository. No application code changes are required.

```
smartwaste-360/
├── frontend/   React + Vite  -> Render Static Site
└── backend/    FastAPI       -> Render Web Service
```

## 1. Push to GitHub

Render deploys from a Git repository, so this project must be pushed first.

```bash
cd "C:\Users\ASUS\Documents\Default Project\smartwaste-360"
git init
git add .
git status              # confirm .env, dist, *.db, media/ are NOT staged
git commit -m "SmartWaste 360 hackathon deployment"
git branch -M main
git remote add origin https://github.com/<you>/<repo>.git
git push -u origin main
```

`.gitignore` already excludes `.env`, `node_modules/`, `dist/`, `*.db`, `backend/media/`
and logs. `.env.example` files are committed and document every variable.

## 2. Deploy the backend first

Render dashboard -> **New** -> **Blueprint**, select this repo. Or use
**New** -> **Web Service** with these settings:

| Setting | Value |
| --- | --- |
| Root Directory | `backend` |
| Runtime | Python 3.12 |
| Build Command | `pip install -r requirements.txt` |
| Start Command | `uvicorn app.main:app --host 0.0.0.0 --port $PORT` |
| Health Check Path | `/health` |

Environment variables:

| Key | Value |
| --- | --- |
| `JWT_SECRET` | Render generates it automatically (`generateValue`) |
| `CORS_ORIGINS` | `https://<frontend-service-name>.onrender.com` |
| `SEED_ON_STARTUP` | `true` |
| `AI_PROVIDER` | `auto` |
| `GEMINI_API_KEY` | optional - omit to use the deterministic demo AI provider |
| `DATABASE_URL` | leave unset to use the SQLite fallback |

The service URL will be `https://<backend-service-name>.onrender.com`. Confirm it with
`curl https://<backend-service-name>.onrender.com/health` -> `{"status":"ok", ...}`.

## 3. Deploy the frontend

| Setting | Value |
| --- | --- |
| Root Directory | `frontend` |
| Build Command | `npm ci && npm run build` |
| Publish Directory | `./dist` |
| Type | Static Site |

Environment variables:

| Key | Value |
| --- | --- |
| `VITE_API_URL` | `https://<backend-service-name>.onrender.com` (no trailing slash) |

The blueprint adds the SPA rewrite `/* -> /index.html`, which `BrowserRouter` deep links
such as `/admin/analytics` require.

> `VITE_API_URL` is inlined into `dist/assets/*.js` at **build** time. Changing it in the
> Render dashboard requires a rebuild of the static site.

## 4. Smoke test the deployed pair

1. Open the frontend URL and confirm the landing page loads with live stats.
2. `GET <backend>/health` returns `status: ok` with `database: ok`.
3. Sign in with a demo account - **Get started / Demo accounts** on the login page:
   `citizen@demo.com`, `worker@demo.com`, `admin@demo.com`, password `demo123`.
4. Upload one photo from **Report Waste** and confirm it appears in **Admin > Complaints**.

## Notes and known limits

- **SQLite on Render is demo data only.** Render's filesystem is ephemeral, so the
  database is rebuilt and re-seeded (`SEED_ON_STARTUP=true`) on every deploy. Set
  `DATABASE_URL` to a managed Postgres instance for persistence.
- **Gemini is optional.** With no `GEMINI_API_KEY`, `DemoAIProvider` keeps the whole
  report -> analyse -> prioritise -> resolve flow working.
- **Uploaded media is ephemeral too** (`UPLOAD_DIR` defaults to `backend/media/`), so
  images disappear on redeploy for the same reason.
- Local development is unchanged: `python -m uvicorn app.main:app --host 127.0.0.1 --port 8000`
  in `backend/`, and `npm run dev` in `frontend/`.
