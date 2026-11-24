'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Building2,
  Users,
  Phone,
  MessageCircle,
  Calendar,
  Clock,
  RefreshCw,
  ExternalLink,
  CheckCircle2,
  AlertTriangle,
  Flame,
  ChevronDown,
  ChevronUp,
  Layers,
  Activity,
  LogOut,
  Sparkles,
  ArrowUpRight,
  FileSpreadsheet,
  HelpCircle,
  AlertCircle,
  Hash,
  Download,
  Upload,
} from 'lucide-react';
import { getDashboardOverview, triggerSchoolSync, getExportLeadsCsvUrl } from '../../lib/api';
import { AuthUser, PublicTenantConfig, DashboardOverview } from '../../types';
import MasterLeadList from './MasterLeadList';
import LeadDrawer from './LeadDrawer';
import CsvImportModal from './CsvImportModal';
import CounselorManagementModal from './CounselorManagementModal';

interface Props {
  currentUser: AuthUser;
  tenantConfig: PublicTenantConfig | null;
  activeSlug: string;
  onLogout: () => void;
}

export default function SchoolDashboard({
  currentUser,
  tenantConfig,
  activeSlug,
  onLogout,
}: Props) {
  const [data, setData] = useState<DashboardOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [selectedCampaignId, setSelectedCampaignId] = useState<string>('ALL');
  const [countdown, setCountdown] = useState<number>(60);
  const [showFormulas, setShowFormulas] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Milestone 5 State: Lead Drawer & School Admin Modals
  const [selectedLeadId, setSelectedLeadId] = useState<string | null>(null);
  const [isCsvModalOpen, setIsCsvModalOpen] = useState<boolean>(false);
  const [isCounselorModalOpen, setIsCounselorModalOpen] = useState<boolean>(false);
  const [leadFilterStatus, setLeadFilterStatus] = useState<string>('ALL');
  const [refreshLeadsCounter, setRefreshLeadsCounter] = useState<number>(0);

  const handleFilterStatus = (status: string) => {
    setLeadFilterStatus(status);
    const elem = document.getElementById('lead-list');
    if (elem) {
      elem.scrollIntoView({ behavior: 'smooth' });
    }
  };

  // Fetch dashboard data
  const fetchData = useCallback(
    async (campaignId = selectedCampaignId, fresh = false) => {
      try {
        const overview = await getDashboardOverview(campaignId, fresh);
        setData(overview);
      } catch (err: any) {
        console.error('Error fetching dashboard overview:', err);
      } finally {
        setLoading(false);
      }
    },
    [selectedCampaignId]
  );

  useEffect(() => {
    fetchData(selectedCampaignId);
  }, [fetchData, selectedCampaignId]);

  // 60s Live Countdown timer for automatic re-sync / polling
  useEffect(() => {
    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          fetchData(selectedCampaignId, true);
          return 60;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [fetchData, selectedCampaignId]);

  const handleManualSync = async () => {
    setSyncing(true);
    try {
      const res = await triggerSchoolSync();
      setToastMessage(res.message || 'Google Sheet synced successfully!');
      setCountdown(60);
      await fetchData(selectedCampaignId, true);
    } catch (err: any) {
      alert(`Sync failed: ${err.message}`);
    } finally {
      setSyncing(false);
    }
  };

  const kpis = data?.kpiCards;
  const split = data?.feedbackSplit;
  const pending = data?.pendingBreakdown;
  const funnel = data?.funnel;
  const campaigns = data?.campaigns || [];
  const priorityLeads = data?.priorityLeads || [];
  const dailyIntake = data?.dailyIntake || [];
  const syncInfo = data?.syncInfo;

  const activeCampaignName =
    selectedCampaignId === 'ALL'
      ? 'All Campaign Tabs'
      : campaigns.find((c) => c.id === selectedCampaignId)?.tabName || 'Selected Campaign';

  // Find max intake count for bar chart scaling
  const maxIntakeCount = Math.max(...dailyIntake.map((d) => d.count), 5);

  return (
    <div className="min-h-screen bg-[#F8FAFC] flex flex-col text-slate-900 font-sans antialiased">
      {/* 1. Sticky Top Navigation Bar */}
      <header className="bg-white/95 backdrop-blur-md border-b border-slate-200/80 px-4 sm:px-6 py-3.5 sticky top-0 z-30 shadow-xs flex flex-wrap items-center justify-between gap-3">
        {/* School Branding */}
        <div className="flex items-center gap-3">
          {tenantConfig?.logoUrl ? (
            <img
              src={tenantConfig.logoUrl}
              alt={tenantConfig.dashboardTitle}
              className="h-9 w-9 rounded-xl object-contain border border-slate-200 p-0.5 bg-white shadow-xs"
            />
          ) : (
            <div
              className="w-9 h-9 rounded-xl flex items-center justify-center font-bold text-white text-base shadow-xs"
              style={{ backgroundColor: 'var(--brand-primary, #10457C)' }}
            >
              {tenantConfig?.dashboardTitle?.charAt(0) || activeSlug.charAt(0).toUpperCase()}
            </div>
          )}
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-base font-bold tracking-tight text-slate-900">
                {tenantConfig?.dashboardTitle || `${activeSlug} Admissions`}
              </h1>
              {currentUser.role === 'SUPER_ADMIN' && (
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-purple-100 text-purple-800 font-semibold">
                  Support Impersonation
                </span>
              )}
            </div>
            <p className="text-[11px] text-slate-400 flex items-center gap-1.5">
              <span>{tenantConfig?.timezone || 'Asia/Riyadh'}</span>
              <span>·</span>
              <code className="font-mono text-slate-500">{activeSlug}.leadfollowup.com</code>
            </p>
          </div>
        </div>

        {/* Live Countdown & User Actions */}
        <div className="flex items-center gap-3">
          {/* Live 60s Pulse Pill */}
          <div className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-50 border border-slate-200 text-xs font-medium text-slate-600">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span>
              Live {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </span>
            <span className="text-slate-300">|</span>
            <span className="font-mono text-[#10457C] font-semibold">{countdown}s</span>
          </div>

          {/* Sync Button */}
          {syncInfo?.dataMode === 'HYBRID_SHEET' && (
            <button
              onClick={handleManualSync}
              disabled={syncing}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl transition shadow-2xs disabled:opacity-50"
              title="Sync with Google Sheet immediately"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${syncing ? 'animate-spin text-[#10457C]' : ''}`} />
              <span className="hidden sm:inline">{syncing ? 'Syncing...' : 'Sync Now'}</span>
            </button>
          )}

          {/* Export CSV Button */}
          <a
            href={getExportLeadsCsvUrl(selectedCampaignId, leadFilterStatus)}
            download
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl transition shadow-2xs"
            title="Export filtered leads to CSV"
          >
            <Download className="w-3.5 h-3.5 text-slate-500" />
            <span className="hidden sm:inline">Export CSV</span>
          </a>

          {/* Import CSV Button */}
          <button
            onClick={() => setIsCsvModalOpen(true)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl transition shadow-2xs"
            title="Import leads from CSV"
          >
            <Upload className="w-3.5 h-3.5 text-slate-500" />
            <span className="hidden sm:inline">Import CSV</span>
          </button>

          {/* Counselor Management for School Admin */}
          {(currentUser.role === 'SCHOOL_ADMIN' || currentUser.role === 'SUPER_ADMIN') && (
            <button
              onClick={() => setIsCounselorModalOpen(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold bg-[#F0F5FA] hover:bg-[#E1EDF7] text-[#10457C] rounded-xl transition shadow-2xs border border-[#10457C]/10"
              title="Manage School Counselors"
            >
              <Users className="w-3.5 h-3.5 text-[#10457C]" />
              <span className="hidden sm:inline">Counselors</span>
            </button>
          )}

          {/* User Profile Pill */}
          <div className="flex items-center gap-2.5 bg-slate-50 border border-slate-200/80 px-3 py-1 rounded-xl">
            <div className="w-6 h-6 rounded-full bg-indigo-100 text-indigo-700 font-bold text-xs flex items-center justify-center">
              {currentUser.name.charAt(0)}
            </div>
            <div className="text-start hidden sm:block">
              <p className="text-xs font-semibold text-slate-800 leading-tight">{currentUser.name}</p>
              <p className="text-[10px] text-slate-400 font-mono leading-none">{currentUser.role}</p>
            </div>
          </div>

          <button
            onClick={onLogout}
            className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition"
            title="Sign Out"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8 space-y-6">
        {/* Toast Alert */}
        {toastMessage && (
          <div className="p-3.5 px-4 text-xs bg-emerald-50 border border-emerald-200 text-emerald-900 rounded-2xl flex items-center justify-between shadow-xs animate-in fade-in">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              <span>{toastMessage}</span>
            </div>
            <button
              onClick={() => setToastMessage(null)}
              className="text-emerald-700 font-bold hover:text-emerald-900"
            >
              ✕
            </button>
          </div>
        )}

        {/* 2. Dynamic Campaign Tabs Bar */}
        <div className="flex flex-wrap items-center gap-2 bg-white p-2.5 rounded-2xl border border-slate-200/90 shadow-bespoke">
          <button
            onClick={() => setSelectedCampaignId('ALL')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all ${
              selectedCampaignId === 'ALL'
                ? 'bg-[#10457C] text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            All Campaign Tabs ({kpis?.totalLeads || 0})
          </button>

          {campaigns.map((camp) => (
            <button
              key={camp.id}
              onClick={() => setSelectedCampaignId(camp.id)}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-medium transition-all flex items-center gap-1.5 ${
                selectedCampaignId === camp.id
                  ? 'bg-[#10457C] text-white font-bold shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              <span>{camp.tabName}</span>
              <span
                className={`text-[10px] px-1.5 py-0.2 rounded-full ${
                  selectedCampaignId === camp.id
                    ? 'bg-white/20 text-white'
                    : 'bg-slate-100 text-slate-500'
                }`}
              >
                {camp.totalLeads}
              </span>
            </button>
          ))}

          {campaigns.length === 0 && !loading && (
            <span className="text-xs text-slate-400 italic px-2">
              No campaign tabs discovered yet. Sync a Google Sheet or import leads.
            </span>
          )}
        </div>

        {/* Narrative Summary Sentence */}
        <div className="text-xs text-slate-500 px-1">
          {kpis?.totalLeads === 0 ? (
            <span>Welcome! Zero leads currently recorded. Connect a Google Sheet to begin automated intake.</span>
          ) : (
            <span>
              Showing metrics for <strong className="text-slate-800">{activeCampaignName}</strong>: {kpis?.totalLeads}{' '}
              total intake rows. <strong className="text-emerald-600">{kpis?.followedCount}</strong> followed up (
              {kpis?.followedPercent}%), and{' '}
              <strong className="text-amber-600">{kpis?.remainingNotContacted}</strong> awaiting first counselor contact.
            </span>
          )}
        </div>

        {/* 3. Primary KPI Cards Grid */}
        <div className="grid grid-cols-2 lg:grid-cols-6 gap-3.5 sm:gap-4">
          {/* Total Leads */}
          <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-xs hover:shadow-md transition">
            <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">
              Total Leads
            </span>
            <p className="text-2xl sm:text-3xl font-extrabold text-slate-900 mt-1.5 tracking-tight">
              {kpis?.totalLeads || 0}
            </p>
            <p className="text-[10px] text-slate-400 mt-1">
              {kpis?.uniquePeople || 0} unique · {kpis?.repeats || 0} repeats
            </p>
          </div>

          {/* Followed Up */}
          <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-xs hover:shadow-md transition">
            <span className="text-[11px] font-semibold text-indigo-600 uppercase tracking-wider block">
              Followed Up
            </span>
            <p className="text-2xl sm:text-3xl font-extrabold text-indigo-700 mt-1.5 tracking-tight">
              {kpis?.followedCount || 0}
            </p>
            <p className="text-[10px] text-indigo-600/80 mt-1 font-semibold">
              {kpis?.followedPercent || 0}% contact rate
            </p>
          </div>

          {/* Remaining (Not Contacted) */}
          <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-xs hover:shadow-md transition">
            <span className="text-[11px] font-semibold text-amber-600 uppercase tracking-wider block">
              Remaining
            </span>
            <p className="text-2xl sm:text-3xl font-extrabold text-amber-700 mt-1.5 tracking-tight">
              {kpis?.remainingNotContacted || 0}
            </p>
            <p className="text-[10px] text-amber-600/80 mt-1">Awaiting contact</p>
          </div>

          {/* Positive Decisions */}
          <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-xs hover:shadow-md transition">
            <span className="text-[11px] font-semibold text-emerald-600 uppercase tracking-wider block">
              Positive
            </span>
            <p className="text-2xl sm:text-3xl font-extrabold text-emerald-700 mt-1.5 tracking-tight">
              {kpis?.positiveCount || 0}
            </p>
            <p className="text-[10px] text-emerald-600/80 mt-1 font-semibold">
              {kpis?.positiveRatePercent || 0}% positive rate
            </p>
          </div>

          {/* Pending In-Progress */}
          <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-xs hover:shadow-md transition">
            <span className="text-[11px] font-semibold text-sky-600 uppercase tracking-wider block">
              Pending
            </span>
            <p className="text-2xl sm:text-3xl font-extrabold text-sky-700 mt-1.5 tracking-tight">
              {kpis?.pendingCount || 0}
            </p>
            <p className="text-[10px] text-sky-600/80 mt-1">In communication</p>
          </div>

          {/* Negative / Lost */}
          <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-xs hover:shadow-md transition">
            <span className="text-[11px] font-semibold text-rose-600 uppercase tracking-wider block">
              Negative / Lost
            </span>
            <p className="text-2xl sm:text-3xl font-extrabold text-rose-700 mt-1.5 tracking-tight">
              {kpis?.negativeCount || 0}
            </p>
            <p className="text-[10px] text-rose-600/80 mt-1">Declined or closed</p>
          </div>
        </div>

        {/* 4. Velocity & Secondary Health Metrics */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5 sm:gap-4">
          <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-xs">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                Reply Rate
              </span>
              <Activity className="w-3.5 h-3.5 text-indigo-500" />
            </div>
            <p className="text-2xl font-bold text-slate-900 mt-1">{kpis?.replyRatePercent || 0}%</p>
            <p className="text-[10px] text-slate-400 mt-0.5">Yes/No answers out of valid followed</p>
          </div>

          <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-xs">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                Days to 1st Contact
              </span>
              <Clock className="w-3.5 h-3.5 text-blue-500" />
            </div>
            <p className="text-2xl font-bold text-slate-900 mt-1">
              {kpis?.daysToFirstContact !== null && kpis?.daysToFirstContact !== undefined
                ? `${kpis.daysToFirstContact}d`
                : '—'}
            </p>
            <p className="text-[10px] text-slate-400 mt-0.5">Average intake to initial note</p>
          </div>

          <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-xs">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                New Leads (7d)
              </span>
              <Sparkles className="w-3.5 h-3.5 text-emerald-500" />
            </div>
            <p className="text-2xl font-bold text-emerald-700 mt-1">{kpis?.newLeadsLast7Days || 0}</p>
            <p className="text-[10px] text-emerald-600/80 mt-0.5">Fresh leads in past week</p>
          </div>

          <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-xs">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold text-amber-600 uppercase tracking-wider">
                Going Cold (3d+)
              </span>
              <Flame className="w-3.5 h-3.5 text-amber-500" />
            </div>
            <p className="text-2xl font-bold text-amber-700 mt-1">{kpis?.goingColdAlertCount || 0}</p>
            <p className="text-[10px] text-amber-600/80 mt-0.5">Pending leads with no recent touch</p>
          </div>
        </div>

        {/* 5. Clickable Feedback Split Bar */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-xs space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
              <span>Feedback Distribution</span>
            </h3>
            <span className="text-xs text-slate-400">Total: {kpis?.totalLeads || 0}</span>
          </div>

          {/* Visual Stacked Bar */}
          <div className="h-6 w-full rounded-xl overflow-hidden flex bg-slate-100 shadow-inner">
            {split?.positive && split.positive.percent > 0 && (
              <div
                style={{ width: `${split.positive.percent}%` }}
                onClick={() => handleFilterStatus('POSITIVE')}
                className="bg-emerald-500 hover:bg-emerald-600 cursor-pointer transition-all flex items-center justify-center text-[10px] font-bold text-white"
                title={`Positive: ${split.positive.count} (${split.positive.percent}%) — Click to filter`}
              >
                {split.positive.percent >= 8 && `${split.positive.percent}%`}
              </div>
            )}
            {split?.pending && split.pending.percent > 0 && (
              <div
                style={{ width: `${split.pending.percent}%` }}
                onClick={() => handleFilterStatus('PENDING')}
                className="bg-sky-500 hover:bg-sky-600 cursor-pointer transition-all flex items-center justify-center text-[10px] font-bold text-white"
                title={`Pending: ${split.pending.count} (${split.pending.percent}%) — Click to filter`}
              >
                {split.pending.percent >= 8 && `${split.pending.percent}%`}
              </div>
            )}
            {split?.notContacted && split.notContacted.percent > 0 && (
              <div
                style={{ width: `${split.notContacted.percent}%` }}
                onClick={() => handleFilterStatus('NOT_CONTACTED')}
                className="bg-amber-400 hover:bg-amber-500 cursor-pointer transition-all flex items-center justify-center text-[10px] font-bold text-white"
                title={`Not Contacted: ${split.notContacted.count} (${split.notContacted.percent}%) — Click to filter`}
              >
                {split.notContacted.percent >= 8 && `${split.notContacted.percent}%`}
              </div>
            )}
            {split?.negative && split.negative.percent > 0 && (
              <div
                style={{ width: `${split.negative.percent}%` }}
                onClick={() => handleFilterStatus('NEGATIVE')}
                className="bg-rose-500 hover:bg-rose-600 cursor-pointer transition-all flex items-center justify-center text-[10px] font-bold text-white"
                title={`Negative: ${split.negative.count} (${split.negative.percent}%) — Click to filter`}
              >
                {split.negative.percent >= 8 && `${split.negative.percent}%`}
              </div>
            )}
            {split?.invalidDuplicate && split.invalidDuplicate.percent > 0 && (
              <div
                style={{ width: `${split.invalidDuplicate.percent}%` }}
                onClick={() => handleFilterStatus('INVALID_DUPLICATE')}
                className="bg-purple-500 hover:bg-purple-600 cursor-pointer transition-all flex items-center justify-center text-[10px] font-bold text-white"
                title={`Invalid/Duplicate: ${split.invalidDuplicate.count} (${split.invalidDuplicate.percent}%) — Click to filter`}
              >
                {split.invalidDuplicate.percent >= 8 && `${split.invalidDuplicate.percent}%`}
              </div>
            )}
          </div>

          {/* Split Bar Legend */}
          <div className="flex flex-wrap items-center gap-4 text-xs pt-1">
            <button
              onClick={() => handleFilterStatus('POSITIVE')}
              className="flex items-center gap-1.5 hover:text-emerald-700 transition"
            >
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
              <span className="text-slate-600">Positive: {split?.positive.count || 0} ({split?.positive.percent || 0}%)</span>
            </button>
            <button
              onClick={() => handleFilterStatus('PENDING')}
              className="flex items-center gap-1.5 hover:text-sky-700 transition"
            >
              <span className="w-2.5 h-2.5 rounded-full bg-sky-500" />
              <span className="text-slate-600">Pending: {split?.pending.count || 0} ({split?.pending.percent || 0}%)</span>
            </button>
            <button
              onClick={() => handleFilterStatus('NOT_CONTACTED')}
              className="flex items-center gap-1.5 hover:text-amber-700 transition"
            >
              <span className="w-2.5 h-2.5 rounded-full bg-amber-400" />
              <span className="text-slate-600">Not Contacted: {split?.notContacted.count || 0} ({split?.notContacted.percent || 0}%)</span>
            </button>
            <button
              onClick={() => handleFilterStatus('NEGATIVE')}
              className="flex items-center gap-1.5 hover:text-rose-700 transition"
            >
              <span className="w-2.5 h-2.5 rounded-full bg-rose-500" />
              <span className="text-slate-600">Negative: {split?.negative.count || 0} ({split?.negative.percent || 0}%)</span>
            </button>
            <button
              onClick={() => handleFilterStatus('INVALID_DUPLICATE')}
              className="flex items-center gap-1.5 hover:text-purple-700 transition"
            >
              <span className="w-2.5 h-2.5 rounded-full bg-purple-500" />
              <span className="text-slate-600">Duplicate: {split?.invalidDuplicate.count || 0} ({split?.invalidDuplicate.percent || 0}%)</span>
            </button>
          </div>
        </div>

        {/* 6. Two-Column Layout: Stage Funnel & Pending Breakdown */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Follow-up Progress Funnel */}
          <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-xs space-y-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
              <Layers className="w-3.5 h-3.5 text-indigo-600" />
              <span>Follow-Up Stage Funnel</span>
            </h3>

            <div className="space-y-3">
              {/* Step 1: Followup 1 */}
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/60 flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold text-slate-800">Stage 1 (Initial Contact)</p>
                  <p className="text-[11px] text-slate-400">First call or message logged</p>
                </div>
                <div className="text-end">
                  <span className="text-sm font-bold text-indigo-600">
                    {funnel?.stage1.completed || 0} completed
                  </span>
                  <span className="text-[10px] text-slate-400 block">
                    {funnel?.stage1.openWaiting || 0} awaiting
                  </span>
                </div>
              </div>

              {/* Step 2: Followup 2 */}
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/60 flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold text-slate-800">Stage 2 (Nurturing Touch)</p>
                  <p className="text-[11px] text-slate-400">Follow-up reminder or discussion</p>
                </div>
                <div className="text-end">
                  <span className="text-sm font-bold text-indigo-600">
                    {funnel?.stage2.completed || 0} completed
                  </span>
                  <span className="text-[10px] text-slate-400 block">
                    {funnel?.stage2.openWaiting || 0} awaiting
                  </span>
                </div>
              </div>

              {/* Step 3: Followup 3 */}
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/60 flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold text-slate-800">Stage 3 (Final Decision)</p>
                  <p className="text-[11px] text-slate-400">Campus visit or enrollment closure</p>
                </div>
                <div className="text-end">
                  <span className="text-sm font-bold text-indigo-600">
                    {funnel?.stage3.completed || 0} completed
                  </span>
                  <span className="text-[10px] text-slate-400 block">
                    {funnel?.stage3.openWaiting || 0} awaiting
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Pending Sub-Status Breakdown */}
          <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-xs space-y-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-sky-600" />
              <span>Pending Leads Reasons Breakdown</span>
            </h3>

            <div className="space-y-3">
              <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-200/60">
                <span className="text-xs font-medium text-slate-700">Message sent, no reply</span>
                <span className="text-xs font-bold text-slate-900">
                  {pending?.msgNoReply.count || 0} ({pending?.msgNoReply.percent || 0}%)
                </span>
              </div>
              <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-200/60">
                <span className="text-xs font-medium text-slate-700">Called, no answer / busy</span>
                <span className="text-xs font-bold text-slate-900">
                  {pending?.calledNoAnswer.count || 0} ({pending?.calledNoAnswer.percent || 0}%)
                </span>
              </div>
              <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-200/60">
                <span className="text-xs font-medium text-slate-700">Answered, evaluating decision</span>
                <span className="text-xs font-bold text-slate-900">
                  {pending?.answeredNoDecision.count || 0} ({pending?.answeredNoDecision.percent || 0}%)
                </span>
              </div>
              <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-200/60">
                <span className="text-xs font-medium text-slate-700">Other general pending</span>
                <span className="text-xs font-bold text-slate-900">
                  {pending?.other.count || 0} ({pending?.other.percent || 0}%)
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* 7. Campaign Performance Matrix */}
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
          <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
              <FileSpreadsheet className="w-3.5 h-3.5 text-indigo-600" />
              <span>Campaign Performance Comparison Matrix</span>
            </h3>
            <span className="text-xs text-slate-400">{campaigns.length} campaigns</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-start text-xs">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-200/80 text-slate-500 font-semibold uppercase tracking-wider text-[11px]">
                  <th className="py-3 px-4 text-start">Campaign Tab</th>
                  <th className="py-3 px-4 text-start">Total Leads</th>
                  <th className="py-3 px-4 text-start">Followed Up</th>
                  <th className="py-3 px-4 text-start">Contact Rate</th>
                  <th className="py-3 px-4 text-start">Positive Leads</th>
                  <th className="py-3 px-4 text-start">Positive %</th>
                  <th className="py-3 px-4 text-end">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {campaigns.map((c) => (
                  <tr
                    key={c.id}
                    className={`hover:bg-slate-50/70 transition cursor-pointer ${
                      selectedCampaignId === c.id ? 'bg-indigo-50/40 font-medium' : ''
                    }`}
                    onClick={() => setSelectedCampaignId(c.id)}
                  >
                    <td className="py-3.5 px-4 font-semibold text-slate-900">{c.tabName}</td>
                    <td className="py-3.5 px-4">{c.totalLeads}</td>
                    <td className="py-3.5 px-4 text-indigo-700 font-medium">{c.followedCount}</td>
                    <td className="py-3.5 px-4">{c.followedPercent}%</td>
                    <td className="py-3.5 px-4 text-emerald-700 font-semibold">{c.positiveCount}</td>
                    <td className="py-3.5 px-4">{c.positiveRatePercent}%</td>
                    <td className="py-3.5 px-4 text-end">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedCampaignId(c.id);
                        }}
                        className="text-xs text-indigo-600 hover:text-indigo-800 font-semibold"
                      >
                        Filter Tab →
                      </button>
                    </td>
                  </tr>
                ))}
                {campaigns.length === 0 && (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-slate-400">
                      No campaign tabs found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* 8. Priority Leads to Close (WhatsApp Action Cards) */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                <Flame className="w-3.5 h-3.5 text-emerald-600" />
                <span>Priority Leads for Follow-Up</span>
              </h3>
              <p className="text-[11px] text-slate-400 mt-0.5">
                Top leads waiting for immediate counselor touch
              </p>
            </div>
            <span className="text-xs font-semibold text-slate-500">
              {priorityLeads.length} prioritized
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
            {priorityLeads.map((lead) => (
              <div
                key={lead.id}
                onClick={() => setSelectedLeadId(lead.id)}
                className="bg-slate-50/70 border border-slate-200/70 rounded-2xl p-4 flex flex-col justify-between hover:border-indigo-300 hover:shadow-xs transition cursor-pointer group"
              >
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <h4 className="text-sm font-bold text-slate-900 truncate group-hover:text-indigo-600 transition" dir="auto">
                      {lead.parentName}
                    </h4>
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0 ${
                        lead.feedbackStatus === 'POSITIVE'
                          ? 'bg-emerald-100 text-emerald-800'
                          : 'bg-sky-100 text-sky-800'
                      }`}
                    >
                      {lead.feedbackStatus}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    {lead.campaignName} {lead.grade ? `· ${lead.grade}` : ''}
                  </p>
                </div>

                <div className="mt-4 pt-3 border-t border-slate-200/60 flex items-center justify-between" onClick={(e) => e.stopPropagation()}>
                  {lead.whatsAppUrl ? (
                    <a
                      href={lead.whatsAppUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-semibold shadow-xs transition"
                    >
                      <MessageCircle className="w-3.5 h-3.5" />
                      <span>WhatsApp</span>
                    </a>
                  ) : (
                    <span className="text-[11px] text-slate-400">No phone</span>
                  )}
                  {lead.phoneRaw && (
                    <span className="text-[11px] font-mono text-slate-500">{lead.phoneRaw}</span>
                  )}
                </div>
              </div>
            ))}

            {priorityLeads.length === 0 && (
              <div className="col-span-full py-8 text-center text-slate-400 text-xs">
                Zero priority leads requiring follow-up. All leads have been contacted!
              </div>
            )}
          </div>
        </div>

        {/* 9. Daily Intake Timeline Chart */}
        {dailyIntake.length > 0 && (
          <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-xs space-y-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-indigo-600" />
              <span>Daily Lead Intake Trend (Past 30 Days)</span>
            </h3>

            <div className="h-44 flex items-end gap-2 pt-6 pb-2 overflow-x-auto">
              {dailyIntake.map((d) => {
                const heightPercent = Math.max(12, Math.round((d.count / maxIntakeCount) * 100));
                return (
                  <div key={d.date} className="flex-1 h-36 min-w-[32px] flex flex-col justify-end items-center gap-1 group">
                    <span className="text-[10px] font-bold text-slate-700 font-mono opacity-0 group-hover:opacity-100 transition">
                      {d.count}
                    </span>
                    <div className="w-full flex-1 flex items-end">
                      <div
                        style={{ height: `${heightPercent}%` }}
                        className="w-full bg-[#10457C] group-hover:bg-[#DA2C38] rounded-t-md transition-all shadow-2xs"
                        title={`${d.date}: ${d.count} leads`}
                      />
                    </div>
                    <span className="text-[9px] text-slate-400 font-mono truncate max-w-[36px]">
                      {d.date.slice(5)}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* 10. Master Lead Directory & Interactive Table */}
        <MasterLeadList
          selectedCampaignId={selectedCampaignId}
          selectedStatus={leadFilterStatus}
          onSelectLead={(id) => setSelectedLeadId(id)}
          onOpenCsvImport={() => setIsCsvModalOpen(true)}
          refreshTrigger={refreshLeadsCounter}
        />

        {/* 11. Collapsible Formula Accordion */}
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
          <button
            onClick={() => setShowFormulas(!showFormulas)}
            className="w-full p-4 text-start flex items-center justify-between text-xs font-semibold text-slate-600 hover:text-slate-900 transition"
          >
            <div className="flex items-center gap-2">
              <HelpCircle className="w-4 h-4 text-slate-400" />
              <span>How the numbers are worked out (KPI Formulas)</span>
            </div>
            {showFormulas ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>

          {showFormulas && (
            <div className="p-5 border-t border-slate-100 bg-slate-50/50 space-y-3 text-xs text-slate-600 leading-relaxed">
              <p>
                <strong>Followed Up %:</strong> Followed leads divided by Total Leads × 100.
              </p>
              <p>
                <strong>Positive Rate %:</strong> Positive leads divided by clear Yes/No decisions (Positive + Negative) × 100.
              </p>
              <p>
                <strong>Reply Rate %:</strong> Clear decisions (Positive + Negative) divided by Valid Followed Leads (excluding duplicates) × 100.
              </p>
              <p>
                <strong>Going Cold Alert:</strong> Leads in Positive or Pending state whose status or notes have not been updated in 3 or more days.
              </p>
            </div>
          )}
        </div>
      </main>

      {/* Slide-Over Follow-Up Lead Drawer */}
      <LeadDrawer
        leadId={selectedLeadId}
        onClose={() => setSelectedLeadId(null)}
        onLeadUpdated={() => {
          fetchData(selectedCampaignId, true);
          setRefreshLeadsCounter((c) => c + 1);
        }}
      />

      {/* Bulk CSV Import Modal */}
      <CsvImportModal
        isOpen={isCsvModalOpen}
        onClose={() => setIsCsvModalOpen(false)}
        onSuccess={() => {
          fetchData(selectedCampaignId, true);
          setRefreshLeadsCounter((c) => c + 1);
        }}
      />

      {/* Counselor Team Management Modal */}
      <CounselorManagementModal
        isOpen={isCounselorModalOpen}
        onClose={() => setIsCounselorModalOpen(false)}
      />

      <footer className="py-6 text-center text-xs text-slate-400 border-t border-slate-200 bg-white">
        {tenantConfig?.dashboardTitle || 'School Admissions'} · Powered by Multi-Tenant Follow-Up Engine
      </footer>
    </div>
  );
}
