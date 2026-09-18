'use client';
import { useState, FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import { Shield, Eye, EyeOff, AlertCircle, Loader2, Scale } from 'lucide-react';

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
      setError(err instanceof Error ? err.message : 'Login failed. Check credentials.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: '100vh',
      background: 'var(--bg-primary)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '2rem',
      position: 'relative',
      overflow: 'hidden',
    }}>
      {/* Background glow effects */}
      <div style={{
        position: 'absolute', top: '-200px', left: '50%', transform: 'translateX(-50%)',
        width: '600px', height: '600px',
        background: 'radial-gradient(circle, rgba(99,102,241,0.15) 0%, transparent 70%)',
        pointerEvents: 'none',
      }} />
      <div style={{
        position: 'absolute', bottom: '-200px', right: '-100px',
        width: '500px', height: '500px',
        background: 'radial-gradient(circle, rgba(16,185,129,0.08) 0%, transparent 70%)',
        pointerEvents: 'none',
      }} />

      <div className="glass animate-fade" style={{ width: '100%', maxWidth: '420px', padding: '2.5rem' }}>
        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <div style={{
            width: '64px', height: '64px', borderRadius: '18px',
            background: 'linear-gradient(135deg, #6366f1, #818cf8)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto 1rem',
            boxShadow: '0 0 30px rgba(99,102,241,0.4)',
          }}>
            <Scale size={32} color="white" />
          </div>
          <h1 style={{ fontSize: '1.75rem', fontWeight: 800, letterSpacing: '-0.02em', marginBottom: '0.25rem' }}>
            METRA
          </h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.825rem' }}>
            Legal Metrology Inspection System
          </p>
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: '0.375rem',
            marginTop: '0.625rem',
            padding: '0.25rem 0.75rem',
            background: 'rgba(99,102,241,0.1)',
            border: '1px solid rgba(99,102,241,0.2)',
            borderRadius: '9999px',
            fontSize: '0.7rem', color: 'var(--accent-light)', fontWeight: 600,
          }}>
            <Shield size={11} />
            LMPC Rules 2011 · SIH26034
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div>
            <label className="label">Email Address</label>
            <input
              className="input"
              type="email"
              id="login-email"
              placeholder="officer@metra.gov.in"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
              autoComplete="email"
            />
          </div>

          <div>
            <label className="label">Password</label>
            <div style={{ position: 'relative' }}>
              <input
                className="input"
                type={showPwd ? 'text' : 'password'}
                id="login-password"
                placeholder="••••••••"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                autoComplete="current-password"
                style={{ paddingRight: '2.75rem' }}
              />
              <button
                type="button"
                onClick={() => setShowPwd(!showPwd)}
                style={{
                  position: 'absolute', right: '0.875rem', top: '50%', transform: 'translateY(-50%)',
                  background: 'none', border: 'none', cursor: 'pointer',
                  color: 'var(--text-muted)', padding: '0',
                }}
              >
                {showPwd ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          {error && (
            <div className="alert alert-error" style={{ fontSize: '0.825rem' }}>
              <AlertCircle size={16} style={{ flexShrink: 0, marginTop: '1px' }} />
              {error}
            </div>
          )}

          <button
            className="btn btn-primary btn-lg"
            type="submit"
            id="login-submit"
            disabled={loading}
            style={{ marginTop: '0.5rem', justifyContent: 'center' }}
          >
            {loading ? (
              <><Loader2 size={18} className="animate-spin" /> Signing in…</>
            ) : (
              <><Shield size={18} /> Sign In Securely</>
            )}
          </button>
        </form>

        {/* Demo hints */}
        <div style={{
          marginTop: '1.5rem',
          padding: '1rem',
          background: 'rgba(99,102,241,0.06)',
          border: '1px solid rgba(99,102,241,0.15)',
          borderRadius: '10px',
          fontSize: '0.775rem',
          color: 'var(--text-muted)',
        }}>
          <p style={{ fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>
            Demo Accounts
          </p>
          {[
            { email: 'inspector@metra.demo', role: 'Inspector' },
            { email: 'supervisor@metra.demo', role: 'Supervisor' },
            { email: 'admin@metra.demo', role: 'Admin' },
          ].map(u => (
            <div key={u.email} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.2rem' }}>
              <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.7rem' }}>{u.email}</span>
              <span className="badge badge-info" style={{ fontSize: '0.65rem', padding: '0.1rem 0.4rem' }}>{u.role}</span>
            </div>
          ))}
        </div>

        <p style={{ textAlign: 'center', marginTop: '1rem', fontSize: '0.72rem', color: 'var(--text-muted)' }}>
          Ministry of Consumer Affairs · Government of India
        </p>
      </div>
    </div>
  );
}
