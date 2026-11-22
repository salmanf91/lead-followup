export type TenantDataMode = 'HYBRID_SHEET' | 'NATIVE_ONLY';
export type TenantStatus = 'ACTIVE' | 'SUSPENDED';
export type PlanType = 'ONE_TIME' | 'ANNUAL';
export type UserRole = 'SUPER_ADMIN' | 'SCHOOL_ADMIN' | 'COUNSELOR';
export type FeedbackStatus = 'POSITIVE' | 'PENDING' | 'NEGATIVE' | 'NOT_CONTACTED' | 'INVALID_DUPLICATE';
export type PendingSubstatus = 'MSG_NO_REPLY' | 'CALLED_NO_ANSWER' | 'ANSWERED_NO_DECISION' | 'OTHER';
export type NoteSource = 'GOOGLE_SHEET' | 'WEB_APP';

export interface Tenant {
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
  keyword_rules: Record<string, unknown>;
  status: TenantStatus;
  plan_type: PlanType;
  renewal_date: string | null;
  admin_notes: string | null;
  last_synced_at: string | null;
  last_sync_error: string | null;
  created_at: string;
}

export interface User {
  id: string;
  tenant_id: string | null;
  name: string;
  email: string;
  password_hash: string;
  role: UserRole;
  is_active: boolean;
  created_at: string;
}

export interface Campaign {
  id: string;
  tenant_id: string;
  tab_name: string;
  display_order: number;
  is_active: boolean;
}

export interface Lead {
  id: string;
  tenant_id: string;
  campaign_id: string;
  external_row_hash: string | null;
  sheet_row_number: number | null;
  parent_name: string;
  phone_raw: string | null;
  phone_normalized: string | null;
  grade: string | null;
  feedback_status: FeedbackStatus;
  pending_substatus: PendingSubstatus | null;
  is_duplicate: boolean;
  lead_date: string | null;
  first_contact_at: string | null;
  last_updated_at: string;
  status_updated_by_app: boolean;
  created_at: string;
}

export interface FollowUpNote {
  id: string;
  tenant_id: string;
  lead_id: string;
  user_id: string | null;
  stage: number;
  note_text: string;
  counselor_tag: string | null;
  source: NoteSource;
  noted_at: string;
}

export interface JWTPayload {
  userId: string;
  email: string;
  role: UserRole;
  tenantId: string | null;
  name: string;
}

// Client-safe white-label tenant configuration (silent white-labeling)
export interface PublicTenantConfig {
  id?: string;
  isAdmin?: boolean;
  slug?: string;
  dashboardTitle: string;
  logoUrl?: string | null;
  primaryColor?: string;
  timezone?: string;
}

declare global {
  namespace Express {
    interface Request {
      user?: JWTPayload;
      tenantSlug?: string;
      tenant?: Tenant;
    }
  }
}

