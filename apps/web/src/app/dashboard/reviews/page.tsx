'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useAuth, apiRequest } from '@/lib/auth';
import {
  CircleCheck, Clock, AlertTriangle, ArrowRight,
  Search, Filter, Eye, Shield, RefreshCw
} from 'lucide-react';

interface ReviewItem {
  id: string;
  category_id: string;
  category?: { code: string; name_en: string };
  product_name: string | null;
  status: string;
  final_status: string;
  confidence_score: number | null;
  created_at: string;
}

export default function ReviewQueuePage() {
  const { token } = useAuth();
  const [items, setItems] = useState<ReviewItem[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchQueue = async () => {
    if (!token) return;
    setLoading(true);
    try {
      const data = await apiRequest<ReviewItem[]>('/api/v1/inspections?status=REVIEW_REQUIRED', { token });
      setItems(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchQueue();
  }, [token]);

  return (
    <>
      <div className="page-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <h1 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '0.2rem' }}>
            Officer Review &amp; Triage Queue
          </h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.825rem' }}>
            Human-in-the-loop statutory verification for flagged declarations and borderline confidence cases
          </p>
        </div>
        <button className="btn btn-ghost" onClick={fetchQueue} title="Refresh">
          <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
        </button>
      </div>

      <div className="page-body animate-fade">
        <div className="card" style={{ marginBottom: '1.5rem', background: 'rgba(234, 179, 8, 0.05)', border: '1px solid rgba(234, 179, 8, 0.25)' }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem' }}>
            <Shield size={20} color="var(--warning)" style={{ flexShrink: 0, marginTop: '2px' }} />
            <div>
              <div style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--warning)' }}>
                Statutory Accountability Notice
              </div>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '0.2rem', lineHeight: 1.4 }}>
                Under the Legal Metrology Act, 2009, AI findings serve exclusively as decision support. Final determinations require explicit certification by an authorized enforcement officer or supervisor.
              </div>
            </div>
          </div>
        </div>

        {loading ? (
          <div className="card" style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
            <RefreshCw size={28} className="animate-spin" style={{ margin: '0 auto 1rem', display: 'block', color: 'var(--accent)' }} />
            <p>Loading pending review tasks…</p>
          </div>
        ) : items.length === 0 ? (
          <div className="card" style={{ padding: '3.5rem 2rem', textAlign: 'center' }}>
            <CircleCheck size={40} color="var(--success)" style={{ margin: '0 auto 1rem', display: 'block' }} />
            <h3 style={{ fontSize: '1.1rem', fontWeight: 600, marginBottom: '0.5rem' }}>Review Queue is Clear</h3>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', maxWidth: '400px', margin: '0 auto' }}>
              All flagged packages and borderline confidence extractions have been certified.
            </p>
          </div>
        ) : (
          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
              <thead>
                <tr style={{ background: 'var(--bg-secondary)', borderBottom: '1px solid var(--border)' }}>
                  <th style={{ padding: '0.85rem 1.25rem', fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Commodity / Case ID</th>
                  <th style={{ padding: '0.85rem 1rem', fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Classification</th>
                  <th style={{ padding: '0.85rem 1rem', fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Flag Reason</th>
                  <th style={{ padding: '0.85rem 1rem', fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Submitted</th>
                  <th style={{ padding: '0.85rem 1.25rem', textAlign: 'right', fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr key={item.id} style={{ borderBottom: '1px solid var(--border)' }}>
                    <td style={{ padding: '1rem 1.25rem' }}>
                      <div style={{ fontWeight: 600, fontSize: '0.875rem' }}>
                        {item.product_name || 'Packaged Commodity'}
                      </div>
                      <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontFamily: 'monospace' }}>
                        {item.id}
                      </div>
                    </td>
                    <td style={{ padding: '1rem' }}>
                      <span className="badge badge-info" style={{ fontSize: '0.72rem' }}>
                        {item.category?.name_en || 'Packaged Food'}
                      </span>
                    </td>
                    <td style={{ padding: '1rem' }}>
                      <span className="badge badge-warning" style={{ fontSize: '0.72rem', display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
                        <Clock size={12} /> Borderline AI Confidence / Flagged Rule
                      </span>
                    </td>
                    <td style={{ padding: '1rem', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                      {new Date(item.created_at).toLocaleDateString('en-IN', {
                        day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit'
                      })}
                    </td>
                    <td style={{ padding: '1rem 1.25rem', textAlign: 'right' }}>
                      <Link href={`/dashboard/inspections/${item.id}`}>
                        <button className="btn btn-primary" style={{ padding: '0.35rem 0.85rem', fontSize: '0.8rem' }}>
                          <Eye size={14} /> Review &amp; Decide
                        </button>
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}
