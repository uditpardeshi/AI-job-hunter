'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
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
  AlertCircle,
  Tag,
  Sparkles,
  RefreshCw,
  TrendingUp,
  ShieldCheck,
  Award,
  Zap,
  FileText,
  Mail,
  ChevronRight,
  Download,
  Check,
  Bookmark,
  CheckSquare,
} from 'lucide-react';
import { Job, JobMatchResult, TailoredResume, CoverLetter, Application, ApplicationStatus } from '@ai-job-hunter/shared';
import Navbar from '@/components/Navbar';
import { authFetch } from '@/lib/api';

export default function JobDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params?.id as string;
  const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

  const [job, setJob] = useState<Job | null>(null);
  const [matchResult, setMatchResult] = useState<JobMatchResult | null>(null);
  const [tailoredResumes, setTailoredResumes] = useState<TailoredResume[]>([]);
  const [coverLetters, setCoverLetters] = useState<CoverLetter[]>([]);
  const [application, setApplication] = useState<Application | null>(null);
  const [isUpdatingApp, setIsUpdatingApp] = useState<boolean>(false);

  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isMatching, setIsMatching] = useState<boolean>(false);
  const [isTailoring, setIsTailoring] = useState<boolean>(false);
  const [isGeneratingCoverLetter, setIsGeneratingCoverLetter] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const loadData = async () => {
    if (!id) return;
    setIsLoading(true);
    try {
      // Fetch Job Details
      const jobRes = await authFetch(`${apiUrl}/api/jobs/${id}`, { cache: 'no-store' });
      if (!jobRes.ok) {
        throw new Error(`Job not found (HTTP ${jobRes.status})`);
      }
      const jobData = await jobRes.json();
      setJob(jobData.job);

      // Fetch Match Result
      const matchRes = await authFetch(`${apiUrl}/api/jobs/${id}/match`, { cache: 'no-store' });
      if (matchRes.ok) {
        const matchData = await matchRes.json();
        setMatchResult(matchData.data);
      }

      // Fetch Step 5 Tailored Resumes & Cover Letters
      const [resumesRes, lettersRes, appRes] = await Promise.all([
        authFetch(`${apiUrl}/api/jobs/${id}/tailored-resumes`, { cache: 'no-store' }),
        authFetch(`${apiUrl}/api/jobs/${id}/cover-letters`, { cache: 'no-store' }),
        authFetch(`${apiUrl}/api/applications?jobId=${id}`, { cache: 'no-store' }),
      ]);

      if (resumesRes.ok) {
        const rData = await resumesRes.json();
        setTailoredResumes(rData.data || []);
      }

      if (lettersRes.ok) {
        const lData = await lettersRes.json();
        setCoverLetters(lData.data || []);
      }

      if (appRes.ok) {
        const aData = await appRes.json();
        if (aData.data && aData.data.length > 0) {
          setApplication(aData.data[0]);
        } else {
          setApplication(null);
        }
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load job details');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [id, apiUrl]);

  const handleTrack = async (status: ApplicationStatus) => {
    setIsUpdatingApp(true);
    setActionError(null);
    try {
      if (application) {
        const res = await authFetch(`${apiUrl}/api/applications/${application.id}/status`, {
          method: 'PATCH',
          body: JSON.stringify({ status }),
        });
        if (!res.ok) {
          const err = await res.json();
          throw new Error(err.error || 'Failed to update status');
        }
        const data = await res.json();
        setApplication(data.data);
      } else {
        const res = await authFetch(`${apiUrl}/api/applications`, {
          method: 'POST',
          body: JSON.stringify({ jobId: id, status }),
        });
        if (!res.ok) {
          const err = await res.json();
          throw new Error(err.error || 'Failed to track job');
        }
        const data = await res.json();
        setApplication(data.data);
      }
    } catch (err: any) {
      setActionError(err.message || 'Failed to update application');
    } finally {
      setIsUpdatingApp(false);
    }
  };

  const handleCalculateMatch = async () => {
    if (!id) return;
    setIsMatching(true);
    try {
      const res = await authFetch(`${apiUrl}/api/jobs/${id}/match`, {
        method: 'POST',
      });
      if (res.ok) {
        const data = await res.json();
        setMatchResult(data.data);
      }
    } catch (err) {
      console.error('Failed to calculate match:', err);
    } finally {
      setIsMatching(false);
    }
  };

  const handleCreateTailoredResume = async () => {
    if (!id) return;
    setIsTailoring(true);
    setActionError(null);
    try {
      const res = await authFetch(`${apiUrl}/api/jobs/${id}/tailor-resume`, {
        method: 'POST',
        body: JSON.stringify({}),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || data.message || 'Failed to create tailored resume');
      }
      router.push(`/tailored-resumes/${data.data.id}`);
    } catch (err: any) {
      console.error('Error creating tailored resume:', err);
      setActionError(err.message || 'Failed to create tailored resume. Ensure candidate profile exists.');
      setIsTailoring(false);
    }
  };

  const handleCreateCoverLetter = async () => {
    if (!id) return;
    setIsGeneratingCoverLetter(true);
    setActionError(null);
    try {
      const res = await authFetch(`${apiUrl}/api/jobs/${id}/cover-letter`, {
        method: 'POST',
        body: JSON.stringify({ tone: 'professional' }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || data.message || 'Failed to generate cover letter');
      }
      router.push(`/cover-letters/${data.data.id}`);
    } catch (err: any) {
      console.error('Error generating cover letter:', err);
      setActionError(err.message || 'Failed to generate cover letter. Ensure candidate profile exists.');
      setIsGeneratingCoverLetter(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-6">
        <div className="text-center space-y-3">
          <div className="w-8 h-8 border-2 border-sky-400 border-t-transparent rounded-full animate-spin mx-auto"></div>
          <p className="text-xs text-slate-400">Loading job analysis and candidate fit...</p>
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

  const salaryText = formatSalary(job);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
      <Navbar />

      {/* Sub Navbar */}
      <div className="border-b border-slate-800 bg-slate-900/80 backdrop-blur-md sticky top-16 z-40">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
          <Link
            href="/jobs"
            className="inline-flex items-center gap-2 text-xs font-medium text-slate-400 hover:text-slate-200 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Job Board
          </Link>

          <div className="flex items-center gap-2 sm:gap-3">
            {application ? (
              <Link
                href={`/applications/${application.id}`}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-indigo-950/80 hover:bg-indigo-900 text-indigo-300 border border-indigo-500/40 text-xs font-semibold transition-all"
              >
                <Bookmark className="w-3.5 h-3.5 text-indigo-400" />
                <span>Tracked ({application.status})</span>
              </Link>
            ) : (
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => handleTrack('SAVED' as ApplicationStatus)}
                  disabled={isUpdatingApp}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800 text-xs font-semibold transition-all disabled:opacity-50"
                  title="Save to tracker"
                >
                  <Bookmark className="w-3.5 h-3.5 text-slate-400" />
                  <span>Save</span>
                </button>
                <button
                  onClick={() => handleTrack('SHORTLISTED' as ApplicationStatus)}
                  disabled={isUpdatingApp}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-sky-950/60 hover:bg-sky-900/80 text-sky-300 border border-sky-500/30 text-xs font-semibold transition-all disabled:opacity-50"
                  title="Shortlist to tracker"
                >
                  <CheckSquare className="w-3.5 h-3.5 text-sky-400" />
                  <span>Shortlist</span>
                </button>
              </div>
            )}

            <button
              onClick={handleCreateTailoredResume}
              disabled={isTailoring}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-sky-600 to-indigo-600 hover:from-sky-500 hover:to-indigo-500 text-white text-xs font-semibold shadow-lg shadow-sky-600/20 transition-all disabled:opacity-50"
            >
              <FileText className={`w-3.5 h-3.5 ${isTailoring ? 'animate-spin' : ''}`} />
              <span>{isTailoring ? 'Tailoring...' : 'Tailor Resume'}</span>
            </button>

            <button
              onClick={handleCreateCoverLetter}
              disabled={isGeneratingCoverLetter}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-semibold transition-all disabled:opacity-50"
            >
              <Mail className={`w-3.5 h-3.5 ${isGeneratingCoverLetter ? 'animate-spin' : ''}`} />
              <span>{isGeneratingCoverLetter ? 'Writing...' : 'Cover Letter'}</span>
            </button>

            {job.jobUrl && (
              <a
                href={job.jobUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="hidden sm:inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800 text-xs font-semibold transition-all"
              >
                <span>Job Link</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            )}
          </div>
        </div>
      </div>

      {/* Main Container */}
      <main className="flex-1 max-w-5xl mx-auto px-4 sm:px-6 py-8 w-full space-y-6">
        {application && (
          <div className="p-4 rounded-2xl bg-gradient-to-r from-indigo-950/60 via-slate-900 to-indigo-950/60 border border-indigo-500/30 flex flex-wrap items-center justify-between gap-4 shadow-xl">
            <div className="flex items-center gap-3">
              <span className="w-3 h-3 rounded-full bg-emerald-400 animate-pulse shrink-0" />
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-slate-400">Application Tracking:</span>
                  <span className="px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                    {application.status}
                  </span>
                </div>
                {application.nextFollowUpAt && (
                  <p className="text-xs text-amber-400 mt-1">
                    Follow-up scheduled: {new Date(application.nextFollowUpAt).toLocaleDateString()}
                  </p>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Link
                href={`/applications/${application.id}`}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-lg shadow-indigo-600/30 transition-all"
              >
                <span>Open Application Hub</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          </div>
        )}
        {actionError && (
          <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-3">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{actionError}</span>
          </div>
        )}

        {/* Match Analysis Section */}
        {matchResult ? (
          <section className="bg-gradient-to-b from-slate-900/90 to-slate-900/40 border border-slate-800 rounded-3xl p-6 md:p-8 space-y-6 shadow-2xl relative overflow-hidden">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 pb-6 border-b border-slate-800/80">
              <div className="space-y-1.5">
                <div className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-indigo-400">
                  <Sparkles className="w-4 h-4 text-indigo-400" />
                  <span>AI Match Analysis</span>
                </div>
                <h2 className="text-xl font-bold text-slate-100">Candidate Fit Breakdown</h2>
                <p className="text-xs text-slate-400">
                  Grounded multi-factor score evaluated against your verified resume profile.
                </p>
              </div>

              {/* Overall Score Dial */}
              <div className="flex items-center gap-4 bg-slate-950/80 border border-slate-800 px-5 py-3 rounded-2xl shrink-0">
                <div className="text-right">
                  <div className="text-2xl font-black bg-gradient-to-r from-emerald-400 to-teal-300 bg-clip-text text-transparent">
                    {matchResult.matchScore}%
                  </div>
                  <div className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">
                    Overall Fit
                  </div>
                </div>
                <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
                  <Award className="w-5 h-5 text-emerald-400" />
                </div>
              </div>
            </div>

            {/* Component Progress Bars Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
              {[
                { label: 'Skills (30%)', value: matchResult.components.skillMatch, color: 'bg-sky-500' },
                { label: 'Role (20%)', value: matchResult.components.roleMatch, color: 'bg-indigo-500' },
                { label: 'Experience (15%)', value: matchResult.components.experienceMatch, color: 'bg-purple-500' },
                { label: 'Semantic (15%)', value: matchResult.components.semanticMatch, color: 'bg-teal-500' },
                { label: 'Location (10%)', value: matchResult.components.locationMatch, color: 'bg-emerald-500' },
                { label: 'Preference (10%)', value: matchResult.components.preferenceMatch, color: 'bg-amber-500' },
              ].map((comp, idx) => (
                <div key={idx} className="bg-slate-950/60 border border-slate-800/80 rounded-xl p-3 space-y-1.5">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-slate-400 font-medium truncate">{comp.label}</span>
                    <span className="text-slate-200 font-bold">{comp.value}%</span>
                  </div>
                  <div className="h-1.5 w-full bg-slate-800 rounded-full overflow-hidden">
                    <div
                      className={`h-full ${comp.color} rounded-full transition-all duration-500`}
                      style={{ width: `${comp.value}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>

            {/* Grounded Explanation Narrative */}
            <div className="bg-slate-950/80 border border-slate-800/90 rounded-2xl p-5 space-y-2">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                Why this matches
              </h3>
              <p className="text-xs text-slate-300 leading-relaxed">
                {matchResult.explanation}
              </p>
            </div>

            {/* Strengths & Concerns Columns */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Strengths */}
              <div className="bg-emerald-950/20 border border-emerald-900/40 rounded-2xl p-4 space-y-2">
                <h4 className="text-xs font-bold text-emerald-400 flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  Key Strengths
                </h4>
                <ul className="space-y-1.5 text-xs text-slate-300">
                  {matchResult.strengths.length > 0 ? (
                    matchResult.strengths.map((str, idx) => (
                      <li key={idx} className="flex items-start gap-2">
                        <span className="text-emerald-400 font-bold mt-0.5">•</span>
                        <span>{str}</span>
                      </li>
                    ))
                  ) : (
                    <li className="text-slate-500 italic">No standout strengths detected</li>
                  )}
                </ul>
              </div>

              {/* Skill Gaps & Concerns */}
              <div className="bg-amber-950/20 border border-amber-900/40 rounded-2xl p-4 space-y-2">
                <h4 className="text-xs font-bold text-amber-400 flex items-center gap-1.5">
                  <AlertCircle className="w-3.5 h-3.5" />
                  Potential Gaps & Missing Skills
                </h4>
                <ul className="space-y-1.5 text-xs text-slate-300">
                  {matchResult.concerns.length > 0 ? (
                    matchResult.concerns.map((con, idx) => (
                      <li key={idx} className="flex items-start gap-2">
                        <span className="text-amber-400 font-bold mt-0.5">•</span>
                        <span>{con}</span>
                      </li>
                    ))
                  ) : (
                    <li className="text-slate-500 italic">No significant gaps detected</li>
                  )}
                </ul>
              </div>
            </div>

            {/* Missing Skills Tags */}
            {((matchResult.missingRequiredSkills && matchResult.missingRequiredSkills.length > 0) ||
              (matchResult.missingPreferredSkills && matchResult.missingPreferredSkills.length > 0)) && (
              <div className="space-y-2 pt-2">
                <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                  Target Role Skills Missing in Candidate Profile:
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {(matchResult.missingRequiredSkills || []).map((s, idx) => (
                    <span
                      key={`req-${idx}`}
                      className="px-2.5 py-1 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs font-medium"
                    >
                      {s} (Required)
                    </span>
                  ))}
                  {(matchResult.missingPreferredSkills || []).map((s, idx) => (
                    <span
                      key={`pref-${idx}`}
                      className="px-2.5 py-1 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-300 text-xs font-medium"
                    >
                      {s} (Preferred)
                    </span>
                  ))}
                </div>
              </div>
            )}
          </section>
        ) : (
          <div className="bg-slate-900/40 border border-slate-800 rounded-2xl p-6 text-center space-y-3">
            <Zap className="w-8 h-8 text-indigo-400 mx-auto" />
            <h3 className="text-sm font-bold text-slate-200">No match analysis computed yet for this job</h3>
            <p className="text-xs text-slate-400 max-w-md mx-auto">
              Click below to trigger instant AI evaluation against your candidate profile.
            </p>
            <button
              onClick={handleCalculateMatch}
              disabled={isMatching}
              className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs transition-all shadow-lg shadow-indigo-600/20"
            >
              {isMatching ? 'Evaluating...' : 'Run Match Analysis'}
            </button>
          </div>
        )}

        {/* Step 5: Application Materials Studio Section */}
        <section className="bg-slate-900/60 border border-slate-800 rounded-3xl p-6 md:p-8 space-y-6 shadow-xl">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
            <div>
              <div className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-sky-400">
                <FileText className="w-4 h-4 text-sky-400" />
                <span>Application Materials</span>
              </div>
              <h3 className="text-lg font-bold text-slate-100 mt-1">Tailored Documents & Export</h3>
              <p className="text-xs text-slate-400">
                Job-grounded resumes and cover letters crafted strictly from your verified facts.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={handleCreateTailoredResume}
                disabled={isTailoring}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-sky-600 hover:bg-sky-500 text-white text-xs font-semibold shadow-lg shadow-sky-600/20 transition-all disabled:opacity-50"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>{isTailoring ? 'Generating...' : 'New Tailored Resume'}</span>
              </button>
              <button
                onClick={handleCreateCoverLetter}
                disabled={isGeneratingCoverLetter}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-semibold transition-all disabled:opacity-50"
              >
                <Mail className="w-3.5 h-3.5" />
                <span>{isGeneratingCoverLetter ? 'Writing...' : 'New Cover Letter'}</span>
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Tailored Resumes Column */}
            <div className="space-y-3">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center justify-between">
                <span>Tailored Resumes ({tailoredResumes.length})</span>
              </h4>

              {tailoredResumes.length === 0 ? (
                <div className="p-6 rounded-2xl bg-slate-950/40 border border-dashed border-slate-800 text-center space-y-2">
                  <FileText className="w-8 h-8 text-slate-600 mx-auto" />
                  <p className="text-xs text-slate-400">No tailored resume generated yet for this job.</p>
                  <button
                    onClick={handleCreateTailoredResume}
                    disabled={isTailoring}
                    className="text-xs text-sky-400 hover:text-sky-300 font-semibold underline underline-offset-4"
                  >
                    Create your first tailored version
                  </button>
                </div>
              ) : (
                <div className="space-y-2.5">
                  {tailoredResumes.map((tr) => (
                    <div
                      key={tr.id}
                      className="p-4 rounded-2xl bg-slate-950/70 border border-slate-800 hover:border-slate-700 transition-all flex items-center justify-between gap-4"
                    >
                      <div className="space-y-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-xs text-slate-200 truncate">
                            {tr.title || job.title}
                          </span>
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-sky-500/10 text-sky-400 border border-sky-500/20">
                            v{tr.versionNumber}
                          </span>
                          {tr.atsAnalysis && (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                              {tr.atsAnalysis.alignmentScore}% ATS Fit
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] text-slate-500 flex items-center gap-2">
                          <span>Updated {new Date(tr.updatedAt).toLocaleDateString()}</span>
                          {tr.validationFlags && tr.validationFlags.length > 0 && (
                            <span className="text-amber-400 flex items-center gap-0.5">
                              • {tr.validationFlags.length} notice(s)
                            </span>
                          )}
                        </div>
                      </div>

                      <Link
                        href={`/tailored-resumes/${tr.id}`}
                        className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-xs font-semibold text-slate-200 border border-slate-800 shrink-0 transition-colors"
                      >
                        <span>Open Studio</span>
                        <ChevronRight className="w-3.5 h-3.5" />
                      </Link>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Cover Letters Column */}
            <div className="space-y-3">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center justify-between">
                <span>Cover Letters ({coverLetters.length})</span>
              </h4>

              {coverLetters.length === 0 ? (
                <div className="p-6 rounded-2xl bg-slate-950/40 border border-dashed border-slate-800 text-center space-y-2">
                  <Mail className="w-8 h-8 text-slate-600 mx-auto" />
                  <p className="text-xs text-slate-400">No cover letter drafted yet for this job.</p>
                  <button
                    onClick={handleCreateCoverLetter}
                    disabled={isGeneratingCoverLetter}
                    className="text-xs text-sky-400 hover:text-sky-300 font-semibold underline underline-offset-4"
                  >
                    Draft a role-specific cover letter
                  </button>
                </div>
              ) : (
                <div className="space-y-2.5">
                  {coverLetters.map((cl) => (
                    <div
                      key={cl.id}
                      className="p-4 rounded-2xl bg-slate-950/70 border border-slate-800 hover:border-slate-700 transition-all flex items-center justify-between gap-4"
                    >
                      <div className="space-y-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-xs text-slate-200 truncate">
                            {cl.title || `Application for ${job.title}`}
                          </span>
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold capitalize bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                            {cl.tone}
                          </span>
                        </div>
                        <div className="text-[11px] text-slate-500">
                          Updated {new Date(cl.updatedAt).toLocaleDateString()}
                        </div>
                      </div>

                      <Link
                        href={`/cover-letters/${cl.id}`}
                        className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-xs font-semibold text-slate-200 border border-slate-800 shrink-0 transition-colors"
                      >
                        <span>Open Editor</span>
                        <ChevronRight className="w-3.5 h-3.5" />
                      </Link>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </section>

        {/* Job Header & Details Card */}
        <div className="bg-slate-900/60 border border-slate-800 rounded-3xl p-6 md:p-8 space-y-6">
          <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
            <div className="space-y-2">
              <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-400 border border-slate-700">
                Source: {job.sourceId}
              </span>

              <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-100">{job.title}</h1>

              <div className="flex items-center gap-2 text-slate-300 font-medium text-sm">
                <Building2 className="w-4 h-4 text-slate-400" />
                <span>{job.company}</span>
                {job.companyUrl && (
                  <a
                    href={job.companyUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sky-400 hover:text-sky-300 inline-flex items-center gap-0.5 text-xs"
                  >
                    <span>Website</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                )}
              </div>
            </div>

            {/* Status Badge */}
            <div>
              <span
                className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold capitalize ${
                  job.status === 'active'
                    ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                    : 'bg-slate-800 text-slate-400 border border-slate-700'
                }`}
              >
                <span
                  className={`w-1.5 h-1.5 rounded-full ${
                    job.status === 'active' ? 'bg-emerald-400' : 'bg-slate-400'
                  }`}
                />
                {job.status}
              </span>
            </div>
          </div>

          {/* Key Facts Pill Bar */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 py-4 border-y border-slate-800/80 text-xs">
            <div className="space-y-1">
              <div className="text-slate-500 flex items-center gap-1">
                <MapPin className="w-3.5 h-3.5" />
                <span>Location</span>
              </div>
              <div className="font-semibold text-slate-200">{job.location || 'Not specified'}</div>
            </div>

            <div className="space-y-1">
              <div className="text-slate-500 flex items-center gap-1">
                <Briefcase className="w-3.5 h-3.5" />
                <span>Work Style</span>
              </div>
              <div className="font-semibold text-slate-200 capitalize">
                {job.remoteType || 'On-site'}
              </div>
            </div>

            <div className="space-y-1">
              <div className="text-slate-500 flex items-center gap-1">
                <Clock className="w-3.5 h-3.5" />
                <span>Employment</span>
              </div>
              <div className="font-semibold text-slate-200 capitalize">
                {job.employmentType ? job.employmentType.replace('_', ' ') : 'Not specified'}
              </div>
            </div>

            <div className="space-y-1">
              <div className="text-slate-500 flex items-center gap-1">
                <DollarSign className="w-3.5 h-3.5" />
                <span>Compensation</span>
              </div>
              <div className="font-semibold text-slate-200">
                {salaryText || 'Undisclosed'}
              </div>
            </div>
          </div>

          {/* Job Description Text */}
          <div className="space-y-4">
            <h2 className="text-sm font-bold text-slate-300 uppercase tracking-wider">
              Job Description
            </h2>

            <div
              className="prose prose-invert prose-slate max-w-none text-xs sm:text-sm leading-relaxed text-slate-300 space-y-3 font-normal"
              dangerouslySetInnerHTML={{ __html: job.description }}
            />
          </div>
        </div>
      </main>
    </div>
  );
}
