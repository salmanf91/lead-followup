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

export interface DashboardOverview {
  kpiCards: {
    totalLeads: number;
    uniquePeople: number;
    repeats: number;
    followedCount: number;
    followedPercent: number;
    remainingNotContacted: number;
    positiveCount: number;
    positiveRatePercent: number;
    negativeCount: number;
    pendingCount: number;
    replyRatePercent: number;
    daysToFirstContact: number | null;
    newLeadsLast7Days: number;
    goingColdAlertCount: number;
  };
  feedbackSplit: {
    positive: { count: number; percent: number };
    pending: { count: number; percent: number };
    negative: { count: number; percent: number };
    notContacted: { count: number; percent: number };
    invalidDuplicate: { count: number; percent: number };
  };
  pendingBreakdown: {
    msgNoReply: { count: number; percent: number };
    calledNoAnswer: { count: number; percent: number };
    answeredNoDecision: { count: number; percent: number };
    other: { count: number; percent: number };
  };
  funnel: {
    stage1: { completed: number; openWaiting: number };
    stage2: { completed: number; openWaiting: number };
    stage3: { completed: number; openWaiting: number };
  };
  campaigns: Array<{
    id: string;
    tabName: string;
    displayOrder: number;
    isActive?: boolean;
    totalLeads: number;
    followedCount: number;
    followedPercent: number;
    positiveCount: number;
    positiveRatePercent: number;
  }>;
  dailyIntake: Array<{
    date: string;
    count: number;
  }>;
  priorityLeads: Array<{
    id: string;
    parentName: string;
    phoneRaw: string | null;
    phoneNormalized: string | null;
    grade: string | null;
    feedbackStatus: string;
    pendingSubstatus: string | null;
    campaignName: string;
    leadDate: string | null;
    lastUpdatedAt: string;
    whatsAppUrl: string | null;
  }>;
  recentActivities?: Array<{
    id: string;
    leadId: string;
    leadName: string;
    leadGrade: string | null;
    feedbackStatus: string;
    campaignName: string;
    authorName: string;
    stage: number;
    noteText: string;
    source: string;
    notedAt: string;
  }>;
  syncInfo: {
    lastSyncedAt: string | null;
    lastSyncError: string | null;
    dataMode: string;
    googleSheetId: string | null;
  };
}

export interface LeadNote {
  id: string;
  stage: number;
  note_text: string;
  counselor_tag?: string | null;
  source: 'GOOGLE_SHEET' | 'WEB_APP';
  noted_at: string;
}

export interface LeadRecord {
  id: string;
  tenant_id: string;
  campaign_id: string;
  campaign_tab: string;
  parent_name: string;
  phone_raw: string | null;
  phone_normalized: string | null;
  grade: string | null;
  feedback_status: 'POSITIVE' | 'PENDING' | 'NEGATIVE' | 'NOT_CONTACTED' | 'INVALID_DUPLICATE';
  pending_substatus: 'MSG_NO_REPLY' | 'CALLED_NO_ANSWER' | 'ANSWERED_NO_DECISION' | 'OTHER' | null;
  is_duplicate: boolean;
  lead_date: string | null;
  first_contact_at: string | null;
  last_updated_at: string;
  status_updated_by_app: boolean;
  notes_count: number;
  latest_note?: LeadNote | null;
}

export interface LeadsListResponse {
  leads: LeadRecord[];
  total: number;
  page: number;
  totalPages: number;
  limit: number;
}

