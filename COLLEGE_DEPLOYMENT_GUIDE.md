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

1. **Website & HTTPS Reachability**: Open `https://reunite.campus.edu` in a browser; verify secure HTTPS connection, zero mixed-content errors, and valid SSL certificate.
2. **Student Authentication & Login**: Register a test student account with an institutional email and verify login.
3. **Administrator Login & Access**: Log into `/admin/` and staff dashboard using the superuser credentials.
4. **Campus Station Selection**: Open `/stations` and verify configured collection desks display correct buildings, floors, and hours.
5. **Station QR Workflow**: Scan or navigate to a station QR URL (e.g. `/stations/RNT-B1-F02-S01`); verify station details pre-fill and display correctly.
6. **Student Lost Report**: Submit a test lost item at `/lost` with category, description, location, time, and 3-4 discriminating questions.
7. **Student Found Report**: Submit a test found item at `/found` with location and physical details.
8. **Photo Upload & Media Handling**: Upload a test photograph; verify file upload succeeds and image loads from persistent `MEDIA_ROOT`.
9. **AI Analysis & Manual Fallback**: Confirm Gemini 2.5 Flash suggests structured attributes, or verify manual entry succeeds smoothly when AI is disabled.
10. **Custodian / Admin Review**: Custodian accesses the review dashboard, inspects the found item, and edits attributes if needed.
11. **Item Publication**: Custodian publishes the item so it transitions to `SECURE_HOLD` and appears in the student catalog.
12. **Deterministic Matching**: Verify match candidate scoring computes (0–100) and displays explainability breakdowns at `/matches`.
13. **Ownership Claim**: Student locates the matching item in `/available-items` or `/matches` and submits ownership proof.
14. **Staff Verification Review**: In `/admin/verification`, custodian inspects student answer against private attributes and approves claim.
15. **General-Item Handover**: For a low-value test item (Tier 0), custodian confirms physical collection without OTP requirement; status transitions to `RESOLVED`.
16. **Valuable-Item OTP Handover**: For a high-value test item (Tier 1), verify 6-digit OTP delivery to student notification inbox, custodian verification in `/admin/handovers`, and single-use invalidation.
17. **Audit & Notification Verification**: Confirm notifications arrive in student inbox, audit trail logs all custody events and approvals, test records are cleared/resolved, and the live pilot is authorized.

---

## 8. OPERATIONAL INCIDENT PROCEDURES

| Incident | Severity | Operational Procedure |
|---|---|---|
| **Database Unavailable** | Critical | Check PostgreSQL service status (`systemctl status postgresql`). Verify database credentials, port availability, and connection pool limits. Until restored, physical custody is logged manually on paper registers. |
| **Application / Website Unavailable** | Critical | Check Gunicorn service (`systemctl status gunicorn`) and Nginx logs (`/var/log/nginx/error.log`). Physical collection desks continue operating via physical intake forms. |
| **Gemini AI Service Unavailable** | Low | Students and custodians proceed using manual descriptions. The platform automatically catches timeouts/API errors and falls back without interrupting submissions. |
| **Email Notification Unavailable** | Medium | In-app notifications continue to deliver all critical match alerts and OTP codes directly within the web portal (`/notifications`). Reconnect SMTP relay settings when feasible. |
| **Media Storage Unavailable / Disk Full** | High | Check storage mount (`df -h`). Image uploads will fail with HTTP 500 until disk space is expanded. Existing records and matching workflows remain functional. |
| **Designated Station Closed / Unavailable** | Medium | Custodian updates station status to `INACTIVE` in Django Admin. System advises finders and claimants to visit the adjacent designated active station. |
| **Incorrect Station Data Reported** | Low | Campus administrator edits building, floor, directions, or operational hours directly in Django Admin (`Collection Points`) or updates `campus_stations.json`. |
| **Suspected Fraudulent Claim** | High | **Do not release physical item.** Custodian rejects claim, adds an internal note documenting reason, and flags account for administrative review. |
| **Disputed Ownership** | High | **Do not release physical item.** Item remains in `SECURE_HOLD`. Both claimants are directed to the campus Dean of Student Affairs or Central Security with physical proof. |
| **Lost or Damaged Physical Item in Custody** | High | Custodian updates item status to `MISSING` or `DAMAGED` in admin portal. Log an incident report with timestamp and station location in the audit trail. |
| **Repeated OTP Failure / Claimant Locked** | Medium | System locks handover record after 5 failed attempts. Custodian verifies student ID physically and escalates to Administrator for manual verification override. |
| **Unauthorized Access Attempt / Security Report** | Critical | Inspect Django Audit Logs (`/admin/audit/auditlog/`) for IP and user account. Revoke session tokens immediately and rotate compromised credentials. |

---

*REUNITE Campus Platform — Built for reliable, secure, and auditable lost & found recovery.*
