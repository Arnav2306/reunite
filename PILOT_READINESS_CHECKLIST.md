# REUNITE — CAMPUS PILOT READINESS CHECKLIST

This checklist provides full traceability between engineering completion and institutional deployment preparation. It clearly separates what has been verified in software from what requires institutional configuration.

---

## PART 1: DEVELOPER VERIFIED & COMPLETED

The following components have been fully implemented, integrated, and verified against the automated test suite (117/117 passing tests) and production build tools.

### Software & Architecture
- [x] **Core Web Platform**: Modular Django/DRF backend and React 18 / TypeScript / Vite frontend fully implemented.
- [x] **Deterministic Matching**: Explainable compatibility scoring (0–100) based on categories, attributes, location, and time.
- [x] **Advisory AI Integration**: Google Gemini 2.5 Flash vision integration implemented with strict advisory boundaries.
- [x] **AI Fallback Mechanism**: Graceful, automatic degradation to manual attribute entry when AI is unconfigured or unreachable.
- [x] **Zero Hallucination Guardrails**: AI prompt strictly prevents invention of serial numbers, IMEIs, internal markings, or ownership.
- [x] **Two-Tier Risk Policy**: General items (Tier 0) vs. High-Value items (Tier 1) distinction implemented and enforced.
- [x] **Cryptographic OTP Handover**: Single-use 6-digit OTP hashed via `make_password` with 24-hour expiration and 5-attempt lockout for valuable items.
- [x] **Physical Handover Confirmation**: Streamlined collection confirmation for general items without OTP barrier.
- [x] **Role-Based Access Control (RBAC)**: Strict permission boundaries enforcing Student, Custodian, Admin, and SuperAdmin separation.
- [x] **Private Field Shielding**: Serial numbers, IMEIs, internal notes, and secret answers strictly shielded from all public/student APIs.
- [x] **Immutable Audit Trail**: Administrative actions, approvals, and physical custody transitions logged to immutable audit records.
- [x] **Campus Station Ingestion**: Management command `setup_campus_stations` implemented to import official stations from JSON.
- [x] **Production Build**: Frontend builds cleanly with zero TypeScript errors (`tsc && vite build`).
- [x] **Database Schema**: All migrations cleanly defined and tested (`python manage.py makemigrations --check --dry-run`).
- [x] **Production Server Compatibility**: Gunicorn WSGI configuration verified in `requirements.txt` and `settings.py`.
- [x] **Dual-Mode API Client**: Frontend API service supports both same-origin reverse-proxy and cross-domain hosting.

---

## PART 2: INSTITUTION & DEPLOYMENT TEAM RESPONSIBILITY

The items below depend on real institutional facilities, credentials, and infrastructure. They must be completed by the college deployment team prior to pilot launch.

> **DO NOT MARK COMPLETED UNTIL VERIFIED ON INSTITUTIONAL INFRASTRUCTURE.**

### 1. Campus Facilities & Personnel
- [ ] **Official Campus Stations Identified**: Specific HOD cabins, department offices, and custodial reception points chosen.
- [ ] **Location Data Documented**: Building names, floor levels, cabin numbers, and walking directions confirmed.
- [ ] **Station JSON Prepared**: Official data saved in `campus_stations.json` (based on `campus_stations.example.json`).
- [ ] **Pilot Administrator Appointed**: Primary institutional lead responsible for platform governance named.
- [ ] **Operational Custodians Assigned**: Specific staff members briefed on receiving items and conducting handovers.
- [ ] **Student Cohort Selected**: Target academic departments or residential halls identified for the pilot.

### 2. Infrastructure & Hosting
- [ ] **Production Host Provisioned**: Server or virtual machine allocated with network access.
- [ ] **Domain / Subdomain Assigned**: DNS record created (e.g., `reunite.campus.edu`).
- [ ] **HTTPS / TLS Configured**: Valid SSL certificate installed; HTTP traffic redirects to HTTPS.
- [ ] **PostgreSQL Database Running**: Production PostgreSQL database created and credentials tested.
- [ ] **Persistent Storage Mounted**: Persistent volume mounted at `MEDIA_ROOT` with appropriate file permissions.
- [ ] **Automated Backup Configured**: Backup schedules established for PostgreSQL and `MEDIA_ROOT`.

### 3. Server Configuration & Secrets
- [ ] **Production Secrets Set**: Strong `DJANGO_SECRET_KEY` generated and configured in `.env`.
- [ ] **Debug Disabled**: `DJANGO_DEBUG=False` set in `.env`.
- [ ] **Allowed Hosts Configured**: Institutional domain added to `DJANGO_ALLOWED_HOSTS`.
- [ ] **CORS Configured**: Configured in `CORS_ALLOWED_ORIGINS` if frontend is hosted separately.
- [ ] **Gemini API Key Added**: Institutional key configured in `GEMINI_API_KEY` (or confirmed omitted for manual mode).
- [ ] **Database Migrations Executed**: `python manage.py migrate` executed on production PostgreSQL instance.
- [ ] **Static Assets Collected**: `python manage.py collectstatic --noinput` executed.
- [ ] **Central Administrator Created**: Initial superuser created via `python manage.py createsuperuser`.
- [ ] **Campus Stations Loaded**: `python manage.py setup_campus_stations --file campus_stations.json` executed.

### 4. Operational Sign-Off
- [ ] **First-Day Smoke Test Executed**: 17-step verification procedure in `COLLEGE_DEPLOYMENT_GUIDE.md` completed.
- [ ] **Station Staff Briefed**: Custodians trained using `docs/CAMPUS_PILOT_RUNBOOK.md`.
- [ ] **Pilot Authorization Signed**: Institutional leadership sign-off in `COLLEGE_PILOT_INFORMATION.md`.
