'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  History,
  ArrowLeft,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Clock,
  RefreshCw,
  Search,
  Filter,
  Bot,
  ChevronRight,
  Sparkles,
} from 'lucide-react';
import { AutomationRun, AutomationEvent } from '@ai-job-hunter/shared';

export default function AutomationHistoryPage() {
  const [runs, setRuns] = useState<AutomationRun[]>([]);
  const [selectedRun, setSelectedRun] = useState<AutomationRun | null>(null);
  const [events, setEvents] = useState<AutomationEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [eventsLoading, setEventsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchRuns = async () => {
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
      const res = await fetch(`${apiUrl}/api/automation/runs?limit=30`, { cache: 'no-store' });
      const json = await res.json();
      if (json.success) {
        setRuns(json.data || []);
        if (json.data && json.data.length > 0 && !selectedRun) {
          setSelectedRun(json.data[0]);
        }
      }
    } catch (err: any) {
      setError(err.message || 'Error fetching runs');
    } finally {
      setLoading(false);
    }
  };

  const fetchEventsForRun = async (runId: string) => {
    setEventsLoading(true);
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
      const res = await fetch(`${apiUrl}/api/automation/events?runId=${runId}&limit=100`, { cache: 'no-store' });
      const json = await res.json();
      if (json.success) {
        setEvents(json.data || []);
      }
    } catch (err: any) {
      console.error(err);
    } finally {
      setEventsLoading(false);
    }
  };

  useEffect(() => {
    fetchRuns();
  }, []);

  useEffect(() => {
    if (selectedRun) {
      fetchEventsForRun(selectedRun.id);
    }
  }, [selectedRun]);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'COMPLETED':
        return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20';
      case 'RUNNING':
        return 'bg-sky-500/10 text-sky-400 border-sky-500/20 animate-pulse';
      case 'FAILED':
        return 'bg-red-500/10 text-red-400 border-red-500/20';
      case 'CANCELLED':
        return 'bg-amber-500/10 text-amber-400 border-amber-500/20';
      default:
        return 'bg-slate-800 text-slate-400 border-slate-700';
    }
  };

  return (
    <div className="min-h-[calc(100vh-4rem)] p-4 sm:p-6 md:p-10 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <Link
            href="/automation"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-400 hover:text-slate-200 transition-colors mb-2"
          >
            <ArrowLeft className="w-3.5 h-3.5" /> Back to Command Center
          </Link>
          <h1 className="text-2xl font-black text-slate-100 tracking-tight flex items-center gap-2.5">
            <History className="w-6 h-6 text-sky-400" />
            Automation Runs & Audit Trail
          </h1>
          <p className="text-xs sm:text-sm text-slate-400">
            Chronological audit of pipeline executions, automated job matching events, and submission logs
          </p>
        </div>

        <button
          onClick={fetchRuns}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-colors"
        >
          <RefreshCw className="w-3.5 h-3.5" /> Refresh Runs
        </button>
      </div>

      {loading ? (
        <div className="py-20 flex items-center justify-center">
          <RefreshCw className="w-8 h-8 text-sky-400 animate-spin" />
        </div>
      ) : runs.length === 0 ? (
        <div className="p-12 text-center bg-slate-900/40 rounded-2xl border border-slate-800 space-y-3">
          <Bot className="w-10 h-10 text-slate-600 mx-auto" />
          <p className="text-slate-300 font-semibold text-sm">No automation runs recorded yet</p>
          <p className="text-slate-500 text-xs">Run a pipeline from the Command Center to start generating history.</p>
          <Link
            href="/automation"
            className="inline-block mt-2 px-4 py-2 rounded-xl text-xs font-bold bg-sky-500 text-white hover:bg-sky-400 transition-colors"
          >
            Go to Command Center
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Runs List */}
          <div className="space-y-3 lg:col-span-1">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Execution Runs</span>
            <div className="space-y-2.5 overflow-y-auto max-h-[650px] pr-1">
              {runs.map((r) => {
                const isSelected = selectedRun?.id === r.id;
                return (
                  <button
                    key={r.id}
                    onClick={() => setSelectedRun(r)}
                    className={`w-full text-left p-4 rounded-xl border transition-all ${
                      isSelected
                        ? 'bg-sky-500/10 border-sky-500/30 shadow-md shadow-sky-500/5'
                        : 'bg-slate-900/50 border-slate-800 hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-extrabold text-slate-200">{r.runType.replace(/_/g, ' ')}</span>
                      <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold border ${getStatusBadge(r.status)}`}>
                        {r.status}
                      </span>
                    </div>

                    <div className="mt-2 text-[11px] text-slate-400 space-y-1">
                      <div className="flex justify-between">
                        <span>Started:</span>
                        <span className="text-slate-300">{new Date(r.startedAt).toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Items Processed:</span>
                        <span className="font-semibold text-slate-200">{r.itemsProcessed} (✓ {r.itemsSucceeded} / ✗ {r.itemsFailed})</span>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Run Detail & Audit Events */}
          <div className="lg:col-span-2 space-y-4">
            {selectedRun ? (
              <div className="bg-slate-900/50 rounded-2xl border border-slate-800 p-6 space-y-6">
                {/* Header detail */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-800">
                  <div>
                    <div className="flex items-center gap-2">
                      <h2 className="text-lg font-black text-slate-100">{selectedRun.runType.replace(/_/g, ' ')}</h2>
                      <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold border ${getStatusBadge(selectedRun.status)}`}>
                        {selectedRun.status}
                      </span>
                    </div>
                    <span className="text-xs text-slate-400 font-mono">Run ID: {selectedRun.id}</span>
                  </div>

                  <div className="flex items-center gap-4 text-xs">
                    <div className="text-right">
                      <span className="text-slate-400 block">Processed</span>
                      <span className="text-sm font-bold text-slate-100">{selectedRun.itemsProcessed}</span>
                    </div>
                    <div className="text-right">
                      <span className="text-emerald-400 block">Succeeded</span>
                      <span className="text-sm font-bold text-emerald-400">{selectedRun.itemsSucceeded}</span>
                    </div>
                    <div className="text-right">
                      <span className="text-red-400 block">Failed</span>
                      <span className="text-sm font-bold text-red-400">{selectedRun.itemsFailed}</span>
                    </div>
                  </div>
                </div>

                {selectedRun.errorSummary && (
                  <div className="p-3.5 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs">
                    <strong>Error Summary:</strong> {selectedRun.errorSummary}
                  </div>
                )}

                {/* Events list */}
                <div className="space-y-3">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-2">
                    <Clock className="w-3.5 h-3.5 text-sky-400" />
                    Timeline of Pipeline Events ({events.length})
                  </h3>

                  {eventsLoading ? (
                    <div className="py-12 flex justify-center">
                      <RefreshCw className="w-6 h-6 text-sky-400 animate-spin" />
                    </div>
                  ) : events.length === 0 ? (
                    <div className="p-8 text-center text-slate-500 text-xs">
                      No individual event logs recorded for this run.
                    </div>
                  ) : (
                    <div className="space-y-2 max-h-[480px] overflow-y-auto pr-1">
                      {events.map((evt) => (
                        <div
                          key={evt.id}
                          className="p-3.5 rounded-xl bg-slate-900/90 border border-slate-800 text-xs space-y-1.5"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-bold text-slate-200">{evt.eventType.replace(/_/g, ' ')}</span>
                            <span className="text-[10px] text-slate-500">
                              {new Date(evt.createdAt).toLocaleTimeString()}
                            </span>
                          </div>
                          <p className="text-slate-300 text-[11px] leading-relaxed">{evt.message}</p>
                          {evt.metadata && Object.keys(evt.metadata).length > 0 && (
                            <pre className="mt-1 p-2 rounded-lg bg-slate-950/60 border border-slate-800/80 text-[10px] text-slate-400 font-mono overflow-x-auto">
                              {JSON.stringify(evt.metadata, null, 2)}
                            </pre>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="p-12 text-center text-slate-500 text-xs bg-slate-900/30 rounded-2xl border border-slate-800">
                Select a run to view detailed logs and event trail.
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
