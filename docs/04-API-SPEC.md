# 04 — REST API Specification & RBAC Matrix

## 1. Public & Auth Endpoints
- `GET /api/tenant/config` — Resolves white-label theme (`logoUrl`, `primaryColor`, `dashboardTitle`, `timezone`) from `Host` subdomain.
- `POST /api/auth/login` — Authenticates email/password against resolved `tenant_id` (or `SUPER_ADMIN` on `admin.*`) and sets HttpOnly JWT cookie.
- `POST /api/auth/logout` — Clears JWT cookie.
- `GET /api/auth/me` — Returns current user profile, role, and tenant config.

## 2. Super Admin Endpoints (`role === 'SUPER_ADMIN'` only)
- `GET /api/super-admin/tenants` — List all schools with sync health (`last_synced_at`, `last_sync_error`) and manual license info.
- `POST /api/super-admin/tenants` — Create a new school tenant + initial `SCHOOL_ADMIN` user.
- `PATCH /api/super-admin/tenants/:id` — Update white-label settings, Google Sheet ID, keyword rules, or manual billing/renewal notes.
- `POST /api/super-admin/tenants/:id/sync-now` — Trigger immediate manual Google Sheet sync.
- `POST /api/super-admin/tenants/:id/impersonate` — Issue short-lived support session token for that school.

## 3. Client Dashboard & Lead Endpoints (`SCHOOL_ADMIN` & `COUNSELOR`)
All queries automatically inject `WHERE tenant_id = req.user.tenantId`.
- `GET /api/dashboard/overview?campaignId=<uuid|ALL>` — Returns cached KPI cards, pending sub-breakdown, feedback split bar, follow-up stage funnel, campaign matrix, daily intake series, and positive leads to close.
- `GET /api/leads?campaignId=&status=&grade=&coldOnly=true&search=&sortBy=&order=&page=&limit=` — Paginated, searchable, sortable Master Lead List.
- `GET /api/leads/:id` — Lead details + full chronological `follow_up_notes` list.
- `POST /api/leads/:id/notes` — Add a new follow-up note (`stage`, `noteText`, optional `feedbackStatus`, optional `pendingSubstatus`). Purges `lru-cache` and triggers optional Google Sheet write-back.
- `PATCH /api/leads/:id/status` — Update `feedback_status` and `pending_substatus` directly.

## 4. School Admin Only Endpoints (`role === 'SCHOOL_ADMIN'`)
- `GET /api/school-admin/users` — List counselors for the current school.
- `POST /api/school-admin/users` — Create a new `COUNSELOR` account.
- `PATCH /api/school-admin/users/:id` — Activate/deactivate counselor.
- `POST /api/school-admin/leads/import-csv` — Bulk import leads from CSV/Excel with phone normalization and duplicate detection.
- `GET /api/school-admin/leads/export-csv` — Export filtered leads to CSV.
