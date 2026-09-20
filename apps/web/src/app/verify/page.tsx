'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ShieldCheck, Search, QrCode, Scale, ArrowRight,
  FileCheck, AlertTriangle, Shield
} from 'lucide-react';

export default function VerifyPortalSearchPage() {
  const router = useRouter();
  const [reference, setReference] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const clean = reference.trim();
    if (!clean) return;
    setSubmitting(true);
    // Encode reference to handle slashes correctly
    router.push(`/verify/${encodeURIComponent(clean)}`);
  };

  const sampleRefs = [
    { label: 'Haldiram’s Bhujia (Violation Notice)', ref: 'LMPC/2026/DL-0891', type: 'violation' },
    { label: 'Amul Taaza Milk (Certificate of Compliance)', ref: 'LMPC/CERT/2026/0412', type: 'compliant' },
    { label: 'E-Commerce Dark-Store Audit (Zepto/Blinkit)', ref: 'LMPC/ECOM/2026/1B94DC', type: 'ecom' },
  ];

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-primary)', color: 'var(--text-primary)', display: 'flex', flexDirection: 'column' }}>
      {/* Official Saffron & Navy Top Bar */}
      <div style={{ background: 'linear-gradient(90deg, #FF9933 0%, #FFFFFF 50%, #138808 100%)', height: '4px' }} />
      <div style={{ background: '#080d1a', borderBottom: '1px solid rgba(255,255,255,0.08)', padding: '0.6rem 1.5rem' }}>
        <div style={{ maxWidth: '1100px', margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <span style={{ fontWeight: 700, color: '#e2e8f0', letterSpacing: '0.04em' }}>GOVERNMENT OF INDIA</span>
            <span>·</span>
            <span>DEPARTMENT OF LEGAL METROLOGY</span>
          </div>
          <Link href="/dashboard" style={{ color: 'var(--accent-light)', textDecoration: 'none' }}>
            Officer Sign In →
          </Link>
        </div>
      </div>

      {/* Hero Section */}
      <div style={{ flex: 1, maxWidth: '780px', margin: '3rem auto 2rem', padding: '0 1.5rem', display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>
        <div style={{ width: '64px', height: '64px', borderRadius: '16px', background: 'rgba(99,102,241,0.12)', border: '1px solid var(--border-bright)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '1.25rem', color: 'var(--accent-light)' }}>
          <Scale size={32} />
        </div>

        <h1 style={{ fontSize: '2.2rem', fontWeight: 800, color: '#ffffff', letterSpacing: '-0.02em', lineHeight: 1.2 }}>
          Public Statutory Notice & Certificate Verification
        </h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem', maxWidth: '600px', marginTop: '0.75rem', lineHeight: 1.6 }}>
          Verify the authenticity, cryptographic SHA-256 seal, and statutory compounding status of any Legal Metrology notice or Section 15 compliance certificate issued across India.
        </p>

        {/* Search Box */}
        <form onSubmit={handleSearch} style={{ width: '100%', marginTop: '2rem' }}>
          <div className="card" style={{ padding: '0.6rem', display: 'flex', alignItems: 'center', gap: '0.75rem', background: 'var(--bg-elevated)', border: '1px solid var(--border-bright)', boxShadow: 'var(--shadow-glow)' }}>
            <Search size={20} color="var(--text-muted)" style={{ marginLeft: '0.5rem' }} />
            <input
              type="text"
              placeholder="Enter Notice Ref (e.g. LMPC/2026/DL-0891) or Inspection ID..."
              value={reference}
              onChange={(e) => setReference(e.target.value)}
              style={{ flex: 1, background: 'transparent', border: 'none', color: '#ffffff', fontSize: '0.95rem', outline: 'none', fontFamily: 'monospace' }}
            />
            <button
              type="submit"
              disabled={submitting || !reference.trim()}
              className="btn btn-primary"
              style={{ padding: '0.65rem 1.5rem', fontSize: '0.875rem' }}
            >
              Verify Notice <ArrowRight size={16} />
            </button>
          </div>
        </form>

        {/* Quick Test Samples */}
        <div style={{ width: '100%', marginTop: '1.5rem', textAlign: 'left' }}>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: '0.6rem' }}>
            Quick Verify Statutory Test Records:
          </span>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {sampleRefs.map((s, idx) => (
              <div
                key={idx}
                onClick={() => router.push(`/verify/${encodeURIComponent(s.ref)}`)}
                style={{
                  padding: '0.75rem 1rem',
                  borderRadius: '8px',
                  background: 'rgba(255,255,255,0.03)',
                  border: '1px solid var(--border)',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  transition: 'all 0.15s ease',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.borderColor = 'var(--border-bright)')}
                onMouseLeave={(e) => (e.currentTarget.style.borderColor = 'var(--border)')}
              >
                <div>
                  <div style={{ fontWeight: 600, fontSize: '0.875rem', color: '#e2e8f0' }}>{s.label}</div>
                  <div style={{ fontSize: '0.78rem', color: 'var(--accent-light)', fontFamily: 'monospace' }}>{s.ref}</div>
                </div>
                <ArrowRight size={15} color="var(--text-muted)" />
              </div>
            ))}
          </div>
        </div>

        {/* Legal Authority Footnote */}
        <div className="grid-3" style={{ width: '100%', marginTop: '3rem', gap: '1rem', textAlign: 'left' }}>
          <div className="card" style={{ padding: '1rem' }}>
            <ShieldCheck size={20} color="#10b981" style={{ marginBottom: '0.4rem' }} />
            <h4 style={{ fontSize: '0.85rem', fontWeight: 600 }}>Section 65B Electronic Proof</h4>
            <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
              Cryptographically signed with SHA-256 seal, court-admissible under Bharatiya Sakshya Adhiniyam, 2023.
            </p>
          </div>
          <div className="card" style={{ padding: '1rem' }}>
            <Scale size={20} color="#6366f1" style={{ marginBottom: '0.4rem' }} />
            <h4 style={{ fontSize: '0.85rem', fontWeight: 600 }}>Section 15 Enforceability</h4>
            <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
              Determinations issued by authorized Legal Metrology officers under Central Gazette provisions.
            </p>
          </div>
          <div className="card" style={{ padding: '1rem' }}>
            <QrCode size={20} color="#f59e0b" style={{ marginBottom: '0.4rem' }} />
            <h4 style={{ fontSize: '0.85rem', fontWeight: 600 }}>Zero-Login Public Access</h4>
            <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
              Immediate verification for manufacturers, magistrates, retailers, and consumer whistleblowers.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
