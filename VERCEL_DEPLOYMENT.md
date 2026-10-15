# REUNITE — Deployment Guide (Vercel + Railway)

This guide walks you through deploying REUNITE end-to-end:

| Layer | Platform | Cost |
|---|---|---|
| **Frontend** | [Vercel](https://vercel.com) | Free tier |
| **Backend API** | [Railway](https://railway.app) | Free trial / $5/mo hobby |
| **Database** | Railway PostgreSQL | Included |
| **Media Storage** | Cloudinary | Free tier (25 GB) |

> **Why two platforms?**
> Vercel only serves static files and serverless functions — it cannot run a persistent Django process.
> Railway runs the Django + Gunicorn server with a persistent PostgreSQL database.

---

## Architecture Overview

```
Browser
  │
  ├─── https://<project>.vercel.app  ──► Vercel  (React static bundle)
  │         │
  │         │  VITE_API_URL (all /api/* requests)
  │         ▼
  └─── https://<project>.up.railway.app  ──► Railway  (Django + Gunicorn)
                                                 │
                                                 ├─── PostgreSQL (Railway)
                                                 └─── Cloudinary (media files)
```

---

## Step 1 — Prepare the Backend for Production

### 1.1 Add a `Procfile` (Railway uses this to start the server)

A `Procfile` is already at the root of the `backend/` directory. If it doesn't exist, create it:

```
# backend/Procfile
web: gunicorn reunite_backend.wsgi:application --bind 0.0.0.0:$PORT
release: python manage.py migrate --no-input
```

Create it now:

```bash
# From project root:
echo "web: gunicorn reunite_backend.wsgi:application --bind 0.0.0.0:`$PORT" > backend/Procfile
echo "release: python manage.py migrate --no-input" >> backend/Procfile
```

### 1.2 Add `runtime.txt` (pin Python version for Railway)

```bash
echo "python-3.11.9" > backend/runtime.txt
```

### 1.3 Add `whitenoise` for static file serving

Django needs `whitenoise` to serve its own static files (admin panel, etc.) without a separate web server.

```bash
cd backend
pip install whitenoise
```

Add to `requirements.txt`:
```
whitenoise==6.9.0
```

Then in `backend/reunite_backend/settings.py`, add `whitenoise` to `MIDDLEWARE` **immediately after** `SecurityMiddleware`:

```python
MIDDLEWARE = [
    'django.middleware.security.SecurityMiddleware',
    'whitenoise.middleware.WhiteNoiseMiddleware',   # ← add this line
    'corsheaders.middleware.CorsMiddleware',
    ...
]
```

Also add to `INSTALLED_APPS`:
```python
'whitenoise.runserver_nostatic',   # ← before staticfiles
'django.contrib.staticfiles',
```

And add this setting for compressed static files:
```python
STATICFILES_STORAGE = 'whitenoise.storage.CompressedManifestStaticFilesStorage'
```

### 1.4 Collect static files locally to test

```bash
cd backend
python manage.py collectstatic --no-input
```

### 1.5 Commit everything to GitHub

```bash
cd ..  # back to project root
git add backend/Procfile backend/runtime.txt backend/requirements.txt backend/reunite_backend/settings.py
git commit -m "chore: prepare backend for Railway deployment"
git push origin main
```

---

## Step 2 — Deploy Backend on Railway

### 2.1 Create a Railway account

Go to [railway.app](https://railway.app) → **Login with GitHub**

### 2.2 Create a new project

1. Click **"New Project"**
2. Select **"Deploy from GitHub repo"**
3. Search for and select `Arnav2306/reunite`
4. Railway will detect the repo

### 2.3 Configure the deployment root directory

Railway needs to know your Django app lives in `backend/`, not the root.

1. Click on your service → **Settings** tab
2. Under **"Root Directory"**, set it to: `backend`
3. Under **"Build Command"**: leave empty (Railway detects `requirements.txt` automatically)
4. Under **"Start Command"**: `gunicorn reunite_backend.wsgi:application --bind 0.0.0.0:$PORT`

### 2.4 Add PostgreSQL database

1. In your Railway project dashboard, click **"+ New"**
2. Select **"Database"** → **"Add PostgreSQL"**
3. Railway automatically creates a `DATABASE_URL` environment variable and injects it into your service

### 2.5 Set backend environment variables

In your Railway service → **Variables** tab, add the following:

```
DJANGO_SECRET_KEY=<generate a strong 50-char random key>
DJANGO_DEBUG=False
DJANGO_ALLOWED_HOSTS=<your-project>.up.railway.app
CORS_ALLOWED_ORIGINS=https://<your-vercel-frontend>.vercel.app
CSRF_TRUSTED_ORIGINS=https://<your-project>.up.railway.app
GEMINI_API_KEY=<your-gemini-api-key-here>
GEMINI_MODEL=gemini-3.5-flash-lite
CLOUDINARY_CLOUD_NAME=<your-cloudinary-cloud-name>
CLOUDINARY_API_KEY=<your-cloudinary-api-key>
CLOUDINARY_API_SECRET=<your-cloudinary-api-secret>
```

> **Generate a strong secret key:**
> ```bash
> python -c "import secrets; print(secrets.token_urlsafe(50))"
> ```

> **Note:** You don't need to set `DATABASE_URL` — Railway injects it automatically from the PostgreSQL plugin.

### 2.6 Add a release command (runs migrations on every deploy)

Railway supports a `release` phase in the `Procfile`. The line `release: python manage.py migrate --no-input` already handles this. Nothing extra needed.

### 2.7 Create a superuser on Railway

After first successful deploy, open the Railway shell:

1. In Railway dashboard → your service → **"Shell"** tab (or click "Connect")
2. Run:
```bash
python manage.py createsuperuser
```

### 2.8 Note your Railway backend URL

It will look like: `https://reunite-production-xxxx.up.railway.app`

You'll need this for the frontend configuration.

---

## Step 3 — Set Up Media File Storage (Cloudinary)

> **Why this is needed:** Railway's filesystem is ephemeral — uploaded images are deleted on every deploy. Cloudinary stores them permanently.

### 3.1 Create a Cloudinary account

Go to [cloudinary.com](https://cloudinary.com) → Sign up for free (25 GB storage included)

### 3.2 Install `django-cloudinary-storage`

```bash
cd backend
pip install django-cloudinary-storage cloudinary
```

Add to `requirements.txt`:
```
cloudinary==1.42.1
django-cloudinary-storage==0.3.0
```

### 3.3 Configure settings for Cloudinary

In `backend/reunite_backend/settings.py`, add:

```python
# ─── Cloudinary Media Storage (production) ──────────────────────────────────
CLOUDINARY_CLOUD_NAME = os.environ.get('CLOUDINARY_CLOUD_NAME', '')
CLOUDINARY_API_KEY = os.environ.get('CLOUDINARY_API_KEY', '')
CLOUDINARY_API_SECRET = os.environ.get('CLOUDINARY_API_SECRET', '')

if CLOUDINARY_CLOUD_NAME:
    import cloudinary
    cloudinary.config(
        cloud_name=CLOUDINARY_CLOUD_NAME,
        api_key=CLOUDINARY_API_KEY,
        api_secret=CLOUDINARY_API_SECRET,
        secure=True,
    )
    DEFAULT_FILE_STORAGE = 'cloudinary_storage.storage.MediaCloudinaryStorage'
```

Also add `'cloudinary_storage'` and `'cloudinary'` to `INSTALLED_APPS` (before `staticfiles`).

### 3.4 Add Cloudinary variables to Railway

In Railway → Variables:
```
CLOUDINARY_CLOUD_NAME=<your-cloud-name>
CLOUDINARY_API_KEY=<your-api-key>
CLOUDINARY_API_SECRET=<your-api-secret>
```

Find these values in your Cloudinary Dashboard → **API Keys**.

### 3.5 Commit changes

```bash
git add backend/requirements.txt backend/reunite_backend/settings.py
git commit -m "feat: add Cloudinary media storage for production"
git push origin main
```

Railway will automatically redeploy.

---

## Step 4 — Deploy Frontend on Vercel

### 4.1 Create a Vercel account

Go to [vercel.com](https://vercel.com) → **Continue with GitHub**

### 4.2 Import your repository

1. Click **"Add New Project"**
2. Find `Arnav2306/reunite` and click **"Import"**

### 4.3 Configure the project settings

Vercel may auto-detect Vite. If not, set manually:

| Setting | Value |
|---|---|
| **Framework Preset** | `Vite` |
| **Root Directory** | `frontend` |
| **Build Command** | `npm run build` |
| **Output Directory** | `dist` |
| **Install Command** | `npm install` |

### 4.4 Set frontend environment variable

In the **"Environment Variables"** section during import (or later in Project Settings → Environment Variables):

```
VITE_API_URL=https://<your-railway-backend>.up.railway.app
```

Replace `<your-railway-backend>` with your actual Railway URL from Step 2.8.

### 4.5 Deploy

Click **"Deploy"**. Vercel builds and deploys the React app.

Your frontend URL will be: `https://reunite-<hash>.vercel.app`

> **Set a custom domain (optional):** In Vercel → Project → Domains → add your college domain.

---

## Step 5 — Connect Frontend ↔ Backend (CORS)

Now that you have both URLs, update the Railway environment variables:

In Railway → your service → Variables:

```
CORS_ALLOWED_ORIGINS=https://reunite-<hash>.vercel.app
CSRF_TRUSTED_ORIGINS=https://reunite-<hash>.vercel.app,https://reunite-production-xxxx.up.railway.app
DJANGO_ALLOWED_HOSTS=reunite-production-xxxx.up.railway.app
```

Trigger a redeploy in Railway (Settings → "Redeploy latest deployment").

---

## Step 6 — Verify the Full Deployment

### 6.1 Health check

Open in browser:
```
https://<your-railway-backend>.up.railway.app/api/health/
```

Expected response:
```json
{"status": "ok"}
```

### 6.2 Admin panel

```
https://<your-railway-backend>.up.railway.app/admin/
```

Login with the superuser credentials you created.

### 6.3 Frontend

```
https://reunite-<hash>.vercel.app
```

Try signing up, logging in, and checking if API calls reach the backend (open browser DevTools → Network tab).

### 6.4 AI inference check

In Railway shell:
```bash
python manage.py test_ai_inference
```

---

## Step 7 — Set Up Campus Stations (Production)

In the Railway shell:

```bash
# Copy your campus_stations.json content or upload via GitHub, then:
python manage.py setup_campus_stations --file campus_stations.json
```

Alternatively, use the Django Admin panel at `/admin/` to create stations manually.

---

## Post-Deployment Checklist

- [ ] `DJANGO_DEBUG=False` is set in Railway
- [ ] `DJANGO_SECRET_KEY` is a strong random key (not the dev default)
- [ ] `CORS_ALLOWED_ORIGINS` contains only your Vercel frontend URL
- [ ] PostgreSQL database is connected (Railway plugin)
- [ ] Superuser account created via Railway shell
- [ ] `GEMINI_API_KEY` is set and verified (`test_ai_inference` passes)
- [ ] Cloudinary credentials set (media file uploads persist)
- [ ] Campus stations loaded via `setup_campus_stations`
- [ ] Frontend `VITE_API_URL` points to the Railway backend URL
- [ ] Health endpoint returns `{"status": "ok"}`
- [ ] Admin panel accessible at `/admin/`

---

## Automatic Redeployment

Both platforms redeploy automatically on every `git push origin main`:

- **Vercel** → rebuilds the React bundle and serves it
- **Railway** → rebuilds the Python image, runs `migrate`, and restarts Gunicorn

---

## Troubleshooting

### CORS errors in the browser

**Symptom:** `Access-Control-Allow-Origin` error in DevTools Network tab.

**Fix:** Make sure `CORS_ALLOWED_ORIGINS` in Railway contains the **exact** Vercel URL (including `https://`, no trailing slash).

---

### 500 errors on the backend

**Symptom:** API calls return `500 Internal Server Error`.

**Fix:** Check Railway logs (Service → Logs tab). Common causes:
- `DATABASE_URL` not connected (add PostgreSQL plugin)
- Missing `DJANGO_SECRET_KEY`
- Unapplied migrations (Railway `release` command should handle this)

---

### Images not persisting after redeploy

**Symptom:** Uploaded item photos disappear after Railway redeploys.

**Fix:** Configure Cloudinary (Step 3). Local filesystem storage is ephemeral on Railway.

---

### Frontend shows blank page / 404 on refresh

**Symptom:** Direct URL navigation (e.g. `/dashboard`) gives a 404 on Vercel.

**Fix:** Add a `vercel.json` at the root of the `frontend/` folder:

```json
{
  "rewrites": [{ "source": "/(.*)", "destination": "/index.html" }]
}
```

Create this file:

```bash
echo '{"rewrites":[{"source":"/(.*)","destination":"/index.html"}]}' > frontend/vercel.json
git add frontend/vercel.json
git commit -m "fix: add Vercel SPA rewrite rule"
git push origin main
```

---

### Gemini API returning 503

**Symptom:** `Gemini API temporarily unavailable (HTTP 503 - high demand)`.

**Fix:** This is a transient error from Google's side. The system falls back to manual description automatically. Try again in a few minutes, or switch `GEMINI_MODEL` to `gemini-3.5-flash`.

---

## Cost Summary (Free Tiers)

| Service | Free Tier Limits | Notes |
|---|---|---|
| Vercel | 100 GB bandwidth/mo, unlimited deploys | More than enough for campus use |
| Railway | $5 trial credits | After trial: ~$5–10/month for hobby plan |
| Cloudinary | 25 GB storage, 25 GB bandwidth/mo | Sufficient for a campus pilot |
| Google Gemini | Free tier via AI Studio | Rate limits apply; graceful fallback built-in |

---

## Alternative Backend Hosting: Render

If you prefer [Render](https://render.com) over Railway:

1. Create a new **Web Service** → connect `Arnav2306/reunite`
2. Set **Root Directory**: `backend`
3. **Build Command**: `pip install -r requirements.txt && python manage.py collectstatic --no-input`
4. **Start Command**: `gunicorn reunite_backend.wsgi:application --bind 0.0.0.0:$PORT`
5. Add a **PostgreSQL** database from Render's dashboard
6. Set the same environment variables as Railway (Step 2.5)

The rest of the steps (Vercel frontend, Cloudinary, CORS config) remain identical.
