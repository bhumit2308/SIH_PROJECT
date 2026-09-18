'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useAuth, apiRequest } from '@/lib/auth';
import {
  ClipboardList, Plus, Search, Filter, CheckCircle2,
  AlertTriangle, Clock, Eye, RefreshCw, Calendar, Tag, ArrowRight
} from 'lucide-react';

interface InspectionSummary {
  id: string;
  category_id: string;
  category?: { code: string; name_en: string };
  product_name: string | null;
  mode: string;
  status: string;
  final_status: string;
  confidence_score: number | null;
  created_at: string;
  images_count?: number;
}

const STATUS_MAP: Record<string, { label: string; badgeClass: string; icon: any }> = {
  COMPLIANT:       { label: 'Compliant',       badgeClass: 'badge-success', icon: CheckCircle2 },
  NON_COMPLIANT:   { label: 'Non-Compliant',   badgeClass: 'badge-danger',  icon: AlertTriangle },
  REVIEW_REQUIRED: { label: 'Review Required', badgeClass: 'badge-warning', icon: Clock },
  PENDING:         { label: 'In Progress',     badgeClass: 'badge-info',    icon: RefreshCw },
  DRAFT:           { label: 'Draft',           badgeClass: 'badge-muted',   icon: Clock },
};

export default function InspectionsListPage() {
  const { token } = useAuth();
  const [inspections, setInspections] = useState<InspectionSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');

  const fetchInspections = async () => {
    if (!token) return;
    setLoading(true);
    try {
      const data = await apiRequest<InspectionSummary[]>('/api/v1/inspections', { token });
      setInspections(data);
    } catch (err) {
      console.error('Failed to load inspections:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInspections();
  }, [token]);

  const filtered = inspections.filter(item => {
    const matchesSearch = (item.product_name || 'Unlabeled Package').toLowerCase().includes(search.toLowerCase()) ||
                          item.id.toLowerCase().includes(search.toLowerCase()) ||
                          (item.category?.name_en || '').toLowerCase().includes(search.toLowerCase());
    const matchesStatus = statusFilter === 'ALL' || item.final_status === statusFilter || item.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  return (
    <>
      <div className="page-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '0.2rem' }}>
            Inspection Registry
          </h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.825rem' }}>
            Comprehensive records of statutory Legal Metrology package evaluations
          </p>
        </div>
        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <button className="btn btn-ghost" onClick={fetchInspections} title="Refresh">
            <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
          </button>
          <Link href="/dashboard/inspections/new">
            <button className="btn btn-primary">
              <Plus size={16} /> New Inspection
            </button>
          </Link>
        </div>
      </div>

      <div className="page-body animate-fade">
        {/* Filter & Search Bar */}
        <div className="card" style={{ marginBottom: '1.5rem', padding: '1rem 1.25rem' }}>
          <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', alignItems: 'center' }}>
            <div style={{ position: 'relative', flex: '1 1 250px' }}>
              <Search size={16} style={{ position: 'absolute', left: '0.875rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
              <input
                type="text"
                placeholder="Search by product name, category, or ID..."
                className="input"
                style={{ paddingLeft: '2.5rem' }}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
              <Filter size={15} style={{ color: 'var(--text-muted)' }} />
              <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Status:</span>
              {['ALL', 'COMPLIANT', 'NON_COMPLIANT', 'REVIEW_REQUIRED', 'PENDING'].map((st) => (
                <button
                  key={st}
                  onClick={() => setStatusFilter(st)}
                  className={`badge ${statusFilter === st ? 'badge-primary' : 'badge-muted'}`}
                  style={{ cursor: 'pointer', border: 'none', padding: '0.35rem 0.75rem' }}
                >
                  {st === 'ALL' ? 'All' : (STATUS_MAP[st]?.label || st)}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Inspections List */}
        {loading ? (
          <div className="card" style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
            <RefreshCw size={28} className="animate-spin" style={{ margin: '0 auto 1rem', display: 'block', color: 'var(--accent)' }} />
            <p>Loading inspection registry records…</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="card" style={{ padding: '3.5rem 2rem', textAlign: 'center' }}>
            <ClipboardList size={40} style={{ margin: '0 auto 1rem', display: 'block', color: 'var(--text-muted)', opacity: 0.5 }} />
            <h3 style={{ fontSize: '1.1rem', fontWeight: 600, marginBottom: '0.5rem' }}>No Inspections Found</h3>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', maxWidth: '400px', margin: '0 auto 1.5rem' }}>
              {search || statusFilter !== 'ALL'
                ? 'No records match your selected query criteria. Try clearing filters.'
                : 'No statutory inspections recorded yet. Start your first Legal Metrology verification.'}
            </p>
            <Link href="/dashboard/inspections/new">
              <button className="btn btn-primary">
                <Plus size={16} /> Start First Inspection
              </button>
            </Link>
          </div>
        ) : (
          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                <thead>
                  <tr style={{ background: 'var(--bg-secondary)', borderBottom: '1px solid var(--border)' }}>
                    <th style={{ padding: '0.85rem 1.25rem', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Product / Commodity</th>
                    <th style={{ padding: '0.85rem 1rem', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Category</th>
                    <th style={{ padding: '0.85rem 1rem', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Status</th>
                    <th style={{ padding: '0.85rem 1rem', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Confidence</th>
                    <th style={{ padding: '0.85rem 1rem', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Timestamp</th>
                    <th style={{ padding: '0.85rem 1.25rem', textAlign: 'right', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((item) => {
                    const statusMeta = STATUS_MAP[item.final_status] || STATUS_MAP[item.status] || { label: item.final_status, badgeClass: 'badge-muted', icon: Clock };
                    const Icon = statusMeta.icon;
                    const dateFormatted = new Date(item.created_at).toLocaleDateString('en-IN', {
                      day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'
                    });

                    return (
                      <tr key={item.id} style={{ borderBottom: '1px solid var(--border)', transition: 'background 0.15s ease' }} className="table-row-hover">
                        <td style={{ padding: '1rem 1.25rem' }}>
                          <div style={{ fontWeight: 600, fontSize: '0.9rem', color: 'var(--text-primary)' }}>
                            {item.product_name || 'Packaged Commodity'}
                          </div>
                          <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontFamily: 'JetBrains Mono, monospace' }}>
                            ID: {item.id.slice(0, 13)}…
                          </div>
                        </td>
                        <td style={{ padding: '1rem' }}>
                          <span className="badge badge-info" style={{ fontSize: '0.72rem' }}>
                            <Tag size={12} style={{ marginRight: '0.25rem' }} />
                            {item.category?.name_en || 'Packaged Food'}
                          </span>
                        </td>
                        <td style={{ padding: '1rem' }}>
                          <span className={`badge ${statusMeta.badgeClass}`} style={{ fontSize: '0.72rem', display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
                            <Icon size={12} />
                            {statusMeta.label}
                          </span>
                        </td>
                        <td style={{ padding: '1rem' }}>
                          {item.confidence_score !== null ? (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', width: '100px' }}>
                              <div style={{ flex: 1, height: '6px', background: 'var(--bg-secondary)', borderRadius: '3px', overflow: 'hidden' }}>
                                <div
                                  style={{
                                    height: '100%',
                                    width: `${Math.round((item.confidence_score || 0) * 100)}%`,
                                    background: (item.confidence_score || 0) > 0.8 ? 'var(--success)' : 'var(--warning)',
                                    borderRadius: '3px'
                                  }}
                                />
                              </div>
                              <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontFamily: 'monospace' }}>
                                {Math.round((item.confidence_score || 0) * 100)}%
                              </span>
                            </div>
                          ) : (
                            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>—</span>
                          )}
                        </td>
                        <td style={{ padding: '1rem', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                            <Calendar size={13} />
                            {dateFormatted}
                          </div>
                        </td>
                        <td style={{ padding: '1rem 1.25rem', textAlign: 'right' }}>
                          <Link href={`/dashboard/inspections/${item.id}`}>
                            <button className="btn btn-ghost" style={{ padding: '0.35rem 0.75rem', fontSize: '0.8rem' }}>
                              <Eye size={14} /> View
                            </button>
                          </Link>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
