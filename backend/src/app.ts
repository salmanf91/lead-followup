import express, { Express, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { tenantRouter } from './routes/tenantRoutes.js';
import { authRouter } from './routes/authRoutes.js';
import { superAdminRouter } from './routes/superAdminRoutes.js';
import { dashboardRouter } from './routes/dashboardRoutes.js';
import { tenantResolver } from './middleware/tenantResolver.js';
import { authenticateJWT, requireRoles } from './middleware/auth.js';
import { checkDbConnection } from './db/index.js';

export function createApp(): Express {
  const app = express();

  // Basic security and parsing middleware
  app.use(
    cors({
      origin: (origin, callback) => {
        // Allow all local dev and subdomain origins
        callback(null, true);
      },
      credentials: true,
    })
  );
  app.use(cookieParser());
  app.use(express.json());

  // Health check endpoint
  app.get('/api/health', async (_req: Request, res: Response) => {
    const dbOk = await checkDbConnection();
    res.json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      database: dbOk ? 'connected' : 'disconnected',
    });
  });

  // Subdomain and tenant resolution middleware
  app.use(tenantResolver);

  // Mount API Routers
  app.use('/api/tenant', tenantRouter);
  app.use('/api/auth', authRouter);
  app.use('/api/super-admin', authenticateJWT, requireRoles('SUPER_ADMIN'), superAdminRouter);
  app.use('/api/dashboard', authenticateJWT, dashboardRouter);

  // 404 handler for unknown API routes
  app.use((_req: Request, res: Response) => {
    res.status(404).json({ error: 'Endpoint not found' });
  });

  // Global error handler
  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    console.error('[App] Unhandled error:', err);
    res.status(500).json({ error: 'Internal server error' });
  });

  return app;
}

