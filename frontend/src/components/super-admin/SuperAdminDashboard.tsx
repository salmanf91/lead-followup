'use client';

import { useState, useEffect } from 'react';
import {
  Building2,
  Users,
  Shield,
  ShieldAlert,
  RefreshCw,
  Search,
  Plus,
  SlidersHorizontal,
  ExternalLink,
  CheckCircle2,
  AlertTriangle,
  Globe,
  Clock,
  Calendar,
  LogOut,
  X,
  FileSpreadsheet,
  Check,
  ChevronRight,
  Sparkles,
} from 'lucide-react';
import { getTenants, triggerTenantSync, impersonateTenant } from '../../lib/api';
import { TenantRecord, AuthUser } from '../../types';
import CreateTenantModal from './CreateTenantModal';
import EditTenantModal from './EditTenantModal';
import TenantUsersModal from './TenantUsersModal';

interface Props {
  currentUser: AuthUser;
  onLogout: () => void;
  onImpersonateSuccess?: (slug: string) => void;
}

export default function SuperAdminDashboard({
  currentUser,
  onLogout,
  onImpersonateSuccess,
}: Props) {
  const [tenants, setTenants] = useState<TenantRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters & Search
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'ACTIVE' | 'SUSPENDED'>('ALL');

  // Modal dialog states
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingTenant, setEditingTenant] = useState<TenantRecord | null>(null);
  const [managingUsersTenant, setManagingUsersTenant] = useState<TenantRecord | null>(null);

  // In-flight action states
  const [syncingId, setSyncingId] = useState<string | null>(null);
  const [impersonatingId, setImpersonatingId] = useState<string | null>(null);
  const [bannerNotice, setBannerNotice] = useState<string | null>(null);

  const fetchTenants = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getTenants();
      setTenants(data);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch schools');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTenants();
  }, []);

  const handleSyncNow = async (tenantId: string) => {
    setSyncingId(tenantId);
    try {
      const res = await triggerTenantSync(tenantId);
      setBannerNotice(res.message || 'Google Sheet synchronization initiated successfully.');
      fetchTenants();
    } catch (err: any) {
      alert(`Sync failed: ${err.message}`);
    } finally {
      setSyncingId(null);
    }
  };

  const handleImpersonate = async (tenant: TenantRecord) => {
    setImpersonatingId(tenant.id);
    try {
      const res = await impersonateTenant(tenant.id);
      setBannerNotice(
        `Support Session: Now impersonating "${tenant.name}" as SCHOOL_ADMIN.`
      );
      if (onImpersonateSuccess) {
        onImpersonateSuccess(tenant.slug);
      }
    } catch (err: any) {
      alert(`Impersonation failed: ${err.message}`);
    } finally {
      setImpersonatingId(null);
    }
  };

  // Filtered list
  const filteredTenants = tenants.filter((t) => {
    const matchesSearch =
      t.name.toLowerCase().includes(search.toLowerCase()) ||
      t.slug.toLowerCase().includes(search.toLowerCase()) ||
      (t.dashboard_title && t.dashboard_title.toLowerCase().includes(search.toLowerCase()));

    const matchesStatus =
      statusFilter === 'ALL' ? true : t.status === statusFilter;

    return matchesSearch && matchesStatus;
  });

  // Analytics Metrics
  const totalSchools = tenants.length;
  const activeSchools = tenants.filter((t) => t.status === 'ACTIVE').length;
  const suspendedSchools = tenants.filter((t) => t.status === 'SUSPENDED').length;
  const totalUsersAcrossSchools = tenants.reduce((acc, t) => acc + (t.user_count || 0), 0);

  return (
    <div className="min-h-screen bg-[#F8FAFC] flex flex-col text-slate-900 font-sans antialiased">
      {/* Top Super Admin Navigation Header */}
      <header className="bg-slate-950/95 backdrop-blur-md text-white border-b border-slate-800/80 px-6 py-3.5 flex flex-wrap items-center justify-between gap-4 sticky top-0 z-30 shadow-lg shadow-black/5">
        <div className="flex items-center gap-3.5">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-600 via-indigo-500 to-purple-600 flex items-center justify-center text-white shadow-md shadow-indigo-900/30 ring-1 ring-white/20">
            <Shield className="w-5 h-5 text-white" />
          </div>
          <div>
            <div className="flex items-center gap-2.5">
              <h1 className="text-base font-bold tracking-tight text-white">Super Admin Console</h1>
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                Live Control Plane
              </span>
            </div>
            <p className="text-xs text-slate-400">Multi-Tenant Management & School Provisioning</p>
          </div>
        </div>

        {/* User Info & Logout */}
        <div className="flex items-center gap-4">
          <div className="text-end hidden sm:block">
            <p className="text-xs font-semibold text-slate-200">{currentUser.name}</p>
            <p className="text-[11px] text-slate-400 font-mono">{currentUser.email}</p>
          </div>
          <div className="h-7 w-px bg-slate-800 hidden sm:block" />
          <button
            onClick={onLogout}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white rounded-xl border border-slate-700/80 transition-all hover:border-slate-600 shadow-sm"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Sign Out</span>
          </button>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8 space-y-6">
        {/* Banner Alert Notice */}
        {bannerNotice && (
          <div className="p-3.5 px-4 text-xs bg-emerald-50/90 border border-emerald-200/80 text-emerald-900 rounded-2xl flex items-center justify-between shadow-xs animate-in fade-in slide-in-from-top-2">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span className="font-medium">{bannerNotice}</span>
            </div>
            <button
              onClick={() => setBannerNotice(null)}
              className="text-emerald-700 hover:text-emerald-900 p-1 rounded-lg hover:bg-emerald-100 transition"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Metric Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5">
          {/* Card 1: Total Schools */}
          <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-xs hover:shadow-md transition-all group">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                Total Schools
              </span>
              <div className="w-8 h-8 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center group-hover:scale-110 transition-transform">
                <Building2 className="w-4 h-4" />
              </div>
            </div>
            <p className="text-3xl font-extrabold text-slate-900 mt-2 tracking-tight">{totalSchools}</p>
            <p className="text-[11px] text-slate-500 mt-1 flex items-center gap-1">
              <span>Managed multi-tenant institutions</span>
            </p>
          </div>

          {/* Card 2: Active Portals */}
          <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-xs hover:shadow-md transition-all group">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-emerald-600 uppercase tracking-wider">
                Active Portals
              </span>
              <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center group-hover:scale-110 transition-transform">
                <CheckCircle2 className="w-4 h-4" />
              </div>
            </div>
            <p className="text-3xl font-extrabold text-emerald-700 mt-2 tracking-tight">{activeSchools}</p>
            <p className="text-[11px] text-emerald-600/80 mt-1">
              Online and serving traffic
            </p>
          </div>

          {/* Card 3: Suspended */}
          <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-xs hover:shadow-md transition-all group">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-amber-600 uppercase tracking-wider">
                Suspended
              </span>
              <div className="w-8 h-8 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center group-hover:scale-110 transition-transform">
                <AlertTriangle className="w-4 h-4" />
              </div>
            </div>
            <p className="text-3xl font-extrabold text-amber-700 mt-2 tracking-tight">{suspendedSchools}</p>
            <p className="text-[11px] text-amber-600/80 mt-1">
              Temporarily locked accounts
            </p>
          </div>

          {/* Card 4: Provisioned Users */}
          <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-xs hover:shadow-md transition-all group">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-indigo-600 uppercase tracking-wider">
                Provisioned Users
              </span>
              <div className="w-8 h-8 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center group-hover:scale-110 transition-transform">
                <Users className="w-4 h-4" />
              </div>
            </div>
            <p className="text-3xl font-extrabold text-indigo-700 mt-2 tracking-tight">
              {totalUsersAcrossSchools}
            </p>
            <p className="text-[11px] text-indigo-600/80 mt-1">
              Admins & counselors enrolled
            </p>
          </div>
        </div>

        {/* Action Controls & Filters Bar */}
        <div className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200/80 shadow-xs flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-3 flex-1 min-w-[280px]">
            {/* Search Input with Icon */}
            <div className="relative flex-1 max-w-md">
              <Search className="w-4 h-4 text-slate-400 absolute start-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search schools by name or slug..."
                className="w-full ps-10 pe-3.5 py-2.5 text-xs sm:text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 focus:outline-none transition-all"
              />
              {search && (
                <button
                  onClick={() => setSearch('')}
                  className="absolute end-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Segmented Filter Pills */}
            <div className="flex items-center bg-slate-100 p-1 rounded-xl text-xs border border-slate-200/60">
              {(['ALL', 'ACTIVE', 'SUSPENDED'] as const).map((s) => (
                <button
                  key={s}
                  onClick={() => setStatusFilter(s)}
                  className={`px-3 py-1.5 rounded-lg font-medium transition-all ${
                    statusFilter === s
                      ? 'bg-white text-slate-900 shadow-xs font-semibold'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {s === 'ALL' ? 'All Portals' : s === 'ACTIVE' ? 'Active' : 'Suspended'}
                </button>
              ))}
            </div>
          </div>

          {/* Primary Action Button */}
          <button
            onClick={() => setIsCreateOpen(true)}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-700 hover:to-blue-700 text-white text-xs sm:text-sm font-semibold rounded-xl shadow-md shadow-indigo-600/20 hover:shadow-lg hover:shadow-indigo-600/30 transition-all active:scale-[0.98]"
          >
            <Plus className="w-4 h-4 stroke-[2.5]" />
            <span>Provision New School</span>
          </button>
        </div>

        {/* Schools Table */}
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
          {loading ? (
            <div className="py-20 flex flex-col items-center justify-center gap-3">
              <RefreshCw className="w-6 h-6 text-indigo-600 animate-spin" />
              <p className="text-xs font-medium text-slate-500">Loading school tenants...</p>
            </div>
          ) : error ? (
            <div className="py-16 text-center text-xs sm:text-sm text-red-600 px-4">
              <AlertTriangle className="w-8 h-8 text-red-500 mx-auto mb-2" />
              <p className="font-semibold">{error}</p>
            </div>
          ) : filteredTenants.length === 0 ? (
            <div className="py-16 text-center px-4">
              <div className="w-14 h-14 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center mx-auto mb-3 shadow-xs">
                <Building2 className="w-7 h-7" />
              </div>
              <h3 className="text-base font-semibold text-slate-900">No schools found</h3>
              <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1">
                {search
                  ? 'No schools match your search query. Try clearing the search filter.'
                  : 'Zero schools are currently provisioned. Click "+ Provision New School" to create your first multi-tenant portal.'}
              </p>
              {!search && (
                <button
                  onClick={() => setIsCreateOpen(true)}
                  className="mt-4 inline-flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-xl shadow-sm transition"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Provision First School</span>
                </button>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-start text-xs">
                <thead>
                  <tr className="bg-slate-50/80 border-b border-slate-200/80 text-slate-500 font-semibold uppercase tracking-wider text-[11px]">
                    <th className="py-3.5 px-5 text-start">School & Subdomain</th>
                    <th className="py-3.5 px-4 text-start">White-Label Branding</th>
                    <th className="py-3.5 px-4 text-start">Google Sheet & Mode</th>
                    <th className="py-3.5 px-4 text-start">Sync Health</th>
                    <th className="py-3.5 px-4 text-start">License & Plan</th>
                    <th className="py-3.5 px-4 text-start">Status</th>
                    <th className="py-3.5 px-5 text-end">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  {filteredTenants.map((t) => (
                    <tr key={t.id} className="hover:bg-slate-50/70 transition-colors group">
                      {/* Name & Slug */}
                      <td className="py-4 px-5">
                        <div className="flex items-center gap-3">
                          {t.logo_url ? (
                            <img
                              src={t.logo_url}
                              alt={t.name}
                              className="w-9 h-9 rounded-xl object-contain border border-slate-200/80 bg-white p-1 shrink-0"
                            />
                          ) : (
                            <div
                              className="w-9 h-9 rounded-xl flex items-center justify-center font-bold text-white text-sm shrink-0 shadow-xs"
                              style={{ backgroundColor: t.primary_color || '#4338CA' }}
                            >
                              {t.name.charAt(0)}
                            </div>
                          )}
                          <div>
                            <div className="font-semibold text-slate-900 text-sm">{t.name}</div>
                            <div className="flex items-center gap-1.5 mt-0.5">
                              <code className="text-[11px] font-mono text-indigo-700 bg-indigo-50/80 px-1.5 py-0.5 rounded border border-indigo-100 flex items-center gap-1">
                                <Globe className="w-2.5 h-2.5" />
                                {t.slug}.yourplatform.com
                              </code>
                              <span className="text-[10px] text-slate-400 flex items-center gap-0.5">
                                <Clock className="w-2.5 h-2.5" />
                                {t.timezone}
                              </span>
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* White-Labeling */}
                      <td className="py-4 px-4">
                        <div className="flex items-center gap-2">
                          <span
                            className="w-4 h-4 rounded-full border border-black/10 shrink-0 shadow-xs"
                            style={{ backgroundColor: t.primary_color || '#1E3A8A' }}
                            title={t.primary_color}
                          />
                          <span className="font-medium text-slate-800 truncate max-w-[150px]">
                            {t.dashboard_title}
                          </span>
                        </div>
                        {t.logo_url ? (
                          <span className="text-[10px] text-emerald-600 font-medium block mt-1">
                            ✓ Custom logo active
                          </span>
                        ) : (
                          <span className="text-[10px] text-slate-400 block mt-1">
                            Default monogram
                          </span>
                        )}
                      </td>

                      {/* Sheet ID & Mode */}
                      <td className="py-4 px-4">
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md font-mono text-[10px] font-semibold ${
                            t.data_mode === 'HYBRID_SHEET'
                              ? 'bg-emerald-50 text-emerald-800 border border-emerald-200/60'
                              : 'bg-slate-100 text-slate-700 border border-slate-200/60'
                          }`}
                        >
                          <FileSpreadsheet className="w-3 h-3" />
                          {t.data_mode}
                        </span>
                        {t.google_sheet_id && (
                          <div
                            className="text-[10px] font-mono text-slate-500 truncate max-w-[130px] mt-1"
                            title={t.google_sheet_id}
                          >
                            ID: {t.google_sheet_id}
                          </div>
                        )}
                      </td>

                      {/* Sync Health */}
                      <td className="py-4 px-4">
                        {t.last_synced_at ? (
                          <div>
                            <span className="inline-flex items-center gap-1.5 text-[11px] text-emerald-700 font-medium">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                              {new Date(t.last_synced_at).toLocaleDateString([], {
                                month: 'short',
                                day: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit',
                              })}
                            </span>
                          </div>
                        ) : (
                          <span className="text-slate-400 text-[11px] italic">Never synced</span>
                        )}
                        {t.last_sync_error && (
                          <div
                            className="text-[10px] text-red-600 truncate max-w-[120px] mt-0.5 font-medium"
                            title={t.last_sync_error}
                          >
                            ⚠ {t.last_sync_error}
                          </div>
                        )}
                      </td>

                      {/* License */}
                      <td className="py-4 px-4">
                        <div className="inline-block px-2 py-0.5 rounded-md text-[10px] font-semibold bg-slate-100 text-slate-800 border border-slate-200/60">
                          {t.plan_type}
                        </div>
                        {t.renewal_date && (
                          <div className="text-[10px] text-slate-400 mt-1 flex items-center gap-1">
                            <Calendar className="w-2.5 h-2.5" />
                            {new Date(t.renewal_date).toLocaleDateString()}
                          </div>
                        )}
                      </td>

                      {/* Status */}
                      <td className="py-4 px-4">
                        <span
                          className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold ${
                            t.status === 'ACTIVE'
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              : 'bg-amber-50 text-amber-700 border border-amber-200'
                          }`}
                        >
                          <span
                            className={`w-1.5 h-1.5 rounded-full ${
                              t.status === 'ACTIVE' ? 'bg-emerald-500' : 'bg-amber-500'
                            }`}
                          />
                          {t.status}
                        </span>
                      </td>

                      {/* Actions */}
                      <td className="py-4 px-5 text-end">
                        <div className="flex items-center justify-end gap-1.5">
                          {/* Sync Button */}
                          {t.data_mode === 'HYBRID_SHEET' && (
                            <button
                              onClick={() => handleSyncNow(t.id)}
                              disabled={syncingId === t.id}
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 text-[11px] bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl transition font-medium disabled:opacity-50"
                              title="Trigger immediate Google Sheet sync"
                            >
                              <RefreshCw
                                className={`w-3 h-3 ${syncingId === t.id ? 'animate-spin text-indigo-600' : ''}`}
                              />
                              <span>{syncingId === t.id ? 'Syncing...' : 'Sync'}</span>
                            </button>
                          )}

                          {/* Users Button */}
                          <button
                            onClick={() => setManagingUsersTenant(t)}
                            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-[11px] bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-xl transition font-medium border border-indigo-200/60"
                          >
                            <Users className="w-3 h-3" />
                            <span>Users ({t.user_count || 0})</span>
                          </button>

                          {/* Edit Button */}
                          <button
                            onClick={() => setEditingTenant(t)}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 text-[11px] bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl transition font-medium"
                          >
                            <SlidersHorizontal className="w-3 h-3" />
                            <span>Edit</span>
                          </button>

                          {/* Impersonation: Login as School */}
                          <button
                            onClick={() => handleImpersonate(t)}
                            disabled={impersonatingId === t.id || t.status !== 'ACTIVE'}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-[11px] bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white rounded-xl transition font-semibold shadow-xs disabled:opacity-50 active:scale-95"
                            title="One-click support impersonation into this school's portal"
                          >
                            <ShieldAlert className="w-3 h-3" />
                            <span>{impersonatingId === t.id ? 'Loading...' : 'Login as School'}</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>

      {/* Modals */}
      <CreateTenantModal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        onCreated={(newTenant) => {
          setTenants([newTenant, ...tenants]);
          setBannerNotice(`School tenant "${newTenant.name}" provisioned successfully!`);
        }}
      />

      {editingTenant && (
        <EditTenantModal
          tenant={editingTenant}
          isOpen={true}
          onClose={() => setEditingTenant(null)}
          onUpdated={(updated) => {
            setTenants(tenants.map((t) => (t.id === updated.id ? { ...t, ...updated } : t)));
            setBannerNotice(`School tenant "${updated.name}" updated successfully!`);
          }}
        />
      )}

      {managingUsersTenant && (
        <TenantUsersModal
          tenant={managingUsersTenant}
          isOpen={true}
          onClose={() => setManagingUsersTenant(null)}
          onUserCountChanged={fetchTenants}
        />
      )}
    </div>
  );
}
