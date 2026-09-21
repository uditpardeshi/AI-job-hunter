'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import {
  ArrowLeft,
  Download,
  Save,
  ShieldAlert,
  CheckCircle2,
  AlertTriangle,
  FileText,
  Sparkles,
  Plus,
  Trash2,
  Check,
  RefreshCw,
  Layers,
  Award,
  BookOpen,
} from 'lucide-react';
import {
  TailoredResume,
  TailoredResumeData,
  ValidationFlag,
  AtsAnalysisResult,
  TailoringChanges,
} from '@ai-job-hunter/shared';

export default function TailoredResumeStudioPage() {
  const params = useParams();
  const router = useRouter();
  const id = params?.id as string;
  const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

  const [resume, setResume] = useState<TailoredResume | null>(null);
  const [formData, setFormData] = useState<TailoredResumeData | null>(null);
  const [title, setTitle] = useState<string>('');
  const [flags, setFlags] = useState<ValidationFlag[]>([]);
  const [atsAnalysis, setAtsAnalysis] = useState<AtsAnalysisResult | null>(null);
  const [changelog, setChangelog] = useState<TailoringChanges | null>(null);

  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [saveSuccess, setSaveSuccess] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadResume() {
      if (!id) return;
      setIsLoading(true);
      try {
        const res = await fetch(`${apiUrl}/api/tailored-resumes/${id}`, { cache: 'no-store' });
        if (!res.ok) {
          throw new Error(`Failed to load tailored resume (HTTP ${res.status})`);
        }
        const data = await res.json();
        const tr: TailoredResume = data.data;
        setResume(tr);
        setFormData(tr.resumeData);
        setTitle(tr.title || '');
        setFlags(tr.validationFlags || []);
        setAtsAnalysis(tr.atsAnalysis || null);
        setChangelog(tr.tailoringChanges || null);
      } catch (err: any) {
        setError(err.message || 'Error loading tailored resume');
      } finally {
        setIsLoading(false);
      }
    }
    loadResume();
  }, [id, apiUrl]);

  const handleSave = async (updatedData?: TailoredResumeData) => {
    if (!id || !formData) return;
    setIsSaving(true);
    setSaveSuccess(false);
    try {
      const dataToSave = updatedData || formData;
      const res = await fetch(`${apiUrl}/api/tailored-resumes/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          resumeData: dataToSave,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || data.message || 'Failed to save edits');
      }
      setResume(data.data);
      setAtsAnalysis(data.data.atsAnalysis || null);
      setFlags(data.data.validationFlags || []);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err: any) {
      alert(err.message || 'Save failed');
    } finally {
      setIsSaving(false);
    }
  };

  // Flag Resolution: remove flagged item from skills or text
  const handleRemoveFlaggedItem = (flag: ValidationFlag) => {
    if (!formData) return;
    const newFormData = { ...formData };

    if (flag.type === 'unsupported_skill') {
      newFormData.skills = newFormData.skills.filter(
        (s) => s.toLowerCase() !== flag.item.toLowerCase()
      );
    }

    setFormData(newFormData);
    const remainingFlags = flags.filter((f) => f !== flag);
    setFlags(remainingFlags);
    handleSave(newFormData);
  };

  const handleDismissFlag = (flag: ValidationFlag) => {
    const remainingFlags = flags.filter((f) => f !== flag);
    setFlags(remainingFlags);
  };

  // Form manipulation handlers
  const updateSummary = (val: string) => {
    if (!formData) return;
    setFormData({ ...formData, summary: val });
  };

  const addSkill = (skill: string) => {
    if (!formData || !skill.trim()) return;
    if (formData.skills.includes(skill.trim())) return;
    setFormData({ ...formData, skills: [...formData.skills, skill.trim()] });
  };

  const removeSkill = (index: number) => {
    if (!formData) return;
    const newSkills = [...formData.skills];
    newSkills.splice(index, 1);
    setFormData({ ...formData, skills: newSkills });
  };

  const updateExperienceBullet = (expIndex: number, bulletIndex: number, text: string) => {
    if (!formData) return;
    const newExp = [...formData.experience];
    newExp[expIndex].bullets[bulletIndex] = text;
    setFormData({ ...formData, experience: newExp });
  };

  const addExperienceBullet = (expIndex: number) => {
    if (!formData) return;
    const newExp = [...formData.experience];
    newExp[expIndex].bullets.push('Accomplished key deliverable aligned with requirements.');
    setFormData({ ...formData, experience: newExp });
  };

  const removeExperienceBullet = (expIndex: number, bulletIndex: number) => {
    if (!formData) return;
    const newExp = [...formData.experience];
    newExp[expIndex].bullets.splice(bulletIndex, 1);
    setFormData({ ...formData, experience: newExp });
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-6">
        <div className="text-center space-y-3">
          <div className="w-8 h-8 border-2 border-sky-400 border-t-transparent rounded-full animate-spin mx-auto"></div>
          <p className="text-xs text-slate-400">Loading Tailored Resume Studio...</p>
        </div>
      </div>
    );
  }

  if (error || !resume || !formData) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col items-center justify-center p-6 space-y-4">
        <Layers className="w-12 h-12 text-rose-400" />
        <h2 className="text-xl font-bold text-slate-200">{error || 'Resume not found'}</h2>
        <button
          onClick={() => router.back()}
          className="px-4 py-2 rounded-xl bg-slate-900 border border-slate-800 text-xs font-semibold text-slate-300 hover:bg-slate-800 transition-colors"
        >
          ← Go Back
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
      {/* Studio Header */}
      <header className="border-b border-slate-800 bg-slate-900/90 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link
              href={`/jobs/${resume.jobId}`}
              className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-400 hover:text-slate-200 transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Back to Job</span>
            </Link>
            <div className="h-4 w-px bg-slate-800" />
            <div className="flex items-center gap-2">
              <span className="font-bold text-sm text-slate-100 truncate max-w-xs sm:max-w-sm">
                {title || 'Tailored Resume'}
              </span>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-sky-500/10 text-sky-400 border border-sky-500/20">
                v{resume.versionNumber}
              </span>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-medium capitalize bg-slate-800 text-slate-400 border border-slate-700">
                {resume.status.replace('_', ' ')}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            {/* Download PDF */}
            <a
              href={`${apiUrl}/api/tailored-resumes/${id}/export/pdf`}
              download
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-200 border border-slate-800 text-xs font-semibold transition-all shadow-sm"
              title="Download ATS-friendly vector PDF"
            >
              <Download className="w-3.5 h-3.5 text-rose-400" />
              <span className="hidden sm:inline">PDF</span>
            </a>

            {/* Download DOCX */}
            <a
              href={`${apiUrl}/api/tailored-resumes/${id}/export/docx`}
              download
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-200 border border-slate-800 text-xs font-semibold transition-all shadow-sm"
              title="Download formatted Word DOCX"
            >
              <Download className="w-3.5 h-3.5 text-sky-400" />
              <span className="hidden sm:inline">DOCX</span>
            </a>

            {/* Save Button */}
            <button
              onClick={() => handleSave()}
              disabled={isSaving}
              className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-xl bg-sky-600 hover:bg-sky-500 text-white text-xs font-semibold shadow-lg shadow-sky-600/20 transition-all disabled:opacity-50"
            >
              {isSaving ? (
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
              ) : saveSuccess ? (
                <Check className="w-3.5 h-3.5 text-emerald-200" />
              ) : (
                <Save className="w-3.5 h-3.5" />
              )}
              <span>{isSaving ? 'Saving...' : saveSuccess ? 'Saved!' : 'Save Edits'}</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Studio Area */}
      <main className="flex-1 max-w-7xl mx-auto px-4 sm:px-6 py-6 w-full space-y-6">
        {/* Anti-Fabrication & Truthfulness Warnings Banner */}
        {flags.length > 0 && (
          <div className="bg-amber-950/30 border border-amber-800/60 rounded-2xl p-5 space-y-4 shadow-lg">
            <div className="flex items-center gap-2.5 text-amber-400">
              <ShieldAlert className="w-5 h-5 shrink-0 text-amber-400" />
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider">
                  Truthfulness & Anti-Fabrication Notice ({flags.length})
                </h3>
                <p className="text-xs text-amber-200/80">
                  The system detected terms not present in your verified candidate profile. Review before finalizing.
                </p>
              </div>
            </div>

            <div className="space-y-2">
              {flags.map((flag, idx) => (
                <div
                  key={idx}
                  className="bg-slate-950/70 border border-amber-900/50 rounded-xl p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-amber-500/20 text-amber-300 border border-amber-500/30">
                        {flag.type.replace('_', ' ')}
                      </span>
                      <span className="font-semibold text-slate-200">
                        "{flag.item}"
                      </span>
                    </div>
                    <p className="text-slate-300">{flag.message}</p>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={() => handleRemoveFlaggedItem(flag)}
                      className="px-3 py-1 rounded-lg bg-rose-950/40 hover:bg-rose-900/60 text-rose-300 border border-rose-800/60 text-xs font-semibold transition-all"
                    >
                      Remove Item
                    </button>
                    <button
                      onClick={() => handleDismissFlag(flag)}
                      className="px-3 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800 text-xs font-semibold transition-all"
                    >
                      Confirm / Keep
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 2-Column Studio Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Left Canvas: Paper Resume Editor */}
          <div className="lg:col-span-8 space-y-6">
            <div className="bg-slate-900/60 border border-slate-800 rounded-3xl p-6 sm:p-8 space-y-8 shadow-xl">
              {/* Header Info */}
              <div className="border-b border-slate-800/80 pb-6 space-y-3">
                <div className="flex items-center justify-between">
                  <h2 className="text-xl font-extrabold text-slate-100">{formData.header.name}</h2>
                  <div className="text-xs text-slate-400">{formData.header.location}</div>
                </div>
                <div className="text-xs text-slate-400 flex flex-wrap gap-4 font-mono">
                  <span>{formData.header.email}</span>
                  {formData.header.phone && <span>{formData.header.phone}</span>}
                </div>
              </div>

              {/* Professional Summary */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold uppercase tracking-wider text-sky-400 flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>Tailored Professional Summary</span>
                  </label>
                  <span className="text-[10px] text-slate-500">Keywords naturally woven</span>
                </div>
                <textarea
                  rows={4}
                  value={formData.summary}
                  onChange={(e) => updateSummary(e.target.value)}
                  className="w-full bg-slate-950/80 border border-slate-800 rounded-2xl p-4 text-xs leading-relaxed text-slate-200 focus:outline-none focus:border-sky-500 transition-colors"
                />
              </div>

              {/* Skills Alignment */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold uppercase tracking-wider text-sky-400 flex items-center gap-1.5">
                    <Award className="w-3.5 h-3.5" />
                    <span>Aligned Technical & Domain Skills</span>
                  </label>
                  <span className="text-[10px] text-slate-500">Ranked by job relevance</span>
                </div>

                <div className="flex flex-wrap gap-2 p-3 bg-slate-950/80 border border-slate-800 rounded-2xl">
                  {formData.skills.map((skill, idx) => (
                    <span
                      key={idx}
                      className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-slate-900 border border-slate-800 text-xs font-medium text-slate-200 hover:border-slate-700 transition-all"
                    >
                      <span>{skill}</span>
                      <button
                        onClick={() => removeSkill(idx)}
                        className="text-slate-500 hover:text-rose-400 transition-colors"
                      >
                        ×
                      </button>
                    </span>
                  ))}
                </div>

                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    id="new-skill-input"
                    placeholder="Add verified skill..."
                    className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-sky-500"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        addSkill((e.target as HTMLInputElement).value);
                        (e.target as HTMLInputElement).value = '';
                      }
                    }}
                  />
                  <button
                    onClick={() => {
                      const input = document.getElementById('new-skill-input') as HTMLInputElement;
                      if (input) {
                        addSkill(input.value);
                        input.value = '';
                      }
                    }}
                    className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-200"
                  >
                    Add
                  </button>
                </div>
              </div>

              {/* Experience Section */}
              <div className="space-y-6">
                <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                  <label className="text-xs font-bold uppercase tracking-wider text-sky-400 flex items-center gap-1.5">
                    <BookOpen className="w-3.5 h-3.5" />
                    <span>Tailored Experience</span>
                  </label>
                  <span className="text-[10px] text-slate-500">
                    Targeting role-specific deliverables
                  </span>
                </div>

                <div className="space-y-6">
                  {formData.experience.map((exp, expIdx) => (
                    <div
                      key={expIdx}
                      className="bg-slate-950/60 border border-slate-800/80 rounded-2xl p-5 space-y-4"
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 border-b border-slate-800/60 pb-3">
                        <div>
                          <h4 className="text-sm font-bold text-slate-100">{exp.title}</h4>
                          <div className="text-xs text-sky-400 font-medium">{exp.company}</div>
                        </div>
                        <div className="text-xs text-slate-500 font-mono">
                          {exp.startDate || ''} - {exp.endDate || 'Present'}
                        </div>
                      </div>

                      {/* Bullet points list */}
                      <div className="space-y-2.5">
                        {exp.bullets.map((bullet, bIdx) => (
                          <div key={bIdx} className="flex items-start gap-2">
                            <span className="text-sky-400 font-bold mt-2 text-xs">•</span>
                            <textarea
                              rows={2}
                              value={bullet}
                              onChange={(e) => updateExperienceBullet(expIdx, bIdx, e.target.value)}
                              className="flex-1 bg-slate-900/80 border border-slate-800 rounded-xl p-2.5 text-xs text-slate-300 leading-relaxed focus:outline-none focus:border-sky-500 transition-colors"
                            />
                            <button
                              onClick={() => removeExperienceBullet(expIdx, bIdx)}
                              className="text-slate-600 hover:text-rose-400 p-1.5 rounded-lg transition-colors mt-1"
                              title="Delete bullet point"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ))}

                        <button
                          onClick={() => addExperienceBullet(expIdx)}
                          className="inline-flex items-center gap-1 text-[11px] text-sky-400 hover:text-sky-300 font-semibold pt-1"
                        >
                          <Plus className="w-3 h-3" />
                          <span>Add achievement bullet</span>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Education Section */}
              {formData.education && formData.education.length > 0 && (
                <div className="space-y-3 pt-2">
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-400">
                    Education
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {formData.education.map((edu, idx) => (
                      <div
                        key={idx}
                        className="bg-slate-950/60 border border-slate-800/80 rounded-xl p-3.5 space-y-1"
                      >
                        <div className="font-semibold text-xs text-slate-200">
                          {edu.degree} {edu.field ? `in ${edu.field}` : ''}
                        </div>
                        <div className="text-xs text-slate-400">{edu.institution}</div>
                        {edu.endDate && (
                          <div className="text-[10px] text-slate-500 font-mono">
                            Graduated: {edu.endDate}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Right Sidebar: ATS Analysis & Changelog */}
          <div className="lg:col-span-4 space-y-6">
            {/* ATS Alignment Score Card */}
            {atsAnalysis && (
              <div className="bg-slate-900/70 border border-slate-800 rounded-3xl p-6 space-y-5 shadow-xl">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-400">
                      ATS Keyword Alignment
                    </span>
                    <h3 className="text-base font-bold text-slate-100">Scan & Match Breakdown</h3>
                  </div>
                  <div className="px-3.5 py-1.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xl font-extrabold">
                    {atsAnalysis.alignmentScore}%
                  </div>
                </div>

                <div className="text-[11px] text-slate-400 italic bg-slate-950/60 p-2.5 rounded-xl border border-slate-800/80">
                  ⚠️ <strong>ATS Alignment Disclaimer</strong>: This is a keyword heuristic match estimate, not an automated hiring guarantee.
                </div>

                {/* Found Keywords */}
                <div className="space-y-2">
                  <div className="text-xs font-bold text-emerald-400 flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Matched Keywords ({atsAnalysis.matchedKeywords.length})</span>
                  </div>
                  <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto p-1">
                    {atsAnalysis.matchedKeywords.map((kw, i) => (
                      <span
                        key={i}
                        className="px-2 py-0.5 rounded-md bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-[11px]"
                      >
                        {kw}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Missing Keywords */}
                {atsAnalysis.missingKeywords.length > 0 && (
                  <div className="space-y-2">
                    <div className="text-xs font-bold text-amber-400 flex items-center gap-1.5">
                      <AlertTriangle className="w-3.5 h-3.5" />
                      <span>Missing Job Keywords ({atsAnalysis.missingKeywords.length})</span>
                    </div>
                    <div className="flex flex-wrap gap-1.5 max-h-28 overflow-y-auto p-1">
                      {atsAnalysis.missingKeywords.map((kw, i) => (
                        <span
                          key={i}
                          className="px-2 py-0.5 rounded-md bg-amber-500/10 border border-amber-500/20 text-amber-300 text-[11px]"
                        >
                          {kw}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Recommendations */}
                {atsAnalysis.recommendations.length > 0 && (
                  <div className="space-y-2 border-t border-slate-800/80 pt-4">
                    <div className="text-xs font-bold text-slate-300">Tailoring Suggestions</div>
                    <ul className="space-y-1.5 text-xs text-slate-400">
                      {atsAnalysis.recommendations.map((rec, i) => (
                        <li key={i} className="flex items-start gap-1.5">
                          <span className="text-sky-400 font-bold">•</span>
                          <span>{rec}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}

            {/* Tailoring Changelog */}
            {changelog && (
              <div className="bg-slate-900/70 border border-slate-800 rounded-3xl p-6 space-y-4 shadow-xl">
                <div className="space-y-0.5">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-400">
                    Transparent Traceability
                  </span>
                  <h3 className="text-base font-bold text-slate-100">Tailoring Changelog</h3>
                </div>

                <div className="space-y-3 text-xs">
                  {changelog.emphasized.length > 0 && (
                    <div className="space-y-1">
                      <div className="font-semibold text-slate-300 text-[11px] uppercase tracking-wider">
                        Skills Emphasized:
                      </div>
                      <div className="text-slate-400 leading-relaxed">
                        {changelog.emphasized.join(', ')}
                      </div>
                    </div>
                  )}

                  {changelog.reordered.length > 0 && (
                    <div className="space-y-1">
                      <div className="font-semibold text-slate-300 text-[11px] uppercase tracking-wider">
                        Reordered / Prioritized:
                      </div>
                      <div className="text-slate-400">
                        {changelog.reordered.join(', ')}
                      </div>
                    </div>
                  )}

                  {changelog.deemphasized.length > 0 && (
                    <div className="space-y-1">
                      <div className="font-semibold text-slate-300 text-[11px] uppercase tracking-wider">
                        De-emphasized / Omitted:
                      </div>
                      <div className="text-slate-400">
                        {changelog.deemphasized.join(', ')}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
