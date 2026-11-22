'use client';

import { useEffect, useState } from 'react';
import { getTenantConfig, getMe, login, logout } from '../lib/api';
import { PublicTenantConfig, AuthUser } from '../types';

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

  // Subdomain slug (defaults to 'yis' if running on plain localhost for dev demo)
  const [activeSlug, setActiveSlug] = useState<string>('yis');

  const loadConfigAndUser = async (slugToLoad: string) => {
    setLoading(true);
    setError(null);
    try {
      const config = await getTenantConfig(slugToLoad);
      setTenantConfig(config);

      // Inject dynamic tenant primary color into CSS variable
      if (config.primaryColor) {
        document.documentElement.style.setProperty('--brand-primary', config.primaryColor);
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
    setActiveSlug(newSlug);
    loadConfigAndUser(newSlug);
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
          <p className="text-sm text-slate-500">Loading school portal...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-slate-50">
      {/* Dev Switcher Bar (useful for testing subdomains on localhost) */}
      <header className="bg-slate-900 text-slate-300 text-xs py-2 px-4 flex items-center justify-between border-b border-slate-800">
        <div className="flex items-center gap-2">
          <span className="font-semibold text-white">Dev Portal Switcher:</span>
          <button
            onClick={() => handleSlugSwitch('yis')}
            className={`px-2 py-0.5 rounded ${activeSlug === 'yis' ? 'bg-blue-600 text-white font-medium' : 'bg-slate-800 hover:bg-slate-700'}`}
          >
            YIS School Portal
          </button>
          <button
            onClick={() => handleSlugSwitch('admin')}
            className={`px-2 py-0.5 rounded ${activeSlug === 'admin' ? 'bg-purple-600 text-white font-medium' : 'bg-slate-800 hover:bg-slate-700'}`}
          >
            Super Admin Portal
          </button>
        </div>
        <div>
          <span>Active Context: </span>
          <code className="bg-slate-800 px-1 py-0.5 rounded text-amber-400 font-mono">
            {activeSlug}.yourplatform.com
          </code>
        </div>
      </header>

      {/* Main Tenant Container */}
      <main className="flex-1 flex flex-col items-center justify-center p-4">
        {error ? (
          <div className="max-w-md w-full bg-white rounded-xl shadow-sm border border-slate-200 p-6 text-center">
            <div className="w-12 h-12 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto mb-4 font-bold text-xl">
              !
            </div>
            <h2 className="text-lg font-semibold text-slate-900 mb-2">Portal Unavailable</h2>
            <p className="text-sm text-slate-600 mb-4">{error}</p>
            <button
              onClick={() => handleSlugSwitch('yis')}
              className="text-xs text-blue-600 hover:underline"
            >
              Switch back to sample school
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
                  {tenantConfig?.dashboardTitle?.charAt(0) || 'S'}
                </div>
              )}
              <h1 className="text-xl font-bold text-slate-900">
                {tenantConfig?.dashboardTitle || 'Admissions Portal'}
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
                      Milestone 1 auth verification passed! Session verified via HttpOnly JWT cookie.
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
                          : 'admin@yis.edu.sa or counselor@yis.edu.sa'
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

                  <div className="pt-2 text-center text-xs text-slate-400">
                    <p>Demo Credentials:</p>
                    <p className="font-mono mt-0.5">
                      {activeSlug === 'admin'
                        ? 'admin@platform.com / AdminPassword123!'
                        : 'admin@yis.edu.sa / SchoolAdmin123!'}
                    </p>
                  </div>
                </form>
              )}
            </div>
          </div>
        )}
      </main>

      <footer className="py-4 text-center text-xs text-slate-400">
        Milestone 1 — Subdomain Resolver & RBAC Auth Verification
      </footer>
    </div>
  );
}

