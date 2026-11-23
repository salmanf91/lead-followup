'use client';

import { useEffect, useState } from 'react';
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-xl max-w-2xl w-full max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
          <div>
            <h2 className="text-lg font-bold text-slate-900">Manage Users: {tenant.name}</h2>
            <p className="text-xs text-slate-500">School Admins and Counselors for {tenant.slug}.yourplatform.com</p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 text-sm font-semibold">
            ✕
          </button>
        </div>

        <div className="p-6 overflow-y-auto space-y-5 flex-1 text-start">
          {error && (
            <div className="p-3 text-xs bg-red-50 border border-red-200 text-red-700 rounded-lg">
              {error}
            </div>
          )}

          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-700 uppercase tracking-wider">
              Assigned Accounts ({users.length})
            </span>
            <button
              onClick={() => setShowAddForm(!showAddForm)}
              className="px-3 py-1.5 text-xs font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition"
            >
              {showAddForm ? 'Cancel' : '+ Add User'}
            </button>
          </div>

          {/* Add User Form Drawer */}
          {showAddForm && (
            <form onSubmit={handleCreateUser} className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3">
              <h4 className="text-xs font-bold text-slate-900">Provision New School Account</h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-medium text-slate-700 mb-1">Full Name *</label>
                  <input
                    type="text"
                    required
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    placeholder="e.g. Sara Al-Hassan"
                    className="w-full px-2.5 py-1.5 text-xs border border-slate-300 rounded-lg bg-white"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-slate-700 mb-1">Email Address *</label>
                  <input
                    type="email"
                    required
                    value={newEmail}
                    onChange={(e) => setNewEmail(e.target.value)}
                    placeholder="sara@school.edu"
                    className="w-full px-2.5 py-1.5 text-xs border border-slate-300 rounded-lg bg-white"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-slate-700 mb-1">Initial Password *</label>
                  <input
                    type="password"
                    required
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Min 6 characters"
                    className="w-full px-2.5 py-1.5 text-xs border border-slate-300 rounded-lg bg-white"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-slate-700 mb-1">Role</label>
                  <select
                    value={newRole}
                    onChange={(e) => setNewRole(e.target.value as any)}
                    className="w-full px-2.5 py-1.5 text-xs border border-slate-300 rounded-lg bg-white font-medium"
                  >
                    <option value="COUNSELOR">COUNSELOR</option>
                    <option value="SCHOOL_ADMIN">SCHOOL_ADMIN</option>
                  </select>
                </div>
              </div>

              <div className="flex justify-end pt-2">
                <button
                  type="submit"
                  disabled={creating}
                  className="px-4 py-1.5 text-xs font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition disabled:opacity-50"
                >
                  {creating ? 'Creating...' : 'Create Account'}
                </button>
              </div>
            </form>
          )}

          {/* Users List */}
          {loading ? (
            <div className="py-8 text-center text-xs text-slate-400">Loading school accounts...</div>
          ) : users.length === 0 ? (
            <div className="py-8 text-center bg-slate-50 border border-dashed border-slate-200 rounded-xl">
              <p className="text-xs text-slate-500 font-medium">No users provisioned for this school yet.</p>
              <p className="text-[11px] text-slate-400 mt-1">Click "+ Add User" above to provision a School Admin or Counselor.</p>
            </div>
          ) : (
            <div className="border border-slate-200 rounded-xl overflow-hidden divide-y divide-slate-100">
              {users.map((u) => (
                <div key={u.id} className="p-3.5 flex flex-wrap items-center justify-between gap-3 bg-white hover:bg-slate-50/50">
                  <div className="min-w-[180px]">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-slate-900">{u.name}</span>
                      <span
                        className={`text-[10px] font-mono px-1.5 py-0.5 rounded font-semibold ${
                          u.role === 'SCHOOL_ADMIN'
                            ? 'bg-purple-100 text-purple-800'
                            : 'bg-blue-100 text-blue-800'
                        }`}
                      >
                        {u.role}
                      </span>
                      {!u.is_active && (
                        <span className="text-[10px] bg-red-100 text-red-700 px-1.5 py-0.5 rounded font-semibold">
                          Deactivated
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-500 font-mono mt-0.5">{u.email}</p>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 text-xs">
                    {resettingUserId === u.id ? (
                      <div className="flex items-center gap-1.5">
                        <input
                          type="password"
                          value={newPassInput}
                          onChange={(e) => setNewPassInput(e.target.value)}
                          placeholder="New password"
                          className="px-2 py-1 text-xs border border-slate-300 rounded w-28"
                        />
                        <button
                          onClick={() => handlePasswordReset(u.id)}
                          className="px-2 py-1 bg-emerald-600 text-white rounded text-[11px] font-medium"
                        >
                          Save
                        </button>
                        <button
                          onClick={() => setResettingUserId(null)}
                          className="px-2 py-1 bg-slate-200 text-slate-700 rounded text-[11px]"
                        >
                          ✕
                        </button>
                      </div>
                    ) : (
                      <>
                        <button
                          onClick={() => handleRoleSwitch(u)}
                          className="px-2.5 py-1 text-slate-700 bg-slate-100 hover:bg-slate-200 rounded transition font-medium"
                          title="Switch role between SCHOOL_ADMIN and COUNSELOR"
                        >
                          Switch to {u.role === 'SCHOOL_ADMIN' ? 'Counselor' : 'Admin'}
                        </button>

                        <button
                          onClick={() => setResettingUserId(u.id)}
                          className="px-2.5 py-1 text-slate-700 bg-slate-100 hover:bg-slate-200 rounded transition font-medium"
                        >
                          Reset Pass
                        </button>

                        <button
                          onClick={() => handleToggleStatus(u)}
                          className={`px-2.5 py-1 rounded transition font-medium ${
                            u.is_active
                              ? 'text-red-700 bg-red-50 hover:bg-red-100'
                              : 'text-emerald-700 bg-emerald-50 hover:bg-emerald-100'
                          }`}
                        >
                          {u.is_active ? 'Deactivate' : 'Activate'}
                        </button>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="px-6 py-3 border-t border-slate-100 bg-slate-50 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-200 rounded-lg transition"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
