import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import { config } from '../config/index.js';
import { query } from '../db/index.js';
import { extractTenantSlug } from '../utils/subdomain.js';
import { authenticateJWT } from '../middleware/auth.js';
import { User, Tenant, JWTPayload } from '../types/index.js';

export const authRouter = Router();

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1, 'Password is required'),
});

/**
 * POST /api/auth/login
 * Authenticates user against the resolved tenant (or SUPER_ADMIN on admin slug).
 * Sets HttpOnly JWT cookie.
 */
authRouter.post('/login', async (req: Request, res: Response): Promise<void> => {
  try {
    const parseResult = loginSchema.safeParse(req.body);
    if (!parseResult.success) {
      res.status(400).json({ error: 'Invalid input', details: parseResult.error.flatten() });
      return;
    }

    const { email, password } = parseResult.data;
    const slug = extractTenantSlug(req);

    let user: User | null = null;
    let tenant: Tenant | null = null;

    if (slug === 'admin') {
      // Super Admin login
      const result = await query<User>(
        `SELECT * FROM users
         WHERE LOWER(email) = LOWER($1) AND role = 'SUPER_ADMIN' AND is_active = true
         LIMIT 1`,
        [email]
      );
      if (result.rows.length > 0) {
        user = result.rows[0];
      }
    } else if (slug) {
      // School tenant login: use req.tenant resolved by middleware if available
      tenant = req.tenant || null;
      if (!tenant) {
        const tenantResult = await query<Tenant>(
          'SELECT * FROM tenants WHERE slug = $1 AND status = $2 LIMIT 1',
          [slug, 'ACTIVE']
        );

        if (tenantResult.rows.length === 0) {
          res.status(404).json({ error: 'School portal unavailable' });
          return;
        }

        tenant = tenantResult.rows[0];
      }

      const userResult = await query<User>(
        `SELECT * FROM users
         WHERE LOWER(email) = LOWER($1) AND tenant_id = $2 AND is_active = true
         LIMIT 1`,
        [email, tenant.id]
      );

      if (userResult.rows.length > 0) {
        user = userResult.rows[0];
      }
    } else {
      // If no subdomain provided (e.g. direct API test), look up user by email directly
      const userResult = await query<User>(
        'SELECT * FROM users WHERE LOWER(email) = LOWER($1) AND is_active = true LIMIT 1',
        [email]
      );
      if (userResult.rows.length > 0) {
        user = userResult.rows[0];
        if (user.tenant_id) {
          const tenantResult = await query<Tenant>(
            'SELECT * FROM tenants WHERE id = $1 AND status = $2 LIMIT 1',
            [user.tenant_id, 'ACTIVE']
          );
          if (tenantResult.rows.length > 0) {
            tenant = tenantResult.rows[0];
          }
        }
      }
    }

    if (!user) {
      res.status(401).json({ error: 'Invalid email or password' });
      return;
    }

    const passwordMatch = await bcrypt.compare(password, user.password_hash);
    if (!passwordMatch) {
      res.status(401).json({ error: 'Invalid email or password' });
      return;
    }

    // Construct JWT Payload
    const payload: JWTPayload = {
      userId: user.id,
      email: user.email,
      role: user.role,
      tenantId: user.tenant_id,
      name: user.name,
    };

    const token = jwt.sign(payload, config.jwt.secret, {
      expiresIn: config.jwt.expiresIn as any,
    });

    // Set HttpOnly, SameSite=Lax cookie
    res.cookie(config.cookie.name, token, {
      httpOnly: config.cookie.httpOnly,
      secure: config.cookie.secure,
      sameSite: config.cookie.sameSite,
      maxAge: config.cookie.maxAge,
    });

    res.json({
      success: true,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        tenantId: user.tenant_id,
      },
      token, // Also return in body for mobile / API consumers
    });
  } catch (error) {
    console.error('[AuthRoute] Login error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /api/auth/logout
 * Clears the HttpOnly JWT session cookie.
 */
authRouter.post('/logout', (req: Request, res: Response): void => {
  res.clearCookie(config.cookie.name, {
    httpOnly: config.cookie.httpOnly,
    secure: config.cookie.secure,
    sameSite: config.cookie.sameSite,
  });
  res.json({ success: true, message: 'Logged out successfully' });
});

/**
 * GET /api/auth/me
 * Returns current authenticated user and associated tenant info.
 */
authRouter.get('/me', authenticateJWT, async (req: Request, res: Response): Promise<void> => {
  try {
    const user = req.user!;
    let tenantInfo: { id: string; name: string; slug: string; dashboardTitle: string } | null = null;

    if (user.tenantId) {
      const tenantResult = await query<Tenant>(
        'SELECT id, name, slug, dashboard_title FROM tenants WHERE id = $1 LIMIT 1',
        [user.tenantId]
      );
      if (tenantResult.rows.length > 0) {
        tenantInfo = {
          id: tenantResult.rows[0].id,
          name: tenantResult.rows[0].name,
          slug: tenantResult.rows[0].slug,
          dashboardTitle: tenantResult.rows[0].dashboard_title,
        };
      }
    }

    res.json({
      user: {
        id: user.userId,
        name: user.name,
        email: user.email,
        role: user.role,
        tenantId: user.tenantId,
      },
      tenant: tenantInfo,
    });
  } catch (error) {
    console.error('[AuthRoute] Me error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});
