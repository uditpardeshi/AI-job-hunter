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
  Sparkles
} from 'lucide-react';
import { Job, RemoteType, EmploymentType } from '@ai-job-hunter/shared';

export default function JobsPage() {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

  const [jobs, setJobs] = useState<Job[]>([]);
  const [totalJobs, setTotalJobs] = useState<number>(0);
  const [totalPages, setTotalPages] = useState<number>(1);
  const [page, setPage] = useState<number>(1);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [syncMessage, setSyncMessage] = useState<string | null>(null);

  // Filters state
  const [keyword, setKeyword] = useState<string>('');
  const [location, setLocation] = useState<string>('');
  const [remoteType, setRemoteType] = useState<string>('');
  const [employmentType, setEmploymentType] = useState<string>('');
  const [source, setSource] = useState<string>('');

  const fetchJobs = useCallback(async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      params.append('page', String(page));
      params.append('limit', '12');

      if (keyword.trim()) params.append('q', keyword.trim());
      if (location.trim()) params.append('location', location.trim());
      if (remoteType) params.append('remoteType', remoteType);
      if (employmentType) params.append('employmentType', employmentType);
      if (source) params.append('source', source);

      const res = await fetch(`${apiUrl}/api/jobs?${params.toString()}`, {
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
  }, [apiUrl, page, keyword, location, remoteType, employmentType, source]);

  useEffect(() => {
    fetchJobs();
  }, [fetchJobs]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    fetchJobs();
  };

  const handleSyncJobs = async () => {
    setIsSyncing(true);
    setSyncMessage(null);
    try {
      const res = await fetch(`${apiUrl}/api/jobs/sync`, {
        method: 'POST',
      });
      const data = await res.json();
      if (res.ok || res.status === 207) {
        const totalCreated = (data.results || []).reduce(
          (acc: number, r: any) => acc + (r.jobsCreated || 0),
          0
        );
        const totalUpdated = (data.results || []).reduce(
          (acc: number, r: any) => acc + (r.jobsUpdated || 0),
          0
        );
        setSyncMessage(`Sync completed: ${totalCreated} new jobs added, ${totalUpdated} updated.`);
        await fetchJobs();
      } else {
        setSyncMessage(`Sync error: ${data.message || 'Failed'}`);
      }
    } catch (err: any) {
      setSyncMessage(`Sync failed: ${err.message}`);
    } finally {
      setIsSyncing(false);
      setTimeout(() => setSyncMessage(null), 5000);
    }
  };

  const formatSalary = (job: Job) => {
    if (!job.salaryMin && !job.salaryMax) return null;
    const curr = job.salaryCurrency || '$';
    if (job.salaryMin && job.salaryMax) {
      return `${curr} ${job.salaryMin.toLocaleString()} - ${job.salaryMax.toLocaleString()}`;
    }
    if (job.salaryMin) return `From ${curr} ${job.salaryMin.toLocaleString()}`;
    return `Up to ${curr} ${job.salaryMax?.toLocaleString()}`;
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      {/* Top Navbar */}
      <header className="border-b border-slate-800 bg-slate-900/80 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link
              href="/"
              className="text-xs text-slate-400 hover:text-slate-200 transition-colors"
            >
              System Status
            </Link>
            <span className="text-slate-700">|</span>
            <Link
              href="/resume"
              className="text-xs text-slate-400 hover:text-slate-200 transition-colors"
            >
              Candidate Profile
            </Link>
            <span className="text-slate-700">|</span>
            <div className="flex items-center gap-2">
              <Briefcase className="w-5 h-5 text-sky-400" />
              <span className="font-bold text-slate-100 text-lg">Job Database</span>
            </div>
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-sky-500/10 border border-sky-500/20 text-sky-400">
              Step 3
            </span>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={handleSyncJobs}
              disabled={isSyncing}
              className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-700 transition-colors disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin text-sky-400' : ''}`} />
              {isSyncing ? 'Syncing Sources...' : 'Sync Jobs'}
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-8 flex-1 w-full space-y-6">
        {/* Sync Feedback Message */}
        {syncMessage && (
          <div className="p-4 rounded-xl bg-sky-500/10 border border-sky-500/20 text-sky-300 text-xs flex items-center gap-2 animate-fadeIn">
            <Sparkles className="w-4 h-4 shrink-0 text-sky-400" />
            <span>{syncMessage}</span>
          </div>
        )}

        {/* Search & Filter Header Banner */}
        <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
          <form onSubmit={handleSearchSubmit} className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={keyword}
                onChange={(e) => setKeyword(e.target.value)}
                placeholder="Search jobs by title, company, or tech stack..."
                className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-sky-500"
              />
            </div>

            <div className="relative sm:w-60">
              <MapPin className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="Location (e.g. Bengaluru, Remote)..."
                className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-sky-500"
              />
            </div>

            <button
              type="submit"
              className="px-5 py-2.5 rounded-xl bg-sky-600 hover:bg-sky-500 text-white font-semibold text-xs transition-all shadow-lg shadow-sky-600/20 shrink-0"
            >
              Search
            </button>
          </form>

          {/* Filters Bar */}
          <div className="flex flex-wrap items-center gap-3 pt-2 border-t border-slate-800/80 text-xs">
            <div className="flex items-center gap-1.5 text-slate-400">
              <SlidersHorizontal className="w-3.5 h-3.5" />
              <span>Filters:</span>
            </div>

            {/* Remote Filter */}
            <select
              value={remoteType}
              onChange={(e) => {
                setRemoteType(e.target.value);
                setPage(1);
              }}
              className="px-3 py-1.5 rounded-lg bg-slate-950 border border-slate-800 text-slate-300 focus:outline-none focus:border-slate-700"
            >
              <option value="">All Work Styles</option>
              <option value="remote">Remote Only</option>
              <option value="hybrid">Hybrid</option>
              <option value="onsite">On-Site</option>
            </select>

            {/* Employment Filter */}
            <select
              value={employmentType}
              onChange={(e) => {
                setEmploymentType(e.target.value);
                setPage(1);
              }}
              className="px-3 py-1.5 rounded-lg bg-slate-950 border border-slate-800 text-slate-300 focus:outline-none focus:border-slate-700"
            >
              <option value="">All Employment Types</option>
              <option value="full_time">Full-Time</option>
              <option value="part_time">Part-Time</option>
              <option value="contract">Contract</option>
              <option value="internship">Internship</option>
            </select>

            {/* Source Filter */}
            <select
              value={source}
              onChange={(e) => {
                setSource(e.target.value);
                setPage(1);
              }}
              className="px-3 py-1.5 rounded-lg bg-slate-950 border border-slate-800 text-slate-300 focus:outline-none focus:border-slate-700"
            >
              <option value="">All Sources</option>
              <option value="mock">Mock Provider</option>
              <option value="arbeitnow">Arbeitnow API</option>
            </select>

            {(keyword || location || remoteType || employmentType || source) && (
              <button
                type="button"
                onClick={() => {
                  setKeyword('');
                  setLocation('');
                  setRemoteType('');
                  setEmploymentType('');
                  setSource('');
                  setPage(1);
                }}
                className="text-slate-500 hover:text-rose-400 text-xs ml-auto transition-colors"
              >
                Clear all filters
              </button>
            )}
          </div>
        </div>

        {/* Results Info & Count */}
        <div className="flex items-center justify-between text-xs text-slate-400 px-1">
          <div>
            Showing <span className="text-slate-200 font-semibold">{jobs.length}</span> of{' '}
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
        ) : jobs.length === 0 ? (
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
            {jobs.map((job) => {
              const salaryText = formatSalary(job);
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

                      <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded bg-slate-800/80 text-slate-400 border border-slate-700 shrink-0">
                        {job.sourceId}
                      </span>
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
                            : 'bg-slate-800 text-slate-400'
                        }`}
                      >
                        {job.remoteType}
                      </span>

                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-slate-800 text-slate-300 capitalize">
                        {job.employmentType.replace('_', ' ')}
                      </span>

                      {salaryText && (
                        <span className="inline-flex items-center gap-1 text-emerald-400 font-medium">
                          <DollarSign className="w-3 h-3" />
                          {salaryText}
                        </span>
                      )}
                    </div>

                    {/* Description preview */}
                    <p className="text-xs text-slate-400 line-clamp-2 leading-relaxed">
                      {job.description}
                    </p>

                    {/* Skills pills */}
                    {job.skills && job.skills.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 pt-1">
                        {job.skills.slice(0, 4).map((s, idx) => (
                          <span
                            key={idx}
                            className="px-2 py-0.5 rounded bg-slate-950 border border-slate-800 text-[10px] text-slate-400"
                          >
                            {s}
                          </span>
                        ))}
                        {job.skills.length > 4 && (
                          <span className="text-[10px] text-slate-500 self-center">
                            +{job.skills.length - 4} more
                          </span>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Footer Action */}
                  <div className="pt-4 mt-3 border-t border-slate-800/60 flex items-center justify-between text-xs">
                    <span className="text-[11px] text-slate-500 flex items-center gap-1">
                      <Calendar className="w-3 h-3" />
                      {job.postedAt
                        ? `Posted ${new Date(job.postedAt).toLocaleDateString()}`
                        : 'Recently posted'}
                    </span>

                    <div className="flex items-center gap-2">
                      {job.jobUrl && (
                        <a
                          href={job.jobUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="p-1.5 rounded-lg text-slate-500 hover:text-slate-200 transition-colors"
                          title="Open original listing"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                        </a>
                      )}
                      <Link
                        href={`/jobs/${job.id}`}
                        className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 font-medium transition-colors"
                      >
                        View Job →
                      </Link>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Pagination Bar */}
        {totalPages > 1 && (
          <div className="pt-6 flex items-center justify-center gap-3">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="p-2 rounded-xl bg-slate-900 border border-slate-800 text-slate-300 hover:bg-slate-800 disabled:opacity-40 transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>

            <span className="text-xs text-slate-400 font-mono px-3">
              Page {page} of {totalPages}
            </span>

            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="p-2 rounded-xl bg-slate-900 border border-slate-800 text-slate-300 hover:bg-slate-800 disabled:opacity-40 transition-colors"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        )}
      </main>
    </div>
  );
}
