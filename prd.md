# REUNITE — Product Requirements Document

**Version:** 1.0 | **Status:** Finalized Build Specification

## 1\. Product Vision

Reunite is an AI-powered campus Lost \& Found \& Recovery Platform combining a digital reporting system with physical collection stations, AI-assisted item understanding and matching, private ownership verification, secure OTP handover, notifications, custody tracking, and administration.

Core loop:
`FIND → REPORT → SECURE → MATCH → VERIFY → RETURN`

Experiences:

* Finder: `Snap → Scan → Drop`
* Owner: `Report → Wait → Verify → Collect`
* Institution: `Monitor → Secure → Resolve`

The finder should require less than 60 seconds of digital work wherever practical.

## 2\. Core Goals

* Make found-item reporting almost effortless.
* Use AI for classification, description, embeddings, retrieval, ranking and explanation.
* Never let AI be authoritative for ownership, permissions, custody or policy.
* Track physical custody explicitly.
* Provide floor/building QR stations.
* Match lost and found reports.
* Provide private owner verification.
* Provide secure OTP handover.
* Let admins post items already physically held by the institution.
* Let students discover and request collection of eligible admin-posted items.
* Provide operational dashboards, analytics and audit history.

## 3\. Explicit Non-Goals for V1

* Indoor GPS.
* Autonomous AI ownership decisions.
* Normal student-to-student handover.
* Microservices.
* Marketplace/e-commerce behavior.
* Requiring CRs/faculty to stay at stations.
* Public exposure of sensitive item identifiers.

## 4\. Student Information Architecture

```text
HOME
├── I Lost Something
├── I Found Something
├── Available for Collection
├── My Reports
├── My Matches
├── Notifications
└── Profile
```

Home must contain:

* header: logo, search, notifications, profile;
* primary actions: I Lost Something / I Found Something;
* Available for Collection preview;
* Active Reports preview;
* Matches/notifications preview.

## 5\. Lost Flow

`Login → Category → 3–4 Dynamic Questions → Approx Last Location/Time → Optional Photo → Submit → Watchlist`

Required:

* category;
* 3–4 category-specific MCQs;
* approximate last-seen location;
* approximate date/time.

Optional:

* photo;
* additional context.

Save the report before AI processing. Preserve the exact versioned questions and answers.

## 6\. Found Flow

`Login → Category → Photo → AI Analysis → Scan Station QR → Deposit → Confirmation`

Finder must not be forced to:

* write a long description;
* search existing reports;
* contact the owner;
* decide valuable/general;
* manually create extensive metadata.

AI output must be editable by the finder.

Also support:

* **Found but cannot carry:** photo + location + approximate time; does not imply custody.
* **Saw item alert:** observation only; custody remains unconfirmed.

## 7\. Physical Stations

Each participating floor/building can have a secure Lost \& Found station near a faculty-cabin/building area.

Station:

* locked one-way deposit mechanism;
* permanent QR;
* stable public station ID;
* capacity;
* operating hours;
* backup station;
* operational zone;
* custody assignment.

Example ID: `RNT-B2-F02-S01`

QR route: `/station/RNT-B2-F02-S01`

No secrets in QR.

Existing security/housekeeping/admin staff act as zone custodians and collect items periodically. Students do not wait for CRs or faculty.

## 8\. Station Availability

Priority:
`DISABLED/MAINTENANCE → UNAVAILABLE`
then `OUTSIDE HOURS → UNAVAILABLE`
then `FULL → UNAVAILABLE FOR DEPOSIT`
otherwise `ACTIVE`.

Fallback station recommendation uses:

* open state;
* capacity;
* same floor;
* same building;
* walking distance;
* backup relationship.

## 9\. Admin-Posted Available Items — Finalized Feature

Admins can post items already physically held by the institution.

Admin flow:
`Admin Login → Post Item → Photos/Details → Collection Location → Risk → Verification → Publish`

Student flow:
`Home → Available for Collection → Item Details → Request Collection → Ownership Verification → OTP → Collect → Resolved`

This is NOT a marketplace. It uses the same item, custody, verification, pickup and handover infrastructure.

Admin form:

* photos;
* category;
* safe public title;
* internal description;
* found/received location;
* collection location;
* general/valuable risk;
* availability start/end;
* verification requirement;
* OTP requirement;
* visibility;
* collection instructions;
* expiry.

Never publicly expose IMEI, serial numbers, private marks, sensitive document data, internal notes, or secret verification answers.

## 10\. Available for Collection

Students can:

* search;
* filter by category;
* filter by building;
* filter general/valuable;
* view safe item cards;
* open item details;
* request collection.

Only eligible published listings appear.

## 11\. Ownership Verification

Verification combines:

* match evidence;
* private owner knowledge;
* category-specific answers;
* optional owner-only secrets.

Lost answers are source of truth. Found AI observations are evidence only.

Never reveal hidden owner attributes.

Failed attempts must be counted, rate-limited when necessary, and audited.

## 12\. OTP Handover

1. Generate short-lived OTP.
2. Store only secure hash.
3. Show OTP to eligible student.
4. Authorized custodian/admin verifies it.
5. Confirm physical handover.
6. Record audit/custody event.

OTP is not ownership proof by itself.

## 13\. General vs Valuable

Risk is controlled by admin-configurable `RiskPolicy`.

Typical general:

* bottle, notebook, umbrella, stationery, keys.

Typical valuable:

* smartphone, laptop, smartwatch, headphones, wallet, ID/sensitive documents.

Finder does not make the authoritative risk decision.

Valuable items may use secure holding and stronger verification.

## 14\. Found Item State Machine

`REPORTED → DEPOSIT\\\_PENDING → DEPOSITED → COLLECTED → SECURE\\\_HOLD → MATCH\\\_FOUND → VERIFICATION\\\_PENDING → READY\\\_FOR\\\_PICKUP → HANDOVER → RESOLVED`

Additional states:
`DISPUTED, MISSING, DAMAGED, EXPIRED, DISPOSED, DONATED`

Every significant state change creates a `CustodyEvent`/`AuditLog`.

## 15\. AI Vision

Structured output:

```json
{
  "category": "backpack",
  "primary\\\_color": "black",
  "secondary\\\_colors": \\\["red"],
  "material": "fabric",
  "brand": null,
  "visible\\\_text": \\\[],
  "distinguishing\\\_features": \\\["red zipper pull"],
  "condition": "used",
  "confidence": 0.87
}
```

Rules:

* never invent attributes;
* use null/unknown;
* preserve raw AI output;
* allow correction;
* store model/version;
* process asynchronously;
* retry failures;
* provide manual fallback.

## 16\. Matching

Every active lost report becomes a watch.

New found item:
`Candidate Retrieval → Hybrid Scoring → Threshold → Explanation → Notification`

Initial weights:

* semantic 40%;
* category 20%;
* location 15%;
* time 10%;
* distinguishing features 10%;
* photo 5%.

Initial thresholds:

* 85+ Strong Possible Match;
* 65–84 Possible Match;
* below 65 Weak Match.

Scores are not probabilities. Show reasons and model/version. Calibrate with real campus data later.

## 17\. Duplicate Detection

Lost duplicates:

* same user;
* category;
* answers;
* location/time;
* optional photo similarity.

Found duplicates:

* image similarity;
* attributes;
* category;
* location/time.

Flag candidates; do not silently delete.

## 18\. Notifications

Channels:

* in-app;
* email;
* optional Web Push.

Events:

* strong match;
* verification available;
* pickup ready;
* reminder;
* station status;
* expiry;
* dispute;
* handover.

Strong match = immediate. Medium = grouped where appropriate. Weak = no automatic alert.

## 19\. Unclaimed

`Active Recovery → Reminder → Final Notice → Admin Review → Disposition`

Disposition:

* returned;
* transferred;
* donated;
* securely retained;
* destroyed;
* other.

Sensitive documents require special retention handling.

## 20\. Admin Dashboard

Show real database metrics:

* verified users;
* active lost/found;
* strong matches;
* ready pickup;
* resolved/unresolved;
* valuable;
* disputed;
* station utilization;
* average match/return time;
* verification success/failure;
* false-match rate;
* building/floor/category trends.

Operational queues:

* pending deposits;
* collection tasks;
* secure-hold items;
* verification;
* pickup;
* disputes;
* expiry;
* disposition.

No fake production metrics.

## 21\. API Surface

```text
POST /api/auth/login
POST /api/auth/verify
POST /api/lost-items
GET /api/lost-items
GET /api/lost-items/:id
PATCH /api/lost-items/:id
POST /api/found-items
GET /api/found-items/:id
POST /api/found-items/:id/deposit
GET /api/available-items
GET /api/available-items/:id
POST /api/available-items/:id/claim
GET /api/matches
GET /api/matches/:id
POST /api/matches/:id/verify
GET /api/stations
GET /api/stations/:id
POST /api/pickups
POST /api/pickups/:id/otp
POST /api/pickups/:id/confirm
GET /api/notifications
POST /api/notifications/:id/read
GET /api/custodian/tasks
POST /api/custodian/events
GET /api/admin/dashboard
GET /api/admin/analytics
POST /api/admin/items
PATCH /api/admin/items/:id
POST /api/admin/items/:id/publish
POST /api/admin/items/:id/unpublish
```

## 22\. Core Entities

`User, Campus, Building, Floor, CollectionPoint, Zone, Custodian, LostItem, FoundItem, ItemImage, ItemEmbedding, QuestionTemplate, VerificationQuestion, VerificationAttempt, Match, RiskPolicy, PickupSlot, PickupRequest, Handover, CustodyEvent, Notification, NotificationPreference, DuplicateCandidate, Dispute, FraudFlag, Disposition, AuditLog, Listing`

## 23\. Security

* college email/SSO;
* server-side RBAC/object authorization;
* secure upload validation;
* file size/MIME/content validation;
* private storage where appropriate;
* rate limiting;
* CSRF protection as applicable;
* secure cookies/tokens;
* hashed OTP;
* hashed sensitive answers;
* least privilege;
* audit logs;
* sensitive information gating;
* no QR secrets.

## 24\. Success Criteria

A complete pilot-ready system must support:

* lost reporting;
* found reporting/deposit;
* QR stations;
* station availability;
* AI failure recovery;
* explainable matching;
* admin item posting;
* student available-items browsing;
* claim/verification;
* OTP handover;
* custody timeline;
* server-side permissions;
* audit history;
* real database-backed metrics.

