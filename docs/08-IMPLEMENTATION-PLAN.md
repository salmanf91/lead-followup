# 08 — Phased Implementation Plan

Execute these 5 milestones in strict order:

- **Milestone 1: Project Scaffolding, Database & Auth**
  - Initialize Express TypeScript backend and Next.js TypeScript frontend.
  - Apply PostgreSQL schema (`docs/03-DATABASE-SCHEMA.md`) and seed initial `SUPER_ADMIN` + sample school (`YIS`).
  - Implement subdomain resolver (`GET /api/tenant/config`), HttpOnly JWT auth, and RBAC middleware.

- **Milestone 2: Super Admin Console**
  - Build `admin.*` UI for creating/editing schools, silent white-labeling (logo upload, primary color picker, title, timezone), Google Sheet ID configuration, manual license tracking, and one-click school impersonation.

- **Milestone 3: Hybrid Sync Engine & KPI Aggregation**
  - Implement Google Sheets API v4 service account reader, regex note/date/agent parser (`docs/05-SYNC-ENGINE-SPEC.md`), and `node-cron` 60s scheduler with in-memory lock.
  - Build KPI calculation service (`docs/06-KPI-FORMULAS.md`) wrapped with `lru-cache` (60s TTL).

- **Milestone 4: Client Frontend Dashboard**
  - Build the complete School Portal (`docs/07-FRONTEND-UI-SPEC.md`) with dynamic CSS theme variables, 60s live countdown timer, campaign tabs, KPI cards, clickable feedback split bar, follow-up funnel, campaign matrix, daily intake chart, and WhatsApp priority cards.

- **Milestone 5: Lead Drawer, Write-Back, CSV & QA**
  - Build the searchable Master Lead List, slide-over Follow-Up Drawer (`POST /api/leads/:id/notes` + cache invalidation + optional Google Sheet write-back), and School Admin CSV import/export.
  - Verify Arabic RTL + English LTR rendering across desktop and mobile viewports.
