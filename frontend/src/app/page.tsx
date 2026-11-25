'use client';

import { useEffect, useState } from 'react';
import {
  Building2,
  Shield,
  ArrowRight,
  Globe,
  Lock,
  Mail,
  UserCheck,
  AlertCircle,
  Clock,
  Sparkles,
} from 'lucide-react';
import { getTenantConfig, getMe, login, logout } from '../lib/api';
import { PublicTenantConfig, AuthUser } from '../types';
import SuperAdminDashboard from '../components/super-admin/SuperAdminDashboard';
import SchoolDashboard from '../components/school-dashboard/SchoolDashboard';
import ChilliPagesLogo from '../components/common/ChilliPagesLogo';

export default function Home() {
  const [tenantConfig, setTenantConfig] = useState<PublicTenantConfig | null>(null);
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Login form state
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);

  // Subdomain slug (defaults to 'admin' for initial Super Admin setup)
  const [activeSlug, setActiveSlug] = useState<string>('admin');
  const [customSlugInput, setCustomSlugInput] = useState<string>('');

  const loadConfigAndUser = async (slugToLoad: string) => {
    setLoading(true);
    setError(null);
    try {
      const config = await getTenantConfig(slugToLoad);
      setTenantConfig(config);

      // Inject dynamic tenant primary color into CSS variable
      if (config.primaryColor) {
        document.documentElement.style.setProperty('--brand-primary', config.primaryColor);
      } else {
        document.documentElement.style.setProperty('--brand-primary', '#10457C');
      }

      // Check if user is already authenticated
      try {
        const authData = await getMe();
        setCurrentUser(authData.user);
      } catch {
        setCurrentUser(null);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load school portal');
      setTenantConfig(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // Detect subdomain from browser hostname if possible
    if (typeof window !== 'undefined') {
      const host = window.location.host;
      const hostname = host.split(':')[0].toLowerCase();
      const parts = hostname.split('.');
      if (parts.length === 2 && parts[1] === 'localhost') {
        setActiveSlug(parts[0]);
        loadConfigAndUser(parts[0]);
        return;
      }
      if (parts.length >= 3) {
        const slug = parts[0] === 'www' ? parts[1] : parts[0];
        setActiveSlug(slug);
        loadConfigAndUser(slug);
        return;
      }
    }
    loadConfigAndUser(activeSlug);
  }, []);

  const handleSlugSwitch = (newSlug: string) => {
    const slug = newSlug.trim().toLowerCase();
    if (!slug) return;
    setActiveSlug(slug);
    loadConfigAndUser(slug);
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setLoginError(null);
    try {
      const res = await login(email, password, activeSlug);
      setCurrentUser(res.user);
      setEmail('');
      setPassword('');
    } catch (err: any) {
      setLoginError(err.message || 'Login failed');
    } finally {
      setSubmitting(false);
    }
  };

  const handleLogout = async () => {
    try {
      await logout();
      setCurrentUser(null);
    } catch (err) {
      console.error('Logout error:', err);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F8FAFC]">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-3 border-indigo-600/20 border-t-indigo-600 rounded-full animate-spin"></div>
          <p className="text-xs font-medium text-slate-500 tracking-wide">Resolving portal context...</p>
        </div>
      </div>
    );
  }

  // If user is a verified SUPER_ADMIN and on the admin context, render the Super Admin Console!
  if (currentUser?.role === 'SUPER_ADMIN' && activeSlug === 'admin') {
    return (
      <SuperAdminDashboard
        currentUser={currentUser}
        onLogout={handleLogout}
        onImpersonateSuccess={(slug) => {
          handleSlugSwitch(slug);
        }}
      />
    );
  }

  // If user is authenticated (as SCHOOL_ADMIN, COUNSELOR, or SUPER_ADMIN impersonating a school), render the full Client Dashboard!
  if (currentUser) {
    return (
      <SchoolDashboard
        currentUser={currentUser}
        tenantConfig={tenantConfig}
        activeSlug={activeSlug}
        onLogout={handleLogout}
      />
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-[#F8FAFC] text-slate-900 font-sans antialiased">
      {/* Top Portal Switcher Bar - Aligned to Dashboard Header */}
      <header className="bg-white/95 backdrop-blur-md text-slate-700 text-xs py-3 px-4 sm:px-6 flex flex-wrap items-center justify-between gap-3 border-b border-slate-200/80 shadow-xs">
        <div className="flex items-center gap-3">
          <div className="p-1.5 bg-white rounded-xl border border-slate-200/80 shadow-2xs flex items-center justify-center">
            <ChilliPagesLogo height={20} className="h-5 w-auto" />
          </div>
          <span className="w-px h-4 bg-slate-200" />
          <span className="font-semibold text-slate-800 flex items-center gap-1.5 text-xs">
            <Globe className="w-3.5 h-3.5 text-[#10457C]" />
            Portal Switcher:
          </span>
          <button
            onClick={() => handleSlugSwitch('admin')}
            className={`px-3 py-1 rounded-xl text-xs font-semibold transition ${
              activeSlug === 'admin'
                ? 'bg-[#10457C] text-white shadow-xs'
                : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200/80'
            }`}
          >
            admin (Super Admin)
          </button>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSlugSwitch(customSlugInput);
            }}
            className="flex items-center gap-1.5 ms-2"
          >
            <input
              type="text"
              value={customSlugInput}
              onChange={(e) => setCustomSlugInput(e.target.value)}
              placeholder="e.g. school-slug"
              className="px-3 py-1 rounded-xl bg-white text-slate-900 placeholder-slate-400 border border-slate-200 text-xs focus:outline-none focus:ring-1 focus:ring-[#10457C] w-32 shadow-2xs"
            />
            <button
              type="submit"
              className="px-3 py-1 rounded-xl bg-[#10457C] hover:bg-[#0A2B4E] text-white text-xs font-semibold transition shadow-2xs"
            >
              Go
            </button>
          </form>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-slate-400 text-xs">Context:</span>
          <code className="bg-slate-100 border border-slate-200/80 px-2.5 py-0.5 rounded-lg text-slate-700 font-mono text-xs font-medium">
            {activeSlug}.yourplatform.com
          </code>
        </div>
      </header>

      {/* Main Tenant Container */}
      <main className="flex-1 flex flex-col items-center justify-center p-4 sm:p-6">
        {error ? (
          <div className="max-w-md w-full bg-white rounded-3xl shadow-bespoke border border-slate-200/90 p-8 text-center animate-in fade-in zoom-in-95">
            <div className="w-14 h-14 bg-amber-50 text-amber-600 rounded-2xl flex items-center justify-center mx-auto mb-4 font-bold text-xl shadow-xs">
              <AlertCircle className="w-7 h-7" />
            </div>
            <h2 className="text-lg font-bold text-slate-900 mb-2">
              {activeSlug === 'admin' ? 'Portal Connection Error' : 'School Portal Not Found'}
            </h2>
            <p className="text-xs text-slate-500 mb-6 leading-relaxed">
              {activeSlug === 'admin'
                ? `Unable to connect to the backend API: ${error}. Please verify the backend service is running.`
                : `No active tenant was found for slug "${activeSlug}". School tenants are provisioned dynamically via the Super Admin Console.`}
            </p>
            <button
              onClick={() => handleSlugSwitch('admin')}
              className="w-full py-2.5 px-4 bg-[#10457C] hover:bg-[#0A2B4E] text-white text-xs font-bold rounded-xl shadow-sm transition"
            >
              Retry Super Admin Portal
            </button>
          </div>
        ) : (
          <div className="max-w-md w-full bg-white rounded-3xl shadow-bespoke border border-slate-200/90 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            {/* Header with White-Label Branding */}
            <div className="p-8 text-center border-b border-slate-100 bg-slate-50/40">
              {tenantConfig?.logoUrl ? (
                <div className="inline-block p-2.5 bg-white rounded-2xl border border-slate-200/90 shadow-2xs mb-4">
                  <img
                    src={tenantConfig.logoUrl}
                    alt={tenantConfig.dashboardTitle}
                    className="h-12 max-w-[200px] object-contain"
                  />
                </div>
              ) : (
                <div
                  className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-4 text-white font-black text-2xl shadow-sm"
                  style={{ backgroundColor: 'var(--brand-primary, #10457C)' }}
                >
                  {tenantConfig?.dashboardTitle?.charAt(0) || 'P'}
                </div>
              )}
              <h1 className="text-xl font-extrabold text-slate-900 tracking-tight">
                {tenantConfig?.dashboardTitle || 'Portal Sign In'}
              </h1>
              {tenantConfig?.timezone && (
                <p className="text-xs text-slate-400 mt-1 flex items-center justify-center gap-1">
                  <Clock className="w-3 h-3" />
                  Timezone: {tenantConfig.timezone}
                </p>
              )}
            </div>

            {/* Content Area: Login Form */}
            <div className="p-8">
              <form onSubmit={handleLogin} className="space-y-4">
                {loginError && (
                  <div className="p-3 text-xs bg-red-50 border border-red-200 text-red-700 rounded-xl text-start font-medium flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
                    <span>{loginError}</span>
                  </div>
                )}

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5 text-start">
                      Email Address
                    </label>
                    <div className="relative">
                      <Mail className="w-4 h-4 text-slate-400 absolute start-3.5 top-1/2 -translate-y-1/2" />
                      <input
                        type="email"
                        required
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder={
                          activeSlug === 'admin'
                            ? 'admin@platform.com'
                            : 'counselor@school.edu'
                        }
                        className="w-full ps-10 pe-3.5 py-2.5 text-xs sm:text-sm rounded-xl bg-slate-50 border border-slate-200 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 text-start transition"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5 text-start">
                      Password
                    </label>
                    <div className="relative">
                      <Lock className="w-4 h-4 text-slate-400 absolute start-3.5 top-1/2 -translate-y-1/2" />
                      <input
                        type="password"
                        required
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="••••••••••••"
                        className="w-full ps-10 pe-3.5 py-2.5 text-xs sm:text-sm rounded-xl bg-slate-50 border border-slate-200 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 text-start transition"
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={submitting}
                    style={{ backgroundColor: 'var(--brand-primary, #10457C)' }}
                    className="w-full py-2.5 px-4 rounded-xl text-white text-xs sm:text-sm font-bold hover:opacity-95 transition shadow-sm disabled:opacity-50 flex items-center justify-center gap-2 mt-2"
                  >
                    <span>{submitting ? 'Authenticating...' : 'Sign In to Portal'}</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </form>
            </div>
          </div>
        )}
      </main>

      <footer className="py-4 text-center text-xs text-slate-400 flex flex-col items-center gap-1">
        <ChilliPagesLogo height={16} className="h-3.5 w-auto grayscale opacity-40 hover:grayscale-0 hover:opacity-80 transition" />
        <span>Multi-Tenant Admissions & Campaign Follow-Up Platform</span>
      </footer>
    </div>
  );
}
