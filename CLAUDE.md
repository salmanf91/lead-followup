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

## 3. Security & Multi-Tenancy Guardrails
1. **Strict Tenant Isolation:** Every database query touching `users`, `campaigns`, `leads`, or `follow_up_notes` MUST filter by `tenant_id` extracted from the verified JWT session or subdomain resolver.
2. **Silent White-Labeling:** Client roles (`SCHOOL_ADMIN`, `COUNSELOR`) must NEVER see platform branding, tenant licensing status (`ONE_TIME`/`ANNUAL`), or branding configuration controls. Only `SUPER_ADMIN` manages white-labeling.
3. **Authentication:** Use `bcrypt` for password hashing and `HttpOnly`, `Secure`, `SameSite=Lax` JWT cookies.

## 4. UI & Bilingual (LTR / RTL) Rules
- Parent/student names and notes contain both **Arabic (RTL)** and **English (LTR)** text.
- Always use Tailwind CSS logical properties (`ms-*`, `me-*`, `ps-*`, `pe-*`, `text-start`, `text-end`) instead of `ml-*`, `mr-*`, `pl-*`, `pr-*`, `text-left`, `text-right`.
- Apply dynamic tenant primary color via CSS custom properties (`--brand-primary`) injected on page load.

## 5. Implementation Discipline
- Follow `docs/08-IMPLEMENTATION-PLAN.md` sequentially. Complete and test each milestone before moving to the next.
- Never hardcode school names, campaign tab names, or timezone offsets; read all tenant settings from the `tenants` table.
