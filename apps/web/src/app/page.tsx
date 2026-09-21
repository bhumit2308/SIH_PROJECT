'use client';
import { useState, FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { useAuth } from '@/lib/auth';
import {
  Shield, Eye, EyeOff, AlertCircle, Loader2, Scale,
  CheckCircle2, FileText, Search, ExternalLink, Building2, Lock
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
      setError(err instanceof Error ? err.message : 'Authentication failed. Please verify statutory credentials.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#070b14] text-[#f1f5f9] flex flex-col justify-between selection:bg-[#6366f1]/30">
      {/* ── Top Official Sovereign Ribbon ── */}
      <header className="w-full border-b border-[#1e293b] bg-[#0c1220]/90 backdrop-blur-md sticky top-0 z-50">
        <div className="w-full h-[3px] flex">
          <span className="flex-1 bg-[#FF9933]"></span>
          <span className="flex-1 bg-[#FFFFFF]"></span>
          <span className="flex-1 bg-[#138808]"></span>
        </div>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 relative flex items-center justify-center">
              <Image
                src="/metra_seal_logo.svg"
                alt="METRA Official Seal"
                width={32}
                height={32}
                className="object-contain"
                priority
              />
            </div>
            <div className="flex flex-col">
              <span className="text-xs font-semibold tracking-wider text-slate-200 uppercase">
                Department of Consumer Affairs · Legal Metrology Division
              </span>
              <span className="text-[10px] text-slate-400 font-mono">
                Government of India · The Legal Metrology Act, 2009
              </span>
            </div>
          </div>
          <div className="hidden sm:flex items-center gap-4 text-xs text-slate-400">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-950/60 border border-emerald-800/40 text-emerald-400 font-mono text-[11px]">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
              National Metrology Grid · Online
            </span>
            <span className="font-mono text-[11px] text-slate-500">v2.4.0-PROD</span>
          </div>
        </div>
      </header>

      {/* ── Main Two-Column Enterprise Portal ── */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 lg:py-16 grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-16 items-center">
        
        {/* Left Column: Institutional Mission & Real Statutory Context */}
        <div className="lg:col-span-7 flex flex-col space-y-6">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-md bg-[#131d33] border border-[#1e293b] text-indigo-400 text-xs font-semibold tracking-wide w-fit">
            <Scale size={14} className="text-indigo-400" />
            <span>Statutory Verification & Automated Enforcement System</span>
          </div>

          <div className="space-y-3">
            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight text-white leading-tight">
              Protecting Consumers Through <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 via-sky-300 to-indigo-200">Algorithmic Metrology</span>
            </h1>
            <p className="text-slate-400 text-sm sm:text-base leading-relaxed max-w-2xl">
              METRA powers automated scanning, packaging verification, and instant compliance enforcement across physical retail shelves and e-commerce platforms in accordance with the <strong>Legal Metrology (Packaged Commodities) Rules, 2011</strong>.
            </p>
          </div>

          {/* Operational Fact Matrix (Human, Authentic Data Points) */}
          <div className="grid grid-cols-3 gap-3 py-2 border-y border-[#1e293b]">
            <div className="p-3 bg-[#0d1527] rounded-lg border border-[#1e293b]/70">
              <div className="text-xs text-slate-400 font-medium">Mandatory Rules</div>
              <div className="text-xl font-bold text-white font-mono mt-0.5">Rule 6(1)</div>
              <div className="text-[10px] text-indigo-400 mt-1">MRP, Net Qty, Mfg Date</div>
            </div>
            <div className="p-3 bg-[#0d1527] rounded-lg border border-[#1e293b]/70">
              <div className="text-xs text-slate-400 font-medium">Compounding Sec</div>
              <div className="text-xl font-bold text-emerald-400 font-mono mt-0.5">Section 48</div>
              <div className="text-[10px] text-slate-400 mt-1">Expedited Gazette Settlement</div>
            </div>
            <div className="p-3 bg-[#0d1527] rounded-lg border border-[#1e293b]/70">
              <div className="text-xs text-slate-400 font-medium">Audit Pipeline</div>
              <div className="text-xl font-bold text-sky-400 font-mono mt-0.5">OCR + AI</div>
              <div className="text-[10px] text-slate-400 mt-1">Multi-angle Packaging Check</div>
            </div>
          </div>

          {/* Citizen Public Services Rail */}
          <div className="p-4 rounded-xl bg-[#0d1527] border border-[#1e293b] space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-300">
                Public Transparency & Citizen Portals
              </span>
              <span className="text-[11px] text-slate-500">No login required</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <a
                href="/verify"
                className="flex items-center justify-between p-3 rounded-lg bg-[#131d33] border border-[#1e293b] hover:border-indigo-500/50 hover:bg-[#16233d] transition-all group"
              >
                <div className="flex items-center gap-2.5">
                  <div className="p-2 rounded-md bg-indigo-950/70 border border-indigo-800/40 text-indigo-400">
                    <Search size={16} />
                  </div>
                  <div>
                    <div className="text-xs font-semibold text-slate-200 group-hover:text-white">Verify Public Notice</div>
                    <div className="text-[11px] text-slate-400">Check QR code or Notice ID</div>
                  </div>
                </div>
                <ExternalLink size={14} className="text-slate-500 group-hover:text-indigo-400" />
              </a>

              <a
                href="/report-violation"
                className="flex items-center justify-between p-3 rounded-lg bg-[#131d33] border border-[#1e293b] hover:border-amber-500/50 hover:bg-[#16233d] transition-all group"
              >
                <div className="flex items-center gap-2.5">
                  <div className="p-2 rounded-md bg-amber-950/70 border border-amber-800/40 text-amber-400">
                    <FileText size={16} />
                  </div>
                  <div>
                    <div className="text-xs font-semibold text-slate-200 group-hover:text-white">Report Violation</div>
                    <div className="text-[11px] text-slate-400">File package non-compliance</div>
                  </div>
                </div>
                <ExternalLink size={14} className="text-slate-500 group-hover:text-amber-400" />
              </a>
            </div>
          </div>
        </div>

        {/* Right Column: Secure Enforcement Officer Terminal */}
        <div className="lg:col-span-5">
          <div className="bg-[#0f172a] rounded-2xl border border-[#1e293b] shadow-2xl p-6 sm:p-8 space-y-6 relative overflow-hidden">
            <div className="space-y-1.5 pb-4 border-b border-[#1e293b]">
              <div className="flex items-center justify-between">
                <span className="text-xs font-mono font-semibold text-indigo-400 uppercase tracking-wider">
                  Officer Command Access
                </span>
                <span className="inline-flex items-center gap-1 text-[11px] font-mono text-slate-400">
                  <Lock size={12} className="text-slate-400" /> TLS 1.3 256-bit
                </span>
              </div>
              <h2 className="text-xl font-bold text-white tracking-tight">Authorized Sign-In</h2>
              <p className="text-xs text-slate-400">
                Enter your official Legal Metrology Department credentials or digital security key.
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-300 uppercase tracking-wider font-mono">
                  Official Email / Officer ID
                </label>
                <div className="relative">
                  <input
                    type="email"
                    id="login-email"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    required
                    autoComplete="email"
                    placeholder="Enter official email address"
                    className="w-full px-3.5 py-2.5 rounded-lg bg-[#070b14] border border-[#1e293b] text-slate-100 text-sm font-medium focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all placeholder:text-slate-600"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-slate-300 uppercase tracking-wider font-mono">
                    Security Passkey
                  </label>
                  <span className="text-[11px] text-indigo-400 hover:text-indigo-300 cursor-pointer">
                    Forgot key?
                  </span>
                </div>
                <div className="relative">
                  <input
                    type={showPwd ? 'text' : 'password'}
                    id="login-password"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    required
                    autoComplete="current-password"
                    placeholder="Enter security password or key"
                    className="w-full px-3.5 py-2.5 rounded-lg bg-[#070b14] border border-[#1e293b] text-slate-100 text-sm font-mono tracking-wider focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all placeholder:text-slate-600 pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPwd(!showPwd)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200 p-1"
                  >
                    {showPwd ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              {error && (
                <div className="p-3 rounded-lg bg-red-950/40 border border-red-800/50 text-red-300 text-xs flex items-start gap-2">
                  <AlertCircle size={16} className="text-red-400 flex-shrink-0 mt-0.5" />
                  <span>{error}</span>
                </div>
              )}

              <button
                type="submit"
                id="login-submit"
                disabled={loading}
                className="w-full py-2.5 px-4 rounded-lg bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 text-white font-semibold text-sm transition-all flex items-center justify-center gap-2 shadow-lg shadow-indigo-600/20 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    <span>Verifying Statutory Credentials…</span>
                  </>
                ) : (
                  <>
                    <Shield size={16} />
                    <span>Access Enforcement Terminal</span>
                  </>
                )}
              </button>
            </form>

            <div className="pt-3 border-t border-[#1e293b] flex items-center justify-between text-[11px] text-slate-500">
              <span className="flex items-center gap-1.5">
                <Building2 size={13} className="text-slate-400" /> NIC Secured Server
              </span>
              <span>LMPC Sec 15 Authorization</span>
            </div>
          </div>
        </div>

      </main>

      {/* ── Official Footer ── */}
      <footer className="border-t border-[#1e293b] bg-[#070b14] py-4 text-center text-xs text-slate-500 font-mono">
        © {new Date().getFullYear()} METRA · Legal Metrology Platform · Government of India · All Rights Reserved
      </footer>
    </div>
  );
}
