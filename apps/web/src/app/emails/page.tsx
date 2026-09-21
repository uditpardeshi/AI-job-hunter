'use client';

import React, { useState, useEffect, useCallback, Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import {
  Mail,
  Search,
  Filter,
  RefreshCw,
  ExternalLink,
  ChevronRight,
  Clock,
  CheckCircle2,
  AlertCircle,
  Building2,
  Calendar,
  ArrowRight,
  Tag,
  Sparkles,
  Inbox,
  Check,
  X,
} from 'lucide-react';
import Navbar from '@/components/Navbar';
import { EmailMessage, EmailCategory, ApplicationStatus } from '@ai-job-hunter/shared';

const CATEGORY_TABS: Array<{ id: EmailCategory | ''; label: string }> = [
  { id: '', label: 'All Messages' },
  { id: 'INTERVIEW_INVITATION', label: 'Interviews' },
  { id: 'OFFER', label: 'Offers' },
  { id: 'RECRUITER_MESSAGE', label: 'Recruiter Outreach' },
  { id: 'ASSESSMENT', label: 'Assessments' },
  { id: 'APPLICATION_CONFIRMATION', label: 'Confirmations' },
  { id: 'REJECTION', label: 'Rejections' },
  { id: 'OTHER', label: 'Other' },
];

function EmailsContent() {
  const searchParams = useSearchParams();
  const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

  const [emails, setEmails] = useState<EmailMessage[]>([]);
  const [total, setTotal] = useState<number>(0);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);

  // Filters
  const [selectedCategory, setSelectedCategory] = useState<EmailCategory | ''>(
    (searchParams.get('category') as EmailCategory) || ''
  );
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [requiresResponseOnly, setRequiresResponseOnly] = useState<boolean>(false);
  const [notification, setNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const fetchEmails = useCallback(async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      if (selectedCategory) params.append('category', selectedCategory);
      if (searchQuery.trim()) params.append('search', searchQuery.trim());
      if (requiresResponseOnly) params.append('requiresResponse', 'true');
      params.append('limit', '50');

      const res = await fetch(`${apiUrl}/api/emails?${params.toString()}`, { cache: 'no-store' });
      if (res.ok) {
        const json = await res.json();
        setEmails(json.data || []);
        setTotal(json.pagination?.total || 0);
      }
    } catch (err: any) {
      console.error('Failed to fetch emails:', err);
    } finally {
      setIsLoading(false);
    }
  }, [apiUrl, selectedCategory, searchQuery, requiresResponseOnly]);

  useEffect(() => {
    fetchEmails();
  }, [fetchEmails]);

  const handleSync = async () => {
    setIsSyncing(true);
    setNotification(null);
    try {
      const res = await fetch(`${apiUrl}/api/integrations/gmail/sync`, { method: 'POST' });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Sync failed');
      }
      const json = await res.json();
      setNotification({
        type: 'success',
        message: `Synced ${json.data.syncedCount} emails (${json.data.newCount} new messages imported)`,
      });
      fetchEmails();
    } catch (err: any) {
      setNotification({ type: 'error', message: err.message });
    } finally {
      setIsSyncing(false);
    }
  };

  const handleSuggestionAction = async (emailId: string, action: 'accept' | 'ignore') => {
    try {
      const res = await fetch(`${apiUrl}/api/emails/${emailId}/suggestion`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      });
      if (res.ok) {
        // Update local state
        setEmails((prev) =>
          prev.map((e) => (e.id === emailId ? { ...e, statusSuggestionHandled: true } : e))
        );
        setNotification({
          type: 'success',
          message: action === 'accept' ? 'Application status successfully updated!' : 'Suggestion dismissed',
        });
      }
    } catch (err: any) {
      setNotification({ type: 'error', message: err.message });
    }
  };

  const getCategoryBadgeClass = (category: EmailCategory) => {
    switch (category) {
      case 'INTERVIEW_INVITATION':
      case 'INTERVIEW_UPDATE':
        return 'bg-purple-500/10 text-purple-400 border-purple-500/30';
      case 'OFFER':
        return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30';
      case 'REJECTION':
        return 'bg-rose-500/10 text-rose-400 border-rose-500/30';
      case 'ASSESSMENT':
        return 'bg-amber-500/10 text-amber-400 border-amber-500/30';
      case 'RECRUITER_MESSAGE':
        return 'bg-sky-500/10 text-sky-400 border-sky-500/30';
      case 'APPLICATION_CONFIRMATION':
        return 'bg-teal-500/10 text-teal-400 border-teal-500/30';
      default:
        return 'bg-slate-800 text-slate-400 border-slate-700';
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
      <Navbar />

      <main className="flex-1 max-w-7xl mx-auto px-4 sm:px-6 py-8 w-full space-y-6">
        {/* Top Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-slate-900 border border-slate-800 text-xs font-medium text-slate-400 mb-2">
              <Inbox className="w-3.5 h-3.5 text-sky-400" />
              <span>Step 7: Recruiter & Application Inbox</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-100 tracking-tight">
              Email Assistant
            </h1>
            <p className="text-xs sm:text-sm text-slate-400 mt-1">
              Synchronized recruiter communications, status updates, and assisted response drafting.
            </p>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              onClick={handleSync}
              disabled={isSyncing}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs shadow-lg shadow-indigo-600/20 transition-all disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
              <span>{isSyncing ? 'Syncing Gmail...' : 'Sync Gmail'}</span>
            </button>

            <Link
              href="/settings/integrations"
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 text-xs font-semibold transition-all"
            >
              <span>Gmail Settings</span>
              <ExternalLink className="w-3.5 h-3.5 text-slate-500" />
            </Link>
          </div>
        </div>

        {/* Notifications */}
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

        {/* Search & Filter Controls */}
        <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-4 space-y-4 shadow-lg">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search by subject, sender, company, or message text..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-100 placeholder:text-slate-500 focus:border-indigo-500 outline-none transition-colors"
              />
            </div>

            <button
              onClick={() => setRequiresResponseOnly(!requiresResponseOnly)}
              className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-medium border transition-all ${
                requiresResponseOnly
                  ? 'bg-amber-500/10 border-amber-500/30 text-amber-300 font-bold'
                  : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200'
              }`}
            >
              <Clock className="w-3.5 h-3.5" />
              <span>Requires Response Only</span>
            </button>
          </div>

          {/* Category Tabs */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
            {CATEGORY_TABS.map((tab) => {
              const active = selectedCategory === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setSelectedCategory(tab.id)}
                  className={`px-3 py-1.5 rounded-xl whitespace-nowrap font-medium transition-all ${
                    active
                      ? 'bg-indigo-600 text-white font-semibold shadow-md shadow-indigo-600/30'
                      : 'bg-slate-950 text-slate-400 border border-slate-800 hover:text-slate-200'
                  }`}
                >
                  {tab.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Email Message List */}
        {isLoading ? (
          <div className="p-12 text-center text-slate-500 text-xs">
            <RefreshCw className="w-6 h-6 animate-spin mx-auto text-indigo-400 mb-2" />
            <span>Loading emails...</span>
          </div>
        ) : emails.length === 0 ? (
          <div className="p-12 rounded-3xl bg-slate-900/40 border border-slate-800 text-center space-y-3">
            <Mail className="w-10 h-10 text-slate-600 mx-auto" />
            <h3 className="text-sm font-semibold text-slate-300">No emails found</h3>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              Click &quot;Sync Gmail&quot; above to search your connected Gmail account for recruiter updates, or check your search filters.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {emails.map((email) => {
              const hasStatusSuggestion = email.suggestedStatus && !email.statusSuggestionHandled && email.application;

              return (
                <div
                  key={email.id}
                  className={`bg-slate-900/70 border rounded-2xl p-4 sm:p-5 transition-all hover:border-slate-700 shadow-md ${
                    !email.isRead ? 'border-indigo-500/40 bg-indigo-950/10' : 'border-slate-800'
                  }`}
                >
                  <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                    {/* Left: Email Details */}
                    <div className="space-y-2 flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        {!email.isRead && (
                          <span className="w-2 h-2 rounded-full bg-sky-400 animate-pulse" />
                        )}
                        <span
                          className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border ${getCategoryBadgeClass(
                            email.category
                          )}`}
                        >
                          {email.category.replace('_', ' ')}
                        </span>

                        {email.requiresResponse && (
                          <span className="px-2 py-0.5 rounded-md bg-amber-500/10 border border-amber-500/30 text-amber-300 text-[10px] font-semibold flex items-center gap-1">
                            <Clock className="w-2.5 h-2.5" />
                            Response Needed
                          </span>
                        )}

                        <span className="text-[11px] text-slate-500 font-mono">
                          {new Date(email.receivedAt).toLocaleDateString()} at{' '}
                          {new Date(email.receivedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>

                      {/* Subject */}
                      <Link href={`/emails/${email.id}`} className="block group">
                        <h3 className="text-sm font-bold text-slate-100 group-hover:text-indigo-300 transition-colors truncate">
                          {email.subject}
                        </h3>
                      </Link>

                      {/* Sender & Snippet */}
                      <div className="text-xs text-slate-400">
                        <span className="font-semibold text-slate-300">{email.senderName || email.senderEmail}</span>
                        <span className="mx-1.5 text-slate-600">•</span>
                        <span className="text-slate-400 line-clamp-1">{email.snippet}</span>
                      </div>

                      {/* Application association pill */}
                      {email.application ? (
                        <div className="inline-flex items-center gap-2 pt-1">
                          <Link
                            href={`/applications/${email.application.id}`}
                            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-950 border border-slate-800 text-[11px] text-indigo-300 hover:border-indigo-500/40 transition-all font-medium"
                          >
                            <Building2 className="w-3 h-3 text-indigo-400" />
                            <span>{email.application.job?.company || 'Application'}</span>
                            {email.application.job?.title && (
                              <>
                                <span className="text-slate-600">—</span>
                                <span className="truncate max-w-[200px]">{email.application.job.title}</span>
                              </>
                            )}
                            <span className="ml-1 px-1.5 py-0.2 rounded bg-slate-800 text-[9px] text-slate-400 uppercase">
                              {email.application.status}
                            </span>
                          </Link>
                        </div>
                      ) : (
                        <div className="inline-flex items-center gap-1 pt-1">
                          <span className="text-[10px] text-slate-500 italic">Not associated with an active application</span>
                        </div>
                      )}
                    </div>

                    {/* Right: Actions & Status Suggestions */}
                    <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 shrink-0">
                      {hasStatusSuggestion && (
                        <div className="p-2.5 rounded-xl bg-purple-950/30 border border-purple-500/30 flex items-center gap-2 text-xs">
                          <span className="text-purple-300 text-[11px] font-semibold">
                            Suggests: <strong className="uppercase">{email.suggestedStatus}</strong>
                          </span>
                          <button
                            onClick={() => handleSuggestionAction(email.id, 'accept')}
                            className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-[11px] font-bold shadow transition-all"
                            title="Accept status change"
                          >
                            <Check className="w-3 h-3" />
                            <span>Accept</span>
                          </button>
                          <button
                            onClick={() => handleSuggestionAction(email.id, 'ignore')}
                            className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 text-[11px] font-medium transition-all"
                            title="Dismiss suggestion"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </div>
                      )}

                      <Link
                        href={`/emails/${email.id}`}
                        className="inline-flex items-center gap-1 px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-700 transition-all"
                      >
                        <span>View Email</span>
                        <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
                      </Link>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}

export default function EmailsPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-slate-950 text-slate-400 flex items-center justify-center font-sans">
          <div className="flex items-center gap-2 text-xs">
            <div className="w-4 h-4 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin" />
            <span>Loading Recruiter Inbox...</span>
          </div>
        </div>
      }
    >
      <EmailsContent />
    </Suspense>
  );
}
