# REUNITE — CAMPUS PILOT READINESS CHECKLIST

This checklist guides institutional administrators, facilities managers, and engineering coordinators through the pre-launch verification and activation of the REUNITE web platform for a controlled college campus pilot.

---

## 1. INSTITUTION & ROLES

- [ ] **Official campus stations confirmed**: Specific HOD cabins, department offices, and custodial reception points chosen.
- [ ] **Building / floor / cabin information confirmed**: Accurate physical location identifiers and walking directions recorded.
- [ ] **Pilot administrator identified**: Primary institutional lead responsible for platform governance appointed.
- [ ] **Custodian / operational responsibility confirmed**: Staff members assigned to physically receive items and conduct handovers.
- [ ] **Student pilot group identified**: Academic cohort, department, or residential community chosen for the controlled launch.

---

## 2. INFRASTRUCTURE & HOSTING

- [ ] **Production server available**: Linux/Windows host, VPS, or PaaS environment provisioned.
- [ ] **Domain / server address assigned**: Static IP or DNS record (e.g., `reunite.campus.edu`) configured.
- [ ] **HTTPS configured**: TLS/SSL certificate installed (e.g., Let's Encrypt / institutional certificate).
- [ ] **PostgreSQL configured**: Database created and credentials verified via `DATABASE_URL` or `DB_*` settings.
- [ ] **Persistent media storage configured**: Persistent disk volume mounted at `MEDIA_ROOT` for uploaded item photos.
- [ ] **Backup strategy confirmed**: Scheduled automated backup routine in place for PostgreSQL and `MEDIA_ROOT`.

---

## 3. APPLICATION CONFIGURATION

- [ ] **Django secret configured**: Strong unique string set in `DJANGO_SECRET_KEY` (`DJANGO_DEBUG=False`).
- [ ] **Allowed hosts configured**: Institutional domain added to `DJANGO_ALLOWED_HOSTS`.
- [ ] **CORS configured**: Frontend origin specified in `CORS_ALLOWED_ORIGINS` (if frontend is hosted on a separate port/domain).
- [ ] **Gemini API key configured**: Google AI Studio API key provided in `GEMINI_API_KEY` for AI photo descriptions.
- [ ] **Primary administrator created**: Superuser account created via `python manage.py createsuperuser`.
- [ ] **Official campus stations loaded**: Stations imported via `python manage.py setup_campus_stations --file campus_stations.json`.

---

## 4. END-TO-END VERIFICATION & TESTING

- [ ] **Student registration tested**: Student can register with valid credentials and log into the portal.
- [ ] **Lost report tested**: Student can report lost item with questions, answers, and category.
- [ ] **Found report tested**: Student/custodian can register found item with photo and location.
- [ ] **AI description tested**: Item image is analyzed by Gemini and suggests structured title, category, and risk tier.
- [ ] **Manual AI fallback tested**: If Gemini key is omitted or API is unreachable, item submission degrades gracefully to manual entry.
- [ ] **Deterministic matching tested**: Compatibility scores (0–100) compute accurately with explainable breakdown.
- [ ] **Claim workflow tested**: Student can locate a found item and submit ownership evidence.
- [ ] **Staff verification center tested**: Custodian compares student claim against private serial numbers and verification details.
- [ ] **General-item handover tested**: Custodian confirms physical collection without OTP requirement; status transitions to RESOLVED.
- [ ] **Valuable-item OTP tested**: Risk Tier 1 item issues a 6-digit OTP delivered via in-app notification to the claimant.
- [ ] **Wrong OTP tested**: Submitting incorrect OTP returns HTTP 400 Bad Request error.
- [ ] **Expired OTP tested**: OTP older than 24 hours is rejected.
- [ ] **OTP lockout tested**: 5 consecutive incorrect attempts permanently locks the handover record.
- [ ] **Unauthorized access tested**: Students cannot access staff endpoints (`/api/items/found-items/`, `/api/handovers/admin/`).
- [ ] **Private-field shielding tested**: Serial numbers, IMEIs, internal notes, and secret answers are absent from public APIs.
- [ ] **Audit logging tested**: Administrative actions, approvals, and handovers generate complete audit records.

---

## 5. LAUNCH AUTHORIZATION

- [ ] **HTTPS verified in browser**: Green lock / secure connection confirmed with no mixed-content warnings.
- [ ] **Production database active**: Database running on PostgreSQL, migrations up-to-date (`migrate --check`).
- [ ] **Media persistence verified**: Uploaded photos persist across server restarts.
- [ ] **Admin login verified**: Central administrator can access Django Admin and custodian portal.
- [ ] **Database and media backup verified**: Initial pre-launch snapshot completed and stored safely.
- [ ] **Campus Pilot Runbook reviewed**: All assigned station staff have reviewed operational workflows in `docs/CAMPUS_PILOT_RUNBOOK.md`.
- [ ] **Controlled pilot approved**: Institutional stakeholders sign off to begin the campus pilot.
