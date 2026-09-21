'use client';

import React, { useState, useEffect } from 'react';
import {
  X,
  Mail,
  Paperclip,
  Sparkles,
  Send,
  AlertCircle,
  CheckCircle2,
  FileText,
  Clock,
  ChevronRight,
  ArrowLeft,
  ShieldCheck,
} from 'lucide-react';
import { EmailPurpose, EmailTone, EmailAttachment } from '@ai-job-hunter/shared';

interface EmailComposerModalProps {
  isOpen: boolean;
  onClose: () => void;
  applicationId?: string;
  jobId?: string;
  replyToEmailId?: string;
  defaultTo?: string[];
  defaultSubject?: string;
  defaultBody?: string;
  defaultPurpose?: EmailPurpose;
  onEmailSent?: () => void;
}

export default function EmailComposerModal({
  isOpen,
  onClose,
  applicationId,
  jobId,
  replyToEmailId,
  defaultTo = [],
  defaultSubject = '',
  defaultBody = '',
  defaultPurpose = 'APPLICATION_FOLLOW_UP',
  onEmailSent,
}: EmailComposerModalProps) {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

  const [step, setStep] = useState<'compose' | 'review'>('compose');
  const [to, setTo] = useState<string>(defaultTo.join(', '));
  const [cc, setCc] = useState<string>('');
  const [subject, setSubject] = useState<string>(defaultSubject);
  const [body, setBody] = useState<string>(defaultBody);
  const [purpose, setPurpose] = useState<EmailPurpose>(defaultPurpose);
  const [tone, setTone] = useState<EmailTone>('professional');
  const [userInstructions, setUserInstructions] = useState<string>('');
  const [warnings, setWarnings] = useState<string[]>([]);

  // Attachments
  const [availableAttachments, setAvailableAttachments] = useState<EmailAttachment[]>([]);
  const [selectedAttachments, setSelectedAttachments] = useState<EmailAttachment[]>([]);

  // States
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [isSending, setIsSending] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setTo(defaultTo.join(', '));
      setSubject(defaultSubject);
      setBody(defaultBody);
      setPurpose(defaultPurpose);
      setStep('compose');
      setError(null);
      loadAvailableMaterials();
    }
  }, [isOpen, defaultTo, defaultSubject, defaultBody, defaultPurpose, applicationId, jobId]);

  const loadAvailableMaterials = async () => {
    try {
      const items: EmailAttachment[] = [];

      // Base resume
      const resVer = await fetch(`${apiUrl}/api/resumes/versions`, { cache: 'no-store' });
      if (resVer.ok) {
        const vData = await resVer.json();
        if (vData.data && vData.data.length > 0) {
          const active = vData.data[0];
          items.push({
            id: active.id,
            name: `${active.originalFilename || 'Base_Resume.pdf'}`,
            type: active.fileType === 'pdf' ? 'application/pdf' : 'application/octet-stream',
            size: Number(active.fileSize) || 102400,
            sourceType: 'base_resume',
            sourceId: active.id,
          });
        }
      }

      // If job ID available, fetch tailored materials
      if (jobId) {
        const [trRes, clRes] = await Promise.all([
          fetch(`${apiUrl}/api/jobs/${jobId}/tailored-resumes`, { cache: 'no-store' }),
          fetch(`${apiUrl}/api/jobs/${jobId}/cover-letters`, { cache: 'no-store' }),
        ]);

        if (trRes.ok) {
          const trData = await trRes.json();
          if (trData.data && trData.data.length > 0) {
            const tr = trData.data[0];
            items.push({
              id: tr.id,
              name: `Tailored_Resume_${tr.versionNumber || 'v1'}.pdf`,
              type: 'application/pdf',
              size: 150000,
              sourceType: 'tailored_resume',
              sourceId: tr.id,
            });
          }
        }

        if (clRes.ok) {
          const clData = await clRes.json();
          if (clData.data && clData.data.length > 0) {
            const cl = clData.data[0];
            items.push({
              id: cl.id,
              name: `Cover_Letter_${cl.tone || 'standard'}.pdf`,
              type: 'application/pdf',
              size: 80000,
              sourceType: 'cover_letter',
              sourceId: cl.id,
            });
          }
        }
      }

      setAvailableAttachments(items);
    } catch (err) {
      console.warn('Failed to load application materials for attachments', err);
    }
  };

  const handleGenerateAiDraft = async () => {
    setIsGenerating(true);
    setError(null);
    try {
      const res = await fetch(`${apiUrl}/api/emails/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          applicationId,
          emailId: replyToEmailId,
          purpose,
          tone,
          userInstructions,
        }),
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || 'Failed to generate draft');
      }

      const data = await res.json();
      if (data.data) {
        if (!subject || subject.trim() === '') {
          setSubject(data.data.subject);
        }
        setBody(data.data.body);
        setWarnings(data.data.warnings || []);
      }
    } catch (err: any) {
      setError(err.message || 'Draft generation error');
    } finally {
      setIsGenerating(false);
    }
  };

  const toggleAttachment = (item: EmailAttachment) => {
    if (selectedAttachments.some((a) => a.id === item.id)) {
      setSelectedAttachments(selectedAttachments.filter((a) => a.id !== item.id));
    } else {
      setSelectedAttachments([...selectedAttachments, item]);
    }
  };

  const handleSendEmail = async () => {
    setIsSending(true);
    setError(null);
    try {
      const toList = to.split(',').map((e) => e.trim()).filter(Boolean);
      const ccList = cc.split(',').map((e) => e.trim()).filter(Boolean);

      const res = await fetch(`${apiUrl}/api/emails/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          applicationId,
          to: toList,
          cc: ccList,
          subject,
          body,
          attachments: selectedAttachments,
        }),
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || 'Failed to send email');
      }

      if (onEmailSent) {
        onEmailSent();
      }
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to send email via Gmail');
    } finally {
      setIsSending(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-2xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-900/60">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 flex items-center justify-center">
              <Mail className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-100">
                {step === 'compose' ? 'AI Email Assistant & Composer' : 'Review & Confirm Send'}
              </h2>
              <p className="text-[11px] text-slate-400">
                {step === 'compose'
                  ? 'Generate, edit, and attach documents before sending'
                  : 'Explicit user confirmation required before Gmail delivery'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4 text-xs font-sans">
          {error && (
            <div className="p-3.5 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-300 flex items-center gap-2.5">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {step === 'compose' ? (
            <>
              {/* AI Draft Controls Banner */}
              <div className="p-4 rounded-2xl bg-indigo-950/30 border border-indigo-500/20 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-indigo-300 font-semibold text-xs">
                    <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
                    <span>Generate Draft with AI</span>
                  </div>
                  <button
                    type="button"
                    onClick={handleGenerateAiDraft}
                    disabled={isGenerating}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-medium text-xs shadow-md shadow-indigo-600/30 transition-all disabled:opacity-50"
                  >
                    <Sparkles className={`w-3.5 h-3.5 ${isGenerating ? 'animate-spin' : ''}`} />
                    <span>{isGenerating ? 'Drafting...' : 'Generate Draft'}</span>
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-medium text-slate-400 mb-1">Purpose</label>
                    <select
                      value={purpose}
                      onChange={(e) => setPurpose(e.target.value as EmailPurpose)}
                      className="w-full bg-slate-900 border border-slate-700 rounded-xl px-2.5 py-1.5 text-slate-200 text-xs focus:border-indigo-500 outline-none"
                    >
                      <option value="APPLICATION_FOLLOW_UP">Application Follow-Up</option>
                      <option value="RECRUITER_REPLY">Reply to Recruiter</option>
                      <option value="INTERVIEW_CONFIRMATION">Interview Confirmation</option>
                      <option value="INTERVIEW_RESCHEDULE">Interview Reschedule Request</option>
                      <option value="THANK_YOU">Post-Interview Thank You</option>
                      <option value="APPLICATION_STATUS_QUERY">Inquire on Status</option>
                      <option value="OFFER_RESPONSE">Offer Acceptance / Inquiry</option>
                      <option value="GENERAL_RECRUITER_REPLY">General Reply</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] font-medium text-slate-400 mb-1">Tone</label>
                    <select
                      value={tone}
                      onChange={(e) => setTone(e.target.value as EmailTone)}
                      className="w-full bg-slate-900 border border-slate-700 rounded-xl px-2.5 py-1.5 text-slate-200 text-xs focus:border-indigo-500 outline-none"
                    >
                      <option value="professional">Professional (Standard)</option>
                      <option value="concise">Concise & Direct</option>
                      <option value="friendly">Friendly & Warm</option>
                      <option value="formal">Formal</option>
                    </select>
                  </div>
                </div>

                <div>
                  <input
                    type="text"
                    placeholder="Specific instructions or dates (e.g., 'Available on Tuesday after 2 PM')"
                    value={userInstructions}
                    onChange={(e) => setUserInstructions(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700/80 rounded-xl px-3 py-1.5 text-slate-300 text-xs focus:border-indigo-500 outline-none placeholder:text-slate-600"
                  />
                </div>
              </div>

              {warnings.length > 0 && (
                <div className="p-3 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-[11px] space-y-1">
                  <div className="font-semibold flex items-center gap-1.5">
                    <AlertCircle className="w-3.5 h-3.5" />
                    <span>Notice: Fill in placeholders</span>
                  </div>
                  {warnings.map((w, i) => (
                    <p key={i} className="text-amber-400/90 ml-5">• {w}</p>
                  ))}
                </div>
              )}

              {/* Form Fields */}
              <div className="space-y-3">
                <div>
                  <label className="block text-[11px] font-medium text-slate-400 mb-1">To</label>
                  <input
                    type="text"
                    value={to}
                    onChange={(e) => setTo(e.target.value)}
                    placeholder="recruiter@example.com"
                    className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-slate-100 text-xs focus:border-indigo-500 outline-none"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-medium text-slate-400 mb-1">Cc (Optional)</label>
                  <input
                    type="text"
                    value={cc}
                    onChange={(e) => setCc(e.target.value)}
                    placeholder="team@example.com"
                    className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-slate-100 text-xs focus:border-indigo-500 outline-none"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-medium text-slate-400 mb-1">Subject</label>
                  <input
                    type="text"
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    placeholder="Regarding Backend Engineer application"
                    className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-slate-100 text-xs focus:border-indigo-500 outline-none font-medium"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-medium text-slate-400 mb-1">Message Body</label>
                  <textarea
                    rows={8}
                    value={body}
                    onChange={(e) => setBody(e.target.value)}
                    placeholder="Write your email or use 'Generate Draft' above..."
                    className="w-full bg-slate-900 border border-slate-800 rounded-xl p-3 text-slate-200 text-xs focus:border-indigo-500 outline-none resize-none font-sans leading-relaxed"
                  />
                </div>

                {/* Attachments Section */}
                <div className="pt-2 border-t border-slate-800/80">
                  <label className="block text-[11px] font-medium text-slate-400 mb-2 flex items-center gap-1.5">
                    <Paperclip className="w-3.5 h-3.5 text-slate-500" />
                    <span>Application Material Attachments</span>
                  </label>

                  {availableAttachments.length === 0 ? (
                    <p className="text-[11px] text-slate-500 italic">No tailored materials found for this role yet.</p>
                  ) : (
                    <div className="space-y-2">
                      {availableAttachments.map((att) => {
                        const isSelected = selectedAttachments.some((a) => a.id === att.id);
                        return (
                          <label
                            key={att.id}
                            className={`flex items-center justify-between p-2.5 rounded-xl border cursor-pointer transition-all ${
                              isSelected
                                ? 'bg-indigo-950/40 border-indigo-500/40 text-slate-200'
                                : 'bg-slate-900/40 border-slate-800 text-slate-400 hover:bg-slate-800/40'
                            }`}
                          >
                            <div className="flex items-center gap-2.5">
                              <input
                                type="checkbox"
                                checked={isSelected}
                                onChange={() => toggleAttachment(att)}
                                className="rounded border-slate-700 bg-slate-800 text-indigo-600 focus:ring-0"
                              />
                              <FileText className="w-3.5 h-3.5 text-indigo-400" />
                              <span className="font-medium">{att.name}</span>
                            </div>
                            <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-400">
                              {att.sourceType.replace('_', ' ')}
                            </span>
                          </label>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            </>
          ) : (
            /* Review & Confirm Step */
            <div className="space-y-5">
              <div className="p-4 rounded-2xl bg-indigo-950/20 border border-indigo-500/30 flex items-start gap-3">
                <ShieldCheck className="w-5 h-5 text-indigo-400 shrink-0 mt-0.5" />
                <div>
                  <h4 className="font-bold text-slate-100 text-xs">Confirm Gmail Delivery</h4>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    Please review your message below. Clicking &quot;Send via Gmail&quot; will immediately dispatch this email from your connected Google account.
                  </p>
                </div>
              </div>

              <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-3">
                <div className="flex items-center gap-2 text-xs">
                  <span className="text-slate-500 w-16">To:</span>
                  <span className="text-slate-200 font-semibold">{to}</span>
                </div>
                {cc && (
                  <div className="flex items-center gap-2 text-xs">
                    <span className="text-slate-500 w-16">Cc:</span>
                    <span className="text-slate-300">{cc}</span>
                  </div>
                )}
                <div className="flex items-center gap-2 text-xs">
                  <span className="text-slate-500 w-16">Subject:</span>
                  <span className="text-slate-100 font-semibold">{subject}</span>
                </div>
                <div className="pt-3 border-t border-slate-800">
                  <span className="text-slate-500 text-[11px] block mb-2">Body:</span>
                  <pre className="text-slate-300 text-xs whitespace-pre-wrap font-sans leading-relaxed bg-slate-900/60 p-3.5 rounded-xl border border-slate-800/80 max-h-56 overflow-y-auto">
                    {body}
                  </pre>
                </div>

                {selectedAttachments.length > 0 && (
                  <div className="pt-3 border-t border-slate-800">
                    <span className="text-slate-500 text-[11px] block mb-1.5">
                      Attached Files ({selectedAttachments.length}):
                    </span>
                    <div className="flex flex-wrap gap-2">
                      {selectedAttachments.map((att) => (
                        <span
                          key={att.id}
                          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-indigo-500/10 border border-indigo-500/20 text-indigo-300 text-[11px] font-medium"
                        >
                          <FileText className="w-3 h-3 text-indigo-400" />
                          {att.name}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-4 border-t border-slate-800 bg-slate-900/80 flex items-center justify-between">
          {step === 'compose' ? (
            <>
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-xl text-slate-400 hover:text-slate-200 text-xs font-semibold transition-colors"
              >
                Cancel
              </button>

              <button
                type="button"
                disabled={!to.trim() || !subject.trim() || !body.trim()}
                onClick={() => setStep('review')}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs shadow-lg shadow-indigo-600/20 transition-all disabled:opacity-40"
              >
                <span>Review & Send</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={() => setStep('compose')}
                disabled={isSending}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-slate-300 hover:text-slate-100 text-xs font-semibold transition-colors"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Back to Edit</span>
              </button>

              <button
                type="button"
                onClick={handleSendEmail}
                disabled={isSending}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-xs shadow-lg shadow-emerald-600/20 transition-all disabled:opacity-50"
              >
                <Send className={`w-3.5 h-3.5 ${isSending ? 'animate-spin' : ''}`} />
                <span>{isSending ? 'Sending via Gmail...' : 'Send via Gmail'}</span>
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
