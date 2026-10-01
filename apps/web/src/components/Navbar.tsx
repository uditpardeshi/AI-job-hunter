'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  Briefcase,
  Layers,
  FileText,
  Sparkles,
  Mail,
  Sliders,
  Settings,
  Bot,
  CheckSquare,
  LogOut,
  Menu,
  X,
  ExternalLink,
} from 'lucide-react';

export function Navbar() {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  const primaryNav = [
    { label: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
    { label: 'Jobs', href: '/jobs', icon: Briefcase },
    { label: 'Applications', href: '/applications', icon: Layers },
    { label: 'Approvals', href: '/approvals', icon: CheckSquare },
    { label: 'Inbox', href: '/emails', icon: Mail },
    { label: 'Profile & Resume', href: '/resume', icon: FileText },
  ];

  const configNav = [
    { label: 'Automation', href: '/automation', icon: Bot },
    { label: 'Rules & Filters', href: '/settings/automation', icon: Sliders },
    { label: 'Integrations', href: '/settings/integrations', icon: Settings },
  ];

  const handleLogout = async () => {
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
    try {
      await fetch(`${apiUrl}/api/auth/logout`, { method: 'POST', credentials: 'include' });
    } catch (_) {}
    if (typeof window !== 'undefined') {
      localStorage.removeItem('auth_token');
      window.location.href = '/login';
    }
  };

  const NavItem = ({
    item,
    isConfig = false,
  }: {
    item: { label: string; href: string; icon: React.ComponentType<{ className?: string }> };
    isConfig?: boolean;
  }) => {
    const Icon = item.icon;
    const isActive =
      pathname === item.href || (item.href !== '/dashboard' && pathname.startsWith(item.href));

    return (
      <Link
        href={item.href}
        onClick={() => setMobileOpen(false)}
        className={`group flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-semibold transition-all duration-150 ${
          isActive
            ? isConfig
              ? 'bg-indigo-500/15 text-indigo-300 font-bold border border-indigo-500/30 shadow-sm shadow-indigo-950/40'
              : 'bg-sky-500/15 text-sky-300 font-bold border border-sky-500/30 shadow-sm shadow-sky-950/40'
            : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/90'
        }`}
      >
        <Icon
          className={`w-4 h-4 shrink-0 transition-transform group-hover:scale-110 ${
            isActive ? (isConfig ? 'text-indigo-400' : 'text-sky-400') : 'text-slate-400 group-hover:text-slate-200'
          }`}
        />
        <span className="truncate">{item.label}</span>
        {isActive && (
          <span
            className={`ml-auto w-1.5 h-1.5 rounded-full ${
              isConfig ? 'bg-indigo-400' : 'bg-sky-400 animate-pulse'
            }`}
          />
        )}
      </Link>
    );
  };

  return (
    <>
      {/* ======================================================== */}
      {/* MOBILE TOP BAR (Screens < lg)                             */}
      {/* ======================================================== */}
      <div className="lg:hidden sticky top-0 z-50 flex items-center justify-between px-4 py-3 bg-slate-950/90 border-b border-slate-800/80 backdrop-blur-xl">
        <Link href="/dashboard" className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-gradient-to-tr from-sky-500 via-indigo-500 to-purple-600 flex items-center justify-center shadow-md shadow-sky-500/20">
            <Sparkles className="w-3.5 h-3.5 text-white" />
          </div>
          <span className="font-extrabold text-sm tracking-tight text-slate-100">AI Job Hunter</span>
          <span className="px-1.5 py-0.5 rounded text-[9px] font-mono font-bold uppercase tracking-wider bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            PROD
          </span>
        </Link>

        <button
          onClick={() => setMobileOpen(!mobileOpen)}
          className="p-2 rounded-xl text-slate-400 hover:text-slate-100 hover:bg-slate-900 border border-slate-800 transition-colors"
          aria-label="Toggle navigation menu"
        >
          {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
      </div>

      {/* MOBILE BACKDROP & DRAWER */}
      {mobileOpen && (
        <div className="lg:hidden fixed inset-0 z-50 flex">
          <div
            className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm transition-opacity"
            onClick={() => setMobileOpen(false)}
          />
          <div className="relative w-72 max-w-[80vw] bg-slate-950 border-r border-slate-800 p-4 flex flex-col justify-between h-full z-10 overflow-y-auto">
            <div className="space-y-6">
              <div className="flex items-center justify-between pb-3 border-b border-slate-800/80">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-gradient-to-tr from-sky-500 via-indigo-500 to-purple-600 flex items-center justify-center shadow-md shadow-sky-500/20">
                    <Sparkles className="w-3.5 h-3.5 text-white" />
                  </div>
                  <span className="font-extrabold text-sm tracking-tight text-slate-100">AI Job Hunter</span>
                </div>
                <button
                  onClick={() => setMobileOpen(false)}
                  className="p-1 rounded-lg text-slate-400 hover:text-slate-100"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Navigation items */}
              <div className="space-y-4">
                <div>
                  <div className="px-2 mb-2 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    Workflow
                  </div>
                  <nav className="space-y-1">
                    {primaryNav.map((item) => (
                      <NavItem key={item.href} item={item} />
                    ))}
                  </nav>
                </div>

                <div>
                  <div className="px-2 mb-2 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    System & Settings
                  </div>
                  <nav className="space-y-1">
                    {configNav.map((item) => (
                      <NavItem key={item.href} item={item} isConfig />
                    ))}
                  </nav>
                </div>
              </div>
            </div>

            {/* Bottom Actions */}
            <div className="pt-4 border-t border-slate-800/80 space-y-2">
              <button
                onClick={handleLogout}
                className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold text-rose-400 hover:bg-rose-500/10 border border-transparent hover:border-rose-500/20 transition-all"
              >
                <LogOut className="w-4 h-4" />
                <span>Sign Out</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* DESKTOP FIXED LEFT SIDEBAR (Screens >= lg)                */}
      {/* ======================================================== */}
      <aside className="app-sidebar hidden lg:flex fixed top-0 left-0 bottom-0 w-60 z-40 flex-col justify-between bg-slate-950/95 border-r border-slate-800/80 backdrop-blur-2xl">
        <div className="flex flex-col flex-1 overflow-y-auto p-4 space-y-6">
          {/* Logo & Brand */}
          <div className="flex items-center justify-between pb-4 border-b border-slate-800/60">
            <Link href="/dashboard" className="flex items-center gap-2.5 group">
              <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-sky-500 via-indigo-500 to-purple-600 flex items-center justify-center shadow-lg shadow-sky-500/20 group-hover:scale-105 transition-transform">
                <Sparkles className="w-4 h-4 text-white" />
              </div>
              <div className="flex flex-col">
                <span className="font-black text-sm tracking-tight text-slate-100 group-hover:text-sky-400 transition-colors">
                  AI Job Hunter
                </span>
                <span className="text-[10px] font-medium text-slate-400">Career Assistant</span>
              </div>
            </Link>
            <span className="px-1.5 py-0.5 rounded text-[9px] font-mono font-bold uppercase tracking-wider bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              PROD
            </span>
          </div>

          {/* Primary Navigation */}
          <div className="space-y-1.5">
            <div className="px-2.5 text-[10px] font-bold uppercase tracking-wider text-slate-400">
              Workflow
            </div>
            <nav className="space-y-1">
              {primaryNav.map((item) => (
                <NavItem key={item.href} item={item} />
              ))}
            </nav>
          </div>

          {/* Configuration Navigation */}
          <div className="space-y-1.5 pt-2">
            <div className="px-2.5 text-[10px] font-bold uppercase tracking-wider text-slate-400">
              System & Automation
            </div>
            <nav className="space-y-1">
              {configNav.map((item) => (
                <NavItem key={item.href} item={item} isConfig />
              ))}
            </nav>
          </div>
        </div>

        {/* Sidebar Footer with Status & Sign Out */}
        <div className="p-3 border-t border-slate-800/80 bg-slate-950/60 flex flex-col gap-2">
          {/* Quick system heartbeat pill */}
          <div className="px-3 py-2 rounded-xl bg-slate-900/80 border border-slate-800 flex items-center justify-between text-[11px]">
            <span className="text-slate-400 flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              API Services
            </span>
            <span className="font-mono text-emerald-400 text-[10px]">ACTIVE</span>
          </div>

          {/* Logout Button */}
          <button
            onClick={handleLogout}
            title="Sign out of system"
            className="w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 border border-transparent hover:border-rose-500/20 transition-all"
          >
            <span className="flex items-center gap-2">
              <LogOut className="w-4 h-4 text-slate-500 group-hover:text-rose-400" />
              <span>Sign Out</span>
            </span>
            <span className="text-[10px] text-slate-400">exit</span>
          </button>
        </div>
      </aside>
    </>
  );
}

export default Navbar;
