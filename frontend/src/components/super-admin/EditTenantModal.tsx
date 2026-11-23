'use client';

import { useState } from 'react';
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-xl max-w-xl w-full max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
          <div>
            <h2 className="text-lg font-bold text-slate-900">Edit School: {tenant.name}</h2>
            <p className="text-xs text-slate-500 font-mono">slug: {tenant.slug}</p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 text-sm font-semibold">
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto space-y-5 flex-1 text-start">
          {error && (
            <div className="p-3 text-xs bg-red-50 border border-red-200 text-red-700 rounded-lg">
              {error}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">School Name *</label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Status</label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as any)}
                className={`w-full px-3 py-2 text-sm font-semibold border rounded-lg focus:outline-none ${
                  status === 'ACTIVE'
                    ? 'border-emerald-300 bg-emerald-50 text-emerald-800'
                    : 'border-amber-300 bg-amber-50 text-amber-800'
                }`}
              >
                <option value="ACTIVE">ACTIVE</option>
                <option value="SUSPENDED">SUSPENDED</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Dashboard Header Title *</label>
            <input
              type="text"
              required
              value={dashboardTitle}
              onChange={(e) => setDashboardTitle(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Logo URL</label>
              <input
                type="url"
                value={logoUrl}
                onChange={(e) => setLogoUrl(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Timezone</label>
              <select
                value={timezone}
                onChange={(e) => setTimezone(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none bg-white"
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
            <label className="block text-xs font-medium text-slate-700 mb-1">Primary Color</label>
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={primaryColor}
                onChange={(e) => setPrimaryColor(e.target.value)}
                className="w-9 h-9 p-0.5 rounded border border-slate-300 cursor-pointer"
              />
              <input
                type="text"
                value={primaryColor}
                onChange={(e) => setPrimaryColor(e.target.value)}
                className="w-28 px-2.5 py-1.5 text-xs font-mono border border-slate-300 rounded-lg uppercase"
              />
            </div>
          </div>

          <div className="pt-3 border-t border-slate-100 grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Data Ingestion Mode</label>
              <select
                value={dataMode}
                onChange={(e) => setDataMode(e.target.value as any)}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none bg-white"
              >
                <option value="HYBRID_SHEET">HYBRID_SHEET</option>
                <option value="NATIVE_ONLY">NATIVE_ONLY</option>
              </select>
            </div>

            {dataMode === 'HYBRID_SHEET' && (
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Google Sheet ID</label>
                <input
                  type="text"
                  value={googleSheetId}
                  onChange={(e) => setGoogleSheetId(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none font-mono text-xs"
                />
              </div>
            )}
          </div>

          {dataMode === 'HYBRID_SHEET' && (
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={enableSheetWriteback}
                onChange={(e) => setEnableSheetWriteback(e.target.checked)}
                className="w-4 h-4 text-blue-600 rounded border-slate-300"
              />
              <span className="text-xs text-slate-700">Enable Sheet Writeback</span>
            </label>
          )}

          <div className="pt-3 border-t border-slate-100 grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Plan Type</label>
              <select
                value={planType}
                onChange={(e) => setPlanType(e.target.value as any)}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white"
              >
                <option value="ANNUAL">ANNUAL</option>
                <option value="ONE_TIME">ONE_TIME</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Renewal Date</label>
              <input
                type="date"
                value={renewalDate}
                onChange={(e) => setRenewalDate(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Internal Admin Notes</label>
            <textarea
              rows={2}
              value={adminNotes}
              onChange={(e) => setAdminNotes(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
            />
          </div>

          <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="px-4 py-2 text-sm text-slate-700 hover:bg-slate-100 rounded-lg transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-5 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition disabled:opacity-50"
            >
              {loading ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
