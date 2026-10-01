'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import {
  Layers,
  Search,
  Filter,
  ArrowRight,
  RefreshCw,
  Table as TableIcon,
  Kanban as KanbanIcon,
  Calendar,
  Clock,
  ExternalLink,
  ChevronRight,
  CheckCircle2,
  Building2,
  MapPin,
  Sparkles,
  Award,
  MoreHorizontal,
  ChevronDown,
} from 'lucide-react';
import { Navbar } from '@/components/Navbar';
import { Application, ApplicationStatus } from '@ai-job-hunter/shared';
import { authFetch } from '@/lib/api';

const STATUS_COLUMNS: Array<{ id: ApplicationStatus; label: string; color: string; border: string }> = [
  { id: 'SAVED', label: 'Saved', color: 'bg-slate-800 text-slate-300', border: 'border-slate-700' },
  { id: 'SHORTLISTED', label: 'Shortlisted', color: 'bg-indigo-500/10 text-indigo-400', border: 'border-indigo-500/20' },
  { id: 'READY', label: 'Ready', color: 'bg-teal-500/10 text-teal-400', border: 'border-teal-500/20' },
  { id: 'APPLIED', label: 'Applied', color: 'bg-amber-500/10 text-amber-400', border: 'border-amber-500/20' },
  { id: 'INTERVIEW', label: 'Interview', color: 'bg-purple-500/10 text-purple-400', border: 'border-purple-500/20' },
  { id: 'OFFER', label: 'Offer', color: 'bg-emerald-500/10 text-emerald-400', border: 'border-emerald-500/20' },
  { id: 'REJECTED', label: 'Rejected', color: 'bg-rose-500/10 text-rose-400', border: 'border-rose-500/20' },
  { id: 'WITHDRAWN', label: 'Withdrawn', color: 'bg-slate-900 text-slate-500', border: 'border-slate-800' },
];

function ApplicationsContent() {
  const searchParams = useSearchParams();
  const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

  const [applications, setApplications] = useState<Application[]>([]);
  const [total, setTotal] = useState<number>(0);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [viewMode, setViewMode] = useState<'table' | 'kanban'>('kanban');

  // Filter state
  const [statusFilter, setStatusFilter] = useState<string>(searchParams.get('status') || '');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [sortBy, setSortBy] = useState<'last_updated_at' | 'applied_at' | 'created_at' | 'company'>('last_updated_at');

  const fetchApplications = useCallback(async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      params.append('limit', '100');
      params.append('sortBy', sortBy);
      params.append('sortOrder', 'DESC');

      if (statusFilter) params.append('status', statusFilter);
      if (searchQuery.trim()) params.append('search', searchQuery.trim());
      if (searchParams.get('hasFollowUp') === 'true') params.append('hasFollowUp', 'true');

      const res = await authFetch(`${apiUrl}/api/applications?${params.toString()}`, {
        cache: 'no-store',
      });
      if (res.status === 401) {
        if (typeof window !== 'undefined') {
          window.location.href = '/login';
          return;
        }
      }
      if (res.ok) {
        const json = await res.json();
        setApplications(json.data || []);
        setTotal(json.pagination?.total || 0);
      }
    } catch (err) {
      console.error('Failed to load applications:', err);
    } finally {
      setIsLoading(false);
    }
  }, [apiUrl, statusFilter, searchQuery, sortBy, searchParams]);

  useEffect(() => {
    fetchApplications();
  }, [fetchApplications]);

  const handleStatusChange = async (applicationId: string, newStatus: ApplicationStatus) => {
    try {
      const res = await authFetch(`${apiUrl}/api/applications/${applicationId}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status: newStatus }),
      });
      if (res.ok) {
        // Optimistically update status locally
        setApplications((prev) =>
          prev.map((a) => (a.id === applicationId ? { ...a, status: newStatus } : a))
        );
        fetchApplications();
      }
    } catch (err) {
      console.error('Failed to update status:', err);
    }
  };

  const getBadgeClass = (status: ApplicationStatus) => {
    const col = STATUS_COLUMNS.find((c) => c.id === status);
    return col ? `${col.color} ${col.border}` : 'bg-slate-800 text-slate-300 border-slate-700';
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
      <Navbar />

      <main className="flex-1 max-w-7xl mx-auto px-4 sm:px-6 py-8 w-full space-y-6">
        {/* Top Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-sky-400">
              <Layers className="w-3.5 h-3.5" />
              <span>Application Hub</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-100">
              Application Tracker ({total})
            </h1>
            <p className="text-xs text-slate-400">
              Manage application stages, linked materials, and follow-ups.
            </p>
          </div>

          {/* View Mode Toggle */}
          <div className="flex items-center gap-3">
            <div className="flex items-center bg-slate-900 border border-slate-800 p-1 rounded-2xl">
              <button
                onClick={() => setViewMode('kanban')}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                  viewMode === 'kanban'
                    ? 'bg-sky-600 text-white shadow-md'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <KanbanIcon className="w-3.5 h-3.5" />
                <span>Kanban</span>
              </button>
              <button
                onClick={() => setViewMode('table')}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                  viewMode === 'table'
                    ? 'bg-sky-600 text-white shadow-md'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <TableIcon className="w-3.5 h-3.5" />
                <span>Table</span>
              </button>
            </div>

            <Link
              href="/jobs"
              className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 text-xs font-semibold text-slate-200 transition-colors"
            >
              + Find More Jobs
            </Link>
          </div>
        </div>

        {/* Filter & Search Toolbar */}
        <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-4 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
            {/* Search Input */}
            <div className="relative flex-1 sm:w-64">
              <Search className="w-3.5 h-3.5 absolute left-3 top-3 text-slate-500" />
              <input
                type="text"
                placeholder="Search job, company, notes..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-8 pr-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-sky-500"
              />
            </div>

            {/* Status Filter */}
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-sky-500"
            >
              <option value="">All Statuses</option>
              {STATUS_COLUMNS.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.label}
                </option>
              ))}
            </select>

            {/* Sort Selector */}
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-sky-500"
            >
              <option value="last_updated_at">Recently Updated</option>
              <option value="applied_at">Date Applied</option>
              <option value="created_at">Date Created</option>
              <option value="company">Company Name</option>
            </select>
          </div>

          <button
            onClick={fetchApplications}
            disabled={isLoading}
            className="inline-flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-200 font-semibold"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>
        </div>

        {/* View Mode: Kanban or Table */}
        {isLoading ? (
          <div className="p-16 text-center space-y-3">
            <div className="w-8 h-8 border-2 border-sky-400 border-t-transparent rounded-full animate-spin mx-auto"></div>
            <p className="text-xs text-slate-400">Loading applications...</p>
          </div>
        ) : applications.length === 0 ? (
          <div className="p-12 text-center space-y-3 rounded-3xl bg-slate-900/40 border border-dashed border-slate-800">
            <Layers className="w-10 h-10 text-slate-600 mx-auto" />
            <h3 className="text-base font-bold text-slate-200">No applications found</h3>
            <p className="text-xs text-slate-400 max-w-sm mx-auto">
              Save or apply to jobs from the job board to begin tracking them here.
            </p>
            <Link
              href="/jobs"
              className="inline-block px-4 py-2 rounded-xl bg-sky-600 hover:bg-sky-500 text-white text-xs font-semibold"
            >
              Browse Job Board
            </Link>
          </div>
        ) : viewMode === 'kanban' ? (
          /* Kanban Board View */
          <div className="flex gap-4 overflow-x-auto pb-6 scrollbar-thin">
            {STATUS_COLUMNS.map((col) => {
              const colApps = applications.filter((a) => a.status === col.id);

              return (
                <div
                  key={col.id}
                  className="w-72 shrink-0 bg-slate-900/40 border border-slate-800 rounded-3xl p-3.5 flex flex-col space-y-3 min-h-[500px]"
                >
                  {/* Column Header */}
                  <div className="flex items-center justify-between px-2 py-1">
                    <div className="flex items-center gap-2">
                      <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold border uppercase ${col.color} ${col.border}`}>
                        {col.label}
                      </span>
                    </div>
                    <span className="text-xs font-mono font-bold text-slate-500">
                      {colApps.length}
                    </span>
                  </div>

                  {/* Cards Stack */}
                  <div className="space-y-2.5 flex-1">
                    {colApps.map((app) => (
                      <div
                        key={app.id}
                        className="p-4 rounded-2xl bg-slate-950/80 border border-slate-800 hover:border-slate-700 transition-all space-y-3 group shadow-sm"
                      >
                        <div className="space-y-1">
                          <div className="flex items-start justify-between gap-1">
                            <Link
                              href={`/applications/${app.id}`}
                              className="font-bold text-xs text-slate-100 group-hover:text-sky-400 transition-colors line-clamp-2"
                            >
                              {app.job?.title}
                            </Link>
                            {app.match?.matchScore && (
                              <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 shrink-0">
                                {app.match.matchScore}%
                              </span>
                            )}
                          </div>
                          <div className="text-[11px] font-medium text-slate-400">
                            {app.job?.company}
                          </div>
                        </div>

                        {/* Badges & Follow-up */}
                        <div className="flex items-center justify-between text-[10px] text-slate-500 pt-2 border-t border-slate-800/80">
                          <span>{app.job?.location || 'Remote'}</span>
                          {app.nextFollowUpAt && (
                            <span className="text-amber-400 font-mono flex items-center gap-1 font-semibold">
                              <Clock className="w-3 h-3" />
                              {new Date(app.nextFollowUpAt).toLocaleDateString([], { month: 'short', day: 'numeric' })}
                            </span>
                          )}
                        </div>

                        {/* Quick Actions & Move Selector */}
                        <div className="pt-1 flex items-center justify-between text-xs gap-2">
                          <div className="flex items-center gap-2">
                            {app.job?.jobUrl && (
                              <a
                                href={app.job.jobUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 text-[10px] text-emerald-400 hover:text-emerald-300 font-semibold"
                                title="Open job application URL"
                              >
                                <span>Apply</span>
                                <ExternalLink className="w-2.5 h-2.5" />
                              </a>
                            )}
                            <Link
                              href={`/applications/${app.id}`}
                              className="text-[11px] text-sky-400 hover:text-sky-300 font-semibold"
                            >
                              Hub →
                            </Link>
                          </div>

                          <select
                            value={app.status}
                            onChange={(e) => handleStatusChange(app.id, e.target.value as ApplicationStatus)}
                            className="bg-slate-900 border border-slate-800 rounded-lg px-2 py-1 text-[10px] text-slate-300 focus:outline-none focus:border-sky-500"
                          >
                            {STATUS_COLUMNS.map((st) => (
                              <option key={st.id} value={st.id}>
                                Move to {st.label}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          /* Table View */
          <div className="bg-slate-900/60 border border-slate-800 rounded-3xl overflow-hidden shadow-xl">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-slate-800 bg-slate-950/60 text-slate-400 text-[11px] uppercase tracking-wider font-semibold">
                    <th className="py-3.5 px-4">Opportunity</th>
                    <th className="py-3.5 px-4">Company</th>
                    <th className="py-3.5 px-4">Match</th>
                    <th className="py-3.5 px-4">Status</th>
                    <th className="py-3.5 px-4">Applied Date</th>
                    <th className="py-3.5 px-4">Next Follow-Up</th>
                    <th className="py-3.5 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {applications.map((app) => (
                    <tr
                      key={app.id}
                      className="hover:bg-slate-900/40 transition-colors group"
                    >
                      <td className="py-3.5 px-4">
                        <Link
                          href={`/applications/${app.id}`}
                          className="font-bold text-slate-100 group-hover:text-sky-400 transition-colors line-clamp-1"
                        >
                          {app.job?.title}
                        </Link>
                        <span className="text-[10px] text-slate-500">
                          {app.job?.location || 'Remote'}
                        </span>
                      </td>

                      <td className="py-3.5 px-4 text-slate-300 font-medium">
                        {app.job?.company}
                      </td>

                      <td className="py-3.5 px-4">
                        {app.match?.matchScore ? (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                            {app.match.matchScore}%
                          </span>
                        ) : (
                          <span className="text-slate-600">—</span>
                        )}
                      </td>

                      <td className="py-3.5 px-4">
                        <select
                          value={app.status}
                          onChange={(e) => handleStatusChange(app.id, e.target.value as ApplicationStatus)}
                          className={`px-2 py-1 rounded-lg text-[10px] font-bold uppercase border focus:outline-none ${getBadgeClass(
                            app.status
                          )}`}
                        >
                          {STATUS_COLUMNS.map((st) => (
                            <option key={st.id} value={st.id} className="bg-slate-950 text-slate-200">
                              {st.label}
                            </option>
                          ))}
                        </select>
                      </td>

                      <td className="py-3.5 px-4 text-slate-400">
                        {app.appliedAt ? new Date(app.appliedAt).toLocaleDateString() : '—'}
                      </td>

                      <td className="py-3.5 px-4">
                        {app.nextFollowUpAt ? (
                          <span className="text-amber-300 font-mono text-[11px] flex items-center gap-1 font-semibold">
                            <Clock className="w-3 h-3" />
                            {new Date(app.nextFollowUpAt).toLocaleDateString()}
                          </span>
                        ) : (
                          <span className="text-slate-600">—</span>
                        )}
                      </td>

                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          {app.job?.jobUrl && (
                            <a
                              href={app.job.jobUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/30 text-xs font-semibold transition-colors"
                              title="Apply on Employer Site"
                            >
                              <span>Apply</span>
                              <ExternalLink className="w-3 h-3" />
                            </a>
                          )}
                          <Link
                            href={`/applications/${app.id}`}
                            className="inline-flex items-center gap-1 px-3 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-300 text-xs font-semibold transition-colors"
                          >
                            <span>Open Hub</span>
                            <ChevronRight className="w-3.5 h-3.5" />
                          </Link>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

export default function ApplicationsPage() {
  return (
    <React.Suspense
      fallback={
        <div className="min-h-screen bg-slate-950 text-slate-400 flex items-center justify-center font-sans">
          <div className="flex items-center gap-2 text-xs">
            <div className="w-4 h-4 border-2 border-sky-400 border-t-transparent rounded-full animate-spin" />
            <span>Loading Application Tracker...</span>
          </div>
        </div>
      }
    >
      <ApplicationsContent />
    </React.Suspense>
  );
}
