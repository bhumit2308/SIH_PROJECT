'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useAuth, apiRequest } from '@/lib/auth';
import {
  ClipboardList, CheckCircle2, AlertTriangle, Clock,
  Plus, ArrowRight, TrendingUp, Shield, Scale, Activity
} from 'lucide-react';

interface DashboardStats {
  total: number;
  compliant: number;
  non_compliant: number;
  pending: number;
  review_required: number;
}

interface RecentInspection {
  id: string;
  status: string;
  final_status: string;
  category: string;
  product_name: string | null;
  created_at: string;
}

const STATUS_CONFIG: Record<string, { label: string; className: string }> = {
  COMPLIANT:        { label: 'Compliant',       className: 'badge-success' },
  NON_COMPLIANT:    { label: 'Non-Compliant',    className: 'badge-danger' },
  REVIEW_REQUIRED:  { label: 'Review Required',  className: 'badge-warning' },
  PENDING:          { label: 'Pending',          className: 'badge-muted' },
};

export default function DashboardPage() {
  const { token, user } = useAuth();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [recent, setRecent] = useState<RecentInspection[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!token) return;
    Promise.all([
      apiRequest<RecentInspection[]>('/api/v1/inspections?limit=6', { token }),
    ]).then(([inspections]) => {
      setRecent(inspections);
      // Compute stats from inspections
      const all = inspections;
      setStats({
        total: all.length,
        compliant: all.filter(i => i.final_status === 'COMPLIANT').length,
        non_compliant: all.filter(i => i.final_status === 'NON_COMPLIANT').length,
        pending: all.filter(i => i.final_status === 'PENDING').length,
        review_required: all.filter(i => i.final_status === 'REVIEW_REQUIRED').length,
      });
    }).catch(console.error).finally(() => setLoading(false));
  }, [token]);

  const greeting = () => {
    const h = new Date().getHours();
    if (h < 12) return 'Good morning';
    if (h < 17) return 'Good afternoon';
    return 'Good evening';
  };

  return (
    <>
      {/* Page Header */}
      <div className="page-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <h1 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '0.2rem' }}>
            {greeting()}, {user?.full_name?.split(' ')[0] ?? 'Officer'} 👋
          </h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.825rem' }}>
            METRA · Legal Metrology Inspection Dashboard
          </p>
        </div>
        <Link href="/dashboard/inspections/new">
          <button className="btn btn-primary">
            <Plus size={16} /> New Inspection
          </button>
        </Link>
      </div>

      <div className="page-body animate-fade">
        {/* KPI Cards */}
        <div className="grid-4" style={{ marginBottom: '2rem' }}>
          {[
            { label: 'Total Inspections', value: stats?.total ?? '—', icon: ClipboardList, color: 'var(--accent)', bg: 'rgba(99,102,241,0.1)' },
            { label: 'Compliant', value: stats?.compliant ?? '—', icon: CheckCircle2, color: 'var(--success)', bg: 'var(--success-bg)' },
            { label: 'Violations Found', value: stats?.non_compliant ?? '—', icon: AlertTriangle, color: 'var(--danger)', bg: 'var(--danger-bg)' },
            { label: 'Pending Review', value: (stats?.review_required ?? 0) + (stats?.pending ?? 0), icon: Clock, color: 'var(--warning)', bg: 'var(--warning-bg)' },
          ].map((kpi, i) => (
            <div key={i} className="card" style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  {kpi.label}
                </span>
                <div style={{ width: '34px', height: '34px', borderRadius: '10px', background: kpi.bg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <kpi.icon size={17} color={kpi.color} />
                </div>
              </div>
              <div style={{ fontSize: '2rem', fontWeight: 800, color: loading ? 'var(--text-muted)' : 'var(--text-primary)' }}>
                {loading ? '…' : kpi.value}
              </div>
            </div>
          ))}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 360px', gap: '1.5rem' }}>
          {/* Recent Inspections Table */}
          <div className="card">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem' }}>
              <h2 style={{ fontWeight: 700, fontSize: '0.95rem' }}>Recent Inspections</h2>
              <Link href="/dashboard/inspections" style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.8rem', color: 'var(--accent-light)', textDecoration: 'none' }}>
                View all <ArrowRight size={14} />
              </Link>
            </div>

            {loading ? (
              <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>
                <Activity size={24} style={{ margin: '0 auto 0.5rem', display: 'block' }} className="animate-spin" />
                Loading inspections…
              </div>
            ) : recent.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '2.5rem', color: 'var(--text-muted)' }}>
                <ClipboardList size={36} style={{ margin: '0 auto 0.75rem', display: 'block', opacity: 0.4 }} />
                <p style={{ fontWeight: 600, marginBottom: '0.25rem' }}>No inspections yet</p>
                <p style={{ fontSize: '0.825rem' }}>Start your first inspection to see results here.</p>
              </div>
            ) : (
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Category</th>
                      <th>Product</th>
                      <th>Status</th>
                      <th>Date</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {recent.map(i => {
                      const sc = STATUS_CONFIG[i.final_status] || STATUS_CONFIG['PENDING'];
                      return (
                        <tr key={i.id}>
                          <td style={{ color: 'var(--text-secondary)', fontSize: '0.8rem' }}>{i.category}</td>
                          <td style={{ fontWeight: 500 }}>{i.product_name ?? <span style={{ color: 'var(--text-muted)' }}>—</span>}</td>
                          <td><span className={`badge ${sc.className}`}>{sc.label}</span></td>
                          <td style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                            {new Date(i.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                          </td>
                          <td>
                            <Link href={`/dashboard/inspections/${i.id}`}>
                              <button className="btn btn-ghost btn-sm">View</button>
                            </Link>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Quick Actions + System Info */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {/* Quick Actions */}
            <div className="card">
              <h2 style={{ fontWeight: 700, fontSize: '0.95rem', marginBottom: '1rem' }}>Quick Actions</h2>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                <Link href="/dashboard/inspections/new" style={{ textDecoration: 'none' }}>
                  <button className="btn btn-primary" style={{ width: '100%', justifyContent: 'center' }}>
                    <Plus size={16} /> Start New Inspection
                  </button>
                </Link>
                <Link href="/dashboard/reviews" style={{ textDecoration: 'none' }}>
                  <button className="btn btn-ghost" style={{ width: '100%', justifyContent: 'center' }}>
                    <CheckCircle2 size={16} /> Review Queue
                  </button>
                </Link>
              </div>
            </div>

            {/* System Info */}
            <div className="card" style={{ background: 'rgba(99,102,241,0.04)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.875rem' }}>
                <Shield size={16} color="var(--accent-light)" />
                <h2 style={{ fontWeight: 700, fontSize: '0.875rem' }}>Regulatory Basis</h2>
              </div>
              {[
                { label: 'Act', value: 'Legal Metrology Act, 2009' },
                { label: 'Rules', value: 'LMPC Rules 2011 + 2022 Amendment' },
                { label: 'Authority', value: 'Dept. of Consumer Affairs' },
                { label: 'Rule Pack', value: 'v1.0.0 (Published)' },
              ].map(item => (
                <div key={item.label} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem', fontSize: '0.78rem' }}>
                  <span style={{ color: 'var(--text-muted)' }}>{item.label}</span>
                  <span style={{ color: 'var(--text-secondary)', fontWeight: 500, textAlign: 'right', maxWidth: '150px' }}>{item.value}</span>
                </div>
              ))}
              <div style={{ marginTop: '0.75rem', padding: '0.5rem 0.75rem', background: 'rgba(16,185,129,0.08)', borderRadius: '6px', border: '1px solid rgba(16,185,129,0.2)', fontSize: '0.72rem', color: 'var(--success)' }}>
                <Scale size={11} style={{ display: 'inline', marginRight: '0.375rem', verticalAlign: 'middle' }} />
                AI assists inspection · Officers decide compliance
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
