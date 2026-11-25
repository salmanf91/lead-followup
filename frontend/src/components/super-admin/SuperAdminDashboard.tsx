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
  Edit3,
  ExternalLink,
  CheckCircle2,
  AlertTriangle,
  Globe,
  Clock,
  Calendar,
  LogOut,
  X,
  FileSpreadsheet,
  Layers,
  Sparkles,
  ArrowUpRight,
} from 'lucide-react';
import { getTenants, triggerTenantSync, impersonateTenant } from '../../lib/api';
import { TenantRecord, AuthUser } from '../../types';
import CreateTenantModal from './CreateTenantModal';
import EditTenantModal from './EditTenantModal';
import TenantUsersModal from './TenantUsersModal';
import ChilliPagesLogo from '../common/ChilliPagesLogo';
import GoogleSheetNoticeBoard from '../common/GoogleSheetNoticeBoard';

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
      await impersonateTenant(tenant.id);
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

  // Aggregated platform stats
  const totalSchools = tenants.length;
  const activeSchools = tenants.filter((t) => t.status === 'ACTIVE').length;
  const hybridSyncSchools = tenants.filter((t) => t.data_mode === 'HYBRID_SHEET').length;
  const totalUsersAcrossSchools = tenants.reduce((acc, t) => acc + (t.user_count || 0), 0);
  const totalLeadsAcrossSchools = tenants.reduce((acc, t) => acc + (t.lead_count || 0), 0);

  // Helper to format subdomain URL based on current host
  const getSubdomainUrl = (slug: string) => {
    if (typeof window === 'undefined') return `http://${slug}.yourplatform.com`;
    const host = window.location.host;
    const protocol = window.location.protocol;
    // If accessing via sslip.io or IP
    if (host.includes('.sslip.io')) {
      const baseDomain = host.replace(/^[a-z0-9-]+\./i, '');
      return `${protocol}//${slug}.${baseDomain}`;
    }
    // If localhost
    if (host.includes('localhost')) {
      return `${protocol}//${slug}.localhost:3000`;
    }
    return `${protocol}//${slug}.${host}`;
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-slate-900 font-sans antialiased flex flex-col">
      {/* 1. Bespoke Header */}
      <header className="bg-white/90 backdrop-blur-md border-b border-slate-200/90 px-4 sm:px-8 py-3.5 sticky top-0 z-30 shadow-xs flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2.5">
            <ChilliPagesLogo height={26} className="h-6 w-auto" />
            <span className="hidden sm:inline-block w-px h-5 bg-slate-200" />
            <div className="hidden sm:block">
              <span className="text-xs font-bold uppercase tracking-wider text-[#10457C]">
                Admissions Cloud
              </span>
              <span className="text-[10px] text-slate-400 block -mt-0.5">Super Admin Console</span>
            </div>
          </div>
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-[#F0F5FA] text-[#10457C] border border-[#10457C]/15">
            <Shield className="w-3 h-3 text-[#DA2C38]" />
            Enterprise Multi-Tenant
          </span>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={fetchTenants}
            className="p-2 text-slate-500 hover:text-[#10457C] hover:bg-[#F0F5FA] rounded-xl transition"
            title="Refresh tenants"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-[#10457C]' : ''}`} />
          </button>

          <div className="flex items-center gap-2.5 bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-xl">
            <div className="w-6 h-6 rounded-lg bg-[#10457C] text-white font-bold text-xs flex items-center justify-center shadow-xs">
              {currentUser.name.charAt(0)}
            </div>
            <div className="text-start hidden sm:block">
              <p className="text-xs font-bold text-slate-900 leading-tight">{currentUser.name}</p>
              <p className="text-[10px] text-[#DA2C38] font-bold leading-none uppercase tracking-wider">
                Root Super Admin
              </p>
            </div>
          </div>

          <button
            onClick={onLogout}
            className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition"
            title="Sign Out"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* 2. Main Content Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-8 space-y-6">
        {/* Banner Notification */}
        {bannerNotice && (
          <div className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-2xl flex items-center justify-between text-xs font-semibold shadow-xs animate-in fade-in">
            <div className="flex items-center gap-2.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>{bannerNotice}</span>
            </div>
            <button
              onClick={() => setBannerNotice(null)}
              className="text-emerald-700 hover:text-emerald-900 p-1"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Hero Card Banner */}
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#0A2B4E] via-[#10457C] to-[#0D3763] text-white p-6 sm:p-8 shadow-bespoke">
          <div className="absolute end-0 top-0 -translate-y-12 translate-x-12 w-96 h-96 bg-[#DA2C38]/15 rounded-full blur-3xl pointer-events-none" />
          <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="space-y-2">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/10 backdrop-blur-md text-xs font-medium text-white/90 border border-white/15">
                <Sparkles className="w-3.5 h-3.5 text-[#DA2C38]" />
                <span>Unified Multi-Tenant School Infrastructure</span>
              </div>
              <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
                School Portals & Campaign Directory
              </h2>
              <p className="text-white/80 text-xs sm:text-sm max-w-xl leading-relaxed">
                Configure silent white-label branding, manage counselor teams, monitor live Google Sheets sync pipelines, and launch instant one-click support sessions.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <button
                onClick={() => setIsCreateOpen(true)}
                className="inline-flex items-center gap-2 px-5 py-3 rounded-2xl bg-white text-[#10457C] hover:bg-[#F0F5FA] font-bold text-xs sm:text-sm transition-all shadow-lg shadow-black/20 hover:scale-[1.02] active:scale-[0.98]"
              >
                <Plus className="w-4 h-4 text-[#DA2C38] stroke-[3]" />
                <span>Provision New School</span>
              </button>
            </div>
          </div>
        </div>

        {/* 3. Metric KPI Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Card 1: Total Schools */}
          <div className="bg-white rounded-2xl p-5 border border-slate-200/90 shadow-bespoke hover:shadow-bespoke-hover transition-all">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-[#10457C]">
                Total Schools
              </span>
              <div className="w-8 h-8 rounded-xl bg-[#F0F5FA] text-[#10457C] flex items-center justify-center">
                <Building2 className="w-4 h-4" />
              </div>
            </div>
            <p className="text-3xl font-black text-slate-900 mt-2">{totalSchools}</p>
            <p className="text-[11px] text-slate-500 mt-0.5">Provisioned tenant portals</p>
          </div>

          {/* Card 2: Active Portals */}
          <div className="bg-white rounded-2xl p-5 border border-slate-200/90 shadow-bespoke hover:shadow-bespoke-hover transition-all">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-700">
                Active Portals
              </span>
              <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                <CheckCircle2 className="w-4 h-4" />
              </div>
            </div>
            <p className="text-3xl font-black text-emerald-700 mt-2">{activeSchools}</p>
            <p className="text-[11px] text-emerald-600/80 mt-0.5">Live admissions portals</p>
          </div>

          {/* Card 3: Google Sheets Sync */}
          <div className="bg-white rounded-2xl p-5 border border-slate-200/90 shadow-bespoke hover:shadow-bespoke-hover transition-all">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-sky-700">
                Sync Pipelines
              </span>
              <div className="w-8 h-8 rounded-xl bg-sky-50 text-sky-600 flex items-center justify-center">
                <FileSpreadsheet className="w-4 h-4" />
              </div>
            </div>
            <p className="text-3xl font-black text-sky-700 mt-2">{hybridSyncSchools}</p>
            <p className="text-[11px] text-sky-600/80 mt-0.5">Active Google Sheet bridges</p>
          </div>

          {/* Card 4: Total Users */}
          <div className="bg-white rounded-2xl p-5 border border-slate-200/90 shadow-bespoke hover:shadow-bespoke-hover transition-all">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-[#DA2C38]">
                Team Accounts
              </span>
              <div className="w-8 h-8 rounded-xl bg-[#FDF2F3] text-[#DA2C38] flex items-center justify-center">
                <Users className="w-4 h-4" />
              </div>
            </div>
            <p className="text-3xl font-black text-[#DA2C38] mt-2">{totalUsersAcrossSchools}</p>
            <p className="text-[11px] text-slate-500 mt-0.5">Counselors & school admins</p>
          </div>
        </div>

        {/* 3b. Google Sheets Pipeline Notice Board for Super Admin */}
        <GoogleSheetNoticeBoard variant="banner" defaultOpen={true} />

        {/* 4. Filter & Search Bar */}
        <div className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200/90 shadow-bespoke flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-3 flex-1 min-w-[280px]">
            {/* Search Input */}
            <div className="relative flex-1 max-w-md">
              <Search className="w-4 h-4 text-slate-400 absolute start-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search school by name, slug or title..."
                className="w-full ps-10 pe-9 py-2.5 text-xs sm:text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-[#10457C]/20 focus:border-[#10457C] focus:outline-none transition-all"
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
                  className={`px-3 py-1.5 rounded-lg font-semibold transition-all ${
                    statusFilter === s
                      ? 'bg-white text-[#10457C] shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {s === 'ALL' ? 'All Schools' : s === 'ACTIVE' ? 'Active' : 'Suspended'}
                </button>
              ))}
            </div>
          </div>

          <div className="text-xs text-slate-500 font-medium">
            Showing <strong className="text-slate-900">{filteredTenants.length}</strong> of{' '}
            <strong className="text-slate-900">{tenants.length}</strong> schools
          </div>
        </div>

        {/* 5. Bespoke School Card Grid (Replacing DataTable) */}
        {loading ? (
          <div className="py-24 flex flex-col items-center justify-center gap-3">
            <RefreshCw className="w-8 h-8 text-[#10457C] animate-spin" />
            <p className="text-xs font-semibold text-slate-500">Loading school directory...</p>
          </div>
        ) : error ? (
          <div className="p-8 bg-rose-50 border border-rose-200 rounded-2xl text-center text-rose-700 text-sm">
            <AlertTriangle className="w-6 h-6 mx-auto mb-2 text-rose-600" />
            <p className="font-semibold">{error}</p>
          </div>
        ) : filteredTenants.length === 0 ? (
          <div className="bg-white rounded-3xl border border-slate-200 p-12 text-center shadow-bespoke">
            <div className="w-16 h-16 bg-[#F0F5FA] text-[#10457C] rounded-2xl flex items-center justify-center mx-auto mb-4">
              <Building2 className="w-8 h-8" />
            </div>
            <h3 className="text-base font-bold text-slate-900">No schools found</h3>
            <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1 leading-relaxed">
              {search
                ? 'No schools match your search query. Try clearing the filter.'
                : 'Zero schools are provisioned yet. Click "+ Provision New School" to create your first multi-tenant school portal.'}
            </p>
            {!search && (
              <button
                onClick={() => setIsCreateOpen(true)}
                className="mt-4 inline-flex items-center gap-1.5 px-4 py-2 bg-[#10457C] hover:bg-[#0A2B4E] text-white text-xs font-bold rounded-xl shadow-sm transition"
              >
                <Plus className="w-4 h-4 text-[#DA2C38]" />
                <span>Provision First School</span>
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
            {filteredTenants.map((t) => {
              const subdomainUrl = getSubdomainUrl(t.slug);
              const brandColor = t.primary_color || '#10457C';

              return (
                <div
                  key={t.id}
                  className="bg-white rounded-3xl border border-slate-200/90 shadow-bespoke hover:shadow-bespoke-hover hover:-translate-y-1 transition-all duration-300 flex flex-col justify-between overflow-hidden group"
                >
                  {/* Top Bar of Card */}
                  <div className="p-6 space-y-4">
                    {/* Header: School Logo & Title */}
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                        {t.logo_url ? (
                          <img
                            src={t.logo_url}
                            alt={t.name}
                            className="w-12 h-12 rounded-2xl object-contain border border-slate-200/80 bg-white p-1.5 shadow-xs shrink-0"
                          />
                        ) : (
                          <div
                            className="w-12 h-12 rounded-2xl flex items-center justify-center font-black text-white text-lg shrink-0 shadow-sm"
                            style={{ backgroundColor: brandColor }}
                          >
                            {t.name.charAt(0)}
                          </div>
                        )}
                        <div className="min-w-0">
                          <h3 className="font-extrabold text-slate-900 text-base leading-tight truncate group-hover:text-[#10457C] transition-colors" title={t.name}>
                            {t.name}
                          </h3>
                          <p className="text-xs text-slate-500 truncate mt-0.5" title={t.dashboard_title}>
                            {t.dashboard_title || 'Admissions Follow-Up'}
                          </p>
                        </div>
                      </div>

                      {/* Status Badge */}
                      <span
                        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold shrink-0 ${
                          t.status === 'ACTIVE'
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : 'bg-amber-50 text-amber-700 border border-amber-200'
                        }`}
                      >
                        <span
                          className={`w-1.5 h-1.5 rounded-full ${
                            t.status === 'ACTIVE' ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'
                          }`}
                        />
                        {t.status}
                      </span>
                    </div>

                    {/* Subdomain Link Pill */}
                    <div className="flex items-center justify-between bg-slate-50 border border-slate-200/80 rounded-xl px-3 py-2 text-xs">
                      <div className="flex items-center gap-1.5 min-w-0 font-mono text-slate-600 truncate">
                        <Globe className="w-3.5 h-3.5 text-[#10457C] shrink-0" />
                        <span className="font-semibold text-slate-900">{t.slug}</span>
                        <span className="text-slate-400">.portal</span>
                      </div>
                      <a
                        href={subdomainUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-[11px] font-bold text-[#10457C] hover:text-[#0A2B4E] transition hover:underline shrink-0"
                        title="Open school portal in new tab"
                      >
                        <span>Open</span>
                        <ArrowUpRight className="w-3.5 h-3.5" />
                      </a>
                    </div>

                    {/* 3 Metric Summary Boxes */}
                    <div className="grid grid-cols-3 gap-2 pt-1 text-center">
                      <div className="bg-[#F0F5FA] border border-[#10457C]/10 rounded-2xl p-2.5">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">
                          Leads
                        </span>
                        <span className="text-lg font-black text-[#10457C]">
                          {t.lead_count || 0}
                        </span>
                      </div>
                      <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-2.5">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">
                          Campaigns
                        </span>
                        <span className="text-lg font-black text-slate-800">
                          {t.campaign_count || 0}
                        </span>
                      </div>
                      <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-2.5">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">
                          Team
                        </span>
                        <span className="text-lg font-black text-slate-800">
                          {t.user_count || 0}
                        </span>
                      </div>
                    </div>

                    {/* Integration & Health Details */}
                    <div className="space-y-2 pt-1 text-xs border-t border-slate-100">
                      {/* Google Sheet Sync Health */}
                      <div className="flex items-center justify-between">
                        <span className="text-slate-500 font-medium flex items-center gap-1.5">
                          <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
                          <span>Google Sheet Sync</span>
                        </span>
                        {t.last_synced_at ? (
                          <span className="text-[11px] font-semibold text-emerald-700 flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                            {new Date(t.last_synced_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        ) : (
                          <span className="text-[11px] text-slate-400 italic">Not synced yet</span>
                        )}
                      </div>

                      {t.last_sync_error && (
                        <div className="text-[10px] text-rose-700 bg-rose-50 border border-rose-200 rounded-lg p-2 font-medium">
                          ⚠ Sync Warning: {t.last_sync_error}
                        </div>
                      )}

                      {/* Brand Primary Color Swatch */}
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="text-slate-500 font-medium">Brand Color</span>
                        <div className="flex items-center gap-1.5">
                          <span
                            className="w-3.5 h-3.5 rounded-full border border-black/10 shadow-xs"
                            style={{ backgroundColor: brandColor }}
                          />
                          <code className="text-slate-600 font-mono text-[10px]">{brandColor}</code>
                        </div>
                      </div>

                      {/* License Plan & Renewal */}
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="text-slate-500 font-medium">Subscription</span>
                        <div className="flex items-center gap-1.5">
                          <span className="px-2 py-0.5 rounded-md font-bold text-[10px] bg-slate-100 text-slate-700">
                            {t.plan_type}
                          </span>
                          {t.renewal_date && (
                            <span className="text-slate-400 text-[10px]">
                              Renews {new Date(t.renewal_date).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Card Action Footer */}
                  <div className="p-4 bg-slate-50/70 border-t border-slate-200/80 flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5">
                      {/* Sync Button */}
                      {t.data_mode === 'HYBRID_SHEET' && (
                        <button
                          onClick={() => handleSyncNow(t.id)}
                          disabled={syncingId === t.id}
                          className="p-2 text-slate-600 hover:text-[#10457C] hover:bg-white rounded-xl border border-transparent hover:border-slate-200 transition disabled:opacity-50 shadow-2xs"
                          title="Trigger immediate Google Sheet sync"
                        >
                          <RefreshCw className={`w-3.5 h-3.5 ${syncingId === t.id ? 'animate-spin text-[#10457C]' : ''}`} />
                        </button>
                      )}

                      {/* Manage Team Users Button */}
                      <button
                        onClick={() => setManagingUsersTenant(t)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-slate-700 hover:text-[#10457C] bg-white hover:bg-[#F0F5FA] rounded-xl border border-slate-200 shadow-2xs transition"
                        title="Manage school counselor accounts"
                      >
                        <Users className="w-3.5 h-3.5 text-[#10457C]" />
                        <span>Users ({t.user_count || 0})</span>
                      </button>

                      {/* Settings Edit Button */}
                      <button
                        onClick={() => setEditingTenant(t)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-slate-700 hover:text-[#10457C] bg-white hover:bg-[#F0F5FA] rounded-xl border border-slate-200 shadow-2xs transition"
                        title="Edit school settings & white-labeling"
                      >
                        <Edit3 className="w-3.5 h-3.5 text-[#10457C]" />
                        <span>EDIT</span>
                      </button>
                    </div>

                    {/* Support Impersonation Action */}
                    <button
                      onClick={() => handleImpersonate(t)}
                      disabled={impersonatingId === t.id || t.status !== 'ACTIVE'}
                      className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-bold text-white bg-[#10457C] hover:bg-[#0A2B4E] rounded-xl shadow-xs transition active:scale-95 disabled:opacity-50"
                      title="Log into this school's portal with full school admin privileges"
                    >
                      <ShieldAlert className="w-3.5 h-3.5 text-[#DA2C38]" />
                      <span>{impersonatingId === t.id ? 'Opening...' : 'Login as School'}</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
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

      {/* Footer */}
      <footer className="py-6 text-center text-xs text-slate-400 border-t border-slate-200/90 bg-white">
        <div className="flex items-center justify-center gap-2 mb-1">
          <ChilliPagesLogo height={16} className="h-4 w-auto grayscale opacity-50 hover:grayscale-0 hover:opacity-100 transition" />
        </div>
        <span>Multi-Tenant Admissions SaaS Platform · Powered by ChilliPages Core</span>
      </footer>
    </div>
  );
}
