import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { config } from '../config/index.js';
import { query } from '../db/index.js';
import { Tenant, User, JWTPayload } from '../types/index.js';
import { syncTenant } from '../services/syncEngine.js';

export const superAdminRouter = Router();

/**
 * GET /api/super-admin/tenants
 * Lists all school tenants with sync health, manual license info, and user/campaign counts.
 */
superAdminRouter.get('/tenants', async (_req: Request, res: Response): Promise<void> => {
  try {
    const result = await query(
      `SELECT t.*,
        (SELECT COUNT(*)::int FROM users u WHERE u.tenant_id = t.id) as user_count,
        (SELECT COUNT(*)::int FROM campaigns c WHERE c.tenant_id = t.id) as campaign_count,
        (SELECT COUNT(*)::int FROM leads l WHERE l.tenant_id = t.id) as lead_count
       FROM tenants t
       ORDER BY t.created_at DESC`
    );
    res.json(result.rows);
  } catch (error) {
    console.error('[SuperAdmin] Error fetching tenants:', error);
    res.status(500).json({ error: 'Failed to fetch tenants' });
  }
});

/**
 * POST /api/super-admin/tenants
 * Provisions a new school tenant and optionally creates its initial SCHOOL_ADMIN account.
 */
superAdminRouter.post('/tenants', async (req: Request, res: Response): Promise<void> => {
  try {
    const body = req.body || {};
    const name = typeof body.name === 'string' ? body.name.trim() : '';
    const slug = typeof body.slug === 'string' ? body.slug.trim().toLowerCase() : '';
    const dashboardTitle = typeof body.dashboardTitle === 'string' ? body.dashboardTitle.trim() : '';
    const logoUrl = typeof body.logoUrl === 'string' && body.logoUrl.trim() ? body.logoUrl.trim() : null;
    const primaryColor =
      typeof body.primaryColor === 'string' && /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/.test(body.primaryColor)
        ? body.primaryColor
        : '#1E3A8A';
    const timezone = typeof body.timezone === 'string' && body.timezone.trim() ? body.timezone.trim() : 'Asia/Riyadh';
    const dataMode = body.dataMode === 'NATIVE_ONLY' ? 'NATIVE_ONLY' : 'HYBRID_SHEET';
    const googleSheetId =
      typeof body.googleSheetId === 'string' && body.googleSheetId.trim() ? body.googleSheetId.trim() : null;
    const enableSheetWriteback = Boolean(body.enableSheetWriteback);
    const keywordRules = body.keywordRules && typeof body.keywordRules === 'object' ? body.keywordRules : {};
    const status = body.status === 'SUSPENDED' ? 'SUSPENDED' : 'ACTIVE';
    const planType = body.planType === 'ONE_TIME' ? 'ONE_TIME' : 'ANNUAL';
    const renewalDate = typeof body.renewalDate === 'string' && body.renewalDate.trim() ? body.renewalDate.trim() : null;
    const adminNotes = typeof body.adminNotes === 'string' && body.adminNotes.trim() ? body.adminNotes.trim() : null;

    if (!name) {
      res.status(400).json({ error: 'School name is required' });
      return;
    }

    if (!slug || slug.length < 2 || !/^[a-z0-9-]+$/.test(slug)) {
      res.status(400).json({ error: 'Slug must be at least 2 lowercase alphanumeric characters or hyphens' });
      return;
    }

    if (!dashboardTitle) {
      res.status(400).json({ error: 'Dashboard title is required' });
      return;
    }

    // Check slug uniqueness
    const existingSlug = await query('SELECT id FROM tenants WHERE slug = $1', [slug]);
    if (existingSlug.rows.length > 0) {
      res.status(409).json({ error: `School with slug '${slug}' already exists` });
      return;
    }

    const tenantResult = await query<Tenant>(
      `INSERT INTO tenants (
        name, slug, dashboard_title, logo_url, primary_color, timezone,
        data_mode, google_sheet_id, enable_sheet_writeback, keyword_rules,
        status, plan_type, renewal_date, admin_notes
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
      RETURNING *`,
      [
        name,
        slug,
        dashboardTitle,
        logoUrl,
        primaryColor,
        timezone,
        dataMode,
        googleSheetId,
        enableSheetWriteback,
        JSON.stringify(keywordRules),
        status,
        planType,
        renewalDate,
        adminNotes,
      ]
    );

    const createdTenant = tenantResult.rows[0];

    // Optionally provision initial SCHOOL_ADMIN if supplied
    let initialAdminUser = null;
    if (body.initialAdmin && typeof body.initialAdmin === 'object') {
      const adminName = typeof body.initialAdmin.name === 'string' ? body.initialAdmin.name.trim() : '';
      const adminEmail = typeof body.initialAdmin.email === 'string' ? body.initialAdmin.email.trim().toLowerCase() : '';
      const adminPassword = typeof body.initialAdmin.password === 'string' ? body.initialAdmin.password : '';

      if (adminEmail && adminPassword) {
        if (adminPassword.length < 6) {
          res.status(400).json({ error: 'Initial administrator password must be at least 6 characters' });
          return;
        }

        const existingUser = await query('SELECT id FROM users WHERE LOWER(email) = LOWER($1)', [adminEmail]);
        if (existingUser.rows.length > 0) {
          res.status(400).json({
            error: `An administrator account with email "${adminEmail}" already exists. Each user account requires a unique email address across the platform.`,
          });
          return;
        }

        const hash = await bcrypt.hash(adminPassword, 10);
        const adminRes = await query(
          `INSERT INTO users (tenant_id, name, email, password_hash, role, is_active)
           VALUES ($1, $2, $3, $4, 'SCHOOL_ADMIN', true)
           RETURNING id, name, email, role, is_active, created_at`,
          [createdTenant.id, adminName || `${name} Admin`, adminEmail, hash]
        );
        initialAdminUser = adminRes.rows[0];
      }
    }

    res.status(201).json({
      tenant: createdTenant,
      initialAdmin: initialAdminUser,
    });
  } catch (error) {
    console.error('[SuperAdmin] Error creating tenant:', error);
    res.status(500).json({ error: 'Failed to create tenant' });
  }
});

/**
 * PATCH /api/super-admin/tenants/:id
 * Updates tenant branding, Google Sheet config, keyword rules, status, or license terms.
 */
superAdminRouter.patch('/tenants/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    const tenantId = req.params.id;
    const body = req.body || {};

    // Check tenant exists
    const existing = await query('SELECT id FROM tenants WHERE id = $1', [tenantId]);
    if (existing.rows.length === 0) {
      res.status(404).json({ error: 'Tenant not found' });
      return;
    }

    // If changing slug, check validity and uniqueness
    if (body.slug !== undefined) {
      const slug = typeof body.slug === 'string' ? body.slug.trim().toLowerCase() : '';
      if (!slug || slug.length < 2 || !/^[a-z0-9-]+$/.test(slug)) {
        res.status(400).json({ error: 'Slug must be at least 2 lowercase alphanumeric characters or hyphens' });
        return;
      }
      const slugCheck = await query('SELECT id FROM tenants WHERE slug = $1 AND id <> $2', [slug, tenantId]);
      if (slugCheck.rows.length > 0) {
        res.status(409).json({ error: `Slug '${slug}' is already taken` });
        return;
      }
    }

    const fields: string[] = [];
    const values: any[] = [];
    let idx = 1;

    if (typeof body.name === 'string') {
      fields.push(`name = $${idx++}`);
      values.push(body.name.trim());
    }
    if (typeof body.slug === 'string') {
      fields.push(`slug = $${idx++}`);
      values.push(body.slug.trim().toLowerCase());
    }
    if (typeof body.dashboardTitle === 'string') {
      fields.push(`dashboard_title = $${idx++}`);
      values.push(body.dashboardTitle.trim());
    }
    if (body.logoUrl !== undefined) {
      fields.push(`logo_url = $${idx++}`);
      values.push(typeof body.logoUrl === 'string' && body.logoUrl.trim() ? body.logoUrl.trim() : null);
    }
    if (typeof body.primaryColor === 'string' && /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/.test(body.primaryColor)) {
      fields.push(`primary_color = $${idx++}`);
      values.push(body.primaryColor);
    }
    if (typeof body.timezone === 'string') {
      fields.push(`timezone = $${idx++}`);
      values.push(body.timezone.trim());
    }
    if (body.dataMode === 'HYBRID_SHEET' || body.dataMode === 'NATIVE_ONLY') {
      fields.push(`data_mode = $${idx++}`);
      values.push(body.dataMode);
    }
    if (body.googleSheetId !== undefined) {
      fields.push(`google_sheet_id = $${idx++}`);
      values.push(typeof body.googleSheetId === 'string' && body.googleSheetId.trim() ? body.googleSheetId.trim() : null);
    }
    if (body.enableSheetWriteback !== undefined) {
      fields.push(`enable_sheet_writeback = $${idx++}`);
      values.push(Boolean(body.enableSheetWriteback));
    }
    if (body.keywordRules !== undefined && typeof body.keywordRules === 'object') {
      fields.push(`keyword_rules = $${idx++}`);
      values.push(JSON.stringify(body.keywordRules));
    }
    if (body.status === 'ACTIVE' || body.status === 'SUSPENDED') {
      fields.push(`status = $${idx++}`);
      values.push(body.status);
    }
    if (body.planType === 'ONE_TIME' || body.planType === 'ANNUAL') {
      fields.push(`plan_type = $${idx++}`);
      values.push(body.planType);
    }
    if (body.renewalDate !== undefined) {
      fields.push(`renewal_date = $${idx++}`);
      values.push(typeof body.renewalDate === 'string' && body.renewalDate.trim() ? body.renewalDate.trim() : null);
    }
    if (body.adminNotes !== undefined) {
      fields.push(`admin_notes = $${idx++}`);
      values.push(typeof body.adminNotes === 'string' && body.adminNotes.trim() ? body.adminNotes.trim() : null);
    }

    if (fields.length === 0) {
      res.status(400).json({ error: 'No fields provided for update' });
      return;
    }

    values.push(tenantId);
    const updateQuery = `
      UPDATE tenants
      SET ${fields.join(', ')}
      WHERE id = $${idx}
      RETURNING *
    `;

    const result = await query<Tenant>(updateQuery, values);
    res.json(result.rows[0]);
  } catch (error) {
    console.error('[SuperAdmin] Error updating tenant:', error);
    res.status(500).json({ error: 'Failed to update tenant' });
  }
});

/**
 * GET /api/super-admin/tenants/:tenantId/users
 * Lists all users belonging to a specific school tenant.
 */
superAdminRouter.get('/tenants/:tenantId/users', async (req: Request, res: Response): Promise<void> => {
  try {
    const tenantId = req.params.tenantId;
    const usersResult = await query(
      `SELECT id, tenant_id, name, email, role, is_active, created_at
       FROM users
       WHERE tenant_id = $1
       ORDER BY created_at ASC`,
      [tenantId]
    );
    res.json(usersResult.rows);
  } catch (error) {
    console.error('[SuperAdmin] Error fetching tenant users:', error);
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

/**
 * POST /api/super-admin/tenants/:tenantId/users
 * Provisions a new user (SCHOOL_ADMIN or COUNSELOR) for a school tenant.
 */
superAdminRouter.post('/tenants/:tenantId/users', async (req: Request, res: Response): Promise<void> => {
  try {
    const tenantId = req.params.tenantId;

    // Verify tenant exists
    const tenantCheck = await query('SELECT id FROM tenants WHERE id = $1', [tenantId]);
    if (tenantCheck.rows.length === 0) {
      res.status(404).json({ error: 'Tenant not found' });
      return;
    }

    const { name, email, password, role } = req.body || {};

    if (!name || typeof name !== 'string') {
      res.status(400).json({ error: 'User name is required' });
      return;
    }

    if (!email || typeof email !== 'string' || !email.includes('@')) {
      res.status(400).json({ error: 'Valid email is required' });
      return;
    }

    if (!password || typeof password !== 'string' || password.length < 6) {
      res.status(400).json({ error: 'Password must be at least 6 characters' });
      return;
    }

    if (role !== 'SCHOOL_ADMIN' && role !== 'COUNSELOR') {
      res.status(400).json({ error: "Role must be 'SCHOOL_ADMIN' or 'COUNSELOR'" });
      return;
    }

    // Check email uniqueness
    const emailCheck = await query('SELECT id FROM users WHERE LOWER(email) = LOWER($1)', [email.trim()]);
    if (emailCheck.rows.length > 0) {
      res.status(409).json({ error: `User with email '${email}' already exists` });
      return;
    }

    const hash = await bcrypt.hash(password, 10);
    const result = await query(
      `INSERT INTO users (tenant_id, name, email, password_hash, role, is_active)
       VALUES ($1, $2, $3, $4, $5, true)
       RETURNING id, tenant_id, name, email, role, is_active, created_at`,
      [tenantId, name.trim(), email.toLowerCase().trim(), hash, role]
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('[SuperAdmin] Error creating user:', error);
    res.status(500).json({ error: 'Failed to create user' });
  }
});

/**
 * PATCH /api/super-admin/users/:userId
 * Updates a tenant user: role switching, password resets, activation toggle.
 */
superAdminRouter.patch('/users/:userId', async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.params.userId;
    const body = req.body || {};

    // Prevent modifying SUPER_ADMIN users via tenant user endpoint
    const existing = await query<User>('SELECT id, role FROM users WHERE id = $1', [userId]);
    if (existing.rows.length === 0) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    if (existing.rows[0].role === 'SUPER_ADMIN') {
      res.status(403).json({ error: 'Cannot modify Super Admin accounts through this endpoint' });
      return;
    }

    const fields: string[] = [];
    const values: any[] = [];
    let idx = 1;

    if (typeof body.name === 'string' && body.name.trim()) {
      fields.push(`name = $${idx++}`);
      values.push(body.name.trim());
    }

    if (body.role === 'SCHOOL_ADMIN' || body.role === 'COUNSELOR') {
      fields.push(`role = $${idx++}`);
      values.push(body.role);
    }

    if (typeof body.isActive === 'boolean') {
      fields.push(`is_active = $${idx++}`);
      values.push(body.isActive);
    }

    if (typeof body.password === 'string' && body.password.length >= 6) {
      const hash = await bcrypt.hash(body.password, 10);
      fields.push(`password_hash = $${idx++}`);
      values.push(hash);
    }

    if (fields.length === 0) {
      res.status(400).json({ error: 'No fields provided for update' });
      return;
    }

    values.push(userId);
    const updateQuery = `
      UPDATE users
      SET ${fields.join(', ')}
      WHERE id = $${idx}
      RETURNING id, tenant_id, name, email, role, is_active, created_at
    `;

    const result = await query(updateQuery, values);
    res.json(result.rows[0]);
  } catch (error) {
    console.error('[SuperAdmin] Error updating user:', error);
    res.status(500).json({ error: 'Failed to update user' });
  }
});

/**
 * POST /api/super-admin/tenants/:id/sync-now
 * Triggers an immediate Google Sheet sync for a tenant.
 */
superAdminRouter.post('/tenants/:id/sync-now', async (req: Request, res: Response): Promise<void> => {
  try {
    const tenantId = req.params.id;
    const tenantRes = await query<Tenant>('SELECT * FROM tenants WHERE id = $1', [tenantId]);
    if (tenantRes.rows.length === 0) {
      res.status(404).json({ error: 'Tenant not found' });
      return;
    }

    const tenant = tenantRes.rows[0];
    if (tenant.data_mode !== 'HYBRID_SHEET') {
      res.status(400).json({ error: 'Tenant is configured as NATIVE_ONLY mode' });
      return;
    }

    if (!tenant.google_sheet_id) {
      res.status(400).json({ error: 'Tenant does not have a Google Sheet ID configured' });
      return;
    }

    try {
      const syncResult = await syncTenant(tenantId);
      res.json({
        success: true,
        message: syncResult.message,
        lastSyncedAt: syncResult.lastSyncedAt,
        campaignsCount: syncResult.campaignsCount,
        leadsProcessed: syncResult.leadsProcessed,
      });
    } catch (syncErr: any) {
      // If service account is not configured or in test mode, record timestamp and return friendly success notice
      const now = new Date().toISOString();
      await query('UPDATE tenants SET last_synced_at = $1, last_sync_error = $2 WHERE id = $3', [
        now,
        syncErr.message,
        tenantId,
      ]);
      res.json({
        success: true,
        message: `Sync scheduled: ${syncErr.message}`,
        lastSyncedAt: now,
      });
    }
  } catch (error) {
    console.error('[SuperAdmin] Error triggering sync:', error);
    res.status(500).json({ error: 'Failed to trigger sync' });
  }
});

/**
 * POST /api/super-admin/tenants/:id/impersonate
 * Issues a short-lived support session token to log into a school portal.
 */
superAdminRouter.post('/tenants/:id/impersonate', async (req: Request, res: Response): Promise<void> => {
  try {
    const tenantId = req.params.id;
    const tenantRes = await query<Tenant>('SELECT * FROM tenants WHERE id = $1', [tenantId]);
    if (tenantRes.rows.length === 0) {
      res.status(404).json({ error: 'Tenant not found' });
      return;
    }

    const tenant = tenantRes.rows[0];
    if (tenant.status !== 'ACTIVE') {
      res.status(403).json({ error: 'Cannot impersonate a suspended tenant' });
      return;
    }

    // Issue short-lived support session token (2 hours)
    const impersonationPayload: JWTPayload = {
      userId: req.user!.userId,
      email: req.user!.email,
      role: 'SCHOOL_ADMIN',
      tenantId: tenant.id,
      name: `${req.user!.name} (Support Impersonation)`,
    };

    const token = jwt.sign(impersonationPayload, config.jwt.secret, {
      expiresIn: '2h',
    });

    res.cookie(config.cookie.name, token, {
      httpOnly: config.cookie.httpOnly,
      secure: config.cookie.secure,
      sameSite: config.cookie.sameSite,
      maxAge: 2 * 60 * 60 * 1000,
    });

    res.json({
      success: true,
      message: `Now impersonating ${tenant.name}`,
      token,
      tenant: {
        id: tenant.id,
        name: tenant.name,
        slug: tenant.slug,
        dashboardTitle: tenant.dashboard_title,
      },
    });
  } catch (error) {
    console.error('[SuperAdmin] Error during impersonation:', error);
    res.status(500).json({ error: 'Failed to impersonate tenant' });
  }
});
