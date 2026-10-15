# REUNITE — Campus Lost & Found Recovery Platform

REUNITE is a full-stack web platform for college campuses that connects students who have lost belongings with items registered at HOD / faculty cabin recovery stations. It combines AI-assisted item description (Google Gemini Vision), deterministic attribute matching, and a secure custody-to-handover workflow.

---

## Table of Contents

- [Problem Statement](#problem-statement)
- [Core Workflow](#core-workflow)
- [Features](#features)
- [Technology Stack](#technology-stack)
- [Local Development Setup](#local-development-setup)
- [Environment Variables](#environment-variables)
- [AI Image Analysis](#ai-image-analysis)
- [Matching System](#matching-system)
- [OTP Verification](#otp-verification)
- [Campus Stations](#campus-stations)
- [API Reference](#api-reference)
- [Testing](#testing)
- [Deployment (Vercel + Railway/Render)](#deployment)
- [Security Notes](#security-notes)
- [Current Limitations](#current-limitations)

---

## Problem Statement

When items are lost on a college campus there is no structured, fast way to connect them with their owners. Items end up sitting in HOD cabins and faculty rooms with no visibility. Students have no way to search for or claim what they've lost. REUNITE brings the entire recovery lifecycle online.

---

## Core Workflow

```
FOUND ITEM
↓  Submitted at HOD / Faculty Cabin Recovery Station
↓  Custodian / Admin registers item + uploads photo
↓  AI (Gemini Vision) generates structured description
↓  Admin reviews and approves AI description
↓  Item published to student-facing catalog
↓  Students browse, or receive match notifications
↓  Student initiates claim with ownership evidence
↓  Admin reviews claim + verification answer
↓  Claim approved → Handover record created
↓  Valuable items → 6-digit OTP verification at collection point
↓  General items  → Custodian confirms physical collection
↓  Item marked RESOLVED
```

---

## Features

### Student
| Feature | Description |
|---|---|
| Report Lost Item | Category, description, location/time, smart ownership questions |
| Report Found Item | Photo-first flow with AI analysis → station drop-off |
| Browse Found Items | Published catalog with search and category filters |
| Possible Matches | Deterministic match scores with explainability breakdown |
| Claims | Claim an item with an ownership verification answer |
| Recovery Tracking | Full pipeline visibility from report to resolution |
| Notifications | In-app alerts for matches, claim status, approvals, handovers |
| Profile | User profile management |

### Admin / Custodian
| Feature | Description |
|---|---|
| Operational Dashboard | Live stats: pending reviews, claims, handovers, valuable items |
| Found Item Registry | Register items from HOD/faculty stations with AI assistance |
| Review & Publish | Review AI-generated descriptions, edit, publish for discovery |
| Claim Management | Inspect ownership answers, approve or reject claims |
| Verification Center | Side-by-side comparison of student answers vs. private attributes |
| Handover Management | Manage physical collection confirmations and OTP verifications |
| Campus Stations | View and manage collection point stations |
| Audit Logs | Full audit trail of all system actions |

---

## Technology Stack

### Backend
- **Python 3.11+** / **Django 6.1**
- **Django REST Framework 3.18** — API layer
- **SQLite** (development) / **PostgreSQL** (production)
- **Pillow 12** — image handling
- **django-cors-headers** — CORS support
- **python-dotenv** — environment variable loading
- **gunicorn** — production WSGI server
- Bearer Token + Session authentication
- Custom role-based permissions: `Student`, `Custodian`, `Admin`, `SuperAdmin`

### Frontend
- **React 18** + **TypeScript**
- **Vite 8** — build tool
- **TailwindCSS v4** — styling
- **TanStack React Query v5** — data fetching & caching
- **React Router v6** — client-side routing
- **React Hook Form + Zod** — form validation
- **Lucide React** — icons

### AI
- **Google Gemini Vision** (`gemini-3.5-flash-lite`) — item photo analysis via REST API
- Graceful fallback to manual description when API is unavailable

---

## Local Development Setup

### Prerequisites

| Tool | Version |
|---|---|
| Python | 3.11 or higher |
| Node.js | 20 or higher |
| npm | 10 or higher |
| Git | any recent version |

---

### 1 — Clone the Repository

```bash
git clone https://github.com/Arnav2306/reunite.git
cd reunite
```

---

### 2 — Backend Setup

```bash
# Create and activate a virtual environment
python -m venv .venv

# Windows
.venv\Scripts\activate

# macOS / Linux
source .venv/bin/activate

# Install all backend dependencies
pip install -r backend/requirements.txt

# Create the backend environment file
cp backend/.env.example backend/.env
# Open backend/.env and set at minimum:
#   GEMINI_API_KEY=<your-key>     ← AI analysis (already configured if using provided key)
#   DJANGO_SECRET_KEY=<strong-key> ← for production

# Run database migrations
cd backend
python manage.py migrate

# (Optional) Load campus stations
python manage.py setup_campus_stations --file ../campus_stations.json

# (Optional) Create a superuser / admin account
python manage.py createsuperuser

# Start the Django development server
python manage.py runserver
```

Backend is now running at **http://localhost:8000**

Django Admin: **http://localhost:8000/admin/**

---

### 3 — Frontend Setup

Open a new terminal:

```bash
cd frontend
npm install
npm run dev
```

Frontend is now running at **http://localhost:5173**

> The Vite dev server automatically proxies all `/api/*` requests to `http://127.0.0.1:8000`, so no extra configuration is needed for local development.

---

### 4 — Verify AI Integration (optional)

```bash
# From the project root:
python backend/manage.py test_ai_inference
```

Expected output when configured correctly:
```
=== Reunite AI Vision Inference Diagnostic ===
Primary Provider:   GEMINI (Model: gemini-3.5-flash-lite)
GEMINI_API_KEY:     [CONFIGURED]
[SUCCESS] AI Inference succeeded via: GEMINI
```

---

## Environment Variables

All variables are loaded from `.env` (root or `backend/`) automatically. See [`.env.example`](.env.example) for the full reference.

| Variable | Required | Default | Description |
|---|---|---|---|
| `DJANGO_SECRET_KEY` | **Yes (prod)** | insecure dev key | Django cryptographic secret key |
| `DJANGO_DEBUG` | No | `True` | Set `False` in production |
| `DJANGO_ALLOWED_HOSTS` | **Yes (prod)** | `*` in DEBUG | Comma-separated allowed host list |
| `CORS_ALLOWED_ORIGINS` | **Yes (prod)** | all in DEBUG | Comma-separated frontend origins |
| `GEMINI_API_KEY` | Recommended | — | Google Gemini API key for AI image analysis |
| `GEMINI_MODEL` | No | `gemini-3.5-flash-lite` | Gemini model identifier |
| `OPENAI_API_KEY` | No | — | Optional OpenAI fallback key |
| `DATABASE_URL` | No | SQLite | PostgreSQL URI (`postgres://user:pass@host:5432/db`) |
| `DB_ENGINE` | No | sqlite3 | Django database engine |
| `DB_NAME` | No | `db.sqlite3` | Database name |
| `DB_USER` | No | — | Database user |
| `DB_PASSWORD` | No | — | Database password |
| `DB_HOST` | No | `localhost` | Database host |
| `DB_PORT` | No | `5432` | Database port |
| `MEDIA_ROOT` | No | `backend/media/` | Persistent path for uploaded images |
| `MEDIA_URL` | No | `/media/` | Public URL prefix for media files |
| `STATIC_ROOT` | No | `backend/staticfiles/` | Collected static files directory |

---

## AI Image Analysis

The AI pipeline is powered by **Google Gemini Vision** and is fully advisory — no AI output is automatically published or used to approve any claim.

### How It Works

1. Admin uploads a found item photo
2. Backend encodes the image and calls Gemini Vision via REST API
3. Gemini returns a structured JSON description: category, title, color, brand, visible characteristics, risk tier, confidence
4. Admin reviews the suggestion, edits if needed, and approves
5. Only after admin approval is the description published to students

### Safety Constraints (enforced at the prompt level)

- AI **never** invents serial numbers, IMEI numbers, or ownership
- AI **only** describes what is physically visible in the photo
- Ambiguous details default to `"Unknown"`
- All output is flagged as AI-generated advisory content

### Graceful Fallback

If `GEMINI_API_KEY` is not set, the API returns a helpful advisory notice and item reporting continues with manual description — **no functionality is blocked**.

---

## Matching System

The matching engine is deterministic and fully explainable — no black-box scoring.

**Score formula (0–100):**

| Signal | Weight |
|---|---|
| Attribute / text similarity | 40 |
| Category match | 20 |
| Location proximity | 15 |
| Time proximity | 10 |
| Distinguishing features | 10 |
| Photo similarity | 0 (not yet implemented) |

**Score labels:**

| Range | Label |
|---|---|
| 85–100 | Strong Possible Match |
| 65–84 | Possible Match |
| 0–64 | Weak Match |

Scores are presented as `X / 100` and never described as probabilities.

---

## OTP Verification

Items with `risk_tier = 1` (smartphones, laptops, wallets, ID cards, jewellery, etc.) require OTP verification at physical handover:

- 6-digit cryptographically secure OTP generated at claim approval
- OTP is **hashed** using Django's `make_password` — plaintext is **never stored**
- 24-hour expiry
- Maximum 5 failed attempts before the handover is locked
- Single-use: OTP invalidated immediately after successful verification
- Delivered via in-app notification to the claiming student
- Custodian enters OTP at the physical collection point to confirm handover

---

## Campus Stations

Stations are physical drop-off / collection points (HOD cabins, faculty rooms, custodial desks).

Station codes follow the format: `RNT-B2-F02-S01` (Building 2, Floor 2, Station 1)

QR codes identify the station — no secrets are embedded in QR codes.

### Setting Up Stations

```bash
cd backend

# Edit the JSON file with your college's buildings and floors
cp ../campus_stations.example.json ../campus_stations.json

# Import stations
python manage.py setup_campus_stations --file ../campus_stations.json
```

For campus pilot procedures, see the [Campus Pilot Runbook](docs/CAMPUS_PILOT_RUNBOOK.md).

---

## API Reference

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| `GET` | `/api/health/` | None | Health check |
| `POST` | `/api/auth/signup/` | None | Student / Staff signup |
| `POST` | `/api/auth/login/` | None | Login (email or mobile) |
| `POST` | `/api/auth/logout/` | Bearer | Logout |
| `GET` | `/api/auth/me/` | Bearer | Current user profile |
| `GET/POST` | `/api/items/lost-items/` | Bearer | Student lost item reports |
| `GET/POST` | `/api/items/found-items/` | Staff | Admin found item registry |
| `POST` | `/api/items/found-items/{id}/publish/` | Staff | Publish a found item |
| `POST` | `/api/items/analyze-image/` | Staff | AI image analysis |
| `GET` | `/api/items/available-items/` | Bearer | Public found item catalog |
| `GET` | `/api/items/matches/` | Bearer | Match candidates for lost reports |
| `GET` | `/api/items/admin/dashboard-stats/` | Staff | Admin dashboard statistics |
| `GET/POST` | `/api/pickup/claims/` | Bearer | Student claims |
| `POST` | `/api/pickup/claims/{id}/approve/` | Staff | Approve a claim |
| `POST` | `/api/pickup/claims/{id}/reject/` | Staff | Reject a claim |
| `GET` | `/api/handovers/` | Staff | Handover queue |
| `POST` | `/api/handovers/{id}/verify-otp/` | Staff | Verify OTP for valuable item |
| `POST` | `/api/handovers/{id}/confirm-collection/` | Staff | Confirm physical collection |
| `GET` | `/api/collectionpoint/` | Bearer | Campus station list |
| `GET` | `/api/notifications/` | Bearer | In-app notifications |

---

## Testing

### Backend — Full Test Suite (179 tests)

```bash
# From project root:
python backend/manage.py test items accounts collectionpoint custody handovers notifications pickup

# Or with verbosity:
cd backend && python manage.py test --verbosity=2
```

### Backend — System Check

```bash
cd backend
python manage.py check
```

### Frontend — TypeScript + Production Build

```bash
cd frontend
npx vite build
```

### AI Inference Live Test

```bash
python backend/manage.py test_ai_inference
```

---

## Deployment

See [`VERCEL_DEPLOYMENT.md`](VERCEL_DEPLOYMENT.md) for the complete step-by-step Vercel (frontend) + Railway/Render (backend) deployment guide.

**Quick summary:**
- **Frontend** → Vercel (static React build, zero config)
- **Backend** → Railway or Render (Django + PostgreSQL, one-click deploy)
- **Media files** → Cloudinary or AWS S3 (for persistent image storage)

---

## Security Notes

- Private item fields (`serial_number`, `imei`, `identifying_marks`, `internal_notes`, `secret_verification_info`) are **never exposed** in student-facing API responses
- OTP codes are **never stored in plaintext** — only their bcrypt hash is persisted
- All admin-only endpoints enforce server-side `IsStaff` permission
- Student data is isolated: students can only access their own reports, claims, and matches
- AI output is advisory only — no AI result automatically authorises any claim or handover
- `.env` files are in `.gitignore` and are never committed to version control

---

## Current Limitations

| Area | Status |
|---|---|
| Photo similarity matching | Not implemented (photo score is `null`, normalized out) |
| Email notifications | Console backend only — SMTP not yet configured |
| Push / SMS notifications | Not implemented |
| Celery background tasks | Configured, but Redis not required for development |
| Photo storage | Local filesystem — production requires object storage (S3/Cloudinary) |
| Native mobile app | Not in scope |

---

## License

Internal campus tool — not licensed for public distribution.
