import { Request, Response, NextFunction } from 'express';
import { extractTenantSlug } from '../utils/subdomain.js';
import { query } from '../db/index.js';
import { Tenant } from '../types/index.js';

export async function tenantResolver(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const slug = extractTenantSlug(req);
    req.tenantSlug = slug || undefined;

    if (!slug) {
      return next();
    }

    if (slug === 'admin') {
      // Super Admin portal context
      return next();
    }

    // Lookup tenant in database
    const result = await query<Tenant>(
      'SELECT * FROM tenants WHERE slug = $1 LIMIT 1',
      [slug]
    );

    if (result.rows.length === 0) {
      res.status(404).json({ error: 'School not found' });
      return;
    }

    const tenant = result.rows[0];

    if (tenant.status !== 'ACTIVE') {
      // Return 403 Suspended notice without revealing platform internals
      res.status(403).json({ error: 'School portal unavailable' });
      return;
    }

    req.tenant = tenant;
    next();
  } catch (error) {
    console.error('[TenantResolver] Error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

