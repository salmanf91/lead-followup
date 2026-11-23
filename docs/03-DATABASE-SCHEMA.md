# 03 — PostgreSQL Database Schema & Indexes

## 1. PostgreSQL Schema DDL

```sql
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TYPE tenant_data_mode AS ENUM ('HYBRID_SHEET', 'NATIVE_ONLY');
CREATE TYPE tenant_status AS ENUM ('ACTIVE', 'SUSPENDED');
CREATE TYPE plan_type AS ENUM ('ONE_TIME', 'ANNUAL');
CREATE TYPE user_role AS ENUM ('SUPER_ADMIN', 'SCHOOL_ADMIN', 'COUNSELOR');
CREATE TYPE feedback_status AS ENUM ('POSITIVE', 'PENDING', 'NEGATIVE', 'NOT_CONTACTED', 'INVALID_DUPLICATE');
CREATE TYPE pending_substatus AS ENUM ('MSG_NO_REPLY', 'CALLED_NO_ANSWER', 'ANSWERED_NO_DECISION', 'OTHER');
CREATE TYPE note_source AS ENUM ('GOOGLE_SHEET', 'WEB_APP');

CREATE TABLE tenants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(100) UNIQUE NOT NULL,
    logo_url TEXT,
    primary_color VARCHAR(20) DEFAULT '#1E3A8A',
    dashboard_title VARCHAR(255) NOT NULL,
    timezone VARCHAR(100) DEFAULT 'Asia/Riyadh',
    data_mode tenant_data_mode DEFAULT 'HYBRID_SHEET',
    google_sheet_id VARCHAR(255),
    enable_sheet_writeback BOOLEAN DEFAULT FALSE,
    keyword_rules JSONB DEFAULT '{}'::jsonb,
    status tenant_status DEFAULT 'ACTIVE',
    plan_type plan_type DEFAULT 'ANNUAL',
    renewal_date DATE,
    admin_notes TEXT,
    last_synced_at TIMESTAMPTZ,
    last_sync_error TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    role user_role NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT chk_tenant_for_non_super CHECK (
        (role = 'SUPER_ADMIN' AND tenant_id IS NULL) OR
        (role <> 'SUPER_ADMIN' AND tenant_id IS NOT NULL)
    )
);

CREATE TABLE campaigns (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    tab_name VARCHAR(255) NOT NULL,
    display_order INT DEFAULT 0,
    is_active BOOLEAN DEFAULT TRUE,
    UNIQUE (tenant_id, tab_name)
);

CREATE TABLE leads (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    campaign_id UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
    external_row_hash VARCHAR(64),
    sheet_row_number INT,
    parent_name VARCHAR(255) NOT NULL,
    phone_raw VARCHAR(50),
    phone_normalized VARCHAR(30),
    grade VARCHAR(100),
    feedback_status feedback_status DEFAULT 'NOT_CONTACTED',
    pending_substatus pending_substatus,
    is_duplicate BOOLEAN DEFAULT FALSE,
    lead_date DATE,
    first_contact_at TIMESTAMPTZ,
    last_updated_at TIMESTAMPTZ DEFAULT NOW(),
    status_updated_by_app BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE follow_up_notes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    lead_id UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    stage INT NOT NULL DEFAULT 1,
    note_text TEXT NOT NULL,
    counselor_tag VARCHAR(100),
    source note_source NOT NULL DEFAULT 'WEB_APP',
    noted_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Performance Indexes (Eliminates need for Redis)
CREATE INDEX idx_leads_tenant_campaign_status ON leads (tenant_id, campaign_id, feedback_status);
CREATE INDEX idx_leads_tenant_phone ON leads (tenant_id, phone_normalized);
CREATE INDEX idx_leads_tenant_updated ON leads (tenant_id, last_updated_at);
CREATE INDEX idx_leads_tenant_lead_date ON leads (tenant_id, lead_date);
CREATE UNIQUE INDEX idx_leads_tenant_row_hash ON leads (tenant_id, external_row_hash) WHERE external_row_hash IS NOT NULL;
CREATE INDEX idx_notes_lead_noted_at ON follow_up_notes (lead_id, noted_at ASC);
```

## 2. Zero Hardcoded Data & Super-Admin-Only Seeding Policy
1. The database seed script (`npm run db:seed`) MUST ONLY insert the initial `SUPER_ADMIN` user with credentials read from environment variables:
   - `SUPER_ADMIN_NAME`
   - `SUPER_ADMIN_EMAIL`
   - `SUPER_ADMIN_PASSWORD`
2. Idempotent insertion rule:
   ```sql
   INSERT INTO users (name, email, password_hash, role, is_active, tenant_id)
   VALUES ($1, $2, $3, 'SUPER_ADMIN', true, NULL)
   ON CONFLICT (email) DO NOTHING;
   ```
3. **STRICTLY FORBIDDEN IN SEED SCRIPT & CODEBASE:**
   - No mock/sample school tenants (zero references to `YIS` or demo schools).
   - No sample `SCHOOL_ADMIN` accounts.
   - No sample `COUNSELOR` accounts.
   - No sample campaigns or mock leads.
4. All schools, administrators, counselors, campaigns, and leads must be created dynamically through the application interface or Google Sheets sync.
