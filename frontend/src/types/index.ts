export type UserRole = 'SUPER_ADMIN' | 'SCHOOL_ADMIN' | 'COUNSELOR';

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

