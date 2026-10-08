# REUNITE — COLLEGE DEPLOYMENT GUIDE

This guide provides institutional administrators, IT directors, and systems deployment coordinators with the complete technical and operational specifications required to launch the **REUNITE** Lost & Found web platform for a controlled college campus pilot.

---

## 1. ARCHITECTURE OVERVIEW

REUNITE is a lightweight, modern web platform designed to operate seamlessly on institutional infrastructure (on-premises Linux/Windows server, campus VM, or private cloud instance).

```text
Student / Staff Browser
          │
          ▼ HTTPS (Port 443)
┌──────────────────────────────────────────────┐
│  Reverse Proxy / Web Server (Nginx / Caddy)   │
├──────────────────────┬───────────────────────┤
│  Static Frontend     │  API Requests (/api/) │
│  (React 18 / Vite)   │                       │
└──────────────────────┼───────────────────────┘
                       │
                       ▼ WSGI (Port 8000)
┌──────────────────────────────────────────────┐
│  REUNITE Backend Service (Gunicorn / Django) │
└──────┬───────────────────────────────┬───────┘
       │                               │
       ▼ SQL                           ▼ Filesystem
┌──────────────────────┐   ┌──────────────────────────────┐
│ PostgreSQL Database  │   │ Persistent Storage Volume    │
│ (System of Record)   │   │ (MEDIA_ROOT - Item Photos)   │
└──────────────────────┘   └──────────────────────────────┘
```

---

## 2. INFORMATION REQUIRED FROM THE INSTITUTION

Before launching the platform, the institution must supply the operational and infrastructure details specified below. A convenient fill-in template is provided in [`COLLEGE_PILOT_INFORMATION.md`](./COLLEGE_PILOT_INFORMATION.md).

### A. Campus Station Information

Physical recovery stations represent designated drop-off and pickup locations across campus (e.g., Department HOD cabins, Dean of Student Affairs reception, Central Security Desk).

The college must determine and document:
* **Official Building Names & Codes**: Actual names used by students and staff (e.g., `Engineering Block A`, `Main Academic Complex`).
* **Floor Numbers / Cabin Identifiers**: Precise room and floor identifiers (e.g., `Floor 2, Room 204 - HOD Computer Science`).
* **Station Code**: A structured, human-readable code following the pattern `RNT-<BUILDING>-<FLOOR>-<STATION>` (e.g., `RNT-B1-F02-S01`).
* **Station Capabilities**:
  * Does this station accept deposits from students/finders?
  * Does this station store valuable items and conduct handovers?
* **Operating Hours**: Standard campus operational hours when staff are available.
* **Responsible Custodial Role**: Assigned staff member(s) or department custodian responsible for station inventory.

> **CRITICAL REQUIREMENT:** REUNITE must never be populated with fabricated campus locations or simulated buildings. The platform remains unpopulated until official institutional data is imported.

### B. Server & Hosting Environment

The college IT team must provide:
* **Host Environment**: Linux (Ubuntu 22.04+ / Debian 12 recommended) or Windows Server host with Python 3.11+ and Node.js 20+.
* **Domain / Subdomain**: Designated URL for the service (e.g., `https://reunite.campus.edu` or `https://lostandfound.college.edu`).
* **TLS/SSL Certificate**: Valid HTTPS certificate (Let's Encrypt, institutional wildcard, or reverse proxy termination).
* **PostgreSQL Database**: Dedicated PostgreSQL database (v14+) with a provisioned user and secure password.
* **Persistent Media Storage**: A dedicated disk mount path (e.g., `/var/reunite/media` or `D:\reunite\media`) with write permissions for the application process. Container-local temporary storage is **not** persistent and must not be used.

---

## 3. PRODUCTION CONFIGURATION & ENVIRONMENT VARIABLES

All server configuration is managed via environment variables. Copy the template provided in [`.env.production.example`](./.env.production.example) to `.env` on your deployment server:

```bash
cp .env.production.example .env
```

### Supported Configuration Keys

| Variable | Required | Description | Example / Notes |
|---|---|---|---|
| `DJANGO_SECRET_KEY` | **Yes** | Cryptographic key for session signing and hashing | Generate via `python -c "import secrets; print(secrets.token_urlsafe(50))"` |
| `DJANGO_DEBUG` | **Yes** | Application debug mode | Must be set to `False` in production |
| `DJANGO_ALLOWED_HOSTS` | **Yes** | Permitted hostnames | `reunite.campus.edu,10.0.1.50` |
| `CORS_ALLOWED_ORIGINS` | Conditional | Frontend origins permitted for cross-origin API calls | Set if frontend is served on a different domain/port |
| `DATABASE_URL` | **Yes** | PostgreSQL connection URI | `postgres://reunite_user:password@localhost:5432/reunite_db` |
| `MEDIA_ROOT` | **Yes** | Filesystem path for uploaded item photographs | Must point to a persistent storage volume |
| `MEDIA_URL` | No | Public URL path for uploaded media | Defaults to `/media/` |
| `STATIC_ROOT` | **Yes** | Target directory for collected static assets | Defaults to `backend/staticfiles` |
| `GEMINI_API_KEY` | Optional | Google Gemini 2.5 Flash API key for AI photo analysis | Obtained via Google AI Studio. System degrades to manual entry if omitted |
| `VITE_API_URL` | Optional | Frontend API backend target | Leave empty if using same-origin reverse proxy |

> **SECURITY NOTE:** Never commit `.env` or real passwords to version control. API keys and database credentials must only exist on the production server.

---

## 4. DEPLOYMENT & LAUNCH COMMANDS

Follow these steps on the production host to build and run the platform:

### Step 1: Database & Backend Initialization

```bash
cd backend

# 1. Apply database schema migrations to PostgreSQL
python manage.py migrate

# 2. Collect static files for web server delivery
python manage.py collectstatic --noinput

# 3. Create the primary campus administrator account
python manage.py createsuperuser
```

### Step 2: Import Official Campus Stations

Populate your official station definitions into `campus_stations.json` following the schema in [`campus_stations.example.json`](./campus_stations.example.json), then import:

```bash
python manage.py setup_campus_stations --file campus_stations.json
```

### Step 3: Launch the Backend Service

Run Gunicorn bound to the internal application port (managed via Systemd, Supervisor, or Windows Service):

```bash
gunicorn reunite_backend.wsgi:application --bind 0.0.0.0:8000 --workers 4
```

### Step 4: Build and Deploy the Frontend

```bash
cd ../frontend

# Install dependencies and produce production bundle
npm install
npm run build
```

Serve the resulting `frontend/dist` directory using your Nginx or Caddy web server.

---

## 5. REVERSE PROXY CONFIGURATION (NGINX EXAMPLE)

```nginx
server {
    listen 443 ssl http2;
    server_name reunite.campus.edu;

    ssl_certificate /etc/ssl/certs/reunite.campus.edu.crt;
    ssl_certificate_key /etc/ssl/private/reunite.campus.edu.key;

    client_max_body_size 15M;

    # Frontend Single-Page Application
    location / {
        root /var/www/reunite/frontend/dist;
        try_files $uri $uri/ /index.html;
    }

    # Backend API & Django Admin
    location ~ ^/(api|admin)/ {
        proxy_pass http://127.0.0.1:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # Uploaded Item Media
    location /media/ {
        alias /var/reunite/media/;
        expires 30d;
    }

    # Backend Static Files
    location /static/ {
        alias /var/reunite/backend/staticfiles/;
        expires 30d;
    }
}
```

---

## 6. AI CAPABILITIES & SAFETY CONSTRAINTS

REUNITE supports AI-assisted image analysis powered by **Google Gemini 2.5 Flash**:

1. **Strictly Advisory Role**: AI outputs (suggested category, brand, color, visible condition) assist human cataloging. The AI **never** authorizes ownership, determines claims, or approves item handovers.
2. **Zero Hallucination Guardrails**: The system prompt strictly prohibits the AI from inventing serial numbers, IMEI identifiers, passwords, or hidden personal markings.
3. **Graceful Fallback**: If `GEMINI_API_KEY` is not provided or the Google API is unreachable, the system automatically falls back to manual item descriptions. Item reporting and recovery remain fully functional.

---

## 7. FIRST-DAY CONTROLLED PILOT PROCEDURE

On the first day of the pilot launch, the institutional pilot team should execute this 17-step verification sequence using dedicated test accounts:

1. **Verify HTTPS**: Open `https://reunite.campus.edu` in a standard browser; confirm secure connection and zero mixed-content errors.
2. **Verify Student Registration**: Register a test student account using an official campus email address.
3. **Verify Administrator Login**: Log into `/admin/` and the staff interface using the superuser credentials.
4. **Verify Campus Stations**: Confirm all official stations appear correctly on the campus map and station listings (`/stations`).
5. **Submit Test Lost Report**: Log a test lost item with distinguishing questions at `/lost`.
6. **Submit Test Found Report**: Log a test found item with a photo upload at `/found`.
7. **Verify Photo Handling**: Confirm uploaded photo displays correctly from persistent storage.
8. **Verify AI / Manual Fallback**: Verify AI suggestion appears, or confirm manual fallback allows editing and submission.
9. **Publish Test Found Item**: Log in as custodian, review the item, and click **Publish**.
10. **Submit Test Claim**: As the student, locate the item in `/available-items` or `/matches` and submit a claim.
11. **Verify Ownership Review**: In `/admin/verification`, compare student answers against private item details; approve the claim.
12. **Test General-Item Handover**: For a low-value test item, confirm physical handover without an OTP requirement.
13. **Test Valuable-Item OTP**: For a high-value item (Tier 1), verify 6-digit OTP delivery to the student notification inbox and successful verification by the custodian.
14. **Verify RESOLVED State**: Confirm item status transitions to `RESOLVED` upon collection.
15. **Verify Audit History**: Confirm full event record appears in the administrative audit logs.
16. **Clean Test Records**: Mark or delete the test items so only genuine campus reports remain.
17. **Authorize Controlled Pilot**: Announce platform availability to the selected pilot student cohort.

---

## 8. OPERATIONAL INCIDENT PROCEDURES

| Incident | Operational Procedure |
|---|---|
| **Website or Server Unavailable** | Notify IT system administrator. Item custody at physical stations continues manually using physical register books until service is restored. |
| **Gemini AI Service Unavailable** | Staff and students should proceed using manual descriptions. No action is required; the platform automatically falls back. |
| **Designated Station Closed / Unavailable** | Staff should redirect finders and claimants to the nearest adjacent active station recorded in the platform. |
| **Disputed / Mismatched Ownership Claim** | **Do not release physical custody.** Custodian rejects claim with an explanatory note. Student may lodge an escalation via `/api/pickup/disputes/`. |
| **Repeated OTP Failure (Valuable Item)** | The system automatically locks the handover record after 5 failed attempts. Item remains in secure hold until identity is re-verified by an administrator. |
| **Physical Item Discrepancy** | If an item held in physical custody is damaged or misplaced, custodian logs a status update to `DAMAGED` or `MISSING` in the admin portal. |

---

*REUNITE Campus Platform — Built for reliable, secure, and auditable lost & found recovery.*
