'use client';
import { useState, FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import { useAuth } from '@/lib/auth';
import {
  Shield, Eye, EyeOff, AlertCircle, Loader2, Scale,
  CheckCircle2, FileText, Search, ExternalLink, Building2,
  Lock, ArrowRight, Sparkles, CheckCircle, Award, Cpu, BarChart3,
  HelpCircle, ChevronRight, UserCheck
} from 'lucide-react';

export default function LoginPage() {
  const { login } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPwd, setShowPwd] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      await login(email, password);
      router.push('/dashboard');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Authentication failed. Please verify your statutory officer credentials.');
    } finally {
      setLoading(false);
    }
  };

  const handleFillDemo = () => {
    setEmail('inspector.kiran@metra.gov.in');
    setPassword('ValidK3y@Metra#2024');
  };

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#070b14', color: '#f1f5f9', display: 'flex', flexDirection: 'column' }}>
      
      {/* ── Top National Sovereign Ribbon ── */}
      <header style={{
        width: '100%',
        backgroundColor: 'rgba(12, 18, 32, 0.95)',
        borderBottom: '1px solid #1e293b',
        position: 'sticky',
        top: 0,
        zIndex: 50,
        backdropFilter: 'blur(12px)',
      }}>
        {/* Tri-color national micro-band */}
        <div style={{ width: '100%', height: '3px', display: 'flex' }}>
          <div style={{ flex: 1, backgroundColor: '#FF9933' }}></div>
          <div style={{ flex: 1, backgroundColor: '#FFFFFF' }}></div>
          <div style={{ flex: 1, backgroundColor: '#138808' }}></div>
        </div>

        <div style={{
          maxWidth: '1280px',
          margin: '0 auto',
          padding: '0.6rem 1.5rem',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '1rem',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
            <div style={{
              width: '36px',
              height: '36px',
              borderRadius: '8px',
              backgroundColor: '#131d33',
              border: '1px solid #1e293b',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '4px',
            }}>
              <Image
                src="/metra_seal_logo.svg"
                alt="METRA Seal"
                width={28}
                height={28}
                style={{ objectFit: 'contain' }}
                priority
              />
            </div>
            <div>
              <div style={{ fontSize: '0.78rem', fontWeight: 700, letterSpacing: '0.04em', color: '#e2e8f0', textTransform: 'uppercase' }}>
                Department of Consumer Affairs · Legal Metrology Division
              </div>
              <div style={{ fontSize: '0.68rem', color: '#94a3b8', fontFamily: 'monospace' }}>
                Government of India · The Legal Metrology Act, 2009 &amp; LMPC Rules, 2011
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <div style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.4rem',
              padding: '0.25rem 0.65rem',
              borderRadius: '9999px',
              backgroundColor: 'rgba(16, 185, 129, 0.12)',
              border: '1px solid rgba(16, 185, 129, 0.3)',
              color: '#34d399',
              fontSize: '0.7rem',
              fontFamily: 'monospace',
            }}>
              <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#10b981', display: 'inline-block' }}></span>
              National Grid · Online
            </div>
            <span style={{ fontSize: '0.7rem', color: '#64748b', fontFamily: 'monospace' }}>
              Portal v2.4.0
            </span>
          </div>
        </div>
      </header>

      {/* ── Main Hero Section: Two Balanced Columns ── */}
      <section style={{
        flex: 1,
        maxWidth: '1280px',
        width: '100%',
        margin: '0 auto',
        padding: '3rem 1.5rem',
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))',
        gap: '3.5rem',
        alignItems: 'center',
      }}>

        {/* Left Column: Mission, Legal Authority, and Key Highlights */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          
          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.5rem',
            padding: '0.35rem 0.85rem',
            borderRadius: '6px',
            backgroundColor: 'rgba(99, 102, 241, 0.12)',
            border: '1px solid rgba(99, 102, 241, 0.25)',
            color: '#a5b4fc',
            fontSize: '0.75rem',
            fontWeight: 600,
            width: 'fit-content',
          }}>
            <Scale size={14} color="#818cf8" />
            <span>SIH26034 · Automated Statutory Compliance Engine</span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <h1 style={{
              fontSize: 'clamp(2rem, 3.8vw, 3rem)',
              fontWeight: 800,
              lineHeight: 1.15,
              letterSpacing: '-0.025em',
              color: '#ffffff',
            }}>
              Transforming Legal Metrology with{' '}
              <span style={{
                background: 'linear-gradient(135deg, #818cf8 0%, #38bdf8 100%)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
              }}>
                Algorithmic Integrity
              </span>
            </h1>
            <p style={{
              fontSize: '0.925rem',
              lineHeight: 1.6,
              color: '#94a3b8',
              maxWidth: '560px',
            }}>
              METRA automates retail shelf scanning, e-commerce marketplace auditing, and packaging compliance under the <strong>Legal Metrology (Packaged Commodities) Rules, 2011</strong> with real-time discrepancy detection and Section 48 compounding workflows.
            </p>
          </div>

          {/* 3 Real Operational Pillars */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
            gap: '0.75rem',
            paddingTop: '0.5rem',
            paddingBottom: '0.5rem',
          }}>
            <div style={{
              padding: '0.85rem',
              borderRadius: '8px',
              backgroundColor: '#0d1527',
              border: '1px solid #1e293b',
            }}>
              <div style={{ fontSize: '0.7rem', color: '#94a3b8', textTransform: 'uppercase', fontWeight: 600 }}>Rule 6(1)</div>
              <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#ffffff', fontFamily: 'monospace', marginTop: '0.2rem' }}>8 Checks</div>
              <div style={{ fontSize: '0.68rem', color: '#818cf8', marginTop: '0.25rem' }}>MRP, Net Qty, Mfg Date, USP</div>
            </div>

            <div style={{
              padding: '0.85rem',
              borderRadius: '8px',
              backgroundColor: '#0d1527',
              border: '1px solid #1e293b',
            }}>
              <div style={{ fontSize: '0.7rem', color: '#94a3b8', textTransform: 'uppercase', fontWeight: 600 }}>Enforcement</div>
              <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#34d399', fontFamily: 'monospace', marginTop: '0.2rem' }}>Section 48</div>
              <div style={{ fontSize: '0.68rem', color: '#94a3b8', marginTop: '0.25rem' }}>Statutory Compounding</div>
            </div>

            <div style={{
              padding: '0.85rem',
              borderRadius: '8px',
              backgroundColor: '#0d1527',
              border: '1px solid #1e293b',
            }}>
              <div style={{ fontSize: '0.7rem', color: '#94a3b8', textTransform: 'uppercase', fontWeight: 600 }}>Surveillance</div>
              <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#38bdf8', fontFamily: 'monospace', marginTop: '0.2rem' }}>Retail + Web</div>
              <div style={{ fontSize: '0.68rem', color: '#94a3b8', marginTop: '0.25rem' }}>Dark Stores &amp; E-Commerce</div>
            </div>
          </div>

          {/* Citizen Public Verification Shortcuts */}
          <div style={{
            padding: '1rem',
            borderRadius: '10px',
            backgroundColor: '#0d1527',
            border: '1px solid #1e293b',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.75rem',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', color: '#cbd5e1', letterSpacing: '0.04em' }}>
                Citizen Transparency &amp; Public Services
              </span>
              <span style={{ fontSize: '0.68rem', color: '#64748b' }}>Open Public Access</span>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.6rem' }}>
              <Link
                href="/verify"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '0.6rem 0.85rem',
                  borderRadius: '6px',
                  backgroundColor: '#131d33',
                  border: '1px solid #1e293b',
                  textDecoration: 'none',
                  color: '#f1f5f9',
                  transition: 'all 0.15s ease',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <Search size={15} color="#818cf8" />
                  <div>
                    <div style={{ fontSize: '0.75rem', fontWeight: 600 }}>Verify Notice / QR</div>
                    <div style={{ fontSize: '0.65rem', color: '#94a3b8' }}>Check SHA-256 seal &amp; status</div>
                  </div>
                </div>
                <ChevronRight size={14} color="#64748b" />
              </Link>

              <Link
                href="/report-violation"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '0.6rem 0.85rem',
                  borderRadius: '6px',
                  backgroundColor: '#131d33',
                  border: '1px solid #1e293b',
                  textDecoration: 'none',
                  color: '#f1f5f9',
                  transition: 'all 0.15s ease',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <FileText size={15} color="#fbbf24" />
                  <div>
                    <div style={{ fontSize: '0.75rem', fontWeight: 600 }}>Report Violation</div>
                    <div style={{ fontSize: '0.65rem', color: '#94a3b8' }}>File package overcharging</div>
                  </div>
                </div>
                <ChevronRight size={14} color="#64748b" />
              </Link>
            </div>
          </div>

        </div>

        {/* Right Column: Secure Enforcement Officer Terminal */}
        <div style={{ width: '100%', maxWidth: '440px', margin: '0 auto' }}>
          <div style={{
            backgroundColor: '#0f172a',
            borderRadius: '16px',
            border: '1px solid #1e293b',
            boxShadow: '0 25px 60px rgba(0, 0, 0, 0.6), 0 0 30px rgba(99, 102, 241, 0.15)',
            padding: '2.25rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '1.25rem',
          }}>
            
            {/* Terminal Header */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', paddingBottom: '1rem', borderBottom: '1px solid #1e293b' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: '0.7rem', fontWeight: 700, fontFamily: 'monospace', color: '#818cf8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Officer Command Access
                </span>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.68rem', fontFamily: 'monospace', color: '#94a3b8' }}>
                  <Lock size={11} /> TLS 1.3 256-bit
                </span>
              </div>
              <h2 style={{ fontSize: '1.35rem', fontWeight: 800, color: '#ffffff', letterSpacing: '-0.015em' }}>
                Authorized Officer Sign-In
              </h2>
              <p style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
                Enter your official Legal Metrology credentials to access the National Command Center.
              </p>
            </div>

            {/* Login Form */}
            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                <label style={{ fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', color: '#cbd5e1', letterSpacing: '0.04em' }}>
                  Official Email Address
                </label>
                <div style={{ position: 'relative' }}>
                  <input
                    type="email"
                    id="login-email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    autoComplete="email"
                    placeholder="Enter official email address"
                    style={{
                      width: '100%',
                      padding: '0.65rem 0.85rem',
                      borderRadius: '8px',
                      backgroundColor: '#070b14',
                      border: '1px solid #1e293b',
                      color: '#ffffff',
                      fontSize: '0.85rem',
                      outline: 'none',
                    }}
                  />
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <label style={{ fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', color: '#cbd5e1', letterSpacing: '0.04em' }}>
                    Security Password
                  </label>
                  <span style={{ fontSize: '0.7rem', color: '#818cf8', cursor: 'pointer' }}>
                    Forgot key?
                  </span>
                </div>
                <div style={{ position: 'relative' }}>
                  <input
                    type={showPwd ? 'text' : 'password'}
                    id="login-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    autoComplete="current-password"
                    placeholder="Enter security password or key"
                    style={{
                      width: '100%',
                      padding: '0.65rem 2.5rem 0.65rem 0.85rem',
                      borderRadius: '8px',
                      backgroundColor: '#070b14',
                      border: '1px solid #1e293b',
                      color: '#ffffff',
                      fontSize: '0.85rem',
                      outline: 'none',
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPwd(!showPwd)}
                    style={{
                      position: 'absolute',
                      right: '0.75rem',
                      top: '50%',
                      transform: 'translateY(-50%)',
                      background: 'none',
                      border: 'none',
                      color: '#94a3b8',
                      cursor: 'pointer',
                      padding: '4px',
                    }}
                  >
                    {showPwd ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </div>
              </div>

              {error && (
                <div style={{
                  padding: '0.65rem 0.85rem',
                  borderRadius: '6px',
                  backgroundColor: 'rgba(239, 68, 68, 0.15)',
                  border: '1px solid rgba(239, 68, 68, 0.35)',
                  color: '#fca5a5',
                  fontSize: '0.75rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                }}>
                  <AlertCircle size={15} color="#ef4444" style={{ flexShrink: 0 }} />
                  <span>{error}</span>
                </div>
              )}

              <button
                type="submit"
                id="login-submit"
                disabled={loading}
                style={{
                  width: '100%',
                  padding: '0.75rem',
                  borderRadius: '8px',
                  backgroundColor: '#6366f1',
                  color: '#ffffff',
                  fontWeight: 700,
                  fontSize: '0.875rem',
                  border: 'none',
                  cursor: loading ? 'not-allowed' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.5rem',
                  marginTop: '0.25rem',
                  boxShadow: '0 4px 14px rgba(99, 102, 241, 0.35)',
                  transition: 'background 0.15s ease',
                }}
              >
                {loading ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    <span>Verifying Statutory Credentials…</span>
                  </>
                ) : (
                  <>
                    <Shield size={16} />
                    <span>Sign In to Command Center</span>
                  </>
                )}
              </button>
            </form>

            {/* Quick Demo Fill Helper (For Evaluators/Judges) */}
            <div style={{
              paddingTop: '0.75rem',
              borderTop: '1px solid #1e293b',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              fontSize: '0.7rem',
              color: '#94a3b8',
            }}>
              <button
                type="button"
                onClick={handleFillDemo}
                style={{
                  background: 'none',
                  border: '1px dashed #334155',
                  borderRadius: '4px',
                  padding: '0.25rem 0.5rem',
                  color: '#818cf8',
                  fontSize: '0.7rem',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.35rem',
                }}
              >
                <UserCheck size={12} />
                <span>Quick-fill Inspector Test Credentials</span>
              </button>
              <span>NIC Cloud</span>
            </div>

          </div>
        </div>

      </section>

      {/* ── Statutory Surveillance Capability Showcase (Below Hero) ── */}
      <section style={{
        backgroundColor: '#0c1220',
        borderTop: '1px solid #1e293b',
        borderBottom: '1px solid #1e293b',
        padding: '3rem 1.5rem',
      }}>
        <div style={{ maxWidth: '1280px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '2rem' }}>
          
          <div style={{ textAlign: 'center', maxWidth: '640px', margin: '0 auto' }}>
            <div style={{ fontSize: '0.72rem', fontWeight: 700, color: '#818cf8', textTransform: 'uppercase', letterSpacing: '0.06em', fontFamily: 'monospace' }}>
              Statutory Inspection Framework
            </div>
            <h2 style={{ fontSize: '1.75rem', fontWeight: 800, color: '#ffffff', letterSpacing: '-0.02em', marginTop: '0.35rem' }}>
              Built for Legal Metrology Enforcement Officers
            </h2>
            <p style={{ fontSize: '0.85rem', color: '#94a3b8', marginTop: '0.5rem' }}>
              Comprehensive regulatory enforcement coverage bridging physical retail premises, quick-commerce fulfillment centers, and major e-commerce platforms.
            </p>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '1.25rem' }}>
            
            {/* Feature 1 */}
            <div style={{
              padding: '1.25rem',
              borderRadius: '10px',
              backgroundColor: '#070b14',
              border: '1px solid #1e293b',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.75rem',
            }}>
              <div style={{
                width: '36px', height: '36px', borderRadius: '8px',
                backgroundColor: 'rgba(99, 102, 241, 0.15)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: '#818cf8',
              }}>
                <Cpu size={18} />
              </div>
              <h3 style={{ fontSize: '0.95rem', fontWeight: 700, color: '#ffffff' }}>
                Automated Packaging OCR
              </h3>
              <p style={{ fontSize: '0.78rem', color: '#94a3b8', lineHeight: 1.5 }}>
                Multi-panel high-resolution packaging analysis extracting MRP, Unit Sale Price, Net Quantity, Best Before, and Manufacturer complete address.
              </p>
            </div>

            {/* Feature 2 */}
            <div style={{
              padding: '1.25rem',
              borderRadius: '10px',
              backgroundColor: '#070b14',
              border: '1px solid #1e293b',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.75rem',
            }}>
              <div style={{
                width: '36px', height: '36px', borderRadius: '8px',
                backgroundColor: 'rgba(16, 185, 129, 0.15)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: '#34d399',
              }}>
                <Award size={18} />
              </div>
              <h3 style={{ fontSize: '0.95rem', fontWeight: 700, color: '#ffffff' }}>
                Section 48 Compounding
              </h3>
              <p style={{ fontSize: '0.78rem', color: '#94a3b8', lineHeight: 1.5 }}>
                Instant statutory penalty assessment under Section 36 &amp; Section 48 with automated treasury challan tracking and gazette notice generation.
              </p>
            </div>

            {/* Feature 3 */}
            <div style={{
              padding: '1.25rem',
              borderRadius: '10px',
              backgroundColor: '#070b14',
              border: '1px solid #1e293b',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.75rem',
            }}>
              <div style={{
                width: '36px', height: '36px', borderRadius: '8px',
                backgroundColor: 'rgba(56, 189, 248, 0.15)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: '#38bdf8',
              }}>
                <BarChart3 size={18} />
              </div>
              <h3 style={{ fontSize: '0.95rem', fontWeight: 700, color: '#ffffff' }}>
                E-Commerce Crawler
              </h3>
              <p style={{ fontSize: '0.78rem', color: '#94a3b8', lineHeight: 1.5 }}>
                Automated auditing of marketplace listings (Amazon, Flipkart, Blinkit) to flag deceptive packaging, missing USP, or unregistered importer details.
              </p>
            </div>

            {/* Feature 4 */}
            <div style={{
              padding: '1.25rem',
              borderRadius: '10px',
              backgroundColor: '#070b14',
              border: '1px solid #1e293b',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.75rem',
            }}>
              <div style={{
                width: '36px', height: '36px', borderRadius: '8px',
                backgroundColor: 'rgba(251, 191, 36, 0.15)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: '#fbbf24',
              }}>
                <Search size={18} />
              </div>
              <h3 style={{ fontSize: '0.95rem', fontWeight: 700, color: '#ffffff' }}>
                Public QR Verification
              </h3>
              <p style={{ fontSize: '0.78rem', color: '#94a3b8', lineHeight: 1.5 }}>
                Citizen portal to scan QR codes on statutory notices, verifying authenticity directly against the Central Controller of Legal Metrology registry.
              </p>
            </div>

          </div>

        </div>
      </section>

      {/* ── Official Institutional Footer ── */}
      <footer style={{
        backgroundColor: '#070b14',
        padding: '1.5rem',
        borderTop: '1px solid #1e293b',
        textAlign: 'center',
        fontSize: '0.75rem',
        color: '#64748b',
        fontFamily: 'monospace',
      }}>
        <div style={{ maxWidth: '1280px', margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem' }}>
          <span>© {new Date().getFullYear()} METRA · Legal Metrology Platform · Government of India</span>
          <span>Legal Metrology Division · Ministry of Consumer Affairs, Food &amp; Public Distribution</span>
        </div>
      </footer>

    </div>
  );
}
