'use client';

import { useEffect, useState } from 'react';
import {
  Users,
  X,
  Plus,
  KeyRound,
  ShieldCheck,
  CheckCircle2,
  XCircle,
  RefreshCw,
  UserCheck,
  Lock,
} from 'lucide-react';
import { getTenantUsers, createTenantUser, updateTenantUser } from '../../lib/api';
import { TenantRecord, TenantUser } from '../../types';

interface Props {
  tenant: TenantRecord;
  isOpen: boolean;
  onClose: () => void;
  onUserCountChanged?: () => void;
}

export default function TenantUsersModal({ tenant, isOpen, onClose, onUserCountChanged }: Props) {
  const [users, setUsers] = useState<TenantUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // New user form state
  const [showAddForm, setShowAddForm] = useState(false);
  const [newName, setNewName] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newRole, setNewRole] = useState<'SCHOOL_ADMIN' | 'COUNSELOR'>('COUNSELOR');
  const [creating, setCreating] = useState(false);

  // Password reset prompt state
  const [resettingUserId, setResettingUserId] = useState<string | null>(null);
  const [newPassInput, setNewPassInput] = useState('');

  const fetchUsers = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getTenantUsers(tenant.id);
      setUsers(data);
    } catch (err: any) {
      setError(err.message || 'Failed to load users');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchUsers();
    }
  }, [isOpen, tenant.id]);

  if (!isOpen) return null;

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreating(true);
    setError(null);
    try {
      const user = await createTenantUser(tenant.id, {
        name: newName.trim(),
        email: newEmail.trim(),
        password: newPassword,
        role: newRole,
      });
      setUsers([...users, user]);
      setNewName('');
      setNewEmail('');
      setNewPassword('');
      setShowAddForm(false);
      onUserCountChanged?.();
    } catch (err: any) {
      setError(err.message || 'Failed to create user');
    } finally {
      setCreating(false);
    }
  };

  const handleToggleStatus = async (user: TenantUser) => {
    try {
      const updated = await updateTenantUser(user.id, { isActive: !user.is_active });
      setUsers(users.map((u) => (u.id === user.id ? { ...u, is_active: updated.is_active } : u)));
    } catch (err: any) {
      alert(err.message || 'Failed to update user status');
    }
  };

  const handleRoleSwitch = async (user: TenantUser) => {
    const nextRole = user.role === 'SCHOOL_ADMIN' ? 'COUNSELOR' : 'SCHOOL_ADMIN';
    try {
      const updated = await updateTenantUser(user.id, { role: nextRole });
      setUsers(users.map((u) => (u.id === user.id ? { ...u, role: updated.role } : u)));
    } catch (err: any) {
      alert(err.message || 'Failed to switch role');
    }
  };

  const handlePasswordReset = async (userId: string) => {
    if (!newPassInput || newPassInput.length < 6) {
      alert('Password must be at least 6 characters');
      return;
    }
    try {
      await updateTenantUser(userId, { password: newPassInput });
      alert('Password reset successfully!');
      setResettingUserId(null);
      setNewPassInput('');
    } catch (err: any) {
      alert(err.message || 'Failed to reset password');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="bg-white rounded-3xl shadow-2xl border border-slate-200/80 max-w-2xl w-full max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/70">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center shadow-xs">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">Manage Users: {tenant.name}</h2>
              <p className="text-xs text-slate-500 font-mono">
                Subdomain: <span className="text-indigo-600 font-semibold">{tenant.slug}.yourplatform.com</span>
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

        {/* Content Area */}
        <div className="p-6 overflow-y-auto space-y-5 flex-1">
          {error && (
            <div className="p-3 text-xs bg-red-50 border border-red-200 text-red-700 rounded-xl font-medium">
              ⚠ {error}
            </div>
          )}

          {/* Action Row */}
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Enrolled Staff & Counselors ({users.length})
            </p>
            <button
              onClick={() => setShowAddForm(!showAddForm)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-xl shadow-xs transition"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>{showAddForm ? 'Close Form' : 'Enroll New User'}</span>
            </button>
          </div>

          {/* Add User Form Drawer */}
          {showAddForm && (
            <form
              onSubmit={handleCreateUser}
              className="p-4 bg-indigo-50/50 border border-indigo-100 rounded-2xl space-y-3 animate-in fade-in"
            >
              <h3 className="text-xs font-bold uppercase tracking-wider text-indigo-900 flex items-center gap-1">
                <span>Enroll Staff Member</span>
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Full Name</label>
                  <input
                    type="text"
                    required
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    placeholder="e.g. Sara Al-Hassan"
                    className="w-full px-3 py-2 text-xs sm:text-sm bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Email Address</label>
                  <input
                    type="email"
                    required
                    value={newEmail}
                    onChange={(e) => setNewEmail(e.target.value)}
                    placeholder="sara@school.edu"
                    className="w-full px-3 py-2 text-xs sm:text-sm bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Password (min. 6 chars)
                  </label>
                  <input
                    type="password"
                    required
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="••••••••••••"
                    className="w-full px-3 py-2 text-xs sm:text-sm bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Role Permission</label>
                  <select
                    value={newRole}
                    onChange={(e) => setNewRole(e.target.value as any)}
                    className="w-full px-3 py-2 text-xs sm:text-sm bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 focus:outline-none"
                  >
                    <option value="COUNSELOR">COUNSELOR (Lead Queue & Follow-Ups)</option>
                    <option value="SCHOOL_ADMIN">SCHOOL_ADMIN (School Lead Management & Roster)</option>
                  </select>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddForm(false)}
                  className="px-3 py-1.5 text-xs text-slate-600 hover:text-slate-800 rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creating}
                  className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-xl shadow-xs transition disabled:opacity-50"
                >
                  {creating ? 'Saving...' : 'Add User'}
                </button>
              </div>
            </form>
          )}

          {/* Reset Password Inline Modal Prompt */}
          {resettingUserId && (
            <div className="p-4 bg-amber-50/70 border border-amber-200 rounded-2xl space-y-2 animate-in fade-in">
              <p className="text-xs font-semibold text-amber-900 flex items-center gap-1.5">
                <KeyRound className="w-3.5 h-3.5" />
                <span>Reset User Password</span>
              </p>
              <div className="flex items-center gap-2">
                <input
                  type="password"
                  value={newPassInput}
                  onChange={(e) => setNewPassInput(e.target.value)}
                  placeholder="Enter new password (min. 6 chars)"
                  className="flex-1 px-3 py-1.5 text-xs bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500/20"
                />
                <button
                  onClick={() => handlePasswordReset(resettingUserId)}
                  className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold rounded-xl transition"
                >
                  Confirm Reset
                </button>
                <button
                  onClick={() => {
                    setResettingUserId(null);
                    setNewPassInput('');
                  }}
                  className="px-2.5 py-1.5 text-xs text-slate-600 hover:text-slate-800"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {/* Users List Table */}
          {loading ? (
            <div className="py-12 flex flex-col items-center justify-center gap-2 text-slate-400 text-xs">
              <RefreshCw className="w-5 h-5 animate-spin text-indigo-600" />
              <span>Loading staff roster...</span>
            </div>
          ) : users.length === 0 ? (
            <div className="py-12 text-center text-xs text-slate-400 bg-slate-50 rounded-2xl border border-dashed border-slate-200">
              No users provisioned for this school yet. Click &quot;Enroll New User&quot; above to create the first account.
            </div>
          ) : (
            <div className="border border-slate-200/80 rounded-2xl overflow-hidden">
              <table className="w-full text-start text-xs">
                <thead>
                  <tr className="bg-slate-50/80 border-b border-slate-200/80 text-slate-500 font-semibold uppercase tracking-wider text-[11px]">
                    <th className="py-3 px-4 text-start">Name & Email</th>
                    <th className="py-3 px-4 text-start">Role</th>
                    <th className="py-3 px-4 text-start">Status</th>
                    <th className="py-3 px-4 text-end">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  {users.map((u) => (
                    <tr key={u.id} className="hover:bg-slate-50/60 transition">
                      <td className="py-3 px-4">
                        <div className="font-semibold text-slate-900">{u.name}</div>
                        <div className="text-[11px] font-mono text-slate-400">{u.email}</div>
                      </td>

                      <td className="py-3 px-4">
                        <button
                          onClick={() => handleRoleSwitch(u)}
                          className={`px-2 py-0.5 rounded-md font-mono text-[10px] font-bold border transition ${
                            u.role === 'SCHOOL_ADMIN'
                              ? 'bg-purple-50 text-purple-700 border-purple-200 hover:bg-purple-100'
                              : 'bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100'
                          }`}
                          title="Click to toggle between SCHOOL_ADMIN and COUNSELOR"
                        >
                          {u.role} ⇄
                        </button>
                      </td>

                      <td className="py-3 px-4">
                        <button
                          onClick={() => handleToggleStatus(u)}
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold transition ${
                            u.is_active
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100'
                              : 'bg-red-50 text-red-700 border border-red-200 hover:bg-red-100'
                          }`}
                          title="Click to toggle Active / Inactive"
                        >
                          <span
                            className={`w-1.5 h-1.5 rounded-full ${
                              u.is_active ? 'bg-emerald-500' : 'bg-red-500'
                            }`}
                          />
                          {u.is_active ? 'Active' : 'Disabled'}
                        </button>
                      </td>

                      <td className="py-3 px-4 text-end">
                        <button
                          onClick={() => {
                            setResettingUserId(u.id);
                            setNewPassInput('');
                          }}
                          className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg transition font-medium"
                        >
                          <Lock className="w-3 h-3 text-slate-500" />
                          <span>Reset Pass</span>
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-slate-100 flex items-center justify-between bg-slate-50/70 text-xs text-slate-500">
          <span>School ID: <code className="font-mono text-slate-600">{tenant.id}</code></span>
          <button
            onClick={onClose}
            className="px-4 py-2 font-medium text-slate-700 hover:bg-slate-100 rounded-xl transition"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
