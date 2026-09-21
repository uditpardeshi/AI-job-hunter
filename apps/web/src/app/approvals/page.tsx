'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  CheckSquare,
  ShieldCheck,
  AlertTriangle,
  FileText,
  Send,
  XCircle,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  RefreshCw,
  Sparkles,
  Building,
  MapPin,
  Clock,
  DollarSign,
  CheckCircle2,
  Lock,
} from 'lucide-react';
import { ApprovalItem, ApplicationQuestion } from '@ai-job-hunter/shared';

export default function ApprovalsPage() {
  const [items, setItems] = useState<ApprovalItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [expandedItem, setExpandedItem] = useState<string | null>(null);
  const [answersState, setAnswersState] = useState<Record<string, Record<string, string>>>({});
  const [message, setMessage] = useState<{ type: 'success' | 'error' | 'info'; text: string; externalUrl?: string } | null>(null);

  const fetchApprovals = async () => {
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
      const res = await fetch(`${apiUrl}/api/approvals`, { cache: 'no-store' });
      const json = await res.json();
      if (json.success) {
        setItems(json.data || []);
        // Initialize answer inputs
        const initialAnswers: Record<string, Record<string, string>> = {};
        (json.data || []).forEach((item: ApprovalItem) => {
          initialAnswers[item.preparation.id] = {};
          item.questions.forEach((q: ApplicationQuestion) => {
            initialAnswers[item.preparation.id][q.id] = q.candidateAnswer || '';
          });
        });
        setAnswersState(initialAnswers);
        if (json.data?.length > 0 && !expandedItem) {
          setExpandedItem(json.data[0].preparation.id);
        }
      }
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'Failed to fetch approval queue' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchApprovals();
  }, []);

  const handleAnswerChange = (prepId: string, questionId: string, val: string) => {
    setAnswersState((prev) => ({
      ...prev,
      [prepId]: {
        ...(prev[prepId] || {}),
        [questionId]: val,
      },
    }));
  };

  const handleSaveAnswers = async (prepId: string) => {
    setActionLoading(prepId);
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
      const answers = answersState[prepId] || {};
      const res = await fetch(`${apiUrl}/api/approvals/${prepId}/answers`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ answers }),
      });
      const json = await res.json();
      if (json.success) {
        setMessage({ type: 'success', text: 'Answers updated successfully' });
        fetchApprovals();
      } else {
        setMessage({ type: 'error', text: json.error || 'Failed to save answers' });
      }
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message });
    } finally {
      setActionLoading(null);
    }
  };

  const handleApprove = async (prepId: string) => {
    setActionLoading(prepId);
    setMessage(null);
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
      const res = await fetch(`${apiUrl}/api/approvals/${prepId}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notes: 'Approved by candidate' }),
      });
      const json = await res.json();
      if (json.success) {
        const result = json.data;
        if (result.status === 'SUBMITTED') {
          setMessage({ type: 'success', text: result.message || 'Application submitted successfully!' });
        } else if (result.status === 'REQUIRES_MANUAL_ACTION') {
          setMessage({
            type: 'info',
            text: result.message,
            externalUrl: result.externalUrl,
          });
        } else {
          setMessage({ type: 'error', text: result.message });
        }
        fetchApprovals();
      } else {
        setMessage({ type: 'error', text: json.error || 'Approval failed' });
      }
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message });
    } finally {
      setActionLoading(null);
    }
  };

  const handleReject = async (prepId: string) => {
    const reason = prompt('Optional: reason for rejecting this application from queue:');
    if (reason === null) return; // cancelled

    setActionLoading(prepId);
    setMessage(null);
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
      const res = await fetch(`${apiUrl}/api/approvals/${prepId}/reject`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason }),
      });
      const json = await res.json();
      if (json.success) {
        setMessage({ type: 'info', text: 'Application removed from approval queue' });
        fetchApprovals();
      } else {
        setMessage({ type: 'error', text: json.error || 'Rejection failed' });
      }
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message });
    } finally {
      setActionLoading(null);
    }
  };

  return (
    <div className="min-h-[calc(100vh-4rem)] p-4 sm:p-6 md:p-10 max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-900/60 p-6 rounded-2xl border border-slate-800 backdrop-blur-md">
        <div className="space-y-1">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-400">
              <CheckSquare className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl font-black text-slate-100 tracking-tight">
                Human Approval Queue
              </h1>
              <p className="text-xs sm:text-sm text-slate-400">
                Review generated materials and verify sensitive questions before any application is submitted
              </p>
            </div>
          </div>
        </div>

        <button
          onClick={fetchApprovals}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-colors"
        >
          <RefreshCw className="w-3.5 h-3.5" /> Refresh Queue
        </button>
      </div>

      {/* Status / Alert Message */}
      {message && (
        <div
          className={`p-4 rounded-xl border text-xs sm:text-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
            message.type === 'success'
              ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-300'
              : message.type === 'error'
              ? 'bg-red-500/10 border-red-500/20 text-red-300'
              : 'bg-sky-500/10 border-sky-500/20 text-sky-300'
          }`}
        >
          <div className="flex items-center gap-2.5">
            {message.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 shrink-0" />
            ) : message.type === 'error' ? (
              <AlertTriangle className="w-4 h-4 shrink-0" />
            ) : (
              <ShieldCheck className="w-4 h-4 shrink-0" />
            )}
            <span>{message.text}</span>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {message.externalUrl && (
              <a
                href={message.externalUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-sky-500 hover:bg-sky-400 text-white transition-colors"
              >
                Apply Externally <ExternalLink className="w-3 h-3" />
              </a>
            )}
            <button onClick={() => setMessage(null)} className="text-xs opacity-70 hover:opacity-100">
              Dismiss
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="py-20 flex justify-center">
          <RefreshCw className="w-8 h-8 text-sky-400 animate-spin" />
        </div>
      ) : items.length === 0 ? (
        <div className="p-16 text-center bg-slate-900/40 rounded-2xl border border-slate-800 space-y-4">
          <ShieldCheck className="w-12 h-12 text-emerald-400 mx-auto" />
          <h2 className="text-lg font-bold text-slate-100">Approval Queue is Clear</h2>
          <p className="text-slate-400 text-xs sm:text-sm max-w-md mx-auto">
            All shortlisted jobs have been processed or submitted. When the autonomous hunter finds new matching positions, they will appear here for your review.
          </p>
          <Link
            href="/automation"
            className="inline-block px-4 py-2 rounded-xl text-xs font-bold bg-sky-500 text-white hover:bg-sky-400 transition-colors"
          >
            Go to Automation Command Center
          </Link>
        </div>
      ) : (
        <div className="space-y-4">
          {items.map((item) => {
            const prep = item.preparation;
            const job = item.job;
            const isExpanded = expandedItem === prep.id;
            const isActionBusy = actionLoading === prep.id;
            const hasSensitive = item.questions.some((q) => q.isSensitive);

            return (
              <div
                key={prep.id}
                className="bg-slate-900/50 rounded-2xl border border-slate-800 overflow-hidden transition-all"
              >
                {/* Collapsible Card Header */}
                <div
                  onClick={() => setExpandedItem(isExpanded ? null : prep.id)}
                  className="p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 cursor-pointer hover:bg-slate-800/40 transition-colors"
                >
                  <div className="flex items-start sm:items-center gap-3.5">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-sky-500/20 to-indigo-500/20 border border-sky-500/30 flex items-center justify-center shrink-0">
                      <Building className="w-5 h-5 text-sky-400" />
                    </div>
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <h2 className="text-base font-extrabold text-slate-100">{job.title}</h2>
                        <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-slate-800 border border-slate-700 text-slate-300">
                          {prep.source.toUpperCase()}
                        </span>
                        {hasSensitive && (
                          <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-amber-500/15 border border-amber-500/30 text-amber-300 flex items-center gap-1">
                            <AlertTriangle className="w-3 h-3" /> Sensitive questions
                          </span>
                        )}
                      </div>
                      <div className="flex flex-wrap items-center gap-3 text-xs text-slate-400 mt-1">
                        <span>{job.company}</span>
                        {job.location && (
                          <span className="flex items-center gap-1">
                            <MapPin className="w-3 h-3" /> {job.location}
                          </span>
                        )}
                        <span className="capitalize">{job.remoteType}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 shrink-0">
                    <span
                      className={`px-2.5 py-1 rounded-full text-xs font-bold border ${
                        prep.status === 'READY'
                          ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
                          : 'bg-amber-500/10 border-amber-500/20 text-amber-400'
                      }`}
                    >
                      {prep.status.replace(/_/g, ' ')}
                    </span>
                    {isExpanded ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
                  </div>
                </div>

                {/* Expanded Review Body */}
                {isExpanded && (
                  <div className="p-5 sm:p-6 border-t border-slate-800 bg-slate-900/80 space-y-6">
                    {/* Materials preview links */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                      <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <FileText className="w-5 h-5 text-sky-400" />
                          <div>
                            <span className="font-bold text-slate-200 block">Tailored Resume</span>
                            <span className="text-[11px] text-slate-400 block">
                              {item.tailoredResume ? `Targeted to ${job.title}` : 'Using default base resume'}
                            </span>
                          </div>
                        </div>
                        {item.tailoredResume && (
                          <Link
                            href={`/applications/${prep.applicationId}`}
                            className="text-xs font-semibold text-sky-400 hover:underline flex items-center gap-1"
                          >
                            Preview <ExternalLink className="w-3 h-3" />
                          </Link>
                        )}
                      </div>

                      <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <FileText className="w-5 h-5 text-purple-400" />
                          <div>
                            <span className="font-bold text-slate-200 block">Cover Letter</span>
                            <span className="text-[11px] text-slate-400 block">
                              {item.coverLetter ? 'Customized for role & company' : 'None generated'}
                            </span>
                          </div>
                        </div>
                        {item.coverLetter && (
                          <Link
                            href={`/applications/${prep.applicationId}`}
                            className="text-xs font-semibold text-purple-400 hover:underline flex items-center gap-1"
                          >
                            Preview <ExternalLink className="w-3 h-3" />
                          </Link>
                        )}
                      </div>
                    </div>

                    {/* Questions to verify */}
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-2">
                          <ShieldCheck className="w-4 h-4 text-sky-400" />
                          Application Questions & Candidate Answers
                        </h3>
                        <button
                          onClick={() => handleSaveAnswers(prep.id)}
                          disabled={isActionBusy}
                          className="text-xs font-semibold text-sky-400 hover:text-sky-300 transition-colors"
                        >
                          Save answer changes
                        </button>
                      </div>

                      <div className="space-y-3">
                        {item.questions.map((q) => {
                          const currentVal = answersState[prep.id]?.[q.id] ?? (q.candidateAnswer || '');
                          return (
                            <div
                              key={q.id}
                              className={`p-3.5 rounded-xl border text-xs space-y-2 ${
                                q.isSensitive
                                  ? 'bg-amber-500/5 border-amber-500/20'
                                  : 'bg-slate-950/40 border-slate-800'
                              }`}
                            >
                              <div className="flex flex-wrap items-center justify-between gap-2">
                                <span className="font-bold text-slate-200">{q.question}</span>
                                <div className="flex items-center gap-2">
                                  {q.isSensitive && (
                                    <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center gap-1">
                                      <Lock className="w-2.5 h-2.5" /> Explicit Confirmation Required
                                    </span>
                                  )}
                                  <span className="text-[10px] text-slate-500 uppercase">
                                    Source: {q.answerSource} ({Math.round(q.confidence * 100)}%)
                                  </span>
                                </div>
                              </div>

                              <input
                                type="text"
                                value={currentVal}
                                onChange={(e) => handleAnswerChange(prep.id, q.id, e.target.value)}
                                placeholder="Enter your response..."
                                className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-slate-200 text-xs focus:outline-none focus:ring-1 focus:ring-sky-500 placeholder:text-slate-600"
                              />
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="pt-4 border-t border-slate-800 flex flex-wrap items-center justify-between gap-3">
                      <div className="flex items-center gap-2">
                        {job.jobUrl && (
                          <a
                            href={job.jobUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition-colors"
                          >
                            View Job Posting <ExternalLink className="w-3.5 h-3.5" />
                          </a>
                        )}
                        <button
                          onClick={() => handleReject(prep.id)}
                          disabled={isActionBusy}
                          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/30 transition-colors disabled:opacity-50"
                        >
                          <XCircle className="w-3.5 h-3.5" /> Reject & Remove
                        </button>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleSaveAnswers(prep.id)}
                          disabled={isActionBusy}
                          className="px-4 py-2 rounded-xl text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-colors"
                        >
                          Save Answers
                        </button>
                        <button
                          onClick={() => handleApprove(prep.id)}
                          disabled={isActionBusy}
                          className="inline-flex items-center gap-2 px-5 py-2 rounded-xl text-xs font-bold bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-white shadow-lg shadow-emerald-500/20 transition-all disabled:opacity-50"
                        >
                          {isActionBusy ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                          Approve Application
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
