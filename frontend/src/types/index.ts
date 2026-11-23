export type UserRole = 'SUPER_ADMIN' | 'SCHOOL_ADMIN' | 'COUNSELOR';
export type TenantStatus = 'ACTIVE' | 'SUSPENDED';
export type PlanType = 'ONE_TIME' | 'ANNUAL';
export type TenantDataMode = 'HYBRID_SHEET' | 'NATIVE_ONLY';

export interface PublicTenantConfig {
  id?: string;
  isAdmin?: boolean;
  slug?: string;
  dashboardTitle: string;
  logoUrl?: string | null;
  primaryColor?: string;
  timezone?: string;
}

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  tenantId: string | null;
}

export interface TenantRecord {
  id: string;
  name: string;
  slug: string;
  logo_url: string | null;
  primary_color: string;
  dashboard_title: string;
  timezone: string;
  data_mode: TenantDataMode;
  google_sheet_id: string | null;
  enable_sheet_writeback: boolean;
  keyword_rules: Record<string, any>;
  status: TenantStatus;
  plan_type: PlanType;
  renewal_date: string | null;
  admin_notes: string | null;
  last_synced_at: string | null;
  last_sync_error: string | null;
  created_at: string;
  user_count?: number;
  campaign_count?: number;
  lead_count?: number;
}

export interface TenantUser {
  id: string;
  tenant_id: string;
  name: string;
  email: string;
  role: 'SCHOOL_ADMIN' | 'COUNSELOR';
  is_active: boolean;
  created_at: string;
}
