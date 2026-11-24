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
