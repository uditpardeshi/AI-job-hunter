'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import {
  ArrowLeft,
  Briefcase,
  Building2,
  MapPin,
  Clock,
  Calendar,
  ExternalLink,
  CheckCircle2,
  AlertCircle,
  Sparkles,
  Download,
  FileText,
  Mail,
  Send,
  Plus,
  Trash2,
  Save,
  Bell,
  RefreshCw,
  Award,
  Layers,
  Check,
  Tag,
  History,
  UserCheck,
} from 'lucide-react';
import { Navbar } from '@/components/Navbar';
import EmailComposerModal from '@/components/EmailComposerModal';
import {
  Application,
  ApplicationStatus,
  ApplicationEvent,
  EmailMessage,
  ApplicationContact,
  EmailPurpose,
} from '@ai-job-hunter/shared';
import { authFetch } from '@/lib/api';

const STATUS_OPTIONS: Array<{ id: ApplicationStatus; label: string }> = [
  { id: 'SAVED', label: 'Saved' },
  { id: 'SHORTLISTED', label: 'Shortlisted' },
  { id: 'READY', label: 'Ready to Apply' },
  { id: 'APPLIED', label: 'Applied' },
  { id: 'INTERVIEW', label: 'Interview Scheduled' },
  { id: 'OFFER', label: 'Offer Received' },
  { id: 'REJECTED', label: 'Rejected' },
  { id: 'WITHDRAWN', label: 'Withdrawn' },
];

export default function ApplicationDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params?.id as string;
  const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

  const [application, setApplication] = useState<Application | null>(null);
  const [associatedEmails, setAssociatedEmails] = useState<EmailMessage[]>([]);
  const [contacts, setContacts] = useState<ApplicationContact[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isUpdatingStatus, setIsUpdatingStatus] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Email Composer state
  const [isComposerOpen, setIsComposerOpen] = useState<boolean>(false);
  const [composerPurpose, setComposerPurpose] = useState<EmailPurpose>('APPLICATION_FOLLOW_UP');
  const [composerTo, setComposerTo] = useState<string[]>([]);

  // Recruiter contact form state
  const [isAddContactOpen, setIsAddContactOpen] = useState<boolean>(false);
  const [contactName, setContactName] = useState<string>('');
  const [contactEmail, setContactEmail] = useState<string>('');
  const [contactRole, setContactRole] = useState<string>('');
  const [isSubmittingContact, setIsSubmittingContact] = useState<boolean>(false);

  // Note form state
  const [newNote, setNewNote] = useState<string>('');
  const [isSubmittingNote, setIsSubmittingNote] = useState<boolean>(false);

  // Follow-up state
  const [followUpDate, setFollowUpDate] = useState<string>('');
  const [isUpdatingFollowUp, setIsUpdatingFollowUp] = useState<boolean>(false);

  const loadApplication = async () => {
    if (!id) return;
    try {
      const [appRes, emailsRes, contactsRes] = await Promise.all([
        authFetch(`${apiUrl}/api/applications/${id}`, { cache: 'no-store' }),
        authFetch(`${apiUrl}/api/emails?applicationId=${id}`, { cache: 'no-store' }),
        authFetch(`${apiUrl}/api/applications/${id}/contacts`, { cache: 'no-store' }),
      ]);

      if (!appRes.ok) {
        throw new Error(`Failed to load application (HTTP ${appRes.status})`);
      }
      const json = await appRes.json();
      setApplication(json.data);
      if (json.data.nextFollowUpAt) {
        setFollowUpDate(json.data.nextFollowUpAt.split('T')[0]);
      }

      if (emailsRes.ok) {
        const eData = await emailsRes.json();
        setAssociatedEmails(eData.data || []);
      }

      if (contactsRes.ok) {
        const cData = await contactsRes.json();
        setContacts(cData.data || []);
      }
    } catch (err: any) {
      setError(err.message || 'Error loading application');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadApplication();
  }, [id, apiUrl]);

  const handleCreateContact = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id || !contactName.trim() || !contactEmail.trim()) return;
    setIsSubmittingContact(true);
    try {
      const res = await authFetch(`${apiUrl}/api/applications/${id}/contacts`, {
        method: 'POST',
        body: JSON.stringify({
          name: contactName.trim(),
          email: contactEmail.trim(),
          role: contactRole.trim() || undefined,
        }),
      });
      if (res.ok) {
        setContactName('');
        setContactEmail('');
        setContactRole('');
        setIsAddContactOpen(false);
        loadApplication();
      }
    } catch (err) {
      console.error('Failed to create contact', err);
    } finally {
      setIsSubmittingContact(false);
    }
  };

  const handleDeleteContact = async (contactId: string) => {
    if (!confirm('Remove this recruiter contact?')) return;
    try {
      const res = await authFetch(`${apiUrl}/api/applications/${id}/contacts/${contactId}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        loadApplication();
      }
    } catch (err) {
      console.error('Failed to delete contact', err);
    }
  };

  const openFollowUpComposer = () => {
    setComposerPurpose('APPLICATION_FOLLOW_UP');
    const recipient = contacts.length > 0 ? contacts[0].email : '';
    setComposerTo(recipient ? [recipient] : []);
    setIsComposerOpen(true);
  };

  const openNewComposer = (defaultPurpose: EmailPurpose = 'RECRUITER_REPLY', toEmail?: string) => {
    setComposerPurpose(defaultPurpose);
    setComposerTo(toEmail ? [toEmail] : contacts.length > 0 ? [contacts[0].email] : []);
    setIsComposerOpen(true);
  };

  const handleStatusChange = async (newStatus: ApplicationStatus) => {
    if (!id || !application) return;
    setIsUpdatingStatus(true);
    try {
      const res = await authFetch(`${apiUrl}/api/applications/${id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status: newStatus }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to update status');
      setApplication(json.data);
      loadApplication(); // Reload to refresh timeline events
    } catch (err: any) {
      alert(err.message);
    } finally {
      setIsUpdatingStatus(false);
    }
  };

  const handleAddNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id || !newNote.trim()) return;
    setIsSubmittingNote(true);
    try {
      const res = await authFetch(`${apiUrl}/api/applications/${id}/notes`, {
        method: 'POST',
        body: JSON.stringify({ noteText: newNote.trim() }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to add note');
      setNewNote('');
      loadApplication();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setIsSubmittingNote(false);
    }
  };

  const handleSaveFollowUp = async () => {
    if (!id) return;
    setIsUpdatingFollowUp(true);
    try {
      const res = await authFetch(`${apiUrl}/api/applications/${id}/follow-up`, {
        method: 'PATCH',
        body: JSON.stringify({ nextFollowUpAt: followUpDate || null }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to update follow-up');
      loadApplication();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setIsUpdatingFollowUp(false);
    }
  };

  const handleCompleteFollowUp = async () => {
    if (!id) return;
    setIsUpdatingFollowUp(true);
    try {
      const res = await authFetch(`${apiUrl}/api/applications/${id}/follow-up`, {
        method: 'PATCH',
        body: JSON.stringify({ nextFollowUpAt: null, isCompleted: true }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to complete follow-up');
      setFollowUpDate('');
      loadApplication();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setIsUpdatingFollowUp(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
        <Navbar />
        <div className="flex-1 flex items-center justify-center p-6">
          <div className="text-center space-y-3">
            <div className="w-8 h-8 border-2 border-sky-400 border-t-transparent rounded-full animate-spin mx-auto"></div>
            <p className="text-xs text-slate-400">Loading Application Hub...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error || !application) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
        <Navbar />
        <div className="flex-1 flex flex-col items-center justify-center p-6 space-y-4">
          <AlertCircle className="w-12 h-12 text-rose-400" />
          <h2 className="text-xl font-bold text-slate-200">{error || 'Application not found'}</h2>
          <Link
            href="/applications"
            className="px-4 py-2 rounded-xl bg-slate-900 border border-slate-800 text-xs font-semibold text-slate-300 hover:bg-slate-800 transition-colors"
          >
            ← Back to Applications
          </Link>
        </div>
      </div>
    );
  }

  const { job, match, tailoredResume, coverLetter, events = [] } = application;

  const milestones = [
    { label: 'Saved', date: application.savedAt },
    { label: 'Shortlisted', date: application.shortlistedAt },
    { label: 'Ready', date: application.readyAt },
    { label: 'Applied', date: application.appliedAt },
    { label: 'Interview', date: application.interviewAt },
    { label: 'Offer', date: application.offerAt },
    { label: 'Rejected', date: application.rejectedAt },
    { label: 'Withdrawn', date: application.withdrawnAt },
  ].filter((m) => m.date);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
      <Navbar />

      <main className="flex-1 max-w-7xl mx-auto px-4 sm:px-6 py-8 w-full space-y-8">
        {/* Top Navigation & Status Bar */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-slate-800">
          <div className="space-y-1.5">
            <Link
              href="/applications"
              className="inline-flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-200 font-semibold transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Back to Tracker</span>
            </Link>

            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-100">
                {job?.title}
              </h1>
              {job?.jobUrl && (
                <a
                  href={job.jobUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-md shadow-emerald-600/30 transition-all ml-2"
                  title="Open Original Job Posting to Apply"
                >
                  <span>Apply on Employer Site</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              )}
            </div>

            <div className="flex items-center gap-3 text-xs text-slate-400">
              <span className="font-semibold text-slate-300 text-sm">{job?.company}</span>
              <span>•</span>
              <span className="flex items-center gap-1">
                <MapPin className="w-3.5 h-3.5" />
                {job?.location || 'Location Not Specified'}
              </span>
              <span>•</span>
              <span className="capitalize">{job?.remoteType || 'Onsite'}</span>
            </div>
          </div>

          {/* Current Status Selector */}
          <div className="flex items-center gap-3 bg-slate-900/90 border border-slate-800 p-3 rounded-2xl shrink-0 shadow-lg">
            <div className="text-right">
              <div className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">
                Current Status
              </div>
              <select
                value={application.status}
                onChange={(e) => handleStatusChange(e.target.value as ApplicationStatus)}
                disabled={isUpdatingStatus}
                className="bg-slate-950 border border-slate-700 rounded-xl px-3 py-1.5 text-xs font-bold text-sky-400 focus:outline-none focus:border-sky-500 mt-0.5"
              >
                {STATUS_OPTIONS.map((opt) => (
                  <option key={opt.id} value={opt.id} className="bg-slate-950 text-slate-200 font-medium">
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Milestone Stage Timestamps */}
        {milestones.length > 0 && (
          <div className="flex items-center gap-3 overflow-x-auto pb-2 scrollbar-thin">
            {milestones.map((m, idx) => (
              <div
                key={idx}
                className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-900/60 border border-slate-800 text-xs shrink-0"
              >
                <CheckCircle2 className="w-3.5 h-3.5 text-sky-400" />
                <span className="font-bold text-slate-300">{m.label}:</span>
                <span className="text-slate-400 font-mono text-[11px]">
                  {new Date(m.date!).toLocaleDateString()}
                </span>
              </div>
            ))}
          </div>
        )}

        {/* 2-Column Grid: Left (Match, Materials, Notes), Right (Timeline) */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Left / Main Column (8 cols) */}
          <div className="lg:col-span-8 space-y-8">
            {/* 1. Job Match Breakdown (Step 4) */}
            {match && (
              <div className="bg-slate-900/60 border border-slate-800 rounded-3xl p-6 sm:p-7 space-y-5 shadow-xl">
                <div className="flex items-center justify-between border-b border-slate-800 pb-4">
                  <div className="space-y-0.5">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-400">
                      Step 4 AI Match Analysis
                    </span>
                    <h3 className="text-lg font-bold text-slate-100">Candidate Fit</h3>
                  </div>
                  <div className="px-3 py-1 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 font-black text-lg">
                    {match.matchScore}% Match
                  </div>
                </div>

                {match.explanation && (
                  <p className="text-xs text-slate-300 leading-relaxed bg-slate-950/60 p-4 rounded-2xl border border-slate-800/80">
                    {match.explanation}
                  </p>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                  {match.strengths && match.strengths.length > 0 && (
                    <div className="space-y-1.5 p-3 rounded-2xl bg-emerald-950/20 border border-emerald-900/30">
                      <div className="font-bold text-emerald-400 flex items-center gap-1.5">
                        <Check className="w-3.5 h-3.5" />
                        <span>Strengths</span>
                      </div>
                      <ul className="space-y-1 text-slate-300">
                        {match.strengths.map((s, i) => (
                          <li key={i}>• {s}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {match.concerns && match.concerns.length > 0 && (
                    <div className="space-y-1.5 p-3 rounded-2xl bg-amber-950/20 border border-amber-900/30">
                      <div className="font-bold text-amber-400 flex items-center gap-1.5">
                        <AlertCircle className="w-3.5 h-3.5" />
                        <span>Gaps & Considerations</span>
                      </div>
                      <ul className="space-y-1 text-slate-300">
                        {match.concerns.map((c, i) => (
                          <li key={i}>• {c}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* 2. Application Materials Used (Step 5) */}
            <div className="bg-slate-900/60 border border-slate-800 rounded-3xl p-6 sm:p-7 space-y-5 shadow-xl">
              <div className="space-y-0.5 border-b border-slate-800 pb-4">
                <span className="text-[10px] font-bold uppercase tracking-wider text-sky-400">
                  Step 5 Application Materials
                </span>
                <h3 className="text-lg font-bold text-slate-100">Linked Documents & Export</h3>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Tailored Resume */}
                <div className="p-4 rounded-2xl bg-slate-950/70 border border-slate-800 space-y-3">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2">
                      <FileText className="w-5 h-5 text-sky-400 shrink-0" />
                      <div>
                        <h4 className="font-bold text-xs text-slate-200">
                          {tailoredResume ? tailoredResume.title : 'Tailored Resume'}
                        </h4>
                        {tailoredResume && (
                          <span className="text-[10px] text-sky-400 font-mono">
                            Version v{tailoredResume.versionNumber}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {tailoredResume ? (
                    <div className="flex items-center gap-2 pt-2 border-t border-slate-800/80">
                      <Link
                        href={`/tailored-resumes/${tailoredResume.id}`}
                        className="text-xs text-sky-400 hover:text-sky-300 font-semibold"
                      >
                        Open Studio →
                      </Link>

                      <div className="ml-auto flex items-center gap-1.5">
                        <a
                          href={`${apiUrl}/api/tailored-resumes/${tailoredResume.id}/export/pdf`}
                          download
                          target="_blank"
                          rel="noreferrer"
                          className="px-2.5 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800 text-[10px] font-semibold"
                        >
                          PDF
                        </a>
                        <a
                          href={`${apiUrl}/api/tailored-resumes/${tailoredResume.id}/export/docx`}
                          download
                          target="_blank"
                          rel="noreferrer"
                          className="px-2.5 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800 text-[10px] font-semibold"
                        >
                          DOCX
                        </a>
                      </div>
                    </div>
                  ) : (
                    <div className="pt-2 text-xs text-slate-500">
                      <Link
                        href={`/jobs/${job?.id}`}
                        className="text-sky-400 hover:text-sky-300 font-semibold"
                      >
                        Generate tailored resume for this job →
                      </Link>
                    </div>
                  )}
                </div>

                {/* Cover Letter */}
                <div className="p-4 rounded-2xl bg-slate-950/70 border border-slate-800 space-y-3">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2">
                      <Mail className="w-5 h-5 text-indigo-400 shrink-0" />
                      <div>
                        <h4 className="font-bold text-xs text-slate-200">
                          {coverLetter ? coverLetter.title : 'Cover Letter'}
                        </h4>
                        {coverLetter && (
                          <span className="text-[10px] text-indigo-400 capitalize font-medium">
                            Tone: {coverLetter.tone}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {coverLetter ? (
                    <div className="flex items-center gap-2 pt-2 border-t border-slate-800/80">
                      <Link
                        href={`/cover-letters/${coverLetter.id}`}
                        className="text-xs text-indigo-400 hover:text-indigo-300 font-semibold"
                      >
                        Open Editor →
                      </Link>

                      <div className="ml-auto flex items-center gap-1.5">
                        <a
                          href={`${apiUrl}/api/cover-letters/${coverLetter.id}/export/pdf`}
                          download
                          target="_blank"
                          rel="noreferrer"
                          className="px-2.5 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800 text-[10px] font-semibold"
                        >
                          PDF
                        </a>
                        <a
                          href={`${apiUrl}/api/cover-letters/${coverLetter.id}/export/docx`}
                          download
                          target="_blank"
                          rel="noreferrer"
                          className="px-2.5 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800 text-[10px] font-semibold"
                        >
                          DOCX
                        </a>
                      </div>
                    </div>
                  ) : (
                    <div className="pt-2 text-xs text-slate-500">
                      <Link
                        href={`/jobs/${job?.id}`}
                        className="text-indigo-400 hover:text-indigo-300 font-semibold"
                      >
                        Draft cover letter for this job →
                      </Link>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Recruiter Contacts & Email Communication */}
            <div className="bg-slate-900/60 border border-slate-800 rounded-3xl p-6 sm:p-7 space-y-6 shadow-xl">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Mail className="w-4 h-4 text-purple-400" />
                  <h3 className="text-base font-bold text-slate-100">Recruiter Contacts & Emails</h3>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => openFollowUpComposer()}
                    className="px-3 py-1.5 rounded-xl bg-purple-600/20 hover:bg-purple-600/30 text-purple-300 border border-purple-500/30 text-xs font-semibold flex items-center gap-1.5 transition-colors"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>Follow-Up Draft</span>
                  </button>
                  <button
                    onClick={() => openNewComposer('RECRUITER_REPLY')}
                    className="px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold flex items-center gap-1.5 transition-colors shadow-sm shadow-indigo-600/20"
                  >
                    <Send className="w-3.5 h-3.5" />
                    <span>Compose</span>
                  </button>
                </div>
              </div>

              {/* Contacts Subsection */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                    Contacts ({contacts.length})
                  </span>
                  <button
                    onClick={() => setIsAddContactOpen(!isAddContactOpen)}
                    className="text-xs text-sky-400 hover:text-sky-300 flex items-center gap-1"
                  >
                    <Plus className="w-3 h-3" />
                    <span>{isAddContactOpen ? 'Cancel' : 'Add Contact'}</span>
                  </button>
                </div>

                {isAddContactOpen && (
                  <form onSubmit={handleCreateContact} className="p-3 rounded-2xl bg-slate-950/60 border border-slate-800 space-y-3">
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                      <input
                        type="text"
                        placeholder="Recruiter Name *"
                        value={contactName}
                        onChange={(e) => setContactName(e.target.value)}
                        required
                        className="bg-slate-900 border border-slate-800 rounded-xl px-3 py-1.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-sky-500"
                      />
                      <input
                        type="email"
                        placeholder="Email Address *"
                        value={contactEmail}
                        onChange={(e) => setContactEmail(e.target.value)}
                        required
                        className="bg-slate-900 border border-slate-800 rounded-xl px-3 py-1.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-sky-500"
                      />
                      <input
                        type="text"
                        placeholder="Role / Title (optional)"
                        value={contactRole}
                        onChange={(e) => setContactRole(e.target.value)}
                        className="bg-slate-900 border border-slate-800 rounded-xl px-3 py-1.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-sky-500"
                      />
                    </div>
                    <div className="flex justify-end">
                      <button
                        type="submit"
                        disabled={isSubmittingContact}
                        className="px-3 py-1.5 rounded-xl bg-sky-600 hover:bg-sky-500 text-white text-xs font-semibold disabled:opacity-50"
                      >
                        {isSubmittingContact ? 'Saving...' : 'Save Contact'}
                      </button>
                    </div>
                  </form>
                )}

                {contacts.length === 0 && !isAddContactOpen ? (
                  <p className="text-xs text-slate-500 italic">No contacts added for this application.</p>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {contacts.map((c) => (
                      <div key={c.id} className="p-2.5 rounded-xl bg-slate-950 border border-slate-800/80 flex items-center justify-between">
                        <div className="min-w-0 pr-2">
                          <div className="text-xs font-semibold text-slate-200 truncate">{c.name}</div>
                          <div className="text-[11px] text-slate-400 font-mono truncate">{c.email}</div>
                          {c.role && <div className="text-[10px] text-slate-500">{c.role}</div>}
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            onClick={() => openNewComposer('RECRUITER_REPLY', c.email)}
                            title="Compose message"
                            className="p-1 rounded-lg text-slate-400 hover:text-purple-300 hover:bg-purple-900/30"
                          >
                            <Send className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleDeleteContact(c.id)}
                            title="Delete contact"
                            className="p-1 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-900/30"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Associated Emails List */}
              <div className="space-y-3 pt-2 border-t border-slate-800/60">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                    Associated Emails ({associatedEmails.length})
                  </span>
                  <Link
                    href="/emails"
                    className="text-xs text-slate-400 hover:text-slate-200"
                  >
                    View All In Inbox →
                  </Link>
                </div>

                {associatedEmails.length === 0 ? (
                  <p className="text-xs text-slate-500 italic">No emails linked to this application yet.</p>
                ) : (
                  <div className="space-y-2">
                    {associatedEmails.map((em) => (
                      <div
                        key={em.id}
                        className="p-3 rounded-2xl bg-slate-950 border border-slate-800/80 hover:border-slate-700 transition-colors flex items-center justify-between gap-3"
                      >
                        <div className="min-w-0 flex-1 space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-slate-800 text-slate-300">
                              {em.category.replace('_', ' ')}
                            </span>
                            <span className="text-xs font-semibold text-slate-200 truncate">
                              {em.subject}
                            </span>
                          </div>
                          <div className="text-[11px] text-slate-400 flex items-center gap-2">
                            <span>From: {em.senderEmail || em.sender}</span>
                            <span>•</span>
                            <span>{new Date(em.receivedAt).toLocaleDateString()}</span>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <Link
                            href={`/emails/${em.id}`}
                            className="px-2.5 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800 text-[11px] font-semibold"
                          >
                            View
                          </Link>
                          <button
                            onClick={() => openNewComposer('RECRUITER_REPLY', em.senderEmail || em.sender)}
                            className="p-1.5 rounded-lg bg-purple-950/40 hover:bg-purple-900/60 text-purple-300 border border-purple-800/40"
                            title="Reply to email"
                          >
                            <Send className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* 3. Follow-Up Scheduling Widget */}
            <div className="bg-slate-900/60 border border-slate-800 rounded-3xl p-6 sm:p-7 space-y-4 shadow-xl">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Bell className="w-4 h-4 text-amber-400" />
                  <h3 className="text-base font-bold text-slate-100">Follow-up Management</h3>
                </div>
                {application.nextFollowUpAt && (
                  <span className="text-xs font-mono text-amber-300 font-semibold">
                    Scheduled: {new Date(application.nextFollowUpAt).toLocaleDateString()}
                  </span>
                )}
              </div>

              <div className="flex flex-col sm:flex-row items-center gap-3">
                <input
                  type="date"
                  value={followUpDate}
                  onChange={(e) => setFollowUpDate(e.target.value)}
                  className="w-full sm:w-auto bg-slate-950 border border-slate-800 rounded-xl px-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-sky-500"
                />

                <button
                  onClick={handleSaveFollowUp}
                  disabled={isUpdatingFollowUp}
                  className="px-3.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold transition-colors disabled:opacity-50"
                >
                  Set Follow-up
                </button>

                {application.nextFollowUpAt && (
                  <button
                    onClick={handleCompleteFollowUp}
                    disabled={isUpdatingFollowUp}
                    className="px-3.5 py-1.5 rounded-xl bg-emerald-950/40 hover:bg-emerald-900/60 border border-emerald-800/60 text-emerald-300 text-xs font-semibold transition-colors disabled:opacity-50"
                  >
                    Mark Completed
                  </button>
                )}
              </div>
            </div>

            {/* 4. Notes Section */}
            <div className="bg-slate-900/60 border border-slate-800 rounded-3xl p-6 sm:p-7 space-y-4 shadow-xl">
              <h3 className="text-base font-bold text-slate-100">Application Notes</h3>

              {application.notes ? (
                <div className="p-4 rounded-2xl bg-slate-950/70 border border-slate-800 text-xs leading-relaxed text-slate-300 whitespace-pre-wrap font-sans max-h-60 overflow-y-auto">
                  {application.notes}
                </div>
              ) : (
                <p className="text-xs text-slate-500 italic">No notes recorded yet.</p>
              )}

              {/* Add Note Form */}
              <form onSubmit={handleAddNote} className="space-y-3 pt-2">
                <textarea
                  rows={3}
                  value={newNote}
                  onChange={(e) => setNewNote(e.target.value)}
                  placeholder="e.g. Recruiter called; technical round next Tuesday. Prepare system design."
                  className="w-full bg-slate-950 border border-slate-800 rounded-2xl p-3 text-xs text-slate-200 focus:outline-none focus:border-sky-500 leading-relaxed"
                />

                <button
                  type="submit"
                  disabled={isSubmittingNote || !newNote.trim()}
                  className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-xl bg-sky-600 hover:bg-sky-500 text-white text-xs font-semibold shadow-md disabled:opacity-50 transition-all"
                >
                  <Send className="w-3 h-3" />
                  <span>{isSubmittingNote ? 'Saving...' : 'Add Note'}</span>
                </button>
              </form>
            </div>
          </div>

          {/* Right Column (4 cols): Application Timeline */}
          <div className="lg:col-span-4 space-y-6">
            <div className="bg-slate-900/60 border border-slate-800 rounded-3xl p-6 space-y-5 shadow-xl">
              <div className="flex items-center gap-2">
                <History className="w-4 h-4 text-sky-400" />
                <h3 className="text-base font-bold text-slate-100">Activity Timeline</h3>
              </div>

              {events.length === 0 ? (
                <p className="text-xs text-slate-500">No events recorded yet.</p>
              ) : (
                <div className="relative pl-6 space-y-6 before:absolute before:left-2 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-800">
                  {events.map((ev, idx) => (
                    <div key={idx} className="relative space-y-1 text-xs">
                      {/* Timeline Node Bullet */}
                      <div className="absolute -left-[27px] top-0.5 w-3 h-3 rounded-full bg-sky-500 border-2 border-slate-950 ring-2 ring-sky-500/20" />

                      <div className="font-bold text-slate-200">
                        {ev.description}
                      </div>

                      <div className="text-[10px] text-slate-500 font-mono">
                        {new Date(ev.createdAt).toLocaleString([], {
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </main>

      {/* Email Composer Modal */}
      {application && (
        <EmailComposerModal
          isOpen={isComposerOpen}
          onClose={() => setIsComposerOpen(false)}
          applicationId={application.id}
          defaultPurpose={composerPurpose}
          defaultTo={composerTo}
          onEmailSent={() => {
            loadApplication();
          }}
        />
      )}
    </div>
  );
}
