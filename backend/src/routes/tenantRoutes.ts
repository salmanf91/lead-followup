import { Router, Request, Response } from 'express';
import { extractTenantSlug } from '../utils/subdomain.js';
import { query } from '../db/index.js';
import { Tenant, PublicTenantConfig } from '../types/index.js';

export const tenantRouter = Router();

/**
 * GET /api/tenant/config
 * Public endpoint to resolve tenant configuration from subdomain.
 * Implements silent white-labeling: only public UI branding is returned.
 */
tenantRouter.get('/config', async (req: Request, res: Response): Promise<void> => {
  try {
    const slug = extractTenantSlug(req);

    if (!slug) {
      res.status(400).json({ error: 'Subdomain or school identifier required' });
      return;
    }

    if (slug === 'admin') {
      const adminConfig: PublicTenantConfig = {
        isAdmin: true,
        dashboardTitle: 'Super Admin Portal',
      };
      res.json(adminConfig);
      return;
    }

    // Use tenant resolved by middleware if available, else query DB
    let tenant = req.tenant;
    if (!tenant) {
      const result = await query<Tenant>(
        `SELECT id, name, slug, logo_url, primary_color, dashboard_title, timezone, status
         FROM tenants
         WHERE slug = $1 LIMIT 1`,
        [slug]
      );

      if (result.rows.length === 0) {
        res.status(404).json({ error: 'School not found' });
        return;
      }

      tenant = result.rows[0];

      if (tenant.status !== 'ACTIVE') {
        res.status(403).json({ error: 'School portal unavailable' });
        return;
      }
    }

    // Return silent white-label public properties only
    const publicConfig: PublicTenantConfig = {
      id: tenant.id,
      slug: tenant.slug,
      dashboardTitle: tenant.dashboard_title,
      logoUrl: tenant.logo_url,
      primaryColor: tenant.primary_color || '#1E3A8A',
      timezone: tenant.timezone || 'Asia/Riyadh',
    };

    res.json(publicConfig);
  } catch (error) {
    console.error('[TenantRoute] Error resolving config:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});
