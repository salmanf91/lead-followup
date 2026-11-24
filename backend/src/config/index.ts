import dotenv from 'dotenv';
dotenv.config();

export const config = {
  port: parseInt(process.env.PORT || '5000', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  isProduction: process.env.NODE_ENV === 'production',
  databaseUrl: process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/lead_followup',
  jwt: {
    secret: process.env.JWT_SECRET || 'super-secret-jwt-key-for-phase-1-change-in-production',
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  },
  cookie: {
    name: 'token',
    domain: process.env.COOKIE_DOMAIN || undefined,
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days in ms
  },
  google: {
    serviceAccountEmail: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL || '',
    privateKey: (process.env.GOOGLE_PRIVATE_KEY || '').replace(/\\n/g, '\n'),
    credentialsJson: process.env.GOOGLE_SERVICE_ACCOUNT_KEY || '',
    keyFilePath: process.env.GOOGLE_APPLICATION_CREDENTIALS || '',
  },
};
