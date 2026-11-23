# CLAUDE.md — Master AI Engineering Constitution

## 1. Project Overview
You are building a **Multi-Tenant School Admissions Lead Follow-Up & Campaign Analytics SaaS Platform**.
- **Domain:** Education / School Admissions only (Phase 1).
- **Core Capabilities:** Live Google Sheets hybrid sync + in-app counselor CRM, silent white-labeling per school, and strict Role-Based Access Control (RBAC).

## 2. Non-Negotiable Tech Stack Rules
- **Backend:** Node.js + Express + TypeScript.
- **Frontend:** Next.js (React) + TypeScript + Tailwind CSS.
- **Database:** PostgreSQL 16 (native on Ubuntu VPS).
- **Scheduling & Caching:** `node-cron` (in-process 60s sync) + `lru-cache` (in-memory 60s TTL cache).
- **Deployment:** Ubuntu VPS + PM2 + Nginx + Certbot Wildcard SSL.
- **STRICTLY FORBIDDEN IN PHASE 1:** Do NOT introduce Redis, BullMQ, Docker, microservices, or Stripe/billing gateways.

## 3. Zero Hardcoded Data & Super-Admin-Only Seeding Policy
1. **Bootstrap Super Admin Only:** `npm run db:seed` MUST ONLY bootstrap the initial `SUPER_ADMIN` user (`tenant_id = NULL`, `role = 'SUPER_ADMIN'`) using `SUPER_ADMIN_NAME`, `SUPER_ADMIN_EMAIL`, and `SUPER_ADMIN_PASSWORD` from environment variables (idempotent via `ON CONFLICT (email) DO NOTHING`).
2. **Strictly Forbidden Hardcoded Tenants/Users:** Never seed, mock, or hardcode any sample school tenants (zero references to `YIS` or demo schools), sample `SCHOOL_ADMIN` accounts, sample `COUNSELOR` accounts, sample campaigns, or sample leads in the codebase or database seeds.
3. **Dynamic Tenant & User Lifecycle:** All school tenants, initial `SCHOOL_ADMIN` users, and `COUNSELOR` accounts MUST be created and managed dynamically through the Super Admin Console (`admin.*`) or School Admin portal.
4. **Clean Empty-State Handling:** When a newly created tenant has 0 campaigns or 0 leads, both backend and frontend MUST gracefully display informative empty states (e.g., prompt to connect Google Sheet or upload CSV) without throwing errors, showing NaN, or falling back to placeholder demo data.
5. **No Hardcoded Configurations:** Never hardcode school names, campaign tab names, or timezone offsets; read all tenant settings dynamically from the `tenants` and `campaigns` database tables.

## 4. Security & Multi-Tenancy Guardrails
1. **Strict Tenant Isolation:** Every database query touching `users`, `campaigns`, `leads`, or `follow_up_notes` MUST filter by `tenant_id` extracted from the verified JWT session or subdomain resolver.
2. **Silent White-Labeling:** Client roles (`SCHOOL_ADMIN`, `COUNSELOR`) must NEVER see platform branding, tenant licensing status (`ONE_TIME`/`ANNUAL`), or branding configuration controls. Only `SUPER_ADMIN` manages white-labeling.
3. **Authentication:** Use `bcrypt` for password hashing and `HttpOnly`, `Secure`, `SameSite=Lax` JWT cookies.

## 5. UI & Bilingual (LTR / RTL) Rules
- Parent/student names and notes contain both **Arabic (RTL)** and **English (LTR)** text.
- Always use Tailwind CSS logical properties (`ms-*`, `me-*`, `ps-*`, `pe-*`, `text-start`, `text-end`) instead of `ml-*`, `mr-*`, `pl-*`, `pr-*`, `text-left`, `text-right`.
- Apply dynamic tenant primary color via CSS custom properties (`--brand-primary`) injected on page load.

## 6. Implementation Discipline
- Follow `docs/08-IMPLEMENTATION-PLAN.md` sequentially. Complete and test each milestone before moving to the next.
