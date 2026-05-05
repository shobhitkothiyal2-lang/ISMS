# ISMS

ISMS is a React frontend with a Flask API backend. The repo is now structured to deploy cleanly on Render as:

- `isms-api`: Python web service
- `isms-frontend`: Static site
- `isms-db`: Render PostgreSQL database

## Local development

Backend:

```bash
cd backend
pip install -r requirements.txt
python create_db.py
python app.py
```

Frontend:

```bash
cd frontend
npm install
npm run dev
```

Frontend dev server runs on `http://localhost:3000` and expects the API at `http://localhost:5000` unless `VITE_API_BASE_URL` is set.

## Render deployment

This repo includes [render.yaml](/c:/novaPRO/isms/ISMS/render.yaml) for Blueprint deploys.

### Backend behavior

- Uses `DATABASE_URL` from Render and normalizes Postgres URLs for SQLAlchemy.
- Exposes `/healthz` for health checks.
- Removes import-time database initialization so Gunicorn starts cleanly.
- Runs schema creation and default superadmin seeding via `python create_db.py` in `preDeployCommand`.
- Uses signed Flask cookies instead of filesystem-backed server sessions, which is safer for stateless hosting.

### Required environment values

Render will generate or wire these automatically from `render.yaml`:

- `DATABASE_URL`
- `SECRET_KEY`
- `JWT_SECRET_KEY`
- `IS_PRODUCTION=true`
- `SESSION_COOKIE_SECURE=true`
- `SESSION_COOKIE_SAMESITE=None`

You still need to set these values after the first Blueprint deploy:

- `ALLOWED_ORIGINS=https://<your-frontend>.onrender.com`
- `VITE_API_BASE_URL=https://<your-api>.onrender.com`

## Default credentials

The deployment seed creates:

- Username: `superadmin`
- Password: value of `SUPERADMIN_DEFAULT_PASSWORD` if set, otherwise `ChangeMe@123!`

Set `SUPERADMIN_DEFAULT_PASSWORD` on Render before first production deploy if you do not want the fallback password to be used.
