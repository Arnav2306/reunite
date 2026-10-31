# REUNITE — Project Progress & Deployment Status

## Milestone: Final Completion Sprint — Bug Fixes, Real Data, Authentication UX, AI, Campus Setup & Pilot Deployment
* **Audit & Update Date**: October 12, 2026
* **Overall Status**: `PRODUCTION READY — AUTOMATION & BUILD VERIFIED`

---

## 1. VERIFIED IMPLEMENTATION STATUS

All requirements across the platform have been inspected, implemented, and verified against actual source code and automated tests:

### Authentication & Password UX (Requirements 3 & 4)
* **Student vs Staff Portals**: Dedicated portals (`/login`, `/signup`) with role-based routing.
* **Email & Phone Sign-in**: Registration and login using either email or phone without requiring mandatory college domains. Personal Gmail recommended in UI, other domains supported.
* **Server-Side Role Protection**: Public registrations and profile updates strictly ignore `role` fields, preventing privilege escalation.
* **Password Show/Hide Eye Controls**: Integrated accessible `Eye` and `EyeOff` visibility toggles into `LoginPage` and `SignupPage` (covering both password and confirm-password fields independently). Fully keyboard reachable, `type="button"` to prevent form submission, preserves value across toggling.

### Zero Fake Numbers & Real Database Metrics (Requirement 2)
* **Landing Page**: Public trust metrics (`/api/items/public-stats/`) query real completed handovers (`Handover.objects.filter(status='COMPLETED')`), resolved found items (`FoundItem.objects.filter(status='RESOLVED')`), and active stations. Zero fabricated statistics.
* **Student & Admin Dashboards**: Operational metrics (`/api/items/admin-stats/`) query real database counts for lost reports, physical custody, active claims, pending verifications, and completed handovers. Empty database returns honest 0 counts with helpful guidance rather than synthetic seed data.
* **Recovery Pipelines**: 6-stage lifecycle progression accurately reflects database status without probability simulations.

### Medicaps University Campus & Station Configuration (Requirement 6)
* **Institution Metadata**: Medicaps University (`A.B. Road, Pigdamber, Rau, Indore, Madhya Pradesh – 453331, India`) configured in `CampusConfig`.
* **Campus Blocks**: All 24 official buildings configured (`Block A` to `Block Z`), typo "Bock N" normalized to `Block N`.
* **Collection Stations**: 15 stations imported idempotently via `setup_campus_stations`.
  - 12 stations assigned to confirmed blocks.
  - 3 ambiguous stations flagged for administrative confirmation (`MED-ADM-REC`, `MED-HSTL-GIRLS`, `MED-BLK-V015`) rather than guessed.
* **Administrative Management**: `AdminCollectionPointsPage` allows staff to edit college details, add/edit blocks, manage station statuses, update capacities, opening hours, directions, and GPS coordinates.

### Image-Based AI Description & Fallbacks (Requirement 5)
* **Dual-Provider Pipeline**: Google Gemini Vision (`gemini-3.8-flash` / `gemini-3.1-flash-lite`) as primary, OpenAI Vision (`gpt-4o-mini`) as fallback.
* **Automatic Workflow**: Triggered automatically upon image selection on `/found`. Includes concurrency guard (`analysisSeqRef`, hash check), honest loading state ("Analyzing image…"), editable fields, and manual description fallback.
* **Physical-Only Observation**: Strict prompt enforcement prevents hallucinating serial numbers, IMEIs, internal contents, or private owners.
* **Diagnostic Command**: `python manage.py test_ai_inference` safely verifies configuration and live inference without leaking secrets.
* **Mocked Test Coverage**: Comprehensive automated test coverage for Gemini success, HTTP 429 quota exhaustion, HTTP 503 high-demand degradation, OpenAI fallback, and vehicle key detection in `AIDescriptionServiceTests`.
* **Documentation**: Detailed guide in `docs/AI_IMAGE_DESCRIPTION_SETUP.md`.

### Dedicated Vehicle Keys & Category-Specific Lost-Item MCQs (Requirements 4 & 8)
* **Dedicated Vehicle Keys Category**: Independent from `Keys & Badges` in both lost and found reporting workflows, catalog filters, and matching algorithm.
* **Tailored Vehicle Key MCQs**: 4 comprehensive multiple-choice questions (`vehicle_type`, `key_type`, `key_appearance`, `distinguishing_feature`) with realistic options including "Other" and "Not sure", plus detail text inputs.
* **Alias Resolution**: Dedicated priority resolver ensures vehicle key terms (`motorcycle key`, `car key`, `scooter key`, `scooty key`, `key fob`, `remote key`, `smart key`, `proximity key`) resolve to `Vehicle Keys` without falling back to generic `Keys & Badges`.
* **Snapshot Persistence**: Question text and submitted answers are snapshotted in `original_answers` with versioning (`2026.1`), preserving historical integrity.
* **Matching Integration**: Normalized attributes mapped directly to matching engine signals; category score matches 100% for same category and separates from generic keys.
* **Privacy**: Private lost-report answers remain restricted to student owner and authorized custodians, never exposed to other claimants.

### Recovery Workflow Verification (Phase 4)
* **Unique Report IDs**: Student lost (`RNT-L-...`) and found (`RNT-F-...`) submissions generate and return permanent human-readable alphanumeric IDs with collision resistance.
* **Custodian QR & Exact-ID Search**: Custodians and admins can look up items directly via exact report ID or parsed QR payload via `exact_id` and `search` query parameters.
* **Claim Approval & Ownership Guard**: Non-staff users receive HTTP 403. Claims require an ownership verification answer; handovers strictly reject unapproved claims or claims with empty verification answers.
* **Valuable Item OTP Verification**: High-risk items (risk tier 1) strictly require OTP verification before handover. OTPs use 15-minute expiry, PBKDF2 hash storage, 5-attempt brute-force lockout, single-use invalidation, and secure regeneration.
* **Handover Completion & Audit Logging**: Confirming collection transitions handover, pickup request, and found item to `RESOLVED`, marks linked matches `CLAIMED`, dispatches student notification, and records structured audit events (`HANDOVER_COMPLETED`, `OTP_VERIFICATION_SUCCESS`).
* **Duplicate Handover Prevention**: Already-completed handovers immediately reject duplicate confirmation attempts with HTTP 400.
* **Match Notifications**: Notifications link to `/matches`, deduplicate on `related_object_id`, and remain isolated per user.


---

## Phase 5: Unique Report IDs, Fast Handover & Admin Controls

### Unique Report IDs
- **Lost items**: permanent `RNT-L-XXXXXX` ID generated on creation; displayed on submission confirmation, report detail, My Lost Items page, and Admin/Custodian Dashboard.
- **Found items**: permanent `RNT-F-XXXXXX` ID generated on creation; displayed everywhere the item appears.
- IDs use a 32-char unambiguous alphabet; collision-safe with retry; `editable=False` in Django model.
- Immutability guard in `save()`: re-fetches original ID from DB before any update to prevent accidental changes.
- ID alone **never** proves ownership; it is an identifier only.

### Found Item Deposit & Printable Sticker
- New `FoundItemSticker` React component: clean 4in × 2.5in printable label containing only Found ID + item category. No QR code, no private student information.
- Sticker shown immediately after student submits a found report (`StudentReportFoundPage`).
- Sticker shown on success screen of staff `RegisterFoundItemPage` with full (non-truncated) ID.
- Custodian sees sticker in `CustodianHandoverModal` deposit-pending section before confirming physical receipt.
- Dashboard `printLabelModal` replaced with `FoundItemSticker` component.

### Fast Owner Collection
- Match notifications (email/in-app) include the Found ID and station code.
- `MatchesPage`: Found ID shown as `font-mono` badge in Location & Holding Station section; also shown in Inspect Match modal with pickup instructions.
- `RecoveryPage`: Approved-claim section shows a prominent blue "Found Report ID to tell Custodian" box with `item.public_id` and "Give this ID at Desk" instruction.
- Custodian searches Found ID at desk, checks approved claim, uses **Complete Handover** button.
- Atomic handover: updates item, pickup, match and handover statuses; records custodian, timestamp, audit event; notifies owner.
- Duplicate handovers blocked; unauthorized collection prevented.
- OTP verification preserved for valuable/high-risk items (`risk_tier=1`).

### Admin Delete Controls
- New `destroy()` actions on `FoundItemAdminViewSet` and `LostItemViewSet`: admin-only soft-delete.
- Soft-archive: sets status to ARCHIVED, dismisses active matches, records `REPORT_ARCHIVED` audit event with `action_type=ADMIN_DELETE`.
- Items with related claims/pickup/handover history get `history_preserved=True` in the response.
- Frontend: Dashboard "Delete Report" button opens confirmation dialog; "Archive" renamed "Delete" in table actions.
- Non-admin staff (custodian) receive 403; students receive 403.

### Bug Fix: Ownership Verification Guard
- Fixed critical bug in `backend/handovers/views.py`: `if not verif or not (...)` was blocking all approved claims that had an `OwnershipVerification` object.
- Corrected to `if verif and not (...)`: only rejects if verification exists but answer is empty.

### Test Results (Targeted)
| Suite | Tests | Result |
|-------|-------|--------|
| `items.tests_unique_ids` | 6 | ✅ All pass |
| `items.tests_admin_handover_otp` | 20 | ✅ All pass |
| `items.tests_fraud_prevention` | 31 | ✅ All pass |
| Frontend build (`tsc && vite build`) | — | ✅ 0 errors |

### Files Changed
| File | Change |
|------|--------|
| `backend/items/models.py` | ID immutability: `editable=False` + save guard |
| `backend/items/views.py` | Admin `destroy()` for found and lost items |
| `backend/items/services/matching.py` | Found ID + station in match notifications |
| `backend/handovers/views.py` | Fix ownership verification logic bug |
| `frontend/src/components/FoundItemSticker.tsx` | New printable sticker component |
| `frontend/src/pages/StudentReportFoundPage.tsx` | Sticker on success screen |
| `frontend/src/pages/RegisterFoundItemPage.tsx` | Full Found ID + sticker on success |
| `frontend/src/pages/DashboardPage.tsx` | Deposit button, Delete button, sticker modal, audit events |
| `frontend/src/components/CustodianHandoverModal.tsx` | Deposit confirmation + sticker UI |
| `frontend/src/pages/MatchesPage.tsx` | Found ID badge in match cards and modal |
| `frontend/src/pages/RecoveryPage.tsx` | Prominent Found ID box for approved claims |

### Match Notifications (Phase 10)
* **Trigger Points**: `MATCH_FOUND` notifications are created by the real matching engine — `evaluate_lost_item_matches` (when a student submits a lost report) and `evaluate_found_item_matches` (when staff publish a found item). Both paths use `notify=True` from existing views.
* **Deduplication**: Each lost report receives at most **one** `MATCH_FOUND` notification, keyed on `related_object_id = lost_item.public_id`. Re-running matching or re-publishing a found item never creates a duplicate.
* **Message Quality**: Notification title reflects match strength (`Possible Match — Electronics` vs `Strong Possible Match — Electronics`). Message includes match count, best score, label, and a prompt to visit the Matches page.
* **Deep Linking**: `action_url = '/matches'` is stored on every MATCH_FOUND notification. The frontend `NotificationsPage` prefers `n.action_url` over the generic meta path, so future per-report deep links will work without UI changes.
* **User Isolation**: Notifications are strictly scoped per user — each student receives only notifications for their own lost reports.
* **API Visibility**: `action_url` and `related_object_id` are serialized and returned by `GET /api/notifications/` for frontend consumption.
* **Existing UI Integration**: `NotificationsPage.tsx` already handled `MATCH_FOUND` with a "Potential Match" badge (purple), "View Matches" action, and unread indicator. No UI redesign required.

### Nearest Station Recommendation (Requirement 7)
* **Geolocation Consent**: Browser geolocation requested only upon explicit user click ("Find Nearby Stations").
* **Accurate Proximity**: Haversine distance calculated only when verified GPS coordinates exist.
* **Honest Fallback**: When GPS is unconfigured or permission is denied, users filter by block/building without blocking reporting.
* **Backend Enforcement**: Inactive or unverified stations are rejected by backend serializers on submission.

### UI/UX & Design System (Requirement 9)
* **Light Mode Default**: First-time visitors without saved preference default strictly to Light mode.
* **Theme Persistence**: Theme toggle in navbar switches to Dark mode and saves to `localStorage`.
* **Accessible Toggle**: Descriptive `aria-label` reflects current theme state.

---

## 2. AUTOMATED TESTING & BUILD VERIFICATION

* **Django System Checks**: PASS (`python manage.py check` — 0 issues identified)
* **Database Schema Integrity**: PASS (`python manage.py makemigrations --check --dry-run` — 0 changes detected)
* **Backend Automated Test Suite**: PASS (177 tests passing across `accounts`, `items`, `collectionpoint`, `notifications`, and `pickup` — including 17 Vehicle Keys tests, 11 AI description service tests, and 7 Match Notification tests)
* **Frontend Production Build**: PASS (`tsc && vite build` — 0 errors, built in 2.37s)
* **Local Development Servers**:
  - Backend API: `http://127.0.0.1:8000/` (Responding HTTP 200)
  - Frontend: `http://localhost:5173/` (Responding HTTP 200)

---


---

## Phase 6: End-to-End Workflow & Acceptance Testing

### Automated Test Coverage & Results
Comprehensive targeted regression & end-to-end test execution covering 79 targeted automated tests:

| Suite | File | Tests | Status | Scope |
|-------|------|-------|--------|-------|
| E2E Recovery Workflow | `items.tests_e2e_workflow` | 15 | ✅ 15/15 Pass | Complete Lost->Found->Deposit->Match->Claim->Handover->Audit trail |
| Unique IDs & Custody | `items.tests_unique_ids` | 13 | ✅ 13/13 Pass | ID format (`RNT-L-* / RNT-F-*`), immutability, exact ID lookup, admin delete |
| Admin Handover & OTP | `items.tests_admin_handover_otp` | 20 | ✅ 20/20 Pass | Valuable OTP verification, non-valuable fast handover, dispute blocking |
| Fraud Prevention | `items.tests_fraud_prevention` | 31 | ✅ 31/31 Pass | Rate limiting, brute-force OTP lockout, ownership verification checks |
| **Total Automated Tests** | | **79** | **✅ 100% Pass** | Ran in 190.677s |

### Frontend Build Verification
- `npm run build` (`tsc && vite build`): ✅ Built cleanly with 0 TypeScript errors and 0 build warnings.

### Workflow & Invariant Acceptance Matrix
1. **Unique Report IDs**:
   - Lost reports generate permanent `RNT-L-XXXXXX`; Found reports generate permanent `RNT-F-XXXXXX`.
   - Backend database model guard prevents ID mutation on existing records.
   - IDs are displayed on report submissions, dashboard, matches list, and recovery desk cards.
2. **Found Item Deposit & Printable Sticker**:
   - `FoundItemSticker` component renders exclusively Found ID and item category on a 4in x 2.5in printable thermal layout.
   - No QR codes, student names, phone numbers, or emails appear on physical stickers.
   - Items remain in `DEPOSIT_PENDING` until custodian verifies and confirms physical receipt.
3. **Fast Owner Collection**:
   - Match notifications include the Found ID and station code for prompt pickup.
   - Recovery page displays a dedicated "Found Report ID to tell Custodian" block with station details.
   - Custodians complete handover via single-click confirmation for verified ordinary items.
   - Atomic state transitions: updates Found item (`RESOLVED/COLLECTED`), Lost item (`RESOLVED`), Match (`CLAIMED`), Handover (`COMPLETED`), and records an audit log.
4. **Valuable Item Protection & Fraud Controls**:
   - High-risk items (`risk_tier=1`) require 6-digit OTP verification.
   - 5 failed OTP attempts lock the handover to prevent brute force attacks.
   - Active disputes block handover until resolved by administrators.
5. **Admin Deletion & Custodial Audit Preservation**:
   - Admins can soft-archive Lost and Found reports with required audit reason.
   - Prior custody, claim, and handover history remain intact (`history_preserved=True`).
   - Custodians and students are strictly blocked with 403 Forbidden on report deletion.

---

## Phase 7: Hide Found Item Details from Students (Security & Anti-Fraud)

### 1. Objective & Threat Model
To prevent false ownership claims, social engineering, and fraud, students browsing available found items or reviewing potential matches must NOT see photos, thumbnails, or identifying descriptions. Authorized staff (custodians, admins) preserve complete access to all item details, photos, descriptions, and custody information on the backend.

### 2. Backend Role-Based Protection & Response Filtering
- **Role-Aware Serializer (`AvailableItemPublicSerializer`)**:
  - Automatically identifies caller via `is_staff_user(request)`.
  - For non-staff / students / anonymous callers:
    - `images = []`: All image URLs, previews, and Cloudinary media are redacted.
    - `description = None`: Detailed item description is hidden.
    - `title = obj.category`: Specific titles are replaced with broad category (e.g., `"Electronics"`).
    - `found_location = None`: Exact found location is hidden.
    - `cannot_carry_details = None`: Internal handling details hidden.
    - `availability_status = "Available for verification"`: Standardized status.
    - Permitted safe fields: `public_id` (`RNT-F-...`), `category`, `found_date`, `collection_location` (general building/desk).
  - For staff / custodians / admins: Unredacted images, raw titles, descriptions, and internal notes are fully preserved.
- **Search-Oracle Probing Prevention (`AvailableItemsPublicViewSet`)**:
  - `get_queryset()` was restricted for non-staff callers to only filter on safe fields (`category`, `public_id`, `collection_point__building`).
  - Queries against `description`, `title`, and `found_location` are blocked for students, preventing information leakage via search parameter probing.
- **Match Notifications Security (`matching.py`)**:
  - In-app and email match notifications for students use broad category labels instead of found item titles, preventing notifications from leaking secret item details.
- **Staff Admin Endpoints**:
  - `FoundItemAdminViewSet`, `ClaimAdminSerializer`, and `HandoverStaffDetailSerializer` retain full unredacted access, custody audit events, and image attachments.

### 3. Frontend Student Portal Enhancements
- **Available Items Page (`AvailableItemsPage.tsx`)**:
  - Removed image previews, raw titles, and item descriptions from student cards.
  - Replaced with clean security-focused cards displaying Category, Found ID badge, holding station/building, and found date.
  - Added "Details Protected for Ownership Verification" security notice.
  - Updated search input placeholder to search only by Category, Report ID, or Building.
  - Claim modal stripped of visual previews to maintain verification integrity.
- **Matches Page (`MatchesPage.tsx`)**:
  - Removed thumbnail image previews (`primaryImage`), descriptions, and exact found location from match cards.
  - Modal details genericized for student claimants to require independent verification at the recovery desk.

### 4. Verification & Automated Test Coverage
- Created `backend/items/tests_hide_found_details.py` with 7 targeted security test cases:
  - `test_student_available_items_api_hides_images_and_description`: Confirms `images == []`, `description is None`, and title equals category.
  - `test_student_available_items_api_exposes_safe_fields`: Confirms `public_id`, `category`, `found_date`, and building are preserved.
  - `test_staff_available_items_api_preserves_full_details`: Confirms staff receive full photos, description, and raw title.
  - `test_search_filter_does_not_leak_via_description_probing`: Confirms students cannot probe secret descriptions using search query parameters.
  - `test_matches_api_hides_found_item_details_for_student`: Confirms nested found item in matches hides photos and descriptions.
  - `test_match_notification_does_not_leak_found_title`: Confirms notification messages use broad category rather than secret title.
  - `test_staff_found_item_admin_api_retains_full_details`: Confirms staff admin endpoints retain full details and images.

---

## Phase 8: Production Security & Deployment Audit

### 1. Security Audit Findings & Fixes
- **Student Found Item Hard-Delete Vulnerability (HIGH)**:
  - *Finding*: StudentFoundItemViewSet inherited ModelViewSet without overriding destroy(). Authenticated students could issue DELETE /api/items/student-found/<id>/ and hard-delete their report, bypassing admin controls, custody history, and audit trails.
  - *Fix*: Implemented destroy() in StudentFoundItemViewSet returning HTTP 403 Forbidden. Added automated security test test_student_found_item_cannot_be_deleted_by_student.
- **Ownership Verification Answer Exposure in Third-Party Contexts (MEDIUM)**:
  - *Finding*: OwnershipVerificationSerializer exposed plaintext student_answer without verifying whether the requesting user was the claim owner or staff member (e.g. when nested inside dispute payloads).
  - *Fix*: Added role/ownership guard in OwnershipVerificationSerializer.to_representation(). When evaluated by non-staff users other than the student claimant, student_answer is masked as [Protected Verification Detail]. Added test test_ownership_verification_answer_redacted_for_third_party.
- **Missing Django Schema Migration (MEDIUM)**:
  - *Finding*: Model changes (editable=False on public_id for FoundItem and LostItem) caused python manage.py makemigrations --check to exit with failure code 1.
  - *Fix*: Generated migration 0007_alter_founditem_public_id_alter_lostitem_public_id.py and applied it. makemigrations --check --dry-run now reports 0 missing changes.
- **Production Cookie & Security Headers (HIGH)**:
  - *Finding*: When DEBUG = False, SESSION_COOKIE_SECURE, CSRF_COOKIE_SECURE, SECURE_BROWSER_XSS_FILTER, SECURE_CONTENT_TYPE_NOSNIFF, SECURE_HSTS_SECONDS, and SECURE_PROXY_SSL_HEADER were unconfigured, triggering warnings in Django's deployment check.
  - *Fix*: Configured secure cookies, HSTS headers, and proxy SSL header for reverse-proxy / Railway environments.
- **Insecure Default Secret Key Guard (HIGH)**:
  - *Finding*: settings.py allowed running with a hardcoded insecure secret key if DJANGO_SECRET_KEY was omitted in production.
  - *Fix*: Added strict ImproperlyConfigured guard preventing server boot when DJANGO_DEBUG=False without an explicit production secret key.
- **REST Framework Throttling (MEDIUM)**:
  - *Finding*: DRF global rate throttling was unconfigured.
  - *Fix*: Added AnonRateThrottle (120/min) and UserRateThrottle (1200/min) to REST_FRAMEWORK default throttle classes, preventing automated credential brute forcing and endpoint scraping.
- **Health Endpoint Database Status (LOW)**:
  - *Finding*: /api/health/ returned HTTP 200 without actively testing the database connection. Root /health/ and /healthz/ did not exist.
  - *Fix*: Exposed /health/ and /healthz/ at the root and added active connection.ensure_connection() check returning HTTP 503 if the database is unreachable.

### 2. Verification Results
- **Django Security & Deployment Check**: PASS (0 issues with python manage.py check).
- **Database Schema & Migrations**: PASS (makemigrations --check --dry-run reports 0 unapplied changes).
- **Targeted Security Test Suite**: PASS (items.tests_hide_found_details - 9/9 passed in 21.276s).
- **Frontend Production Build**: PASS (tsc && vite build - 0 errors, built in 1.03s).

## 3. MANUAL ACCEPTANCE TESTING CHECKLIST

### Authentication & Student Journey (`http://localhost:5173/`)
- [x] 1. Navigate to `/signup`; test password and confirm-password show/hide eye toggles.
- [x] 2. Register with personal email (e.g. Gmail) or mobile phone.
- [x] 3. Navigate to `/login`; test password show/hide eye toggle; sign in with student account.
- [x] 4. Toggle dark/light mode in navbar; verify light mode on first visit and persistent dark mode upon page refresh.
- [x] 5. Navigate to `/lost`, select category, verify 3–4 tailored MCQs appear, and submit report.
- [x] 6. Navigate to `/found`, upload photo, verify automatic AI analysis trigger, review editable fields, and test nearest station assistance.
- [x] 7. View `/dashboard`, verify honest zero metrics and active recovery cards.

### Staff & Custodian Journey (`http://localhost:5173/login?portal=staff`)
- [x] 1. Log in with staff credentials.
- [x] 2. Navigate to `/admin/collection-points`; review Medicaps University details and 24 blocks.
- [x] 3. Verify 3 ambiguous stations flagged for administrative confirmation.
- [x] 4. Test "Edit Details" on campus banner to update institutional details.
- [x] 5. Test "Manage Blocks" to inspect and add official blocks.
- [x] 6. Review Needs Attention metrics; verify all values query genuine database records.

---

## 4. DEPLOYMENT READINESS

* Production settings (`settings.py`) configured for:
  - `DJANGO_SECRET_KEY`
  - `DJANGO_DEBUG=False`
  - `DJANGO_ALLOWED_HOSTS`
  - PostgreSQL (`DATABASE_URL`)
  - CORS (`CORS_ALLOWED_ORIGINS`) and CSRF (`CSRF_TRUSTED_ORIGINS`)
  - Persistent media (`MEDIA_ROOT`)
* Full documentation provided in `COLLEGE_DEPLOYMENT_GUIDE.md` and `docs/AI_IMAGE_DESCRIPTION_SETUP.md`.


---

## Phase 9: Live Deployment Configuration

### Architecture
- **Frontend**: Vercel static hosting (`*.vercel.app`)
- **Backend API**: Railway (`https://reunite-production.up.railway.app`)
- **API Routing**: Vercel `vercel.json` rewrites `/api/*` to `https://reunite-production.up.railway.app/api/*`
- **Database**: Railway PostgreSQL (auto-injected `DATABASE_URL`)
- **Media Storage**: Cloudinary

### API Client Design (No Duplicate /api Prefixes)
- `frontend/src/services/api.ts`: If `VITE_API_URL` ends in `/api`, strips trailing `/api` to prevent duplicate path segments.
- On Vercel with empty `VITE_API_URL`: relative `/api/...` calls are rewritten by `vercel.json` to the Railway backend.
- Correct Vercel frontend env: `VITE_API_URL=` (empty) — requests use the Vercel rewrite proxy.
- `vercel.json` correctly maps: `"/api/:path*"` to `"https://reunite-production.up.railway.app/api/:path*"`.

### Fixes Made (Pending Deployment)
| File | Fix |
|------|-----|
| `backend/items/views.py` | `AvailableItemsPublicViewSet.permission_classes` changed from `[IsAuthenticated]` to `[AllowAny]`. Browsing the Found Items catalog now works for unauthenticated and student users without a 401. Role-based field hiding in serializer still applies. |
| `backend/reunite_backend/settings.py` | Added Railway-domain fallback to `ALLOWED_HOSTS` without requiring explicit `DJANGO_ALLOWED_HOSTS` env var: hard-coded safe defaults for `*.up.railway.app`. |
| `backend/reunite_backend/settings.py` | Added `CORS_ALLOWED_ORIGIN_REGEXES` for `*.vercel.app` when `CORS_ALLOWED_ORIGINS` env var is empty; default `CSRF_TRUSTED_ORIGINS` includes Railway and Vercel domains. |
| `backend/reunite_backend/urls.py` | Added root `/health/` and `/healthz/` routes for Railway health probes. |

### Live Endpoint Verification (Actual Results)
| Endpoint | Status | Notes |
|----------|--------|-------|
| `GET /api/health/` | PASS HTTP 200 | `{"status": "ok", "database": "postgresql"}` PostgreSQL live |
| `GET /api/items/public-stats/` | PASS HTTP 200 | Returns real counts from PostgreSQL |
| `GET /api/items/available-items/` | FAIL HTTP 401 | Production still has IsAuthenticated, fixed locally, needs deploy |
| `GET /health/` | FAIL HTTP 404 | Root health paths fixed locally, needs deploy |

### Required Railway Environment Variables (By Name Only)
- `DJANGO_DEBUG` = False (required)
- `DJANGO_SECRET_KEY` = 50+ char random key (required)
- `DATABASE_URL` = Auto-injected by Railway PostgreSQL plugin
- `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET` (required)
- `CORS_ALLOWED_ORIGINS` = Vercel app URL (recommended)
- `CSRF_TRUSTED_ORIGINS` = Railway + Vercel URLs (recommended)
- `DJANGO_ALLOWED_HOSTS` = Optional; falls back to `.up.railway.app`
- `GEMINI_API_KEY` = Optional for AI image analysis

### Required Vercel Environment Variables
- `VITE_API_URL` = (leave empty) — requests are proxied via `vercel.json` rewrites

### Remaining Blockers
1. Deploy local Phase 7-9 changes to Railway so `/api/items/available-items/` returns HTTP 200 for students.
2. Set `CORS_ALLOWED_ORIGINS` on Railway to exact Vercel deployment URL.
3. Set `CSRF_TRUSTED_ORIGINS` on Railway to include both Railway backend and Vercel frontend URLs.

### Single Recommended Next Step
Commit and push all Phase 7-9 changes and trigger a Railway redeploy, then verify:
1. `GET https://reunite-production.up.railway.app/api/items/available-items/` returns HTTP 200.
2. `GET https://reunite-production.up.railway.app/health/` returns HTTP 200.
3. Login from Vercel frontend reaches Railway backend without CORS errors.

---

## Phase 11: Role-Based Portals & Separate Account Creation

### 1. Architecture & Portals Separation
- **Student Portal**:
  - Dedicated sign-in (`/login`) and public registration (`/signup`).
  - Public signups are strictly student-only. `role` field from client payloads is ignored or defaulted to `student` by backend serializers.
  - Student navigation and views: Personal dashboard, Report Lost (`/lost`), Report Found (`/found`), Browse Items (`/found-items`), Campus Stations (`/stations`), My Reports (`/my-reports`), My Matches (`/my-matches`), Recovery (`/recovery`), Notifications (`/notifications`), Profile (`/profile`).
  - Student accounts cannot access admin desk or staff operations.
- **Admin Portal**:
  - Separate Admin sign-in route (`/admin/login`).
  - Backend login validates `portal='admin'`; student accounts attempting to log in on the Admin portal are rejected with HTTP 403 Forbidden.
  - Dedicated staff user management API (`/api/auth/users/`):
    - Admin accounts can **ONLY** be created by an authenticated Super Admin.
    - Custodian accounts can be created by authenticated Admins or Super Admins.
    - Public signup or unauthenticated callers receive HTTP 401/403.
    - Never allows creating `superadmin` through the API.
  - Root Super Admin setup preserved via backend command (`python manage.py createsuperuser`), automatically assigning `role='superadmin'`, `is_staff=True`, and `is_superuser=True`.
  - Admin navigation and views: Admin Dashboard, Institutional Reports Management, User Management (`/admin/users`), Campus Stations (`/admin/collection-points`), Claims Review (`/admin/verification`), Handover Center (`/admin/handovers`), Disputes Management (`/admin/disputes`), Audit Log Browser, and Student Feedback Analytics.
- **Custodian Portal**:
  - Accounts provisioned by authorized Admin/Super Admin. No public registration option.
  - Custodian navigation and views: Station Custodial Dashboard, Assigned Task Queue, Deposits & Physical Custody Queue, and Authorized Handovers (`/admin/handovers`).
  - Custodians have zero access to User Management, Audit Log Browser, Station Configuration, or Dispute Resolution.
  - Custodians cannot soft-delete or archive reports (Delete control hidden in UI and restricted to `IsAdmin` on backend).

### 2. Backend Security & Authoritative Guards
- `backend/accounts/models.py`:
  - `UserManager.create_superuser`: sets `role='superadmin'`, `is_staff=True`, `is_superuser=True`.
  - `User.save()`: guards role consistency with `is_staff` and `is_superuser`.
- `backend/accounts/serializers.py`:
  - `AdminCreateUserSerializer`: strictly limits assignable roles to `admin` and `custodian`.
  - `StaffUserSerializer`: safe serialization of staff accounts without leaking sensitive password hashes.
- `backend/accounts/views.py`:
  - `LoginView`: blocks students from signing in to the admin portal (`portal='admin'`) with HTTP 403.
  - `AdminUserManagementView`: enforces that creating `admin` requires `superadmin`, while creating `custodian` requires `admin` or `superadmin`.
- `backend/audit/views.py`:
  - `AuditLogViewSet`: restricted to `IsAdmin` (`admin`, `superadmin`). Custodians and students receive HTTP 403.
- `backend/pickup/views.py`:
  - `StaffDisputeViewSet`: restricted to `IsAdmin`.

### 3. Verification & Automated Test Results
- **Accounts Automated Test Suite**: PASS (22/22 tests passing in 29.980s):
  - `test_login_portal_admin_rejects_student`: ✅ PASS (HTTP 403)
  - `test_login_portal_admin_allows_admin_and_custodian`: ✅ PASS (HTTP 200)
  - `test_admin_user_endpoint_security`: ✅ PASS (Unauthenticated 401, Student 403, Custodian 403, Admin cannot create Admin 403, Admin can create Custodian 201, Superadmin can create Admin 201, Superadmin can create Custodian 201, cannot create superadmin 400)
  - `test_createsuperuser_sets_superadmin_role`: ✅ PASS (`role='superadmin'`)
  - `test_role_security_audit_logs_and_disputes`: ✅ PASS (Audit logs: Student 403, Custodian 403, Admin 200; Disputes: Custodian 403, Admin 200)
- **Collection Points Test Suite**: PASS (7/7 tests passing in 14.659s).
- **Hide Found Details Security Test Suite**: PASS (9/9 tests passing in 25.708s).
- **Django System Check**: PASS (`python manage.py check` — 0 issues).
- **Django Migrations Check**: PASS (`python manage.py makemigrations --check --dry-run` — 0 unapplied changes).
- **Frontend Production Build**: PASS (`tsc && vite build` — 0 errors, built in 1.06s).

---

## Phase 12: Role-Based Workflow Acceptance

### Acceptance Matrix & Verification Results

| # | Workflow / Acceptance Requirement | Verification Mechanism | Status |
|---|---|---|---|
| 1 | **Student signup always creates Student account**<br>Tampering with request payload (`role='admin'`, `'superadmin'`, `'custodian'`) is ignored; account is created strictly with `role='student'`, `is_staff=False`, `is_superuser=False`. | `accounts.tests_phase12_acceptance.Phase12WorkflowAcceptanceTests.test_workflow_1_student_signup_always_creates_student_role` | ✅ VERIFIED |
| 2 | **Student login works at `/login`; Student login through `/admin/login` rejected**<br>Student credentials succeed with HTTP 200 and token on public portal (`portal='student'`); rejected with HTTP 403 Forbidden on staff portal (`portal='admin'`). Admin & Custodian accounts succeed on `/admin/login`. | `accounts.tests_phase12_acceptance.Phase12WorkflowAcceptanceTests.test_workflow_2_student_login_rejection_at_admin_portal` | ✅ VERIFIED |
| 3 | **Super Admin creates Admin and Custodian accounts**<br>Super Admin (`/admin/users`) provisions Admin and Custodian accounts with HTTP 201; assignable roles strictly constrained to `admin` and `custodian`. | `accounts.tests_phase12_acceptance.Phase12WorkflowAcceptanceTests.test_workflow_3_superadmin_can_create_admin_and_custodian` | ✅ VERIFIED |
| 4 | **Admin can create Custodian but cannot create Admin**<br>Admin provisioning Custodian succeeds with HTTP 201; Admin attempting to provision Admin returns HTTP 403 Forbidden ("Permission denied: only Super Admins can create Admin accounts."). | `accounts.tests_phase12_acceptance.Phase12WorkflowAcceptanceTests.test_workflow_4_admin_can_create_custodian_not_admin` | ✅ VERIFIED |
| 5 | **Custodian access bounded to assigned station & handovers**<br>Custodian can view stations (`/api/collection-points/`) and handovers (`/api/handovers/admin/`). Custodian blocked with HTTP 403 from User Management (`/api/auth/users/`), Audit Logs (`/api/audit/logs/`), Disputes Queue (`/api/pickup/disputes/admin/`), and report soft-deletion (`DELETE /api/items/found-items/{id}/`). | `accounts.tests_phase12_acceptance.Phase12WorkflowAcceptanceTests.test_workflow_5_custodian_permissions_and_boundaries` | ✅ VERIFIED |
| 6 | **Role dashboard, navigation, and metrics isolation**<br>Student dashboard shows personal lost/found items and recovery; blocked with HTTP 403 from `/api/items/admin-stats/`. Staff access operational metrics. Public trust metrics (`/api/items/public-stats/`) accessible to all. | `accounts.tests_phase12_acceptance.Phase12WorkflowAcceptanceTests.test_workflow_6_role_dashboard_metrics_isolation` | ✅ VERIFIED |
| 7 | **Direct URL and API access blocked server-side**<br>Unauthenticated access returns HTTP 401. Student access to staff/admin routes (`/api/auth/users/`, `/api/audit/logs/`, `/api/pickup/disputes/admin/`, `/api/handovers/admin/`) returns HTTP 403. Frontend protected routes enforce role-based redirection. | `accounts.tests_phase12_acceptance.Phase12WorkflowAcceptanceTests.test_workflow_7_server_side_authorization_blocks` | ✅ VERIFIED |
| 8 | **Refresh, logout, session persistence, role-specific redirects**<br>Session persistence verified via token bearer auth on `GET /api/auth/me/`. Logout clears token session via `POST /api/auth/logout/`. Role-specific routes direct student to Student Portal and staff to Admin Portal. | `accounts.tests_phase12_acceptance.Phase12WorkflowAcceptanceTests.test_workflow_8_session_persistence_and_logout` | ✅ VERIFIED |
| 9 | **Private data exposure prevention**<br>Staff user endpoint (`/api/auth/users/`) excludes password hashes. Lost item private questionnaire answers isolated strictly to report owner (`GET /api/items/lost-items/{id}/` returns 404 for other students). Public catalog masks serial numbers, IMEIs, internal notes. | `accounts.tests_phase12_acceptance.Phase12WorkflowAcceptanceTests.test_workflow_9_private_data_never_exposed` | ✅ VERIFIED |
| 10 | **Regression suite: Lost/Found, matching, notifications, IDs, handover OTP**<br>Unique ID generation (`RNT-L-*`, `RNT-F-*`), physical custody transitions, pickup requests, handover generation, 15-minute OTP lifecycle, brute-force lockout, single-use invalidation, and match notifications verified across full regression suite. | `accounts.tests_phase12_acceptance.Phase12WorkflowAcceptanceTests.test_workflow_10_lost_found_unique_ids_and_handover_flow`<br>`items.tests_unique_ids`<br>`items.tests_admin_handover_otp`<br>`items.tests_fraud_prevention` | ✅ VERIFIED |

### Test Suite Execution Summary
- `python manage.py test accounts.tests_phase12_acceptance`: **10/10 PASSED** (45.385s)
- `python manage.py test accounts`: **34/34 PASSED** (84.429s)
- `python manage.py test items.tests_unique_ids items.tests_admin_handover_otp items.tests_fraud_prevention`: **64/64 PASSED** (155.271s)
- `python manage.py test collectionpoint`: **7/7 PASSED** (14.659s)
- `python manage.py test items.tests_hide_found_details`: **9/9 PASSED** (25.708s)
- `python manage.py check`: **0 issues**
- `python manage.py makemigrations --check --dry-run`: **0 changes detected**
- `npm run build`: **Built cleanly in 2.83s** (0 TypeScript errors)

---

## Phase 14: Super Admin Production Setup

### 1. Architecture & Model Enhancements
- **Admin ID Model Field** (`backend/accounts/models.py`):
  - Added `admin_id = models.CharField(max_length=50, blank=True, null=True, unique=True, db_index=True)` to `User`.
  - Updated `UserManager._create_user` and `create_superuser` to allow account creation using `admin_id` without requiring an email address.
  - Safe, non-destructive migration: `backend/accounts/migrations/0004_user_admin_id.py` (nullable with database index).
- **Resolver & Serializer Support** (`backend/accounts/serializers.py`):
  - `find_user_by_identifier` updated with case-insensitive `admin_id` matching: `Q(admin_id__iexact=cleaned)`.
  - `UserSerializer` and `StaffUserSerializer` include `admin_id` field.
  - Preserved existing email, personal email, and mobile phone authentication for Student, Custodian, and Admin users.
- **Admin Portal Login Integration** (`backend/accounts/views.py` & `frontend/src/pages/LoginPage.tsx`):
  - Backend `LoginView` accepts `identifier` or `admin_id`.
  - Frontend Admin Portal mode displays dynamic labels and placeholders: `Admin ID or Email` / `RNT-SUPER-001 or admin@campus.edu`.

### 2. Idempotent Management Command
- `backend/accounts/management/commands/setup_initial_superadmin.py`:
  - Provisioning command supporting `--admin-id`, `--name`, `--email`, and password resolution via `--password`, `INITIAL_SUPERADMIN_PASSWORD` env var, or interactive prompt.
  - Strictly stores password hash via `user.set_password()` (PBKDF2-SHA256); plaintext is never stored or logged.
  - Idempotent: checks if `admin_id` already exists and exits safely with `[ALREADY EXISTS]` without modifying existing data.
  - Emits audit log entry (`SUPERADMIN_INITIAL_SETUP`).

### 3. Railway Production Deployment Compatibility
- Verified Railway release execution in both root `Procfile` and `backend/Procfile`:
  `release: python backend/manage.py migrate --no-input`
  and in `backend/Dockerfile`:
  `CMD ["sh", "-c", "python manage.py migrate --no-input && gunicorn reunite_backend.wsgi:application ..."]`
  ensuring migration `0004_user_admin_id` is executed automatically before application startup.


