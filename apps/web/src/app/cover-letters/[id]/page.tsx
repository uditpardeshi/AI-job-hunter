'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import {
  ArrowLeft,
  Download,
  Save,
  Mail,
  Copy,
  Check,
  RefreshCw,
  Sparkles,
  Layers,
  ShieldCheck,
  Building2,
  FileText,
} from 'lucide-react';
import { CoverLetter } from '@ai-job-hunter/shared';
import { authFetch } from '@/lib/api';

export default function CoverLetterStudioPage() {
  const params = useParams();
  const router = useRouter();
  const id = params?.id as string;
  const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

  const [coverLetter, setCoverLetter] = useState<CoverLetter | null>(null);
  const [title, setTitle] = useState<string>('');
  const [content, setContent] = useState<string>('');
  const [selectedTone, setSelectedTone] = useState<'professional' | 'conversational' | 'enthusiastic' | 'executive'>('professional');

  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [isRegenerating, setIsRegenerating] = useState<boolean>(false);
  const [saveSuccess, setSaveSuccess] = useState<boolean>(false);
  const [copySuccess, setCopySuccess] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadCoverLetter() {
      if (!id) return;
      setIsLoading(true);
      try {
        const res = await authFetch(`${apiUrl}/api/cover-letters/${id}`, { cache: 'no-store' });
        if (!res.ok) {
          throw new Error(`Failed to load cover letter (HTTP ${res.status})`);
        }
        const data = await res.json();
        const cl: CoverLetter = data.data;
        setCoverLetter(cl);
        setTitle(cl.title || '');
        setContent(cl.content || '');
        setSelectedTone((cl.tone as any) || 'professional');
      } catch (err: any) {
        setError(err.message || 'Error loading cover letter');
      } finally {
        setIsLoading(false);
      }
    }
    loadCoverLetter();
  }, [id, apiUrl]);

  const handleSave = async () => {
    if (!id) return;
    setIsSaving(true);
    setSaveSuccess(false);
    try {
      const res = await authFetch(`${apiUrl}/api/cover-letters/${id}`, {
        method: 'PUT',
        body: JSON.stringify({
          content,
          tone: selectedTone,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || data.message || 'Failed to save cover letter');
      }
      setCoverLetter(data.data);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err: any) {
      alert(err.message || 'Save failed');
    } finally {
      setIsSaving(false);
    }
  };

  const handleRegenerateTone = async (newTone: 'professional' | 'conversational' | 'enthusiastic' | 'executive') => {
    if (!coverLetter) return;
    setSelectedTone(newTone);
    setIsRegenerating(true);
    try {
      const res = await authFetch(`${apiUrl}/api/jobs/${coverLetter.jobId}/cover-letter`, {
        method: 'POST',
        body: JSON.stringify({
          tone: newTone,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || data.message || 'Regeneration failed');
      }
      router.push(`/cover-letters/${data.data.id}`);
    } catch (err: any) {
      alert(err.message || 'Failed to regenerate with new tone');
      setIsRegenerating(false);
    }
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(content);
    setCopySuccess(true);
    setTimeout(() => setCopySuccess(false), 2500);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-6">
        <div className="text-center space-y-3">
          <div className="w-8 h-8 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin mx-auto"></div>
          <p className="text-xs text-slate-400">Loading Cover Letter Studio...</p>
        </div>
      </div>
    );
  }

  if (error || !coverLetter) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col items-center justify-center p-6 space-y-4">
        <Layers className="w-12 h-12 text-rose-400" />
        <h2 className="text-xl font-bold text-slate-200">{error || 'Cover letter not found'}</h2>
        <button
          onClick={() => router.back()}
          className="px-4 py-2 rounded-xl bg-slate-900 border border-slate-800 text-xs font-semibold text-slate-300 hover:bg-slate-800 transition-colors"
        >
          ← Go Back
        </button>
      </div>
    );
  }

  const tones: Array<{ id: 'professional' | 'conversational' | 'enthusiastic' | 'executive'; label: string; desc: string }> = [
    { id: 'professional', label: 'Professional', desc: 'Direct, clear, and business-formal' },
    { id: 'conversational', label: 'Conversational', desc: 'Approachable, warm, and engaging' },
    { id: 'enthusiastic', label: 'Enthusiastic', desc: 'High energy, mission-focused' },
    { id: 'executive', label: 'Executive', desc: 'High-level, strategic impact-driven' },
  ];

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
      {/* Studio Header */}
      <header className="border-b border-slate-800 bg-slate-900/90 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link
              href={`/jobs/${coverLetter.jobId}`}
              className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-400 hover:text-slate-200 transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Back to Job</span>
            </Link>
            <div className="h-4 w-px bg-slate-800" />
            <div className="flex items-center gap-2">
              <span className="font-bold text-sm text-slate-100 truncate max-w-xs">
                {title || 'Cover Letter'}
              </span>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold capitalize bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                {coverLetter.tone}
              </span>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-slate-800 text-slate-400 border border-slate-700">
                v{coverLetter.versionNumber}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            {/* Copy Button */}
            <button
              onClick={handleCopy}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-200 border border-slate-800 text-xs font-semibold transition-all shadow-sm"
              title="Copy letter text to clipboard"
            >
              {copySuccess ? (
                <Check className="w-3.5 h-3.5 text-emerald-400" />
              ) : (
                <Copy className="w-3.5 h-3.5 text-slate-400" />
              )}
              <span className="hidden sm:inline">{copySuccess ? 'Copied!' : 'Copy'}</span>
            </button>

            {/* Export PDF */}
            <a
              href={`${apiUrl}/api/cover-letters/${id}/export/pdf`}
              download
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-200 border border-slate-800 text-xs font-semibold transition-all shadow-sm"
            >
              <Download className="w-3.5 h-3.5 text-rose-400" />
              <span className="hidden sm:inline">PDF</span>
            </a>

            {/* Export DOCX */}
            <a
              href={`${apiUrl}/api/cover-letters/${id}/export/docx`}
              download
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-200 border border-slate-800 text-xs font-semibold transition-all shadow-sm"
            >
              <Download className="w-3.5 h-3.5 text-sky-400" />
              <span className="hidden sm:inline">DOCX</span>
            </a>

            {/* Save Button */}
            <button
              onClick={handleSave}
              disabled={isSaving}
              className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-lg shadow-indigo-600/20 transition-all disabled:opacity-50"
            >
              {isSaving ? (
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
              ) : saveSuccess ? (
                <Check className="w-3.5 h-3.5 text-emerald-200" />
              ) : (
                <Save className="w-3.5 h-3.5" />
              )}
              <span>{isSaving ? 'Saving...' : saveSuccess ? 'Saved!' : 'Save'}</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 max-w-6xl mx-auto px-4 sm:px-6 py-6 w-full space-y-6">
        {/* Tone Selector Bar */}
        <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-0.5">
            <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-400">
              Tone & Voice
            </span>
            <p className="text-xs text-slate-400">Switch tone to regenerate with adapted voice</p>
          </div>

          <div className="flex flex-wrap gap-2">
            {tones.map((t) => (
              <button
                key={t.id}
                onClick={() => handleRegenerateTone(t.id)}
                disabled={isRegenerating}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all border ${
                  selectedTone === t.id
                    ? 'bg-indigo-600 text-white border-indigo-500 shadow-lg shadow-indigo-600/20'
                    : 'bg-slate-950/60 text-slate-400 border-slate-800 hover:border-slate-700 hover:text-slate-200'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        {/* 2-Column Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Main Letter Editor Canvas (8 cols) */}
          <div className="lg:col-span-8 bg-slate-900/60 border border-slate-800 rounded-3xl p-6 sm:p-8 space-y-6 shadow-xl">
            {/* Subject / Title Header */}
            <div className="border-b border-slate-800 pb-4">
              <h2 className="text-base font-bold text-slate-100">{title}</h2>
              <div className="text-[11px] text-slate-500 mt-0.5">
                Target Role Application Material
              </div>
            </div>

            {/* Letter Body Textarea */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold uppercase tracking-wider text-indigo-400 flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Cover Letter Content</span>
                </label>
                <span className="text-[10px] text-slate-500">
                  {content.split(/\s+/).filter(Boolean).length} words
                </span>
              </div>
              <textarea
                rows={18}
                value={content}
                onChange={(e) => setContent(e.target.value)}
                className="w-full bg-slate-950/80 border border-slate-800 rounded-2xl p-5 text-xs sm:text-sm leading-relaxed text-slate-200 focus:outline-none focus:border-indigo-500 transition-colors font-sans"
              />
            </div>
          </div>

          {/* Right Sidebar: Grounding & Truthfulness Notice (4 cols) */}
          <div className="lg:col-span-4 space-y-6">
            <div className="bg-slate-900/70 border border-slate-800 rounded-3xl p-6 space-y-5 shadow-xl">
              <div className="flex items-center gap-2 text-emerald-400">
                <ShieldCheck className="w-5 h-5 text-emerald-400 shrink-0" />
                <h3 className="text-xs font-bold uppercase tracking-wider">
                  Factual Grounding Check
                </h3>
              </div>

              <p className="text-xs text-slate-400 leading-relaxed">
                This cover letter is generated strictly by synthesizing your verified candidate experience with the target job's stated requirements.
              </p>

              <div className="space-y-2.5 border-t border-slate-800/80 pt-4 text-xs">
                <div className="font-semibold text-slate-300">Grounded Safeguards:</div>
                <div className="space-y-2 text-slate-400">
                  <div className="flex items-start gap-2">
                    <span className="text-emerald-400 font-bold">✓</span>
                    <span>No unverified skills or tools hallucinated.</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="text-emerald-400 font-bold">✓</span>
                    <span>No unverified company culture claims made.</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="text-emerald-400 font-bold">✓</span>
                    <span>Tone adapted to highlight genuine role relevance.</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
