import { PublicTenantConfig, AuthUser } from '../types';

const API_BASE = '/api';

export async function getTenantConfig(subdomain?: string): Promise<PublicTenantConfig> {
  const headers: Record<string, string> = {};
  if (subdomain) {
    headers['X-Tenant-Slug'] = subdomain;
  }
  const res = await fetch(`${API_BASE}/tenant/config`, {
    headers,
    credentials: 'include',
  });
  if (!res.ok) {
    throw new Error(res.status === 404 ? 'School not found' : 'Failed to load school config');
  }
  return res.json();
}

export async function login(email: string, password: string, subdomain?: string): Promise<{ user: AuthUser; token?: string }> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (subdomain) {
    headers['X-Tenant-Slug'] = subdomain;
  }
  const res = await fetch(`${API_BASE}/auth/login`, {
    method: 'POST',
    headers,
    credentials: 'include',
    body: JSON.stringify({ email, password }),
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || 'Login failed');
  }
  return data;
}

export async function getMe(): Promise<{ user: AuthUser; tenant?: any }> {
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

