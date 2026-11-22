import { Request } from 'express';

/**
 * Extracts subdomain / tenant slug from the request.
 * Priority:
 * 1. X-Tenant-Slug header (useful for API clients, testing, development)
 * 2. Host header (e.g., "yis.domain.com" -> "yis", "admin.domain.com" -> "admin")
 * 3. Query parameter ?subdomain= or ?tenant= (development convenience)
 */
export function extractTenantSlug(req: Request): string | null {
  // 1. Explicit header override
  const headerSlug = req.headers['x-tenant-slug'];
  if (typeof headerSlug === 'string' && headerSlug.trim()) {
    return headerSlug.trim().toLowerCase();
  }

  // 2. Query param (dev/test fallback)
  if (req.query.subdomain && typeof req.query.subdomain === 'string') {
    return req.query.subdomain.trim().toLowerCase();
  }
  if (req.query.tenant && typeof req.query.tenant === 'string') {
    return req.query.tenant.trim().toLowerCase();
  }

  // 3. Host header
  const host = req.headers.host;
  if (!host) return null;

  // Strip port if present
  const hostname = host.split(':')[0].toLowerCase();

  // If host is an IP address or bare 'localhost', no subdomain is present
  if (
    hostname === 'localhost' ||
    hostname === '127.0.0.1' ||
    /^(\d{1,3}\.){3}\d{1,3}$/.test(hostname)
  ) {
    return null;
  }

  const parts = hostname.split('.');

  // e.g. "admin.localhost" -> parts: ["admin", "localhost"]
  if (parts.length === 2 && parts[1] === 'localhost') {
    return parts[0];
  }

  // e.g. "yis.admissions.platform.com" or "yis.platform.com"
  if (parts.length >= 3) {
    // If first part is "www", take second if there are enough parts
    if (parts[0] === 'www' && parts.length >= 4) {
      return parts[1];
    }
    return parts[0];
  }

  return null;
}

