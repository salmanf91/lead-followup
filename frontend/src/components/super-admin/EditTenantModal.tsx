'use client';

import { useState } from 'react';
import {
  Building2,
  X,
  Palette,
  FileSpreadsheet,
  Calendar,
  SlidersHorizontal,
  CheckCircle2,
  AlertTriangle,
} from 'lucide-react';
import { updateTenant } from '../../lib/api';
import { TenantRecord } from '../../types';

interface Props {
  tenant: TenantRecord;
  isOpen: boolean;
  onClose: () => void;
  onUpdated: (tenant: TenantRecord) => void;
}

const COMMON_TIMEZONES = [
  'Asia/Riyadh',
  'Asia/Dubai',
  'Asia/Qatar',
  'Asia/Kuwait',
  'Asia/Bahrain',
  'Europe/London',
  'UTC',
];

const PRESET_COLORS = [
  '#10457C', // ChilliPages Sapphire Navy
  '#DA2C38', // ChilliPages Crimson Red
  '#0D9488', // Emerald Teal
  '#4338CA', // Indigo
  '#7C3AED', // Vivid Violet
  '#B45309', // Amber / Gold
  '#0F172A', // Slate Midnight
];

export default function EditTenantModal({ tenant, isOpen, onClose, onUpdated }: Props) {
  const [name, setName] = useState(tenant.name);
  const [dashboardTitle, setDashboardTitle] = useState(tenant.dashboard_title);
  const [logoUrl, setLogoUrl] = useState(tenant.logo_url || '');
  const [primaryColor, setPrimaryColor] = useState(tenant.primary_color || '#1E3A8A');
  const [timezone, setTimezone] = useState(tenant.timezone || 'Asia/Riyadh');
  const [status, setStatus] = useState<'ACTIVE' | 'SUSPENDED'>(tenant.status);
  const [dataMode, setDataMode] = useState<'HYBRID_SHEET' | 'NATIVE_ONLY'>(tenant.data_mode);
  const [googleSheetId, setGoogleSheetId] = useState(tenant.google_sheet_id || '');
  const [enableSheetWriteback, setEnableSheetWriteback] = useState(tenant.enable_sheet_writeback);
  const [planType, setPlanType] = useState<'ONE_TIME' | 'ANNUAL'>(tenant.plan_type);
  const [renewalDate, setRenewalDate] = useState(
    tenant.renewal_date ? new Date(tenant.renewal_date).toISOString().split('T')[0] : ''
  );
  const [adminNotes, setAdminNotes] = useState(tenant.admin_notes || '');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const payload: any = {
        name,
        dashboardTitle,
        logoUrl: logoUrl.trim() || null,
        primaryColor,
        timezone,
        status,
        dataMode,
        googleSheetId: dataMode === 'HYBRID_SHEET' ? googleSheetId.trim() || null : null,
        enableSheetWriteback,
        planType,
        renewalDate: renewalDate || null,
        adminNotes: adminNotes.trim() || null,
      };

      const updated = await updateTenant(tenant.id, payload);
      onUpdated(updated);
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to update school tenant');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="bg-white rounded-3xl shadow-2xl border border-slate-200/80 max-w-2xl w-full max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/70">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center shadow-xs">
              <SlidersHorizontal className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">Edit School: {tenant.name}</h2>
              <p className="text-xs text-slate-500 font-mono">
                Subdomain slug: <span className="text-indigo-600 font-semibold">{tenant.slug}</span>
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-xl flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto space-y-6 flex-1 text-start">
          {error && (
            <div className="p-3.5 text-xs bg-red-50 border border-red-200 text-red-700 rounded-xl font-medium">
              ⚠ {error}
            </div>
          )}

          {/* Section 1: Core Details & Status */}
          <div className="space-y-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
              <Building2 className="w-3.5 h-3.5 text-indigo-600" />
              <span>Identity & Status</span>
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  School Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-3.5 py-2 text-xs sm:text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 focus:outline-none transition"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">Portal Status</label>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value as any)}
                  className={`w-full px-3.5 py-2 text-xs sm:text-sm font-semibold border rounded-xl focus:outline-none transition ${
                    status === 'ACTIVE'
                      ? 'border-emerald-300 bg-emerald-50/80 text-emerald-800'
                      : 'border-amber-300 bg-amber-50/80 text-amber-800'
                  }`}
                >
                  <option value="ACTIVE">ACTIVE (Accepting Logins & Traffic)</option>
                  <option value="SUSPENDED">SUSPENDED (Portal Inactive)</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Dashboard Title Banner <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                required
                value={dashboardTitle}
                onChange={(e) => setDashboardTitle(e.target.value)}
                className="w-full px-3.5 py-2 text-xs sm:text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 focus:outline-none transition"
              />
            </div>
          </div>

          {/* Section 2: Branding */}
          <div className="space-y-4 pt-4 border-t border-slate-100">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
              <Palette className="w-3.5 h-3.5 text-indigo-600" />
              <span>White-Label Branding</span>
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">Logo URL</label>
                <input
                  type="url"
                  value={logoUrl}
                  onChange={(e) => setLogoUrl(e.target.value)}
                  className="w-full px-3.5 py-2 text-xs sm:text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 focus:outline-none transition"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">Timezone</label>
                <select
                  value={timezone}
                  onChange={(e) => setTimezone(e.target.value)}
                  className="w-full px-3.5 py-2 text-xs sm:text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 focus:outline-none transition"
                >
                  {COMMON_TIMEZONES.map((tz) => (
                    <option key={tz} value={tz}>
                      {tz}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">Primary Theme Color</label>
              <div className="flex flex-wrap items-center gap-2.5">
                {PRESET_COLORS.map((hex) => (
                  <button
                    key={hex}
                    type="button"
                    onClick={() => setPrimaryColor(hex)}
                    className={`w-7 h-7 rounded-xl border-2 transition-all ${
                      primaryColor.toUpperCase() === hex.toUpperCase()
                        ? 'border-indigo-600 scale-110 shadow-sm'
                        : 'border-transparent hover:scale-105'
                    }`}
                    style={{ backgroundColor: hex }}
                  />
                ))}
                <div className="flex items-center gap-1.5 ms-2">
                  <input
                    type="color"
                    value={primaryColor}
                    onChange={(e) => setPrimaryColor(e.target.value)}
                    className="w-7 h-7 p-0 rounded-lg border border-slate-200 cursor-pointer bg-transparent"
                  />
                  <input
                    type="text"
                    value={primaryColor}
                    onChange={(e) => setPrimaryColor(e.target.value)}
                    className="w-24 px-2 py-1 text-xs font-mono bg-slate-50 border border-slate-200 rounded-lg uppercase"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Section 3: Data Ingestion */}
          <div className="space-y-4 pt-4 border-t border-slate-100">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
              <FileSpreadsheet className="w-3.5 h-3.5 text-indigo-600" />
              <span>Data Pipeline & Sync</span>
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">Data Mode</label>
                <select
                  value={dataMode}
                  onChange={(e) => setDataMode(e.target.value as any)}
                  className="w-full px-3.5 py-2 text-xs sm:text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 focus:outline-none transition"
                >
                  <option value="HYBRID_SHEET">HYBRID_SHEET</option>
                  <option value="NATIVE_ONLY">NATIVE_ONLY</option>
                </select>
              </div>

              {dataMode === 'HYBRID_SHEET' && (
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">Google Sheet ID</label>
                  <input
                    type="text"
                    value={googleSheetId}
                    onChange={(e) => setGoogleSheetId(e.target.value)}
                    className="w-full px-3.5 py-2 text-xs font-mono bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 focus:outline-none transition"
                  />
                </div>
              )}
            </div>

            {dataMode === 'HYBRID_SHEET' && (
              <label className="flex items-center gap-2 cursor-pointer p-2.5 rounded-xl bg-slate-50 border border-slate-200/70 hover:bg-slate-100/60 transition">
                <input
                  type="checkbox"
                  checked={enableSheetWriteback}
                  onChange={(e) => setEnableSheetWriteback(e.target.checked)}
                  className="w-4 h-4 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500"
                />
                <span className="text-xs text-slate-700 font-medium">
                  Enable Sheet Writeback (Push counselor follow-up changes back to Google Sheet)
                </span>
              </label>
            )}
          </div>

          {/* Section 4: Subscription */}
          <div className="space-y-4 pt-4 border-t border-slate-100">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-indigo-600" />
              <span>Subscription & Notes</span>
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">Plan Type</label>
                <select
                  value={planType}
                  onChange={(e) => setPlanType(e.target.value as any)}
                  className="w-full px-3.5 py-2 text-xs sm:text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 focus:outline-none transition"
                >
                  <option value="ANNUAL">ANNUAL</option>
                  <option value="ONE_TIME">ONE_TIME</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">Renewal Date</label>
                <input
                  type="date"
                  value={renewalDate}
                  onChange={(e) => setRenewalDate(e.target.value)}
                  className="w-full px-3.5 py-2 text-xs sm:text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 focus:outline-none transition"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">Internal Admin Notes</label>
              <textarea
                rows={2}
                value={adminNotes}
                onChange={(e) => setAdminNotes(e.target.value)}
                className="w-full px-3.5 py-2 text-xs sm:text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 focus:outline-none transition"
              />
            </div>
          </div>

          {/* Modal Actions */}
          <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="px-4 py-2.5 text-xs sm:text-sm font-semibold text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-xl transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-5 py-2.5 text-xs sm:text-sm font-semibold text-white bg-gradient-to-r from-[#10457C] to-[#185EA5] hover:from-[#0A2B4E] hover:to-[#10457C] rounded-xl shadow-md shadow-[#10457C]/20 transition disabled:opacity-50"
            >
              {loading ? 'Saving Changes...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
