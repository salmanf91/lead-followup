import { PublicTenantConfig, AuthUser, TenantRecord, TenantUser, DashboardOverview } from '../types';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || '/api';

export async function getTenantConfig(subdomain: string): Promise<PublicTenantConfig> {
  const res = await fetch(`${API_BASE}/tenant/config`, {
    headers: {
      'x-tenant-slug': subdomain,
    },
    credentials: 'include',
  });
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.error || 'Failed to load school configuration');
  }
  return res.json();
}

export async function login(
  email: string,
  password: string,
  subdomain: string
): Promise<{ user: AuthUser }> {
  const res = await fetch(`${API_BASE}/auth/login`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-tenant-slug': subdomain,
    },
    credentials: 'include',
    body: JSON.stringify({ email, password }),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || 'Authentication failed');
  }
  return data;
}

export async function getMe(): Promise<{ user: AuthUser; tenantConfig: PublicTenantConfig }> {
  const res = await fetch(`${API_BASE}/auth/me`, {
    credentials: 'include',
  });
  if (!res.ok) {
    throw new Error('Not authenticated');
  }
  return res.json();
}

export async function logout(): Promise<void> {
  await fetch(`${API_BASE}/auth/logout`, {
    method: 'POST',
    credentials: 'include',
  });
}

// ================= Super Admin APIs =================

export async function getSuperAdminTenants(): Promise<TenantRecord[]> {
  const res = await fetch(`${API_BASE}/super-admin/tenants`, {
    credentials: 'include',
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || 'Failed to fetch school tenants');
  }
  return res.json();
}
export const getTenants = getSuperAdminTenants;

export async function createTenant(payload: any): Promise<{ tenant: TenantRecord; initialAdmin?: TenantUser }> {
  const res = await fetch(`${API_BASE}/super-admin/tenants`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(payload),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || 'Failed to create school tenant');
  }
  return data;
}

export async function updateTenant(tenantId: string, payload: any): Promise<TenantRecord> {
  const res = await fetch(`${API_BASE}/super-admin/tenants/${tenantId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(payload),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || 'Failed to update tenant');
  }
  return data;
}

export async function getTenantUsers(tenantId: string): Promise<TenantUser[]> {
  const res = await fetch(`${API_BASE}/super-admin/tenants/${tenantId}/users`, {
    credentials: 'include',
  });
  if (!res.ok) {
    throw new Error('Failed to fetch tenant users');
  }
  return res.json();
}

export async function createTenantUser(
  tenantId: string,
  payload: { name: string; email: string; password: string; role: 'SCHOOL_ADMIN' | 'COUNSELOR' }
): Promise<TenantUser> {
  const res = await fetch(`${API_BASE}/super-admin/tenants/${tenantId}/users`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(payload),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || 'Failed to create user');
  }
  return data;
}

export async function updateTenantUser(
  userId: string,
  payload: { name?: string; role?: 'SCHOOL_ADMIN' | 'COUNSELOR'; isActive?: boolean; password?: string }
): Promise<TenantUser> {
  const res = await fetch(`${API_BASE}/super-admin/users/${userId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(payload),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || 'Failed to update user');
  }
  return data;
}

export async function syncTenantNow(tenantId: string): Promise<{ success: boolean; lastSyncedAt: string; message: string }> {
  const res = await fetch(`${API_BASE}/super-admin/tenants/${tenantId}/sync-now`, {
    method: 'POST',
    credentials: 'include',
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || 'Failed to trigger sync');
  }
  return data;
}
export const triggerTenantSync = syncTenantNow;

export async function impersonateTenant(tenantId: string): Promise<{ success: boolean; token: string; tenant: { id: string; name: string; slug: string } }> {
  const res = await fetch(`${API_BASE}/super-admin/tenants/${tenantId}/impersonate`, {
    method: 'POST',
    credentials: 'include',
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || 'Failed to impersonate tenant');
  }
  return data;
}

// ================= Dashboard Analytics APIs =================

export async function getDashboardOverview(campaignId?: string, fresh = false): Promise<DashboardOverview> {
  const params = new URLSearchParams();
  if (campaignId && campaignId !== 'ALL') {
    params.set('campaignId', campaignId);
  }
  if (fresh) {
    params.set('fresh', 'true');
  }

  const qs = params.toString() ? `?${params.toString()}` : '';
  const res = await fetch(`${API_BASE}/dashboard/overview${qs}`, {
    credentials: 'include',
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || 'Failed to load dashboard overview');
  }
  return res.json();
}

export async function getDashboardCampaigns(): Promise<Array<{ id: string; tab_name: string; display_order: number }>> {
  const res = await fetch(`${API_BASE}/dashboard/campaigns`, {
    credentials: 'include',
  });
  if (!res.ok) {
    throw new Error('Failed to fetch campaigns');
  }
  return res.json();
}

export async function triggerSchoolSync(): Promise<{ success: boolean; message: string }> {
  const res = await fetch(`${API_BASE}/dashboard/sync-now`, {
    method: 'POST',
    credentials: 'include',
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || 'Sync failed');
  }
  return data;
}

// ================= Lead Management & Follow-Up APIs =================

export async function getLeads(params: {
  campaignId?: string;
  status?: string;
  pendingSubstatus?: string;
  grade?: string;
  coldOnly?: boolean;
  search?: string;
  sortBy?: string;
  order?: 'asc' | 'desc';
  page?: number;
  limit?: number;
}): Promise<import('../types').LeadsListResponse> {
  const query = new URLSearchParams();
  if (params.campaignId && params.campaignId !== 'ALL') query.set('campaignId', params.campaignId);
  if (params.status && params.status !== 'ALL') query.set('status', params.status);
  if (params.pendingSubstatus) query.set('pendingSubstatus', params.pendingSubstatus);
  if (params.grade && params.grade !== 'ALL') query.set('grade', params.grade);
  if (params.coldOnly) query.set('coldOnly', 'true');
  if (params.search) query.set('search', params.search);
  if (params.sortBy) query.set('sortBy', params.sortBy);
  if (params.order) query.set('order', params.order);
  if (params.page) query.set('page', params.page.toString());
  if (params.limit) query.set('limit', params.limit.toString());

  const qs = query.toString() ? `?${query.toString()}` : '';
  const res = await fetch(`${API_BASE}/leads${qs}`, {
    credentials: 'include',
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || 'Failed to fetch leads');
  }
  return res.json();
}

export async function getLeadDetails(
  id: string
): Promise<{ lead: import('../types').LeadRecord; notes: import('../types').LeadNote[] }> {
  const res = await fetch(`${API_BASE}/leads/${id}`, {
    credentials: 'include',
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || 'Failed to fetch lead details');
  }
  return res.json();
}

export async function addLeadNote(
  id: string,
  payload: {
    stage: number;
    noteText: string;
    feedbackStatus?: string;
    pendingSubstatus?: string;
  }
): Promise<{ success: boolean; note: import('../types').LeadNote; lead: import('../types').LeadRecord }> {
  const res = await fetch(`${API_BASE}/leads/${id}/notes`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(payload),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || 'Failed to add note');
  }
  return data;
}

export async function updateLeadStatus(
  id: string,
  payload: {
    feedbackStatus: string;
    pendingSubstatus?: string;
  }
): Promise<{ success: boolean; lead: import('../types').LeadRecord }> {
  const res = await fetch(`${API_BASE}/leads/${id}/status`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(payload),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || 'Failed to update lead status');
  }
  return data;
}

// ================= School Admin APIs =================

export async function getSchoolCounselors(): Promise<import('../types').TenantUser[]> {
  const res = await fetch(`${API_BASE}/school-admin/users`, {
    credentials: 'include',
  });
  if (!res.ok) {
    throw new Error('Failed to fetch school counselors');
  }
  return res.json();
}

export async function createSchoolCounselor(payload: {
  name: string;
  email: string;
  password: string;
}): Promise<import('../types').TenantUser> {
  const res = await fetch(`${API_BASE}/school-admin/users`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(payload),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || 'Failed to create counselor');
  }
  return data;
}

export async function updateSchoolCounselor(
  id: string,
  payload: { is_active?: boolean; password?: string }
): Promise<{ success: boolean; user: import('../types').TenantUser }> {
  const res = await fetch(`${API_BASE}/school-admin/users/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(payload),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || 'Failed to update counselor');
  }
  return data;
}

export async function importLeadsCsv(
  csvText: string,
  campaignName?: string
): Promise<{ success: boolean; totalProcessed: number; importedCount: number; duplicateCount: number }> {
  const res = await fetch(`${API_BASE}/school-admin/leads/import-csv`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ csvText, campaignName }),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || 'Failed to import CSV');
  }
  return data;
}

export function getExportLeadsCsvUrl(campaignId?: string, status?: string): string {
  const query = new URLSearchParams();
  if (campaignId && campaignId !== 'ALL') query.set('campaignId', campaignId);
  if (status && status !== 'ALL') query.set('status', status);
  const qs = query.toString() ? `?${query.toString()}` : '';
  return `${API_BASE}/school-admin/leads/export-csv${qs}`;
}

export async function updateCampaignStatus(
  campaignId: string,
  isActive: boolean,
  tenantId?: string
): Promise<{ success: boolean; campaign: any }> {
  const res = await fetch(`${API_BASE}/school-admin/campaigns/${campaignId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ is_active: isActive, tenantId }),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || 'Failed to update campaign');
  }
  return data;
}

