'use client';
import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  Scale, ShieldAlert, CheckCircle2, AlertTriangle, ArrowLeft,
  Clock, MapPin, Store, FileText, Check, Copy, ExternalLink, ShieldCheck
} from 'lucide-react';

interface TimelineStep {
  step: string;
  label: string;
  completed: boolean;
  timestamp: string | null;
  detail: string;
}

interface GrievanceData {
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
  resolution_notes: string | null;
  created_at: string | null;
  updated_at: string | null;
}

export default function GrievanceTrackingPage() {
  const params = useParams();
  const router = useRouter();
  const ticketParam = Array.isArray(params?.ticket) ? params.ticket[0] : (params?.ticket as string);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [grievance, setGrievance] = useState<GrievanceData | null>(null);
  const [timeline, setTimeline] = useState<TimelineStep[]>([]);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!ticketParam) return;
    const fetchStatus = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'}/api/v1/grievances/${encodeURIComponent(ticketParam)}`);
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err.detail?.message || err.detail || 'Ticket not found in the legal metrology registry.');
        }
        const data = await res.json();
        setGrievance(data.grievance);
        setTimeline(data.timeline || []);
      } catch (err: any) {
        setError(err.message || 'Unable to retrieve grievance record.');
      } finally {
        setLoading(false);
      }
    };
    fetchStatus();
  }, [ticketParam]);

  const copyTicket = () => {
    if (grievance?.ticket_no) {
      navigator.clipboard.writeText(grievance.ticket_no);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'RECEIVED':
        return { label: 'Grievance Queued', color: '#2563eb', bg: 'rgba(37, 99, 235, 0.1)' };
      case 'UNDER_FIELD_INSPECTION':
        return { label: 'Field Investigation Active', color: '#d97706', bg: 'rgba(217, 119, 6, 0.1)' };
      case 'RESOLVED_WITH_PENALTY':
        return { label: 'Resolved (Compounded / Penalized)', color: '#16a34a', bg: 'rgba(22, 163, 74, 0.1)' };
      case 'DISMISSED':
        return { label: 'Closed / Inconclusive', color: '#6b7280', bg: 'rgba(107, 114, 128, 0.1)' };
      default:
        return { label: status, color: '#2563eb', bg: 'rgba(37, 99, 235, 0.1)' };
    }
  };

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-primary)', color: 'var(--text-primary)', paddingBottom: '4rem' }}>
      {/* Header */}
      <header style={{
        background: 'var(--bg-card)',
        borderBottom: '1px solid var(--border)',
        padding: '1rem 1.5rem',
      }}>
        <div style={{ maxWidth: '950px', margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Link href="/report-violation" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', textDecoration: 'none', color: 'inherit', fontSize: '0.85rem', fontWeight: 600 }}>
            <ArrowLeft size={16} /> Back to Grievance Portal
          </Link>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
            Statutory Public Record • Dept. of Legal Metrology
          </div>
        </div>
      </header>

      <div style={{ maxWidth: '850px', margin: '2.5rem auto 0', padding: '0 1.5rem' }}>
        {loading ? (
          <div className="card" style={{ padding: '4rem 2rem', textAlign: 'center' }}>
            <Clock size={36} className="animate-spin" style={{ margin: '0 auto 1rem', color: 'var(--accent)' }} />
            <div style={{ fontSize: '1rem', fontWeight: 600 }}>Querying National Grievance Registry…</div>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '0.35rem' }}>
              Looking up statutory ticket: {ticketParam}
            </div>
          </div>
        ) : error || !grievance ? (
          <div className="card" style={{ padding: '3rem 2rem', textAlign: 'center', border: '1px solid rgba(239, 68, 68, 0.3)' }}>
            <AlertTriangle size={42} color="#ef4444" style={{ margin: '0 auto 1rem' }} />
            <h2 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '0.5rem' }}>Ticket Not Found</h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', maxWidth: '450px', margin: '0 auto 1.5rem' }}>
              {error || 'No record matches this ticket reference in the Legal Metrology system.'}
            </p>
            <Link href="/report-violation">
              <button className="btn btn-primary">Lodge New Report</button>
            </Link>
          </div>
        ) : (
          <div className="animate-fade">
            {/* Ticket Card */}
            <div className="card" style={{
              background: 'var(--bg-card)',
              border: '1px solid var(--border)',
              borderRadius: '12px',
              padding: '1.75rem 2rem',
              marginBottom: '1.5rem',
            }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem', marginBottom: '1.5rem' }}>
                <div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    Statutory Ticket Reference
                  </div>
                  <div style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '0.03em', display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                    {grievance.ticket_no}
                    <button onClick={copyTicket} className="btn btn-ghost" style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem' }} title="Copy Reference">
                      {copied ? <Check size={14} color="var(--success)" /> : <Copy size={14} />}
                    </button>
                  </div>
                </div>

                <div>
                  {(() => {
                    const b = getStatusBadge(grievance.status);
                    return (
                      <span style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '0.4rem',
                        padding: '0.4rem 0.85rem',
                        borderRadius: '50px',
                        background: b.bg,
                        color: b.color,
                        fontWeight: 700,
                        fontSize: '0.8rem',
                        border: `1px solid ${b.color}40`,
                      }}>
                        {b.label}
                      </span>
                    );
                  })()}
                </div>
              </div>

              {/* Progress Timeline */}
              <div style={{
                background: 'var(--bg-secondary)',
                borderRadius: '8px',
                padding: '1.25rem',
                border: '1px solid var(--border)',
                marginBottom: '1.5rem',
              }}>
                <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '1rem' }}>
                  Enforcement Timeline
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                  {timeline.map((step, idx) => (
                    <div key={idx} style={{ display: 'flex', alignItems: 'flex-start', gap: '1rem' }}>
                      <div style={{
                        width: '24px',
                        height: '24px',
                        borderRadius: '50%',
                        background: step.completed ? 'var(--success)' : 'var(--border)',
                        color: '#fff',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '0.75rem',
                        flexShrink: 0,
                        marginTop: '2px',
                      }}>
                        {step.completed ? <Check size={14} /> : idx + 1}
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap' }}>
                          <div style={{ fontWeight: 600, fontSize: '0.875rem', color: step.completed ? 'var(--text-primary)' : 'var(--text-muted)' }}>
                            {step.label}
                          </div>
                          {step.timestamp && (
                            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                              {new Date(step.timestamp).toLocaleDateString('en-IN', {
                                day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'
                              })}
                            </div>
                          )}
                        </div>
                        <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '0.2rem' }}>
                          {step.detail}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Grievance Details Grid */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1rem' }}>
                <div style={{ padding: '0.75rem', background: 'var(--bg-secondary)', borderRadius: '6px', border: '1px solid var(--border)' }}>
                  <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Commodity Reported</div>
                  <div style={{ fontWeight: 600, fontSize: '0.85rem', marginTop: '0.2rem' }}>{grievance.product_name}</div>
                </div>

                <div style={{ padding: '0.75rem', background: 'var(--bg-secondary)', borderRadius: '6px', border: '1px solid var(--border)' }}>
                  <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Violation Type</div>
                  <div style={{ fontWeight: 600, fontSize: '0.85rem', marginTop: '0.2rem', color: '#ef4444' }}>
                    {grievance.violation_type.replace(/_/g, ' ')}
                  </div>
                </div>

                <div style={{ padding: '0.75rem', background: 'var(--bg-secondary)', borderRadius: '6px', border: '1px solid var(--border)' }}>
                  <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Store / Vendor</div>
                  <div style={{ fontWeight: 600, fontSize: '0.85rem', marginTop: '0.2rem' }}>
                    {grievance.store_name || 'Not Specified'}
                  </div>
                </div>

                <div style={{ padding: '0.75rem', background: 'var(--bg-secondary)', borderRadius: '6px', border: '1px solid var(--border)' }}>
                  <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Location / Premise</div>
                  <div style={{ fontWeight: 600, fontSize: '0.85rem', marginTop: '0.2rem' }}>
                    {grievance.store_location || 'Not Specified'}
                  </div>
                </div>
              </div>

              {/* Description */}
              {grievance.description && (
                <div style={{ marginTop: '1rem', padding: '0.75rem', background: 'var(--bg-secondary)', borderRadius: '6px', border: '1px solid var(--border)' }}>
                  <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Citizen Incident Report</div>
                  <div style={{ fontSize: '0.825rem', marginTop: '0.25rem', lineHeight: 1.5 }}>
                    {grievance.description}
                  </div>
                </div>
              )}

              {/* Official Action Note */}
              {grievance.resolution_notes && (
                <div style={{
                  marginTop: '1.25rem',
                  padding: '1rem',
                  borderRadius: '8px',
                  background: 'rgba(37, 99, 235, 0.05)',
                  border: '1px solid rgba(37, 99, 235, 0.25)',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.8rem', fontWeight: 700, color: 'var(--accent)', marginBottom: '0.25rem' }}>
                    <ShieldCheck size={16} /> Official Enforcement Redressal Note
                  </div>
                  <div style={{ fontSize: '0.825rem', color: 'var(--text-primary)', lineHeight: 1.5 }}>
                    {grievance.resolution_notes}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
