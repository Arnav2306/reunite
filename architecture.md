# REUNITE — System Architecture

## 1. Architecture Principles
- Modular monolith first.
- PostgreSQL is the system of record.
- AI is asynchronous and advisory.
- Physical custody is explicit.
- Authorization is server-side.
- Consequential transitions are auditable.
- No premature microservices.
- UI never invents state.

## 2. High-Level Architecture
```text
React + TypeScript + Tailwind + PWA
              │ HTTPS/JSON
              ▼
Django + DRF API
              │
      ┌───────┼────────┐
      ▼       ▼        ▼
PostgreSQL  Celery    Object Storage
+ pgvector   + Redis
              │
              ▼
       Vision/Embedding AI
              │
              ▼
      Matching + Notifications
```

## 3. Frontend
Stack:
- React
- TypeScript
- Vite
- Tailwind CSS
- TanStack Query
- React Hook Form
- Zod
- PWA
- QR scanner

```text
frontend/src/
├── components/
├── pages/
├── features/
│   ├── auth/
│   ├── lost/
│   ├── found/
│   ├── available-items/
│   ├── matches/
│   ├── stations/
│   ├── pickups/
│   ├── notifications/
│   └── admin/
├── hooks/
├── services/
├── schemas/
├── types/
├── utils/
└── routes/
```

## 4. Backend
Stack:
- Python
- Django
- Django REST Framework
- Celery
- Redis
- PostgreSQL
- pgvector

```text
backend/
├── config/
├── apps/
│   ├── accounts/
│   ├── campus/
│   ├── stations/
│   ├── items/
│   ├── ai/
│   ├── matching/
│   ├── verification/
│   ├── custody/
│   ├── pickup/
│   ├── notifications/
│   ├── moderation/
│   ├── analytics/
│   └── audit/
├── manage.py
└── requirements.txt
```

## 5. Domain Responsibilities
- accounts: authentication/users/roles.
- campus: campus/building/floor/location.
- stations: QR, capacity, hours, status, backup.
- items: lost/found/listings/images/risk.
- ai: vision/normalization/embeddings/jobs.
- matching: retrieval/scoring/watchlists.
- verification: dynamic questions/answers/attempts.
- custody: physical state/events.
- pickup: claims/OTP/handover.
- notifications: event/delivery/preferences.
- moderation: duplicates/disputes/fraud.
- analytics: metrics.
- audit: audit history.

## 6. Database
PostgreSQL is authoritative. pgvector stores embeddings.

Index important fields:
- status;
- category;
- building/floor;
- risk tier;
- station;
- timestamps;
- listing state;
- match score;
- notification unread;
- vector similarity.

## 7. Key Models
### User
`id, public_id, college_email, name, verified, role, status, created_at, last_login`

### CollectionPoint
`id, public_id, station_code, building_id, floor_id, station_type, status, capacity, current_count, opening_hours, backup_station_id, zone_id`

### LostItem
`id, public_id, user_id, category, description, original_answers, normalized_attributes, embedding, building_id, floor_id, last_seen_area, last_seen_at, optional_image, status, risk_tier, expires_at`

### FoundItem
`id, public_id, finder_id, source, category, ai_description, user_corrections, normalized_attributes, embedding, building_id, floor_id, found_area, found_at, collection_point_id, item_tag, bag_tag, risk_tier, status, expires_at`

### Listing
`id, item_id, published_by, title, safe_description, collection_location, visibility, listing_status, available_from, available_until, verification_required, otp_required, created_at, published_at, unpublished_at`

### Match
`id, lost_item_id, found_item_id, semantic_score, category_score, location_score, time_score, feature_score, image_score, final_score, model_version, explanation, status, created_at, reviewed_at`

### Handover
`id, pickup_request_id, otp_hash, otp_expires_at, otp_used, custodian_id, confirmed_at, status`

### CustodyEvent
`id, found_item_id, event_type, actor_id, station_id, notes, timestamp, metadata`

## 8. State Machine
```text
REPORTED
  ↓
DEPOSIT_PENDING
  ↓
DEPOSITED
  ↓
COLLECTED
  ↓
SECURE_HOLD
  ↓
MATCH_FOUND
  ↓
VERIFICATION_PENDING
  ↓
READY_FOR_PICKUP
  ↓
HANDOVER
  ↓
RESOLVED
```
Side states: `DISPUTED, MISSING, DAMAGED, EXPIRED, DISPOSED, DONATED`.

## 9. Admin Listing Architecture
Do not create a separate marketplace system.

```text
Physical Item
    ↓
Item Record
    ↓
Listing
    ↓
Publish
    ↓
Student Visibility
    ↓
Claim
    ↓
Verification
    ↓
Pickup
    ↓
OTP
    ↓
Handover
    ↓
Resolved
```

## 10. AI Pipeline
```text
Report saved
→ queue job
→ vision
→ normalization
→ embedding
→ candidate retrieval
→ hybrid scoring
→ threshold
→ explanation
→ notification
```
Jobs are idempotent and retryable.

## 11. Matching
Candidate narrowing:
- active state;
- category;
- campus;
- broad location;
- time;
- risk compatibility.

Initial scoring:
`40% semantic + 20% category + 15% location + 10% time + 10% features + 5% photo`

Store scoring/model version with every match.

## 12. Dynamic Questions
`Category → Attribute Library → Template Bank → 3–4 Questions → Versioned Storage`

Store exact questions/options/normalized answers/hash/version.

## 13. Async Jobs
- analyze_found_item
- generate_embedding
- match_new_found_item
- refresh_watchlist
- send_notification
- send_email
- send_push
- expire_listing
- expire_item
- duplicate_detection
- analytics_aggregation

## 14. Security Architecture
- authenticated API;
- server/object authorization;
- rate limiting;
- secure uploads;
- private sensitive storage;
- hashed OTP/answers;
- audit events;
- no public sensitive fields;
- no secrets in QR;
- no secret logging.

## 15. Deployment
Recommended:
- frontend: Vercel;
- backend: Railway/managed container;
- database: managed PostgreSQL;
- Redis: managed Redis;
- storage: Cloudinary/object storage;
- transactional email provider.

## 16. Repository
```text
reunite/
├── frontend/
├── backend/
├── docs/
│   ├── architecture/
│   ├── api/
│   ├── decisions/
│   ├── testing/
│   └── deployment/
├── infra/
├── scripts/
├── .env.example
├── README.md
└── docker-compose.yml
```
