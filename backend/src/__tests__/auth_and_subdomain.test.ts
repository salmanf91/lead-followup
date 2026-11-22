import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import bcrypt from 'bcryptjs';
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

describe('Milestone 1 — Subdomain Resolver, Auth & RBAC', () => {
  const app = createApp();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Subdomain Resolver (GET /api/tenant/config)', () => {
    it('returns Super Admin configuration when slug is "admin"', async () => {
      const res = await request(app)
        .get('/api/tenant/config')
        .set('X-Tenant-Slug', 'admin');

      expect(res.status).toBe(200);
      expect(res.body).toEqual({
        isAdmin: true,
        dashboardTitle: 'Super Admin Portal',
      });
    });

    it('returns silent white-label config for active school "yis"', async () => {
      vi.mocked(db.query).mockResolvedValueOnce({
        rows: [
          {
            id: '11111111-1111-1111-1111-111111111111',
            name: 'Yara International School',
            slug: 'yis',
            logo_url: 'https://example.com/logo.png',
            primary_color: '#1E3A8A',
            dashboard_title: 'YIS Admissions & Campaign Follow-Up',
            timezone: 'Asia/Riyadh',
            status: 'ACTIVE',
            plan_type: 'ANNUAL', // sensitive internal field
            renewal_date: '2027-11-30', // sensitive internal field
            admin_notes: 'VIP Client', // sensitive internal field
          },
        ],
      } as any);

      const res = await request(app)
        .get('/api/tenant/config')
        .set('X-Tenant-Slug', 'yis');

      expect(res.status).toBe(200);
      expect(res.body).toEqual({
        id: '11111111-1111-1111-1111-111111111111',
        slug: 'yis',
        dashboardTitle: 'YIS Admissions & Campaign Follow-Up',
        logoUrl: 'https://example.com/logo.png',
        primaryColor: '#1E3A8A',
        timezone: 'Asia/Riyadh',
      });

      // Silent White-Labeling check: sensitive fields MUST NOT be returned!
      expect(res.body.plan_type).toBeUndefined();
      expect(res.body.renewal_date).toBeUndefined();
      expect(res.body.admin_notes).toBeUndefined();
    });

    it('returns 404 when school slug does not exist', async () => {
      vi.mocked(db.query).mockResolvedValueOnce({ rows: [] } as any);

      const res = await request(app)
        .get('/api/tenant/config')
        .set('X-Tenant-Slug', 'non-existent-school');

      expect(res.status).toBe(404);
      expect(res.body.error).toBe('School not found');
    });

    it('returns 403 when school is SUSPENDED without leaking internals', async () => {
      vi.mocked(db.query).mockResolvedValueOnce({
        rows: [
          {
            id: '22222222-2222-2222-2222-222222222222',
            slug: 'suspended-school',
            status: 'SUSPENDED',
          },
        ],
      } as any);

      const res = await request(app)
        .get('/api/tenant/config')
        .set('X-Tenant-Slug', 'suspended-school');

      expect(res.status).toBe(403);
      expect(res.body.error).toBe('School portal unavailable');
    });

    it('extracts slug from host header (e.g. yis.yourplatform.com)', async () => {
      vi.mocked(db.query).mockResolvedValueOnce({
        rows: [
          {
            id: '11111111-1111-1111-1111-111111111111',
            slug: 'yis',
            dashboard_title: 'YIS Admissions',
            primary_color: '#1E3A8A',
            timezone: 'Asia/Riyadh',
            status: 'ACTIVE',
          },
        ],
      } as any);

      const res = await request(app)
        .get('/api/tenant/config')
        .set('Host', 'yis.yourplatform.com');

      expect(res.status).toBe(200);
      expect(res.body.slug).toBe('yis');
    });
  });

  describe('Authentication (POST /api/auth/login)', () => {
    it('authenticates SUPER_ADMIN on admin slug and sets HttpOnly cookie', async () => {
      const passwordHash = await bcrypt.hash('AdminPassword123!', 10);
      vi.mocked(db.query).mockResolvedValueOnce({
        rows: [
          {
            id: 'admin-uuid',
            name: 'Super Administrator',
            email: 'admin@platform.com',
            password_hash: passwordHash,
            role: 'SUPER_ADMIN',
            is_active: true,
            tenant_id: null,
          },
        ],
      } as any);

      const res = await request(app)
        .post('/api/auth/login')
        .set('X-Tenant-Slug', 'admin')
        .send({
          email: 'admin@platform.com',
          password: 'AdminPassword123!',
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.user).toEqual({
        id: 'admin-uuid',
        name: 'Super Administrator',
        email: 'admin@platform.com',
        role: 'SUPER_ADMIN',
        tenantId: null,
      });

      // Verify HttpOnly cookie header
      const cookies = res.headers['set-cookie'];
      expect(cookies).toBeDefined();
      expect(cookies[0]).toContain('token=');
      expect(cookies[0].toLowerCase()).toContain('httponly');
      expect(cookies[0].toLowerCase()).toContain('samesite=lax');
    });

    it('authenticates SCHOOL_ADMIN on school slug', async () => {
      const passwordHash = await bcrypt.hash('SchoolAdmin123!', 10);
      const tenantId = 'yis-uuid';

      // 1. query for tenant lookup in login
      vi.mocked(db.query)
        .mockResolvedValueOnce({
          rows: [
            {
              id: tenantId,
              slug: 'yis',
              status: 'ACTIVE',
            },
          ],
        } as any)
        // 2. query for user lookup
        .mockResolvedValueOnce({
          rows: [
            {
              id: 'user-uuid',
              name: 'YIS Admissions Director',
              email: 'admin@yis.edu.sa',
              password_hash: passwordHash,
              role: 'SCHOOL_ADMIN',
              is_active: true,
              tenant_id: tenantId,
            },
          ],
        } as any);

      const res = await request(app)
        .post('/api/auth/login')
        .set('X-Tenant-Slug', 'yis')
        .send({
          email: 'admin@yis.edu.sa',
          password: 'SchoolAdmin123!',
        });

      expect(res.status).toBe(200);
      expect(res.body.user.role).toBe('SCHOOL_ADMIN');
      expect(res.body.user.tenantId).toBe(tenantId);
    });

    it('rejects login with invalid password', async () => {
      const passwordHash = await bcrypt.hash('CorrectPassword', 10);
      vi.mocked(db.query).mockResolvedValueOnce({
        rows: [
          {
            id: 'admin-uuid',
            name: 'Super Administrator',
            email: 'admin@platform.com',
            password_hash: passwordHash,
            role: 'SUPER_ADMIN',
            is_active: true,
            tenant_id: null,
          },
        ],
      } as any);

      const res = await request(app)
        .post('/api/auth/login')
        .set('X-Tenant-Slug', 'admin')
        .send({
          email: 'admin@platform.com',
          password: 'WrongPassword',
        });

      expect(res.status).toBe(401);
      expect(res.body.error).toBe('Invalid email or password');
    });
  });

  describe('Session Profile (GET /api/auth/me) & Logout', () => {
    it('returns user profile when valid JWT cookie is present', async () => {
      const token = jwt.sign(
        {
          userId: 'user-uuid',
          email: 'counselor@yis.edu.sa',
          role: 'COUNSELOR',
          tenantId: 'yis-uuid',
          name: 'Turki Al-Otaibi',
        },
        config.jwt.secret,
        { expiresIn: '7d' }
      );

      vi.mocked(db.query).mockResolvedValueOnce({
        rows: [
          {
            id: 'yis-uuid',
            name: 'Yara International School',
            slug: 'yis',
            dashboard_title: 'YIS Admissions',
          },
        ],
      } as any);

      const res = await request(app)
        .get('/api/auth/me')
        .set('Cookie', [`${config.cookie.name}=${token}`]);

      expect(res.status).toBe(200);
      expect(res.body.user.email).toBe('counselor@yis.edu.sa');
      expect(res.body.user.role).toBe('COUNSELOR');
      expect(res.body.tenant.slug).toBe('yis');
    });

    it('returns 401 when no session token is provided', async () => {
      const res = await request(app).get('/api/auth/me');
      expect(res.status).toBe(401);
    });

    it('clears cookie on logout', async () => {
      const res = await request(app).post('/api/auth/logout');
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      const cookies = res.headers['set-cookie'];
      expect(cookies[0]).toMatch(/token=;/);
    });
  });
});

