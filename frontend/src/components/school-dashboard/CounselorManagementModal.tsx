'use client';

import React, { useState, useEffect } from 'react';
import { TenantUser } from '../../types';
import { getSchoolCounselors, createSchoolCounselor, updateSchoolCounselor } from '../../lib/api';

interface CounselorManagementModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function CounselorManagementModal({ isOpen, onClose }: CounselorManagementModalProps) {
  const [counselors, setCounselors] = useState<TenantUser[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Form
  const [name, setName] = useState<string>('');
  const [email, setEmail] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [saving, setSaving] = useState<boolean>(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [formSuccess, setFormSuccess] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    loadCounselors();
  }, [isOpen]);

  const loadCounselors = () => {
    setLoading(true);
    getSchoolCounselors()
      .then((users) => setCounselors(users || []))
      .catch((err) => setError(err.message || 'Failed to load counselors'))
      .finally(() => setLoading(false));
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !email.trim() || !password) {
      setFormError('Name, email, and password are required');
      return;
    }

    setSaving(true);
    setFormError(null);
    setFormSuccess(null);

    try {
      await createSchoolCounselor({
        name: name.trim(),
        email: email.trim().toLowerCase(),
        password,
      });

      setName('');
      setEmail('');
      setPassword('');
      setFormSuccess('Counselor account created successfully');
      loadCounselors();
      setTimeout(() => setFormSuccess(null), 3500);
    } catch (err: any) {
      setFormError(err.message || 'Failed to create counselor');
    } finally {
      setSaving(false);
    }
  };

  const handleToggleActive = async (id: string, currentActive: boolean) => {
    try {
      await updateSchoolCounselor(id, { is_active: !currentActive });
      loadCounselors();
    } catch (err: any) {
      alert(err.message || 'Failed to update counselor status');
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
      <div className="bg-white rounded-2xl max-w-xl w-full border border-slate-200 shadow-2xl p-6 relative">
        <div className="flex items-center justify-between pb-4 border-b border-slate-200">
          <div>
            <h3 className="text-lg font-bold text-slate-900">Counselor Team Management</h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Manage admissions counselor logins and permissions for this school.
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="py-4 space-y-5 text-xs max-h-[70vh] overflow-y-auto">
          {/* Add Counselor Form */}
          <div className="bg-slate-50 border border-slate-200 p-4 rounded-xl">
            <h4 className="font-bold text-slate-800 text-xs mb-3">Add New Counselor</h4>
            {formSuccess && (
              <div className="mb-2 p-2 bg-emerald-50 border border-emerald-200 rounded-lg text-emerald-800 font-medium">
                {formSuccess}
              </div>
            )}
            {formError && (
              <div className="mb-2 p-2 bg-rose-50 border border-rose-200 rounded-lg text-rose-800 font-medium">
                {formError}
              </div>
            )}
            <form onSubmit={handleCreate} className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Full Name</label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. Sara Al-Otaibi"
                    className="w-full text-xs rounded-lg border border-slate-300 py-1.5 px-2.5 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Email</label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="counselor@school.edu"
                    className="w-full text-xs rounded-lg border border-slate-300 py-1.5 px-2.5 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Password</label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Minimum 6 characters"
                  className="w-full text-xs rounded-lg border border-slate-300 py-1.5 px-2.5 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div className="flex justify-end pt-1">
                <button
                  type="submit"
                  disabled={saving || !name.trim() || !email.trim() || !password}
                  className="px-4 py-1.5 rounded-lg text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 transition shadow-sm"
                >
                  {saving ? 'Creating...' : 'Create Account'}
                </button>
              </div>
            </form>
          </div>

          {/* Counselors List */}
          <div>
            <h4 className="font-bold text-slate-800 text-xs mb-2">Active School Counselors</h4>
            {loading ? (
              <div className="py-6 text-center text-slate-400">Loading counselors...</div>
            ) : error ? (
              <div className="p-3 bg-rose-50 text-rose-700 rounded-lg">{error}</div>
            ) : counselors.length === 0 ? (
              <div className="p-4 bg-slate-50 text-slate-500 text-center rounded-lg">
                No counselors registered yet.
              </div>
            ) : (
              <div className="divide-y divide-slate-100 border border-slate-200 rounded-xl overflow-hidden">
                {counselors.map((c) => (
                  <div key={c.id} className="p-3 bg-white flex items-center justify-between gap-3">
                    <div>
                      <div className="font-semibold text-slate-900">{c.name}</div>
                      <div className="text-slate-500 text-[11px] font-mono">{c.email}</div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          c.is_active ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'
                        }`}
                      >
                        {c.is_active ? 'Active' : 'Inactive'}
                      </span>
                      <button
                        onClick={() => handleToggleActive(c.id, c.is_active)}
                        className="text-[11px] font-semibold text-indigo-600 hover:text-indigo-800 px-2 py-1 rounded hover:bg-indigo-50 transition"
                      >
                        {c.is_active ? 'Deactivate' : 'Activate'}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="flex justify-end pt-3 border-t border-slate-200">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 transition"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
