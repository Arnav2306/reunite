# REUNITE — Campus Lost & Found Recovery Platform

REUNITE is a modern web-based Lost & Found recovery platform designed for college campuses. It connects students who have lost items with found items registered through faculty cabin recovery stations, using AI-assisted item description, deterministic attribute matching, and a secure custody-to-handover workflow.

---

## Problem Statement

When items are lost on a college campus, there is no structured, fast way to connect them with their owners. Items end up sitting in HOD cabins and faculty rooms with no visibility. Students have no way to search for or claim what they've lost. REUNITE solves this by bringing the entire recovery lifecycle online.

---

## Core Workflow

```
FOUND ITEM
↓
Submitted at HOD / Faculty Cabin Recovery Station
↓
Custodian / Admin registers item on platform
↓
Photo uploaded → AI generates structured description
↓
Admin reviews and approves AI description
↓
Item published to student-facing catalog
↓
Students browse, or receive match notifications
↓
Student initiates claim with ownership evidence
↓
Admin / Custodian reviews claim and verification answer
↓
Claim approved → Handover record created
↓
Valuable items: OTP verification at collection point
↓
General items: Custodian confirms physical collection
↓
Item marked RESOLVED
```

---

## Major Features

### Student Features
- **Report Lost Item** — Category, description, location, time, smart discriminating questions
- **Report Found Item** — Photo-first flow with AI analysis → review → station drop-off
- **Browse Found Items** — Published item catalog with search and category filters
- **Possible Matches** — Deterministic match scores with explainability breakdown
- **Claims** — Claim a found item with an ownership verification answer
- **Recovery Tracking** — Full pipeline visibility from report to resolution
- **Notifications** — In-app notifications for match discoveries, claim status, approvals, handovers
- **Profile** — User profile management

### Admin / Custodian Features
- **Operational Dashboard** — Live statistics: pending reviews, claims, handovers, valuable items
- **Found Item Registry** — Register items from HOD/faculty cabin stations with AI assistance
- **Review & Publish** — Review AI-generated descriptions, edit, and publish for discovery
- **Claim Management** — Inspect student ownership answers, approve or reject claims
- **Verification Center** — Side-by-side comparison of student answers with private item attributes
- **Handover Management** — Manage physical collection confirmations and OTP verifications
- **Campus Stations** — View and manage collection point stations
- **Audit Logs** — Full audit trail of all system actions
- **Dispute Management** — Handle student disputes with escalation workflow
- **Unclaimed Item Lifecycle** — Manage items from active recovery through disposition

---

## AI Capabilities

**Status: Integration ready — requires GEMINI_API_KEY environment variable**

- AI analyzes the found item photo and returns a structured description
- Output includes: object type, apparent color, visible brand, visible characteristics, safe description, risk tier, confidence
- **Safety constraints enforced at the prompt level:**
  - AI NEVER invents serial numbers, IMEI numbers, or ownership
  - AI ONLY describes what is physically visible
  - Ambiguous details default to "Unknown"
  - AI is advisory only — all output is reviewed by admin before publication
- Graceful fallback: if no API key is configured, items can still be submitted and described manually
- Admin can edit all AI-generated content before publishing

---

## Matching System

The matching system is deterministic and explainable — no black-box scoring.

Match score (0–100) is computed from:

| Signal | Weight |
|--------|--------|
| Attribute / text similarity | 40 |
| Category | 20 |
| Location | 15 |
| Time | 10 |
| Distinguishing features | 10 |
| Photo similarity | 0 (not yet implemented) |

Score labels:
- `85–100` → **Strong Possible Match**
- `65–84` → **Possible Match**
- `0–64` → **Weak Match**

Score is NEVER described as a probability. It is presented as "X / 100".

---

## OTP Verification (Valuable Items)

Items with `risk_tier = 1` (smartphones, laptops, wallets, identification cards, etc.) require OTP verification at physical handover:

- 6-digit cryptographically secure OTP
- OTP is **hashed** using Django's `make_password` — plaintext is NEVER stored
- 24-hour expiry
- Maximum 5 failed attempts before the handover is locked
- Single-use: OTP invalidated immediately upon successful verification
- OTP delivered via in-app notification to the student
- Custodian enters OTP at the physical collection point to confirm handover

---

## Campus Station System

Stations represent physical drop-off / collection points on campus (HOD cabins, faculty rooms, custodial desks).

Station codes follow the format: `RNT-B2-F02-S01` (Building 2, Floor 2, Station 1).

QR codes identify the station — no secrets are stored inside QR codes.

If no stations are configured, the system shows an appropriate empty state rather than fake data.

### Setting Up Official Campus Stations

Administrators can configure official campus stations via Django Admin or using the built-in management command:

```bash
cd backend

# Or copy the placeholder template provided in the repo root:
# cp ../campus_stations.example.json campus_stations.json
# (Edit campus_stations.json with real college buildings, floors, and station codes)

# Import official campus stations
python manage.py setup_campus_stations --file campus_stations.json
```

For operational procedures during a campus trial, see the [Campus Pilot Runbook](docs/CAMPUS_PILOT_RUNBOOK.md).


---

## Technology Stack

### Backend
- **Python** / **Django 6.1**
- **Django REST Framework** (API)
- **SQLite** (development) / **PostgreSQL** (production)
- **Token Authentication** (Bearer + Token headers supported)
- Custom role-based permission system (Student, Custodian, Admin, SuperAdmin)

### Frontend
- **React 18** + **TypeScript**
- **Vite** (build tool)
- **TailwindCSS v4** (styling)
- **TanStack React Query** (data fetching)
- **React Router v6** (routing)
- **Lucide React** (icons)

### AI
- **Google Gemini 2.5 Flash** (image analysis via REST API)

---

## Local Setup

### Prerequisites
- Python 3.11+
- Node.js 20+
- Git

### Backend

```bash
# Clone the repository
git clone <repo-url>
cd "Reunite Project"

# Create and activate virtual environment
python -m venv .venv
.venv\Scripts\activate       # Windows
source .venv/bin/activate    # macOS/Linux

# Install dependencies
pip install -r backend/requirements.txt   # if present
# or manually:
pip install django djangorestframework pillow requests

# Configure environment
cp .env.example .env
# Edit .env — set DJANGO_SECRET_KEY, GEMINI_API_KEY (optional), etc.

# Apply migrations
cd backend
python manage.py migrate

# Create superuser (admin)
python manage.py createsuperuser

# Run development server
python manage.py runserver
```

Backend runs at: `http://localhost:8000`

### Frontend

```bash
cd frontend
npm install
npm run dev
```

Frontend runs at: `http://localhost:5173`

The Vite dev server proxies `/api/*` requests to the Django backend automatically.

---

## Environment Variables

See [`.env.example`](.env.example) for all available variables.

| Variable | Required | Description |
|---|---|---|
| `DJANGO_SECRET_KEY` | Yes (production) | Django secret key |
| `DJANGO_DEBUG` | No | `True` for dev, `False` for production |
| `DJANGO_ALLOWED_HOSTS` | Yes (production) | Comma-separated allowed host list |
| `CORS_ALLOWED_ORIGINS` | No | Comma-separated frontend origins (for production CORS) |
| `GEMINI_API_KEY` | Optional | Google Gemini API key for AI image analysis |
| `OPENAI_API_KEY` | Optional | Reserved for future OpenAI integration |
| `DATABASE_URL` | No | PostgreSQL connection URI (e.g. `postgres://user:pass@host:5432/db`) |
| `DB_ENGINE` | No | Database engine (default: SQLite) |
| `DB_NAME` | No | Database name |
| `DB_USER` | No | Database user (PostgreSQL) |
| `DB_PASSWORD` | No | Database password (PostgreSQL) |
| `DB_HOST` | No | Database host (default: localhost) |
| `DB_PORT` | No | Database port (default: 5432) |
| `MEDIA_ROOT` | No | Persistent disk path for uploaded images |
| `MEDIA_URL` | No | Public URL path for media files (default: `/media/`) |
| `REDIS_URL` | No | Redis URL for Celery background tasks |

---

## Test Commands

### Backend

```bash
cd backend

# System check (no issues expected)
python manage.py check

# Full test suite
python manage.py test --verbosity=2
```

### Frontend

```bash
cd frontend

# TypeScript check + production build
npm run build
```

---

## API Endpoints

| Prefix | Description |
|---|---|
| `GET /api/health/` | Health check |
| `POST /api/auth/signup/` | Student / Staff signup |
| `POST /api/auth/login/` | Login (email or mobile) |
| `POST /api/auth/logout/` | Logout |
| `GET /api/auth/me/` | Current user profile |
| `GET/POST /api/items/lost-items/` | Student lost item reports |
| `GET/POST /api/items/found-items/` | Admin found item registry |
| `POST /api/items/found-items/{id}/publish/` | Admin: publish found item |
| `POST /api/items/analyze-image/` | AI image analysis |
| `GET /api/items/available-items/` | Public found item catalog |
| `GET /api/items/matches/` | Match candidates |
| `GET /api/items/admin-stats/` | Admin dashboard statistics |
| `GET/POST /api/pickup/claims/` | Student claims |
| `POST /api/pickup/claims/{id}/approve/` | Staff: approve claim |
| `POST /api/pickup/claims/{id}/reject/` | Staff: reject claim |
| `GET /api/handovers/` | Staff handover queue |
| `POST /api/handovers/{id}/verify-otp/` | Staff: verify OTP |
| `POST /api/handovers/{id}/confirm-collection/` | Staff: confirm physical collection |
| `GET /api/collection-points/` | Campus station list |
| `GET /api/notifications/` | Student notifications |

---

## Production Considerations

> **This system is designed for a controlled college campus pilot, not open internet deployment.**

Before production deployment:

1. **Set a strong `DJANGO_SECRET_KEY`** — never use the development default
2. **Set `DJANGO_DEBUG=False`**
3. **Configure `DJANGO_ALLOWED_HOSTS`** with your campus domain
4. **Switch to PostgreSQL** via `DB_*` environment variables
5. **Configure HTTPS** (required for security and cookie protection)
6. **Configure `STATIC_ROOT`** and run `python manage.py collectstatic`
7. **Set `GEMINI_API_KEY`** to enable AI-assisted item analysis
8. **Review media file access** — consider object storage (S3, GCS) for uploaded images
9. **Limit campus registration** — consider restricting signup to specific email domains if required by the institution

---

## Current Limitations

| Area | Status |
|---|---|
| AI photo similarity matching | Not yet implemented (photo score is `null`, normalized out) |
| Email notifications | Console backend only — SMTP not yet configured |
| Push / SMS notifications | Not implemented |
| Celery background tasks | Configured but Redis not required for development |
| Photo storage | Local filesystem only (production needs object storage) |
| OpenAI vision integration | Reserved — only Gemini is currently implemented |
| Native mobile app | Not in scope |

---

## Security Notes

- Private item fields (`serial_number`, `imei`, `identifying_marks`, `internal_notes`, `secret_verification_info`) are **never exposed** in student-facing or public API responses
- OTP codes are **never stored in plaintext** — only their hash is persisted
- All admin-only endpoints require server-side `IsStaff` permission enforcement
- Student data isolation is enforced: students can only view their own reports, claims, and matches
- AI results are advisory only — no AI output automatically authorizes any handover or claim

---

## License

Internal campus tool — not licensed for public distribution.
