'use client';

import { useState } from 'react';
import { createTenant } from '../../lib/api';
import { TenantRecord } from '../../types';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onCreated: (tenant: TenantRecord) => void;
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
  '#1E3A8A', // Classic Deep Blue
  '#0D9488', // Emerald Teal
  '#4338CA', // Indigo
  '#B45309', // Amber / Gold
  '#BE185D', // Crimson Rose
  '#0F172A', // Slate Midnight
];

export default function CreateTenantModal({ isOpen, onClose, onCreated }: Props) {
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [dashboardTitle, setDashboardTitle] = useState('');
  const [logoUrl, setLogoUrl] = useState('');
  const [primaryColor, setPrimaryColor] = useState('#1E3A8A');
  const [timezone, setTimezone] = useState('Asia/Riyadh');
  const [dataMode, setDataMode] = useState<'HYBRID_SHEET' | 'NATIVE_ONLY'>('HYBRID_SHEET');
  const [googleSheetId, setGoogleSheetId] = useState('');
  const [enableSheetWriteback, setEnableSheetWriteback] = useState(false);
  const [planType, setPlanType] = useState<'ONE_TIME' | 'ANNUAL'>('ANNUAL');
  const [renewalDate, setRenewalDate] = useState('');
  const [adminNotes, setAdminNotes] = useState('');

  // Initial Admin User
  const [createAdmin, setCreateAdmin] = useState(true);
  const [adminName, setAdminName] = useState('');
  const [adminEmail, setAdminEmail] = useState('');
  const [adminPassword, setAdminPassword] = useState('');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleNameChange = (val: string) => {
    setName(val);
    if (!dashboardTitle || dashboardTitle === `${name} Admissions & Campaign Follow-Up`) {
      setDashboardTitle(`${val} Admissions & Campaign Follow-Up`);
    }
    if (!slug) {
      setSlug(
        val
          .toLowerCase()
          .replace(/[^a-z0-9]/g, '-')
          .replace(/-+/g, '-')
          .slice(0, 30)
      );
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const payload: any = {
        name,
        slug: slug.trim().toLowerCase(),
        dashboardTitle,
        logoUrl: logoUrl.trim() || null,
        primaryColor,
        timezone,
        dataMode,
        googleSheetId: dataMode === 'HYBRID_SHEET' ? googleSheetId.trim() || null : null,
        enableSheetWriteback,
        planType,
        renewalDate: renewalDate || null,
        adminNotes: adminNotes.trim() || null,
      };

      if (createAdmin && adminEmail && adminPassword) {
        payload.initialAdmin = {
          name: adminName.trim() || `${name} Admin`,
          email: adminEmail.trim(),
          password: adminPassword,
        };
      }

      const res = await createTenant(payload);
      onCreated(res.tenant);
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to create school tenant');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-xl max-w-2xl w-full max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
          <div>
            <h2 className="text-lg font-bold text-slate-900">Provision New School Tenant</h2>
            <p className="text-xs text-slate-500">Configure white-label branding, Google Sheet sync, and initial admin</p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 text-sm font-semibold">
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto space-y-6 flex-1 text-start">
          {error && (
            <div className="p-3 text-xs bg-red-50 border border-red-200 text-red-700 rounded-lg">
              {error}
            </div>
          )}

          {/* Basic Tenant Identity */}
          <div className="space-y-4">
            <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">1. School Identity</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">School Name *</label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => handleNameChange(e.target.value)}
                  placeholder="e.g. Greenwood International School"
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Subdomain Slug *</label>
                <div className="flex items-center">
                  <input
                    type="text"
                    required
                    pattern="^[a-z0-9-]+$"
                    value={slug}
                    onChange={(e) => setSlug(e.target.value.toLowerCase())}
                    placeholder="e.g. greenwood"
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-s-lg focus:ring-2 focus:ring-blue-500 focus:outline-none font-mono"
                  />
                  <span className="bg-slate-100 border border-s-0 border-slate-300 text-slate-500 text-xs px-2.5 py-2.5 rounded-e-lg font-mono">
                    .yourplatform.com
                  </span>
                </div>
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
          </div>

          {/* White-Labeling */}
          <div className="space-y-4 pt-4 border-t border-slate-100">
            <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">2. Silent White-Labeling</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">School Logo URL</label>
                <input
                  type="url"
                  value={logoUrl}
                  onChange={(e) => setLogoUrl(e.target.value)}
                  placeholder="https://example.com/logo.png"
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
              <label className="block text-xs font-medium text-slate-700 mb-1.5">Primary Brand Color</label>
              <div className="flex items-center gap-3">
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
                <div className="flex items-center gap-1.5 ms-2">
                  {PRESET_COLORS.map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setPrimaryColor(c)}
                      className={`w-6 h-6 rounded-full border ${primaryColor === c ? 'ring-2 ring-blue-500 scale-110' : 'border-slate-200'}`}
                      style={{ backgroundColor: c }}
                      title={c}
                    />
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Ingestion & Sync */}
          <div className="space-y-4 pt-4 border-t border-slate-100">
            <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">3. Google Sheets Integration</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Data Ingestion Mode</label>
                <select
                  value={dataMode}
                  onChange={(e) => setDataMode(e.target.value as any)}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none bg-white"
                >
                  <option value="HYBRID_SHEET">HYBRID_SHEET (Sync from Google Sheet)</option>
                  <option value="NATIVE_ONLY">NATIVE_ONLY (CSV / In-App Only)</option>
                </select>
              </div>

              {dataMode === 'HYBRID_SHEET' && (
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Google Sheet ID</label>
                  <input
                    type="text"
                    value={googleSheetId}
                    onChange={(e) => setGoogleSheetId(e.target.value)}
                    placeholder="e.g. 1BxiMVs0XRA5nFMdKvBdBZjgmUUq..."
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
                <span className="text-xs text-slate-700">
                  Enable Two-Way Write-Back (Counselor app notes write back to Google Sheet cells)
                </span>
              </label>
            )}
          </div>

          {/* Licensing & Billing */}
          <div className="space-y-4 pt-4 border-t border-slate-100">
            <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">4. License & Internal Notes</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Plan Type</label>
                <select
                  value={planType}
                  onChange={(e) => setPlanType(e.target.value as any)}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none bg-white"
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
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Internal Admin Notes (Hidden from School)</label>
              <textarea
                rows={2}
                value={adminNotes}
                onChange={(e) => setAdminNotes(e.target.value)}
                placeholder="Contract details, billing contact, notes..."
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
            </div>
          </div>

          {/* Initial School Admin Account */}
          <div className="space-y-4 pt-4 border-t border-slate-100">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">5. Provision School Admin</h3>
              <label className="flex items-center gap-1.5 text-xs text-slate-600 cursor-pointer">
                <input
                  type="checkbox"
                  checked={createAdmin}
                  onChange={(e) => setCreateAdmin(e.target.checked)}
                  className="rounded text-blue-600"
                />
                Provision initial admin now
              </label>
            </div>

            {createAdmin && (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-slate-50 p-3 rounded-xl border border-slate-200">
                <div>
                  <label className="block text-[11px] font-medium text-slate-700 mb-1">Admin Name</label>
                  <input
                    type="text"
                    value={adminName}
                    onChange={(e) => setAdminName(e.target.value)}
                    placeholder="e.g. Principal / Director"
                    className="w-full px-2.5 py-1.5 text-xs border border-slate-300 rounded-lg bg-white"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-slate-700 mb-1">Email *</label>
                  <input
                    type="email"
                    required={createAdmin}
                    value={adminEmail}
                    onChange={(e) => setAdminEmail(e.target.value)}
                    placeholder="admin@school.com"
                    className="w-full px-2.5 py-1.5 text-xs border border-slate-300 rounded-lg bg-white"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-slate-700 mb-1">Password *</label>
                  <input
                    type="password"
                    required={createAdmin}
                    value={adminPassword}
                    onChange={(e) => setAdminPassword(e.target.value)}
                    placeholder="Min 6 characters"
                    className="w-full px-2.5 py-1.5 text-xs border border-slate-300 rounded-lg bg-white"
                  />
                </div>
              </div>
            )}
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
              {loading ? 'Provisioning...' : 'Provision School Tenant'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
