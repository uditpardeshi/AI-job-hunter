'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  Briefcase,
  Layers,
  FileText,
  Activity,
  Sparkles,
  Mail,
  Settings,
  Bot,
  CheckSquare,
} from 'lucide-react';

export function Navbar() {
  const pathname = usePathname();

  const navItems = [
    { label: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
    { label: 'Automation', href: '/automation', icon: Bot },
    { label: 'Approvals', href: '/approvals', icon: CheckSquare },
    { label: 'Job Board', href: '/jobs', icon: Briefcase },
    { label: 'Applications', href: '/applications', icon: Layers },
    { label: 'Inbox', href: '/emails', icon: Mail },
    { label: 'Profile', href: '/resume', icon: FileText },
    { label: 'Automation Config', href: '/settings/automation', icon: Settings },
    { label: 'Integrations', href: '/settings/integrations', icon: Sparkles },
  ];

  return (
    <header className="border-b border-slate-800 bg-slate-900/90 backdrop-blur-md sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
        {/* Brand Logo */}
        <Link href="/dashboard" className="flex items-center gap-2.5 group">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-sky-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-sky-500/20 group-hover:scale-105 transition-transform">
            <Sparkles className="w-5 h-5 text-white" />
          </div>
          <div>
            <span className="font-extrabold text-sm sm:text-base tracking-tight text-slate-100 block">
              AI Job Hunter
            </span>
            <span className="text-[10px] text-slate-400 font-medium block -mt-0.5">
              Workspace & Tracker
            </span>
          </div>
        </Link>

        {/* Navigation Links */}
        <nav className="flex items-center gap-1 sm:gap-2">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive =
              item.href === '/' ? pathname === '/' : pathname.startsWith(item.href);

            return (
              <Link
                key={item.href}
                href={item.href}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                  isActive
                    ? 'bg-sky-500/10 text-sky-400 border border-sky-500/20 shadow-sm'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span className="hidden md:inline">{item.label}</span>
              </Link>
            );
          })}

          <button
            onClick={async () => {
              const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
              try {
                await fetch(`${apiUrl}/api/auth/logout`, { method: 'POST', credentials: 'include' });
              } catch (_) {}
              if (typeof window !== 'undefined') {
                localStorage.removeItem('auth_token');
                window.location.href = '/login';
              }
            }}
            title="Sign out"
            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-semibold text-slate-500 hover:text-red-400 hover:bg-red-500/10 transition-colors ml-1"
          >
            <span className="hidden sm:inline">Logout</span>
          </button>
        </nav>
      </div>
    </header>
  );
}

export default Navbar;
