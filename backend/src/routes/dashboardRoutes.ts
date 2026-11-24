import { Router, Request, Response } from 'express';
import { getDashboardOverview } from '../services/kpiService.js';
import { syncTenant } from '../services/syncEngine.js';
import { query } from '../db/index.js';

export const dashboardRouter = Router();

/**
 * GET /api/dashboard/overview?campaignId=...
 * Returns aggregated KPI cards, feedback split bar, funnel, campaign matrix, and priority leads.
 */
dashboardRouter.get('/overview', async (req: Request, res: Response): Promise<void> => {
  try {
    const user = req.user!;
    // If super admin is inspecting without impersonation, allow ?tenantId=... parameter
    let targetTenantId = user.tenantId;
    if (user.role === 'SUPER_ADMIN') {
      if (req.query.tenantId && typeof req.query.tenantId === 'string') {
        targetTenantId = req.query.tenantId;
      }
    }

    if (!targetTenantId) {
      res.status(400).json({ error: 'Tenant context is missing or not resolved' });
      return;
    }

    const campaignId = typeof req.query.campaignId === 'string' ? req.query.campaignId : undefined;
    const bypassCache = req.query.fresh === 'true';

    const overview = await getDashboardOverview(targetTenantId, campaignId, bypassCache);
    res.json(overview);
  } catch (err: any) {
    console.error('[DashboardRoutes] Error computing overview:', err);
    res.status(500).json({ error: err.message || 'Failed to compute dashboard metrics' });
  }
});

/**
 * GET /api/dashboard/campaigns
 * Returns all active campaigns for the current tenant.
 */
dashboardRouter.get('/campaigns', async (req: Request, res: Response): Promise<void> => {
  try {
    const user = req.user!;
    let targetTenantId = user.tenantId;
    if (user.role === 'SUPER_ADMIN' && typeof req.query.tenantId === 'string') {
      targetTenantId = req.query.tenantId;
    }

    if (!targetTenantId) {
      res.status(400).json({ error: 'Tenant context is required' });
      return;
    }

    const campaignsRes = await query(
      `SELECT id, tab_name, display_order, is_active
       FROM campaigns
       WHERE tenant_id = $1 AND is_active = true
       ORDER BY display_order ASC, tab_name ASC`,
      [targetTenantId]
    );

    res.json(campaignsRes.rows);
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to fetch campaigns' });
  }
});

/**
 * POST /api/dashboard/sync-now
 * Allows a School Admin (or Super Admin) to trigger immediate Google Sheet sync.
 */
dashboardRouter.post('/sync-now', async (req: Request, res: Response): Promise<void> => {
  try {
    const user = req.user!;
    let targetTenantId = user.tenantId;
    if (user.role === 'SUPER_ADMIN' && typeof req.body.tenantId === 'string') {
      targetTenantId = req.body.tenantId;
    }

    if (!targetTenantId) {
      res.status(400).json({ error: 'Tenant context is required' });
      return;
    }

    const result = await syncTenant(targetTenantId);
    res.json(result);
  } catch (err: any) {
    res.status(400).json({ error: err.message || 'Sync failed' });
  }
});
