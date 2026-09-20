'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import {
  ArrowLeft,
  Building2,
  MapPin,
  Calendar,
  ExternalLink,
  DollarSign,
  Briefcase,
  Layers,
  Clock,
  CheckCircle2,
  ShieldCheck,
  Tag
} from 'lucide-react';
import { Job } from '@ai-job-hunter/shared';

export default function JobDetailPage() {
  const params = useParams();
  const id = params?.id as string;
  const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

  const [job, setJob] = useState<Job | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchJob() {
      if (!id) return;
      setIsLoading(true);
      try {
        const res = await fetch(`${apiUrl}/api/jobs/${id}`, { cache: 'no-store' });
        if (!res.ok) {
          throw new Error(`Job not found (HTTP ${res.status})`);
        }
        const data = await res.json();
        setJob(data.job);
      } catch (err: any) {
        setError(err.message || 'Failed to load job details');
      } finally {
        setIsLoading(false);
      }
    }
    fetchJob();
  }, [id, apiUrl]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-6">
        <div className="text-center space-y-3">
          <div className="w-8 h-8 border-2 border-sky-400 border-t-transparent rounded-full animate-spin mx-auto"></div>
          <p className="text-xs text-slate-400">Loading job details...</p>
        </div>
      </div>
    );
  }

  if (error || !job) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col items-center justify-center p-6 space-y-4">
        <Layers className="w-12 h-12 text-rose-400" />
        <h2 className="text-xl font-bold text-slate-200">{error || 'Job Not Found'}</h2>
        <Link
          href="/jobs"
          className="px-4 py-2 rounded-xl bg-slate-900 border border-slate-800 text-xs font-semibold text-slate-300 hover:bg-slate-800 transition-colors"
        >
          ← Back to All Jobs
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      {/* Top Navbar */}
      <header className="border-b border-slate-800 bg-slate-900/80 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <Link
            href="/jobs"
            className="inline-flex items-center gap-2 text-xs font-medium text-slate-400 hover:text-slate-200 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Job Board
          </Link>

          <div className="flex items-center gap-3">
            {job.jobUrl && (
              <a
                href={job.jobUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-sky-600 hover:bg-sky-500 text-white text-xs font-semibold shadow-lg shadow-sky-600/20 transition-all"
              >
                <span>Apply on Original Site</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            )}
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-8 flex-1 w-full space-y-8">
        {/* Header Hero */}
        <div className="bg-slate-900/60 border border-slate-800 rounded-3xl p-6 md:p-8 space-y-6 shadow-xl relative overflow-hidden">
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2.5">
              <span className="text-xs uppercase font-mono px-2.5 py-1 rounded-md bg-slate-800 text-sky-400 border border-slate-700">
                Source: {job.sourceId}
              </span>
              <span className="text-xs px-2.5 py-1 rounded-md bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 font-semibold uppercase">
                {job.status}
              </span>
            </div>

            <h1 className="text-3xl md:text-4xl font-extrabold text-slate-100 tracking-tight">
              {job.title}
            </h1>

            <div className="flex flex-wrap items-center gap-4 text-sm text-slate-300 pt-1">
              <div className="flex items-center gap-1.5 font-semibold">
                <Building2 className="w-4 h-4 text-slate-400" />
                <span>{job.company}</span>
              </div>

              {job.location && (
                <div className="flex items-center gap-1.5 text-slate-400">
                  <MapPin className="w-4 h-4 text-slate-500" />
                  <span>{job.location}</span>
                </div>
              )}

              <div className="flex items-center gap-1.5 text-slate-400">
                <Calendar className="w-4 h-4 text-slate-500" />
                <span>
                  {job.postedAt
                    ? `Posted ${new Date(job.postedAt).toLocaleDateString()}`
                    : 'Recently posted'}
                </span>
              </div>
            </div>
          </div>

          {/* Quick Specifications Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-4 border-t border-slate-800/80 text-xs">
            <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800/80">
              <div className="text-slate-500 mb-1">Work Style</div>
              <div className="font-semibold text-slate-200 capitalize">{job.remoteType}</div>
            </div>

            <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800/80">
              <div className="text-slate-500 mb-1">Employment Type</div>
              <div className="font-semibold text-slate-200 capitalize">
                {job.employmentType.replace('_', ' ')}
              </div>
            </div>

            <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800/80">
              <div className="text-slate-500 mb-1">Salary Range</div>
              <div className="font-semibold text-emerald-400">
                {job.salaryMin || job.salaryMax
                  ? `${job.salaryCurrency || '$'} ${job.salaryMin?.toLocaleString() || '0'} - ${job.salaryMax?.toLocaleString() || 'DOE'}`
                  : 'Undisclosed'}
              </div>
            </div>

            <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800/80">
              <div className="text-slate-500 mb-1">Experience Req.</div>
              <div className="font-semibold text-slate-200">
                {job.experienceMin !== null && job.experienceMin !== undefined
                  ? `${job.experienceMin}+ years`
                  : 'Not specified'}
              </div>
            </div>
          </div>
        </div>

        {/* Skills Section */}
        {job.skills && job.skills.length > 0 && (
          <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6 space-y-3">
            <h3 className="text-sm font-semibold text-slate-200 flex items-center gap-2">
              <Tag className="w-4 h-4 text-emerald-400" />
              Mentioned Technologies & Skills
            </h3>
            <div className="flex flex-wrap gap-2">
              {job.skills.map((skill, idx) => (
                <span
                  key={idx}
                  className="px-3 py-1 rounded-full bg-slate-950 border border-slate-800 text-xs text-slate-300 font-medium"
                >
                  {skill}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Full Description Section */}
        <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6 md:p-8 space-y-4">
          <h3 className="text-lg font-bold text-slate-100 flex items-center gap-2 border-b border-slate-800 pb-3">
            <Briefcase className="w-5 h-5 text-sky-400" />
            Job Description
          </h3>

          <div className="text-sm text-slate-300 leading-relaxed whitespace-pre-line space-y-4 font-normal">
            {job.description}
          </div>

          {job.jobUrl && (
            <div className="pt-6 border-t border-slate-800 flex justify-end">
              <a
                href={job.jobUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-sky-600 hover:bg-sky-500 text-white text-xs font-semibold shadow-lg shadow-sky-600/20 transition-all"
              >
                <span>View Full Listing on {job.company}</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
