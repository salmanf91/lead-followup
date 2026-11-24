'use client';

import React, { useState } from 'react';
import { importLeadsCsv } from '../../lib/api';

interface CsvImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export default function CsvImportModal({ isOpen, onClose, onSuccess }: CsvImportModalProps) {
  const [csvText, setCsvText] = useState<string>('');
  const [fileName, setFileName] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{
    totalProcessed: number;
    importedCount: number;
    duplicateCount: number;
  } | null>(null);

  if (!isOpen) return null;

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    setError(null);
    setResult(null);

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      setCsvText(text || '');
    };
    reader.onerror = () => {
      setError('Failed to read CSV file');
    };
    reader.readAsText(file);
  };

  const handleImport = async () => {
    if (!csvText.trim()) {
      setError('Please select or paste CSV data first');
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const res = await importLeadsCsv(csvText.trim());
      setResult({
        totalProcessed: res.totalProcessed,
        importedCount: res.importedCount,
        duplicateCount: res.duplicateCount,
      });
      onSuccess();
    } catch (err: any) {
      setError(err.message || 'Failed to import CSV');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
      <div className="bg-white rounded-2xl max-w-lg w-full border border-slate-200 shadow-2xl p-6 relative">
        <div className="flex items-center justify-between pb-4 border-b border-slate-200">
          <div>
            <h3 className="text-lg font-bold text-slate-900">Import Leads from CSV</h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Bulk import student admissions inquiries with automated Saudi phone normalization.
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

        <div className="py-4 space-y-4 text-xs">
          {error && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-700">
              {error}
            </div>
          )}

          {result && (
            <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl space-y-2">
              <div className="flex items-center gap-2 text-emerald-800 font-bold text-sm">
                <svg className="w-5 h-5 text-emerald-600" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
                Import Completed Successfully!
              </div>
              <p className="text-emerald-700">
                Processed <strong>{result.totalProcessed}</strong> rows: Added{' '}
                <strong>{result.importedCount}</strong> new leads ({result.duplicateCount} marked as duplicate).
              </p>
            </div>
          )}

          {/* File Upload Zone */}
          <div>
            <label className="block font-semibold text-slate-700 mb-1">Select CSV File</label>
            <div className="flex items-center gap-3">
              <label className="cursor-pointer inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200/80 text-slate-700 font-semibold border border-slate-300 transition">
                <svg className="w-4 h-4 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                </svg>
                Choose File
                <input
                  type="file"
                  accept=".csv,text/csv"
                  onChange={handleFileUpload}
                  className="hidden"
                />
              </label>
              <span className="text-slate-500 truncate max-w-xs">{fileName || 'No file selected yet'}</span>
            </div>
          </div>

          {/* Or Paste CSV Text */}
          <div>
            <label className="block font-semibold text-slate-700 mb-1">Or Paste CSV Data Directly</label>
            <textarea
              value={csvText}
              onChange={(e) => {
                setCsvText(e.target.value);
                setFileName(null);
                setResult(null);
              }}
              rows={5}
              placeholder="Date,Parent Name,Phone,Grade,Campaign,Feedback,Followup - 1&#10;2026-11-20,Ahmad Al-Mansour,0501234567,KG1,Social Ads,Interested,Called and sent brochure"
              className="w-full font-mono text-xs p-2.5 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-slate-50"
            />
          </div>

          <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 text-amber-800 text-[11px] leading-relaxed">
            <strong>Expected Columns:</strong> Name, Phone, Grade, Campaign, Feedback, Followup - 1, Followup - 2. Phone numbers will be automatically formatted to Saudi E.164.
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-3 border-t border-slate-200">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 transition"
          >
            Close
          </button>
          <button
            onClick={handleImport}
            disabled={loading || !csvText.trim()}
            className="px-4 py-2 rounded-xl text-xs font-bold text-white bg-[#10457C] hover:bg-[#0A2B4E] disabled:opacity-50 transition shadow-xs"
          >
            {loading ? 'Importing Leads...' : 'Start Import'}
          </button>
        </div>
      </div>
    </div>
  );
}

