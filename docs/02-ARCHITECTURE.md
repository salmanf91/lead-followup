# 02 — System & Deployment Architecture

## 1. Lean Phase 1 Infrastructure
- **OS:** Ubuntu 24.04 LTS VPS (2 vCPU, 4 GB RAM, 80 GB NVMe).
- **Reverse Proxy:** Nginx with Certbot wildcard SSL (`*.yourplatform.com`).
- **Process Manager:** PM2 managing the Node.js/Express API and Next.js frontend daemons (`pm2 startup`, `pm2-logrotate`).
- **Database:** Native PostgreSQL 16 with nightly `pg_dump` via Linux `crontab`.

## 2. Subdomain Resolution & Silent White-Label Flow
1. Request arrives at Nginx (`https://<school-slug>.yourplatform.com`).
2. Nginx forwards `Host` header to backend/frontend.
3. Public endpoint `GET /api/tenant/config` extracts slug (`<school-slug>`) from `Host`, queries `tenants WHERE slug = '<school-slug>' AND status = 'ACTIVE'`, and returns `{ dashboardTitle, logoUrl, primaryColor, timezone }`.
4. If slug is `admin`, frontend loads the Super Admin login view. If slug is unknown or `SUSPENDED`, return 404/Suspended notice without revealing platform internals.
5. All tenant branding and campaign configurations are loaded dynamically from the database. Zero tenant names or branding attributes are hardcoded.

## 3. In-Memory Caching (`lru-cache`)
- Configure `LRUCache` with `max: 500` entries and `ttl: 60_000` (60 seconds).
- Cache key format: `dashboard:${tenantId}:${campaignId || 'ALL'}`.
- **Immediate Cache Invalidation:** Whenever a counselor logs a note, changes a lead status, uploads a CSV, or when `node-cron` finishes syncing a tenant's Google Sheet, delete all keys matching `dashboard:${tenantId}:*`.

## 4. Background Sync Scheduler (`node-cron`)
- Schedule `*/1 * * * *` (every 60 seconds).
- Maintain an in-memory `const activeSyncs = new Set<string>()` lock map keyed by `tenant_id`.
- Before syncing a tenant, check `if (activeSyncs.has(tenant.id)) continue;`. Wrap sync logic in `try { ... } finally { activeSyncs.delete(tenant.id); }` to guarantee lock release even on Google API errors.
