import { describe, it, expect, vi } from 'vitest';
import express, { Request, Response } from 'express';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import cookieParser from 'cookie-parser';
import { authenticateJWT, requireRoles, tenantIsolation } from '../middleware/auth.js';
import { extractTenantSlug } from '../utils/subdomain.js';
import { config } from '../config/index.js';

describe('Milestone 1 — RBAC & Tenant Isolation Guardrails', () => {
  const app = express();
  app.use(cookieParser());
  app.use(express.json());

  // Attach mock tenant if slug header provided
  app.use((req, _res, next) => {
    const slug = req.headers['x-tenant-slug'];
    if (slug === 'yis') {
      req.tenant = { id: 'tenant-yis-id' } as any;
    } else if (slug === 'other-school') {
      req.tenant = { id: 'tenant-other-id' } as any;
    }
    next();
  });

  // Test endpoints for RBAC
  app.get('/api/test/super-admin-only', authenticateJWT, requireRoles('SUPER_ADMIN'), (_req: Request, res: Response) => {
    res.json({ allowed: true });
  });

  app.get('/api/test/school-admin-only', authenticateJWT, requireRoles('SCHOOL_ADMIN'), (_req: Request, res: Response) => {
    res.json({ allowed: true });
  });

  app.get(
    '/api/test/tenant-data',
    authenticateJWT,
    tenantIsolation,
    requireRoles('SCHOOL_ADMIN', 'COUNSELOR'),
    (req: Request, res: Response) => {
      res.json({ tenantId: req.user?.tenantId, success: true });
    }
  );

  function createToken(role: 'SUPER_ADMIN' | 'SCHOOL_ADMIN' | 'COUNSELOR', tenantId: string | null) {
    return jwt.sign(
      {
        userId: 'test-user-id',
        email: `${role.toLowerCase()}@test.com`,
        role,
        tenantId,
        name: 'Test User',
      },
      config.jwt.secret
    );
  }

  describe('RBAC Role Gates', () => {
    it('allows SUPER_ADMIN on super-admin-only route', async () => {
      const token = createToken('SUPER_ADMIN', null);
      const res = await request(app)
        .get('/api/test/super-admin-only')
        .set('Cookie', [`${config.cookie.name}=${token}`]);

      expect(res.status).toBe(200);
      expect(res.body.allowed).toBe(true);
    });

    it('denies COUNSELOR on super-admin-only route with 403', async () => {
      const token = createToken('COUNSELOR', 'tenant-yis-id');
      const res = await request(app)
        .get('/api/test/super-admin-only')
        .set('Cookie', [`${config.cookie.name}=${token}`]);

      expect(res.status).toBe(403);
      expect(res.body.error).toContain('Insufficient permissions');
    });

    it('denies SCHOOL_ADMIN on super-admin-only route with 403', async () => {
      const token = createToken('SCHOOL_ADMIN', 'tenant-yis-id');
      const res = await request(app)
        .get('/api/test/super-admin-only')
        .set('Cookie', [`${config.cookie.name}=${token}`]);

      expect(res.status).toBe(403);
    });
  });

  describe('Tenant Isolation Guardrail', () => {
    it('allows school user accessing their own tenant', async () => {
      const token = createToken('COUNSELOR', 'tenant-yis-id');
      const res = await request(app)
        .get('/api/test/tenant-data')
        .set('X-Tenant-Slug', 'yis')
        .set('Cookie', [`${config.cookie.name}=${token}`]);

      expect(res.status).toBe(200);
      expect(res.body.tenantId).toBe('tenant-yis-id');
    });

    it('blocks cross-tenant access when school user accesses another tenant subdomain', async () => {
      const token = createToken('COUNSELOR', 'tenant-yis-id');
      const res = await request(app)
        .get('/api/test/tenant-data')
        .set('X-Tenant-Slug', 'other-school')
        .set('Cookie', [`${config.cookie.name}=${token}`]);

      expect(res.status).toBe(403);
      expect(res.body.error).toContain('Cross-tenant access not permitted');
    });
  });

  describe('Subdomain Extraction Utility', () => {
    it('extracts slug from host headers', () => {
      expect(extractTenantSlug({ headers: { host: 'yis.admissions.com' }, query: {} } as any)).toBe('yis');
      expect(extractTenantSlug({ headers: { host: 'admin.platform.com:443' }, query: {} } as any)).toBe('admin');
      expect(extractTenantSlug({ headers: { host: 'yis.localhost:3000' }, query: {} } as any)).toBe('yis');
      expect(extractTenantSlug({ headers: { host: 'admin.localhost' }, query: {} } as any)).toBe('admin');
      expect(extractTenantSlug({ headers: { host: 'localhost:5000' }, query: {} } as any)).toBeNull();
      expect(extractTenantSlug({ headers: { host: '127.0.0.1:5000' }, query: {} } as any)).toBeNull();
    });

    it('prefers X-Tenant-Slug header override', () => {
      expect(
        extractTenantSlug({
          headers: { host: 'yis.admissions.com', 'x-tenant-slug': 'override-school' },
          query: {},
        } as any)
      ).toBe('override-school');
    });
  });
});

