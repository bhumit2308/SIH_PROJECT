'use client';
import { useState, useEffect, use, useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth, apiRequest } from '@/lib/auth';
import {
  ArrowLeft, CheckCircle2, AlertTriangle, AlertCircle, Clock,
  FileText, RefreshCw, Eye, EyeOff, Shield, Tag, Calendar, User,
  Check, X, Edit3, ExternalLink, Download, Layers, Sparkles, Crosshair, Award
} from 'lucide-react';

interface EvidenceRegion {
  id: string;
  image_id: string | null;
  x: number | null;
  y: number | null;
  width: number | null;
  height: number | null;
  source_text: string | null;
}

interface Finding {
  id: string;
  status: 'PASS' | 'WARNING' | 'VIOLATION' | 'REVIEW_REQUIRED';
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  message: string;
  field_code: string | null;
  ai_raw_value: string | null;
  human_override_value?: string | null;
  evidence_regions?: EvidenceRegion[];
}

interface ExtractedField {
  id: string;
  field_code: string;
  raw_value: string;
  normalized_value: string | null;
  confidence: number;
  source_image_id: string | null;
  parsed_data?: {
    bbox?: { x: number; y: number; width: number; height: number };
    [key: string]: any;
  } | null;
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
  product_notes?: string | null;
  source_info?: string | null;
  mode: string;
  status: string;
  final_status: string;
  confidence_score: number | null;
  created_at: string;
  finalized_at?: string | null;
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
  const [reportGenerating, setReportGenerating] = useState(false);
  const [reportToast, setReportToast] = useState<string | null>(null);
  const [selectedFieldCode, setSelectedFieldCode] = useState<string | null>(null);
  const [showOverlay, setShowOverlay] = useState(true);

  const handleDownloadReport = async () => {
    if (!token || !inspection) return;
    setReportGenerating(true);
    setReportToast(null);
    try {
      const res = await apiRequest<{ report_id: string; download_url: string }>(
        `/api/v1/inspections/${inspectionId}/report`,
        { token, method: 'POST' }
      );
      if (res.download_url) {
        window.open(res.download_url, '_blank', 'noopener');
        setReportToast('Official notice generated and downloading…');
      } else {
        setReportToast('Report generated but URL unavailable. Check Supabase storage.');
      }
    } catch (e: any) {
      const msg = e?.message || 'Report generation failed.';
      setReportToast(`Error: ${msg}`);
    } finally {
      setReportGenerating(false);
      setTimeout(() => setReportToast(null), 6000);
    }
  };

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

  // Compute all bounding boxes associated with this image or findings
  const visibleBoxes = useMemo(() => {
    if (!inspection || !selectedImage) return [];

    const boxes: Array<{
      id: string;
      fieldCode: string;
      label: string;
      text: string;
      status: 'PASS' | 'WARNING' | 'VIOLATION' | 'REVIEW_REQUIRED';
      x: number;
      y: number;
      width: number;
      height: number;
      color: string;
      bg: string;
      bgActive: string;
    }> = [];

    // 1. From Findings evidence_regions
    for (const f of inspection.findings || []) {
      const fc = f.field_code || 'declaration';
      const label = FIELD_LABELS[fc] || fc;
      const status = f.status;
      const isViol = status === 'VIOLATION';
      const isWarn = status === 'WARNING' || status === 'REVIEW_REQUIRED';
      const color = isViol ? '#ef4444' : isWarn ? '#f59e0b' : '#10b981';
      const bg = isViol ? 'rgba(239, 68, 68, 0.18)' : isWarn ? 'rgba(245, 158, 11, 0.18)' : 'rgba(16, 185, 129, 0.18)';
      const bgActive = isViol ? 'rgba(239, 68, 68, 0.4)' : isWarn ? 'rgba(245, 158, 11, 0.4)' : 'rgba(16, 185, 129, 0.4)';

      for (const ev of f.evidence_regions || []) {
        if (!ev.image_id || ev.image_id === selectedImage.id) {
          if (ev.x != null && ev.y != null && ev.width != null && ev.height != null) {
            boxes.push({
              id: ev.id,
              fieldCode: fc,
              label,
              text: ev.source_text || f.ai_raw_value || '',
              status,
              x: ev.x,
              y: ev.y,
              width: ev.width,
              height: ev.height,
              color,
              bg,
              bgActive,
            });
          }
        }
      }
    }

    // 2. From Extracted Fields parsed_data.bbox (if not already added)
    for (const ef of inspection.extracted_fields || []) {
      if (!ef.source_image_id || ef.source_image_id === selectedImage.id) {
        const bbox = ef.parsed_data?.bbox;
        if (bbox && bbox.x != null && bbox.y != null && bbox.width != null && bbox.height != null) {
          if (!boxes.some(b => b.fieldCode === ef.field_code)) {
            const fc = ef.field_code;
            const label = FIELD_LABELS[fc] || fc;
            const hasViolation = inspection.findings?.some(f => f.field_code === fc && f.status === 'VIOLATION');
            const hasWarning = inspection.findings?.some(f => f.field_code === fc && (f.status === 'WARNING' || f.status === 'REVIEW_REQUIRED'));
            const status = hasViolation ? 'VIOLATION' : hasWarning ? 'WARNING' : 'PASS';
            const color = hasViolation ? '#ef4444' : hasWarning ? '#f59e0b' : '#10b981';
            const bg = hasViolation ? 'rgba(239, 68, 68, 0.18)' : hasWarning ? 'rgba(245, 158, 11, 0.18)' : 'rgba(16, 185, 129, 0.18)';
            const bgActive = hasViolation ? 'rgba(239, 68, 68, 0.4)' : hasWarning ? 'rgba(245, 158, 11, 0.4)' : 'rgba(16, 185, 129, 0.4)';

            boxes.push({
              id: ef.id,
              fieldCode: fc,
              label,
              text: ef.raw_value || '',
              status,
              x: bbox.x,
              y: bbox.y,
              width: bbox.width,
              height: bbox.height,
              color,
              bg,
              bgActive,
            });
          }
        }
      }
    }

    return boxes;
  }, [inspection, selectedImage]);

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

        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
          {/* Report Toast */}
          {reportToast && (
            <span style={{
              fontSize: '0.75rem', padding: '0.35rem 0.75rem',
              background: reportToast.startsWith('Error') ? 'rgba(220,38,38,0.15)' : 'rgba(22,163,74,0.15)',
              border: `1px solid ${reportToast.startsWith('Error') ? 'rgba(220,38,38,0.4)' : 'rgba(22,163,74,0.4)'}`,
              color: reportToast.startsWith('Error') ? '#f87171' : '#4ade80',
              borderRadius: '6px', maxWidth: '280px',
            }}>
              {reportToast}
            </span>
          )}
          <button
            className="btn btn-primary"
            onClick={handleDownloadReport}
            disabled={reportGenerating || !inspection || inspection.status === 'DRAFT'}
            title={inspection?.status === 'DRAFT' ? 'Run analysis first' : 'Generate Official Statutory Notice PDF'}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: '0.5rem',
              background: reportGenerating ? 'rgba(99,102,241,0.5)' : undefined,
              cursor: (reportGenerating || inspection?.status === 'DRAFT') ? 'not-allowed' : 'pointer',
            }}
          >
            {reportGenerating
              ? <><RefreshCw size={14} className="animate-spin" /> Generating PDF…</>
              : <><Download size={14} /> Download Official Notice</>
            }
          </button>
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
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
              <h3 style={{ fontSize: '0.95rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.5rem', margin: 0 }}>
                <Layers size={16} color="var(--accent)" />
                Packaging Panel &amp; AI Perception
              </h3>
              <button
                className="btn btn-ghost"
                onClick={() => setShowOverlay(!showOverlay)}
                title={showOverlay ? 'Hide bounding boxes' : 'Show bounding boxes'}
                style={{
                  fontSize: '0.72rem', padding: '0.25rem 0.5rem',
                  display: 'inline-flex', alignItems: 'center', gap: '0.35rem',
                  color: showOverlay ? 'var(--accent-light)' : 'var(--text-muted)',
                  border: `1px solid ${showOverlay ? 'var(--accent)' : 'var(--border)'}`,
                  borderRadius: '6px'
                }}
              >
                {showOverlay ? <><Eye size={13} /> Overlay ON</> : <><EyeOff size={13} /> Overlay OFF</>}
              </button>
            </div>

            {selectedFieldCode && (
              <div style={{
                marginBottom: '0.75rem', padding: '0.35rem 0.65rem',
                background: 'rgba(99,102,241,0.12)', border: '1px solid rgba(99,102,241,0.3)',
                borderRadius: '6px', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                fontSize: '0.75rem', color: 'var(--accent-light)'
              }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                  <Crosshair size={13} />
                  Focusing: <strong>{FIELD_LABELS[selectedFieldCode] || selectedFieldCode}</strong>
                </span>
                <button
                  onClick={() => setSelectedFieldCode(null)}
                  style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '0.8rem', padding: 0 }}
                  title="Clear focus"
                >
                  ✕
                </button>
              </div>
            )}

            {inspection.images && inspection.images.length > 0 ? (
              <div>
                {/* Main View Area with Interactive Bounding Box Evidence Layer */}
                <div style={{
                  width: '100%', height: '360px', borderRadius: '10px',
                  background: '#070b14', overflow: 'hidden', display: 'flex',
                  alignItems: 'center', justifyContent: 'center', border: '1px solid var(--border)',
                  marginBottom: '1rem', position: 'relative'
                }}>
                  {publicImageUrl ? (
                    <div style={{ position: 'relative', width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <img
                        src={publicImageUrl}
                        alt={selectedImage?.view_type}
                        style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain', userSelect: 'none' }}
                      />

                      {/* Evidence Bounding Boxes */}
                      {showOverlay && visibleBoxes.map((box, bIdx) => {
                        const isSelected = selectedFieldCode === box.fieldCode;
                        return (
                          <div
                            key={bIdx}
                            onClick={() => {
                              setSelectedFieldCode(box.fieldCode);
                              setActiveTab('findings');
                            }}
                            title={`${box.label}: ${box.text}`}
                            style={{
                              position: 'absolute',
                              left: `${box.x}%`,
                              top: `${box.y}%`,
                              width: `${box.width}%`,
                              height: `${box.height}%`,
                              border: isSelected ? `2.5px solid ${box.color}` : `1.5px solid ${box.color}`,
                              background: isSelected ? box.bgActive : box.bg,
                              boxShadow: isSelected ? `0 0 16px ${box.color}` : `0 0 6px ${box.color}`,
                              borderRadius: '4px',
                              cursor: 'pointer',
                              transition: 'all 0.2s ease',
                              zIndex: isSelected ? 20 : 10,
                            }}
                          >
                            <span style={{
                              position: 'absolute',
                              top: '-18px',
                              left: '-1px',
                              fontSize: '0.6rem',
                              fontWeight: 700,
                              background: box.color,
                              color: '#000',
                              padding: '1px 5px',
                              borderRadius: '3px',
                              whiteSpace: 'nowrap',
                              pointerEvents: 'none',
                              boxShadow: '0 2px 4px rgba(0,0,0,0.6)',
                            }}>
                              {box.fieldCode.toUpperCase()}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>Image loading…</div>
                  )}

                  <div style={{ position: 'absolute', bottom: '8px', left: '8px', zIndex: 25 }}>
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
                      onClick={() => { setSelectedImageIndex(idx); setSelectedFieldCode(null); }}
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

                {/* Detected Declarations Quick Selector Chips */}
                <div style={{ marginTop: '0.75rem', padding: '0.75rem', background: 'var(--bg-secondary)', borderRadius: '8px' }}>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginBottom: '0.4rem', fontWeight: 600 }}>
                    Detected Declarations ({inspection.extracted_fields?.length || 0}) · Click to Focus:
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem' }}>
                    {['mrp', 'net_quantity', 'manufacturer', 'date_info', 'unit_sale_price', 'country_of_origin', 'consumer_care'].map((fc) => {
                      const ef = inspection.extracted_fields?.find(f => f.field_code === fc);
                      if (!ef) return null;
                      const isSel = selectedFieldCode === fc;
                      const hasViol = inspection.findings?.some(f => f.field_code === fc && f.status === 'VIOLATION');
                      const pillColor = hasViol ? 'var(--danger)' : 'var(--success)';
                      return (
                        <button
                          key={fc}
                          onClick={() => {
                            setSelectedFieldCode(isSel ? null : fc);
                          }}
                          style={{
                            fontSize: '0.68rem',
                            padding: '0.2rem 0.5rem',
                            borderRadius: '12px',
                            border: isSel ? `1.5px solid ${pillColor}` : '1px solid var(--border)',
                            background: isSel ? 'rgba(99,102,241,0.2)' : 'var(--card-bg)',
                            color: isSel ? 'var(--accent-light)' : 'var(--text-secondary)',
                            cursor: 'pointer',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '0.25rem',
                            transition: 'all 0.15s ease',
                          }}
                        >
                          <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: pillColor }} />
                          {fc.replace('_', ' ')}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Image Quality Summary */}
                {selectedImage && (
                  <div style={{ marginTop: '0.75rem', padding: '0.65rem 0.75rem', background: 'var(--bg-secondary)', borderRadius: '8px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.25rem' }}>
                      <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Quality Gate</span>
                      <span className={`badge ${selectedImage.quality_status === 'PASS' ? 'badge-success' : 'badge-warning'}`} style={{ fontSize: '0.65rem' }}>
                        {selectedImage.quality_status}
                      </span>
                    </div>
                    <div style={{ fontSize: '0.68rem', color: 'var(--text-secondary)' }}>
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

                    const isSelected = selectedFieldCode === finding.field_code;
                    return (
                      <div
                        key={finding.id}
                        className="card"
                        style={{
                          borderLeft: `4px solid ${isViolation ? 'var(--danger)' : sev.color}`,
                          border: isSelected ? '2px solid var(--accent)' : undefined,
                          boxShadow: isSelected ? '0 0 16px rgba(99,102,241,0.35)' : undefined,
                          padding: '1.25rem',
                          transition: 'all 0.2s ease',
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
                          {finding.field_code && (
                            <button
                              onClick={() => {
                                setSelectedFieldCode(isSelected ? null : finding.field_code);
                                window.scrollTo({ top: 0, behavior: 'smooth' });
                              }}
                              className="btn btn-ghost"
                              style={{
                                fontSize: '0.72rem',
                                padding: '0.25rem 0.6rem',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '0.35rem',
                                color: isSelected ? 'var(--accent-light)' : 'var(--text-secondary)',
                                border: isSelected ? '1px solid var(--accent)' : '1px solid var(--border)',
                                borderRadius: '6px'
                              }}
                            >
                              <Crosshair size={13} /> {isSelected ? 'Unfocus' : 'Locate on Package'}
                            </button>
                          )}
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
                {inspection.status === 'FINALIZED' ? (
                  <div style={{ textAlign: 'center', padding: '1.5rem 1rem' }}>
                    <div style={{
                      width: '64px', height: '64px', borderRadius: '50%',
                      background: inspection.final_status === 'COMPLIANT' ? 'rgba(16,185,129,0.15)' : 'rgba(239,68,68,0.15)',
                      border: `2px solid ${inspection.final_status === 'COMPLIANT' ? 'var(--success)' : 'var(--danger)'}`,
                      display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1rem'
                    }}>
                      <Award size={32} color={inspection.final_status === 'COMPLIANT' ? 'var(--success)' : 'var(--danger)'} />
                    </div>
                    <h3 style={{ fontSize: '1.15rem', fontWeight: 700, marginBottom: '0.35rem' }}>
                      Statutory Determination Sealed &amp; Finalized
                    </h3>
                    <div style={{ marginBottom: '1rem' }}>
                      <span className={`badge ${inspection.final_status === 'COMPLIANT' ? 'badge-success' : 'badge-danger'}`} style={{ fontSize: '0.8rem', padding: '0.3rem 0.8rem' }}>
                        {inspection.final_status === 'COMPLIANT' ? 'OFFICIALLY CERTIFIED COMPLIANT' : 'STATUTORY VIOLATION NOTICE ISSUED'}
                      </span>
                    </div>

                    <p style={{ color: 'var(--text-muted)', fontSize: '0.825rem', maxWidth: '500px', margin: '0 auto 1.5rem', lineHeight: 1.5 }}>
                      This inspection record has been officially determined under Section 15 of the Legal Metrology Act, 2009.
                      {inspection.finalized_at && ` Determination recorded on ${new Date(inspection.finalized_at).toLocaleString('en-IN')}.`}
                    </p>

                    {inspection.product_notes && (
                      <div style={{
                        textAlign: 'left', background: 'var(--bg-secondary)', padding: '1rem',
                        borderRadius: '8px', marginBottom: '1.5rem', border: '1px solid var(--border)',
                        fontSize: '0.8rem', color: 'var(--text-secondary)', lineHeight: 1.5,
                        fontFamily: 'monospace', whiteSpace: 'pre-wrap'
                      }}>
                        {inspection.product_notes}
                      </div>
                    )}

                    <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center', flexWrap: 'wrap' }}>
                      <button
                        className="btn btn-primary"
                        onClick={handleDownloadReport}
                        disabled={reportGenerating}
                        style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', padding: '0.65rem 1.25rem' }}
                      >
                        {reportGenerating
                          ? <><RefreshCw size={15} className="animate-spin" /> Generating Sealed Notice…</>
                          : <><Download size={15} /> Download Official Sealed Notice (PDF)</>
                        }
                      </button>

                      <Link href={`/verify/${inspection.id}`} target="_blank" rel="noopener noreferrer">
                        <button className="btn btn-ghost" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', padding: '0.65rem 1.1rem' }}>
                          <ExternalLink size={15} /> Public Verification Portal ↗
                        </button>
                      </Link>
                    </div>
                  </div>
                ) : (
                  <div>
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
            )}
          </div>
        </div>
      </div>
    </>
  );
}
