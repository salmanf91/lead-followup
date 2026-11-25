'use client';

import { useState, useEffect } from 'react';
import {
  FileSpreadsheet,
  Copy,
  Check,
  ChevronDown,
  ChevronUp,
  AlertCircle,
  ExternalLink,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';
import { getServiceAccountInfo } from '../../lib/api';

interface Props {
  variant?: 'banner' | 'modal';
  defaultOpen?: boolean;
}

export default function GoogleSheetNoticeBoard({ variant = 'banner', defaultOpen = true }: Props) {
  const [serviceAccountEmail, setServiceAccountEmail] = useState<string>('');
  const [isConfigured, setIsConfigured] = useState<boolean>(false);
  const [isOpen, setIsOpen] = useState<boolean>(defaultOpen);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    getServiceAccountInfo()
      .then((data) => {
        if (data.serviceAccountEmail) {
          setServiceAccountEmail(data.serviceAccountEmail);
          setIsConfigured(data.isConfigured);
        }
      })
      .catch((err) => console.error('Failed to load service account info:', err));
  }, []);

  const handleCopy = () => {
    if (!serviceAccountEmail) return;
    navigator.clipboard.writeText(serviceAccountEmail);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (variant === 'modal') {
    return (
      <div className="rounded-2xl border border-indigo-100 bg-indigo-50/50 p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-indigo-900 font-bold text-xs">
            <FileSpreadsheet className="w-4 h-4 text-indigo-600" />
            <span>How to Link Client Google Sheet</span>
          </div>
          <button
            type="button"
            onClick={() => setIsOpen(!isOpen)}
            className="text-[11px] font-semibold text-indigo-700 hover:text-indigo-950 flex items-center gap-1"
          >
            <span>{isOpen ? 'Collapse' : 'View Instructions'}</span>
            {isOpen ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>
        </div>

        {isOpen && (
          <div className="space-y-3 pt-2 border-t border-indigo-100/80 text-xs text-slate-700">
            {/* Step 1: Service Account Copy */}
            <div>
              <p className="font-semibold text-slate-800 text-[11px] mb-1.5">
                1. Share Google Sheet with Platform Service Account:
              </p>
              <div className="flex items-center gap-2 bg-white rounded-xl p-2 border border-indigo-200/80 shadow-2xs">
                <code className="font-mono text-[11px] text-slate-800 truncate flex-1 select-all">
                  {serviceAccountEmail || 'service-account@your-gcp-project.iam.gserviceaccount.com'}
                </code>
                <button
                  type="button"
                  onClick={handleCopy}
                  disabled={!serviceAccountEmail}
                  className="px-2.5 py-1 text-[11px] font-bold rounded-lg bg-[#10457C] hover:bg-[#0A2B4E] text-white flex items-center gap-1 transition shrink-0"
                >
                  {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                  <span>{copied ? 'Copied!' : 'Copy Email'}</span>
                </button>
              </div>
              <p className="text-[10px] text-slate-500 mt-1">
                Open client Google Sheet &gt; Click <strong>Share</strong> &gt; Add this email as <strong>Editor</strong> (or Viewer).
              </p>
            </div>

            {/* Step 2: Sheet ID */}
            <div>
              <p className="font-semibold text-slate-800 text-[11px] mb-1">
                2. Copy Sheet ID from URL:
              </p>
              <p className="font-mono text-[10px] text-slate-600 bg-white p-2 rounded-lg border border-indigo-100">
                https://docs.google.com/spreadsheets/d/<span className="bg-indigo-100 text-indigo-800 px-1 py-0.5 rounded font-bold">SPREADSHEET_ID</span>/edit
              </p>
            </div>

            {/* Step 3: Multi-Campaign Tabs */}
            <p className="text-[11px] text-slate-600 leading-relaxed">
              💡 <strong>Multi-Campaigns:</strong> Every worksheet tab at the bottom of the Google Sheet (e.g. <em>Facebook</em>, <em>Instagram</em>, <em>Walk-ins</em>) is automatically imported as a separate campaign tab in the portal.
            </p>
          </div>
        )}
      </div>
    );
  }

  // Full Banner Mode on SuperAdminDashboard
  return (
    <div className="bg-white rounded-3xl border border-slate-200/90 shadow-bespoke overflow-hidden animate-in fade-in">
      <div
        onClick={() => setIsOpen(!isOpen)}
        className="px-6 py-4 bg-gradient-to-r from-slate-50 to-indigo-50/30 border-b border-slate-100 flex items-center justify-between cursor-pointer select-none"
      >
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-indigo-100/70 text-[#10457C] flex items-center justify-center shadow-xs">
            <FileSpreadsheet className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <span>Notice Board: How to Link Google Sheets (Super Admin Setup)</span>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-100 text-indigo-800">
                Agency Setup
              </span>
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Step-by-step instructions for sharing sheets with the platform service account and linking campaigns
            </p>
          </div>
        </div>

        <button
          type="button"
          className="p-1.5 rounded-xl hover:bg-white text-slate-400 hover:text-slate-700 transition"
        >
          {isOpen ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
        </button>
      </div>

      {isOpen && (
        <div className="p-6 space-y-5 text-xs text-slate-700">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Step 1: Service Account Access */}
            <div className="p-4 rounded-2xl bg-slate-50/70 border border-slate-200/80 space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="font-bold text-slate-900 flex items-center gap-1.5">
                  <span className="w-5 h-5 rounded-full bg-[#10457C] text-white text-[11px] flex items-center justify-center font-bold">1</span>
                  <span>Share Sheet with Service Account</span>
                </span>
                {isConfigured ? (
                  <span className="text-[10px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200/60">
                    Configured in .env
                  </span>
                ) : (
                  <span className="text-[10px] font-semibold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-md border border-amber-200/60">
                    Set in backend/.env
                  </span>
                )}
              </div>
              <p className="text-slate-600 text-[11px] leading-relaxed">
                Open the client's Google Sheet, click the top-right <strong>Share</strong> button, and add this Service Account email as an <strong>Editor</strong> (or Viewer):
              </p>
              <div className="flex items-center gap-2 bg-white rounded-xl p-2.5 border border-slate-200/90 shadow-2xs">
                <code className="font-mono text-xs text-slate-800 truncate flex-1 select-all font-semibold">
                  {serviceAccountEmail || 'service-account@your-gcp-project.iam.gserviceaccount.com'}
                </code>
                <button
                  type="button"
                  onClick={handleCopy}
                  className="px-3 py-1.5 text-xs font-bold rounded-lg bg-[#10457C] hover:bg-[#0A2B4E] text-white flex items-center gap-1.5 transition shrink-0 active:scale-95 shadow-xs"
                >
                  {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copied ? 'Copied!' : 'Copy Email'}</span>
                </button>
              </div>
            </div>

            {/* Step 2: Extract Sheet ID */}
            <div className="p-4 rounded-2xl bg-slate-50/70 border border-slate-200/80 space-y-2.5">
              <span className="font-bold text-slate-900 flex items-center gap-1.5">
                <span className="w-5 h-5 rounded-full bg-[#10457C] text-white text-[11px] flex items-center justify-center font-bold">2</span>
                <span>Extract the Google Spreadsheet ID</span>
              </span>
              <p className="text-slate-600 text-[11px] leading-relaxed">
                Copy the unique 44-character alphanumeric string located between <code className="font-mono text-slate-800">/d/</code> and <code className="font-mono text-slate-800">/edit</code> from the browser address bar:
              </p>
              <div className="bg-white p-2.5 rounded-xl border border-slate-200/90 font-mono text-[11px] text-slate-500 overflow-x-auto shadow-2xs">
                https://docs.google.com/spreadsheets/d/<span className="bg-amber-100 text-amber-900 font-bold px-1 py-0.5 rounded">1xxP7buklPKnBt74VjRoyfCQmSRaYvNbhB3s5hR4Uv_Y</span>/edit
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1">
            {/* Step 3: Multi-Campaign Structure */}
            <div className="p-4 rounded-2xl bg-slate-50/70 border border-slate-200/80 space-y-2">
              <span className="font-bold text-slate-900 flex items-center gap-1.5">
                <span className="w-5 h-5 rounded-full bg-[#10457C] text-white text-[11px] flex items-center justify-center font-bold">3</span>
                <span>Multi-Campaign Tabs (Google Sheets)</span>
              </span>
              <p className="text-slate-600 text-[11px] leading-relaxed">
                Each worksheet tab at the bottom of the Google Sheet automatically creates a dedicated campaign tab in the portal (e.g. <em>Facebook</em>, <em>Instagram</em>, <em>Walk-ins</em>).
              </p>
            </div>

            {/* Step 4: Expected Header Columns */}
            <div className="p-4 rounded-2xl bg-slate-50/70 border border-slate-200/80 space-y-2">
              <span className="font-bold text-slate-900 flex items-center gap-1.5">
                <span className="w-5 h-5 rounded-full bg-[#10457C] text-white text-[11px] flex items-center justify-center font-bold">4</span>
                <span>Recognized Header Columns</span>
              </span>
              <p className="text-slate-600 text-[11px] leading-relaxed">
                First row must contain header columns: <code className="bg-white px-1.5 py-0.5 rounded border border-slate-200 text-slate-800 font-mono">Date</code>, <code className="bg-white px-1.5 py-0.5 rounded border border-slate-200 text-slate-800 font-mono">Name</code>, <code className="bg-white px-1.5 py-0.5 rounded border border-slate-200 text-slate-800 font-mono">Phone</code>, <code className="bg-white px-1.5 py-0.5 rounded border border-slate-200 text-slate-800 font-mono">Grade/Experience</code>, <code className="bg-white px-1.5 py-0.5 rounded border border-slate-200 text-slate-800 font-mono">Followup 1-3</code>, <code className="bg-white px-1.5 py-0.5 rounded border border-slate-200 text-slate-800 font-mono">Remarks</code>.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
