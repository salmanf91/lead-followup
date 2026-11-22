import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config/index.js';
import { JWTPayload, UserRole } from '../types/index.js';

export function authenticateJWT(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const tokenFromCookie = req.cookies?.[config.cookie.name];
  const authHeader = req.headers.authorization;
  const tokenFromHeader = authHeader?.startsWith('Bearer ')
    ? authHeader.substring(7)
    : null;

  const token = tokenFromCookie || tokenFromHeader;

  if (!token) {
    res.status(401).json({ error: 'Authentication required' });
    return;
  }

  try {
    const decoded = jwt.verify(token, config.jwt.secret) as JWTPayload;
    req.user = decoded;
    next();
  } catch (err) {
    res.status(401).json({ error: 'Invalid or expired session token' });
  }
}

export function requireRoles(...allowedRoles: UserRole[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    if (!allowedRoles.includes(req.user.role)) {
      res.status(403).json({ error: 'Access forbidden: Insufficient permissions' });
      return;
    }

    next();
  };
}

/**
 * Multi-Tenancy Guardrail:
 * Ensures client roles (SCHOOL_ADMIN, COUNSELOR) only operate inside their own school tenant.
 */
export function tenantIsolation(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  if (!req.user) {
    res.status(401).json({ error: 'Authentication required' });
    return;
  }

  // SUPER_ADMIN can bypass specific tenant isolation or impersonate
  if (req.user.role === 'SUPER_ADMIN') {
    return next();
  }

  // Non-super-admins MUST have a tenantId
  if (!req.user.tenantId) {
    res.status(403).json({ error: 'Access forbidden: No tenant associated with user' });
    return;
  }

  // If request resolved a tenant via subdomain, ensure user belongs to this tenant
  if (req.tenant && req.tenant.id !== req.user.tenantId) {
    res.status(403).json({ error: 'Access forbidden: Cross-tenant access not permitted' });
    return;
  }

  next();
}

