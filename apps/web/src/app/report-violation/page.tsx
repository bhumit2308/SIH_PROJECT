'use client';
import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Scale, ShieldAlert, CheckCircle2, Upload, AlertTriangle,
  ArrowRight, Search, FileText, Camera, Copy, Check, Info, Lock
} from 'lucide-react';

const VIOLATION_TYPES = [
  { id: 'OVERCHARGING_MRP', label: 'Overcharging Above Printed MRP (Section 36(1))', desc: 'Charging higher than the printed Maximum Retail Price' },
  { id: 'MISSING_MANDATORY_DECLARATIONS', label: 'Missing Mandatory Declarations (Rule 6)', desc: 'Missing MRP, Net Qty, Mfg Date, or Consumer Care details' },
  { id: 'DUAL_MRP', label: 'Dual MRP Violation', desc: 'Different prices printed for identical commodity at airports/malls' },
  { id: 'DATE_TAMPERING_OR_EXPIRED', label: 'Sticker Overwriting / Expired Commodity', desc: 'New sticker pasted over original MRP or manufacture date' },
  { id: 'SHORT_WEIGHT_NET_QUANTITY', label: 'Short Net Quantity / Underfilling', desc: 'Actual weight or volume is significantly less than declared on pack' },
  { id: 'NO_CONSUMER_CARE_DETAILS', label: 'Absence of Consumer Care Grievance Redressal', desc: 'No customer care email, phone, or nodal officer contact on label' },
  { id: 'OTHER_VIOLATION', label: 'Other Legal Metrology Violation', desc: 'Any other infraction under Legal Metrology Act & PCR 2011' },
];

export default function ReportViolationPage() {
  const router = useRouter();

  // Search existing ticket
  const [searchTicket, setSearchTicket] = useState('');

  // Form states
  const [violationType, setViolationType] = useState('OVERCHARGING_MRP');
  const [productName, setProductName] = useState('');
  const [storeName, setStoreName] = useState('');
  const [storeLocation, setStoreLocation] = useState('');
  const [description, setDescription] = useState('');
  const [isAnonymous, setIsAnonymous] = useState(false);
  const [citizenName, setCitizenName] = useState('');
  const [citizenContact, setCitizenContact] = useState('');
  const [file, setFile] = useState<File | null>(null);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successData, setSuccessData] = useState<{
    ticket_no: string;
    tracking_url: string;
    message: string;
  } | null>(null);
  const [copied, setCopied] = useState(false);

  const handleTrackSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const clean = searchTicket.trim();
    if (clean) {
      router.push(`/report-violation/${clean.toUpperCase()}`);
    }
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!productName.trim()) {
      setError('Please specify the product or commodity name.');
      return;
    }

    setLoading(true);
    try {
      const formData = new FormData();
      formData.append('violation_type', violationType);
      formData.append('product_name', productName.trim());
      if (storeName.trim()) formData.append('store_name', storeName.trim());
      if (storeLocation.trim()) formData.append('store_location', storeLocation.trim());
      if (description.trim()) formData.append('description', description.trim());
      if (!isAnonymous && citizenName.trim()) formData.append('citizen_name', citizenName.trim());
      if (!isAnonymous && citizenContact.trim()) formData.append('citizen_contact', citizenContact.trim());
      if (file) formData.append('file', file);

      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'}/api/v1/grievances`, {
        method: 'POST',
        body: formData,
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.detail || errData.message || 'Failed to submit grievance');
      }

      const data = await res.json();
      setSuccessData({
        ticket_no: data.ticket_no,
        tracking_url: data.tracking_url,
        message: data.message,
      });
    } catch (err: any) {
      setError(err.message || 'An error occurred while transmitting the report.');
    } finally {
      setLoading(false);
    }
  };

  const copyTicket = () => {
    if (successData?.ticket_no) {
      navigator.clipboard.writeText(successData.ticket_no);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    }
  };

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-primary)', color: 'var(--text-primary)', paddingBottom: '4rem' }}>
      {/* Statutory Header */}
      <header style={{
        background: 'var(--bg-card)',
        borderBottom: '1px solid var(--border)',
        padding: '1rem 1.5rem',
        position: 'sticky',
        top: 0,
        zIndex: 50,
        backdropFilter: 'blur(10px)',
      }}>
        <div style={{ maxWidth: '1100px', margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
          <Link href="/" style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', textDecoration: 'none', color: 'inherit' }}>
            <div style={{
              width: '38px',
              height: '38px',
              borderRadius: '10px',
              background: 'linear-gradient(135deg, #1e3a8a, #2563eb)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 4px 12px rgba(37, 99, 235, 0.25)',
            }}>
              <Scale size={20} color="#fff" />
            </div>
            <div>
              <div style={{ fontSize: '1rem', fontWeight: 800, letterSpacing: '0.04em', lineHeight: 1.2 }}>
                METRA <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--accent)', background: 'rgba(37, 99, 235, 0.1)', padding: '2px 6px', borderRadius: '4px' }}>CITIZEN PORTAL</span>
              </div>
              <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                Department of Legal Metrology • Govt. of India
              </div>
            </div>
          </Link>

          {/* Quick Track Bar */}
          <form onSubmit={handleTrackSubmit} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <div style={{ position: 'relative' }}>
              <Search size={14} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
              <input
                type="text"
                placeholder="Enter Ticket ID (METRA-GRV-...)"
                value={searchTicket}
                onChange={(e) => setSearchTicket(e.target.value)}
                style={{
                  padding: '0.45rem 0.75rem 0.45rem 2rem',
                  fontSize: '0.78rem',
                  borderRadius: '6px',
                  border: '1px solid var(--border)',
                  background: 'var(--bg-secondary)',
                  color: 'var(--text-primary)',
                  width: '210px',
                }}
              />
            </div>
            <button type="submit" className="btn btn-secondary" style={{ padding: '0.45rem 0.85rem', fontSize: '0.78rem' }}>
              Track ↗
            </button>
          </form>
        </div>
      </header>

      {/* Hero Banner */}
      <div style={{
        maxWidth: '900px',
        margin: '2.5rem auto 1.5rem',
        padding: '0 1.5rem',
        textAlign: 'center',
      }}>
        <div style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '0.5rem',
          padding: '0.35rem 0.85rem',
          borderRadius: '50px',
          background: 'rgba(239, 68, 68, 0.1)',
          border: '1px solid rgba(239, 68, 68, 0.25)',
          color: '#ef4444',
          fontSize: '0.78rem',
          fontWeight: 600,
          marginBottom: '1rem',
        }}>
          <ShieldAlert size={15} /> Statutory Whistleblower & Consumer Protection Channel
        </div>
        <h1 style={{ fontSize: '2rem', fontWeight: 800, letterSpacing: '-0.02em', marginBottom: '0.75rem' }}>
          Report a Legal Metrology Violation
        </h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.925rem', lineHeight: 1.6, maxWidth: '680px', margin: '0 auto' }}>
          Report overcharging above MRP, misleading packaging, obscured manufacturing dates, or short weights. 
          Your complaint is routed directly into the <strong>Jurisdictional Enforcement Officer Queue</strong> for spot inspection under Section 36 of the Legal Metrology Act, 2009.
        </p>
      </div>

      <div style={{ maxWidth: '850px', margin: '0 auto', padding: '0 1.5rem' }}>
        {successData ? (
          /* Success Receipt Card */
          <div className="card animate-fade" style={{
            padding: '2.5rem 2rem',
            background: 'var(--bg-card)',
            border: '2px solid rgba(34, 197, 94, 0.4)',
            borderRadius: '12px',
            textAlign: 'center',
          }}>
            <div style={{
              width: '64px',
              height: '64px',
              borderRadius: '50%',
              background: 'rgba(34, 197, 94, 0.1)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 1.25rem',
            }}>
              <CheckCircle2 size={36} color="var(--success)" />
            </div>

            <h2 style={{ fontSize: '1.4rem', fontWeight: 700, marginBottom: '0.5rem' }}>
              Grievance Registered Successfully
            </h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', marginBottom: '1.5rem', maxWidth: '540px', margin: '0 auto 1.5rem' }}>
              Your report has been logged into the National Enforcement Registry. Legal Metrology officers will review the evidentiary lead for spot inspection or show-cause notice.
            </p>

            <div style={{
              background: 'var(--bg-secondary)',
              border: '1px solid var(--border)',
              borderRadius: '8px',
              padding: '1.25rem',
              maxWidth: '450px',
              margin: '0 auto 2rem',
              textAlign: 'center',
            }}>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Your Statutory Ticket Number
              </div>
              <div style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--accent)', letterSpacing: '0.05em', margin: '0.5rem 0' }}>
                {successData.ticket_no}
              </div>
              <button
                onClick={copyTicket}
                className="btn btn-ghost"
                style={{ fontSize: '0.78rem', display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}
              >
                {copied ? <Check size={14} color="var(--success)" /> : <Copy size={14} />}
                {copied ? 'Copied to Clipboard!' : 'Copy Ticket Reference'}
              </button>
            </div>

            <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center', flexWrap: 'wrap' }}>
              <Link href={successData.tracking_url}>
                <button className="btn btn-primary" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}>
                  Track Live Investigation Progress <ArrowRight size={16} />
                </button>
              </Link>
              <button
                onClick={() => {
                  setSuccessData(null);
                  setProductName('');
                  setStoreName('');
                  setStoreLocation('');
                  setDescription('');
                  setFile(null);
                }}
                className="btn btn-secondary"
              >
                Lodge Another Grievance
              </button>
            </div>
          </div>
        ) : (
          /* Grievance Submission Form */
          <form onSubmit={handleFormSubmit} className="card" style={{
            background: 'var(--bg-card)',
            border: '1px solid var(--border)',
            borderRadius: '12px',
            padding: '2rem',
            boxShadow: '0 8px 30px rgba(0,0,0,0.06)',
          }}>
            {error && (
              <div style={{
                background: 'rgba(239, 68, 68, 0.1)',
                border: '1px solid rgba(239, 68, 68, 0.3)',
                color: '#ef4444',
                padding: '0.85rem 1rem',
                borderRadius: '8px',
                fontSize: '0.85rem',
                marginBottom: '1.5rem',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
              }}>
                <AlertTriangle size={18} style={{ flexShrink: 0 }} />
                <span>{error}</span>
              </div>
            )}

            {/* 1. Violation Type */}
            <div style={{ marginBottom: '1.5rem' }}>
              <label style={{ display: 'block', fontWeight: 600, fontSize: '0.85rem', marginBottom: '0.4rem' }}>
                1. Nature of Legal Metrology Violation <span style={{ color: '#ef4444' }}>*</span>
              </label>
              <select
                value={violationType}
                onChange={(e) => setViolationType(e.target.value)}
                style={{
                  width: '100%',
                  padding: '0.65rem 0.85rem',
                  borderRadius: '6px',
                  border: '1px solid var(--border)',
                  background: 'var(--bg-secondary)',
                  color: 'var(--text-primary)',
                  fontSize: '0.875rem',
                }}
              >
                {VIOLATION_TYPES.map((vt) => (
                  <option key={vt.id} value={vt.id}>
                    {vt.label}
                  </option>
                ))}
              </select>
            </div>

            {/* 2. Commodity Info */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
              <div>
                <label style={{ display: 'block', fontWeight: 600, fontSize: '0.85rem', marginBottom: '0.4rem' }}>
                  2. Product / Commodity Name &amp; Brand <span style={{ color: '#ef4444' }}>*</span>
                </label>
                <input
                  type="text"
                  placeholder="Enter product or commodity name and brand"
                  value={productName}
                  onChange={(e) => setProductName(e.target.value)}
                  required
                  style={{
                    width: '100%',
                    padding: '0.65rem 0.85rem',
                    borderRadius: '6px',
                    border: '1px solid var(--border)',
                    background: 'var(--bg-secondary)',
                    color: 'var(--text-primary)',
                    fontSize: '0.875rem',
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontWeight: 600, fontSize: '0.85rem', marginBottom: '0.4rem' }}>
                  3. Retail Store, Platform or Vendor Name
                </label>
                <input
                  type="text"
                  placeholder="Enter retail establishment, vendor, or platform name"
                  value={storeName}
                  onChange={(e) => setStoreName(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '0.65rem 0.85rem',
                    borderRadius: '6px',
                    border: '1px solid var(--border)',
                    background: 'var(--bg-secondary)',
                    color: 'var(--text-primary)',
                    fontSize: '0.875rem',
                  }}
                />
              </div>
            </div>

            {/* 4. Location */}
            <div style={{ marginBottom: '1.5rem' }}>
              <label style={{ display: 'block', fontWeight: 600, fontSize: '0.85rem', marginBottom: '0.4rem' }}>
                4. Premise Address / City / Marketplace URL
              </label>
              <input
                type="text"
                placeholder="Enter premise address, city, or product listing URL"
                value={storeLocation}
                onChange={(e) => setStoreLocation(e.target.value)}
                style={{
                  width: '100%',
                  padding: '0.65rem 0.85rem',
                  borderRadius: '6px',
                  border: '1px solid var(--border)',
                  background: 'var(--bg-secondary)',
                  color: 'var(--text-primary)',
                  fontSize: '0.875rem',
                }}
              />
            </div>

            {/* 5. Incident Details */}
            <div style={{ marginBottom: '1.5rem' }}>
              <label style={{ display: 'block', fontWeight: 600, fontSize: '0.85rem', marginBottom: '0.4rem' }}>
                5. Incident Description &amp; Details
              </label>
              <textarea
                rows={3}
                placeholder="Provide specific details of the non-compliance observed (e.g. overcharging above MRP, missing declarations, obscured dates)"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                style={{
                  width: '100%',
                  padding: '0.65rem 0.85rem',
                  borderRadius: '6px',
                  border: '1px solid var(--border)',
                  background: 'var(--bg-secondary)',
                  color: 'var(--text-primary)',
                  fontSize: '0.875rem',
                  fontFamily: 'inherit',
                  resize: 'vertical',
                }}
              />
            </div>

            {/* 6. Photo Proof Upload */}
            <div style={{ marginBottom: '1.75rem' }}>
              <label style={{ display: 'block', fontWeight: 600, fontSize: '0.85rem', marginBottom: '0.4rem' }}>
                6. Photographic Proof (MRP Label, Cash Memo, or Outer Carton)
              </label>
              <div style={{
                border: '2px dashed var(--border)',
                borderRadius: '8px',
                padding: '1.5rem',
                textAlign: 'center',
                background: 'var(--bg-secondary)',
                cursor: 'pointer',
                position: 'relative',
              }}>
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => setFile(e.target.files?.[0] || null)}
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: '100%',
                    height: '100%',
                    opacity: 0,
                    cursor: 'pointer',
                  }}
                />
                <Camera size={28} color="var(--accent)" style={{ margin: '0 auto 0.5rem' }} />
                <div style={{ fontSize: '0.85rem', fontWeight: 600 }}>
                  {file ? file.name : 'Tap to capture photo or upload image proof'}
                </div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
                  Supported formats: JPEG, PNG, WebP (Max 10MB)
                </div>
              </div>
            </div>

            {/* 7. Citizen Identity & Privacy */}
            <div style={{
              background: 'var(--bg-secondary)',
              border: '1px solid var(--border)',
              borderRadius: '8px',
              padding: '1.25rem',
              marginBottom: '1.75rem',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
                <span style={{ fontSize: '0.85rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <Lock size={15} color="var(--accent)" /> Whistleblower Identity &amp; Contact
                </span>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.8rem', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={isAnonymous}
                    onChange={(e) => setIsAnonymous(e.target.checked)}
                  />
                  <span>Report Anonymously</span>
                </label>
              </div>

              {!isAnonymous && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '0.75rem' }}>
                  <div>
                    <input
                      type="text"
                      placeholder="Your Name (Optional)"
                      value={citizenName}
                      onChange={(e) => setCitizenName(e.target.value)}
                      style={{
                        width: '100%',
                        padding: '0.55rem 0.75rem',
                        borderRadius: '6px',
                        border: '1px solid var(--border)',
                        background: 'var(--bg-card)',
                        color: 'var(--text-primary)',
                        fontSize: '0.8rem',
                      }}
                    />
                  </div>
                  <div>
                    <input
                      type="text"
                      placeholder="Mobile / Email for Updates (Optional)"
                      value={citizenContact}
                      onChange={(e) => setCitizenContact(e.target.value)}
                      style={{
                        width: '100%',
                        padding: '0.55rem 0.75rem',
                        borderRadius: '6px',
                        border: '1px solid var(--border)',
                        background: 'var(--bg-card)',
                        color: 'var(--text-primary)',
                        fontSize: '0.8rem',
                      }}
                    />
                  </div>
                </div>
              )}
              <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '0.5rem' }}>
                Citizen informant data is confidential and protected under statutory whistleblower guidelines.
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="btn btn-primary"
              style={{
                width: '100%',
                padding: '0.85rem',
                fontSize: '0.95rem',
                fontWeight: 700,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.5rem',
              }}
            >
              {loading ? 'Transmitting to Legal Metrology Registry…' : 'Lodge Formal Statutory Grievance'}
              {!loading && <ArrowRight size={18} />}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
