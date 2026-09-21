'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  Bot,
  Play,
  AlertOctagon,
  CheckSquare,
  History,
  Sliders,
  Sparkles,
  CheckCircle2,
  Clock,
  ShieldCheck,
  Search,
  ExternalLink,
  ChevronRight,
  TrendingUp,
  AlertTriangle,
  Send,
  RefreshCw,
  Power,
} from 'lucide-react';
import { AutomationSummary, AutomationEvent } from '@ai-job-hunter/shared';

export default function AutomationCommandCenter() {
  const [summary, setSummary] = useState<AutomationSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const fetchSummary = async () => {
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
      const res = await fetch(`${apiUrl}/api/automation/summary`, { cache: 'no-store' });
      const json = await res.json();
      if (json.success) {
        setSummary(json.data);
      } else {
        setError(json.error || 'Failed to load automation summary');
      }
    } catch (err: any) {
      setError(err.message || 'Error connecting to server');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSummary();
    const interval = setInterval(fetchSummary, 8000);
    return () => clearInterval(interval);
  }, []);

  const handleTriggerRun = async () => {
    setActionLoading(true);
    setError(null);
    setSuccessMsg(null);
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
      const res = await fetch(`${apiUrl}/api/automation/run`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      const json = await res.json();
      if (json.success) {
        setSuccessMsg('Automation pipeline triggered successfully!');
        fetchSummary();
      } else {
        setError(json.error || 'Failed to trigger automation');
      }
    } catch (err: any) {
      setError(err.message || 'Error triggering run');
    } finally {
      setActionLoading(false);
    }
  };

  const handleToggleKillSwitch = async () => {
    if (!summary) return;
    setActionLoading(true);
    setError(null);
    setSuccessMsg(null);
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

    try {
      if (summary.settings.killSwitchActive) {
        // Resume
        const res = await fetch(`${apiUrl}/api/automation/resume`, { method: 'POST' });
        const json = await res.json();
        if (json.success) {
          setSuccessMsg('Emergency Kill Switch deactivated. System resumed.');
          fetchSummary();
        } else {
          setError(json.error || 'Failed to resume');
        }
      } else {
        // Trigger Kill Switch
        const res = await fetch(`${apiUrl}/api/automation/kill-switch`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ reason: 'Triggered by user from command center' }),
        });
        const json = await res.json();
        if (json.success) {
          setSuccessMsg('EMERGENCY KILL SWITCH ACTIVATED! All automations halted.');
          fetchSummary();
        } else {
          setError(json.error || 'Failed to activate kill switch');
        }
      }
    } catch (err: any) {
      setError(err.message || 'Error toggling kill switch');
    } finally {
      setActionLoading(false);
    }
  };

  const getEventBadge = (type: string, status: string) => {
    if (type === 'KILL_SWITCH_TRIGGERED' || status === 'FAILED') {
      return 'bg-red-500/10 text-red-400 border-red-500/20';
    }
    if (type === 'APPROVAL_REQUIRED' || type === 'JOB_EXCLUDED' || status === 'WARNING') {
      return 'bg-amber-500/10 text-amber-400 border-amber-500/20';
    }
    if (type === 'APPLICATION_SUBMITTED' || type === 'JOB_SHORTLISTED') {
      return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20';
    }
    return 'bg-sky-500/10 text-sky-400 border-sky-500/20';
  };

  if (loading) {
    return (
      <div className="min-h-[calc(100vh-4rem)] p-6 md:p-10 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <RefreshCw className="w-8 h-8 text-sky-400 animate-spin" />
          <p className="text-slate-400 text-sm">Loading Automation Command Center...</p>
        </div>
      </div>
    );
  }

  const isKilled = summary?.settings.killSwitchActive;
  const isEnabled = summary?.settings.automationEnabled && !isKilled;

  return (
    <div className="min-h-[calc(100vh-4rem)] p-4 sm:p-6 md:p-10 max-w-7xl mx-auto space-y-8">
      {/* Header with Kill Switch & Quick Actions */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-900/60 p-6 rounded-2xl border border-slate-800 backdrop-blur-md">
        <div className="space-y-1">
          <div className="flex items-center gap-3">
            <div className={`p-2.5 rounded-xl border ${isKilled ? 'bg-red-500/10 border-red-500/30 text-red-400' : 'bg-sky-500/10 border-sky-500/30 text-sky-400'}`}>
              <Bot className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2.5">
                <h1 className="text-2xl font-black text-slate-100 tracking-tight">
                  Automation Command Center
                </h1>
                <span
                  className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold border ${
                    isKilled
                      ? 'bg-red-500/15 border-red-500/30 text-red-400 animate-pulse'
                      : isEnabled
                      ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-400'
                      : 'bg-slate-800 border-slate-700 text-slate-400'
                  }`}
                >
                  <span className={`w-1.5 h-1.5 rounded-full ${isKilled ? 'bg-red-400' : isEnabled ? 'bg-emerald-400' : 'bg-slate-400'}`} />
                  {isKilled ? 'KILL SWITCH ACTIVE' : isEnabled ? 'AUTO HUNTING' : 'IDLE / ASSISTED'}
                </span>
              </div>
              <p className="text-xs sm:text-sm text-slate-400">
                Continuous autonomous job discovery, AI matching, material generation, and controlled submission
              </p>
            </div>
          </div>
        </div>

        {/* Global Controls */}
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Emergency Kill Switch Button */}
          <button
            onClick={handleToggleKillSwitch}
            disabled={actionLoading}
            className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all shadow-lg ${
              isKilled
                ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-600/20'
                : 'bg-red-600 hover:bg-red-500 text-white shadow-red-600/30 ring-2 ring-red-500/40 animate-pulse'
            }`}
          >
            {isKilled ? <Power className="w-4 h-4" /> : <AlertOctagon className="w-4 h-4" />}
            {isKilled ? 'RESUME AUTOMATION' : 'STOP ALL AUTOMATION'}
          </button>

          {/* Trigger Run */}
          <button
            onClick={handleTriggerRun}
            disabled={actionLoading || isKilled}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold bg-sky-500 hover:bg-sky-400 text-white transition-all shadow-md shadow-sky-500/20 disabled:opacity-50"
          >
            {actionLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
            Run Pipeline Now
          </button>

          {/* Navigation links */}
          <Link
            href="/approvals"
            className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-colors"
          >
            <CheckSquare className="w-4 h-4 text-amber-400" />
            Approvals ({summary?.todayStats.pendingApprovals || 0})
          </Link>

          <Link
            href="/settings/automation"
            className="p-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition-colors"
            title="Automation Settings"
          >
            <Sliders className="w-4 h-4" />
          </Link>
        </div>
      </div>

      {/* Notifications / Alerts */}
      {error && (
        <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs sm:text-sm flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
          <button onClick={() => setError(null)} className="text-red-400 hover:text-red-300 text-xs">Dismiss</button>
        </div>
      )}

      {successMsg && (
        <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs sm:text-sm flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>{successMsg}</span>
          </div>
          <button onClick={() => setSuccessMsg(null)} className="text-emerald-400 hover:text-emerald-300 text-xs">Dismiss</button>
        </div>
      )}

      {isKilled && (
        <div className="p-4 rounded-xl bg-red-500/15 border border-red-500/30 text-red-300 flex items-center gap-3">
          <AlertOctagon className="w-5 h-5 text-red-400 shrink-0" />
          <div className="text-xs sm:text-sm">
            <strong>EMERGENCY KILL SWITCH IS ENGAGED.</strong> All background jobs, syncs, auto-shortlisting, and submissions are paused immediately. Click &quot;Resume Automation&quot; above to lift the halt.
          </div>
        </div>
      )}

      {/* 24-Hour Metrics Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-4">
        <div className="bg-slate-900/40 p-4 rounded-2xl border border-slate-800 flex flex-col justify-between">
          <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Discovered</span>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-2xl font-black text-slate-100">{summary?.todayStats.jobsDiscovered || 0}</span>
            <Search className="w-4 h-4 text-sky-400" />
          </div>
          <span className="text-[10px] text-slate-500 mt-1">Past 24 hours</span>
        </div>

        <div className="bg-slate-900/40 p-4 rounded-2xl border border-slate-800 flex flex-col justify-between">
          <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Analyzed</span>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-2xl font-black text-slate-100">{summary?.todayStats.jobsAnalyzed || 0}</span>
            <TrendingUp className="w-4 h-4 text-indigo-400" />
          </div>
          <span className="text-[10px] text-slate-500 mt-1">Semantic parsed</span>
        </div>

        <div className="bg-slate-900/40 p-4 rounded-2xl border border-slate-800 flex flex-col justify-between">
          <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">AI Matched</span>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-2xl font-black text-slate-100">{summary?.todayStats.jobsMatched || 0}</span>
            <Sparkles className="w-4 h-4 text-purple-400" />
          </div>
          <span className="text-[10px] text-slate-500 mt-1">Embeddings score</span>
        </div>

        <div className="bg-slate-900/40 p-4 rounded-2xl border border-slate-800 flex flex-col justify-between">
          <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Shortlisted</span>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-2xl font-black text-emerald-400">{summary?.todayStats.jobsShortlisted || 0}</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          </div>
          <span className="text-[10px] text-slate-500 mt-1">Profile fit met</span>
        </div>

        <div className="bg-slate-900/40 p-4 rounded-2xl border border-slate-800 flex flex-col justify-between">
          <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Prepared</span>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-2xl font-black text-amber-400">{summary?.todayStats.applicationsPrepared || 0}</span>
            <ShieldCheck className="w-4 h-4 text-amber-400" />
          </div>
          <span className="text-[10px] text-slate-500 mt-1">Materials & questions</span>
        </div>

        <div className="bg-slate-900/40 p-4 rounded-2xl border border-slate-800 flex flex-col justify-between">
          <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Submitted</span>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-2xl font-black text-cyan-400">{summary?.todayStats.applicationsSubmitted || 0}</span>
            <Send className="w-4 h-4 text-cyan-400" />
          </div>
          <span className="text-[10px] text-slate-500 mt-1">Limit: {summary?.settings.dailyApplicationLimit}/day</span>
        </div>
      </div>

      {/* Main Content Layout: Pending Approvals & Live Stream */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Cols: Pipeline Architecture & Approvals Banner */}
        <div className="lg:col-span-2 space-y-6">
          {/* Approvals Action Banner */}
          {(summary?.todayStats.pendingApprovals || 0) > 0 ? (
            <div className="p-5 rounded-2xl bg-gradient-to-r from-amber-500/15 via-orange-500/10 to-amber-500/5 border border-amber-500/30 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2 text-amber-400 font-bold text-sm">
                  <CheckSquare className="w-4 h-4" />
                  {summary?.todayStats.pendingApprovals} Application{summary?.todayStats.pendingApprovals === 1 ? '' : 's'} Waiting for Human Review
                </div>
                <p className="text-xs text-slate-300">
                  Materials are drafted and answers prepared from your profile. Sensitive questions and final submission strictly require your approval.
                </p>
              </div>
              <Link
                href="/approvals"
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold bg-amber-500 hover:bg-amber-400 text-slate-950 transition-colors shrink-0 shadow-sm"
              >
                Review Approval Queue
                <ChevronRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          ) : (
            <div className="p-4 rounded-2xl bg-slate-900/30 border border-slate-800 text-xs text-slate-400 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-emerald-400" />
                <span>Approval queue is clear. No applications pending review.</span>
              </div>
              <Link href="/approvals" className="text-sky-400 hover:underline">View approvals</Link>
            </div>
          )}

          {/* Active Job Search Profile & Automation Configuration */}
          <div className="bg-slate-900/40 rounded-2xl border border-slate-800 p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-bold text-slate-100 flex items-center gap-2">
                <Sliders className="w-4 h-4 text-sky-400" />
                Active Hunting Controls
              </h2>
              <Link
                href="/settings/automation"
                className="text-xs font-semibold text-sky-400 hover:text-sky-300 flex items-center gap-1"
              >
                Configure Settings <ChevronRight className="w-3.5 h-3.5" />
              </Link>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              <div className="p-3.5 rounded-xl bg-slate-900/80 border border-slate-800 space-y-1.5">
                <span className="text-slate-400 block font-medium">Mode</span>
                <span className="text-slate-200 font-bold text-sm block">{summary?.settings.mode || 'ASSISTED'}</span>
                <span className="text-[11px] text-slate-500 block">
                  {summary?.settings.applicationApprovalRequired
                    ? 'Explicit user approval required before any external submission'
                    : 'Auto-submit where connector allows'}
                </span>
              </div>

              <div className="p-3.5 rounded-xl bg-slate-900/80 border border-slate-800 space-y-1.5">
                <span className="text-slate-400 block font-medium">Safety Rate Limits</span>
                <span className="text-slate-200 font-bold text-sm block">
                  {summary?.settings.dailyApplicationLimit || 5} daily / {summary?.settings.hourlyApplicationLimit || 2} hourly
                </span>
                <span className="text-[11px] text-slate-500 block">
                  Prevents quota exhaustion and portal spamming
                </span>
              </div>

              <div className="p-3.5 rounded-xl bg-slate-900/80 border border-slate-800 space-y-1.5">
                <span className="text-slate-400 block font-medium">Auto-Shortlisting Threshold</span>
                <span className="text-slate-200 font-bold text-sm block">
                  {summary?.settings.minimumMatchScore || 80}% match score
                </span>
                <span className="text-[11px] text-slate-500 block">
                  Skills overlap min: {summary?.settings.minimumSkillMatch || 70}%
                </span>
              </div>

              <div className="p-3.5 rounded-xl bg-slate-900/80 border border-slate-800 space-y-1.5">
                <span className="text-slate-400 block font-medium">Target Profiles</span>
                <span className="text-slate-200 font-bold text-sm block">
                  {summary?.activeProfilesCount || 0} active search profile{summary?.activeProfilesCount === 1 ? '' : 's'}
                </span>
                <span className="text-[11px] text-slate-500 block">
                  Auto-sync every {summary?.settings.syncFrequencyHours || 6} hours
                </span>
              </div>
            </div>
          </div>

          {/* Last Run Summary */}
          {summary?.lastRun && (
            <div className="bg-slate-900/40 rounded-2xl border border-slate-800 p-5 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-sky-400" />
                  Last Run Performance
                </span>
                <Link href="/automation/history" className="text-xs text-sky-400 hover:underline">
                  Full Run History
                </Link>
              </div>
              <div className="flex flex-wrap items-center justify-between gap-4 text-xs">
                <div>
                  <span className="text-slate-400">Status: </span>
                  <span className={`font-bold ${summary.lastRun.status === 'COMPLETED' ? 'text-emerald-400' : 'text-amber-400'}`}>
                    {summary.lastRun.status}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400">Processed: </span>
                  <span className="font-semibold text-slate-200">{summary.lastRun.itemsProcessed} jobs</span>
                </div>
                <div>
                  <span className="text-slate-400">Succeeded: </span>
                  <span className="font-semibold text-emerald-400">{summary.lastRun.itemsSucceeded}</span>
                </div>
                <div>
                  <span className="text-slate-400">Failed: </span>
                  <span className="font-semibold text-red-400">{summary.lastRun.itemsFailed}</span>
                </div>
                <div>
                  <span className="text-slate-400">Started: </span>
                  <span className="text-slate-300">{new Date(summary.lastRun.startedAt).toLocaleTimeString()}</span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Right Col: Live Activity Stream / Audit Log */}
        <div className="bg-slate-900/40 rounded-2xl border border-slate-800 p-6 flex flex-col justify-between space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold text-slate-100 flex items-center gap-2">
              <History className="w-4 h-4 text-indigo-400" />
              Live Audit Log
            </h2>
            <Link
              href="/automation/history"
              className="text-xs font-semibold text-sky-400 hover:text-sky-300"
            >
              All Events
            </Link>
          </div>

          <div className="space-y-3 overflow-y-auto max-h-[520px] pr-1">
            {(!summary?.recentEvents || summary.recentEvents.length === 0) ? (
              <div className="text-center py-12 text-slate-500 text-xs">
                No events recorded yet. Run a pipeline to begin logging.
              </div>
            ) : (
              summary.recentEvents.map((evt: AutomationEvent) => (
                <div
                  key={evt.id}
                  className="p-3 rounded-xl bg-slate-900/80 border border-slate-800/80 text-xs space-y-1.5 hover:border-slate-700 transition-colors"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold border ${getEventBadge(evt.eventType, evt.status)}`}>
                      {evt.eventType.replace(/_/g, ' ')}
                    </span>
                    <span className="text-[10px] text-slate-500 shrink-0">
                      {new Date(evt.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                  <p className="text-slate-300 text-[11px] leading-relaxed">
                    {evt.message}
                  </p>
                </div>
              ))
            )}
          </div>

          <div className="pt-2 border-t border-slate-800/60 text-center">
            <Link
              href="/automation/history"
              className="inline-flex items-center gap-1 text-xs font-semibold text-slate-400 hover:text-slate-200 transition-colors"
            >
              View detailed audit trail & run history <ChevronRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
