import bcrypt from 'bcryptjs';
import { fileURLToPath } from 'url';
import { pool, query } from './index.js';

export async function seedDatabase() {
  console.log('[Seed] Starting database seeding...');

  // 1. Seed SUPER_ADMIN
  const superAdminEmail = 'admin@platform.com';
  const superAdminPassword = process.env.SUPER_ADMIN_PASSWORD || 'AdminPassword123!';
  const superAdminHash = await bcrypt.hash(superAdminPassword, 10);

  const existingSuperAdmin = await query(
    'SELECT id FROM users WHERE email = $1',
    [superAdminEmail]
  );

  let superAdminId: string;
  if (existingSuperAdmin.rows.length === 0) {
    const res = await query(
      `INSERT INTO users (name, email, password_hash, role, is_active, tenant_id)
       VALUES ($1, $2, $3, 'SUPER_ADMIN', true, NULL)
       RETURNING id`,
      ['Super Administrator', superAdminEmail, superAdminHash]
    );
    superAdminId = res.rows[0].id;
    console.log(`[Seed] Created SUPER_ADMIN: ${superAdminEmail} (id: ${superAdminId})`);
  } else {
    superAdminId = existingSuperAdmin.rows[0].id;
    console.log(`[Seed] SUPER_ADMIN already exists: ${superAdminEmail}`);
  }

  // 2. Seed Sample School (YIS - Yara International School)
  const yisSlug = 'yis';
  const existingTenant = await query(
    'SELECT id FROM tenants WHERE slug = $1',
    [yisSlug]
  );

  let yisTenantId: string;
  const keywordRules = {
    positive: ['interested', 'inerested', 'will visit', 'visiting', 'admission', 'assessment', 'positive'],
    negative: ['not interested', 'dead lead', 'dead', 'wrong number', 'cancelled', 'negative'],
    invalid_duplicate: ['duplicate', 'invalid', 'repeat'],
    pending_msg_no_reply: ['no feedback from whatsapp', 'sent a reminder', 'welcome message', 'poster sent', 'email sent', 'message sent'],
    pending_called_no_answer: ['no answer', "didn't answer", 'not answering', 'busy', 'phone closed', 'not connecting'],
    pending_answered_no_decision: ['answered', 'calls back', 'planning for next year', 'scholarship', 'doubt', 'sen child']
  };

  if (existingTenant.rows.length === 0) {
    const res = await query(
      `INSERT INTO tenants (
        name, slug, logo_url, primary_color, dashboard_title, timezone,
        data_mode, google_sheet_id, enable_sheet_writeback, keyword_rules,
        status, plan_type, renewal_date, admin_notes
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
      RETURNING id`,
      [
        'Yara International School',
        yisSlug,
        'https://placehold.co/180x60/1E3A8A/FFFFFF/png?text=YIS',
        '#1E3A8A',
        'YIS Admissions & Campaign Follow-Up',
        'Asia/Riyadh',
        'HYBRID_SHEET',
        '1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms',
        false,
        JSON.stringify(keywordRules),
        'ACTIVE',
        'ANNUAL',
        '2027-11-30',
        'Flagship school in Riyadh / Khobar'
      ]
    );
    yisTenantId = res.rows[0].id;
    console.log(`[Seed] Created Tenant: Yara International School (slug: ${yisSlug}, id: ${yisTenantId})`);
  } else {
    yisTenantId = existingTenant.rows[0].id;
    console.log(`[Seed] Tenant ${yisSlug} already exists (id: ${yisTenantId})`);
  }

  // 3. Seed School Admin for YIS
  const schoolAdminEmail = 'admin@yis.edu.sa';
  const schoolAdminPassword = process.env.SCHOOL_ADMIN_PASSWORD || 'SchoolAdmin123!';
  const schoolAdminHash = await bcrypt.hash(schoolAdminPassword, 10);

  const existingSchoolAdmin = await query(
    'SELECT id FROM users WHERE email = $1',
    [schoolAdminEmail]
  );

  if (existingSchoolAdmin.rows.length === 0) {
    await query(
      `INSERT INTO users (name, email, password_hash, role, is_active, tenant_id)
       VALUES ($1, $2, $3, 'SCHOOL_ADMIN', true, $4)`,
      ['YIS Admissions Director', schoolAdminEmail, schoolAdminHash, yisTenantId]
    );
    console.log(`[Seed] Created SCHOOL_ADMIN: ${schoolAdminEmail}`);
  } else {
    console.log(`[Seed] SCHOOL_ADMIN already exists: ${schoolAdminEmail}`);
  }

  // 4. Seed Counselors for YIS
  const counselors = [
    { name: 'Turki Al-Otaibi', email: 'turki@yis.edu.sa', password: 'Counselor123!' },
    { name: 'Wafaa Al-Harbi', email: 'wafaa@yis.edu.sa', password: 'Counselor123!' },
    { name: 'Nada Al-Zahrani', email: 'nada@yis.edu.sa', password: 'Counselor123!' },
  ];

  for (const c of counselors) {
    const existingCounselor = await query(
      'SELECT id FROM users WHERE email = $1',
      [c.email]
    );
    if (existingCounselor.rows.length === 0) {
      const hash = await bcrypt.hash(c.password, 10);
      await query(
        `INSERT INTO users (name, email, password_hash, role, is_active, tenant_id)
         VALUES ($1, $2, $3, 'COUNSELOR', true, $4)`,
        [c.name, c.email, hash, yisTenantId]
      );
      console.log(`[Seed] Created COUNSELOR: ${c.email}`);
    }
  }

  // 5. Seed Campaigns for YIS
  const sampleCampaigns = [
    { tab_name: 'Al-Khobar', display_order: 1 },
    { tab_name: 'Dhaharan-Aziziya', display_order: 2 },
    { tab_name: 'Khobar - 17 MI', display_order: 3 },
    { tab_name: 'Campaign - 4 (9-12)', display_order: 4 },
    { tab_name: 'Kg - campaign 5', display_order: 5 },
  ];

  for (const camp of sampleCampaigns) {
    await query(
      `INSERT INTO campaigns (tenant_id, tab_name, display_order, is_active)
       VALUES ($1, $2, $3, true)
       ON CONFLICT (tenant_id, tab_name) DO NOTHING`,
      [yisTenantId, camp.tab_name, camp.display_order]
    );
  }
  console.log(`[Seed] Seeded ${sampleCampaigns.length} campaigns for YIS.`);

  console.log('[Seed] Database seeding completed successfully.');
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

