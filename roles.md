# REUNITE — Roles & Permissions

## 1. Roles
1. Student
2. Custodian
3. Admin
4. Super Admin

All permissions are enforced server-side.

## 2. Student
Can:
- authenticate;
- create lost/found reports;
- upload photos;
- correct AI descriptions;
- scan station QR;
- view own reports/matches;
- view available collection listings;
- request collection;
- answer verification;
- receive eligible OTP;
- receive notifications;
- report observations/duplicates.

Cannot:
- publish admin listings;
- alter custody;
- change policy;
- manage stations/custodians;
- access other users' private reports;
- bypass verification;
- confirm staff handover.

## 3. Custodian
Operational role for security/housekeeping/designated staff.

Can:
- view assigned zone/tasks;
- scan stations;
- record collection;
- record transfer/secure hold;
- view necessary item data;
- verify OTP;
- confirm physical handover;
- report missing/damaged custody.

Cannot:
- change ownership truth;
- edit owner answers;
- resolve disputes without admin authority;
- change global policies;
- edit audit history.

## 4. Admin
Can:
- manage authorized cases;
- review lost/found reports and matches;
- create/publish/unpublish available-item listings;
- post institution-held items;
- set safe public details;
- set collection location;
- configure verification/OTP;
- manage scoped stations/custodians;
- review disputes;
- manage operational analytics;
- initiate disposition;
- view audit records.

## 5. Super Admin
Can:
- manage campuses/buildings/floors;
- create/disable stations;
- assign zones;
- manage roles;
- configure global RiskPolicy;
- configure retention/disposition;
- configure notification policy;
- manage integrations;
- manage feature flags;
- manage system-level settings.

## 6. Permission Matrix
| Action | Student | Custodian | Admin | Super Admin |
|---|---:|---:|---:|---:|
| Create lost report | ✓ | ✓ | ✓ | ✓ |
| Create found report | ✓ | ✓ | ✓ | ✓ |
| View own reports | ✓ | ✓ | ✓ | ✓ |
| Collection tasks | — | ✓ | ✓ | ✓ |
| Record custody | — | ✓ | ✓ | ✓ |
| Verify OTP | — | ✓ | ✓ | ✓ |
| Confirm handover | — | ✓ | ✓ | ✓ |
| View listings | ✓ | ✓ | ✓ | ✓ |
| Claim listing | ✓ | — | — | — |
| Create listing | — | limited | ✓ | ✓ |
| Publish listing | — | — | ✓ | ✓ |
| Manage stations | — | — | scoped | ✓ |
| Manage custodians | — | — | scoped | ✓ |
| Manage policy | — | — | scoped | ✓ |
| Resolve disputes | — | — | ✓ | ✓ |
| Disposition | — | — | ✓ | ✓ |
| Analytics | own | scoped | ✓ | ✓ |
| Audit logs | own relevant | relevant | ✓ | ✓ |
| System settings | — | — | limited | ✓ |

## 7. Object-Level Authorization
Example: a custodian may access an item only when assigned to the relevant zone/task or explicitly authorized.

Knowing an item ID never grants access.

## 8. Separation of Duties
For valuable/disputed items, record distinct stages:
`verification → staff review → OTP → handover`.

## 9. Audit
Record actor, action, target, timestamp, state transition, reason/notes and correlation/request ID where useful.
