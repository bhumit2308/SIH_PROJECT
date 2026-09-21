'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useAuth, apiRequest } from '@/lib/auth';
import {
  ClipboardList, CheckCircle2, AlertTriangle, Clock,
  Plus, ArrowRight, TrendingUp, Shield, Scale, Activity,
  Download, ShoppingBag, ExternalLink, RefreshCw, BarChart3,
  FileCheck, ShieldAlert, Sparkles, Filter, ChevronRight
} from 'lucide-react';

interface AnalyticsData {
  kpis: {
    total_inspections: number;
    compliance_rate: number;
    compliant_count: number;
    violations_count: number;
    review_required_count: number;
    pending_count: number;
    compounding_pipeline_inr: number;
    reports_issued: number;
    total_downloads: number;
  };
  rule_violations: Array<{
    field_code: string;
    rule_name: string;
    count: number;
  }>;
  mode_distribution: {
    physical_retail: number;
    ecommerce_audit: number;
    pre_screening: number;
  };
  recent_inspections: Array<{
    id: string;
    product_name: string;
    category: string;
    mode: string;
    final_status: string;
    created_at: string;
  }>;
  timestamp_utc: string;
}

const STATUS_CONFIG: Record<string, { label: string; bg: string; text: string; border: string }> = {
  COMPLIANT: {
    label: 'Statutory Pass',
    bg: 'bg-emerald-950/60',
    text: 'text-emerald-400',
    border: 'border-emerald-800/40'
  },
  NON_COMPLIANT: {
    label: 'Rule Violation',
    bg: 'bg-rose-950/60',
    text: 'text-rose-400',
    border: 'border-rose-800/40'
  },
  REVIEW_REQUIRED: {
    label: 'Officer Review',
    bg: 'bg-amber-950/60',
    text: 'text-amber-400',
    border: 'border-amber-800/40'
  },
  PENDING: {
    label: 'Analysis Pending',
    bg: 'bg-slate-900',
    text: 'text-slate-400',
    border: 'border-slate-800'
  },
};

export default function DashboardPage() {
  const { token, user } = useAuth();
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);

  const fetchAnalytics = async () => {
    if (!token) return;
    setLoading(true);
    try {
      const res = await apiRequest<AnalyticsData>('/api/v1/analytics/overview', { token });
      setData(res);
    } catch (err) {
      console.error('Failed to load analytics:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAnalytics();
  }, [token]);

  const handleExportCsv = async () => {
    if (!token) return;
    setExporting(true);
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
      const res = await fetch(`${apiUrl}/api/v1/analytics/export-csv`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) throw new Error('Export failed');
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `METRA_Statutory_Audit_${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err) {
      alert('Failed to export CSV audit report.');
    } finally {
      setExporting(false);
    }
  };

  const greeting = () => {
    const h = new Date().getHours();
    if (h < 12) return 'Good morning';
    if (h < 17) return 'Good afternoon';
    return 'Good evening';
  };

  const kpis = data?.kpis;
  const maxRuleCount = Math.max(...(data?.rule_violations?.map(r => r.count) || [1]), 1);

  return (
    <div className="space-y-6">
      {/* ── Page Header & Command Actions ── */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 pb-4 border-b border-[#1e293b]">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
              {greeting()}, {user?.full_name?.split(' ')[0] ?? 'Inspector'}
            </h1>
            <span className="text-[11px] font-mono font-semibold px-2 py-0.5 rounded bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
              JURISDICTION: DL-CENTRAL
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            National Legal Metrology Enforcement Registry · Statutory Surveillance Hub
          </p>
        </div>

        <div className="flex items-center flex-wrap gap-2.5">
          <button
            onClick={fetchAnalytics}
            className="p-2 rounded-lg bg-[#0e1628] hover:bg-[#131d33] border border-[#1e293b] text-slate-400 hover:text-white transition-all text-xs"
            title="Refresh Ledger"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          </button>

          <button
            onClick={handleExportCsv}
            disabled={exporting}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-[#0e1628] hover:bg-[#131d33] border border-[#1e293b] text-slate-300 hover:text-white transition-all text-xs font-medium"
          >
            <Download size={14} />
            <span>{exporting ? 'Generating…' : 'Ministerial CSV'}</span>
          </button>

          <Link
            href="/dashboard/inspections/new?tab=ecommerce"
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-amber-950/40 hover:bg-amber-900/50 border border-amber-800/40 text-amber-300 transition-all text-xs font-medium"
          >
            <ShoppingBag size={14} />
            <span>Audit E-Commerce</span>
          </Link>

          <Link
            href="/dashboard/inspections/new"
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 text-white font-semibold text-xs transition-all shadow-md shadow-indigo-600/20"
          >
            <Plus size={15} />
            <span>New Inspection</span>
          </Link>
        </div>
      </div>

      {/* ── 4-Column Enterprise KPI Grid ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Total Inspections */}
        <div className="p-4 rounded-xl bg-[#0c1322] border border-[#1e293b] hover:border-slate-700 transition-all space-y-2">
          <div className="flex items-center justify-between text-xs font-mono text-slate-400 uppercase tracking-wider">
            <span>Total Audits</span>
            <div className="p-1.5 rounded-md bg-indigo-950/60 border border-indigo-800/40 text-indigo-400">
              <ClipboardList size={15} />
            </div>
          </div>
          <div className="text-2xl font-bold font-mono text-white">
            {loading ? '—' : (kpis?.total_inspections ?? 0)}
          </div>
          <div className="flex items-center justify-between text-[11px] text-slate-400 pt-1 border-t border-[#1e293b]/60">
            <span>Certificates Issued:</span>
            <span className="font-mono text-slate-200 font-semibold">{kpis?.reports_issued ?? 0}</span>
          </div>
        </div>

        {/* Card 2: Compliance Rate */}
        <div className="p-4 rounded-xl bg-[#0c1322] border border-[#1e293b] hover:border-slate-700 transition-all space-y-2">
          <div className="flex items-center justify-between text-xs font-mono text-slate-400 uppercase tracking-wider">
            <span>Compliance Rate</span>
            <div className="p-1.5 rounded-md bg-emerald-950/60 border border-emerald-800/40 text-emerald-400">
              <CheckCircle2 size={15} />
            </div>
          </div>
          <div className="text-2xl font-bold font-mono text-emerald-400">
            {loading ? '—' : `${kpis?.compliance_rate ?? 100}%`}
          </div>
          <div className="flex items-center justify-between text-[11px] text-slate-400 pt-1 border-t border-[#1e293b]/60">
            <span>Passed / Violations:</span>
            <span className="font-mono text-slate-200 font-semibold">{kpis?.compliant_count ?? 0} / {kpis?.violations_count ?? 0}</span>
          </div>
        </div>

        {/* Card 3: Compounding Pipeline */}
        <div className="p-4 rounded-xl bg-[#0c1322] border border-[#1e293b] hover:border-slate-700 transition-all space-y-2">
          <div className="flex items-center justify-between text-xs font-mono text-slate-400 uppercase tracking-wider">
            <span>§48 Compounding</span>
            <div className="p-1.5 rounded-md bg-rose-950/60 border border-rose-800/40 text-rose-400">
              <Scale size={15} />
            </div>
          </div>
          <div className="text-2xl font-bold font-mono text-rose-400">
            {loading ? '—' : `₹${(kpis?.compounding_pipeline_inr ?? 0).toLocaleString('en-IN')}`}
          </div>
          <div className="flex items-center justify-between text-[11px] text-slate-400 pt-1 border-t border-[#1e293b]/60">
            <span>Statutory Penalties:</span>
            <span className="font-mono text-rose-300 font-semibold">{kpis?.violations_count ?? 0} Active Notices</span>
          </div>
        </div>

        {/* Card 4: Action Queue */}
        <div className="p-4 rounded-xl bg-[#0c1322] border border-[#1e293b] hover:border-slate-700 transition-all space-y-2">
          <div className="flex items-center justify-between text-xs font-mono text-slate-400 uppercase tracking-wider">
            <span>Action Queue</span>
            <div className="p-1.5 rounded-md bg-amber-950/60 border border-amber-800/40 text-amber-400">
              <Clock size={15} />
            </div>
          </div>
          <div className="text-2xl font-bold font-mono text-amber-400">
            {loading ? '—' : ((kpis?.review_required_count ?? 0) + (kpis?.pending_count ?? 0))}
          </div>
          <div className="flex items-center justify-between text-[11px] text-slate-400 pt-1 border-t border-[#1e293b]/60">
            <Link href="/dashboard/reviews" className="text-indigo-400 hover:text-indigo-300 flex items-center gap-1 font-semibold">
              Open Officer Queue <ChevronRight size={12} />
            </Link>
          </div>
        </div>
      </div>

      {/* ── Middle Two-Column Analytical Deep-Dive ── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left: Infractions by LMPC Rule 2011 */}
        <div className="lg:col-span-7 p-5 rounded-xl bg-[#0c1322] border border-[#1e293b] space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-[#1e293b]">
            <div>
              <h2 className="text-sm font-bold text-white tracking-wide">
                Infractions by Statutory Rule
              </h2>
              <p className="text-[11px] text-slate-400 font-mono">
                Legal Metrology (Packaged Commodities) Rules, 2011
              </p>
            </div>
            <BarChart3 size={16} className="text-indigo-400" />
          </div>

          <div className="space-y-3">
            {data?.rule_violations && data.rule_violations.length > 0 ? (
              data.rule_violations.map((rule, idx) => {
                const pct = Math.round((rule.count / maxRuleCount) * 100);
                return (
                  <div key={idx} className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-medium text-slate-300">{rule.rule_name}</span>
                      <span className="font-mono text-xs font-semibold text-rose-400">
                        {rule.count} {rule.count === 1 ? 'case' : 'cases'}
                      </span>
                    </div>
                    <div className="w-full h-2 rounded-full bg-[#131d33] overflow-hidden">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-rose-500 to-amber-500 transition-all duration-500"
                        style={{ width: `${Math.max(pct, 6)}%` }}
                      />
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="py-8 text-center text-xs text-slate-500 font-mono">
                No active statutory infractions recorded in current window.
              </div>
            )}
          </div>
        </div>

        {/* Right: Channel Surveillance & Distribution */}
        <div className="lg:col-span-5 p-5 rounded-xl bg-[#0c1322] border border-[#1e293b] flex flex-col justify-between space-y-4">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-[#1e293b]">
              <div>
                <h2 className="text-sm font-bold text-white tracking-wide">
                  Surveillance Channels
                </h2>
                <p className="text-[11px] text-slate-400 font-mono">
                  Physical Retail vs E-Commerce Marketplaces
                </p>
              </div>
              <Activity size={16} className="text-emerald-400" />
            </div>

            <div className="grid grid-cols-3 gap-2 mt-4">
              <div className="p-3 rounded-lg bg-[#070b14] border border-[#1e293b]">
                <div className="text-[10px] uppercase font-mono text-slate-400">Physical Retail</div>
                <div className="text-lg font-bold font-mono text-white mt-0.5">
                  {data?.mode_distribution?.physical_retail ?? 0}
                </div>
              </div>
              <div className="p-3 rounded-lg bg-[#070b14] border border-[#1e293b]">
                <div className="text-[10px] uppercase font-mono text-amber-400">E-Commerce</div>
                <div className="text-lg font-bold font-mono text-amber-300 mt-0.5">
                  {data?.mode_distribution?.ecommerce_audit ?? 0}
                </div>
              </div>
              <div className="p-3 rounded-lg bg-[#070b14] border border-[#1e293b]">
                <div className="text-[10px] uppercase font-mono text-indigo-400">Pre-Screen</div>
                <div className="text-lg font-bold font-mono text-indigo-300 mt-0.5">
                  {data?.mode_distribution?.pre_screening ?? 0}
                </div>
              </div>
            </div>
          </div>

          <div className="p-3.5 rounded-lg bg-[#070b14] border border-[#1e293b] flex items-center justify-between text-xs">
            <div>
              <div className="font-semibold text-slate-200">Public Verification Node</div>
              <div className="text-[11px] text-slate-400">Check notice hashes and certificates</div>
            </div>
            <Link
              href="/verify"
              className="px-2.5 py-1.5 rounded-md bg-indigo-600/20 hover:bg-indigo-600/30 border border-indigo-500/30 text-indigo-300 font-medium text-xs flex items-center gap-1 transition-all"
            >
              <span>Verify</span>
              <ExternalLink size={12} />
            </Link>
          </div>
        </div>
      </div>

      {/* ── Bottom Dense Inspection Ledger Table ── */}
      <div className="p-5 rounded-xl bg-[#0c1322] border border-[#1e293b] space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 pb-3 border-b border-[#1e293b]">
          <div>
            <h2 className="text-sm font-bold text-white tracking-wide">
              Recent Inspection Determinations
            </h2>
            <p className="text-[11px] text-slate-400 font-mono">
              Live ledger of automated OCR evaluations & field seizure records
            </p>
          </div>
          <Link
            href="/dashboard/inspections"
            className="text-xs font-semibold text-indigo-400 hover:text-indigo-300 flex items-center gap-1"
          >
            <span>View All Records</span>
            <ArrowRight size={13} />
          </Link>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-[#1e293b] text-slate-400 uppercase font-mono text-[10px] tracking-wider">
                <th className="py-2.5 px-3">Packaged Commodity</th>
                <th className="py-2.5 px-3">Category</th>
                <th className="py-2.5 px-3">Channel</th>
                <th className="py-2.5 px-3">Statutory Finding</th>
                <th className="py-2.5 px-3">Date</th>
                <th className="py-2.5 px-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#1e293b]/50">
              {data?.recent_inspections && data.recent_inspections.length > 0 ? (
                data.recent_inspections.map(insp => {
                  const cfg = STATUS_CONFIG[insp.final_status] ?? {
                    label: insp.final_status,
                    bg: 'bg-slate-900',
                    text: 'text-slate-400',
                    border: 'border-slate-800'
                  };
                  return (
                    <tr key={insp.id} className="hover:bg-[#11192e] transition-colors">
                      <td className="py-3 px-3 font-medium text-slate-200">
                        <Link href={`/dashboard/inspections/${insp.id}`} className="hover:text-indigo-400">
                          {insp.product_name || 'Packaged Good'}
                        </Link>
                      </td>
                      <td className="py-3 px-3 text-slate-400">{insp.category || 'General'}</td>
                      <td className="py-3 px-3 font-mono text-[11px] text-slate-400">
                        {insp.mode === 'ECOMMERCE_AUDIT' ? 'E-Commerce' : 'Physical Retail'}
                      </td>
                      <td className="py-3 px-3">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full font-mono text-[10px] font-semibold border ${cfg.bg} ${cfg.text} ${cfg.border}`}>
                          {cfg.label}
                        </span>
                      </td>
                      <td className="py-3 px-3 font-mono text-[11px] text-slate-400">
                        {new Date(insp.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                      </td>
                      <td className="py-3 px-3 text-right">
                        <Link
                          href={`/dashboard/inspections/${insp.id}`}
                          className="px-2 py-1 rounded bg-[#131d33] hover:bg-indigo-600/30 border border-[#1e293b] hover:border-indigo-500/40 text-slate-300 hover:text-indigo-300 transition-all font-mono text-[11px]"
                        >
                          Review →
                        </Link>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-xs text-slate-500 font-mono">
                    No recent inspections recorded in database.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
