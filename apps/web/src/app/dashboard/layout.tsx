'use client';
import { useEffect, useState, ReactNode } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { useAuth } from '@/lib/auth';
import {
  Scale, LayoutDashboard, ClipboardList, CircleCheck,
  Settings, LogOut, ChevronRight, Bell, Shield, Archive,
  Search, Radio, Clock
} from 'lucide-react';

const navItems = [
  { href: '/dashboard', icon: LayoutDashboard, label: 'Command Center', badge: 'LIVE', roles: ['INSPECTOR','SUPERVISOR','ADMIN','MANUFACTURER'] },
  { href: '/dashboard/inspections', icon: ClipboardList, label: 'Inspections & Audits', roles: ['INSPECTOR','SUPERVISOR','ADMIN','MANUFACTURER'] },
  { href: '/dashboard/reports', icon: Archive, label: 'Statutory Reports', roles: ['INSPECTOR','SUPERVISOR','ADMIN','MANUFACTURER'] },
  { href: '/dashboard/reviews', icon: CircleCheck, label: 'Review Queue', badge: '§48', roles: ['INSPECTOR','SUPERVISOR','ADMIN'] },
  { href: '/dashboard/admin', icon: Settings, label: 'Administration', roles: ['ADMIN'] },
];

function Sidebar() {
  const { user, logout, hasRole } = useAuth();
  const pathname = usePathname();
  const router = useRouter();

  const handleLogout = () => { logout(); router.push('/'); };
  const initials = user?.full_name?.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) ?? 'LM';

  const visibleNav = navItems.filter(n => n.roles.some(r => hasRole(r)));

  return (
    <aside className="w-64 min-h-screen bg-[#0a0f1d] border-r border-[#1e293b] flex flex-col shrink-0">
      {/* ── Official Branding Header ── */}
      <div className="p-4 border-b border-[#1e293b] flex items-center gap-3">
        <div className="w-9 h-9 relative rounded-lg bg-[#121a2d] border border-[#1e293b] p-1.5 flex items-center justify-center shrink-0">
          <Image
            src="/metra_seal_logo.svg"
            alt="METRA Insignia"
            width={28}
            height={28}
            className="object-contain"
          />
        </div>
        <div className="flex flex-col">
          <div className="flex items-center gap-1.5">
            <span className="font-bold text-sm text-white tracking-wide">METRA</span>
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 font-mono">
              OFFICIAL
            </span>
          </div>
          <span className="text-[10px] text-slate-400 font-mono">Legal Metrology Grid</span>
        </div>
      </div>

      {/* ── Status Chip ── */}
      <div className="px-4 py-2.5 bg-[#070b14] border-b border-[#1e293b] flex items-center justify-between text-[11px] font-mono">
        <span className="text-slate-400 flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
          GRID: DL-CENTRAL
        </span>
        <span className="text-indigo-400 font-semibold">SECURE</span>
      </div>

      {/* ── Navigation Links ── */}
      <nav className="p-3 flex-1 flex flex-col gap-1">
        <div className="px-2 py-1 text-[10px] font-mono font-semibold uppercase tracking-wider text-slate-500">
          Operations & Control
        </div>
        {visibleNav.map(item => {
          const active = pathname === item.href || (item.href !== '/dashboard' && pathname.startsWith(item.href));
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium transition-all ${
                active
                  ? 'bg-indigo-600/15 text-indigo-300 border border-indigo-500/30 font-semibold'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-[#131d33]'
              }`}
            >
              <item.icon size={16} className={active ? 'text-indigo-400' : 'text-slate-500'} />
              <span>{item.label}</span>
              {item.badge && (
                <span className="ml-auto text-[9px] font-mono font-semibold px-1.5 py-0.5 rounded bg-[#1e293b] text-slate-300">
                  {item.badge}
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      {/* ── Officer Identity Card & Sign Out ── */}
      <div className="p-3 border-t border-[#1e293b] bg-[#070b14]/70 space-y-2">
        <div className="flex items-center gap-2.5 p-2 rounded-lg bg-[#0e1628] border border-[#1e293b]">
          <div className="w-8 h-8 rounded-full overflow-hidden relative shrink-0 border border-indigo-500/30">
            <Image
              src="/inspector_headshot.png"
              alt="Officer Photo"
              width={32}
              height={32}
              className="object-cover"
            />
          </div>
          <div className="overflow-hidden">
            <div className="text-xs font-semibold text-slate-200 truncate">
              {user?.full_name ?? user?.email ?? 'Enforcement Officer'}
            </div>
            <div className="text-[10px] font-mono text-slate-400 truncate">
              ID: LM-{user?.id?.slice(0, 6).toUpperCase() || '8842-DL'}
            </div>
          </div>
        </div>

        <button
          onClick={handleLogout}
          className="w-full flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-md text-[11px] text-slate-400 hover:text-rose-400 hover:bg-rose-950/20 border border-transparent hover:border-rose-800/30 transition-all font-mono"
        >
          <LogOut size={13} />
          <span>Sign Out of Terminal</span>
        </button>
      </div>
    </aside>
  );
}

function ProtectedLayout({ children }: { children: ReactNode }) {
  const { user, isLoading } = useAuth();
  const router = useRouter();
  const [time, setTime] = useState<string>('');

  useEffect(() => {
    if (!isLoading && !user) router.push('/');
  }, [user, isLoading, router]);

  useEffect(() => {
    const update = () => {
      const now = new Date();
      setTime(now.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }) + ' IST');
    };
    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, []);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#070b14] flex items-center justify-center text-slate-400 font-mono text-xs">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-2 border-indigo-500/30 border-t-indigo-500 rounded-full animate-spin"></div>
          <span>Loading Legal Metrology Platform…</span>
        </div>
      </div>
    );
  }

  if (!user) return null;

  return (
    <div className="min-h-screen bg-[#070b14] text-[#f1f5f9] flex flex-col">
      {/* ── National Tri-color Ribbon ── */}
      <div className="w-full h-[3px] flex sticky top-0 z-50">
        <span className="flex-1 bg-[#FF9933]"></span>
        <span className="flex-1 bg-[#FFFFFF]"></span>
        <span className="flex-1 bg-[#138808]"></span>
      </div>

      <div className="flex flex-1 min-h-screen">
        <Sidebar />

        <div className="flex-1 flex flex-col min-w-0">
          {/* ── Institutional Top Bar ── */}
          <header className="h-14 border-b border-[#1e293b] bg-[#0c1220]/90 backdrop-blur-md px-6 flex items-center justify-between sticky top-[3px] z-40">
            <div className="flex items-center gap-3">
              <span className="text-xs font-semibold text-slate-300">
                National Statutory Metrology Console
              </span>
              <span className="text-slate-600">/</span>
              <span className="text-xs font-mono text-indigo-400">
                Rule 6 Enforcement Engine
              </span>
            </div>

            <div className="flex items-center gap-4 text-xs font-mono">
              <div className="hidden md:flex items-center gap-1.5 px-2.5 py-1 rounded bg-[#131d33] border border-[#1e293b] text-slate-300">
                <Clock size={13} className="text-indigo-400" />
                <span>{time || '18:00:00 IST'}</span>
              </div>
              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-emerald-950/50 border border-emerald-800/40 text-emerald-400">
                <Radio size={13} />
                <span className="text-[11px]">Synced: CCA Database</span>
              </div>
            </div>
          </header>

          {/* ── Main Content Area ── */}
          <main className="flex-1 p-6 lg:p-8 max-w-7xl w-full mx-auto">
            {children}
          </main>
        </div>
      </div>
    </div>
  );
}

export default function DashboardLayout({ children }: { children: ReactNode }) {
  return <ProtectedLayout>{children}</ProtectedLayout>;
}
