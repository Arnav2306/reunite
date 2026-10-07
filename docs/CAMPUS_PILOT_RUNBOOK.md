# REUNITE — CAMPUS PILOT RUNBOOK

This operational runbook provides step-by-step instructions for college administrators, custodial staff, and campus coordinators conducting a pilot of the REUNITE Lost & Found platform.

---

## 1. PRE-PILOT DEPLOYMENT & SETUP

### Step 1: Configure Environment Variables
Copy `.env.example` to `.env` and fill in the required settings:

```bash
cp .env.example .env
```

Key pilot settings:
- `DJANGO_SECRET_KEY`: Set a secure random string (`python -c "import secrets; print(secrets.token_urlsafe(50))"`).
- `DJANGO_DEBUG`: Set `False` for pilot deployment (or `True` for local pre-pilot test).
- `DJANGO_ALLOWED_HOSTS`: Set the institutional domain or local network IP (e.g. `reunite.college.edu,192.168.1.100`).
- `CORS_ALLOWED_ORIGINS`: Set frontend origin if backend and frontend are hosted on separate domains/ports.
- `DATABASE_URL`: Set PostgreSQL connection URI if using PostgreSQL instead of SQLite.
- `MEDIA_ROOT`: Set to persistent volume mount directory if deploying in containerized environments.
- `GEMINI_API_KEY`: Set your Google Gemini API key to enable AI photo descriptions. (If not set, system automatically falls back to manual descriptions).

### Step 2: Initialize Database & Migrations
```bash
cd backend
python manage.py migrate
```

### Step 3: Create Central Administrator Account
Create the primary campus superuser/administrator account:
```bash
python manage.py createsuperuser
```
Follow prompts to set institutional admin email and password.

### Step 4: Configure Official Campus Stations
Stations represent physical drop-off/pickup points (HOD cabins, department offices, central security desk).

**Option A: Using the management command with the provided template:**
1. Copy and edit the template file from the repository root:
   ```bash
   cp ../campus_stations.example.json campus_stations.json
   ```
2. Edit `campus_stations.json` with official campus buildings, room numbers, and station codes (e.g. `RNT-B1-F01-S01`).
3. Load the stations into the database:
   ```bash
   python manage.py setup_campus_stations --file campus_stations.json
   ```

**Option B: Using the Django Admin:**
1. Open `http://<your-host>:8000/admin/`
2. Navigate to **Collection Points** → **Add Collection Point**.
3. Input station code, building, floor, station type, and walking directions.

### Step 5: Test QR Station Resolvers
Each station has a unique station code (e.g., `RNT-B1-F01-S01`).
Students scanning station QR codes will be routed to:
```
http://<your-domain>/stations/RNT-B1-F01-S01
```
Verify that scanning navigates directly to the station details and pre-selects the drop-off station for reporting.

---

## 2. PILOT OPERATIONAL WORKFLOWS

### A. Found Item Workflow (Student or Finder)
1. **Photo Upload**: Finder takes a clear photo of the found item at `/found`.
2. **AI Analysis**: System generates structured suggestions (category, brand, model, color, risk tier).
3. **Review & Drop-off**: Finder reviews/edits attributes, selects the physical campus station where they are depositing the item, and submits.
4. **Institutional Custody**: Staff receives the physical item and verifies its listing in the Admin Dashboard.
5. **Publication**: Staff clicks **Publish** so the item appears in the campus catalog for student discovery.

### B. Lost Item Workflow & Matching (Student)
1. **Lost Report**: Student logs lost item at `/lost` (category, description, location, time, and 3-4 smart discriminative questions).
2. **Deterministic Matching**: The system computes compatibility scores against all published found items.
3. **Candidate Review**: Student browses matches at `/matches` with transparent score breakdowns.

### C. Claim & Verification (Student + Staff)
1. **Claim Initiation**: Student claims a matching item and submits their proof of ownership answer.
2. **Staff Verification Center**: Custodian opens `/admin/verification` to compare student's answer against private serial numbers, IMEIs, internal notes, and hidden marks.
3. **Decision**:
   - If evidence matches → Staff clicks **Approve Claim**.
   - If mismatch → Staff clicks **Reject Claim** with an explanatory note.

### D. Physical Handover & Recovery

#### For General Items (Risk Tier 0 — Bottles, Umbrellas, Notebooks):
1. Claimant visits the campus station with their student ID.
2. Custodian verifies student identity in `/admin/handovers`.
3. Custodian clicks **Confirm Physical Collection**.
4. Item status automatically transitions to `RESOLVED`.

#### For High-Value Items (Risk Tier 1 — Phones, Laptops, Wallets, IDs):
1. Upon claim approval, a cryptographically secure 6-digit OTP is generated.
2. Plaintext OTP is delivered directly to the student via in-app notification.
3. Student presents student ID and gives the OTP to the station custodian.
4. Custodian inputs the OTP in `/admin/handovers` and clicks **Verify OTP & Handover**.
5. Once verified:
   - Handover is marked `COMPLETED`.
   - Item is marked `RESOLVED`.
   - OTP is permanently invalidated (single-use).

---

## 3. SECURITY & SAFETY RULES DURING PILOT

1. **Advisory AI**: AI outputs are strictly suggestions for cataloging. AI *never* authorizes ownership or approves handovers.
2. **Private Field Protection**: Serial numbers, IMEIs, internal custodian notes, and secret verification details are strictly forbidden from public APIs and student views.
3. **OTP Confidentiality**: OTP codes are never logged in plaintext or exposed in API payloads.
4. **Account Separation**: Staff operations (`/admin/*`) require accounts with `is_staff=True` and appropriate roles (`custodian`, `admin`, `superadmin`).

---

## 4. POST-PILOT EVALUATION CHECKLIST

At the conclusion of the pilot period:
- [ ] Review all unresolved items and active custody counts in `/dashboard`.
- [ ] Inspect Audit Logs at `/admin/` for anomalies or failed OTP attempts.
- [ ] Review any lodged disputes at `/api/pickup/disputes/`.
- [ ] Evaluate station utilization and traffic across campus buildings.
- [ ] Gather student and custodial staff feedback for institutional rollout.
