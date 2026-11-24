'use client';

import React, { useState, useEffect } from 'react';
import { LeadRecord, LeadNote } from '../../types';
import { getLeadDetails, addLeadNote } from '../../lib/api';

interface LeadDrawerProps {
  leadId: string | null;
  onClose: () => void;
  onLeadUpdated: () => void;
}

export default function LeadDrawer({ leadId, onClose, onLeadUpdated }: LeadDrawerProps) {
  const [lead, setLead] = useState<LeadRecord | null>(null);
  const [notes, setNotes] = useState<LeadNote[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Form State
  const [stage, setStage] = useState<number>(1);
  const [feedbackStatus, setFeedbackStatus] = useState<string>('PENDING');
  const [pendingSubstatus, setPendingSubstatus] = useState<string>('MSG_NO_REPLY');
  const [noteText, setNoteText] = useState<string>('');
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitSuccess, setSubmitSuccess] = useState<boolean>(false);

  useEffect(() => {
    if (!leadId) return;

    let mounted = true;
    setLoading(true);
    setError(null);
    setSubmitSuccess(false);

    getLeadDetails(leadId)
      .then((data) => {
        if (!mounted) return;
        setLead(data.lead);
        setNotes(data.notes || []);
        setFeedbackStatus(data.lead.feedback_status || 'PENDING');
        setPendingSubstatus(data.lead.pending_substatus || 'MSG_NO_REPLY');
        // Default next stage = highest stage + 1 (max 5)
        const maxStage = (data.notes || []).reduce((max, n) => Math.max(max, n.stage), 0);
        setStage(Math.min(5, Math.max(1, maxStage + 1)));
      })
      .catch((err) => {
        if (!mounted) return;
        setError(err.message || 'Failed to load lead details');
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, [leadId]);

  if (!leadId) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!noteText.trim()) {
      setSubmitError('Please enter note text');
      return;
    }

    setSubmitting(true);
    setSubmitError(null);
    try {
      const res = await addLeadNote(leadId, {
        stage,
        noteText: noteText.trim(),
        feedbackStatus,
        pendingSubstatus: feedbackStatus === 'PENDING' ? pendingSubstatus : undefined,
      });

      setNotes((prev) => [...prev, res.note]);
      setLead(res.lead);
      setNoteText('');
      setSubmitSuccess(true);
      setStage((prev) => Math.min(5, prev + 1));
      onLeadUpdated();

      setTimeout(() => setSubmitSuccess(false), 4000);
    } catch (err: any) {
      setSubmitError(err.message || 'Failed to add note');
    } finally {
      setSubmitting(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'POSITIVE':
        return <span className="px-2.5 py-1 text-xs font-semibold rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">Positive</span>;
      case 'PENDING':
        return <span className="px-2.5 py-1 text-xs font-semibold rounded-full bg-amber-50 text-amber-700 border border-amber-200">Pending</span>;
      case 'NEGATIVE':
        return <span className="px-2.5 py-1 text-xs font-semibold rounded-full bg-rose-50 text-rose-700 border border-rose-200">Negative</span>;
      case 'NOT_CONTACTED':
        return <span className="px-2.5 py-1 text-xs font-semibold rounded-full bg-slate-100 text-slate-700 border border-slate-200">Not Contacted</span>;
      case 'INVALID_DUPLICATE':
        return <span className="px-2.5 py-1 text-xs font-semibold rounded-full bg-purple-50 text-purple-700 border border-purple-200">Invalid / Duplicate</span>;
      default:
        return <span className="px-2.5 py-1 text-xs font-semibold rounded-full bg-slate-100 text-slate-700">{status}</span>;
    }
  };

  const whatsAppUrl = lead?.phone_normalized ? `https://wa.me/${lead.phone_normalized}` : null;

  return (
    <div className="fixed inset-0 z-50 overflow-hidden bg-slate-900/60 backdrop-blur-sm transition-opacity">
      <div className="absolute inset-0" onClick={onClose} />

      <div className="fixed inset-y-0 end-0 max-w-full flex">
        <aside
          role="dialog"
          aria-modal="true"
          aria-label="Lead Details and Follow-Up Drawer"
          className="w-screen max-w-xl bg-white shadow-2xl flex flex-col z-10 animate-in slide-in-from-right duration-300"
        >
          {/* Drawer Header */}
          <div className="px-6 py-5 border-b border-slate-200 flex items-center justify-between bg-slate-50">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Lead Details & History</span>
                {lead && getStatusBadge(lead.feedback_status)}
              </div>
              <h2 className="text-xl font-bold text-slate-900 mt-1" dir="auto">
                {loading ? 'Loading...' : lead?.parent_name || 'Lead Details'}
              </h2>
            </div>
            <button
              onClick={onClose}
              className="p-2 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-200/60 transition"
              title="Close drawer"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Drawer Content */}
          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            {loading ? (
              <div className="flex flex-col items-center justify-center py-20 text-slate-400">
                <svg className="w-8 h-8 animate-spin mb-3 text-indigo-600" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
                </svg>
                <span>Loading lead profile...</span>
              </div>
            ) : error || !lead ? (
              <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-sm">
                {error || 'Lead not found'}
              </div>
            ) : (
              <>
                {/* Contact & Meta Info Card */}
                <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-4 grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <span className="text-xs font-semibold text-slate-500 block">Phone</span>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="font-mono text-slate-900 font-medium">{lead.phone_raw || lead.phone_normalized || 'N/A'}</span>
                      {whatsAppUrl && (
                        <a
                          href={whatsAppUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white transition shadow-sm"
                          title="Open WhatsApp chat"
                        >
                          <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24">
                            <path d="M12.031 6.172c-3.181 0-5.767 2.586-5.768 5.766-.001 1.298.38 2.27 1.019 3.287l-.711 2.598 2.664-.698c.99.54 1.796.819 2.796.819 3.18 0 5.767-2.587 5.768-5.766.001-3.181-2.586-5.766-5.768-5.766zm9.969 5.766c0 5.514-4.486 10-10 10-1.823 0-3.539-.493-5.031-1.355l-5.969 1.563 1.594-5.828c-.938-1.542-1.47-3.344-1.47-5.26 0-5.514 4.486-10 10-10 5.514 0 10 4.486 10 10z"/>
                          </svg>
                          WhatsApp
                        </a>
                      )}
                    </div>
                  </div>

                  <div>
                    <span className="text-xs font-semibold text-slate-500 block">Grade / Level</span>
                    <span className="font-semibold text-slate-900 mt-1 block">{lead.grade || 'General'}</span>
                  </div>

                  <div>
                    <span className="text-xs font-semibold text-slate-500 block">Campaign Tab</span>
                    <span className="text-slate-700 font-medium mt-1 block">{lead.campaign_tab}</span>
                  </div>

                  <div>
                    <span className="text-xs font-semibold text-slate-500 block">Lead Date</span>
                    <span className="text-slate-700 font-medium mt-1 block">
                      {lead.lead_date ? new Date(lead.lead_date).toLocaleDateString() : 'N/A'}
                    </span>
                  </div>

                  {lead.pending_substatus && (
                    <div className="col-span-2 pt-2 border-t border-slate-200">
                      <span className="text-xs font-semibold text-slate-500 block">Pending Reason</span>
                      <span className="inline-block mt-1 px-2.5 py-0.5 rounded text-xs font-medium bg-amber-100 text-amber-800">
                        {lead.pending_substatus.replace(/_/g, ' ')}
                      </span>
                    </div>
                  )}
                </div>

                {/* Follow-up Notes Timeline */}
                <div>
                  <h3 className="text-sm font-bold text-slate-900 mb-3 flex items-center justify-between">
                    <span>Follow-Up Notes History</span>
                    <span className="text-xs font-normal text-slate-500">{notes.length} note(s) recorded</span>
                  </h3>

                  {notes.length === 0 ? (
                    <div className="p-4 bg-slate-50 border border-dashed border-slate-300 rounded-xl text-center text-slate-500 text-sm">
                      No follow-up notes recorded yet. Log the first counselor note below.
                    </div>
                  ) : (
                    <div className="space-y-3 relative before:absolute before:inset-0 before:start-3.5 before:w-0.5 before:bg-slate-200">
                      {notes.map((note) => (
                        <div key={note.id} className="relative flex items-start gap-3 ps-8">
                          <span className="absolute start-1.5 top-2 w-4 h-4 rounded-full border-2 border-white bg-indigo-600 shadow-sm flex items-center justify-center text-[9px] text-white font-bold">
                            {note.stage}
                          </span>
                          <div className="flex-1 bg-white border border-slate-200 rounded-xl p-3.5 shadow-sm hover:border-slate-300 transition">
                            <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
                              <span className="font-semibold text-indigo-700">
                                Stage {note.stage} • {note.counselor_tag || 'Counselor'}
                              </span>
                              <div className="flex items-center gap-1.5">
                                <span className="px-1.5 py-0.5 rounded text-[10px] bg-slate-100 font-medium text-slate-600">
                                  {note.source === 'GOOGLE_SHEET' ? 'Google Sheet' : 'Web App'}
                                </span>
                                <span>{new Date(note.noted_at).toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
                              </div>
                            </div>
                            <p className="text-sm text-slate-800 leading-relaxed font-sans whitespace-pre-wrap" dir="auto">
                              {note.note_text}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Log New Follow-Up Form */}
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
                  <h3 className="text-sm font-bold text-slate-900 mb-3 flex items-center gap-2">
                    <svg className="w-4 h-4 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
                    </svg>
                    Log New Follow-Up Note
                  </h3>

                  {submitSuccess && (
                    <div className="mb-3 p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-emerald-800 text-xs font-medium flex items-center gap-2">
                      <svg className="w-4 h-4 text-emerald-600" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                      </svg>
                      Note recorded successfully! Lead status and KPI metrics updated.
                    </div>
                  )}

                  {submitError && (
                    <div className="mb-3 p-3 bg-rose-50 border border-rose-200 rounded-lg text-rose-800 text-xs font-medium">
                      {submitError}
                    </div>
                  )}

                  <form onSubmit={handleSubmit} className="space-y-3">
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1">Follow-Up Stage</label>
                        <select
                          value={stage}
                          onChange={(e) => setStage(Number(e.target.value))}
                          className="w-full text-xs rounded-lg border border-slate-300 py-1.5 px-2.5 bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        >
                          <option value={1}>Stage 1 (First Contact)</option>
                          <option value={2}>Stage 2 (Follow-up)</option>
                          <option value={3}>Stage 3 (Decision / Tour)</option>
                          <option value={4}>Stage 4 (Assessment)</option>
                          <option value={5}>Stage 5+ (Enrollment)</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1">Lead Outcome Status</label>
                        <select
                          value={feedbackStatus}
                          onChange={(e) => setFeedbackStatus(e.target.value)}
                          className="w-full text-xs rounded-lg border border-slate-300 py-1.5 px-2.5 bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        >
                          <option value="POSITIVE">Positive / Interested</option>
                          <option value="PENDING">Pending Decision</option>
                          <option value="NOT_CONTACTED">Not Contacted</option>
                          <option value="NEGATIVE">Negative / Not Interested</option>
                          <option value="INVALID_DUPLICATE">Invalid / Duplicate</option>
                        </select>
                      </div>
                    </div>

                    {feedbackStatus === 'PENDING' && (
                      <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1">Pending Reason (Sub-Status)</label>
                        <select
                          value={pendingSubstatus}
                          onChange={(e) => setPendingSubstatus(e.target.value)}
                          className="w-full text-xs rounded-lg border border-slate-300 py-1.5 px-2.5 bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        >
                          <option value="MSG_NO_REPLY">Message sent, no reply yet</option>
                          <option value="CALLED_NO_ANSWER">Called, no answer / busy / switched off</option>
                          <option value="ANSWERED_NO_DECISION">Answered, requested callback / thinking</option>
                          <option value="OTHER">Other general inquiry</option>
                        </select>
                      </div>
                    )}

                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Counselor Note <span className="text-slate-400 font-normal">(supports English & Arabic)</span>
                      </label>
                      <textarea
                        value={noteText}
                        onChange={(e) => setNoteText(e.target.value)}
                        placeholder="Log call discussion, WhatsApp response, tour booking, or objections..."
                        rows={3}
                        dir="auto"
                        className="w-full text-sm rounded-lg border border-slate-300 p-2.5 bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      />
                    </div>

                    <div className="flex justify-end pt-1">
                      <button
                        type="submit"
                        disabled={submitting || !noteText.trim()}
                        className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 transition shadow-sm"
                      >
                        {submitting ? (
                          <>
                            <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
                            </svg>
                            Saving Note...
                          </>
                        ) : (
                          'Save Note & Update Lead'
                        )}
                      </button>
                    </div>
                  </form>
                </div>
              </>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}
