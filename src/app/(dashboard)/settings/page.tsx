'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/components/AuthProvider';

interface CompanyProfile {
  id?: number;
  companyName: string;
  tagline: string;
  gstin: string;
  address: string;
  phone: string;
  email: string;
  bankName: string;
  bankAccount: string;
  bankIfsc: string;
  bankBranch: string;
  logoUrl: string;
}

const EMPTY: CompanyProfile = {
  companyName: '',
  tagline: '',
  gstin: '',
  address: '',
  phone: '',
  email: '',
  bankName: '',
  bankAccount: '',
  bankIfsc: '',
  bankBranch: '',
  logoUrl: '',
};

export default function SettingsPage() {
  const { user, authFetch } = useAuth();
  const [form, setForm] = useState<CompanyProfile>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [notification, setNotification] = useState('');
  const [error, setError] = useState('');

  const canEdit = user?.role === 'admin' || user?.role === 'manager';

  const fetchSettings = useCallback(async () => {
    try {
      const res = await authFetch('/api/settings');
      if (res.ok) {
        const data = await res.json();
        setForm({
          companyName: data.companyName || '',
          tagline: data.tagline || '',
          gstin: data.gstin || '',
          address: data.address || '',
          phone: data.phone || '',
          email: data.email || '',
          bankName: data.bankName || '',
          bankAccount: data.bankAccount || '',
          bankIfsc: data.bankIfsc || '',
          bankBranch: data.bankBranch || '',
          logoUrl: data.logoUrl || '',
        });
      }
    } catch (err) {
      console.error('Failed to load settings', err);
    } finally {
      setLoading(false);
    }
  }, [authFetch]);

  useEffect(() => {
    if (canEdit) fetchSettings();
  }, [canEdit, fetchSettings]);

  const handleSave = async () => {
    setSaving(true);
    setError('');
    setNotification('');
    try {
      const res = await authFetch('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      if (res.ok) {
        const data = await res.json();
        setForm(data);
        setNotification('Company profile saved successfully.');
        setTimeout(() => setNotification(''), 3000);
      } else {
        const data = await res.json();
        setError(data.error || 'Failed to save settings');
      }
    } catch {
      setError('Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  if (!canEdit) {
    return (
      <div className="flex flex-col items-center justify-center h-full min-h-[60vh] text-center">
        <svg className="w-20 h-20 text-rose-500 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
        </svg>
        <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-100 mb-2">Access Denied</h2>
        <p className="text-slate-500 max-w-md">You do not have permission to edit company settings.</p>
      </div>
    );
  }

  const update = (field: keyof CompanyProfile, value: string) =>
    setForm((prev) => ({ ...prev, [field]: value }));

  if (loading) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="h-10 w-64 bg-slate-200 dark:bg-slate-700 rounded"></div>
        <div className="h-80 bg-slate-200 dark:bg-slate-700 rounded-2xl"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-12 animate-fade-in max-w-4xl mx-auto">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">Company Settings</h1>
          <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">Edit your company profile for invoices, branding, and bank details</p>
        </div>
        <button onClick={fetchSettings} className="px-4 py-2.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 font-bold text-sm rounded-xl border border-slate-200 dark:border-slate-700 flex items-center gap-2 transition-all">
          <svg className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          Refresh
        </button>
      </div>

      {notification && (
        <div className="p-4 rounded-xl bg-emerald-900/40 text-emerald-300 border border-emerald-700 font-semibold flex items-center gap-2">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
          {notification}
        </div>
      )}

      {error && (
        <div className="p-4 rounded-xl bg-red-900/30 border border-red-700 text-red-300 font-semibold">
          {error}
        </div>
      )}

      {/* ── Company Information ── */}
      <div className="glass-card p-6">
        <div className="flex items-center gap-3 mb-6 pb-4 border-b border-slate-200 dark:border-slate-800">
          <div className="p-2 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 shadow-lg shadow-indigo-500/30">
            <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" /></svg>
          </div>
          <h2 className="text-lg font-bold text-slate-900 dark:text-white">Company Information</h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="text-xs font-bold text-slate-600 dark:text-slate-400 mb-1 block">Company Name *</label>
            <input type="text" className="input-field" value={form.companyName} onChange={(e) => update('companyName', e.target.value)} placeholder="PRO SWAMI SHARNAM ENTERPRISES" />
          </div>
          <div>
            <label className="text-xs font-bold text-slate-600 dark:text-slate-400 mb-1 block">Tagline</label>
            <input type="text" className="input-field" value={form.tagline} onChange={(e) => update('tagline', e.target.value)} placeholder="Haldiram Distribution Hub" />
          </div>
          <div>
            <label className="text-xs font-bold text-slate-600 dark:text-slate-400 mb-1 block">GSTIN</label>
            <input type="text" className="input-field font-mono" maxLength={15} value={form.gstin} onChange={(e) => update('gstin', e.target.value.toUpperCase())} placeholder="23AMFPV5397L1ZB" />
          </div>
          <div>
            <label className="text-xs font-bold text-slate-600 dark:text-slate-400 mb-1 block">Phone</label>
            <input type="tel" className="input-field" value={form.phone} onChange={(e) => update('phone', e.target.value)} placeholder="+91 98765 43210" />
          </div>
          <div>
            <label className="text-xs font-bold text-slate-600 dark:text-slate-400 mb-1 block">Email</label>
            <input type="email" className="input-field" value={form.email} onChange={(e) => update('email', e.target.value)} placeholder="accounts@example.com" />
          </div>
          <div className="md:col-span-2">
            <label className="text-xs font-bold text-slate-600 dark:text-slate-400 mb-1 block">Address</label>
            <textarea className="input-field min-h-[80px]" value={form.address} onChange={(e) => update('address', e.target.value)} placeholder="City, State – Pincode" />
          </div>
          <div className="md:col-span-2">
            <label className="text-xs font-bold text-slate-600 dark:text-slate-400 mb-1 block">Logo URL (optional)</label>
            <input type="url" className="input-field" value={form.logoUrl} onChange={(e) => update('logoUrl', e.target.value)} placeholder="https://example.com/logo.png" />
          </div>
        </div>
      </div>

      {/* ── Bank Details ── */}
      <div className="glass-card p-6">
        <div className="flex items-center gap-3 mb-6 pb-4 border-b border-slate-200 dark:border-slate-800">
          <div className="p-2 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 shadow-lg shadow-emerald-500/30">
            <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" /></svg>
          </div>
          <h2 className="text-lg font-bold text-slate-900 dark:text-white">Bank Details</h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="text-xs font-bold text-slate-600 dark:text-slate-400 mb-1 block">Bank Name</label>
            <input type="text" className="input-field" value={form.bankName} onChange={(e) => update('bankName', e.target.value)} placeholder="State Bank of India" />
          </div>
          <div>
            <label className="text-xs font-bold text-slate-600 dark:text-slate-400 mb-1 block">Account Number</label>
            <input type="text" className="input-field font-mono" value={form.bankAccount} onChange={(e) => update('bankAccount', e.target.value)} placeholder="3987 6543 2109" />
          </div>
          <div>
            <label className="text-xs font-bold text-slate-600 dark:text-slate-400 mb-1 block">IFSC Code</label>
            <input type="text" className="input-field font-mono uppercase" maxLength={11} value={form.bankIfsc} onChange={(e) => update('bankIfsc', e.target.value.toUpperCase())} placeholder="SBIN0001234" />
          </div>
          <div>
            <label className="text-xs font-bold text-slate-600 dark:text-slate-400 mb-1 block">Branch</label>
            <input type="text" className="input-field" value={form.bankBranch} onChange={(e) => update('bankBranch', e.target.value)} placeholder="MP Nagar, Bhopal" />
          </div>
        </div>
      </div>

      {/* ── Invoice Preview ── */}
      <div className="glass-card p-6">
        <div className="flex items-center gap-3 mb-6 pb-4 border-b border-slate-200 dark:border-slate-800">
          <div className="p-2 rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 shadow-lg shadow-amber-500/30">
            <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
          </div>
          <div>
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">Invoice Header Preview</h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">This is how your PDF invoices will appear</p>
          </div>
        </div>

        {/* Simulated invoice header */}
        <div className="bg-slate-800 rounded-xl p-5 text-white">
          <div className="text-sm font-bold">{form.companyName || 'Company Name'}</div>
          {form.tagline && <div className="text-[11px] text-slate-300">{form.tagline}</div>}
          {form.gstin && <div className="text-[11px] text-slate-300">GSTIN: {form.gstin}</div>}
          {(form.address || form.phone || form.email) && (
            <div className="text-[11px] text-slate-300">
              {[form.address, form.phone, form.email].filter(Boolean).join(' | ')}
            </div>
          )}
        </div>

        {/* Bank preview */}
        {(form.bankName || form.bankAccount) && (
          <div className="mt-3 bg-slate-50 dark:bg-slate-900 rounded-xl p-4 border border-slate-200 dark:border-slate-800">
            <p className="text-xs font-bold text-slate-600 dark:text-slate-400 mb-1">Bank Details on Invoice</p>
            {form.bankName && <p className="text-xs text-slate-700 dark:text-slate-300">Bank: {form.bankName}</p>}
            {form.bankAccount && <p className="text-xs text-slate-700 dark:text-slate-300">A/C: {form.bankAccount}</p>}
            {form.bankIfsc && <p className="text-xs text-slate-700 dark:text-slate-300">IFSC: {form.bankIfsc}</p>}
            {form.bankBranch && <p className="text-xs text-slate-700 dark:text-slate-300">Branch: {form.bankBranch}</p>}
          </div>
        )}
      </div>

      {/* ── Save button ── */}
      <div className="flex justify-end">
        <button
          onClick={handleSave}
          disabled={saving || !form.companyName.trim()}
          className="btn-primary px-8 py-3 text-sm font-bold disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {saving ? (
            <span className="flex items-center gap-2">
              <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
              Saving...
            </span>
          ) : 'Save Company Profile'}
        </button>
      </div>
    </div>
  );
}
