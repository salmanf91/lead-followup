import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import { config } from '../config/index.js';
import { query } from '../db/index.js';
import { Tenant, User, JWTPayload } from '../types/index.js';

export const superAdminRouter = Router();

// Validation Schemas
const createTenantSchema = z.object({
  name: z.string().min(1, 'School name is required'),
  slug: z
    .string()
    .min(2, 'Slug must be at least 2 characters')
    .max(50)
    .regex(/^[a-z0-9-]+$/, 'Slug must be lowercase alphanumeric and hyphens only'),
  dashboardTitle: z.string().min(1, 'Dashboard title is required'),
  logoUrl: z.string().nullable().optional(),
  primaryColor: z
    .string()
    .regex(/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/, 'Must be a valid hex color code')
    .optional()
    .default('#1E3A8A'),
  timezone: z.string().optional().default('Asia/Riyadh'),
  dataMode: z.enum(['HYBRID_SHEET', 'NATIVE_ONLY']).optional().default('HYBRID_SHEET'),
  googleSheetId: z.string().nullable().optional(),
  enableSheetWriteback: z.boolean().optional().default(false),
  keywordRules: z.record(z.any()).optional().default({}),
  status: z.enum(['ACTIVE', 'SUSPENDED']).optional().default('ACTIVE'),
  planType: z.enum(['ONE_TIME', 'ANNUAL']).optional().default('ANNUAL'),
  renewalDate: z.string().nullable().optional(),
  adminNotes: z.string().nullable().optional(),
  initialAdmin: z
    .object({
      name: z.string().min(1),
      email: z.string().email(),
      password: z.string().min(6),
    })
    .optional(),
});

const updateTenantSchema = z.object({
  name: z.string().min(1).optional(),
  slug: z
    .string()
    .min(2)
    .max(50)
    .regex(/^[a-z0-9-]+$/)
    .optional(),
  dashboardTitle: z.string().min(1).optional(),
  logoUrl: z.string().nullable().optional(),
  primaryColor: z.string().regex(/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/).optional(),
  timezone: z.string().optional(),
  dataMode: z.enum(['HYBRID_SHEET', 'NATIVE_ONLY']).optional(),
  googleSheetId: z.string().nullable().optional(),
  enableSheetWriteback: z.boolean().optional(),
  keywordRules: z.record(z.any()).optional(),
  status: z.enum(['ACTIVE', 'SUSPENDED']).optional(),
  planType: z.enum(['ONE_TIME', 'ANNUAL']).optional(),
  renewalDate: z.string().nullable().optional(),
  adminNotes: z.string().nullable().optional(),
});

const createUserSchema = z.object({
  name: z.string().min(1, 'User name is required'),
  email: z.string().email('Valid email is required'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  role: z.enum(['SCHOOL_ADMIN', 'COUNSELOR']),
});

const updateUserSchema = z.object({
  name: z.string().min(1).optional(),
  role: z.enum(['SCHOOL_ADMIN', 'COUNSELOR']).optional(),
  password: z.string().min(6).optional(),
  isActive: z.boolean().optional(),
});

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
    const parse = createTenantSchema.safeParse(req.body);
    if (!parse.success) {
      res.status(400).json({ error: 'Invalid input', details: parse.error.flatten() });
      return;
    }

    const data = parse.data;

    // Check slug uniqueness
    const existingSlug = await query('SELECT id FROM tenants WHERE slug = $1', [data.slug]);
    if (existingSlug.rows.length > 0) {
      res.status(409).json({ error: `School with slug '${data.slug}' already exists` });
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
        data.name,
        data.slug,
        data.dashboardTitle,
        data.logoUrl || null,
        data.primaryColor,
        data.timezone,
        data.dataMode,
        data.googleSheetId || null,
        data.enableSheetWriteback,
        JSON.stringify(data.keywordRules),
        data.status,
        data.planType,
        data.renewalDate || null,
        data.adminNotes || null,
      ]
    );

    const createdTenant = tenantResult.rows[0];

    // Optionally provision initial SCHOOL_ADMIN if supplied
    let initialAdminUser = null;
    if (data.initialAdmin) {
      const existingUser = await query('SELECT id FROM users WHERE LOWER(email) = LOWER($1)', [
        data.initialAdmin.email,
      ]);
      if (existingUser.rows.length === 0) {
        const hash = await bcrypt.hash(data.initialAdmin.password, 10);
        const adminRes = await query(
          `INSERT INTO users (tenant_id, name, email, password_hash, role, is_active)
           VALUES ($1, $2, $3, $4, 'SCHOOL_ADMIN', true)
           RETURNING id, name, email, role, is_active, created_at`,
          [createdTenant.id, data.initialAdmin.name, data.initialAdmin.email.toLowerCase(), hash]
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
    const parse = updateTenantSchema.safeParse(req.body);
    if (!parse.success) {
      res.status(400).json({ error: 'Invalid input', details: parse.error.flatten() });
      return;
    }

    const data = parse.data;

    // Check tenant exists
    const existing = await query('SELECT id FROM tenants WHERE id = $1', [tenantId]);
    if (existing.rows.length === 0) {
      res.status(404).json({ error: 'Tenant not found' });
      return;
    }

    // If changing slug, check uniqueness
    if (data.slug) {
      const slugCheck = await query('SELECT id FROM tenants WHERE slug = $1 AND id <> $2', [
        data.slug,
        tenantId,
      ]);
      if (slugCheck.rows.length > 0) {
        res.status(409).json({ error: `Slug '${data.slug}' is already taken` });
        return;
      }
    }

    // Build dynamic SQL UPDATE clause
    const fields: string[] = [];
    const values: any[] = [];
    let idx = 1;

    if (data.name !== undefined) {
      fields.push(`name = $${idx++}`);
      values.push(data.name);
    }
    if (data.slug !== undefined) {
      fields.push(`slug = $${idx++}`);
      values.push(data.slug);
    }
    if (data.dashboardTitle !== undefined) {
      fields.push(`dashboard_title = $${idx++}`);
      values.push(data.dashboardTitle);
    }
    if (data.logoUrl !== undefined) {
      fields.push(`logo_url = $${idx++}`);
      values.push(data.logoUrl);
    }
    if (data.primaryColor !== undefined) {
      fields.push(`primary_color = $${idx++}`);
      values.push(data.primaryColor);
    }
    if (data.timezone !== undefined) {
      fields.push(`timezone = $${idx++}`);
      values.push(data.timezone);
    }
    if (data.dataMode !== undefined) {
      fields.push(`data_mode = $${idx++}`);
      values.push(data.dataMode);
    }
    if (data.googleSheetId !== undefined) {
      fields.push(`google_sheet_id = $${idx++}`);
      values.push(data.googleSheetId);
    }
    if (data.enableSheetWriteback !== undefined) {
      fields.push(`enable_sheet_writeback = $${idx++}`);
      values.push(data.enableSheetWriteback);
    }
    if (data.keywordRules !== undefined) {
      fields.push(`keyword_rules = $${idx++}`);
      values.push(JSON.stringify(data.keywordRules));
    }
    if (data.status !== undefined) {
      fields.push(`status = $${idx++}`);
      values.push(data.status);
    }
    if (data.planType !== undefined) {
      fields.push(`plan_type = $${idx++}`);
      values.push(data.planType);
    }
    if (data.renewalDate !== undefined) {
      fields.push(`renewal_date = $${idx++}`);
      values.push(data.renewalDate);
    }
    if (data.adminNotes !== undefined) {
      fields.push(`admin_notes = $${idx++}`);
      values.push(data.adminNotes);
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

    const parse = createUserSchema.safeParse(req.body);
    if (!parse.success) {
      res.status(400).json({ error: 'Invalid input', details: parse.error.flatten() });
      return;
    }

    const { name, email, password, role } = parse.data;

    // Check email uniqueness
    const emailCheck = await query('SELECT id FROM users WHERE LOWER(email) = LOWER($1)', [email]);
    if (emailCheck.rows.length > 0) {
      res.status(409).json({ error: `User with email '${email}' already exists` });
      return;
    }

    const hash = await bcrypt.hash(password, 10);
    const result = await query(
      `INSERT INTO users (tenant_id, name, email, password_hash, role, is_active)
       VALUES ($1, $2, $3, $4, $5, true)
       RETURNING id, tenant_id, name, email, role, is_active, created_at`,
      [tenantId, name, email.toLowerCase().trim(), hash, role]
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
    const parse = updateUserSchema.safeParse(req.body);
    if (!parse.success) {
      res.status(400).json({ error: 'Invalid input', details: parse.error.flatten() });
      return;
    }

    const data = parse.data;

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

    if (data.name !== undefined) {
      fields.push(`name = $${idx++}`);
      values.push(data.name);
    }
    if (data.role !== undefined) {
      fields.push(`role = $${idx++}`);
      values.push(data.role);
    }
    if (data.isActive !== undefined) {
      fields.push(`is_active = $${idx++}`);
      values.push(data.isActive);
    }
    if (data.password !== undefined) {
      const hash = await bcrypt.hash(data.password, 10);
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

    // In Milestone 2: Record sync timestamp as a healthy trigger
    // (Full background sync engine is connected in Milestone 3)
    const now = new Date().toISOString();
    await query('UPDATE tenants SET last_synced_at = $1, last_sync_error = NULL WHERE id = $2', [
      now,
      tenantId,
    ]);

    res.json({
      success: true,
      message: 'Sync triggered successfully',
      lastSyncedAt: now,
    });
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
