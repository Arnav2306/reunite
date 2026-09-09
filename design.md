# REUNITE — UI/UX Design Specification

## 1. Design Direction
Reunite must look like a real campus utility, not an AI-generated SaaS template.

Qualities:
- trustworthy;
- simple;
- campus-native;
- calm;
- professional;
- mobile-first for students;
- operationally clear for admins.

Avoid:
- excessive gradients;
- glowing AI effects;
- meaningless glassmorphism;
- giant marketing sections;
- fake charts/statistics;
- excessive animation.

## 2. Student Home
```text
Reunite                         Notifications  Profile

Lost something? Found something?
Let's reunite it.

[ I Lost Something ] [ I Found Something ]

Available for Collection
[ item ] [ item ] [ item ]       View all →

Your Active Reports
• Wallet — Searching
• Bottle — Possible Match

Recent Notifications
• Possible match found
```

## 3. Student Navigation
Desktop:
`Home | I Lost Something | I Found Something | Available for Collection | My Reports | My Matches | Notifications | Profile`

Mobile:
- compact navigation;
- prominent Lost/Found actions;
- easy camera and QR access.

## 4. Lost Screens
1. Category
2. Dynamic Questions
3. Location/Time
4. Optional Photo
5. Review
6. Submitted
7. Tracking

Keep the flow short.

## 5. Found Screens
1. Category
2. Photo
3. AI Analysis
4. Correction
5. Station QR
6. Deposit Confirmation

Primary copy:
**Found something? Scan, snap, drop.**

## 6. Available Items
Title: `Available for Collection`

Filters:
- category;
- building;
- general/valuable;
- status.

Card:
- safe image;
- safe title;
- category;
- broad location;
- collection area;
- availability;
- verification requirement.

Never expose sensitive identifiers.

## 7. Item Details
```text
[Image]

Wireless Earbuds
Electronics

Found around:
Block B — 2nd Floor

Collection:
Block B — Admin Office

Status: Available

[ Request Collection ]
```

## 8. Verification
Explain:
“Answer a few questions to confirm ownership. Your answers are private.”

Never reveal correct answers.

## 9. OTP
```text
Collection Ready

Your one-time collection code:

482731

Valid for 10 minutes.

Show this code to authorized collection staff.
```

Never put OTP in URLs/logs.

## 10. Admin Dashboard
Top operational cards:
- Active Lost;
- Found;
- Strong Matches;
- Ready for Pickup;
- Resolved;
- Valuable;
- Disputed.

Below:
- operational queue;
- station status;
- recent activity;
- trends.

## 11. Admin Sidebar
```text
Overview
Reports
  Lost
  Found
Available Items
Post Item
Matches
Verification
Pickups
Custody
Stations
Users
Analytics
Disputes
Disposition
Settings
Audit Logs
```

## 12. Admin Post Item
Sections:
- Item: photos/category/safe title/description;
- Location: received location/collection location;
- Risk: general/valuable;
- Verification: ownership verification/OTP;
- Availability: start/end/expiry;
- Visibility: draft/published/unpublished.

## 13. Status UI
Use text + icon + semantic indicator. Never rely on color alone.

States:
`Searching, Possible Match, Strong Possible Match, Deposit Pending, Deposited, Collected, Secure Hold, Verification Pending, Ready for Pickup, Resolved, Disputed`

## 14. States
Every page must have:
- loading;
- empty;
- error;
- retry;
- success.

AI failure copy:
“We saved your report, but item analysis is temporarily unavailable. We will retry automatically.”

## 15. Accessibility
- semantic HTML;
- keyboard navigation;
- visible focus;
- sufficient contrast;
- form labels;
- screen-reader-friendly statuses;
- no color-only meaning;
- mobile-friendly touch targets.

## 16. Responsive
Student: mobile-first, camera/QR optimized.
Admin: desktop-first, tablet responsive.
Custodian: fast mobile operational screens.

## 17. Components
Reusable:
`Button, Input, Select, RadioGroup, Checkbox, Modal, Drawer, Card, Badge, StatusBadge, DataTable, EmptyState, ErrorState, LoadingSkeleton, Timeline, FileUploader, QRScanner, OTPInput, FilterBar, StatCard, ConfirmDialog`

## 18. Design Tokens
Centralize:
- typography;
- spacing;
- radii;
- shadows;
- semantic colors;
- breakpoints;
- animation durations.

## 19. Motion
Use sparingly for transitions, upload progress, status changes and dialogs. No decorative AI animation.

## 20. Copy
Prefer:
- I Lost Something
- I Found Something
- Request Collection
- Verify Ownership
- Generate OTP
- Ready for Pickup

Avoid technical jargon.

## 21. Trust
Clearly distinguish:
`Reported ≠ Secured`

Show live status timelines based on database state.

## 22. Design Acceptance
Complete only when:
- UI looks intentionally designed;
- no fake content;
- real loading/error/empty states exist;
- mobile flow is usable;
- admin/student surfaces are distinct;
- sensitive information is gated;
- browser verification passes.
