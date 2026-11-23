import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import { createApp } from '../app.js';
import { config } from '../config/index.js';
import * as db from '../db/index.js';

vi.mock('../db/index.js', () => ({
  pool: {
    query: vi.fn(),
    on: vi.fn(),
  },
  query: vi.fn(),
  withTransaction: vi.fn(),
  checkDbConnection: vi.fn().mockResolvedValue(true),
}));

describe('Milestone 2 — Super Admin Console APIs & RBAC User Provisioning', () => {
  const app = createApp();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  function getSuperAdminToken() {
    return jwt.sign(
      {
        userId: 'super-admin-uuid',
        email: 'admin@platform.com',
        role: 'SUPER_ADMIN',
        tenantId: null,
        name: 'Super Administrator',
      },
      config.jwt.secret
    );
  }

  function getSchoolAdminToken() {
    return jwt.sign(
      {
        userId: 'school-admin-uuid',
        email: 'admin@school.com',
        role: 'SCHOOL_ADMIN',
        tenantId: 'some-tenant-uuid',
        name: 'School Admin',
      },
      config.jwt.secret
    );
  }

  describe('Security & RBAC Enforcement', () => {
    it('blocks unauthenticated requests with 401', async () => {
      const res = await request(app).get('/api/super-admin/tenants');
      expect(res.status).toBe(401);
    });

    it('blocks non-SUPER_ADMIN users (e.g. SCHOOL_ADMIN) with 403', async () => {
      const token = getSchoolAdminToken();
      const res = await request(app)
        .get('/api/super-admin/tenants')
        .set('Cookie', [`${config.cookie.name}=${token}`]);

      expect(res.status).toBe(403);
    });
  });

  describe('Tenant Management (GET, POST, PATCH /api/super-admin/tenants)', () => {
    it('lists all tenants with user, campaign, and lead counts', async () => {
      const token = getSuperAdminToken();
      vi.mocked(db.query).mockResolvedValueOnce({
        rows: [
          {
            id: 'tenant-1',
            name: 'Elite International School',
            slug: 'elite',
            dashboard_title: 'Elite Admissions',
            status: 'ACTIVE',
            plan_type: 'ANNUAL',
            user_count: 5,
            campaign_count: 3,
            lead_count: 140,
          },
        ],
      } as any);

      const res = await request(app)
        .get('/api/super-admin/tenants')
        .set('Cookie', [`${config.cookie.name}=${token}`]);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body[0].name).toBe('Elite International School');
      expect(res.body[0].user_count).toBe(5);
    });

    it('creates a new school tenant and provisions initial SCHOOL_ADMIN', async () => {
      const token = getSuperAdminToken();

      // 1. check slug uniqueness: returns empty
      vi.mocked(db.query)
        .mockResolvedValueOnce({ rows: [] } as any)
        // 2. insert tenant
        .mockResolvedValueOnce({
          rows: [
            {
              id: 'new-tenant-uuid',
              name: 'Sunrise Academy',
              slug: 'sunrise',
              dashboard_title: 'Sunrise Admissions',
              primary_color: '#0D9488',
              status: 'ACTIVE',
            },
          ],
        } as any)
        // 3. check initial admin email uniqueness: returns empty
        .mockResolvedValueOnce({ rows: [] } as any)
        // 4. insert initial admin user
        .mockResolvedValueOnce({
          rows: [
            {
              id: 'admin-user-uuid',
              name: 'Principal John',
              email: 'john@sunrise.edu',
              role: 'SCHOOL_ADMIN',
              is_active: true,
            },
          ],
        } as any);

      const res = await request(app)
        .post('/api/super-admin/tenants')
        .set('Cookie', [`${config.cookie.name}=${token}`])
        .send({
          name: 'Sunrise Academy',
          slug: 'sunrise',
          dashboardTitle: 'Sunrise Admissions',
          primaryColor: '#0D9488',
          initialAdmin: {
            name: 'Principal John',
            email: 'john@sunrise.edu',
            password: 'SecurePassword123!',
          },
        });

      expect(res.status).toBe(201);
      expect(res.body.tenant.slug).toBe('sunrise');
      expect(res.body.initialAdmin.email).toBe('john@sunrise.edu');
      expect(res.body.initialAdmin.role).toBe('SCHOOL_ADMIN');
    });

    it('rejects duplicate slug with 409 Conflict', async () => {
      const token = getSuperAdminToken();
      vi.mocked(db.query).mockResolvedValueOnce({
        rows: [{ id: 'existing-id' }],
      } as any);

      const res = await request(app)
        .post('/api/super-admin/tenants')
        .set('Cookie', [`${config.cookie.name}=${token}`])
        .send({
          name: 'Sunrise Academy',
          slug: 'sunrise',
          dashboardTitle: 'Sunrise Admissions',
        });

      expect(res.status).toBe(409);
      expect(res.body.error).toContain('already exists');
    });

    it('updates tenant white-label settings and status', async () => {
      const token = getSuperAdminToken();

      // 1. check tenant exists
      vi.mocked(db.query)
        .mockResolvedValueOnce({ rows: [{ id: 'tenant-1' }] } as any)
        // 2. update query
        .mockResolvedValueOnce({
          rows: [
            {
              id: 'tenant-1',
              primary_color: '#7C3AED',
              dashboard_title: 'Updated Title',
              status: 'SUSPENDED',
            },
          ],
        } as any);

      const res = await request(app)
        .patch('/api/super-admin/tenants/tenant-1')
        .set('Cookie', [`${config.cookie.name}=${token}`])
        .send({
          primaryColor: '#7C3AED',
          dashboardTitle: 'Updated Title',
          status: 'SUSPENDED',
        });

      expect(res.status).toBe(200);
      expect(res.body.primary_color).toBe('#7C3AED');
      expect(res.body.status).toBe('SUSPENDED');
    });
  });

  describe('User Provisioning & Role Management', () => {
    it('lists users belonging to a tenant', async () => {
      const token = getSuperAdminToken();
      vi.mocked(db.query).mockResolvedValueOnce({
        rows: [
          {
            id: 'u-1',
            name: 'Counselor Sarah',
            email: 'sarah@school.com',
            role: 'COUNSELOR',
            is_active: true,
          },
        ],
      } as any);

      const res = await request(app)
        .get('/api/super-admin/tenants/tenant-1/users')
        .set('Cookie', [`${config.cookie.name}=${token}`]);

      expect(res.status).toBe(200);
      expect(res.body[0].name).toBe('Counselor Sarah');
      expect(res.body[0].role).toBe('COUNSELOR');
    });

    it('provisions a new COUNSELOR for a tenant', async () => {
      const token = getSuperAdminToken();

      // 1. check tenant exists
      vi.mocked(db.query)
        .mockResolvedValueOnce({ rows: [{ id: 'tenant-1' }] } as any)
        // 2. check email uniqueness
        .mockResolvedValueOnce({ rows: [] } as any)
        // 3. insert user
        .mockResolvedValueOnce({
          rows: [
            {
              id: 'counselor-uuid',
              tenant_id: 'tenant-1',
              name: 'Ali Ahmed',
              email: 'ali@school.com',
              role: 'COUNSELOR',
              is_active: true,
            },
          ],
        } as any);

      const res = await request(app)
        .post('/api/super-admin/tenants/tenant-1/users')
        .set('Cookie', [`${config.cookie.name}=${token}`])
        .send({
          name: 'Ali Ahmed',
          email: 'ali@school.com',
          password: 'Password123!',
          role: 'COUNSELOR',
        });

      expect(res.status).toBe(201);
      expect(res.body.role).toBe('COUNSELOR');
      expect(res.body.email).toBe('ali@school.com');
    });

    it('switches user role and toggles active status', async () => {
      const token = getSuperAdminToken();

      // 1. check user exists and not SUPER_ADMIN
      vi.mocked(db.query)
        .mockResolvedValueOnce({ rows: [{ id: 'u-1', role: 'COUNSELOR' }] } as any)
        // 2. update user
        .mockResolvedValueOnce({
          rows: [
            {
              id: 'u-1',
              role: 'SCHOOL_ADMIN',
              is_active: false,
            },
          ],
        } as any);

      const res = await request(app)
        .patch('/api/super-admin/users/u-1')
        .set('Cookie', [`${config.cookie.name}=${token}`])
        .send({
          role: 'SCHOOL_ADMIN',
          isActive: false,
        });

      expect(res.status).toBe(200);
      expect(res.body.role).toBe('SCHOOL_ADMIN');
      expect(res.body.is_active).toBe(false);
    });
  });

  describe('One-Click Impersonation & Sync Trigger', () => {
    it('generates an impersonation session token for an active school tenant', async () => {
      const token = getSuperAdminToken();

      vi.mocked(db.query).mockResolvedValueOnce({
        rows: [
          {
            id: 'tenant-1',
            name: 'Elite International School',
            slug: 'elite',
            status: 'ACTIVE',
            dashboard_title: 'Elite Admissions',
          },
        ],
      } as any);

      const res = await request(app)
        .post('/api/super-admin/tenants/tenant-1/impersonate')
        .set('Cookie', [`${config.cookie.name}=${token}`]);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.tenant.slug).toBe('elite');

      // Verify cookie issuance
      const cookies = res.headers['set-cookie'];
      expect(cookies).toBeDefined();
      expect(cookies[0]).toContain('token=');
    });

    it('triggers immediate Google Sheet sync', async () => {
      const token = getSuperAdminToken();

      // 1. query tenant
      vi.mocked(db.query)
        .mockResolvedValueOnce({
          rows: [
            {
              id: 'tenant-1',
              name: 'Elite',
              data_mode: 'HYBRID_SHEET',
              google_sheet_id: 'sample-sheet-id',
            },
          ],
        } as any)
        // 2. update last_synced_at
        .mockResolvedValueOnce({ rows: [] } as any);

      const res = await request(app)
        .post('/api/super-admin/tenants/tenant-1/sync-now')
        .set('Cookie', [`${config.cookie.name}=${token}`]);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.lastSyncedAt).toBeDefined();
    });
  });
});
