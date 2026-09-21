'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  Briefcase,
  Layers,
  CheckCircle2,
  Clock,
  Calendar,
  AlertCircle,
  TrendingUp,
  Award,
  Sparkles,
  ArrowRight,
  RefreshCw,
  ExternalLink,
  ChevronRight,
  Bookmark,
  Send,
  UserCheck,
  XCircle,
  Bell,
  MapPin,
  Building2,
  FileText,
  Mail,
  Bot,
  AlertOctagon,
  ShieldCheck,
  CheckSquare,
} from 'lucide-react';
import { Navbar } from '@/components/Navbar';
import { DashboardData, ApplicationStatus, EmailMessage, AutomationSummary } from '@ai-job-hunter/shared';

export default function DashboardPage() {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

  const [data, setData] = useState<DashboardData | null>(null);
  const [automationSummary, setAutomationSummary] = useState<AutomationSummary | null>(null);
  const [recentEmails, setRecentEmails] = useState<EmailMessage[]>([]);
  const [gmailConnected, setGmailConnected] = useState<boolean>(false);
  const [isSyncingGmail, setIsSyncingGmail] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  const loadDashboard = async () => {
    try {
      const res = await fetch(`${apiUrl}/api/dashboard`, { cache: 'no-store' });
      if (!res.ok) {
        throw new Error(`Failed to load dashboard data (HTTP ${res.status})`);
      }
      const json = await res.json();
      setData(json.data);

      try {
        const [emailRes, gmailRes, autoRes] = await Promise.all([
          fetch(`${apiUrl}/api/emails?limit=4`, { cache: 'no-store' }),
          fetch(`${apiUrl}/api/integrations/gmail`, { cache: 'no-store' }),
          fetch(`${apiUrl}/api/automation/summary`, { cache: 'no-store' }),
        ]);
        if (emailRes.ok) {
          const ej = await emailRes.json();
          setRecentEmails(ej.data || []);
        }
        if (gmailRes.ok) {
          const gj = await gmailRes.json();
          setGmailConnected(gj.data?.connected || false);
        }
        if (autoRes.ok) {
          const aj = await autoRes.json();
          if (aj.success) setAutomationSummary(aj.data);
        }
      } catch (subErr) {
        console.warn('Dashboard secondary fetches non-fatal error:', subErr);
      }
    } catch (err: any) {
      setError(err.message || 'Error loading dashboard data');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  const handleQuickSync = async () => {
    setIsSyncingGmail(true);
    try {
      const res = await fetch(`${apiUrl}/api/integrations/gmail/sync`, { method: 'POST' });
      const json = await res.json();
      if (res.ok) {
        setActionSuccess(`Inbox synchronized (${json.data?.newCount ?? 0} new messages).`);
        setTimeout(() => setActionSuccess(null), 3500);
        loadDashboard();
      }
    } catch (err: any) {
      alert(err.message);
    } finally {
      setIsSyncingGmail(false);
    }
  };

  useEffect(() => {
    loadDashboard();
  }, [apiUrl]);

  const handleRefresh = () => {
    setIsRefreshing(true);
    loadDashboard();
  };

  const handleQuickSaveJob = async (jobId: string, status: ApplicationStatus = 'SAVED') => {
    try {
      const res = await fetch(`${apiUrl}/api/applications`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jobId, status }),
      });
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error || 'Failed to save job');
      }
      setActionSuccess(`Job added to ${status.toLowerCase()} applications!`);
      setTimeout(() => setActionSuccess(null), 3500);
      loadDashboard();
    } catch (err: any) {
      alert(err.message);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
        <Navbar />
        <div className="flex-1 flex items-center justify-center p-6">
          <div className="text-center space-y-3">
            <div className="w-8 h-8 border-2 border-sky-400 border-t-transparent rounded-full animate-spin mx-auto"></div>
            <p className="text-xs text-slate-400">Loading Job Search Dashboard...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
        <Navbar />
        <div className="flex-1 flex flex-col items-center justify-center p-6 space-y-4">
          <AlertCircle className="w-12 h-12 text-rose-400" />
          <h2 className="text-xl font-bold text-slate-200">{error || 'Dashboard unavailable'}</h2>
          <button
            onClick={loadDashboard}
            className="px-4 py-2 rounded-xl bg-slate-900 border border-slate-800 text-xs font-semibold text-slate-300 hover:bg-slate-800 transition-colors"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  const { stats, recentApplications, upcomingFollowUps, recentJobs, analytics } = data;

  const kpis: Array<{
    label: string;
    count: number;
    icon: React.ReactNode;
    color: string;
    border: string;
    href: string;
  }> = [
    {
      label: 'Jobs Found',
      count: stats.jobsFound,
      icon: <Briefcase className="w-4 h-4 text-sky-400" />,
      color: 'text-sky-400 bg-sky-500/10',
      border: 'border-sky-500/20',
      href: '/jobs',
    },
    {
      label: 'Saved',
      count: stats.saved,
      icon: <Bookmark className="w-4 h-4 text-slate-300" />,
      color: 'text-slate-300 bg-slate-800/80',
      border: 'border-slate-700',
      href: '/applications?status=SAVED',
    },
    {
      label: 'Shortlisted',
      count: stats.shortlisted,
      icon: <Sparkles className="w-4 h-4 text-indigo-400" />,
      color: 'text-indigo-400 bg-indigo-500/10',
      border: 'border-indigo-500/20',
      href: '/applications?status=SHORTLISTED',
    },
    {
      label: 'Ready to Apply',
      count: stats.ready,
      icon: <CheckCircle2 className="w-4 h-4 text-teal-400" />,
      color: 'text-teal-400 bg-teal-500/10',
      border: 'border-teal-500/20',
      href: '/applications?status=READY',
    },
    {
      label: 'Applied',
      count: stats.applied,
      icon: <Send className="w-4 h-4 text-amber-400" />,
      color: 'text-amber-400 bg-amber-500/10',
      border: 'border-amber-500/20',
      href: '/applications?status=APPLIED',
    },
    {
      label: 'Interviews',
      count: stats.interviews,
      icon: <UserCheck className="w-4 h-4 text-purple-400" />,
      color: 'text-purple-400 bg-purple-500/10',
      border: 'border-purple-500/20',
      href: '/applications?status=INTERVIEW',
    },
    {
      label: 'Offers',
      count: stats.offers,
      icon: <Award className="w-4 h-4 text-emerald-400" />,
      color: 'text-emerald-400 bg-emerald-500/10',
      border: 'border-emerald-500/20',
      href: '/applications?status=OFFER',
    },
    {
      label: 'Rejected',
      count: stats.rejected,
      icon: <XCircle className="w-4 h-4 text-rose-400" />,
      color: 'text-rose-400 bg-rose-500/10',
      border: 'border-rose-500/20',
      href: '/applications?status=REJECTED',
    },
  ];

  const getStatusBadge = (status: ApplicationStatus) => {
    switch (status) {
      case 'SAVED':
        return 'bg-slate-800 text-slate-300 border-slate-700';
      case 'SHORTLISTED':
        return 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20';
      case 'READY':
        return 'bg-teal-500/10 text-teal-400 border-teal-500/20';
      case 'APPLIED':
        return 'bg-amber-500/10 text-amber-400 border-amber-500/20';
      case 'INTERVIEW':
        return 'bg-purple-500/10 text-purple-400 border-purple-500/20';
      case 'OFFER':
        return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20';
      case 'REJECTED':
        return 'bg-rose-500/10 text-rose-400 border-rose-500/20';
      case 'WITHDRAWN':
        return 'bg-slate-900 text-slate-500 border-slate-800';
      default:
        return 'bg-slate-800 text-slate-300 border-slate-700';
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
      <Navbar />

      <main className="flex-1 max-w-7xl mx-auto px-4 sm:px-6 py-8 w-full space-y-8">
        {/* Banner Alert if action succeeded */}
        {actionSuccess && (
          <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs flex items-center gap-2 shadow-lg">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>{actionSuccess}</span>
          </div>
        )}

        {/* Dashboard Title & Quick Actions */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-sky-400">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Job Search Workspace</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-100">
              Application Tracker & Dashboard
            </h1>
            <p className="text-xs text-slate-400">
              Track opportunities, stage transitions, materials, and follow-ups across your job hunt.
            </p>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              onClick={handleRefresh}
              disabled={isRefreshing}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800 text-xs font-semibold transition-all disabled:opacity-50 shadow-sm"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
              <span>{isRefreshing ? 'Refreshing...' : 'Refresh'}</span>
            </button>

            <Link
              href="/jobs"
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-gradient-to-r from-sky-600 to-indigo-600 hover:from-sky-500 hover:to-indigo-500 text-white text-xs font-semibold shadow-lg shadow-sky-600/20 transition-all"
            >
              <span>Explore Jobs</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>

        {/* Automation & Approvals Notification Banner */}
        {automationSummary && (
          <div className="space-y-3">
            {automationSummary.settings.killSwitchActive && (
              <div className="p-4 rounded-2xl bg-red-500/15 border border-red-500/30 text-red-300 text-xs sm:text-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-lg">
                <div className="flex items-center gap-2.5">
                  <AlertOctagon className="w-5 h-5 text-red-400 shrink-0 animate-pulse" />
                  <span><strong>EMERGENCY KILL SWITCH ENGAGED.</strong> All background automation is paused.</span>
                </div>
                <Link
                  href="/automation"
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-red-600 hover:bg-red-500 text-white font-bold text-xs transition-colors shrink-0"
                >
                  Manage Kill Switch <ChevronRight className="w-3.5 h-3.5" />
                </Link>
              </div>
            )}

            {automationSummary.todayStats.pendingApprovals > 0 && (
              <div className="p-4 rounded-2xl bg-gradient-to-r from-amber-500/15 via-orange-500/10 to-amber-500/5 border border-amber-500/30 text-amber-200 text-xs sm:text-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-md">
                <div className="flex items-center gap-2.5">
                  <CheckSquare className="w-5 h-5 text-amber-400 shrink-0" />
                  <span><strong>{automationSummary.todayStats.pendingApprovals} Application{automationSummary.todayStats.pendingApprovals === 1 ? '' : 's'} Pending Approval:</strong> Review materials & confirm questions.</span>
                </div>
                <Link
                  href="/approvals"
                  className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs transition-colors shrink-0 shadow-sm"
                >
                  Review Approvals <ChevronRight className="w-3.5 h-3.5" />
                </Link>
              </div>
            )}

            <div className="p-3.5 rounded-2xl bg-slate-900/50 border border-slate-800 text-xs flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-3">
                <div className="flex items-center gap-2">
                  <Bot className="w-4 h-4 text-sky-400" />
                  <span className="font-bold text-slate-200">AI Autonomous Hunter:</span>
                  <span
                    className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                      automationSummary.settings.killSwitchActive
                        ? 'bg-red-500/10 border-red-500/20 text-red-400'
                        : automationSummary.settings.automationEnabled
                        ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
                        : 'bg-slate-800 border-slate-700 text-slate-400'
                    }`}
                  >
                    {automationSummary.settings.killSwitchActive
                      ? 'PAUSED'
                      : automationSummary.settings.automationEnabled
                      ? 'ACTIVE'
                      : 'ASSISTED'}
                  </span>
                </div>
                <span className="text-slate-500 hidden sm:inline">•</span>
                <span className="text-slate-400">
                  Today: <strong className="text-slate-200">{automationSummary.todayStats.jobsDiscovered}</strong> discovered,{' '}
                  <strong className="text-emerald-400">{automationSummary.todayStats.jobsShortlisted}</strong> shortlisted,{' '}
                  <strong className="text-cyan-400">{automationSummary.todayStats.applicationsSubmitted}</strong> submitted
                </span>
              </div>
              <Link
                href="/automation"
                className="text-xs font-semibold text-sky-400 hover:text-sky-300 flex items-center gap-1"
              >
                Automation Hub <ChevronRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          </div>
        )}

        {/* KPI Summary Cards Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3">
          {kpis.map((kpi, idx) => (
            <Link
              key={idx}
              href={kpi.href}
              className={`p-4 rounded-2xl bg-slate-900/60 border ${kpi.border} hover:bg-slate-900 transition-all space-y-2 block group shadow-sm`}
            >
              <div className="flex items-center justify-between">
                <span className={`p-2 rounded-xl ${kpi.color}`}>{kpi.icon}</span>
                <ChevronRight className="w-3 h-3 text-slate-600 group-hover:text-slate-300 transition-colors" />
              </div>
              <div>
                <div className="text-2xl font-black text-slate-100">{kpi.count}</div>
                <div className="text-[11px] font-medium text-slate-400 truncate">{kpi.label}</div>
              </div>
            </Link>
          ))}
        </div>

        {/* Upcoming Follow-ups Alert Widget */}
        {upcomingFollowUps.length > 0 && (
          <div className="bg-gradient-to-r from-amber-950/30 to-slate-900/60 border border-amber-800/40 rounded-3xl p-5 sm:p-6 space-y-4 shadow-xl">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-amber-400">
                <Bell className="w-4 h-4 text-amber-400" />
                <h3 className="text-xs font-bold uppercase tracking-wider">
                  Upcoming Follow-ups ({upcomingFollowUps.length})
                </h3>
              </div>
              <Link
                href="/applications?hasFollowUp=true"
                className="text-[11px] text-amber-400 hover:text-amber-300 font-semibold"
              >
                View all scheduled follow-ups →
              </Link>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {upcomingFollowUps.map((app) => (
                <div
                  key={app.id}
                  className="bg-slate-950/80 border border-amber-900/30 rounded-2xl p-4 space-y-2 flex flex-col justify-between"
                >
                  <div className="space-y-1">
                    <div className="flex items-center justify-between">
                      <span
                        className={`px-2 py-0.5 rounded-md text-[10px] font-bold border capitalize ${getStatusBadge(
                          app.status
                        )}`}
                      >
                        {app.status.toLowerCase()}
                      </span>
                      {app.nextFollowUpAt && (
                        <span className="text-[11px] font-mono text-amber-300 flex items-center gap-1 font-semibold">
                          <Clock className="w-3 h-3" />
                          {new Date(app.nextFollowUpAt).toLocaleDateString()}
                        </span>
                      )}
                    </div>
                    <h4 className="text-sm font-bold text-slate-100 truncate">{app.job?.title}</h4>
                    <p className="text-xs text-slate-400 truncate">{app.job?.company}</p>
                  </div>

                  <Link
                    href={`/applications/${app.id}`}
                    className="pt-2 text-xs text-sky-400 hover:text-sky-300 font-semibold inline-flex items-center gap-1"
                  >
                    <span>Open Application</span>
                    <ArrowRight className="w-3 h-3" />
                  </Link>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 2-Column Core Section */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Left Column (8 cols): Recent Applications & Analytics */}
          <div className="lg:col-span-8 space-y-8">
            {/* Recent Applications Card */}
            <div className="bg-slate-900/60 border border-slate-800 rounded-3xl p-6 sm:p-7 space-y-5 shadow-xl">
              <div className="flex items-center justify-between border-b border-slate-800 pb-4">
                <div className="space-y-0.5">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-sky-400">
                    Active Pipeline
                  </span>
                  <h3 className="text-lg font-bold text-slate-100">Recent Applications</h3>
                </div>
                <Link
                  href="/applications"
                  className="text-xs text-sky-400 hover:text-sky-300 font-semibold inline-flex items-center gap-1"
                >
                  <span>Open Full Tracker</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </div>

              {recentApplications.length === 0 ? (
                <div className="p-8 text-center space-y-3 rounded-2xl bg-slate-950/40 border border-dashed border-slate-800">
                  <Layers className="w-8 h-8 text-slate-600 mx-auto" />
                  <p className="text-xs text-slate-400">
                    No active applications yet. Browse jobs and start tracking your search!
                  </p>
                  <Link
                    href="/jobs"
                    className="inline-block px-4 py-2 rounded-xl bg-sky-600 hover:bg-sky-500 text-white text-xs font-semibold"
                  >
                    Browse & Shortlist Jobs
                  </Link>
                </div>
              ) : (
                <div className="space-y-3">
                  {recentApplications.map((app) => (
                    <Link
                      key={app.id}
                      href={`/applications/${app.id}`}
                      className="p-4 rounded-2xl bg-slate-950/70 border border-slate-800 hover:border-slate-700 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 group block"
                    >
                      <div className="space-y-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-bold text-sm text-slate-100 group-hover:text-sky-400 transition-colors truncate">
                            {app.job?.title}
                          </span>
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold border uppercase tracking-wide ${getStatusBadge(
                              app.status
                            )}`}
                          >
                            {app.status}
                          </span>
                          {app.match?.matchScore && (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                              {app.match.matchScore}% Match
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-3 text-xs text-slate-400">
                          <span className="font-medium text-slate-300">{app.job?.company}</span>
                          <span>•</span>
                          <span>{app.job?.location || 'Remote'}</span>
                          {app.appliedAt && (
                            <>
                              <span>•</span>
                              <span>Applied {new Date(app.appliedAt).toLocaleDateString()}</span>
                            </>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-3 shrink-0 text-xs text-slate-400">
                        {app.nextFollowUpAt && (
                          <span className="text-amber-300 font-mono text-[11px]">
                            Follow-up: {new Date(app.nextFollowUpAt).toLocaleDateString()}
                          </span>
                        )}
                        <ChevronRight className="w-4 h-4 text-slate-600 group-hover:text-slate-200 transition-colors" />
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </div>

            {/* Simple Analytics & Conversion Rate Widget */}
            <div className="bg-slate-900/60 border border-slate-800 rounded-3xl p-6 sm:p-7 space-y-6 shadow-xl">
              <div className="space-y-0.5 border-b border-slate-800 pb-4">
                <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-400">
                  Search Health & Velocity
                </span>
                <h3 className="text-lg font-bold text-slate-100">Performance Metrics</h3>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {/* Metric 1: Interview Conversion Rate */}
                <div className="p-4 rounded-2xl bg-slate-950/70 border border-slate-800 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-slate-400 font-medium">Interview Rate</span>
                    <TrendingUp className="w-4 h-4 text-purple-400" />
                  </div>
                  <div className="text-2xl font-black text-slate-100">
                    {analytics.interviewRate}%
                  </div>
                  <p className="text-[11px] text-slate-500">
                    Interviews ({analytics.interviewCount}) vs Applications submitted
                  </p>
                </div>

                {/* Metric 2: Active Pipeline */}
                <div className="p-4 rounded-2xl bg-slate-950/70 border border-slate-800 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-slate-400 font-medium">Active Pipeline</span>
                    <Layers className="w-4 h-4 text-sky-400" />
                  </div>
                  <div className="text-2xl font-black text-slate-100">
                    {stats.ready + stats.applied + stats.interviews}
                  </div>
                  <p className="text-[11px] text-slate-500">
                    Opportunities currently progressing
                  </p>
                </div>

                {/* Metric 3: Offers Received */}
                <div className="p-4 rounded-2xl bg-slate-950/70 border border-slate-800 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-slate-400 font-medium">Offers</span>
                    <Award className="w-4 h-4 text-emerald-400" />
                  </div>
                  <div className="text-2xl font-black text-emerald-400">
                    {analytics.offerCount}
                  </div>
                  <p className="text-[11px] text-slate-500">
                    Target offers secured
                  </p>
                </div>
              </div>

              {/* Status Distribution Bar */}
              <div className="space-y-2 pt-2">
                <div className="flex items-center justify-between text-xs font-semibold text-slate-300">
                  <span>Application Stages Breakdown</span>
                  <span>{stats.saved + stats.shortlisted + stats.ready + stats.applied + stats.interviews + stats.offers + stats.rejected} total</span>
                </div>
                <div className="h-3 w-full bg-slate-950 rounded-full overflow-hidden flex border border-slate-800">
                  <div
                    style={{ width: `${(stats.saved / (stats.saved + stats.shortlisted + stats.ready + stats.applied + stats.interviews + stats.offers + stats.rejected || 1)) * 100}%` }}
                    className="bg-slate-500 h-full"
                    title={`Saved: ${stats.saved}`}
                  />
                  <div
                    style={{ width: `${(stats.shortlisted / (stats.saved + stats.shortlisted + stats.ready + stats.applied + stats.interviews + stats.offers + stats.rejected || 1)) * 100}%` }}
                    className="bg-indigo-500 h-full"
                    title={`Shortlisted: ${stats.shortlisted}`}
                  />
                  <div
                    style={{ width: `${(stats.ready / (stats.saved + stats.shortlisted + stats.ready + stats.applied + stats.interviews + stats.offers + stats.rejected || 1)) * 100}%` }}
                    className="bg-teal-500 h-full"
                    title={`Ready: ${stats.ready}`}
                  />
                  <div
                    style={{ width: `${(stats.applied / (stats.saved + stats.shortlisted + stats.ready + stats.applied + stats.interviews + stats.offers + stats.rejected || 1)) * 100}%` }}
                    className="bg-amber-500 h-full"
                    title={`Applied: ${stats.applied}`}
                  />
                  <div
                    style={{ width: `${(stats.interviews / (stats.saved + stats.shortlisted + stats.ready + stats.applied + stats.interviews + stats.offers + stats.rejected || 1)) * 100}%` }}
                    className="bg-purple-500 h-full"
                    title={`Interview: ${stats.interviews}`}
                  />
                  <div
                    style={{ width: `${(stats.offers / (stats.saved + stats.shortlisted + stats.ready + stats.applied + stats.interviews + stats.offers + stats.rejected || 1)) * 100}%` }}
                    className="bg-emerald-500 h-full"
                    title={`Offer: ${stats.offers}`}
                  />
                  <div
                    style={{ width: `${(stats.rejected / (stats.saved + stats.shortlisted + stats.ready + stats.applied + stats.interviews + stats.offers + stats.rejected || 1)) * 100}%` }}
                    className="bg-rose-500 h-full"
                    title={`Rejected: ${stats.rejected}`}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Right Column (4 cols): Recent Jobs Widget & Quick Shortcuts */}
          <div className="lg:col-span-4 space-y-6">
            <div className="bg-slate-900/60 border border-slate-800 rounded-3xl p-6 space-y-5 shadow-xl">
              <div className="flex items-center justify-between border-b border-slate-800 pb-4">
                <div className="space-y-0.5">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-sky-400">
                    Discovery
                  </span>
                  <h3 className="text-base font-bold text-slate-100">Recently Found Jobs</h3>
                </div>
                <Link
                  href="/jobs"
                  className="text-xs text-sky-400 hover:text-sky-300 font-semibold"
                >
                  All Jobs →
                </Link>
              </div>

              <div className="space-y-3">
                {recentJobs.map((job) => (
                  <div
                    key={job.id}
                    className="p-3.5 rounded-2xl bg-slate-950/70 border border-slate-800/80 space-y-2"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <Link
                          href={`/jobs/${job.id}`}
                          className="font-bold text-xs text-slate-200 hover:text-sky-400 transition-colors line-clamp-1"
                        >
                          {job.title}
                        </Link>
                        <div className="text-[11px] text-slate-400 truncate">{job.company}</div>
                      </div>

                      {job.matchScore !== null && (
                        <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 shrink-0">
                          {job.matchScore}%
                        </span>
                      )}
                    </div>

                    <div className="flex items-center justify-between pt-1 border-t border-slate-800/60 text-[11px]">
                      <span className="text-slate-500 capitalize">{job.remoteType || 'Onsite'}</span>

                      <div className="flex items-center gap-2">
                        {job.applicationStatus ? (
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${getStatusBadge(
                              job.applicationStatus
                            )}`}
                          >
                            {job.applicationStatus}
                          </span>
                        ) : (
                          <div className="flex items-center gap-1.5">
                            <button
                              onClick={() => handleQuickSaveJob(job.id, 'SAVED')}
                              className="px-2 py-0.5 rounded bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-700 text-[10px] font-semibold transition-colors"
                            >
                              Save
                            </button>
                            <button
                              onClick={() => handleQuickSaveJob(job.id, 'SHORTLISTED')}
                              className="px-2 py-0.5 rounded bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 border border-indigo-500/30 text-[10px] font-semibold transition-colors"
                            >
                              Shortlist
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Recruiter Inbox & Communications Widget */}
            <div className="bg-slate-900/60 border border-slate-800 rounded-3xl p-6 space-y-4 shadow-xl">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <div className="flex items-center gap-2">
                  <Mail className="w-4 h-4 text-purple-400" />
                  <h3 className="text-base font-bold text-slate-100">Recruiter Inbox</h3>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleQuickSync}
                    disabled={isSyncingGmail}
                    className="p-1 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 disabled:opacity-50"
                    title="Sync Gmail"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isSyncingGmail ? 'animate-spin' : ''}`} />
                  </button>
                  <Link
                    href="/emails"
                    className="text-xs text-purple-400 hover:text-purple-300 font-semibold"
                  >
                    Inbox →
                  </Link>
                </div>
              </div>

              {gmailConnected ? (
                <div className="flex items-center justify-between px-3 py-1.5 rounded-xl bg-emerald-950/30 border border-emerald-800/40 text-[11px] text-emerald-400 font-medium">
                  <span className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                    Gmail Connected
                  </span>
                  <Link href="/settings/integrations" className="text-slate-400 hover:text-slate-200">
                    Manage
                  </Link>
                </div>
              ) : (
                <div className="flex items-center justify-between px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-[11px]">
                  <span className="text-slate-400">Gmail not connected</span>
                  <Link
                    href="/settings/integrations"
                    className="text-indigo-400 hover:text-indigo-300 font-semibold"
                  >
                    Connect →
                  </Link>
                </div>
              )}

              {recentEmails.length === 0 ? (
                <p className="text-xs text-slate-500 italic py-2">
                  No recruiter emails synced yet.
                </p>
              ) : (
                <div className="space-y-2">
                  {recentEmails.map((em) => (
                    <Link
                      key={em.id}
                      href={`/emails/${em.id}`}
                      className="p-2.5 rounded-2xl bg-slate-950/70 border border-slate-800/80 hover:border-slate-700 block transition-colors space-y-1"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-semibold text-slate-200 truncate">
                          {em.subject}
                        </span>
                        <span className="px-1.5 py-0.5 rounded text-[9px] font-semibold bg-slate-800 text-slate-300 shrink-0">
                          {em.category.replace('_', ' ')}
                        </span>
                      </div>
                      <div className="text-[10px] text-slate-400 flex items-center justify-between">
                        <span className="truncate">From: {em.senderEmail || em.sender}</span>
                        <span className="font-mono shrink-0">
                          {new Date(em.receivedAt).toLocaleDateString([], {
                            month: 'numeric',
                            day: 'numeric',
                          })}
                        </span>
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </div>

            {/* Quick Workspace Navigation */}
            <div className="bg-slate-900/60 border border-slate-800 rounded-3xl p-6 space-y-3 shadow-xl">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                Quick Shortcuts
              </h4>
              <div className="space-y-2">
                <Link
                  href="/emails"
                  className="flex items-center justify-between p-3 rounded-xl bg-slate-950/70 border border-slate-800 hover:border-slate-700 text-xs font-semibold text-slate-200 transition-colors"
                >
                  <span className="flex items-center gap-2">
                    <Mail className="w-4 h-4 text-purple-400" />
                    Recruiter Inbox & Assistant
                  </span>
                  <ChevronRight className="w-3.5 h-3.5 text-slate-500" />
                </Link>

                <Link
                  href="/resume"
                  className="flex items-center justify-between p-3 rounded-xl bg-slate-950/70 border border-slate-800 hover:border-slate-700 text-xs font-semibold text-slate-200 transition-colors"
                >
                  <span className="flex items-center gap-2">
                    <FileText className="w-4 h-4 text-sky-400" />
                    Verified Candidate Profile
                  </span>
                  <ChevronRight className="w-3.5 h-3.5 text-slate-500" />
                </Link>

                <Link
                  href="/applications"
                  className="flex items-center justify-between p-3 rounded-xl bg-slate-950/70 border border-slate-800 hover:border-slate-700 text-xs font-semibold text-slate-200 transition-colors"
                >
                  <span className="flex items-center gap-2">
                    <Layers className="w-4 h-4 text-indigo-400" />
                    Kanban & Table Tracker
                  </span>
                  <ChevronRight className="w-3.5 h-3.5 text-slate-500" />
                </Link>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
