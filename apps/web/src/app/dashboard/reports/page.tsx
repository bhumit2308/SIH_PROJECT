'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useAuth, apiRequest } from '@/lib/auth';
import {
  FileText, Download, AlertTriangle, CheckCircle2, Clock,
  RefreshCw, Search, Filter, ExternalLink, Eye,
  Shield, AlertCircle, TrendingDown, Archive, Calendar,
  ChevronLeft, ChevronRight
} from 'lucide-react';

interface ReportItem {
  id: string;
  inspection_id: string;
  notice_ref: string | null;
  product_name: string | null;
  category_name: string | null;
  final_status: string | null;
  violation_count: number;
  warning_count: number;
  extracted_field_count: number;
  download_count: number;
  file_size_bytes: number | null;
  created_at: string;
  generated_by_name: string | null;
  generated_by_email: string | null;
}

interface ReportsResponse {
  total: number;
  limit: number;
  offset: number;
  reports: ReportItem[];
}

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; icon: any }> = {
  COMPLIANT:       { label: 'Compliant',      color: '#4ade80', bg: 'rgba(22,163,74,0.12)',  icon: CheckCircle2 },
  NON_COMPLIANT:   { label: 'Non-Compliant',  color: '#f87171', bg: 'rgba(220,38,38,0.12)', icon: AlertCircle },
  REVIEW_REQUIRED: { label: 'Review Reqd.',   color: '#fbbf24', bg: 'rgba(217,119,6,0.12)', icon: AlertTriangle },
  PENDING:         { label: 'Pending',         color: '#94a3b8', bg: 'rgba(148,163,184,0.1)', icon: Clock },
};

function formatBytes(bytes: number | null) {
  if (!bytes) return '—';
  if (bytes < 1024) return `${bytes} B`;
  return `${(bytes / 1024).toFixed(1)} KB`;
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

export default function ReportsLibraryPage() {
  const { token, user } = useAuth();
  const [reports, setReports] = useState<ReportItem[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [page, setPage] = useState(0);
  const [downloading, setDownloading] = useState<string | null>(null);
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);
  const PAGE_SIZE = 20;

  const showToast = (msg: string, ok = true) => {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 5000);
  };

  const fetchReports = async (reset = false) => {
    if (!token) return;
    setLoading(true);
    try {
      const off = reset ? 0 : page * PAGE_SIZE;
      const params = new URLSearchParams({ limit: String(PAGE_SIZE), offset: String(off) });
      if (filterStatus) params.set('final_status', filterStatus);
      const data = await apiRequest<ReportsResponse>(`/api/v1/reports?${params}`, { token });
      setReports(data.reports);
      setTotal(data.total);
    } catch (e: any) {
      showToast(e?.message || 'Failed to load reports.', false);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchReports(true); setPage(0); }, [token, filterStatus]);
  useEffect(() => { if (page > 0) fetchReports(); }, [page]);

  const handleDownload = async (report: ReportItem) => {
    if (!token) return;
    setDownloading(report.id);
    try {
      const res = await apiRequest<{ download_url: string; notice_ref: string }>(
        `/api/v1/reports/${report.id}/download`, { token }
      );
      if (res.download_url) {
        window.open(res.download_url, '_blank', 'noopener');
        showToast(`${res.notice_ref || 'Report'} opened — downloading…`);
        // Refresh to update download count
        setTimeout(() => fetchReports(), 1000);
      } else {
        showToast('Download URL unavailable.', false);
      }
    } catch (e: any) {
      showToast(e?.message || 'Download failed.', false);
    } finally {
      setDownloading(null);
    }
  };

  const filtered = search
    ? reports.filter(r =>
        (r.product_name || '').toLowerCase().includes(search.toLowerCase()) ||
        (r.notice_ref || '').toLowerCase().includes(search.toLowerCase()) ||
        (r.category_name || '').toLowerCase().includes(search.toLowerCase())
      )
    : reports;

  // ── Stats ──
  const totalViolations  = reports.reduce((s, r) => s + r.violation_count, 0);
  const totalDownloads   = reports.reduce((s, r) => s + r.download_count, 0);
  const compliantCount   = reports.filter(r => r.final_status === 'COMPLIANT').length;
  const nonCompliant     = reports.filter(r => r.final_status === 'NON_COMPLIANT').length;

  return (
    <>
      {/* ── Toast ── */}
      {toast && (
        <div style={{
          position: 'fixed', top: '1.5rem', right: '1.5rem', zIndex: 9999,
          padding: '0.75rem 1.25rem', borderRadius: '10px',
          background: toast.ok ? 'rgba(22,163,74,0.15)' : 'rgba(220,38,38,0.15)',
          border: `1px solid ${toast.ok ? 'rgba(22,163,74,0.4)' : 'rgba(220,38,38,0.4)'}`,
          color: toast.ok ? '#4ade80' : '#f87171',
          fontSize: '0.83rem', fontWeight: 500,
          backdropFilter: 'blur(12px)',
          boxShadow: '0 4px 20px rgba(0,0,0,0.3)',
          display: 'flex', alignItems: 'center', gap: '0.5rem',
          maxWidth: '360px',
          animation: 'slideIn 0.2s ease',
        }}>
          {toast.ok ? <CheckCircle2 size={15} /> : <AlertCircle size={15} />}
          {toast.msg}
        </div>
      )}

      {/* ── Header ── */}
      <div className="page-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.2rem' }}>
            <Archive size={22} color="var(--accent)" />
            <h1 style={{ fontSize: '1.3rem', fontWeight: 700 }}>Reports Library</h1>
          </div>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.78rem' }}>
            All statutory inspection certificates generated by your account · {total} total
          </p>
        </div>
        <button className="btn btn-ghost" onClick={() => fetchReports(true)} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}>
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> Refresh
        </button>
      </div>

      <div className="page-body animate-fade">
        {/* ── Stats Cards ── */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1rem', marginBottom: '1.5rem' }}>
          {[
            { label: 'Total Reports', value: total, color: 'var(--accent)', icon: FileText },
            { label: 'Total Downloads', value: totalDownloads, color: '#818cf8', icon: Download },
            { label: 'Compliant', value: compliantCount, color: '#4ade80', icon: CheckCircle2 },
            { label: 'Non-Compliant', value: nonCompliant, color: '#f87171', icon: TrendingDown },
          ].map(({ label, value, color, icon: Icon }) => (
            <div key={label} className="card" style={{ padding: '1.25rem', display: 'flex', alignItems: 'center', gap: '1rem' }}>
              <div style={{
                width: '44px', height: '44px', borderRadius: '12px',
                background: `color-mix(in srgb, ${color} 15%, transparent)`,
                border: `1px solid color-mix(in srgb, ${color} 30%, transparent)`,
                display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
              }}>
                <Icon size={20} color={color} />
              </div>
              <div>
                <div style={{ fontSize: '1.6rem', fontWeight: 800, lineHeight: 1, color }}>{value}</div>
                <div style={{ fontSize: '0.73rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>{label}</div>
              </div>
            </div>
          ))}
        </div>

        {/* ── Filter Bar ── */}
        <div className="card" style={{ padding: '1rem 1.25rem', marginBottom: '1.25rem', display: 'flex', gap: '1rem', alignItems: 'center', flexWrap: 'wrap' }}>
          {/* Search */}
          <div style={{ position: 'relative', flex: '1', minWidth: '220px' }}>
            <Search size={14} style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
            <input
              type="text"
              placeholder="Search by product, notice ref, category…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              style={{
                width: '100%', padding: '0.5rem 0.75rem 0.5rem 2.2rem',
                background: 'var(--surface-2)', border: '1px solid var(--border)',
                borderRadius: '8px', color: 'var(--text-primary)', fontSize: '0.83rem',
                outline: 'none',
              }}
            />
          </div>

          {/* Status Filter */}
          <div style={{ display: 'flex', gap: '0.4rem' }}>
            {['', 'COMPLIANT', 'NON_COMPLIANT', 'REVIEW_REQUIRED'].map(s => (
              <button
                key={s}
                onClick={() => setFilterStatus(s)}
                className={`btn ${filterStatus === s ? 'btn-primary' : 'btn-ghost'}`}
                style={{ fontSize: '0.75rem', padding: '0.35rem 0.75rem' }}
              >
                {s === '' ? 'All' : STATUS_CONFIG[s]?.label ?? s}
              </button>
            ))}
          </div>
        </div>

        {/* ── Reports Table ── */}
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          {loading ? (
            <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
              <RefreshCw size={28} className="animate-spin" style={{ margin: '0 auto 0.75rem', display: 'block', color: 'var(--accent)' }} />
              <p style={{ fontSize: '0.85rem' }}>Loading reports…</p>
            </div>
          ) : filtered.length === 0 ? (
            <div style={{ padding: '3.5rem', textAlign: 'center', color: 'var(--text-muted)' }}>
              <Archive size={40} style={{ margin: '0 auto 1rem', display: 'block', opacity: 0.3 }} />
              <p style={{ fontWeight: 600, marginBottom: '0.4rem' }}>No reports yet</p>
              <p style={{ fontSize: '0.8rem' }}>Generate your first report from an inspection page.</p>
              <Link href="/dashboard/inspections">
                <button className="btn btn-primary" style={{ marginTop: '1rem', fontSize: '0.82rem' }}>
                  Go to Inspections
                </button>
              </Link>
            </div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
              <thead>
                <tr style={{ background: 'var(--surface-2)', borderBottom: '1px solid var(--border)' }}>
                  {['Notice Ref', 'Product / Category', 'Status', 'Violations', 'Downloads', 'Size', 'Generated', 'Actions'].map(h => (
                    <th key={h} style={{ padding: '0.75rem 1rem', textAlign: 'left', fontWeight: 600, color: 'var(--text-muted)', fontSize: '0.73rem', textTransform: 'uppercase', letterSpacing: '0.05em', whiteSpace: 'nowrap' }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((report, i) => {
                  const cfg = STATUS_CONFIG[report.final_status ?? ''] ?? STATUS_CONFIG['PENDING'];
                  const Icon = cfg.icon;
                  return (
                    <tr key={report.id} style={{
                      borderBottom: '1px solid var(--border)',
                      background: i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.01)',
                      transition: 'background 0.15s',
                    }}
                      onMouseEnter={e => (e.currentTarget.style.background = 'rgba(99,102,241,0.05)')}
                      onMouseLeave={e => (e.currentTarget.style.background = i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.01)')}
                    >
                      {/* Notice Ref */}
                      <td style={{ padding: '0.85rem 1rem' }}>
                        <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.75rem', color: 'var(--accent)', fontWeight: 600 }}>
                          {report.notice_ref || `RPT-${report.id.slice(0, 8).toUpperCase()}`}
                        </div>
                        <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', marginTop: '0.15rem' }}>
                          {report.id.slice(0, 8).toUpperCase()}
                        </div>
                      </td>

                      {/* Product / Category */}
                      <td style={{ padding: '0.85rem 1rem', maxWidth: '200px' }}>
                        <div style={{ fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '180px' }}>
                          {report.product_name || '—'}
                        </div>
                        <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '0.1rem' }}>
                          {report.category_name || '—'}
                        </div>
                      </td>

                      {/* Status Badge */}
                      <td style={{ padding: '0.85rem 1rem' }}>
                        <span style={{
                          display: 'inline-flex', alignItems: 'center', gap: '0.3rem',
                          padding: '0.25rem 0.6rem', borderRadius: '6px', fontSize: '0.72rem', fontWeight: 600,
                          background: cfg.bg, color: cfg.color,
                        }}>
                          <Icon size={11} /> {cfg.label}
                        </span>
                      </td>

                      {/* Violations */}
                      <td style={{ padding: '0.85rem 1rem' }}>
                        <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
                          {report.violation_count > 0 && (
                            <span style={{ color: '#f87171', fontWeight: 700 }}>
                              {report.violation_count} ✗
                            </span>
                          )}
                          {report.warning_count > 0 && (
                            <span style={{ color: '#fbbf24', fontWeight: 600, fontSize: '0.75rem' }}>
                              {report.warning_count} ⚠
                            </span>
                          )}
                          {report.violation_count === 0 && report.warning_count === 0 && (
                            <span style={{ color: '#4ade80' }}>✓ Clear</span>
                          )}
                        </div>
                      </td>

                      {/* Download Count */}
                      <td style={{ padding: '0.85rem 1rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', color: report.download_count > 0 ? 'var(--text-primary)' : 'var(--text-muted)' }}>
                          <Download size={12} />
                          <span style={{ fontWeight: report.download_count > 0 ? 600 : 400 }}>
                            {report.download_count}
                          </span>
                        </div>
                      </td>

                      {/* File Size */}
                      <td style={{ padding: '0.85rem 1rem', color: 'var(--text-muted)', fontFamily: 'JetBrains Mono, monospace', fontSize: '0.75rem' }}>
                        {formatBytes(report.file_size_bytes)}
                      </td>

                      {/* Date */}
                      <td style={{ padding: '0.85rem 1rem', whiteSpace: 'nowrap', color: 'var(--text-secondary)', fontSize: '0.75rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                          <Calendar size={11} />
                          {formatDate(report.created_at)}
                        </div>
                        {report.generated_by_name && (
                          <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', marginTop: '0.1rem' }}>
                            by {report.generated_by_name}
                          </div>
                        )}
                      </td>

                      {/* Actions */}
                      <td style={{ padding: '0.85rem 1rem' }}>
                        <div style={{ display: 'flex', gap: '0.4rem' }}>
                          <button
                            onClick={() => handleDownload(report)}
                            disabled={downloading === report.id}
                            className="btn btn-primary"
                            style={{ padding: '0.35rem 0.7rem', fontSize: '0.75rem', display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}
                            title="Download statutory notice PDF"
                          >
                            {downloading === report.id
                              ? <RefreshCw size={12} className="animate-spin" />
                              : <Download size={12} />
                            }
                            {downloading === report.id ? '…' : 'PDF'}
                          </button>
                          <Link href={`/dashboard/inspections/${report.inspection_id}`}>
                            <button
                              className="btn btn-ghost"
                              style={{ padding: '0.35rem 0.7rem', fontSize: '0.75rem', display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}
                              title="View source inspection"
                            >
                              <Eye size={12} /> Case
                            </button>
                          </Link>
                          <Link href={`/verify/${encodeURIComponent(report.notice_ref || report.inspection_id)}`} target="_blank" rel="noopener noreferrer">
                            <button
                              className="btn btn-ghost"
                              style={{ padding: '0.35rem 0.65rem', fontSize: '0.75rem', display: 'inline-flex', alignItems: 'center', gap: '0.3rem', color: '#818cf8', borderColor: 'rgba(99,102,241,0.3)' }}
                              title="Open public verification portal"
                            >
                              <ExternalLink size={12} /> Verify
                            </button>
                          </Link>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}

          {/* ── Pagination ── */}
          {!loading && total > PAGE_SIZE && (
            <div style={{
              padding: '0.75rem 1.25rem',
              borderTop: '1px solid var(--border)',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              fontSize: '0.8rem', color: 'var(--text-muted)',
            }}>
              <span>Showing {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, total)} of {total}</span>
              <div style={{ display: 'flex', gap: '0.4rem' }}>
                <button
                  className="btn btn-ghost"
                  onClick={() => setPage(p => Math.max(0, p - 1))}
                  disabled={page === 0}
                  style={{ padding: '0.3rem 0.6rem', fontSize: '0.75rem' }}
                >
                  <ChevronLeft size={14} />
                </button>
                <span style={{ padding: '0.3rem 0.6rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                  {page + 1} / {Math.ceil(total / PAGE_SIZE)}
                </span>
                <button
                  className="btn btn-ghost"
                  onClick={() => setPage(p => p + 1)}
                  disabled={(page + 1) * PAGE_SIZE >= total}
                  style={{ padding: '0.3rem 0.6rem', fontSize: '0.75rem' }}
                >
                  <ChevronRight size={14} />
                </button>
              </div>
            </div>
          )}
        </div>

        {/* ── Info footer ── */}
        <div style={{ marginTop: '1.25rem', padding: '1rem 1.25rem', borderRadius: '10px', background: 'rgba(99,102,241,0.06)', border: '1px solid rgba(99,102,241,0.2)', fontSize: '0.78rem', color: 'var(--text-muted)', display: 'flex', gap: '1.5rem', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <Shield size={13} color="var(--accent)" />
            <span>PDFs stored securely in <strong>Supabase metra-reports</strong> bucket — never on your device</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <Download size={13} color="var(--accent)" />
            <span>Download links are signed and expire after 1 hour for security</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <FileText size={13} color="var(--accent)" />
            <span>Each download is logged with timestamp, user ID, and IP address</span>
          </div>
        </div>
      </div>
    </>
  );
}
