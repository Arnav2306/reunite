# REUNITE — Development Phases

## Rule
Never build the whole system in one uncontrolled operation.

For every phase:
`Inspect → Plan → Implement → Test → Verify → Review → Commit → Update progress`

## Phase 0 — Product & Architecture Freeze
Deliver:
- PRD;
- architecture;
- roles;
- design;
- memory;
- ADRs;
- repository plan.

## Phase 1 — Foundation + Core Recovery + Admin Collection Listings
Build:
- Django + DRF;
- PostgreSQL;
- authentication;
- roles;
- campus/building/floor;
- LostItem;
- FoundItem;
- Listing;
- CollectionPoint;
- CustodyEvent;
- PickupRequest;
- Handover;
- Notification;
- AuditLog;
- migrations/API validation;
- React app shell;
- Student Home;
- I Lost Something;
- I Found Something;
- My Reports;
- Available for Collection;
- Item Details;
- Admin Dashboard;
- Admin Post Item;
- listing management;
- basic verification;
- OTP UI.

Acceptance:
- lost report works;
- found report works;
- admin can post/publish;
- student can see listing;
- student can request collection;
- verification works;
- OTP works;
- handover resolves case;
- dashboard uses real data only.

## Phase 2 — Stations + QR + Custody
Build:
- permanent station IDs;
- QR routes;
- hours/capacity/status;
- backup stations;
- deposit;
- collection tasks;
- custody timeline;
- recommendation.

Acceptance:
- QR resolves correct station;
- closed/full station cannot accept deposit;
- fallback station works;
- reported ≠ deposited ≠ collected.

## Phase 3 — AI Vision
Build:
- secure image upload;
- async vision;
- structured output;
- correction;
- model/version;
- retry/fallback.

## Phase 4 — Embeddings + Hybrid Matching
Build:
- embeddings;
- pgvector;
- candidate retrieval;
- scoring;
- thresholds;
- explanations;
- watchlists;
- strong-match alerts.

## Phase 5 — Dynamic Ownership Verification
Build:
- attribute library;
- template bank;
- dynamic 3–4 questions;
- versioned questions;
- answer hashing;
- attempt limits;
- escalation.

## Phase 6 — Valuable Items + Secure Handover
Build:
- RiskPolicy;
- secure hold;
- stronger verification;
- OTP;
- sensitive-data gating.

## Phase 7 — Notifications + Automation
Build:
- in-app;
- email;
- optional Web Push;
- strong-match alerts;
- reminders;
- expiry;
- station alerts.

## Phase 8 — Duplicate + Moderation
Build:
- duplicate candidates;
- disputes;
- fraud flags;
- admin review;
- safe merge/archive.

## Phase 9 — Admin Operations + Analytics
Build:
- full dashboard;
- operational queues;
- station utilization;
- recovery metrics;
- building/floor/category trends;
- return/match time;
- verification metrics.

## Phase 10 — Unclaimed + Disposition
Build:
- reminders;
- final notices;
- expiry;
- admin review;
- disposition;
- sensitive document retention.

## Phase 11 — Security + Reliability
Build:
- rate limits;
- upload security;
- authorization tests;
- audit tests;
- retries/idempotency;
- backups;
- observability.

## Phase 12 — Testing + UX Polish
Test:
- unit;
- integration;
- API;
- frontend;
- E2E;
- permission;
- failure;
- responsive;
- accessibility basics.

No generic AI SaaS UI. No fake metrics.

## Phase 13 — Deployment
- production environment;
- env vars;
- migrations;
- managed PostgreSQL/Redis;
- object storage;
- email;
- hosting;
- monitoring;
- backups.

## Phase 14 — Campus Pilot
Recommended:
- one building;
- 2–4 stations;
- 50–200 students;
- 4–6 weeks.

Measure:
- reports;
- deposit rate;
- match rate;
- return rate;
- median return time;
- verification failures;
- duplicates;
- station utilization;
- satisfaction.

## Phase 15 — Campus Expansion
Only after pilot evidence:
- more buildings;
- more stations;
- more custodians;
- policy tuning;
- model calibration;
- automation.
