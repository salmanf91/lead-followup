'use client';

import { useEffect, useState } from 'react';
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
        document.documentElement.style.setProperty('--brand-primary', '#1E3A8A');
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
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-4 border-slate-300 border-t-slate-800 rounded-full animate-spin"></div>
          <p className="text-sm text-slate-500">Resolving portal context...</p>
        </div>
      </div>
    );
  }

  // If user is a verified SUPER_ADMIN and on the admin context, render the Super Admin Console!
  if (currentUser?.role === 'SUPER_ADMIN' && activeSlug === 'admin') {
    return (
      <div>
        {/* Context bar to quickly test switching to provisioned schools */}
        <header className="bg-slate-950 text-slate-400 text-xs py-1.5 px-4 flex items-center justify-between border-b border-slate-800">
          <div className="flex items-center gap-2">
            <span className="text-slate-300 font-medium">Domain Simulator:</span>
            <span className="text-amber-400 font-mono">admin.yourplatform.com</span>
          </div>
          <div className="flex items-center gap-2">
            <span>Switch to school subdomain:</span>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSlugSwitch(customSlugInput);
              }}
              className="flex items-center gap-1"
            >
              <input
                type="text"
                value={customSlugInput}
                onChange={(e) => setCustomSlugInput(e.target.value)}
                placeholder="school-slug"
                className="px-2 py-0.5 rounded bg-slate-800 text-white border border-slate-700 text-xs w-28"
              />
              <button
                type="submit"
                className="px-2 py-0.5 rounded bg-slate-700 text-white text-xs hover:bg-slate-600"
              >
                Go
              </button>
            </form>
          </div>
        </header>

        <SuperAdminDashboard
          currentUser={currentUser}
          onLogout={handleLogout}
          onImpersonateSuccess={(slug) => {
            handleSlugSwitch(slug);
          }}
        />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-slate-50">
      {/* Dev Context Bar */}
      <header className="bg-slate-900 text-slate-300 text-xs py-2 px-4 flex flex-wrap items-center justify-between gap-2 border-b border-slate-800">
        <div className="flex items-center gap-2">
          <span className="font-semibold text-white">Subdomain Switcher:</span>
          <button
            onClick={() => handleSlugSwitch('admin')}
            className={`px-2.5 py-1 rounded text-xs transition ${
              activeSlug === 'admin'
                ? 'bg-purple-600 text-white font-medium'
                : 'bg-slate-800 hover:bg-slate-700'
            }`}
          >
            admin (Super Admin)
          </button>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSlugSwitch(customSlugInput);
            }}
            className="flex items-center gap-1 ms-2"
          >
            <input
              type="text"
              value={customSlugInput}
              onChange={(e) => setCustomSlugInput(e.target.value)}
              placeholder="e.g. school-slug"
              className="px-2 py-0.5 rounded bg-slate-800 text-white placeholder-slate-500 border border-slate-700 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
            <button
              type="submit"
              className="px-2 py-0.5 rounded bg-slate-700 hover:bg-slate-600 text-white text-xs"
            >
              Go
            </button>
          </form>
        </div>
        <div className="flex items-center gap-2">
          <span>Active Context:</span>
          <code className="bg-slate-800 px-2 py-0.5 rounded text-amber-400 font-mono text-xs">
            {activeSlug}.yourplatform.com
          </code>
        </div>
      </header>

      {/* Main Tenant Container */}
      <main className="flex-1 flex flex-col items-center justify-center p-4">
        {error ? (
          <div className="max-w-md w-full bg-white rounded-xl shadow-sm border border-slate-200 p-6 text-center">
            <div className="w-12 h-12 bg-amber-100 text-amber-600 rounded-full flex items-center justify-center mx-auto mb-4 font-bold text-xl">
              !
            </div>
            <h2 className="text-lg font-semibold text-slate-900 mb-2">School Portal Not Found</h2>
            <p className="text-sm text-slate-600 mb-4">
              No active tenant found for slug <code className="font-mono bg-slate-100 px-1 py-0.5 rounded">{activeSlug}</code>.
              School tenants are provisioned dynamically via the Super Admin Console.
            </p>
            <button
              onClick={() => handleSlugSwitch('admin')}
              className="text-xs bg-purple-600 text-white px-3 py-1.5 rounded-lg hover:bg-purple-700 transition"
            >
              Go to Super Admin Portal
            </button>
          </div>
        ) : (
          <div className="max-w-md w-full bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
            {/* Header with White-Label Branding */}
            <div className="p-8 text-center border-b border-slate-100">
              {tenantConfig?.logoUrl ? (
                <img
                  src={tenantConfig.logoUrl}
                  alt={tenantConfig.dashboardTitle}
                  className="h-12 mx-auto mb-4 object-contain"
                />
              ) : (
                <div
                  className="w-12 h-12 rounded-xl flex items-center justify-center mx-auto mb-4 text-white font-bold text-xl"
                  style={{ backgroundColor: 'var(--brand-primary, #1E3A8A)' }}
                >
                  {tenantConfig?.dashboardTitle?.charAt(0) || 'P'}
                </div>
              )}
              <h1 className="text-xl font-bold text-slate-900">
                {tenantConfig?.dashboardTitle || 'Portal Login'}
              </h1>
              {tenantConfig?.timezone && (
                <p className="text-xs text-slate-500 mt-1">
                  Timezone: {tenantConfig.timezone}
                </p>
              )}
            </div>

            {/* Content Area: Authenticated State vs Login Form */}
            <div className="p-8">
              {currentUser ? (
                <div className="space-y-4">
                  <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 text-start">
                    <p className="text-xs font-semibold text-emerald-800 uppercase tracking-wider">
                      Authenticated Session
                    </p>
                    <p className="text-sm font-medium text-slate-900 mt-1">
                      {currentUser.name}
                    </p>
                    <p className="text-xs text-slate-600">{currentUser.email}</p>
                    <div className="mt-2 flex items-center gap-2">
                      <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-emerald-100 text-emerald-800">
                        Role: {currentUser.role}
                      </span>
                    </div>
                  </div>

                  <div className="text-center pt-2">
                    <p className="text-xs text-slate-500 mb-4">
                      Session verified via HttpOnly JWT cookie.
                    </p>
                    <button
                      onClick={handleLogout}
                      className="w-full py-2.5 px-4 rounded-xl text-sm font-medium border border-slate-300 text-slate-700 hover:bg-slate-50 transition"
                    >
                      Sign Out
                    </button>
                  </div>
                </div>
              ) : (
                <form onSubmit={handleLogin} className="space-y-4">
                  {loginError && (
                    <div className="p-3 text-xs bg-red-50 border border-red-200 text-red-700 rounded-lg text-start">
                      {loginError}
                    </div>
                  )}

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1 text-start">
                      Email Address
                    </label>
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder={
                        activeSlug === 'admin'
                          ? 'admin@platform.com'
                          : 'user@school.edu'
                      }
                      className="w-full px-3.5 py-2.5 text-sm rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500 text-start"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1 text-start">
                      Password
                    </label>
                    <input
                      type="password"
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••••••"
                      className="w-full px-3.5 py-2.5 text-sm rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500 text-start"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={submitting}
                    style={{ backgroundColor: 'var(--brand-primary, #1E3A8A)' }}
                    className="w-full py-2.5 px-4 rounded-xl text-white text-sm font-medium hover:opacity-95 transition disabled:opacity-50"
                  >
                    {submitting ? 'Authenticating...' : 'Sign In'}
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
