'use client';

import { useEffect, useState } from 'react';
import {
  getSuperAdminTenants,
  syncTenantNow,
  impersonateTenant,
  logout,
} from '../../lib/api';
import { TenantRecord, AuthUser } from '../../types';
import CreateTenantModal from './CreateTenantModal';
import EditTenantModal from './EditTenantModal';
import TenantUsersModal from './TenantUsersModal';

interface Props {
  currentUser: AuthUser;
  onLogout: () => void;
  onImpersonateSuccess?: (tenantSlug: string) => void;
}

export default function SuperAdminDashboard({
  currentUser,
  onLogout,
  onImpersonateSuccess,
}: Props) {
  const [tenants, setTenants] = useState<TenantRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Search & filter
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'ACTIVE' | 'SUSPENDED'>('ALL');

  // Modal states
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingTenant, setEditingTenant] = useState<TenantRecord | null>(null);
  const [managingUsersTenant, setManagingUsersTenant] = useState<TenantRecord | null>(null);

  // Action feedback states
  const [syncingId, setSyncingId] = useState<string | null>(null);
  const [impersonatingId, setImpersonatingId] = useState<string | null>(null);
  const [bannerNotice, setBannerNotice] = useState<string | null>(null);

  const fetchTenants = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getSuperAdminTenants();
      setTenants(data);
    } catch (err: any) {
      setError(err.message || 'Failed to load school tenants');
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
      const res = await syncTenantNow(tenantId);
      setTenants(
        tenants.map((t) =>
          t.id === tenantId
            ? { ...t, last_synced_at: res.lastSyncedAt, last_sync_error: null }
            : t
        )
      );
      setBannerNotice(`Google Sheet sync triggered successfully for ${tenantId}`);
      setTimeout(() => setBannerNotice(null), 4000);
    } catch (err: any) {
      alert(err.message || 'Sync failed');
    } finally {
      setSyncingId(null);
    }
  };

  const handleImpersonate = async (tenant: TenantRecord) => {
    if (tenant.status !== 'ACTIVE') {
      alert('Cannot impersonate a suspended school tenant');
      return;
    }
    setImpersonatingId(tenant.id);
    try {
      const res = await impersonateTenant(tenant.id);
      if (onImpersonateSuccess) {
        onImpersonateSuccess(res.tenant.slug);
      } else {
        window.location.href = `/?subdomain=${res.tenant.slug}`;
      }
    } catch (err: any) {
      alert(err.message || 'Impersonation failed');
      setImpersonatingId(null);
    }
  };

  // Filtered tenants
  const filteredTenants = tenants.filter((t) => {
    const matchesSearch =
      t.name.toLowerCase().includes(search.toLowerCase()) ||
      t.slug.toLowerCase().includes(search.toLowerCase()) ||
      t.dashboard_title.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = statusFilter === 'ALL' || t.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const totalSchools = tenants.length;
  const activeSchools = tenants.filter((t) => t.status === 'ACTIVE').length;
  const suspendedSchools = tenants.filter((t) => t.status === 'SUSPENDED').length;
  const totalUsersAcrossSchools = tenants.reduce((acc, t) => acc + (t.user_count || 0), 0);

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col text-slate-900">
      {/* Top Super Admin Navigation Header */}
      <header className="bg-slate-900 text-white border-b border-slate-800 px-6 py-3.5 flex flex-wrap items-center justify-between gap-4 sticky top-0 z-30 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-purple-600 flex items-center justify-center font-bold text-white text-base shadow">
            SA
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-base font-bold tracking-tight">Super Admin Console</h1>
              <span className="text-[10px] font-mono uppercase bg-purple-900/60 text-purple-300 px-2 py-0.5 rounded border border-purple-700/50">
                Milestone 2
              </span>
            </div>
            <p className="text-xs text-slate-400">Multi-Tenant Management & Dynamic User Provisioning</p>
          </div>
        </div>

        {/* User Info & Logout */}
        <div className="flex items-center gap-3">
          <div className="text-end hidden sm:block">
            <p className="text-xs font-semibold text-slate-200">{currentUser.name}</p>
            <p className="text-[11px] text-slate-400 font-mono">{currentUser.email}</p>
          </div>
          <button
            onClick={onLogout}
            className="px-3 py-1.5 text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg border border-slate-700 transition"
          >
            Sign Out
          </button>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 space-y-6">
        {bannerNotice && (
          <div className="p-3 text-xs bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl flex items-center justify-between animate-in fade-in">
            <span>✓ {bannerNotice}</span>
            <button onClick={() => setBannerNotice(null)} className="text-emerald-700 font-bold">
              ✕
            </button>
          </div>
        )}

        {/* Metric Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-sm">
            <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">Total Schools</p>
            <p className="text-2xl font-bold text-slate-900 mt-1">{totalSchools}</p>
          </div>
          <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-sm">
            <p className="text-xs font-medium text-emerald-600 uppercase tracking-wider">Active Portals</p>
            <p className="text-2xl font-bold text-emerald-700 mt-1">{activeSchools}</p>
          </div>
          <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-sm">
            <p className="text-xs font-medium text-amber-600 uppercase tracking-wider">Suspended</p>
            <p className="text-2xl font-bold text-amber-700 mt-1">{suspendedSchools}</p>
          </div>
          <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-sm">
            <p className="text-xs font-medium text-blue-600 uppercase tracking-wider">Provisioned Users</p>
            <p className="text-2xl font-bold text-blue-700 mt-1">{totalUsersAcrossSchools}</p>
          </div>
        </div>

        {/* Action Controls & Filters */}
        <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-sm flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-3 flex-1 min-w-[280px]">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search schools by name or slug..."
              className="px-3.5 py-2 text-sm border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none flex-1 max-w-md"
            />
            <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl text-xs">
              {(['ALL', 'ACTIVE', 'SUSPENDED'] as const).map((s) => (
                <button
                  key={s}
                  onClick={() => setStatusFilter(s)}
                  className={`px-3 py-1.5 rounded-lg font-medium transition ${
                    statusFilter === s
                      ? 'bg-white text-slate-900 shadow-xs font-semibold'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>

          <button
            onClick={() => setIsCreateOpen(true)}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-xl shadow-sm transition flex items-center gap-1.5"
          >
            <span>+</span> Provision New School
          </button>
        </div>

        {/* Schools Table */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          {loading ? (
            <div className="py-16 text-center text-sm text-slate-400">Loading school tenants...</div>
          ) : error ? (
            <div className="py-12 text-center text-sm text-red-600">{error}</div>
          ) : filteredTenants.length === 0 ? (
            <div className="py-16 text-center px-4">
              <div className="w-12 h-12 bg-slate-100 rounded-2xl flex items-center justify-center mx-auto mb-3 text-slate-400 font-bold text-xl">
                🏫
              </div>
              <h3 className="text-base font-semibold text-slate-900">No schools found</h3>
              <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1">
                {search
                  ? 'No schools match your search query.'
                  : 'Zero schools are currently provisioned. Click "+ Provision New School" to create your first school tenant.'}
              </p>
              {!search && (
                <button
                  onClick={() => setIsCreateOpen(true)}
                  className="mt-4 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-xl transition"
                >
                  + Provision First School
                </button>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-start text-xs">
                <thead>
                  <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-500 font-semibold uppercase tracking-wider text-[11px]">
                    <th className="py-3 px-4 text-start">School & Subdomain</th>
                    <th className="py-3 px-4 text-start">White-Label Branding</th>
                    <th className="py-3 px-4 text-start">Google Sheet & Mode</th>
                    <th className="py-3 px-4 text-start">Sync Health</th>
                    <th className="py-3 px-4 text-start">License & Plan</th>
                    <th className="py-3 px-4 text-start">Status</th>
                    <th className="py-3 px-4 text-end">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  {filteredTenants.map((t) => (
                    <tr key={t.id} className="hover:bg-slate-50/60 transition">
                      {/* Name & Slug */}
                      <td className="py-3.5 px-4">
                        <div className="font-semibold text-slate-900 text-sm">{t.name}</div>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <code className="text-[11px] font-mono text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded">
                            {t.slug}.yourplatform.com
                          </code>
                          <span className="text-[10px] text-slate-400">· {t.timezone}</span>
                        </div>
                      </td>

                      {/* White-Labeling */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-2">
                          <span
                            className="w-4 h-4 rounded-full border border-black/10 shrink-0"
                            style={{ backgroundColor: t.primary_color || '#1E3A8A' }}
                          />
                          <span className="font-medium text-slate-800 truncate max-w-[150px]">
                            {t.dashboard_title}
                          </span>
                        </div>
                        {t.logo_url && (
                          <span className="text-[10px] text-slate-400 block mt-0.5 truncate max-w-[160px]">
                            Logo configured
                          </span>
                        )}
                      </td>

                      {/* Sheet ID & Mode */}
                      <td className="py-3.5 px-4">
                        <span
                          className={`inline-block px-1.5 py-0.5 rounded font-mono text-[10px] font-semibold ${
                            t.data_mode === 'HYBRID_SHEET'
                              ? 'bg-emerald-50 text-emerald-800'
                              : 'bg-slate-100 text-slate-700'
                          }`}
                        >
                          {t.data_mode}
                        </span>
                        {t.google_sheet_id && (
                          <div className="text-[10px] font-mono text-slate-500 truncate max-w-[140px] mt-0.5">
                            ID: {t.google_sheet_id}
                          </div>
                        )}
                      </td>

                      {/* Sync Health */}
                      <td className="py-3.5 px-4">
                        {t.last_synced_at ? (
                          <div>
                            <span className="inline-flex items-center gap-1 text-[11px] text-emerald-700 font-medium">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                              {new Date(t.last_synced_at).toLocaleDateString([], {
                                month: 'short',
                                day: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit',
                              })}
                            </span>
                          </div>
                        ) : (
                          <span className="text-slate-400 text-[11px]">Never synced</span>
                        )}
                        {t.last_sync_error && (
                          <div className="text-[10px] text-red-600 truncate max-w-[120px]">
                            Error: {t.last_sync_error}
                          </div>
                        )}
                      </td>

                      {/* License */}
                      <td className="py-3.5 px-4">
                        <div className="font-medium text-slate-800">{t.plan_type}</div>
                        {t.renewal_date && (
                          <div className="text-[10px] text-slate-400 mt-0.5">
                            Renews: {new Date(t.renewal_date).toLocaleDateString()}
                          </div>
                        )}
                      </td>

                      {/* Status */}
                      <td className="py-3.5 px-4">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            t.status === 'ACTIVE'
                              ? 'bg-emerald-100 text-emerald-800'
                              : 'bg-amber-100 text-amber-800'
                          }`}
                        >
                          {t.status}
                        </span>
                      </td>

                      {/* Actions */}
                      <td className="py-3.5 px-4 text-end">
                        <div className="flex items-center justify-end gap-1.5">
                          {t.data_mode === 'HYBRID_SHEET' && (
                            <button
                              onClick={() => handleSyncNow(t.id)}
                              disabled={syncingId === t.id}
                              className="px-2.5 py-1 text-[11px] bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg transition font-medium"
                              title="Trigger immediate Google Sheet sync"
                            >
                              {syncingId === t.id ? 'Syncing...' : 'Sync'}
                            </button>
                          )}

                          <button
                            onClick={() => setManagingUsersTenant(t)}
                            className="px-2.5 py-1 text-[11px] bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-lg transition font-medium flex items-center gap-1"
                          >
                            Users ({t.user_count || 0})
                          </button>

                          <button
                            onClick={() => setEditingTenant(t)}
                            className="px-2.5 py-1 text-[11px] bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg transition font-medium"
                          >
                            Edit
                          </button>

                          <button
                            onClick={() => handleImpersonate(t)}
                            disabled={impersonatingId === t.id || t.status !== 'ACTIVE'}
                            className="px-2.5 py-1 text-[11px] bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition font-semibold disabled:opacity-50"
                            title="One-click support impersonation"
                          >
                            {impersonatingId === t.id ? 'Loading...' : 'Login as School'}
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
