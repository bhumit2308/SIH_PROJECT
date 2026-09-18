'use client';
import { useState, useEffect, use } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth, apiRequest } from '@/lib/auth';
import {
  ArrowLeft, CheckCircle2, AlertTriangle, AlertCircle, Clock,
  FileText, RefreshCw, Eye, Shield, Tag, Calendar, User,
  Check, X, Edit3, ExternalLink, Download, Layers, Sparkles
} from 'lucide-react';

interface Finding {
  id: string;
  status: 'PASS' | 'WARNING' | 'VIOLATION' | 'REVIEW_REQUIRED';
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  message: string;
  field_code: string | null;
  ai_raw_value: string | null;
  human_override_value?: string | null;
}

interface ExtractedField {
  id: string;
  field_code: string;
  raw_value: string;
  normalized_value: string | null;
  confidence: number;
  source_image_id: string;
}

interface InspectionImage {
  id: string;
  view_type: string;
  storage_key: string;
  quality_status: string;
  quality_score: number | null;
  quality_issues: any[];
}

interface InspectionDetail {
  id: string;
  category_id: string;
  category?: { code: string; name_en: string };
  product_name: string | null;
  mode: string;
  status: string;
  final_status: string;
  confidence_score: number | null;
  created_at: string;
  images: InspectionImage[];
  extracted_fields: ExtractedField[];
  findings: Finding[];
}

const FIELD_LABELS: Record<string, string> = {
  product_name: 'Name & Commodity Description',
  net_quantity: 'Net Quantity / Weight / Volume',
  mrp: 'Maximum Retail Price (MRP)',
  manufacturer: 'Manufacturer / Packer Name & Address',
  date_info: 'Month & Year of Manufacture / Pre-pack',
  consumer_care: 'Consumer Care Contact Details',
  country_of_origin: 'Country of Origin (Rule 6(1)(f))',
  unit_sale_price: 'Unit Sale Price (USP)',
};

const SEVERITY_COLORS: Record<string, { bg: string; color: string; border: string }> = {
  CRITICAL: { bg: 'rgba(239, 68, 68, 0.15)', color: '#f87171', border: 'rgba(239, 68, 68, 0.3)' },
  HIGH:     { bg: 'rgba(249, 115, 22, 0.15)', color: '#fb923c', border: 'rgba(249, 115, 22, 0.3)' },
  MEDIUM:   { bg: 'rgba(234, 179, 8, 0.15)',  color: '#facc15', border: 'rgba(234, 179, 8, 0.3)' },
  LOW:      { bg: 'rgba(59, 130, 246, 0.15)',  color: '#60a5fa', border: 'rgba(59, 130, 246, 0.3)' },
};

export default function InspectionDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params);
  const inspectionId = resolvedParams.id;

  const router = useRouter();
  const { token, user } = useAuth();

  const [inspection, setInspection] = useState<InspectionDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'findings' | 'fields' | 'review'>('findings');
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);
  const [isPolling, setIsPolling] = useState(false);
  const [reviewNote, setReviewNote] = useState('');
  const [reviewSubmitting, setReviewSubmitting] = useState(false);

  const fetchDetail = async (quiet = false) => {
    if (!token) return;
    if (!quiet) setLoading(true);
    try {
      const data = await apiRequest<InspectionDetail>(`/api/v1/inspections/${inspectionId}`, { token });
      setInspection(data);

      // Poll if processing
      if (data.status === 'PROCESSING' || data.status === 'IMAGES_UPLOADED') {
        setIsPolling(true);
      } else {
        setIsPolling(false);
      }
    } catch (err) {
      console.error('Failed to fetch inspection detail:', err);
    } finally {
      if (!quiet) setLoading(false);
    }
  };

  useEffect(() => {
    fetchDetail();
  }, [inspectionId, token]);

  useEffect(() => {
    let interval: any = null;
    if (isPolling) {
      interval = setInterval(() => {
        fetchDetail(true);
      }, 3000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isPolling, inspectionId, token]);

  const handleReviewDecision = async (decision: 'ACCEPT' | 'REJECT') => {
    if (!token) return;
    setReviewSubmitting(true);
    try {
      await apiRequest(`/api/v1/inspections/${inspectionId}/finalize`, {
        token,
        method: 'POST',
        body: JSON.stringify({
          final_status: decision === 'ACCEPT' ? 'COMPLIANT' : 'NON_COMPLIANT',
          note: reviewNote.trim() || undefined,
        }),
      });
      await fetchDetail(true);
    } catch (e) {
      console.error(e);
    } finally {
      setReviewSubmitting(false);
    }
  };

  if (loading && !inspection) {
    return (
      <div style={{ minHeight: '60vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ textAlign: 'center', color: 'var(--text-muted)' }}>
          <RefreshCw size={32} className="animate-spin" style={{ margin: '0 auto 1rem', display: 'block', color: 'var(--accent)' }} />
          <p>Loading Statutory Inspection Record #{inspectionId.slice(0, 8)}…</p>
        </div>
      </div>
    );
  }

  if (!inspection) {
    return (
      <div className="page-body">
        <div className="card" style={{ textAlign: 'center', padding: '3rem' }}>
          <AlertCircle size={40} style={{ margin: '0 auto 1rem', color: 'var(--danger)' }} />
          <h3>Inspection Record Not Found</h3>
          <Link href="/dashboard/inspections">
            <button className="btn btn-primary" style={{ marginTop: '1rem' }}>
              Back to Registry
            </button>
          </Link>
        </div>
      </div>
    );
  }

  const isProcessing = inspection.status === 'PROCESSING' || inspection.status === 'IMAGES_UPLOADED';
  const selectedImage = inspection.images?.[selectedImageIndex];
  const publicImageUrl = selectedImage
    ? `https://gdlbajjqtjhuotocqeqz.supabase.co/storage/v1/object/public/metra-images/${selectedImage.storage_key}`
    : null;

  return (
    <>
      {/* Header Bar */}
      <div className="page-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <Link href="/dashboard/inspections">
            <button className="btn btn-ghost" style={{ padding: '0.4rem 0.6rem' }}>
              <ArrowLeft size={16} />
            </button>
          </Link>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.2rem' }}>
              <h1 style={{ fontSize: '1.25rem', fontWeight: 700 }}>
                {inspection.product_name || 'Packaged Commodity'}
              </h1>
              <span className={`badge ${
                inspection.final_status === 'COMPLIANT' ? 'badge-success' :
                inspection.final_status === 'NON_COMPLIANT' ? 'badge-danger' :
                inspection.final_status === 'REVIEW_REQUIRED' ? 'badge-warning' : 'badge-info'
              }`}>
                {inspection.final_status}
              </span>
              {isProcessing && (
                <span className="badge badge-info" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
                  <RefreshCw size={12} className="animate-spin" /> AI Analysis in Progress
                </span>
              )}
            </div>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.78rem', fontFamily: 'JetBrains Mono, monospace' }}>
              Case ID: {inspection.id} · Category: {inspection.category?.name_en || 'Packaged Food'} · {new Date(inspection.created_at).toLocaleString('en-IN')}
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <button
            className="btn btn-ghost"
            onClick={() => fetchDetail(false)}
            title="Refresh analysis state"
          >
            <RefreshCw size={15} className={isProcessing ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      <div className="page-body animate-fade">
        {/* Processing Banner */}
        {isProcessing && (
          <div className="card" style={{
            marginBottom: '1.5rem',
            background: 'linear-gradient(135deg, rgba(99,102,241,0.1), rgba(129,140,248,0.05))',
            border: '1px solid rgba(99,102,241,0.3)',
            display: 'flex', alignItems: 'center', gap: '1rem', padding: '1.25rem'
          }}>
            <Sparkles size={24} color="var(--accent)" className="animate-pulse" />
            <div>
              <div style={{ fontWeight: 600, fontSize: '0.9rem', color: 'var(--accent-light)' }}>
                Deterministic Legal Metrology Rule Engine &amp; Gemini Vision are processing…
              </div>
              <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginTop: '0.2rem' }}>
                Executing OCR extraction on uploaded panels, verifying mandatory declarations under PCR 2011, and cross-checking SI units and MRP syntax. Results will appear automatically.
              </div>
            </div>
          </div>
        )}

        {/* Main Split Grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(320px, 420px) 1fr', gap: '1.5rem', alignItems: 'start' }}>
          {/* Left Column: Image Package Viewer */}
          <div className="card" style={{ padding: '1.25rem', position: 'sticky', top: '1.5rem' }}>
            <h3 style={{ fontSize: '0.95rem', fontWeight: 600, marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Layers size={16} color="var(--accent)" />
              Commodity Packaging Panel
            </h3>

            {inspection.images && inspection.images.length > 0 ? (
              <div>
                {/* Main View Area */}
                <div style={{
                  width: '100%', height: '340px', borderRadius: '10px',
                  background: '#070b14', overflow: 'hidden', display: 'flex',
                  alignItems: 'center', justifyContent: 'center', border: '1px solid var(--border)',
                  marginBottom: '1rem', position: 'relative'
                }}>
                  {publicImageUrl ? (
                    <img
                      src={publicImageUrl}
                      alt={selectedImage?.view_type}
                      style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }}
                    />
                  ) : (
                    <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>Image loading…</div>
                  )}

                  <div style={{ position: 'absolute', bottom: '8px', left: '8px' }}>
                    <span className="badge badge-primary" style={{ fontSize: '0.65rem' }}>
                      {selectedImage?.view_type}
                    </span>
                  </div>
                </div>

                {/* Thumbnails */}
                <div style={{ display: 'flex', gap: '0.5rem', overflowX: 'auto', paddingBottom: '0.5rem' }}>
                  {inspection.images.map((img, idx) => (
                    <div
                      key={img.id}
                      onClick={() => setSelectedImageIndex(idx)}
                      style={{
                        width: '68px', height: '68px', borderRadius: '8px',
                        border: idx === selectedImageIndex ? '2px solid var(--accent)' : '1px solid var(--border)',
                        overflow: 'hidden', cursor: 'pointer', flexShrink: 0,
                        background: '#0a0f1e', opacity: idx === selectedImageIndex ? 1 : 0.65,
                        transition: 'all 0.15s ease'
                      }}
                    >
                      <img
                        src={`https://gdlbajjqtjhuotocqeqz.supabase.co/storage/v1/object/public/metra-images/${img.storage_key}`}
                        alt={img.view_type}
                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                      />
                    </div>
                  ))}
                </div>

                {/* Image Quality Summary */}
                {selectedImage && (
                  <div style={{ marginTop: '1rem', padding: '0.75rem', background: 'var(--bg-secondary)', borderRadius: '8px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.35rem' }}>
                      <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Image Quality Gate</span>
                      <span className={`badge ${selectedImage.quality_status === 'PASS' ? 'badge-success' : 'badge-warning'}`} style={{ fontSize: '0.65rem' }}>
                        {selectedImage.quality_status}
                      </span>
                    </div>
                    <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>
                      Storage Key: <code style={{ fontFamily: 'monospace', color: 'var(--accent-light)' }}>{selectedImage.storage_key}</code>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>
                No images attached
              </div>
            )}
          </div>

          {/* Right Column: Findings, Declarations & Verification Tabs */}
          <div>
            {/* Tabs Bar */}
            <div style={{ display: 'flex', gap: '0.5rem', borderBottom: '1px solid var(--border)', marginBottom: '1.5rem', paddingBottom: '0.25rem' }}>
              <button
                className={`btn ${activeTab === 'findings' ? 'btn-primary' : 'btn-ghost'}`}
                onClick={() => setActiveTab('findings')}
                style={{ fontSize: '0.85rem', padding: '0.5rem 1rem' }}
              >
                Statutory Rule Findings ({inspection.findings?.length || 0})
              </button>
              <button
                className={`btn ${activeTab === 'fields' ? 'btn-primary' : 'btn-ghost'}`}
                onClick={() => setActiveTab('fields')}
                style={{ fontSize: '0.85rem', padding: '0.5rem 1rem' }}
              >
                Extracted Declarations ({inspection.extracted_fields?.length || 0})
              </button>
              <button
                className={`btn ${activeTab === 'review' ? 'btn-primary' : 'btn-ghost'}`}
                onClick={() => setActiveTab('review')}
                style={{ fontSize: '0.85rem', padding: '0.5rem 1rem' }}
              >
                Officer Determination &amp; Sign-Off
              </button>
            </div>

            {/* TAB 1: Statutory Rule Findings */}
            {activeTab === 'findings' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                {inspection.findings && inspection.findings.length > 0 ? (
                  inspection.findings.map((finding) => {
                    const sev = SEVERITY_COLORS[finding.severity] || SEVERITY_COLORS.MEDIUM;
                    const isViolation = finding.status === 'VIOLATION';

                    return (
                      <div
                        key={finding.id}
                        className="card"
                        style={{
                          borderLeft: `4px solid ${isViolation ? 'var(--danger)' : sev.color}`,
                          padding: '1.25rem'
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '1rem', marginBottom: '0.5rem' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                            <span className={`badge ${
                              finding.status === 'VIOLATION' ? 'badge-danger' :
                              finding.status === 'PASS' ? 'badge-success' : 'badge-warning'
                            }`} style={{ fontSize: '0.72rem' }}>
                              {finding.status}
                            </span>
                            <span style={{
                              fontSize: '0.68rem', fontWeight: 700, padding: '0.2rem 0.5rem',
                              borderRadius: '4px', background: sev.bg, color: sev.color, border: `1px solid ${sev.border}`
                            }}>
                              {finding.severity} SEVERITY
                            </span>
                            {finding.field_code && (
                              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontFamily: 'monospace' }}>
                                [{finding.field_code}]
                              </span>
                            )}
                          </div>
                        </div>

                        <p style={{ fontSize: '0.875rem', color: 'var(--text-primary)', marginBottom: '0.75rem', lineHeight: 1.5 }}>
                          {finding.message}
                        </p>

                        {finding.ai_raw_value && (
                          <div style={{
                            padding: '0.6rem 0.85rem', background: 'var(--bg-secondary)',
                            borderRadius: '6px', fontSize: '0.78rem', color: 'var(--text-secondary)',
                            fontFamily: 'monospace', wordBreak: 'break-all'
                          }}>
                            <span style={{ color: 'var(--text-muted)' }}>Detected package text: </span>
                            &ldquo;{finding.ai_raw_value}&rdquo;
                          </div>
                        )}
                      </div>
                    );
                  })
                ) : (
                  <div className="card" style={{ textAlign: 'center', padding: '2.5rem' }}>
                    <CheckCircle2 size={36} color="var(--success)" style={{ margin: '0 auto 0.75rem' }} />
                    <h4 style={{ fontSize: '1rem', fontWeight: 600 }}>All Mandatory Declarations Verified Compliant</h4>
                    <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', marginTop: '0.25rem' }}>
                      No statutory violations detected against the Legal Metrology (Packaged Commodities) Rules 2011.
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* TAB 2: Extracted Declarations */}
            {activeTab === 'fields' && (
              <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                  <thead>
                    <tr style={{ background: 'var(--bg-secondary)', borderBottom: '1px solid var(--border)' }}>
                      <th style={{ padding: '0.85rem 1rem', fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Declaration Field</th>
                      <th style={{ padding: '0.85rem 1rem', fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Extracted Text</th>
                      <th style={{ padding: '0.85rem 1rem', fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Confidence</th>
                    </tr>
                  </thead>
                  <tbody>
                    {['product_name', 'net_quantity', 'mrp', 'manufacturer', 'date_info', 'consumer_care', 'country_of_origin', 'unit_sale_price'].map((fCode) => {
                      const ef = inspection.extracted_fields?.find(f => f.field_code === fCode);
                      const conf = ef ? Math.round(ef.confidence * 100) : 0;
                      return (
                        <tr key={fCode} style={{ borderBottom: '1px solid var(--border)' }}>
                          <td style={{ padding: '1rem', width: '220px' }}>
                            <div style={{ fontWeight: 600, fontSize: '0.825rem', color: 'var(--text-primary)' }}>
                              {FIELD_LABELS[fCode] || fCode}
                            </div>
                            <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', fontFamily: 'monospace' }}>
                              {fCode}
                            </div>
                          </td>
                          <td style={{ padding: '1rem' }}>
                            {ef?.raw_value ? (
                              <span style={{ fontSize: '0.85rem', color: 'var(--text-primary)', fontFamily: 'JetBrains Mono, monospace' }}>
                                {ef.raw_value}
                              </span>
                            ) : (
                              <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                                Not detected on scanned panels
                              </span>
                            )}
                          </td>
                          <td style={{ padding: '1rem', width: '140px' }}>
                            {ef ? (
                              <div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.72rem', marginBottom: '0.2rem' }}>
                                  <span style={{ color: conf > 80 ? 'var(--success)' : conf > 60 ? 'var(--warning)' : 'var(--danger)' }}>
                                    {conf}%
                                  </span>
                                </div>
                                <div style={{ height: '5px', width: '100%', background: 'var(--bg-secondary)', borderRadius: '3px', overflow: 'hidden' }}>
                                  <div
                                    style={{
                                      height: '100%', width: `${conf}%`,
                                      background: conf > 80 ? 'var(--success)' : conf > 60 ? 'var(--warning)' : 'var(--danger)'
                                    }}
                                  />
                                </div>
                              </div>
                            ) : (
                              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>—</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {/* TAB 3: Officer Review & Finalization */}
            {activeTab === 'review' && (
              <div className="card">
                <h3 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <Shield size={18} color="var(--accent)" />
                  Officer Statutory Determination
                </h3>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.825rem', marginBottom: '1.25rem', lineHeight: 1.5 }}>
                  As the certifying Legal Metrology Officer, verify the AI-assisted findings against the physical or imaged package. Your determination forms part of the permanent statutory audit record under Section 15 of the Act.
                </p>

                <div style={{ marginBottom: '1.25rem' }}>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 500, marginBottom: '0.4rem', color: 'var(--text-secondary)' }}>
                    Officer Inspection Notes / Compounding Remarks (Optional)
                  </label>
                  <textarea
                    className="input"
                    rows={4}
                    placeholder="Enter statutory remarks, compound notice citations, or justifications for manual override…"
                    value={reviewNote}
                    onChange={(e) => setReviewNote(e.target.value)}
                    style={{ resize: 'vertical' }}
                  />
                </div>

                <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
                  <button
                    className="btn btn-primary"
                    style={{ background: 'linear-gradient(135deg, #10b981, #059669)', border: 'none' }}
                    disabled={reviewSubmitting}
                    onClick={() => handleReviewDecision('ACCEPT')}
                  >
                    <Check size={16} /> Certify as COMPLIANT
                  </button>

                  <button
                    className="btn btn-danger"
                    disabled={reviewSubmitting}
                    onClick={() => handleReviewDecision('REJECT')}
                  >
                    <X size={16} /> Issue NON-COMPLIANCE Violation Notice
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
