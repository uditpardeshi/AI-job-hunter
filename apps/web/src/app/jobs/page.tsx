'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import {
  Briefcase,
  Search,
  MapPin,
  Globe,
  SlidersHorizontal,
  RefreshCw,
  Building2,
  Calendar,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  DollarSign,
  Tag,
  Clock,
  Layers,
  Sparkles,
  CheckCircle,
  AlertCircle,
  TrendingUp,
  Bookmark,
  Check,
} from 'lucide-react';
import { Navbar } from '@/components/Navbar';
import { Job, RemoteType, EmploymentType, ApplicationStatus } from '@ai-job-hunter/shared';
import { authFetch } from '@/lib/api';

type EnrichedJob = Job & {
  matchScore?: number | null;
  matchedSkills?: string[];
  missingRequiredSkills?: string[];
};

export default function JobsPage() {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

  const [jobs, setJobs] = useState<EnrichedJob[]>([]);
  const [totalJobs, setTotalJobs] = useState<number>(0);
  const [totalPages, setTotalPages] = useState<number>(1);
  const [page, setPage] = useState<number>(1);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [syncMessage, setSyncMessage] = useState<string | null>(null);
  const [isRecalculating, setIsRecalculating] = useState<boolean>(false);
  const [recalcMessage, setRecalcMessage] = useState<string | null>(null);

  // Active user applications map: jobId -> { id, status }
  const [applicationsMap, setApplicationsMap] = useState<Record<string, { id: string; status: ApplicationStatus }>>({});

  // Filters state
  const [keyword, setKeyword] = useState<string>('');
  const [location, setLocation] = useState<string>('');
  const [remoteType, setRemoteType] = useState<string>('');
  const [employmentType, setEmploymentType] = useState<string>('');
  const [source, setSource] = useState<string>('');
  const [appStatusFilter, setAppStatusFilter] = useState<string>('ALL');
  const [sortBy, setSortBy] = useState<'match' | 'posted_at' | 'created_at'>('match');

  const fetchApplications = async () => {
    try {
      const res = await authFetch(`${apiUrl}/api/applications?limit=100`, { cache: 'no-store' });
      if (res.ok) {
        const json = await res.json();
        const map: Record<string, { id: string; status: ApplicationStatus }> = {};
        for (const app of json.data || []) {
          map[app.jobId] = { id: app.id, status: app.status };
        }
        setApplicationsMap(map);
      }
    } catch (err) {
      console.error('Failed to fetch user applications:', err);
    }
  };

  const fetchJobs = useCallback(async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      params.append('page', String(page));
      params.append('limit', '12');
      params.append('sortBy', sortBy);
      params.append('sortOrder', 'DESC');

      if (keyword.trim()) params.append('q', keyword.trim());
      if (location.trim()) params.append('location', location.trim());
      if (remoteType) params.append('remoteType', remoteType);
      if (employmentType) params.append('employmentType', employmentType);
      if (source) params.append('source', source);

      const res = await authFetch(`${apiUrl}/api/jobs?${params.toString()}`, {
        cache: 'no-store',
      });
      if (res.ok) {
        const data = await res.json();
        setJobs(data.jobs || []);
        setTotalJobs(data.pagination?.total || 0);
        setTotalPages(data.pagination?.totalPages || 1);
      }
    } catch (err) {
      console.error('Failed to fetch jobs:', err);
    } finally {
      setIsLoading(false);
    }
  }, [apiUrl, page, keyword, location, remoteType, employmentType, source, sortBy]);

  useEffect(() => {
    fetchApplications();
    fetchJobs();
  }, [fetchJobs]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    fetchJobs();
  };

  const handleQuickSave = async (jobId: string, status: ApplicationStatus) => {
    try {
      const res = await authFetch(`${apiUrl}/api/applications`, {
        method: 'POST',
        body: JSON.stringify({ jobId, status }),
      });
      const json = await res.json();
      if (res.ok) {
        setApplicationsMap((prev) => ({
          ...prev,
          [jobId]: { id: json.data.id, status: json.data.status },
        }));
      } else {
        alert(json.error || json.message || 'Failed to save job');
      }
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleSyncJobs = async () => {
    setIsSyncing(true);
    setSyncMessage(null);
    try {
      const res = await authFetch(`${apiUrl}/api/jobs/sync`, {
        method: 'POST',
      });
      const data = await res.json();
      if (res.ok) {
        setSyncMessage(`Synced ${data.totalFound || 0} jobs across all active sources.`);
        await fetchJobs();
      } else {
        setSyncMessage(`Sync error: ${data.message || data.error || 'Failed'}`);
      }
    } catch (err) {
      setSyncMessage('Failed to trigger job collection.');
    } finally {
      setIsSyncing(false);
    }
  };

  const handleRecalculateMatches = async () => {
    setIsRecalculating(true);
    setRecalcMessage(null);
    try {
      const res = await authFetch(`${apiUrl}/api/matches/recalculate`, {
        method: 'POST',
      });
      const data = await res.json();
      if (res.ok) {
        setRecalcMessage(`Matches updated for ${data.data?.totalMatched || 0} active jobs.`);
        await fetchJobs();
      } else {
        setRecalcMessage(`Recalculation error: ${data.error || data.message || 'Failed'}`);
      }
    } catch (err) {
      setRecalcMessage('Failed to trigger match recalculation.');
    } finally {
      setIsRecalculating(false);
    }
  };

  const formatSalary = (job: Job) => {
    if (job.salaryMin && job.salaryMax) {
      return `${job.salaryCurrency || '$'}${Number(job.salaryMin).toLocaleString()} - ${Number(
        job.salaryMax
      ).toLocaleString()}`;
    }
    if (job.salaryMin) {
      return `From ${job.salaryCurrency || '$'}${Number(job.salaryMin).toLocaleString()}`;
    }
    if (job.salaryMax) {
      return `Up to ${job.salaryCurrency || '$'}${Number(job.salaryMax).toLocaleString()}`;
    }
    return null;
  };

  const getMatchScoreBadge = (score: number | null | undefined) => {
    if (score === null || score === undefined) return null;
    let colorClass = 'bg-slate-800/80 text-slate-300 border-slate-700';
    if (score >= 80) {
      colorClass = 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30';
    } else if (score >= 65) {
      colorClass = 'bg-sky-500/15 text-sky-400 border-sky-500/30';
    } else if (score >= 50) {
      colorClass = 'bg-amber-500/15 text-amber-400 border-amber-500/30';
    } else {
      colorClass = 'bg-rose-500/15 text-rose-400 border-rose-500/30';
    }

    return (
      <span
        className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold border ${colorClass}`}
      >
        <Sparkles className="w-3 h-3" />
        <span>{score}% Match</span>
      </span>
    );
  };

  const filteredJobs = jobs.filter((job) => {
    if (appStatusFilter === 'ALL') return true;
    const app = applicationsMap[job.id];
    if (appStatusFilter === 'UNSAVED') return !app;
    if (appStatusFilter === 'SAVED') return app?.status === 'SAVED';
    if (appStatusFilter === 'SHORTLISTED') return app?.status === 'SHORTLISTED';
    if (appStatusFilter === 'APPLIED') return app?.status === 'APPLIED';
    return true;
  });

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-sky-500/20">
      <Navbar />

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 w-full space-y-6">
        {/* Top Header Title & Actions */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-sky-400">
              <Briefcase className="w-3.5 h-3.5" />
              <span>Job Discovery & Intelligence</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-100">
              Active Job Opportunities
            </h1>
            <p className="text-xs text-slate-400">
              Browse, match, shortlist, and tailor application materials for verified opportunities.
            </p>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              onClick={handleRecalculateMatches}
              disabled={isRecalculating}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 border border-indigo-500/30 text-xs font-semibold transition-all disabled:opacity-50"
            >
              <TrendingUp className={`w-3.5 h-3.5 ${isRecalculating ? 'animate-spin' : ''}`} />
              <span>{isRecalculating ? 'Recalculating...' : 'Recalculate Fit'}</span>
            </button>

            <button
              onClick={handleSyncJobs}
              disabled={isSyncing}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-sky-600 hover:bg-sky-500 text-white text-xs font-semibold shadow-lg shadow-sky-600/20 transition-all disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
              <span>{isSyncing ? 'Syncing...' : 'Sync Jobs'}</span>
            </button>
          </div>
        </div>

        {/* Sync & Recalculate Alerts */}
        {syncMessage && (
          <div className="bg-sky-500/10 border border-sky-500/30 text-sky-300 px-4 py-2.5 rounded-xl text-xs flex items-center justify-between animate-fadeIn">
            <span>{syncMessage}</span>
            <button
              onClick={() => setSyncMessage(null)}
              className="text-sky-400 hover:text-sky-200 font-bold ml-4"
            >
              ×
            </button>
          </div>
        )}

        {recalcMessage && (
          <div className="bg-indigo-500/10 border border-indigo-500/30 text-indigo-300 px-4 py-2.5 rounded-xl text-xs flex items-center justify-between animate-fadeIn">
            <span>{recalcMessage}</span>
            <button
              onClick={() => setRecalcMessage(null)}
              className="text-indigo-400 hover:text-indigo-200 font-bold ml-4"
            >
              ×
            </button>
          </div>
        )}

        {/* Filter and Search Panel */}
        <div className="bg-slate-900/40 border border-slate-800/80 rounded-2xl p-5 space-y-4 shadow-xl">
          <form onSubmit={handleSearchSubmit} className="flex flex-col md:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="w-4 h-4 absolute left-3.5 top-3 text-slate-500" />
              <input
                type="text"
                placeholder="Search job title, skills, or company..."
                value={keyword}
                onChange={(e) => setKeyword(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-4 py-2 text-xs text-slate-200 focus:outline-none focus:border-sky-500"
              />
            </div>

            <div className="relative md:w-60">
              <MapPin className="w-4 h-4 absolute left-3.5 top-3 text-slate-500" />
              <input
                type="text"
                placeholder="Location (e.g. Remote, Berlin)"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-4 py-2 text-xs text-slate-200 focus:outline-none focus:border-sky-500"
              />
            </div>

            <button
              type="submit"
              className="px-5 py-2 bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-200 rounded-xl text-xs font-semibold transition-colors"
            >
              Search
            </button>
          </form>

          {/* Secondary Controls Bar */}
          <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-slate-800/60 text-xs">
            <div className="flex flex-wrap items-center gap-2">
              <SlidersHorizontal className="w-3.5 h-3.5 text-slate-500 mr-1" />

              {/* Status Filter */}
              <select
                value={appStatusFilter}
                onChange={(e) => setAppStatusFilter(e.target.value)}
                className="bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-slate-300 text-xs focus:outline-none focus:border-sky-500"
              >
                <option value="ALL">All Application States</option>
                <option value="SAVED">Saved Only</option>
                <option value="SHORTLISTED">Shortlisted Only</option>
                <option value="APPLIED">Applied Only</option>
                <option value="UNSAVED">Not Yet Saved</option>
              </select>

              {/* Remote Filter */}
              <select
                value={remoteType}
                onChange={(e) => {
                  setRemoteType(e.target.value);
                  setPage(1);
                }}
                className="bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-slate-300 text-xs focus:outline-none focus:border-sky-500"
              >
                <option value="">All Work Styles</option>
                <option value="remote">Remote Only</option>
                <option value="hybrid">Hybrid</option>
                <option value="onsite">On-Site</option>
              </select>

              {/* Employment Type */}
              <select
                value={employmentType}
                onChange={(e) => {
                  setEmploymentType(e.target.value);
                  setPage(1);
                }}
                className="bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-slate-300 text-xs focus:outline-none focus:border-sky-500"
              >
                <option value="">All Contract Types</option>
                <option value="full_time">Full Time</option>
                <option value="part_time">Part Time</option>
                <option value="contract">Contract</option>
                <option value="internship">Internship</option>
              </select>

              {/* Source */}
              <select
                value={source}
                onChange={(e) => {
                  setSource(e.target.value);
                  setPage(1);
                }}
                className="bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-slate-300 text-xs focus:outline-none focus:border-sky-500"
              >
                <option value="">All Sources</option>
                <option value="arbeitnow">Arbeitnow</option>
                <option value="remoteok">RemoteOK</option>
                <option value="himalayas">Himalayas</option>
                <option value="mock">Mock / Demo</option>
              </select>
            </div>

            {/* Sort Selector */}
            <div className="flex items-center gap-2">
              <span className="text-slate-500">Sort:</span>
              <select
                value={sortBy}
                onChange={(e) => {
                  setSortBy(e.target.value as any);
                  setPage(1);
                }}
                className="bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-slate-300 text-xs focus:outline-none focus:border-sky-500"
              >
                <option value="match">AI Match Score</option>
                <option value="posted_at">Posted Date</option>
                <option value="created_at">Date Collected</option>
              </select>
            </div>
          </div>
        </div>

        {/* Results Info Counter */}
        <div className="flex items-center justify-between text-xs text-slate-400 px-1">
          <div>
            Showing <span className="text-slate-200 font-semibold">{filteredJobs.length}</span> of{' '}
            <span className="text-slate-200 font-semibold">{totalJobs}</span> matching roles
          </div>
          <div>Page {page} of {totalPages}</div>
        </div>

        {/* Job Cards Grid */}
        {isLoading ? (
          <div className="py-24 text-center space-y-3">
            <RefreshCw className="w-8 h-8 text-sky-400 animate-spin mx-auto" />
            <p className="text-xs text-slate-500">Querying internal job database...</p>
          </div>
        ) : filteredJobs.length === 0 ? (
          <div className="py-20 text-center bg-slate-900/40 border border-slate-800 rounded-2xl p-8 space-y-3">
            <Layers className="w-10 h-10 text-slate-600 mx-auto" />
            <h3 className="font-semibold text-slate-300 text-base">No matching jobs found</h3>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              Try adjusting your search criteria or click "Sync Jobs" to fetch the latest postings.
            </p>
            <button
              onClick={handleSyncJobs}
              className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-200 border border-slate-700"
            >
              Sync Latest Jobs
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filteredJobs.map((job) => {
              const salaryText = formatSalary(job);
              const appInfo = applicationsMap[job.id];

              return (
                <div
                  key={job.id}
                  className="bg-slate-900/60 border border-slate-800 hover:border-slate-700 rounded-2xl p-5 flex flex-col justify-between transition-all hover:bg-slate-900/90 group"
                >
                  <div className="space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <Link
                          href={`/jobs/${job.id}`}
                          className="font-bold text-slate-100 text-base hover:text-sky-400 transition-colors line-clamp-1"
                        >
                          {job.title}
                        </Link>
                        <div className="flex items-center gap-1.5 text-xs text-slate-400 mt-0.5">
                          <Building2 className="w-3.5 h-3.5 text-slate-500" />
                          <span>{job.company}</span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        {getMatchScoreBadge(job.matchScore)}
                        <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded bg-slate-800/80 text-slate-400 border border-slate-700 shrink-0">
                          {job.sourceId}
                        </span>
                      </div>
                    </div>

                    {/* Metadata Badges */}
                    <div className="flex flex-wrap items-center gap-2 text-xs">
                      {job.location && (
                        <span className="inline-flex items-center gap-1 text-slate-400">
                          <MapPin className="w-3 h-3 text-slate-500" />
                          {job.location}
                        </span>
                      )}

                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium capitalize ${
                          job.remoteType === 'remote'
                            ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                            : job.remoteType === 'hybrid'
                            ? 'bg-sky-500/10 text-sky-400 border border-sky-500/20'
                            : 'bg-slate-800 text-slate-300 border border-slate-700'
                        }`}
                      >
                        {job.remoteType || 'On-Site'}
                      </span>

                      {job.employmentType && job.employmentType !== 'unknown' && (
                        <span className="text-slate-500 capitalize">
                          {job.employmentType.replace('_', ' ')}
                        </span>
                      )}

                      {salaryText && (
                        <span className="inline-flex items-center gap-0.5 text-slate-300 font-medium">
                          <DollarSign className="w-3 h-3 text-slate-400" />
                          {salaryText}
                        </span>
                      )}
                    </div>

                    {/* Application Status Pill if exists */}
                    {appInfo && (
                      <div className="flex items-center gap-2 pt-1">
                        <span className="text-[10px] text-slate-400 font-semibold uppercase">Tracker Status:</span>
                        <Link
                          href={`/applications/${appInfo.id}`}
                          className="px-2.5 py-0.5 rounded-md text-[10px] font-bold uppercase bg-indigo-500/15 text-indigo-300 border border-indigo-500/30 hover:bg-indigo-500/25 transition-colors"
                        >
                          {appInfo.status} →
                        </Link>
                      </div>
                    )}
                  </div>

                  {/* Card Footer Actions */}
                  <div className="flex items-center justify-between pt-4 mt-3 border-t border-slate-800/80 text-xs text-slate-500">
                    <div className="flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      <span>
                        {job.postedAt
                          ? new Date(job.postedAt).toLocaleDateString(undefined, {
                              month: 'short',
                              day: 'numeric',
                            })
                          : 'Recently'}
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      {job.jobUrl && (
                        <a
                          href={job.jobUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/30 text-[11px] font-bold transition-all shadow-sm shadow-emerald-950/40"
                          title="Open application page on company/source website"
                        >
                          <span>Apply on Site</span>
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      )}

                      {!appInfo ? (
                        <>
                          <button
                            onClick={() => handleQuickSave(job.id, 'SAVED')}
                            className="px-2.5 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 text-[11px] font-semibold transition-colors"
                          >
                            Save
                          </button>
                          <button
                            onClick={() => handleQuickSave(job.id, 'SHORTLISTED')}
                            className="px-2.5 py-1 rounded-lg bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 border border-indigo-500/30 text-[11px] font-semibold transition-colors"
                          >
                            Shortlist
                          </button>
                        </>
                      ) : (
                        <button
                          onClick={() => handleQuickSave(job.id, 'APPLIED')}
                          disabled={appInfo.status === 'APPLIED'}
                          className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-colors border ${
                            appInfo.status === 'APPLIED'
                              ? 'bg-emerald-950/40 text-emerald-400 border-emerald-800/40 cursor-default'
                              : 'bg-sky-600/20 hover:bg-sky-600/30 text-sky-300 border-sky-500/30'
                          }`}
                        >
                          {appInfo.status === 'APPLIED' ? '✓ Applied' : 'Mark Applied'}
                        </button>
                      )}

                      <Link
                        href={`/jobs/${job.id}`}
                        className="font-semibold text-sky-400 hover:text-sky-300 transition-colors ml-1 inline-flex items-center gap-0.5"
                      >
                        Details →
                      </Link>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Pagination Controls */}
        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-2 pt-6">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="p-2 rounded-xl bg-slate-900 border border-slate-800 text-slate-400 hover:text-slate-200 disabled:opacity-30 disabled:pointer-events-none transition-all"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>

            <span className="text-xs text-slate-400 px-3">
              {page} / {totalPages}
            </span>

            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="p-2 rounded-xl bg-slate-900 border border-slate-800 text-slate-400 hover:text-slate-200 disabled:opacity-30 disabled:pointer-events-none transition-all"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        )}
      </main>
    </div>
  );
}
