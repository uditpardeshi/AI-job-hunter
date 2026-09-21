'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import {
  ArrowLeft,
  Mail,
  Send,
  Building2,
  Calendar,
  Clock,
  CheckCircle2,
  AlertCircle,
  Sparkles,
  Link as LinkIcon,
  Check,
  X,
  ExternalLink,
  ShieldCheck,
  ChevronRight,
} from 'lucide-react';
import Navbar from '@/components/Navbar';
import EmailComposerModal from '@/components/EmailComposerModal';
import { EmailMessage, Application } from '@ai-job-hunter/shared';

export default function EmailDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params?.id as string;
  const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

  const [email, setEmail] = useState<EmailMessage | null>(null);
  const [applications, setApplications] = useState<Application[]>([]);
  const [selectedAppId, setSelectedAppId] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isAssociating, setIsAssociating] = useState<boolean>(false);
  const [isComposerOpen, setIsComposerOpen] = useState<boolean>(false);
  const [notification, setNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const loadData = async () => {
    if (!id) return;
    setIsLoading(true);
    try {
      const [emailRes, appsRes] = await Promise.all([
        fetch(`${apiUrl}/api/emails/${id}`, { cache: 'no-store' }),
        fetch(`${apiUrl}/api/applications?limit=100`, { cache: 'no-store' }),
      ]);

      if (emailRes.ok) {
        const eData = await emailRes.json();
        setEmail(eData.data);
        if (eData.data.applicationId) {
          setSelectedAppId(eData.data.applicationId);
        }
      } else {
        throw new Error('Email not found');
      }

      if (appsRes.ok) {
        const aData = await appsRes.json();
        setApplications(aData.data || []);
      }
    } catch (err: any) {
      setNotification({ type: 'error', message: err.message || 'Failed to load email details' });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [id, apiUrl]);

  const handleAssociate = async (appId: string) => {
    if (!appId) return;
    setIsAssociating(true);
    setNotification(null);
    try {
      const res = await fetch(`${apiUrl}/api/emails/${id}/associate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ applicationId: appId }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to associate application');
      }
      const data = await res.json();
      setEmail(data.data);
      setSelectedAppId(appId);
      setNotification({ type: 'success', message: 'Email successfully associated with application!' });
      loadData();
    } catch (err: any) {
      setNotification({ type: 'error', message: err.message });
    } finally {
      setIsAssociating(false);
    }
  };

  const handleSuggestionAction = async (action: 'accept' | 'ignore') => {
    if (!email) return;
    try {
      const res = await fetch(`${apiUrl}/api/emails/${id}/suggestion`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Action failed');
      }
      setEmail({ ...email, statusSuggestionHandled: true });
      setNotification({
        type: 'success',
        message: action === 'accept' ? 'Application status updated!' : 'Status suggestion dismissed',
      });
      loadData();
    } catch (err: any) {
      setNotification({ type: 'error', message: err.message });
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
        <Navbar />
        <div className="flex-1 flex items-center justify-center">
          <div className="flex items-center gap-2 text-xs text-slate-400">
            <div className="w-4 h-4 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin" />
            <span>Loading email details...</span>
          </div>
        </div>
      </div>
    );
  }

  if (!email) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
        <Navbar />
        <div className="flex-1 flex flex-col items-center justify-center p-6 space-y-4">
          <AlertCircle className="w-10 h-10 text-rose-400" />
          <h2 className="text-base font-bold text-slate-200">Email Not Found</h2>
          <Link href="/emails" className="text-xs text-indigo-400 hover:underline">
            Back to Inbox
          </Link>
        </div>
      </div>
    );
  }

  const hasStatusSuggestion = email.suggestedStatus && !email.statusSuggestionHandled && email.application;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
      <Navbar />

      {/* Sub Header */}
      <div className="border-b border-slate-800 bg-slate-900/80 backdrop-blur-md sticky top-16 z-40">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
          <Link
            href="/emails"
            className="inline-flex items-center gap-2 text-xs font-medium text-slate-400 hover:text-slate-200 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Inbox
          </Link>

          <button
            onClick={() => setIsComposerOpen(true)}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-indigo-600 to-sky-600 hover:from-indigo-500 hover:to-sky-500 text-white font-bold text-xs shadow-lg shadow-indigo-600/20 transition-all"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Reply via Assistant</span>
          </button>
        </div>
      </div>

      <main className="flex-1 max-w-5xl mx-auto px-4 sm:px-6 py-8 w-full space-y-6">
        {notification && (
          <div
            className={`p-4 rounded-2xl text-xs flex items-center gap-3 ${
              notification.type === 'success'
                ? 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-300'
                : 'bg-rose-500/10 border border-rose-500/30 text-rose-300'
            }`}
          >
            {notification.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 shrink-0" />
            )}
            <span>{notification.message}</span>
          </div>
        )}

        {/* Status Suggestion Banner */}
        {hasStatusSuggestion && (
          <div className="p-4 rounded-2xl bg-gradient-to-r from-purple-950/60 via-slate-900 to-purple-950/60 border border-purple-500/30 flex flex-wrap items-center justify-between gap-4 shadow-xl">
            <div className="flex items-center gap-3">
              <Sparkles className="w-5 h-5 text-purple-400 shrink-0" />
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-slate-300 font-semibold">Suggested Application Update:</span>
                  <span className="px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider bg-purple-500/20 text-purple-300 border border-purple-500/30">
                    {email.suggestedStatus}
                  </span>
                </div>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  AI classified this email as an invitation/update. Do you want to transition &ldquo;{email.application?.job?.title}&rdquo; to {email.suggestedStatus}?
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => handleSuggestionAction('accept')}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow transition-all"
              >
                <Check className="w-3.5 h-3.5" />
                <span>Accept Update</span>
              </button>
              <button
                onClick={() => handleSuggestionAction('ignore')}
                className="inline-flex items-center gap-1 px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 text-xs font-medium transition-all"
              >
                <span>Ignore</span>
              </button>
            </div>
          </div>
        )}

        {/* Email Header Card */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-3xl p-6 sm:p-8 space-y-6 shadow-xl">
          <div className="flex flex-wrap items-center justify-between gap-3 pb-6 border-b border-slate-800">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <span className="px-3 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider bg-indigo-500/10 text-indigo-400 border border-indigo-500/30">
                  {email.category.replace('_', ' ')}
                </span>
                {email.requiresResponse && (
                  <span className="px-2.5 py-0.5 rounded-md bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs font-semibold">
                    Response Needed
                  </span>
                )}
                <span className="text-xs text-slate-500 font-mono">
                  Confidence: {Math.round(email.confidence * 100)}%
                </span>
              </div>
              <h1 className="text-lg sm:text-xl font-bold text-slate-100">{email.subject}</h1>
            </div>

            <div className="text-right text-xs text-slate-400 font-mono">
              <div>{new Date(email.receivedAt).toLocaleDateString()}</div>
              <div>{new Date(email.receivedAt).toLocaleTimeString()}</div>
            </div>
          </div>

          {/* Sender & Recipient Metadata */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
            <div className="p-3.5 rounded-2xl bg-slate-950 border border-slate-800 space-y-1">
              <span className="text-[11px] font-medium text-slate-500 block">From:</span>
              <div className="font-semibold text-slate-200">{email.sender}</div>
            </div>

            <div className="p-3.5 rounded-2xl bg-slate-950 border border-slate-800 space-y-1">
              <span className="text-[11px] font-medium text-slate-500 block">To:</span>
              <div className="text-slate-300 font-mono">{email.recipient}</div>
            </div>
          </div>

          {/* Application Association Section */}
          <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <Building2 className="w-4 h-4 text-indigo-400 shrink-0" />
              <div>
                <span className="text-[11px] text-slate-500 block">Associated Application:</span>
                {email.application ? (
                  <Link
                    href={`/applications/${email.application.id}`}
                    className="text-xs font-semibold text-indigo-300 hover:underline inline-flex items-center gap-1"
                  >
                    <span>{email.application.job?.company || 'Application'} {email.application.job?.title ? `— ${email.application.job.title}` : ''}</span>
                    <ExternalLink className="w-3 h-3" />
                  </Link>
                ) : (
                  <span className="text-xs text-slate-500 italic">Not associated</span>
                )}
              </div>
            </div>

            {/* Associate Dropdown */}
            <div className="flex items-center gap-2">
              <select
                value={selectedAppId}
                onChange={(e) => handleAssociate(e.target.value)}
                disabled={isAssociating}
                className="bg-slate-900 border border-slate-700 rounded-xl px-3 py-1.5 text-xs text-slate-200 outline-none focus:border-indigo-500"
              >
                <option value="">{email.application ? 'Re-link Application...' : 'Link to Application...'}</option>
                {applications.map((app) => (
                  <option key={app.id} value={app.id}>
                    {app.job?.company || 'Job'} — {app.job?.title || app.id} ({app.status})
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Email Body */}
          <div className="pt-2">
            <span className="text-xs font-bold text-slate-400 block mb-2">Message Content</span>
            <div className="p-5 rounded-2xl bg-slate-950 border border-slate-800/80 text-xs text-slate-200 leading-relaxed font-sans whitespace-pre-wrap">
              {email.bodyText || email.snippet || '(Empty message body)'}
            </div>
          </div>
        </div>
      </main>

      {/* AI Email Composer Modal */}
      <EmailComposerModal
        isOpen={isComposerOpen}
        onClose={() => setIsComposerOpen(false)}
        applicationId={email.applicationId || undefined}
        jobId={email.application?.jobId}
        replyToEmailId={email.id}
        defaultTo={[email.senderEmail]}
        defaultSubject={`Re: ${email.subject.replace(/^Re:\s*/i, '')}`}
        defaultPurpose="RECRUITER_REPLY"
        onEmailSent={() => {
          setNotification({ type: 'success', message: 'Reply sent via Gmail!' });
          loadData();
        }}
      />
    </div>
  );
}
