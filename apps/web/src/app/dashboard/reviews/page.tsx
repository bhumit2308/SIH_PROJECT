'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth, apiRequest } from '@/lib/auth';
import {
  CircleCheck, Clock, AlertTriangle, ArrowRight,
  Search, Filter, Eye, Shield, RefreshCw, ShieldAlert,
  MapPin, CheckCircle2, UserCheck, ExternalLink, ArrowUpRight
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

interface GrievanceItem {
  id: string;
  ticket_no: string;
  violation_type: string;
  product_name: string;
  store_name: string | null;
  store_location: string | null;
  description: string | null;
  status: string;
  evidence_url: string | null;
  inspection_id: string | null;
  citizen_name: string | null;
  citizen_contact: string | null;
  resolution_notes: string | null;
  created_at: string;
}

export default function ReviewQueuePage() {
  const router = useRouter();
  const { token } = useAuth();
  const [activeTab, setActiveTab] = useState<'AI_QUEUE' | 'CITIZEN_LEADS'>('AI_QUEUE');

  // AI Review items
  const [items, setItems] = useState<ReviewItem[]>([]);
  const [loadingAi, setLoadingAi] = useState(true);

  // Citizen Grievance items
  const [grievances, setGrievances] = useState<GrievanceItem[]>([]);
  const [grievanceSummary, setGrievanceSummary] = useState<any>(null);
  const [loadingGrv, setLoadingGrv] = useState(true);
  const [convertingId, setConvertingId] = useState<string | null>(null);

  const fetchAiQueue = async () => {
    if (!token) return;
    setLoadingAi(true);
    try {
      const data = await apiRequest<ReviewItem[]>('/api/v1/inspections?status=REVIEW_REQUIRED', { token });
      setItems(data || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingAi(false);
    }
  };

  const fetchGrievances = async () => {
    if (!token) return;
    setLoadingGrv(true);
    try {
      const data = await apiRequest<{ items: GrievanceItem[]; summary: any }>('/api/v1/grievances', { token });
      setGrievances(data.items || []);
      setGrievanceSummary(data.summary);
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingGrv(false);
    }
  };

  const handleConvertLead = async (grievanceId: string) => {
    if (!token) return;
    setConvertingId(grievanceId);
    try {
      const res = await apiRequest<any>(`/api/v1/grievances/${grievanceId}/convert`, {
        method: 'POST',
        token,
      });
      if (res.inspection_id) {
        router.push(`/dashboard/inspections/${res.inspection_id}`);
      } else {
        await fetchGrievances();
      }
    } catch (e: any) {
      alert(`Error converting grievance: ${e.message || e}`);
    } finally {
      setConvertingId(null);
    }
  };

  useEffect(() => {
    fetchAiQueue();
    fetchGrievances();
  }, [token]);

  const refreshCurrent = () => {
    if (activeTab === 'AI_QUEUE') fetchAiQueue();
    else fetchGrievances();
  };

  return (
    <>
      <div className="page-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <h1 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '0.2rem' }}>
            Officer Triage &amp; Human-in-the-Loop Queue
          </h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.825rem' }}>
            Certify borderline AI extractions and convert citizen whistleblower complaints into field inspections
          </p>
        </div>
        <button className="btn btn-ghost" onClick={refreshCurrent} title="Refresh">
          <RefreshCw size={15} className={loadingAi || loadingGrv ? 'animate-spin' : ''} />
        </button>
      </div>

      <div className="page-body animate-fade">
        {/* Tab Switcher */}
        <div style={{
          display: 'flex',
          gap: '0.5rem',
          borderBottom: '1px solid var(--border)',
          marginBottom: '1.5rem',
        }}>
          <button
            onClick={() => setActiveTab('AI_QUEUE')}
            style={{
              padding: '0.75rem 1.25rem',
              fontSize: '0.85rem',
              fontWeight: 600,
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              color: activeTab === 'AI_QUEUE' ? 'var(--accent)' : 'var(--text-muted)',
              borderBottom: activeTab === 'AI_QUEUE' ? '2px solid var(--accent)' : '2px solid transparent',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
            }}
          >
            <Shield size={16} />
            AI Confidence Verification Queue
            <span className="badge badge-info" style={{ fontSize: '0.7rem', padding: '0.15rem 0.45rem' }}>
              {items.length}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('CITIZEN_LEADS')}
            style={{
              padding: '0.75rem 1.25rem',
              fontSize: '0.85rem',
              fontWeight: 600,
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              color: activeTab === 'CITIZEN_LEADS' ? '#ef4444' : 'var(--text-muted)',
              borderBottom: activeTab === 'CITIZEN_LEADS' ? '2px solid #ef4444' : '2px solid transparent',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
            }}
          >
            <ShieldAlert size={16} color={activeTab === 'CITIZEN_LEADS' ? '#ef4444' : 'currentColor'} />
            Citizen Whistleblower Leads
            <span className="badge" style={{
              fontSize: '0.7rem',
              padding: '0.15rem 0.45rem',
              background: 'rgba(239, 68, 68, 0.15)',
              color: '#ef4444',
            }}>
              {grievances.filter(g => g.status === 'RECEIVED').length} Unassigned
            </span>
          </button>
        </div>

        {/* TAB 1: AI Verification Queue */}
        {activeTab === 'AI_QUEUE' && (
          <>
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

            {loadingAi ? (
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
          </>
        )}

        {/* TAB 2: Citizen Whistleblower Leads */}
        {activeTab === 'CITIZEN_LEADS' && (
          <>
            <div className="card" style={{ marginBottom: '1.5rem', background: 'rgba(239, 68, 68, 0.04)', border: '1px solid rgba(239, 68, 68, 0.2)' }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem' }}>
                <ShieldAlert size={20} color="#ef4444" style={{ flexShrink: 0, marginTop: '2px' }} />
                <div>
                  <div style={{ fontSize: '0.875rem', fontWeight: 600, color: '#ef4444' }}>
                    National Whistleblower Enforcement Intake
                  </div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '0.2rem', lineHeight: 1.4 }}>
                    Complaints submitted by citizens via <code>/report-violation</code>. Officers can review submitted photo evidence and convert valid leads directly into field inspections with 1 click.
                  </div>
                </div>
              </div>
            </div>

            {loadingGrv ? (
              <div className="card" style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                <RefreshCw size={28} className="animate-spin" style={{ margin: '0 auto 1rem', display: 'block', color: 'var(--accent)' }} />
                <p>Loading citizen grievance leads…</p>
              </div>
            ) : grievances.length === 0 ? (
              <div className="card" style={{ padding: '3.5rem 2rem', textAlign: 'center' }}>
                <CheckCircle2 size={40} color="var(--success)" style={{ margin: '0 auto 1rem', display: 'block' }} />
                <h3 style={{ fontSize: '1.1rem', fontWeight: 600, marginBottom: '0.5rem' }}>No Pending Citizen Leads</h3>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', maxWidth: '400px', margin: '0 auto' }}>
                  All lodged citizen violation reports have been addressed or converted into active cases.
                </p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                {grievances.map((grv) => (
                  <div key={grv.id} className="card" style={{
                    padding: '1.25rem 1.5rem',
                    background: 'var(--bg-card)',
                    border: '1px solid var(--border)',
                    borderRadius: '10px',
                  }}>
                    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.75rem', marginBottom: '0.75rem' }}>
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <span style={{ fontWeight: 800, fontSize: '0.95rem', color: 'var(--text-primary)' }}>
                            {grv.product_name}
                          </span>
                          <span className="badge" style={{
                            fontSize: '0.72rem',
                            background: grv.status === 'RECEIVED' ? 'rgba(239, 68, 68, 0.1)' : 'rgba(37, 99, 235, 0.1)',
                            color: grv.status === 'RECEIVED' ? '#ef4444' : 'var(--accent)',
                            border: grv.status === 'RECEIVED' ? '1px solid rgba(239, 68, 68, 0.3)' : '1px solid rgba(37, 99, 235, 0.3)',
                          }}>
                            {grv.status.replace(/_/g, ' ')}
                          </span>
                        </div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontFamily: 'monospace', marginTop: '0.2rem' }}>
                          Ticket: {grv.ticket_no} • {new Date(grv.created_at).toLocaleDateString('en-IN', {
                            day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'
                          })}
                        </div>
                      </div>

                      {/* Convert Action */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        {grv.inspection_id ? (
                          <Link href={`/dashboard/inspections/${grv.inspection_id}`}>
                            <button className="btn btn-secondary" style={{ padding: '0.4rem 0.85rem', fontSize: '0.78rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                              Open Inspection #{grv.inspection_id.slice(0, 8)} <ArrowUpRight size={14} />
                            </button>
                          </Link>
                        ) : (
                          <button
                            onClick={() => handleConvertLead(grv.id)}
                            disabled={convertingId === grv.id}
                            className="btn btn-primary"
                            style={{
                              padding: '0.4rem 0.85rem',
                              fontSize: '0.78rem',
                              background: '#ef4444',
                              borderColor: '#ef4444',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '0.35rem',
                            }}
                          >
                            <ShieldAlert size={14} />
                            {convertingId === grv.id ? 'Dispatching…' : '1-Click Dispatch Field Inspection'}
                          </button>
                        )}
                        <Link href={`/report-violation/${grv.ticket_no}`} target="_blank">
                          <button className="btn btn-ghost" style={{ padding: '0.4rem 0.6rem', fontSize: '0.78rem' }} title="View Public Citizen Portal">
                            <ExternalLink size={14} />
                          </button>
                        </Link>
                      </div>
                    </div>

                    {/* Details Grid */}
                    <div style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
                      gap: '0.75rem',
                      background: 'var(--bg-secondary)',
                      padding: '0.85rem',
                      borderRadius: '6px',
                      fontSize: '0.8rem',
                      marginBottom: '0.75rem',
                    }}>
                      <div>
                        <span style={{ color: 'var(--text-muted)' }}>Violation Type:</span>{' '}
                        <strong style={{ color: '#ef4444' }}>{grv.violation_type.replace(/_/g, ' ')}</strong>
                      </div>
                      <div>
                        <span style={{ color: 'var(--text-muted)' }}>Retailer / Store:</span>{' '}
                        <strong>{grv.store_name || 'N/A'}</strong>
                      </div>
                      <div>
                        <span style={{ color: 'var(--text-muted)' }}>Premise Location:</span>{' '}
                        <strong>{grv.store_location || 'N/A'}</strong>
                      </div>
                      {grv.citizen_name && (
                        <div>
                          <span style={{ color: 'var(--text-muted)' }}>Informant:</span>{' '}
                          <strong>{grv.citizen_name} ({grv.citizen_contact || 'No contact'})</strong>
                        </div>
                      )}
                    </div>

                    {/* Description */}
                    {grv.description && (
                      <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', lineHeight: 1.4 }}>
                        <strong>Reported Incident:</strong> {grv.description}
                      </div>
                    )}

                    {/* Resolution Note if present */}
                    {grv.resolution_notes && (
                      <div style={{ marginTop: '0.5rem', fontSize: '0.78rem', color: 'var(--accent)' }}>
                        <strong>Action Log:</strong> {grv.resolution_notes}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </>
  );
}
