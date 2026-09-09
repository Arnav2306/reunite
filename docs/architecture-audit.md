# Architecture Audit

## 1. Product Requirements (from PRD)
- Core loop: FIND → REPORT → SECURE → MATCH → VERIFY → RETURN.
- Minimal digital effort for Finder (<60 s).
- AI‑assisted classification, embedding, matching, but never authoritative for ownership or custody.
- Physical stations with permanent QR, capacity, backup, and zone assignment.
- Admin‑posted “Available for Collection” items (not a marketplace).
- OTP hand‑over, ownership verification via dynamic questions, audit‑able custody events.
- Operational dashboards, analytics, notifications.

## 2. Roles & Permissions (Roles.md)
| Role | Key Capabilities |
|------|------------------|
| Student | Auth, create lost/found reports, view own reports, browse/claim listings, answer verification, receive OTP, notifications. |
| Custodian | Assigned‑zone tasks, scan stations, record custody events, verify OTP, confirm hand‑over. |
| Admin | Manage stations (scoped), publish listings, configure risk/verification/OTP, review disputes, analytics, audit logs. |
| Super Admin | Global system configuration, campus/floor hierarchy, global RiskPolicy, feature flags, integrations. |

## 3. Major Entities (Core Entities section)
- **User**, **Campus**, **Building**, **Floor**, **Zone**, **CollectionPoint** (station).
- **LostItem**, **FoundItem**, **Listing** (admin‑posted), **ItemImage**, **ItemEmbedding**.
- **QuestionTemplate**, **VerificationQuestion**, **VerificationAttempt**.
- **Match**, **RiskPolicy**, **PickupRequest**, **Handover**.
- **CustodyEvent**, **Notification**, **NotificationPreference**.
- **DuplicateCandidate**, **Dispute**, **FraudFlag**, **Disposition**, **AuditLog**.

## 4. Front‑end Modules (Design spec)
- Auth, Lost, Found, Available‑Items, My‑Reports, My‑Matches, Notifications, Profile (student).
- Admin Dashboard, Post‑Item, Listings Management, Stations, Custody, Analytics (admin).
- Shared components: UI toolkit, routing, state management (TanStack Query), form handling (React Hook Form + Zod).

## 5. Backend Django Apps (Architecture.md)
- **accounts** – auth, RBAC.
- **campus** – campus/building/floor models.
- **stations** – QR, capacity, status, backup logic.
- **items** – LostItem, FoundItem, Listing, images, embeddings, risk.
- **ai** – vision, embedding jobs.
- **matching** – candidate retrieval, scoring.
- **verification** – dynamic question templates, attempts.
- **custody** – state machine, events.
- **pickup** – OTP generation/validation, hand‑over.
- **notifications** – push/email/in‑app.
- **moderation** – duplicates, disputes, fraud.
- **analytics** – metric aggregation.
- **audit** – immutable audit log.

## 6. API Boundaries (PRD – API Surface)
| Area | Endpoint(s) |
|------|------------|
| Auth | `/api/auth/*` |
| Lost | `/api/lost-items*` |
| Found | `/api/found-items*` |
| Stations | `/api/stations*` |
| Listings | `/api/available-items*` |
| Matches | `/api/matches*` |
| Verification | `/api/matches/:id/verify` |
| Pick‑up / OTP | `/api/pickups*` |
| Notifications | `/api/notifications*` |
| Custodian tasks | `/api/custodian/*` |
| Admin operations | `/api/admin/*` |
All endpoints are **server‑side authorized** based on role and object‑level policies.

## 7. Database Requirements
- PostgreSQL primary store; pgvector extension for embeddings.
- Indexes on status, category, location (building/floor), risk tier, station, timestamps, vector similarity.
- Transactional integrity for custody state transitions.
- Auditable immutable tables for `CustodyEvent` and `AuditLog`.

## 8. Asynchronous AI / Background Jobs (Architecture.md – Async Jobs)
- Celery workers with Redis broker.
- Jobs: `analyze_found_item`, `generate_embedding`, `match_new_found_item`, `refresh_watchlist`, `send_notification`, `expire_item/listing`, `duplicate_detection`, `analytics_aggregation`.
- Idempotent, retryable, results stored on Item models.

## 9. Authentication & Authorization
- College email/SSO login (OAuth2/OpenID Connect).
- JWT access tokens with short TTL, secure http‑only cookies optional.
- Server‑side RBAC (roles) plus object‑level checks (e.g., custodian zone, ownership verification).
- Rate‑limiting on OTP/verification endpoints.

## 10. Physical Custody Workflows
- State machine (REPORTED → DEPOSIT_PENDING → DEPOSITED → COLLECTED → SECURE_HOLD → MATCH_FOUND → VERIFICATION_PENDING → READY_FOR_PICKUP → HANDOVER → RESOLVED) plus side states (DISPUTED, EXPIRED, etc.).
- Each transition creates a `CustodyEvent` + `AuditLog`.
- Stations enforce capacity and status; fallback recommendation logic.

## 11. Admin “Available for Collection / Post Item” Workflow
1. Admin creates a **Listing** with safe public details and optional verification/OTP flags.
2. Item is already physically held; no deposit step required.
3. Student browses, requests collection, passes verification (if required), receives OTP, shows OTP to custodian, hand‑over recorded.
4. All steps reuse the same custody & pickup pipelines as found‑item flow.

## 12. Phase Dependencies (Phases.md)
- **Phase 0** → freeze docs, generate ADRs, repo scaffold.
- **Phase 1** provides core data model, auth, basic UI, and admin listing – prerequisite for all later phases.
- **Phase 2** depends on stations & QR routes.
- **Phase 3‑4** need AI jobs & embeddings.
- **Phase 5‑6** need verification & risk policy.
- **Phase 7‑9** build notifications, moderation, analytics.
- **Phase 10‑12** add reliability, testing, deployment.

## 13. Detected Conflicts / Ambiguities
| Issue | Description | Impact |
|-------|-------------|--------|
| “Finder effort <60 s” vs. AI processing time | AI jobs are async; UI must show immediate success and later update. No conflict if UI shows placeholder, but spec does not explicitly define UI handling of pending AI. | Requires clear loading/notification strategy (covered in Design “AI failure copy”). |
| “Admin‑posted items” vs. “Never marketplace” | Need to ensure no price/transaction fields leak; design already avoids them, but data model (`Listing`) could be mis‑interpreted as a marketplace. Must enforce read‑only pricing fields (none exist). |
| “RiskPolicy” configuration – who can edit? | Roles.md says Admin can configure scoped policies; Super Admin can configure global. No explicit API endpoint for policy management – must be added in Phase 1 or later. |
| “OTP is not ownership proof” but OTP UI shows code to student. | Must ensure OTP expiration and hashing; also UI should not expose OTP in URLs (spec already warns). |
| “Verification attempts must be counted, rate‑limited, audited” – no explicit throttling spec. | Implementation must add per‑user attempt counters and audit logs. |
| “Station QR route `/station/<id>`” – no API endpoint currently listed for QR lookup. | Need a public read‑only endpoint or front‑end static route to resolve station details. |

No contradictory requirements were found; only the above ambiguities need clarification during implementation.

---
*End of Architecture Audit*
