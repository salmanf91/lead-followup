'use client';

import React, { useState, useEffect } from 'react';
import { LeadRecord, LeadsListResponse } from '../../types';
import { getLeads } from '../../lib/api';

interface MasterLeadListProps {
  selectedCampaignId?: string;
  selectedStatus?: string;
  onSelectLead: (leadId: string) => void;
  onOpenCsvImport?: () => void;
  refreshTrigger?: number;
}

export function formatGrade(raw?: string | null): string {
  if (!raw) return 'General';
  let cleaned = raw
    .replace(/\uFFFD/g, '-')
    .replace(/[\u2013\u2014]/g, '-')
    .replace(/(\d+)\?+(\d+)/g, '$1-$2')
    .replace(/^grade_/i, 'Grade ')
    .replace(/_/g, ' ')
    .replace(/\s*-\s*/g, ' - ')
    .trim();

  if (/^kg$/i.test(cleaned)) return 'KG';
  if (/^kg\s*(\d+)$/i.test(cleaned)) return cleaned.toUpperCase();
  return cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
}

export default function MasterLeadList({
  selectedCampaignId,
  selectedStatus: initialStatus = 'ALL',
  onSelectLead,
  onOpenCsvImport,
  refreshTrigger = 0,
}: MasterLeadListProps) {
  const [leads, setLeads] = useState<LeadRecord[]>([]);
  const [total, setTotal] = useState<number>(0);
  const [page, setPage] = useState<number>(1);
  const [totalPages, setTotalPages] = useState<number>(1);
  const [limit] = useState<number>(20);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Filters State
  const [statusFilter, setStatusFilter] = useState<string>(initialStatus);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [gradeFilter, setGradeFilter] = useState<string>('ALL');
  const [coldOnly, setColdOnly] = useState<boolean>(false);
  const [sortBy, setSortBy] = useState<string>('lead_date');
  const [order, setOrder] = useState<'asc' | 'desc'>('desc');

  // Update status filter when parent prop changes (e.g. user clicked a segment in the feedback split bar)
  useEffect(() => {
    if (initialStatus) {
      setStatusFilter(initialStatus);
      setPage(1);
    }
  }, [initialStatus]);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);

    getLeads({
      campaignId: selectedCampaignId,
      status: statusFilter,
      grade: gradeFilter,
      coldOnly,
      search: searchQuery.trim() || undefined,
      sortBy,
      order,
      page,
      limit,
    })
      .then((data: LeadsListResponse) => {
        if (!active) return;
        setLeads(data.leads || []);
        setTotal(data.total || 0);
        setTotalPages(data.totalPages || 1);
      })
      .catch((err) => {
        if (!active) return;
        setError(err.message || 'Failed to load leads list');
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [selectedCampaignId, statusFilter, gradeFilter, coldOnly, searchQuery, sortBy, order, page, limit, refreshTrigger]);

  const handleResetFilters = () => {
    setStatusFilter('ALL');
    setSearchQuery('');
    setGradeFilter('ALL');
    setColdOnly(false);
    setSortBy('lead_date');
    setOrder('desc');
    setPage(1);
  };

  const getStatusBadge = (status: string, substatus?: string | null) => {
    switch (status) {
      case 'POSITIVE':
        return (
          <span className="inline-flex items-center px-2 py-0.5 text-xs font-semibold rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
            Positive
          </span>
        );
      case 'PENDING':
        return (
          <div className="flex flex-col items-start gap-0.5">
            <span className="inline-flex items-center px-2 py-0.5 text-xs font-semibold rounded-full bg-amber-50 text-amber-700 border border-amber-200">
              Pending
            </span>
            {substatus && (
              <span className="text-[10px] text-amber-600 font-medium ps-1">
                {substatus.replace(/_/g, ' ')}
              </span>
            )}
          </div>
        );
      case 'NEGATIVE':
        return (
          <span className="inline-flex items-center px-2 py-0.5 text-xs font-semibold rounded-full bg-rose-50 text-rose-700 border border-rose-200">
            Negative
          </span>
        );
      case 'NOT_CONTACTED':
        return (
          <span className="inline-flex items-center px-2 py-0.5 text-xs font-semibold rounded-full bg-slate-100 text-slate-700 border border-slate-200">
            Not Contacted
          </span>
        );
      case 'INVALID_DUPLICATE':
        return (
          <span className="inline-flex items-center px-2 py-0.5 text-xs font-semibold rounded-full bg-purple-50 text-purple-700 border border-purple-200">
            Invalid / Dup
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center px-2 py-0.5 text-xs font-semibold rounded-full bg-slate-100 text-slate-700">
            {status}
          </span>
        );
    }
  };

  return (
    <div id="lead-list" className="bg-white rounded-3xl border border-slate-200/90 shadow-bespoke overflow-hidden scroll-mt-24">
      {/* Header and Filter Controls */}
      <div className="p-6 border-b border-slate-200/80 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <span>Master Lead Directory</span>
              <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
                {total} total
              </span>
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Filter by outcome status, search student or phone numbers, and record follow-up notes.
            </p>
          </div>

          <div className="flex items-center gap-2">
            {onOpenCsvImport && (
              <button
                onClick={onOpenCsvImport}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-300 text-slate-700 hover:bg-slate-50 text-xs font-semibold transition"
              >
                <svg className="w-3.5 h-3.5 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                </svg>
                Import CSV
              </button>
            )}

            <button
              onClick={handleResetFilters}
              className="text-xs font-medium text-slate-500 hover:text-indigo-600 transition px-2 py-1"
            >
              Reset Filters
            </button>
          </div>
        </div>

        {/* Status Filter Tabs */}
        <div className="flex flex-wrap items-center gap-1.5 pt-1">
          {[
            { id: 'ALL', label: 'All Leads' },
            { id: 'OPEN', label: 'Open / Active' },
            { id: 'POSITIVE', label: 'Positive' },
            { id: 'PENDING', label: 'Pending' },
            { id: 'NOT_CONTACTED', label: 'Not Contacted' },
            { id: 'NEGATIVE', label: 'Negative' },
            { id: 'INVALID_DUPLICATE', label: 'Invalid / Duplicate' },
          ].map((tab) => {
            const active = statusFilter === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => {
                  setStatusFilter(tab.id);
                  setPage(1);
                }}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition ${
                  active
                    ? 'bg-[#10457C] text-white shadow-xs'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200/80'
                }`}
              >
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* Search, Grade & Cold Filter Bar */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-3 pt-1">
          {/* Search Input */}
          <div className="md:col-span-6 relative">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setPage(1);
              }}
              placeholder="Search parent name, phone, or notes..."
              className="w-full text-xs rounded-xl border border-slate-300 py-2 ps-9 pe-3 bg-white text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#10457C]/20 focus:border-[#10457C] shadow-xs"
            />
            <svg
              className="w-4 h-4 text-slate-400 absolute start-3 top-2.5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            {searchQuery && (
              <button
                onClick={() => {
                  setSearchQuery('');
                  setPage(1);
                }}
                className="absolute end-3 top-2.5 text-slate-400 hover:text-slate-600"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>

          {/* Grade Dropdown */}
          <div className="md:col-span-3">
            <select
              value={gradeFilter}
              onChange={(e) => {
                setGradeFilter(e.target.value);
                setPage(1);
              }}
              className="w-full text-xs rounded-xl border border-slate-300 py-2 px-3 bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 shadow-sm"
            >
              <option value="ALL">All Grades / Levels</option>
              <option value="KG1">KG 1</option>
              <option value="KG2">KG 2</option>
              <option value="KG3">KG 3</option>
              <option value="Grade 1">Grade 1</option>
              <option value="Grade 2">Grade 2</option>
              <option value="Grade 3">Grade 3</option>
              <option value="Grade 4-6">Grade 4 - 6</option>
              <option value="Grade 7-9">Grade 7 - 9</option>
              <option value="Grade 10-12">Grade 10 - 12</option>
            </select>
          </div>

          {/* Cold Leads Toggle */}
          <div className="md:col-span-3 flex items-center">
            <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-slate-700 select-none">
              <input
                type="checkbox"
                checked={coldOnly}
                onChange={(e) => {
                  setColdOnly(e.target.checked);
                  setPage(1);
                }}
                className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 border-slate-300"
              />
              <span className="flex items-center gap-1 text-rose-700">
                <span className="w-2 h-2 rounded-full bg-rose-500" />
                No Update in 3+ Days
              </span>
            </label>
          </div>
        </div>
      </div>

      {/* Table Content */}
      <div className="overflow-x-auto">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 text-slate-400">
            <svg className="w-8 h-8 animate-spin mb-3 text-indigo-600" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
            </svg>
            <span>Loading leads...</span>
          </div>
        ) : error ? (
          <div className="p-8 text-center text-rose-600 text-sm">{error}</div>
        ) : leads.length === 0 ? (
          <div className="p-12 text-center">
            <div className="w-12 h-12 rounded-full bg-slate-100 text-slate-400 mx-auto flex items-center justify-center mb-3">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
              </svg>
            </div>
            <h3 className="text-sm font-bold text-slate-800">No leads found</h3>
            <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
              There are no lead records matching the current campaign tab or filters.
            </p>
            {onOpenCsvImport && (
              <button
                onClick={onOpenCsvImport}
                className="mt-4 inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold bg-indigo-600 hover:bg-indigo-700 text-white transition shadow-sm"
              >
                Upload CSV Leads
              </button>
            )}
          </div>
        ) : (
          <table className="w-full text-start border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-200/80 bg-slate-50/75 text-slate-600 font-semibold uppercase tracking-wider text-[11px]">
                <th className="py-3 px-4 text-start">Feedback</th>
                <th className="py-3 px-4 text-start">Parent / Student Name</th>
                <th className="py-3 px-4 text-start">Contact</th>
                <th className="py-3 px-4 text-start">Campaign Tab</th>
                <th className="py-3 px-4 text-start">Grade</th>
                <th className="py-3 px-4 text-start cursor-pointer hover:text-slate-900" onClick={() => {
                  setSortBy('lead_date');
                  setOrder(order === 'asc' ? 'desc' : 'asc');
                }}>
                  Lead Date {sortBy === 'lead_date' ? (order === 'asc' ? '↑' : '↓') : ''}
                </th>
                <th className="py-3 px-4 text-start cursor-pointer hover:text-slate-900" onClick={() => {
                  setSortBy('last_updated_at');
                  setOrder(order === 'asc' ? 'desc' : 'asc');
                }}>
                  Last Update {sortBy === 'last_updated_at' ? (order === 'asc' ? '↑' : '↓') : ''}
                </th>
                <th className="py-3 px-4 text-start">Latest Follow-Up Note</th>
                <th className="py-3 px-4 text-end">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {leads.map((lead) => {
                const whatsAppUrl = lead.phone_normalized ? `https://wa.me/${lead.phone_normalized}` : null;
                return (
                  <tr
                    key={lead.id}
                    onClick={() => onSelectLead(lead.id)}
                    className="hover:bg-indigo-50/40 cursor-pointer transition group"
                  >
                    <td className="py-3 px-4 whitespace-nowrap">
                      {getStatusBadge(lead.feedback_status, lead.pending_substatus)}
                    </td>

                    <td className="py-3 px-4 font-semibold text-slate-900" dir="auto">
                      <div className="flex items-center gap-1.5">
                        <span>{lead.parent_name}</span>
                        {lead.is_duplicate && (
                          <span className="px-1.5 py-0.2 text-[9px] rounded bg-purple-100 text-purple-700 font-semibold" title="Phone number recorded earlier">
                            Dup
                          </span>
                        )}
                      </div>
                    </td>

                    <td className="py-3 px-4 whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-slate-700">{lead.phone_raw || lead.phone_normalized || 'N/A'}</span>
                        {whatsAppUrl && (
                          <a
                            href={whatsAppUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-1 rounded bg-emerald-50 text-emerald-600 hover:bg-emerald-600 hover:text-white transition shadow-sm"
                            title="Chat on WhatsApp"
                          >
                            <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24">
                              <path d="M12.031 6.172c-3.181 0-5.767 2.586-5.768 5.766-.001 1.298.38 2.27 1.019 3.287l-.711 2.598 2.664-.698c.99.54 1.796.819 2.796.819 3.18 0 5.767-2.587 5.768-5.766.001-3.181-2.586-5.766-5.768-5.766zm9.969 5.766c0 5.514-4.486 10-10 10-1.823 0-3.539-.493-5.031-1.355l-5.969 1.563 1.594-5.828c-.938-1.542-1.47-3.344-1.47-5.26 0-5.514 4.486-10 10-10 5.514 0 10 4.486 10 10z"/>
                            </svg>
                          </a>
                        )}
                      </div>
                    </td>

                    <td className="py-3 px-4 whitespace-nowrap text-slate-600">
                      {lead.campaign_tab}
                    </td>

                    <td className="py-3 px-4 whitespace-nowrap font-medium text-slate-800">
                      {formatGrade(lead.grade)}
                    </td>

                    <td className="py-3 px-4 whitespace-nowrap text-slate-500">
                      {lead.lead_date ? new Date(lead.lead_date).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' }) : '—'}
                    </td>

                    <td className="py-3 px-4 whitespace-nowrap text-slate-500">
                      {new Date(lead.last_updated_at).toLocaleDateString([], { month: 'short', day: 'numeric' })}
                    </td>

                    <td className="py-3 px-4 max-w-xs truncate text-slate-600 font-sans" dir="auto">
                      {lead.latest_note ? (
                        <span>
                          <span className="font-semibold text-indigo-700">S{lead.latest_note.stage}:</span> {lead.latest_note.note_text}
                        </span>
                      ) : (
                        <span className="text-slate-400 italic">No notes yet</span>
                      )}
                    </td>

                    <td className="py-3 px-4 text-end whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                      <button
                        onClick={() => onSelectLead(lead.id)}
                        className="px-2.5 py-1 rounded-xl text-xs font-bold text-[#10457C] bg-[#F0F5FA] hover:bg-[#10457C] hover:text-white transition shadow-2xs border border-[#10457C]/10"
                      >
                        Notes ({lead.notes_count})
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Pagination Footer */}
      {!loading && total > 0 && (
        <div className="p-4 border-t border-slate-200/80 bg-slate-50/50 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-600">
          <div>
            Showing <span className="font-bold text-slate-800">{(page - 1) * limit + 1}</span> to{' '}
            <span className="font-bold text-slate-800">{Math.min(total, page * limit)}</span> of{' '}
            <span className="font-bold text-slate-800">{total}</span> leads
          </div>

          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
              className="px-3 py-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed font-medium transition"
            >
              Previous
            </button>
            <span className="px-3 py-1.5 font-semibold text-slate-700">
              Page {page} of {totalPages}
            </span>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
              className="px-3 py-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed font-medium transition"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

