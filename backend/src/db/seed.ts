import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { pool, query } from './index.js';

dotenv.config();

/**
 * Database Seeder: Super-Admin-Only Bootstrap Policy
 * 
 * In accordance with the Master AI Engineering Constitution (CLAUDE.md),
 * this seeder solely bootstraps the root SUPER_ADMIN user from environment variables.
 * Absolutely NO sample tenants, sample users, sample campaigns, or sample leads are seeded.
 */
export async function seedDatabase() {
  console.log('[Seed] Starting database bootstrap (SUPER_ADMIN only)...');

  const name = process.env.SUPER_ADMIN_NAME || 'Super Administrator';
  const email = (process.env.SUPER_ADMIN_EMAIL || 'admin@platform.com').toLowerCase().trim();
  const password = process.env.SUPER_ADMIN_PASSWORD || 'AdminPassword123!';
  const passwordHash = await bcrypt.hash(password, 10);

  const result = await query(
    `INSERT INTO users (name, email, password_hash, role, is_active, tenant_id)
     VALUES ($1, $2, $3, 'SUPER_ADMIN', true, NULL)
     ON CONFLICT (email) DO UPDATE SET
       name = EXCLUDED.name,
       is_active = true
     RETURNING id, name, email, role`,
    [name, email, passwordHash]
  );

  if (result.rows.length > 0) {
    console.log(`[Seed] Bootstrapped root SUPER_ADMIN: ${result.rows[0].email} (id: ${result.rows[0].id})`);
  } else {
    console.log(`[Seed] SUPER_ADMIN (${email}) is already present.`);
  }

  console.log('[Seed] Seeding completed: 1 SUPER_ADMIN, 0 sample tenants, 0 sample campaigns.');
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  seedDatabase()
    .then(() => pool.end())
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('[Seed] Seeding error:', err);
      pool.end().finally(() => process.exit(1));
    });
}
