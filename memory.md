# REUNITE — Project Memory / Non-Negotiable Decisions

This is persistent context for every AI coding agent.

## Product
Reunite = AI-powered campus Lost & Found & Recovery Platform.

Core loop:
`FIND → REPORT → SECURE → MATCH → VERIFY → RETURN`

## Core Truths
- Not a simple CRUD app.
- Physical + digital system.
- Finder effort is the highest priority.
- AI assists; rules/database decide.
- Database is source of truth.
- Reported does not mean secured.
- Every significant custody transition is auditable.
- No normal student-to-student handover.
- Do not require CR/faculty to stay at stations.
- Security/housekeeping/admin can be zone custodians.

## Station
Use a locked one-way station near faculty-cabin/building areas.
Properties:
- permanent QR;
- stable ID;
- capacity;
- operating hours;
- backup;
- operational zone.

Example:
`RNT-B2-F02-S01`

QR:
`/station/RNT-B2-F02-S01`

Never put secrets in QR.

## Finder
`Login → Category → Photo → AI → Station QR → Deposit → Done`

Target: under 60 seconds digital work.

## Owner
`Login → I Lost Something → Category → 3–4 Questions → Location/Time → Optional Photo → Submit → Watch`

## Admin Listing Feature
This is finalized and belongs in Phase 1.

Admin:
`Post Item → Details → Collection Location → Risk → Verification → Publish`

Student:
`Available for Collection → Details → Request → Verify → OTP → Collect → Resolved`

This is not a marketplace. Reuse item/custody/verification/pickup/handover infrastructure.

Public listings must hide sensitive details.

## Risk
Admin-configurable `RiskPolicy`.

General:
bottle, notebook, umbrella, stationery, keys.

Valuable:
phone, laptop, smartwatch, headphones, wallet, ID/sensitive docs.

Finder never makes authoritative risk decision.

## Custody
`REPORTED → DEPOSIT_PENDING → DEPOSITED → COLLECTED → SECURE_HOLD → MATCH_FOUND → VERIFICATION_PENDING → READY_FOR_PICKUP → HANDOVER → RESOLVED`

Side:
`DISPUTED, MISSING, DAMAGED, EXPIRED, DISPOSED, DONATED`

## AI
AI can classify, describe, normalize, embed, retrieve, rank, explain and suggest questions.

AI cannot override:
- permissions;
- risk policy;
- verification;
- custody;
- handover;
- admin decisions.

Never invent attributes. Use null/unknown.

Store raw output, normalized attrs, corrections, model/version and job status.

AI is async/retryable.

## Matching
Initial:
`40 semantic + 20 category + 15 location + 10 time + 10 features + 5 photo`

Threshold:
- 85+ Strong Possible Match;
- 65–84 Possible Match;
- <65 Weak.

Never call score a probability.

## Questions
`Category → Attribute Library → Template Bank → 3–4 Questions → Versioned Storage`

Historical questions/answers are immutable truth.

## OTP
- short-lived;
- one-time;
- hash only;
- verified by authorized staff;
- not ownership proof;
- audited.

## Notifications
In-app + email + optional Web Push.
Strong matches immediate.
Events: match, verification, pickup, reminder, station, expiry, dispute, handover.

## Unclaimed
`Active Recovery → Reminder → Final Notice → Admin Review → Disposition`

## Roles
Student / Custodian / Admin / Super Admin.

## Stack
Frontend: React + TypeScript + Tailwind + TanStack Query + React Hook Form + Zod + PWA.

Backend: Django + DRF.

Data: PostgreSQL + pgvector.

Async: Celery + Redis.

AI: vision + embeddings.

Storage: Cloudinary/object storage.

Deployment: Vercel + Railway/managed equivalents.

## Architecture
Use modular monolith. No microservices unless a real demonstrated need appears.

Domains:
`accounts, campus, stations, items, ai, matching, verification, custody, pickup, notifications, moderation, analytics, audit`

## Security
Never:
- trust frontend-only permissions;
- expose private item data;
- store plaintext OTP;
- store QR secrets;
- log OTP/private answers;
- treat AI as authoritative;
- silently delete duplicates;
- mark report as secured automatically.

Always:
- validate uploads;
- enforce server authorization;
- rate limit sensitive operations;
- audit changes;
- gate sensitive information;
- use least privilege.

## UX
Do not create generic AI SaaS UI.
Student = fast, mobile-first, simple.
Admin = operational, structured, data-rich.
No fake production data or metrics.

## Engineering
Always:
`Inspect → Plan → Implement → Test → Verify → Review → Commit`

Never:
- build everything in one uncontrolled prompt;
- invent requirements;
- change stack without approval;
- skip tests;
- skip browser/API verification;
- mark incomplete work complete.

Update `docs/progress.md` after milestones.
Create ADRs for meaningful architectural decisions.

## Conflict Rule
These files are the project contract:
- `prd.md`
- `architecture.md`
- `roles.md`
- `phases.md`
- `design.md`
- `memory.md`

If a new request conflicts with a finalized decision, surface the conflict before changing core architecture.
