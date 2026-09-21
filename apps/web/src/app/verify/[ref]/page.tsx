'use client';
import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { apiRequest } from '@/lib/auth';
import {
  ShieldCheck, AlertTriangle, FileText, Download, CheckCircle2,
  Copy, Check, Scale, Clock, ArrowLeft, ExternalLink, Printer,
  Building2, Hash, AlertOctagon
} from 'lucide-react';

interface StatutoryProvision {
  field_code: string;
  rule: string;
  subject: string;
  severity: string;
  finding_details: string;
  ai_extracted_value: string | null;
  status: string;
}

interface VerificationData {
  is_valid: boolean;
  verification_status: string;
  notice_ref: string;
  inspection_id: string;
  report_id: string | null;
  product_name: string;
  category_name: string;
  final_status: 'COMPLIANT' | 'NON_COMPLIANT' | 'REVIEW_REQUIRED' | 'PENDING';
  status_headline: string;
  created_at: string;
  issuing_authority: string;
  issuing_act: string;
  statutory_rules: string;
  cryptographic_seal: {
    algorithm: string;
    hash: string;
    legal_validity: string;
    timestamp_utc: string;
  };
  violation_count: number;
  warning_count: number;
  extracted_field_count: number;
  statutory_provisions: StatutoryProvision[];
  legal_consequences: {
    compounding_eligible: boolean;
    compounding_section: string;
    statutory_compounding_fee: number;
    show_cause_period_days: number;
    compounding_status?: string;
    treasury_challan_no?: string | null;
    compounded_amount?: number | null;
    compounded_at?: string | null;
    compounding_cert_ref?: string | null;
    prosecution_clause: string;
  };
  download_url: string;
}

export default function StatutoryVerificationPage() {
  const params = useParams();
  const router = useRouter();
  const rawRef = Array.isArray(params?.ref) ? params.ref.join('/') : (params?.ref as string);

  const [data, setData] = useState<VerificationData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!rawRef) return;
    const fetchVerification = async () => {
      setLoading(true);
      setError(null);
      try {
        const decoded = decodeURIComponent(rawRef);
        const res = await apiRequest<VerificationData>(`/api/v1/verify/${encodeURIComponent(decoded)}`);
        setData(res);
      } catch (err: any) {
        setError(err?.message || 'The specified statutory record or notice could not be verified.');
      } finally {
        setLoading(false);
      }
    };
    fetchVerification();
  }, [rawRef]);

  const copyHash = () => {
    if (!data?.cryptographic_seal?.hash) return;
    navigator.clipboard.writeText(data.cryptographic_seal.hash);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-primary)', color: 'var(--text-primary)', paddingBottom: '4rem' }}>
      {/* Official Saffron & Navy Top Bar */}
      <div style={{ background: 'linear-gradient(90deg, #FF9933 0%, #FFFFFF 50%, #138808 100%)', height: '4px' }} />
      <div style={{ background: '#080d1a', borderBottom: '1px solid rgba(255,255,255,0.08)', padding: '0.6rem 1.5rem' }}>
        <div style={{ maxWidth: '1100px', margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.72rem', color: 'var(--text-muted)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <span style={{ fontWeight: 700, color: '#e2e8f0', letterSpacing: '0.04em' }}>GOVERNMENT OF INDIA</span>
            <span>·</span>
            <span>MINISTRY OF CONSUMER AFFAIRS, FOOD & PUBLIC DISTRIBUTION</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <span style={{ color: '#4ade80', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
              <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#4ade80', display: 'inline-block' }} />
              Live Statutory Registry
            </span>
            <Link href="/verify" style={{ color: 'var(--accent-light)', textDecoration: 'none' }}>
              Search Another Notice
            </Link>
          </div>
        </div>
      </div>

      {/* Main Container */}
      <div style={{ maxWidth: '960px', margin: '2rem auto', padding: '0 1.5rem' }}>
        {/* Navigation & Actions */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
          <Link href="/verify" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', color: 'var(--text-secondary)', textDecoration: 'none', fontSize: '0.85rem' }}>
            <ArrowLeft size={16} /> Back to Registry Search
          </Link>
          <div style={{ display: 'flex', gap: '0.75rem' }}>
            <button onClick={handlePrint} className="btn btn-ghost" style={{ fontSize: '0.8rem', padding: '0.4rem 0.8rem' }}>
              <Printer size={15} /> Print Certificate
            </button>
            {data?.download_url && (
              <a href={data.download_url} target="_blank" rel="noopener noreferrer" className="btn btn-primary" style={{ fontSize: '0.8rem', padding: '0.4rem 0.8rem', textDecoration: 'none' }}>
                <Download size={15} /> Download Sealed PDF
              </a>
            )}
          </div>
        </div>

        {/* Loading State */}
        {loading && (
          <div className="card" style={{ padding: '4rem 2rem', textAlign: 'center' }}>
            <div style={{ width: '36px', height: '36px', border: '3px solid rgba(99,102,241,0.2)', borderTopColor: 'var(--accent)', borderRadius: '50%', animation: 'spin 1s linear infinite', margin: '0 auto 1rem' }} />
            <h3 style={{ fontSize: '1.1rem', fontWeight: 600 }}>Verifying Cryptographic Record...</h3>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginTop: '0.4rem' }}>
              Querying Legal Metrology National Registry under Legal Metrology Act, 2009.
            </p>
          </div>
        )}

        {/* Error State */}
        {error && !loading && (
          <div className="card" style={{ padding: '3rem 2rem', textAlign: 'center', borderColor: 'rgba(239, 68, 68, 0.4)' }}>
            <div style={{ width: '56px', height: '56px', borderRadius: '50%', background: 'rgba(239,68,68,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1.2rem', color: '#ef4444' }}>
              <AlertOctagon size={28} />
            </div>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 700, color: '#f87171' }}>Statutory Record Not Found</h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', maxWidth: '480px', margin: '0.6rem auto 1.5rem' }}>
              No certified inspection notice or compliance determination was found matching:
              <br />
              <code style={{ background: 'rgba(0,0,0,0.3)', padding: '0.2rem 0.6rem', borderRadius: '4px', color: '#fbbf24', marginTop: '0.4rem', display: 'inline-block' }}>
                {rawRef}
              </code>
            </p>
            <Link href="/verify">
              <button className="btn btn-ghost">Verify Different Reference</button>
            </Link>
          </div>
        )}

        {/* Verified Certificate */}
        {data && !loading && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            {/* Header Certificate Card */}
            <div className="card card-elevated" style={{ padding: '2rem', position: 'relative', overflow: 'hidden' }}>
              {/* Watermark Emblem Icon */}
              <div style={{ position: 'absolute', right: '-20px', top: '-20px', opacity: 0.04, pointerEvents: 'none' }}>
                <Scale size={240} />
              </div>

              {/* Status Banner */}
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap' }}>
                <div>
                  <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', padding: '0.35rem 0.85rem', borderRadius: '999px', fontSize: '0.75rem', fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase', marginBottom: '0.75rem',
                    background: data.final_status === 'COMPLIANT' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                    color: data.final_status === 'COMPLIANT' ? '#4ade80' : '#f87171',
                    border: `1px solid ${data.final_status === 'COMPLIANT' ? 'rgba(16, 185, 129, 0.3)' : 'rgba(239, 68, 68, 0.3)'}`
                  }}>
                    {data.final_status === 'COMPLIANT' ? <CheckCircle2 size={14} /> : <AlertTriangle size={14} />}
                    {data.status_headline}
                  </div>
                  <h1 style={{ fontSize: '1.6rem', fontWeight: 800, color: '#ffffff', lineHeight: 1.2 }}>
                    {data.product_name}
                  </h1>
                  <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginTop: '0.3rem' }}>
                    Category: <span style={{ color: '#e2e8f0', fontWeight: 600 }}>{data.category_name}</span> · Statutory Ref: <span style={{ color: '#818cf8', fontWeight: 600 }}>{data.notice_ref}</span>
                  </p>
                </div>

                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Determination Date</div>
                  <div style={{ fontSize: '0.9rem', fontWeight: 600, color: '#e2e8f0' }}>
                    {new Date(data.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' })}
                  </div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
                    {new Date(data.created_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })} UTC
                  </div>
                </div>
              </div>

              <div style={{ height: '1px', background: 'var(--border)', margin: '1.5rem 0' }} />

              {/* Statutory Authority Info */}
              <div className="grid-3" style={{ gap: '1rem', fontSize: '0.825rem' }}>
                <div>
                  <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: '0.72rem', textTransform: 'uppercase' }}>Enforcing Authority</span>
                  <span style={{ fontWeight: 600, color: '#f1f5f9' }}>{data.issuing_authority}</span>
                </div>
                <div>
                  <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: '0.72rem', textTransform: 'uppercase' }}>Governing Legislation</span>
                  <span style={{ fontWeight: 600, color: '#f1f5f9' }}>{data.issuing_act}</span>
                </div>
                <div>
                  <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: '0.72rem', textTransform: 'uppercase' }}>Regulatory Rules</span>
                  <span style={{ fontWeight: 600, color: '#f1f5f9' }}>PCR 2011 (G.S.R. 202(E) / 737(E))</span>
                </div>
              </div>
            </div>

            {/* Cryptographic SHA-256 Section 65B Seal Card */}
            <div className="card" style={{ padding: '1.25rem 1.5rem', background: 'rgba(15, 23, 42, 0.6)' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.6rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.8rem', fontWeight: 600, color: '#818cf8' }}>
                  <ShieldCheck size={16} />
                  <span>Section 65B Indian Evidence Act / Section 63 BSA 2023 Digital Seal</span>
                </div>
                <button onClick={copyHash} className="btn btn-ghost" style={{ fontSize: '0.75rem', padding: '0.25rem 0.6rem' }}>
                  {copied ? <><Check size={13} color="#4ade80" /> Copied</> : <><Copy size={13} /> Copy Hash</>}
                </button>
              </div>
              <div style={{ background: '#0a0f1d', border: '1px solid rgba(99,102,241,0.2)', padding: '0.6rem 0.8rem', borderRadius: '6px', fontFamily: 'monospace', fontSize: '0.78rem', color: '#a5b4fc', wordBreak: 'break-all' }}>
                SHA-256: {data.cryptographic_seal.hash}
              </div>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.75rem', marginTop: '0.5rem' }}>
                {data.cryptographic_seal.legal_validity}. Certified tamper-evident record registered on the METRA regulatory backbone.
              </p>
            </div>

            {/* Statutory Violations & Findings Table */}
            <div className="card" style={{ padding: '1.5rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
                <div>
                  <h2 style={{ fontSize: '1.05rem', fontWeight: 700 }}>Statutory Labeling Verification</h2>
                  <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                    Evaluated deterministically against mandatory legal requirements under PCR 2011.
                  </p>
                </div>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <span className="badge badge-danger" style={{ fontSize: '0.75rem' }}>
                    {data.violation_count} Violation{data.violation_count === 1 ? '' : 's'}
                  </span>
                  <span className="badge badge-warning" style={{ fontSize: '0.75rem' }}>
                    {data.warning_count} Warning{data.warning_count === 1 ? '' : 's'}
                  </span>
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {data.statutory_provisions.length === 0 ? (
                  <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.875rem' }}>
                    <CheckCircle2 size={32} color="#10b981" style={{ margin: '0 auto 0.5rem' }} />
                    All mandatory statutory declarations under Rule 6(1) & Rule 6(11) verified as compliant.
                  </div>
                ) : (
                  data.statutory_provisions.map((prov, i) => (
                    <div key={i} style={{
                      padding: '1rem 1.25rem',
                      borderRadius: '8px',
                      background: prov.status === 'VIOLATION' ? 'rgba(239,68,68,0.06)' : 'rgba(245,158,11,0.06)',
                      border: `1px solid ${prov.status === 'VIOLATION' ? 'rgba(239,68,68,0.2)' : 'rgba(245,158,11,0.2)'}`,
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '0.4rem'
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <span style={{ fontWeight: 700, fontSize: '0.875rem', color: prov.status === 'VIOLATION' ? '#f87171' : '#fbbf24' }}>
                          {prov.subject}
                        </span>
                        <span style={{ fontSize: '0.72rem', fontWeight: 600, padding: '0.15rem 0.5rem', borderRadius: '4px', background: prov.status === 'VIOLATION' ? 'rgba(239,68,68,0.2)' : 'rgba(245,158,11,0.2)', color: prov.status === 'VIOLATION' ? '#fca5a5' : '#fde68a' }}>
                          {prov.status} · {prov.severity}
                        </span>
                      </div>
                      <div style={{ fontSize: '0.78rem', color: '#94a3b8', fontStyle: 'italic' }}>
                        {prov.rule}
                      </div>
                      <div style={{ fontSize: '0.85rem', color: '#e2e8f0', marginTop: '0.2rem' }}>
                        {prov.finding_details}
                      </div>
                      {prov.ai_extracted_value && (
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                          Observed Value: <code style={{ color: '#cbd5e1' }}>{prov.ai_extracted_value}</code>
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Legal Consequences & Section 48 Compounding Notice */}
            {data.final_status === 'NON_COMPLIANT' && (
              data.legal_consequences.compounding_status === 'COMPOUNDED' ? (
                <div className="card" style={{ padding: '1.5rem', borderColor: 'rgba(34, 197, 94, 0.4)', background: 'rgba(34, 197, 94, 0.05)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.75rem' }}>
                    <ShieldCheck size={22} color="#22c55e" />
                    <h3 style={{ fontSize: '1.05rem', fontWeight: 700, color: '#4ade80' }}>
                      Offence Compounded &amp; Discharged (Section 48, Legal Metrology Act, 2009)
                    </h3>
                  </div>
                  <div className="grid-3" style={{ gap: '1rem', marginBottom: '1rem' }}>
                    <div style={{ background: 'rgba(0,0,0,0.2)', padding: '0.75rem', borderRadius: '6px' }}>
                      <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', display: 'block' }}>Compounding Certificate</span>
                      <span style={{ fontSize: '1rem', fontWeight: 800, color: '#4ade80', fontFamily: 'monospace' }}>
                        {data.legal_consequences.compounding_cert_ref || 'LMPC/COMP/2026/...'}
                      </span>
                    </div>
                    <div style={{ background: 'rgba(0,0,0,0.2)', padding: '0.75rem', borderRadius: '6px' }}>
                      <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', display: 'block' }}>Treasury Challan Ref</span>
                      <span style={{ fontSize: '0.9rem', fontWeight: 700, color: '#e2e8f0', fontFamily: 'monospace' }}>
                        {data.legal_consequences.treasury_challan_no || 'Verified e-Challan'}
                      </span>
                    </div>
                    <div style={{ background: 'rgba(0,0,0,0.2)', padding: '0.75rem', borderRadius: '6px' }}>
                      <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', display: 'block' }}>Settled Penalty Amount</span>
                      <span style={{ fontSize: '1.25rem', fontWeight: 800, color: '#4ade80' }}>
                        ₹{(data.legal_consequences.compounded_amount || 25000).toLocaleString('en-IN')}
                      </span>
                    </div>
                  </div>
                  <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                    {data.legal_consequences.prosecution_clause}
                  </p>
                </div>
              ) : data.legal_consequences.compounding_status === 'ESCALATED_TO_CJM' ? (
                <div className="card" style={{ padding: '1.5rem', borderColor: 'rgba(239, 68, 68, 0.5)', background: 'rgba(239, 68, 68, 0.08)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.75rem' }}>
                    <Scale size={22} color="#ef4444" />
                    <h3 style={{ fontSize: '1.05rem', fontWeight: 700, color: '#f87171' }}>
                      Prosecution Instituted Before Chief Judicial Magistrate (Section 36(1))
                    </h3>
                  </div>
                  <div style={{ background: 'rgba(0,0,0,0.25)', padding: '0.85rem', borderRadius: '6px', marginBottom: '1rem' }}>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Status of Statutory Notice:</div>
                    <div style={{ fontSize: '0.95rem', fontWeight: 700, color: '#fca5a5', marginTop: '0.2rem' }}>
                      CRIMINAL PROSECUTION COMPLAINT FILED (NON-COMPOUNDED OFFENCE)
                    </div>
                  </div>
                  <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                    {data.legal_consequences.prosecution_clause}
                  </p>
                </div>
              ) : (
                <div className="card" style={{ padding: '1.5rem', borderColor: 'rgba(239, 68, 68, 0.4)', background: 'rgba(239, 68, 68, 0.04)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.75rem' }}>
                    <Scale size={20} color="#ef4444" />
                    <h3 style={{ fontSize: '1rem', fontWeight: 700, color: '#f87171' }}>
                      Statutory Compounding Notice (Section 48, Legal Metrology Act, 2009)
                    </h3>
                  </div>
                  <div className="grid-3" style={{ gap: '1rem', marginBottom: '1rem' }}>
                    <div style={{ background: 'rgba(0,0,0,0.2)', padding: '0.75rem', borderRadius: '6px' }}>
                      <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', display: 'block' }}>Assessed Compounding Fee</span>
                      <span style={{ fontSize: '1.25rem', fontWeight: 800, color: '#fca5a5' }}>
                        ₹{data.legal_consequences.statutory_compounding_fee.toLocaleString('en-IN')}
                      </span>
                    </div>
                    <div style={{ background: 'rgba(0,0,0,0.2)', padding: '0.75rem', borderRadius: '6px' }}>
                      <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', display: 'block' }}>Show Cause Period</span>
                      <span style={{ fontSize: '1.25rem', fontWeight: 800, color: '#fca5a5' }}>
                        {data.legal_consequences.show_cause_period_days} Days
                      </span>
                    </div>
                    <div style={{ background: 'rgba(0,0,0,0.2)', padding: '0.75rem', borderRadius: '6px' }}>
                      <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', display: 'block' }}>Statutory Section</span>
                      <span style={{ fontSize: '1rem', fontWeight: 700, color: '#e2e8f0' }}>
                        {data.legal_consequences.compounding_section}
                      </span>
                    </div>
                  </div>
                  <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                    {data.legal_consequences.prosecution_clause}
                  </p>
                </div>
              )
            )}

            {/* Official Footer */}
            <div style={{ textAlign: 'center', padding: '1rem 0', color: 'var(--text-muted)', fontSize: '0.75rem', lineHeight: 1.6 }}>
              This electronic verification record is generated by the AI-Assisted METRA Regulatory Infrastructure on behalf of the Department of Legal Metrology.
              <br />
              For official queries or compounding payments, quote notice reference: <strong style={{ color: '#e2e8f0' }}>{data.notice_ref}</strong>.
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
