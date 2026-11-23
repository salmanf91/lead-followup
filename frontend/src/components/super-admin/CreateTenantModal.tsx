'use client';

import { useState } from 'react';
import {
  Building2,
  X,
  Globe,
  Palette,
  FileSpreadsheet,
  Calendar,
  UserPlus,
  ShieldCheck,
  Sparkles,
  Info,
} from 'lucide-react';
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
  '#7C3AED', // Vivid Violet
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
      const createdRecord: TenantRecord = (res as any).tenant || (res as any);
      onCreated(createdRecord);
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to create school tenant');
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
              <Building2 className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">Provision New School Tenant</h2>
              <p className="text-xs text-slate-500">Configure white-label portal, data pipeline & admin credentials</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-xl flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto space-y-6 flex-1 text-start">
          {error && (
            <div className="p-3.5 text-xs bg-red-50 border border-red-200 text-red-700 rounded-xl font-medium">
              ⚠ {error}
            </div>
          )}

          {/* Section 1: Core Institution Details */}
          <div className="space-y-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
              <Building2 className="w-3.5 h-3.5 text-indigo-600" />
              <span>Institution Identity & Subdomain</span>
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
                  onChange={(e) => handleNameChange(e.target.value)}
                  placeholder="e.g. Al-Qalam Academy"
                  className="w-full px-3.5 py-2 text-xs sm:text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 focus:outline-none transition"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Subdomain Slug <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <input
                    type="text"
                    required
                    value={slug}
                    onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
                    placeholder="al-qalam"
                    className="w-full px-3.5 py-2 text-xs sm:text-sm font-mono bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 focus:outline-none transition"
                  />
                </div>
                <p className="text-[11px] text-slate-400 mt-1 font-mono">
                  Portal URL: <span className="text-indigo-600 font-semibold">{slug || 'slug'}.yourplatform.com</span>
                </p>
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
                placeholder="Al-Qalam Admissions & Follow-Up Portal"
                className="w-full px-3.5 py-2 text-xs sm:text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 focus:outline-none transition"
              />
            </div>
          </div>

          {/* Section 2: White-Label Branding */}
          <div className="space-y-4 pt-4 border-t border-slate-100">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
              <Palette className="w-3.5 h-3.5 text-indigo-600" />
              <span>White-Label Branding & Regional Settings</span>
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  School Logo URL (Optional)
                </label>
                <input
                  type="url"
                  value={logoUrl}
                  onChange={(e) => setLogoUrl(e.target.value)}
                  placeholder="https://example.com/logo.png"
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

            {/* Color Palette Picker */}
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

          {/* Section 3: Data Ingestion & Google Sheets */}
          <div className="space-y-4 pt-4 border-t border-slate-100">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
              <FileSpreadsheet className="w-3.5 h-3.5 text-indigo-600" />
              <span>Data Pipeline & Sync Mode</span>
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">Data Mode</label>
                <select
                  value={dataMode}
                  onChange={(e) => setDataMode(e.target.value as any)}
                  className="w-full px-3.5 py-2 text-xs sm:text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 focus:outline-none transition"
                >
                  <option value="HYBRID_SHEET">HYBRID_SHEET (Google Sheet Sync + DB)</option>
                  <option value="NATIVE_ONLY">NATIVE_ONLY (Postgres DB Direct)</option>
                </select>
              </div>

              {dataMode === 'HYBRID_SHEET' && (
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    Google Spreadsheet ID
                  </label>
                  <input
                    type="text"
                    value={googleSheetId}
                    onChange={(e) => setGoogleSheetId(e.target.value)}
                    placeholder="1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms"
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
                  Enable Bi-Directional Writeback (Push counselor follow-up changes back to Google Sheet)
                </span>
              </label>
            )}
          </div>

          {/* Section 4: Subscription & Licensing */}
          <div className="space-y-4 pt-4 border-t border-slate-100">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-indigo-600" />
              <span>Subscription & Licensing</span>
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">Plan Type</label>
                <select
                  value={planType}
                  onChange={(e) => setPlanType(e.target.value as any)}
                  className="w-full px-3.5 py-2 text-xs sm:text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 focus:outline-none transition"
                >
                  <option value="ANNUAL">ANNUAL (Yearly License)</option>
                  <option value="ONE_TIME">ONE_TIME (Campaign License)</option>
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
                placeholder="Billing notes, special contract terms, or counselor quota..."
                className="w-full px-3.5 py-2 text-xs sm:text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 focus:outline-none transition"
              />
            </div>
          </div>

          {/* Section 5: Initial School Admin User */}
          <div className="space-y-4 pt-4 border-t border-slate-100">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                <UserPlus className="w-3.5 h-3.5 text-indigo-600" />
                <span>Initial School Administrator Account</span>
              </h3>
              <label className="flex items-center gap-1.5 cursor-pointer text-xs font-medium text-indigo-600">
                <input
                  type="checkbox"
                  checked={createAdmin}
                  onChange={(e) => setCreateAdmin(e.target.checked)}
                  className="w-3.5 h-3.5 text-indigo-600 rounded border-slate-300"
                />
                <span>Provision Admin Now</span>
              </label>
            </div>

            {createAdmin && (
              <div className="p-4 bg-indigo-50/50 border border-indigo-100 rounded-2xl space-y-3 animate-in fade-in">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Admin Full Name</label>
                    <input
                      type="text"
                      value={adminName}
                      onChange={(e) => setAdminName(e.target.value)}
                      placeholder="Principal / Admissions Head"
                      className="w-full px-3 py-2 text-xs sm:text-sm bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Admin Email <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="email"
                      required={createAdmin}
                      value={adminEmail}
                      onChange={(e) => setAdminEmail(e.target.value)}
                      placeholder="admin@school.edu"
                      className="w-full px-3 py-2 text-xs sm:text-sm bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 focus:outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Initial Temporary Password <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="password"
                    required={createAdmin}
                    value={adminPassword}
                    onChange={(e) => setAdminPassword(e.target.value)}
                    placeholder="Minimum 6 characters"
                    className="w-full px-3 py-2 text-xs sm:text-sm bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 focus:outline-none"
                  />
                  <p className="text-[11px] text-slate-500 mt-1">
                    The school admin can use this password to log in directly at <code className="font-mono text-indigo-600">{slug || 'slug'}.yourplatform.com</code>.
                  </p>
                </div>
              </div>
            )}
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
              className="px-5 py-2.5 text-xs sm:text-sm font-semibold text-white bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-700 hover:to-blue-700 rounded-xl shadow-md shadow-indigo-600/20 transition disabled:opacity-50"
            >
              {loading ? 'Provisioning School...' : 'Provision School Portal'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
