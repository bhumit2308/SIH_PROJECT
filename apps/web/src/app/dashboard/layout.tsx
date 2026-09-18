'use client';
import { useEffect, ReactNode } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { AuthProvider, useAuth } from '@/lib/auth';
import {
  Scale, LayoutDashboard, ClipboardList, CircleCheck,
  Settings, LogOut, ChevronRight, Bell, User, Shield
} from 'lucide-react';

const navItems = [
  { href: '/dashboard', icon: LayoutDashboard, label: 'Dashboard', roles: ['INSPECTOR','SUPERVISOR','ADMIN','MANUFACTURER'] },
  { href: '/dashboard/inspections', icon: ClipboardList, label: 'Inspections', roles: ['INSPECTOR','SUPERVISOR','ADMIN','MANUFACTURER'] },
  { href: '/dashboard/reviews', icon: CircleCheck, label: 'Review Queue', roles: ['INSPECTOR','SUPERVISOR','ADMIN'] },
  { href: '/dashboard/admin', icon: Settings, label: 'Admin', roles: ['ADMIN'] },
];

function Sidebar() {
  const { user, logout, hasRole } = useAuth();
  const pathname = usePathname();
  const router = useRouter();

  const handleLogout = () => { logout(); router.push('/'); };
  const initials = user?.full_name?.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) ?? 'U';

  const visibleNav = navItems.filter(n => n.roles.some(r => hasRole(r)));

  return (
    <div className="sidebar">
      {/* Logo */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem', marginBottom: '2rem', padding: '0 0.25rem' }}>
        <div style={{
          width: '36px', height: '36px', borderRadius: '10px',
          background: 'linear-gradient(135deg, #6366f1, #818cf8)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: '0 0 15px rgba(99,102,241,0.35)', flexShrink: 0,
        }}>
          <Scale size={20} color="white" />
        </div>
        <div>
          <div style={{ fontWeight: 800, fontSize: '1rem', letterSpacing: '-0.02em' }}>METRA</div>
          <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', lineHeight: 1 }}>Legal Metrology</div>
        </div>
      </div>

      {/* Nav */}
      <nav style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', flex: 1 }}>
        {visibleNav.map(item => {
          const active = pathname === item.href || pathname.startsWith(item.href + '/');
          return (
            <Link key={item.href} href={item.href} className={`nav-item ${active ? 'active' : ''}`}>
              <item.icon size={17} />
              {item.label}
              {active && <ChevronRight size={14} style={{ marginLeft: 'auto', opacity: 0.6 }} />}
            </Link>
          );
        })}
      </nav>

      {/* User Profile */}
      <div style={{
        marginTop: 'auto', paddingTop: '1rem',
        borderTop: '1px solid var(--border)',
        display: 'flex', flexDirection: 'column', gap: '0.5rem',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.5rem 0.25rem' }}>
          <div style={{
            width: '34px', height: '34px', borderRadius: '50%',
            background: 'linear-gradient(135deg, #6366f1, #10b981)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontWeight: 700, fontSize: '0.75rem', color: 'white', flexShrink: 0,
          }}>{initials}</div>
          <div style={{ overflow: 'hidden' }}>
            <div style={{ fontSize: '0.8rem', fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {user?.full_name ?? user?.email}
            </div>
            <div style={{ display: 'flex', gap: '0.25rem', flexWrap: 'wrap', marginTop: '0.1rem' }}>
              {user?.roles.map(r => (
                <span key={r} className="badge badge-info" style={{ fontSize: '0.6rem', padding: '0.05rem 0.35rem' }}>{r}</span>
              ))}
            </div>
          </div>
        </div>
        <button className="nav-item btn-ghost" onClick={handleLogout} style={{ width: '100%', background: 'none', border: 'none', color: 'var(--text-muted)' }}>
          <LogOut size={15} />
          Sign Out
        </button>
      </div>
    </div>
  );
}

function ProtectedLayout({ children }: { children: ReactNode }) {
  const { user, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && !user) router.push('/');
  }, [user, isLoading, router]);

  if (isLoading) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ textAlign: 'center', color: 'var(--text-muted)' }}>
        <Scale size={32} style={{ margin: '0 auto 1rem', display: 'block', color: 'var(--accent)' }} />
        <p>Loading METRA…</p>
      </div>
    </div>
  );

  if (!user) return null;

  return (
    <div className="app-layout">
      <Sidebar />
      <div className="main-content">
        {children}
      </div>
    </div>
  );
}

export default function DashboardLayout({ children }: { children: ReactNode }) {
  return <ProtectedLayout>{children}</ProtectedLayout>;
}
