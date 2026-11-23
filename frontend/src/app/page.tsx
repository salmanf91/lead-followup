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
        document.documentElement.style.setProperty('--brand-primary', '#4338CA');
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

  return (
    <div className="min-h-screen flex flex-col bg-[#F8FAFC] text-slate-900 font-sans antialiased">
      {/* Dev Navigation & Subdomain Switcher */}
      <header className="bg-slate-950/95 backdrop-blur-md text-slate-300 text-xs py-2 px-6 flex flex-wrap items-center justify-between gap-3 border-b border-slate-800/80">
        <div className="flex items-center gap-2.5">
          <span className="font-semibold text-white flex items-center gap-1.5">
            <Globe className="w-3.5 h-3.5 text-indigo-400" />
            Portal Switcher:
          </span>
          <button
            onClick={() => handleSlugSwitch('admin')}
            className={`px-3 py-1 rounded-xl text-xs font-medium transition ${
              activeSlug === 'admin'
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800'
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
              className="px-3 py-1 rounded-xl bg-slate-900 text-white placeholder-slate-500 border border-slate-800 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500 w-32"
            />
            <button
              type="submit"
              className="px-3 py-1 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-medium transition"
            >
              Go
            </button>
          </form>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-slate-400">Context:</span>
          <code className="bg-slate-900 border border-slate-800 px-2.5 py-0.5 rounded-lg text-indigo-400 font-mono text-xs">
            {activeSlug}.yourplatform.com
          </code>
        </div>
      </header>

      {/* Main Tenant Container */}
      <main className="flex-1 flex flex-col items-center justify-center p-4 sm:p-6">
        {error ? (
          <div className="max-w-md w-full bg-white rounded-3xl shadow-xl border border-slate-200/80 p-8 text-center animate-in fade-in zoom-in-95">
            <div className="w-14 h-14 bg-amber-50 text-amber-600 rounded-2xl flex items-center justify-center mx-auto mb-4 font-bold text-xl shadow-xs">
              <AlertCircle className="w-7 h-7" />
            </div>
            <h2 className="text-lg font-bold text-slate-900 mb-2">School Portal Not Found</h2>
            <p className="text-xs text-slate-500 mb-6 leading-relaxed">
              No active tenant was found for slug <code className="font-mono bg-slate-100 px-1.5 py-0.5 rounded text-indigo-600 font-semibold">{activeSlug}</code>.
              School tenants are provisioned dynamically via the Super Admin Console.
            </p>
            <button
              onClick={() => handleSlugSwitch('admin')}
              className="w-full py-2.5 px-4 bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-700 hover:to-blue-700 text-white text-xs font-semibold rounded-xl shadow-sm transition"
            >
              Return to Super Admin Portal
            </button>
          </div>
        ) : (
          <div className="max-w-md w-full bg-white rounded-3xl shadow-xl border border-slate-200/80 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            {/* Header with White-Label Branding */}
            <div className="p-8 text-center border-b border-slate-100 bg-slate-50/40">
              {tenantConfig?.logoUrl ? (
                <img
                  src={tenantConfig.logoUrl}
                  alt={tenantConfig.dashboardTitle}
                  className="h-12 mx-auto mb-4 object-contain"
                />
              ) : (
                <div
                  className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-4 text-white font-bold text-2xl shadow-md"
                  style={{ backgroundColor: 'var(--brand-primary, #4338CA)' }}
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

            {/* Content Area: Authenticated State vs Login Form */}
            <div className="p-8">
              {currentUser ? (
                <div className="space-y-5">
                  <div className="bg-emerald-50/90 border border-emerald-200/80 rounded-2xl p-4 text-start">
                    <div className="flex items-center gap-2">
                      <UserCheck className="w-4 h-4 text-emerald-600" />
                      <p className="text-xs font-bold text-emerald-900 uppercase tracking-wider">
                        Authenticated Session
                      </p>
                    </div>
                    <p className="text-sm font-semibold text-slate-900 mt-2">
                      {currentUser.name}
                    </p>
                    <p className="text-xs text-slate-600 font-mono">{currentUser.email}</p>
                    <div className="mt-3 flex items-center gap-2">
                      <span className="text-[11px] font-mono font-semibold px-2.5 py-0.5 rounded-md bg-emerald-100 text-emerald-800">
                        Role: {currentUser.role}
                      </span>
                    </div>
                  </div>

                  {currentUser.role === 'SUPER_ADMIN' && activeSlug !== 'admin' && (
                    <div className="p-3 bg-purple-50 border border-purple-200 rounded-xl text-start">
                      <p className="text-[11px] text-purple-900 font-medium">
                        🛡 You are viewing this school portal in <strong>Super Admin Support Mode</strong>.
                      </p>
                    </div>
                  )}

                  <div className="pt-2">
                    <button
                      onClick={handleLogout}
                      className="w-full py-2.5 px-4 rounded-xl text-xs sm:text-sm font-semibold border border-slate-200 text-slate-700 hover:bg-slate-50 transition shadow-xs"
                    >
                      Sign Out
                    </button>
                  </div>
                </div>
              ) : (
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
                    style={{ backgroundColor: 'var(--brand-primary, #4338CA)' }}
                    className="w-full py-2.5 px-4 rounded-xl text-white text-xs sm:text-sm font-semibold hover:opacity-95 transition shadow-sm disabled:opacity-50 flex items-center justify-center gap-2 mt-2"
                  >
                    <span>{submitting ? 'Authenticating...' : 'Sign In to Portal'}</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </form>
              )}
            </div>
          </div>
        )}
      </main>

      <footer className="py-4 text-center text-xs text-slate-400">
        Multi-Tenant Admissions & Campaign Follow-Up Platform
      </footer>
    </div>
  );
}
