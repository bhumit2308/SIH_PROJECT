'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useAuth, apiRequest } from '@/lib/auth';
import {
  ClipboardList, CheckCircle2, AlertTriangle, Clock,
  Plus, ArrowRight, TrendingUp, Shield, Scale, Activity,
  Download, ShoppingBag, ExternalLink, RefreshCw, BarChart3,
  FileCheck, ShieldAlert
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

const STATUS_CONFIG: Record<string, { label: string; className: string }> = {
  COMPLIANT:        { label: 'Compliant',       className: 'badge-success' },
  NON_COMPLIANT:    { label: 'Non-Compliant',    className: 'badge-danger' },
  REVIEW_REQUIRED:  { label: 'Review Required',  className: 'badge-warning' },
  PENDING:          { label: 'Pending',          className: 'badge-muted' },
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
      a.download = `METRA_Regulatory_Audit_${new Date().toISOString().slice(0,10)}.csv`;
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
    <>
      {/* Page Header */}
      <div className="page-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.2rem' }}>
            <h1 style={{ fontSize: '1.3rem', fontWeight: 800 }}>
              {greeting()}, {user?.full_name?.split(' ')[0] ?? 'Officer'} 👋
            </h1>
            <span style={{ fontSize: '0.72rem', fontWeight: 700, padding: '0.15rem 0.55rem', borderRadius: '4px', background: 'rgba(99,102,241,0.15)', color: 'var(--accent-light)', border: '1px solid var(--border)' }}>
              HQ COMMAND CENTER
            </span>
          </div>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.825rem' }}>
            National Legal Metrology Statutory Registry & Enforcement Hub
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <button
            onClick={handleExportCsv}
            disabled={exporting}
            className="btn btn-ghost"
            style={{ fontSize: '0.825rem', padding: '0.5rem 0.9rem' }}
          >
            <Download size={15} /> {exporting ? 'Exporting...' : 'Ministerial CSV'}
          </button>
          <Link href="/dashboard/inspections/new?tab=ecommerce">
            <button className="btn btn-ghost" style={{ fontSize: '0.825rem', padding: '0.5rem 0.9rem', borderColor: 'rgba(245, 158, 11, 0.4)', color: '#fbbf24' }}>
              <ShoppingBag size={15} /> Audit E-Commerce
            </button>
          </Link>
          <Link href="/dashboard/inspections/new">
            <button className="btn btn-primary" style={{ fontSize: '0.825rem', padding: '0.5rem 1rem' }}>
              <Plus size={16} /> New Inspection
            </button>
          </Link>
        </div>
      </div>

      <div className="page-body animate-fade">
        {/* KPI Executive Summary Cards */}
        <div className="grid-4" style={{ marginBottom: '1.5rem' }}>
          {/* Total Inspections */}
          <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                Total Inspections
              </span>
              <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: 'rgba(99,102,241,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <ClipboardList size={16} color="var(--accent-light)" />
              </div>
            </div>
            <div style={{ fontSize: '1.8rem', fontWeight: 800, color: '#ffffff' }}>
              {loading ? '—' : kpis?.total_inspections ?? 0}
            </div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
              <span>{kpis?.reports_issued ?? 0} Statutory Certificates Issued</span>
            </div>
          </div>

          {/* Statutory Compliance Rate */}
          <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                Compliance Rate
              </span>
              <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: 'rgba(16,185,129,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <CheckCircle2 size={16} color="var(--success)" />
              </div>
            </div>
            <div style={{ fontSize: '1.8rem', fontWeight: 800, color: '#4ade80' }}>
              {loading ? '—' : `${kpis?.compliance_rate ?? 100}%`}
            </div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              {kpis?.compliant_count ?? 0} Compliant / {kpis?.violations_count ?? 0} Violations
            </div>
          </div>

          {/* Section 48 Compounding Pipeline */}
          <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                Compounding Pipeline
              </span>
              <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: 'rgba(239,68,68,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Scale size={16} color="var(--danger)" />
              </div>
            </div>
            <div style={{ fontSize: '1.8rem', fontWeight: 800, color: '#f87171' }}>
              {loading ? '—' : `₹${(kpis?.compounding_pipeline_inr ?? 0).toLocaleString('en-IN')}`}
            </div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              Section 48 compounding fee assessment
            </div>
          </div>

          {/* Pending Reviews / Grievances */}
          <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                Pending Review
              </span>
              <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: 'rgba(245,158,11,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Clock size={16} color="var(--warning)" />
              </div>
            </div>
            <div style={{ fontSize: '1.8rem', fontWeight: 800, color: '#fbbf24' }}>
              {loading ? '—' : (kpis?.review_required_count ?? 0) + (kpis?.pending_count ?? 0)}
            </div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              <Link href="/dashboard/reviews" style={{ color: 'var(--accent-light)', textDecoration: 'none' }}>
                Open Officer Queue →
              </Link>
            </div>
          </div>
        </div>

        {/* Analytics Breakdown Grid (2 columns) */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(380px, 1fr))', gap: '1.5rem', marginBottom: '1.5rem' }}>
          {/* Infractions by Legal Metrology Rule */}
          <div className="card" style={{ padding: '1.5rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.2rem' }}>
              <div>
                <h2 style={{ fontSize: '0.95rem', fontWeight: 700, color: '#ffffff' }}>
                  Infractions by Statutory Rule
                </h2>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.78rem' }}>
                  Frequency distribution under Packaged Commodities Rules, 2011
                </p>
              </div>
              <BarChart3 size={18} color="var(--accent-light)" />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
              {data?.rule_violations && data.rule_violations.length > 0 ? (
                data.rule_violations.map((rule, idx) => {
                  const pct = Math.round((rule.count / maxRuleCount) * 100);
                  return (
                    <div key={idx} style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.78rem' }}>
                        <span style={{ fontWeight: 600, color: '#e2e8f0' }}>{rule.rule_name}</span>
                        <span style={{ color: rule.count > 0 ? '#f87171' : 'var(--text-muted)', fontWeight: 700 }}>
                          {rule.count} {rule.count === 1 ? 'violation' : 'violations'}
                        </span>
                      </div>
                      <div style={{ width: '100%', height: '6px', background: 'rgba(255,255,255,0.06)', borderRadius: '3px', overflow: 'hidden' }}>
                        <div style={{ width: `${pct}%`, height: '100%', background: rule.count > 0 ? 'linear-gradient(90deg, #ef4444, #f87171)' : 'var(--border)', borderRadius: '3px' }} />
                      </div>
                    </div>
                  );
                })
              ) : (
                <div style={{ textAlign: 'center', padding: '2rem 0', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                  No active statutory violations recorded.
                </div>
              )}
            </div>
          </div>

          {/* Channel Enforcement & Quick Actions */}
          <div className="card" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.2rem' }}>
                <div>
                  <h2 style={{ fontSize: '0.95rem', fontWeight: 700, color: '#ffffff' }}>
                    Channel Distribution & Enforceability
                  </h2>
                  <p style={{ color: 'var(--text-muted)', fontSize: '0.78rem' }}>
                    Physical Retail vs Quick-Commerce / E-Commerce Audits
                  </p>
                </div>
                <Activity size={18} color="#10b981" />
              </div>

              <div className="grid-3" style={{ gap: '0.75rem', marginBottom: '1.2rem' }}>
                <div style={{ background: 'rgba(255,255,255,0.03)', padding: '0.75rem', borderRadius: '8px', border: '1px solid var(--border)' }}>
                  <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', display: 'block', textTransform: 'uppercase' }}>Physical Retail</span>
                  <span style={{ fontSize: '1.2rem', fontWeight: 700, color: '#ffffff' }}>
                    {data?.mode_distribution?.physical_retail ?? 0}
                  </span>
                </div>
                <div style={{ background: 'rgba(255,255,255,0.03)', padding: '0.75rem', borderRadius: '8px', border: '1px solid var(--border)' }}>
                  <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', display: 'block', textTransform: 'uppercase' }}>E-Commerce Audits</span>
                  <span style={{ fontSize: '1.2rem', fontWeight: 700, color: '#fbbf24' }}>
                    {data?.mode_distribution?.ecommerce_audit ?? 0}
                  </span>
                </div>
                <div style={{ background: 'rgba(255,255,255,0.03)', padding: '0.75rem', borderRadius: '8px', border: '1px solid var(--border)' }}>
                  <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', display: 'block', textTransform: 'uppercase' }}>Pre-Screening</span>
                  <span style={{ fontSize: '1.2rem', fontWeight: 700, color: '#818cf8' }}>
                    {data?.mode_distribution?.pre_screening ?? 0}
                  </span>
                </div>
              </div>
            </div>

            {/* Statutory Quick Links */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', background: 'rgba(15,23,42,0.6)', padding: '0.85rem', borderRadius: '8px', border: '1px solid var(--border)' }}>
              <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                Public Verification Portal
              </div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: '0.8rem', color: '#cbd5e1' }}>
                  Verify any issued statutory certificate or notice reference:
                </span>
                <Link href="/verify" style={{ fontSize: '0.8rem', color: 'var(--accent-light)', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '0.2rem', fontWeight: 600 }}>
                  Open Portal <ExternalLink size={13} />
                </Link>
              </div>
            </div>
          </div>
        </div>

        {/* Recent Inspections Table */}
        <div className="card" style={{ padding: '1.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.2rem' }}>
            <div>
              <h2 style={{ fontSize: '0.95rem', fontWeight: 700, color: '#ffffff' }}>
                Recent Inspections & Section 15 Determinations
              </h2>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.78rem' }}>
                Real-time ledger of automated packaging inspections and field audits
              </p>
            </div>
            <Link href="/dashboard/inspections" style={{ fontSize: '0.8rem', color: 'var(--accent-light)', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '0.3rem', fontWeight: 600 }}>
              View All Inspections <ArrowRight size={14} />
            </Link>
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.825rem' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border)', textAlign: 'left', color: 'var(--text-muted)', fontSize: '0.75rem', textTransform: 'uppercase' }}>
                  <th style={{ padding: '0.6rem 0.75rem' }}>Product Name</th>
                  <th style={{ padding: '0.6rem 0.75rem' }}>Category</th>
                  <th style={{ padding: '0.6rem 0.75rem' }}>Mode</th>
                  <th style={{ padding: '0.6rem 0.75rem' }}>Determination</th>
                  <th style={{ padding: '0.6rem 0.75rem' }}>Date</th>
                  <th style={{ padding: '0.6rem 0.75rem', textAlign: 'right' }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {data?.recent_inspections && data.recent_inspections.length > 0 ? (
                  data.recent_inspections.map((insp) => {
                    const cfg = STATUS_CONFIG[insp.final_status] ?? { label: insp.final_status, className: 'badge-muted' };
                    return (
                      <tr key={insp.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                        <td style={{ padding: '0.85rem 0.75rem', fontWeight: 600, color: '#f1f5f9' }}>
                          <Link href={`/dashboard/inspections/${insp.id}`} style={{ color: 'inherit', textDecoration: 'none' }}>
                            {insp.product_name || 'Packaged Commodity'}
                          </Link>
                        </td>
                        <td style={{ padding: '0.85rem 0.75rem', color: 'var(--text-secondary)' }}>
                          {insp.category || 'Standard'}
                        </td>
                        <td style={{ padding: '0.85rem 0.75rem' }}>
                          <span style={{ fontSize: '0.72rem', padding: '0.15rem 0.5rem', borderRadius: '4px', background: 'rgba(255,255,255,0.05)', color: '#94a3b8' }}>
                            {insp.mode === 'ECOMMERCE_AUDIT' ? 'E-Commerce' : 'Physical'}
                          </span>
                        </td>
                        <td style={{ padding: '0.85rem 0.75rem' }}>
                          <span className={`badge ${cfg.className}`} style={{ fontSize: '0.75rem' }}>
                            {cfg.label}
                          </span>
                        </td>
                        <td style={{ padding: '0.85rem 0.75rem', color: 'var(--text-muted)' }}>
                          {new Date(insp.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}
                        </td>
                        <td style={{ padding: '0.85rem 0.75rem', textAlign: 'right' }}>
                          <Link href={`/dashboard/inspections/${insp.id}`}>
                            <button className="btn btn-ghost" style={{ fontSize: '0.75rem', padding: '0.3rem 0.6rem' }}>
                              Details →
                            </button>
                          </Link>
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={6} style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>
                      No inspections found in database.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </>
  );
}
