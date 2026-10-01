'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import Link from 'next/link';
import {
  Upload,
  FileText,
  CheckCircle2,
  AlertCircle,
  Clock,
  Briefcase,
  GraduationCap,
  FolderGit2,
  Award,
  Sliders,
  Plus,
  Trash2,
  ExternalLink,
  RefreshCw,
  Save,
  ArrowLeft,
  ChevronRight,
  ShieldCheck,
  Tag,
  Calendar,
  MapPin,
  Mail,
  Phone,
  Linkedin,
  Github,
  Globe
} from 'lucide-react';
import {
  CandidateProfile,
  CandidateBasics,
  ExperienceItem,
  EducationItem,
  ProjectItem,
  CertificationItem,
  CandidatePreferences,
  ResumeVersion,
} from '@ai-job-hunter/shared';
import { authFetch } from '@/lib/api';
import Navbar from '@/components/Navbar';

const initialBasics: CandidateBasics = {
  name: '',
  email: '',
  phone: '',
  location: '',
  summary: '',
  linkedin: '',
  github: '',
  portfolio: '',
};

const initialPreferences: CandidatePreferences = {
  preferredRoles: [],
  preferredLocations: [],
  remotePreference: 'any',
  employmentTypes: ['full_time'],
  minimumSalary: null,
  maximumSalary: null,
  noticePeriod: '',
  preferredIndustries: [],
};

const initialProfile: CandidateProfile = {
  basics: initialBasics,
  skills: [],
  experience: [],
  education: [],
  projects: [],
  certifications: [],
  achievements: [],
  preferences: initialPreferences,
  verificationStatus: 'needs_review',
};

export default function ResumePage() {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

  const [profile, setProfile] = useState<CandidateProfile>(initialProfile);
  const [versions, setVersions] = useState<ResumeVersion[]>([]);
  const [selectedVersion, setSelectedVersion] = useState<number | null>(null);

  // Upload & processing state
  const [isUploading, setIsUploading] = useState<boolean>(false);
  const [processingStatus, setProcessingStatus] = useState<string>('idle');
  const [processingMessage, setProcessingMessage] = useState<string>('');
  const [currentFilename, setCurrentFilename] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [saveFeedback, setSaveFeedback] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'profile' | 'preferences'>('profile');

  // New Skill / Tag inputs
  const [newSkill, setNewSkill] = useState<string>('');
  const [newPrefRole, setNewPrefRole] = useState<string>('');
  const [newPrefLocation, setNewPrefLocation] = useState<string>('');

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Fetch current candidate profile and version history
  const fetchProfileAndVersions = useCallback(async () => {
    try {
      const [profRes, verRes] = await Promise.all([
        authFetch(`${apiUrl}/api/profile`, { cache: 'no-store' }),
        authFetch(`${apiUrl}/api/resumes/versions`, { cache: 'no-store' }),
      ]);

      if (profRes.ok) {
        const pData = await profRes.json();
        if (pData.profile) {
          setProfile({
            ...initialProfile,
            ...pData.profile,
            basics: { ...initialBasics, ...(pData.profile.basics || {}) },
            preferences: { ...initialPreferences, ...(pData.profile.preferences || {}) },
          });
        }
      }

      if (verRes.ok) {
        const vData = await verRes.json();
        if (vData.versions) {
          setVersions(vData.versions);
        }
      }
    } catch (err) {
      console.error('Failed to load profile data:', err);
    }
  }, [apiUrl]);

  useEffect(() => {
    fetchProfileAndVersions();
  }, [fetchProfileAndVersions]);

  // Handle file upload
  const handleFileUpload = async (file: File) => {
    const ext = file.name.split('.').pop()?.toLowerCase();
    if (ext !== 'pdf' && ext !== 'docx') {
      alert("Invalid format. Only PDF and DOCX documents are supported.");
      return;
    }

    setIsUploading(true);
    setCurrentFilename(file.name);
    setProcessingStatus('uploading');
    setProcessingMessage('Uploading document securely...');

    const formData = new FormData();
    formData.append('resume', file);

    try {
      setProcessingStatus('extracting');
      setProcessingMessage('Extracting structured text from document...');

      const response = await authFetch(`${apiUrl}/api/resumes`, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.message || errData.error || 'Upload failed');
      }

      setProcessingStatus('parsing');
      setProcessingMessage('Parsing resume into structured candidate profile...');

      const result = await response.json();

      if (result.profile) {
        setProfile({
          ...initialProfile,
          ...result.profile,
          basics: { ...initialBasics, ...(result.profile.basics || {}) },
          preferences: { ...initialPreferences, ...(result.profile.preferences || {}) },
        });
        setProcessingStatus('needs_review');
        setProcessingMessage('Resume successfully parsed! Please review and verify below.');
      } else {
        setProcessingStatus('failed');
        setProcessingMessage(result.error || 'Parsing encountered an error.');
      }

      await fetchProfileAndVersions();
    } catch (err: any) {
      setProcessingStatus('failed');
      setProcessingMessage(err.message || 'Error uploading and processing resume.');
    } finally {
      setIsUploading(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileUpload(e.dataTransfer.files[0]);
    }
  };

  // Save / Verify Profile
  const handleSaveVerified = async () => {
    setIsSaving(true);
    setSaveFeedback(null);
    try {
      const res = await authFetch(`${apiUrl}/api/profile`, {
        method: 'PUT',
        body: JSON.stringify(profile),
      });

      if (!res.ok) {
        throw new Error('Failed to save verified profile');
      }

      const data = await res.json();
      setProfile(data.profile);
      setSaveFeedback('Profile verified and saved successfully!');
      await fetchProfileAndVersions();
      setTimeout(() => setSaveFeedback(null), 4000);
    } catch (err: any) {
      setSaveFeedback(`Error: ${err.message}`);
    } finally {
      setIsSaving(false);
    }
  };

  // Skills handlers
  const handleAddSkill = () => {
    if (newSkill.trim() && !profile.skills.includes(newSkill.trim())) {
      setProfile({ ...profile, skills: [...profile.skills, newSkill.trim()] });
      setNewSkill('');
    }
  };

  const handleRemoveSkill = (skillToRemove: string) => {
    setProfile({
      ...profile,
      skills: profile.skills.filter((s) => s !== skillToRemove),
    });
  };

  // Experience handlers
  const handleAddExperience = () => {
    const newExp: ExperienceItem = {
      company: 'New Company',
      title: 'Job Title',
      location: '',
      startDate: '',
      endDate: '',
      current: false,
      description: ['Accomplishment or responsibility'],
      skills: [],
    };
    setProfile({ ...profile, experience: [newExp, ...profile.experience] });
  };

  const handleRemoveExperience = (idx: number) => {
    setProfile({
      ...profile,
      experience: profile.experience.filter((_, i) => i !== idx),
    });
  };

  const handleUpdateExperience = (idx: number, updatedItem: Partial<ExperienceItem>) => {
    const updated = [...profile.experience];
    updated[idx] = { ...updated[idx], ...updatedItem };
    setProfile({ ...profile, experience: updated });
  };

  // Education handlers
  const handleAddEducation = () => {
    const newEdu: EducationItem = {
      institution: 'University / Institution',
      degree: "Bachelor's Degree",
      field: 'Computer Science',
      startDate: '',
      endDate: '',
      grade: '',
    };
    setProfile({ ...profile, education: [newEdu, ...profile.education] });
  };

  const handleRemoveEducation = (idx: number) => {
    setProfile({
      ...profile,
      education: profile.education.filter((_, i) => i !== idx),
    });
  };

  // Projects handlers
  const handleAddProject = () => {
    const newProj: ProjectItem = {
      name: 'New Project',
      description: 'Project overview and impact',
      url: '',
      technologies: [],
    };
    setProfile({ ...profile, projects: [newProj, ...profile.projects] });
  };

  const handleRemoveProject = (idx: number) => {
    setProfile({
      ...profile,
      projects: profile.projects.filter((_, i) => i !== idx),
    });
  };

  // Certifications handlers
  const handleAddCert = () => {
    const newCert: CertificationItem = {
      name: 'Certification Title',
      issuer: 'Issuing Organization',
      date: '',
      url: '',
    };
    setProfile({ ...profile, certifications: [newCert, ...profile.certifications] });
  };

  const handleRemoveCert = (idx: number) => {
    setProfile({
      ...profile,
      certifications: profile.certifications.filter((_, i) => i !== idx),
    });
  };

  // Version switch
  const handleSelectVersion = (v: ResumeVersion) => {
    setSelectedVersion(v.versionNumber);
    setProfile({
      ...initialProfile,
      ...v.profileData,
      basics: { ...initialBasics, ...(v.profileData.basics || {}) },
      preferences: { ...initialPreferences, ...(v.profileData.preferences || {}) },
    });
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      <Navbar />

      {/* Main Content */}
      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-6 flex-1 w-full space-y-6">
        {/* Top Action Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-900/60 p-4 rounded-2xl border border-slate-800">
          <div>
            <h1 className="text-xl font-extrabold text-slate-100 flex items-center gap-2">
              <FileText className="w-5 h-5 text-sky-400" />
              Candidate Profile & Resumes
            </h1>
            <p className="text-xs text-slate-400">
              Manage your verified career facts, upload new resumes, and configure target job preferences
            </p>
          </div>

          <div className="flex items-center gap-3">
            {profile.verificationStatus === 'verified' ? (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
                <ShieldCheck className="w-3.5 h-3.5" />
                Verified
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-500/10 border border-amber-500/20 text-amber-400">
                <Clock className="w-3.5 h-3.5" />
                Needs Review
              </span>
            )}

            <button
              onClick={handleSaveVerified}
              disabled={isSaving}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-sky-600 hover:bg-sky-500 text-white text-xs font-bold shadow-lg shadow-sky-600/20 transition-all disabled:opacity-50"
            >
              <Save className={`w-3.5 h-3.5 ${isSaving ? 'animate-spin' : ''}`} />
              {isSaving ? 'Saving...' : 'Save Profile'}
            </button>
          </div>
        </div>

        {/* Feedback Alert */}
        {saveFeedback && (
          <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs flex items-center gap-2 animate-fadeIn">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>{saveFeedback}</span>
          </div>
        )}

        {/* Upload & Version Management Section */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Upload Card */}
          <div className="lg:col-span-2 bg-slate-900/60 border border-slate-800 rounded-2xl p-6 relative overflow-hidden">
            <div
              onDragOver={(e) => e.preventDefault()}
              onDrop={handleDrop}
              className="border-2 border-dashed border-slate-700 hover:border-sky-500/50 rounded-xl p-8 text-center flex flex-col items-center justify-center transition-colors cursor-pointer bg-slate-950/40"
              onClick={() => fileInputRef.current?.click()}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                className="hidden"
                onChange={(e) => e.target.files?.[0] && handleFileUpload(e.target.files[0])}
              />
              <div className="w-12 h-12 rounded-full bg-sky-500/10 border border-sky-500/20 flex items-center justify-center text-sky-400 mb-3">
                <Upload className="w-6 h-6" />
              </div>
              <h3 className="font-semibold text-slate-200 text-base mb-1">
                Upload your Resume (PDF or DOCX)
              </h3>
              <p className="text-xs text-slate-400 mb-4 max-w-sm">
                Drag and drop your resume file here or click to browse. Max size 10MB.
              </p>
              <button
                type="button"
                className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-200 border border-slate-700 transition-colors"
              >
                Select Resume File
              </button>
            </div>

            {/* Processing Pipeline Banner */}
            {processingStatus !== 'idle' && (
              <div className="mt-4 p-4 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  {isUploading ? (
                    <RefreshCw className="w-5 h-5 text-sky-400 animate-spin" />
                  ) : processingStatus === 'failed' ? (
                    <AlertCircle className="w-5 h-5 text-rose-400" />
                  ) : (
                    <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                  )}
                  <div>
                    <div className="text-xs font-semibold text-slate-300">
                      {currentFilename}
                    </div>
                    <div className="text-xs text-slate-400">{processingMessage}</div>
                  </div>
                </div>
                <span className="text-xs px-2.5 py-1 rounded-full font-mono bg-slate-800 text-slate-300 border border-slate-700 uppercase">
                  {processingStatus}
                </span>
              </div>
            )}
          </div>

          {/* Version History Card */}
          <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-slate-200 text-sm flex items-center gap-2">
                  <Clock className="w-4 h-4 text-sky-400" />
                  Resume Versions
                </h3>
                <span className="text-xs text-slate-500">
                  {versions.length} saved {versions.length === 1 ? 'version' : 'versions'}
                </span>
              </div>

              {versions.length === 0 ? (
                <p className="text-xs text-slate-500 py-6 text-center">
                  No previous versions saved yet.
                </p>
              ) : (
                <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                  {versions.map((v) => (
                    <button
                      key={v.id}
                      onClick={() => handleSelectVersion(v)}
                      className={`w-full text-left p-2.5 rounded-lg text-xs transition-colors flex items-center justify-between border ${
                        selectedVersion === v.versionNumber
                          ? 'bg-sky-500/10 border-sky-500/30 text-sky-300'
                          : 'bg-slate-950/50 border-slate-800/80 hover:bg-slate-800/50 text-slate-300'
                      }`}
                    >
                      <div>
                        <div className="font-semibold">Version {v.versionNumber}</div>
                        <div className="text-[10px] text-slate-500">
                          {new Date(v.createdAt).toLocaleString()}
                        </div>
                      </div>
                      <ChevronRight className="w-3.5 h-3.5 text-slate-600" />
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="pt-4 border-t border-slate-800/80 text-[11px] text-slate-500">
              Every verified save or new upload creates an immutable snapshot version.
            </div>
          </div>
        </div>

        {/* Tab Toggle */}
        <div className="flex items-center gap-2 border-b border-slate-800 pb-3">
          <button
            onClick={() => setActiveTab('profile')}
            className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all ${
              activeTab === 'profile'
                ? 'bg-slate-800 text-slate-100 border border-slate-700'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Factual Resume Profile
          </button>
          <button
            onClick={() => setActiveTab('preferences')}
            className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all flex items-center gap-2 ${
              activeTab === 'preferences'
                ? 'bg-slate-800 text-slate-100 border border-slate-700'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Sliders className="w-3.5 h-3.5" />
            Job Search Preferences
          </button>
        </div>

        {/* Tab 1: Factual Profile */}
        {activeTab === 'profile' && (
          <div className="space-y-6">
            {/* Section 1: Basic Information */}
            <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6 space-y-4">
              <h3 className="text-base font-semibold text-slate-200 flex items-center gap-2 border-b border-slate-800 pb-3">
                <FileText className="w-4 h-4 text-sky-400" />
                Basic Information
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs text-slate-400 font-medium mb-1 block">Full Name</label>
                  <input
                    type="text"
                    value={profile.basics.name || ''}
                    onChange={(e) =>
                      setProfile({
                        ...profile,
                        basics: { ...profile.basics, name: e.target.value },
                      })
                    }
                    placeholder="e.g. Jane Doe"
                    className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-sm text-slate-100 focus:outline-none focus:border-sky-500"
                  />
                </div>

                <div>
                  <label className="text-xs text-slate-400 font-medium mb-1 block">Email</label>
                  <input
                    type="email"
                    value={profile.basics.email || ''}
                    onChange={(e) =>
                      setProfile({
                        ...profile,
                        basics: { ...profile.basics, email: e.target.value },
                      })
                    }
                    placeholder="e.g. jane@example.com"
                    className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-sm text-slate-100 focus:outline-none focus:border-sky-500"
                  />
                </div>

                <div>
                  <label className="text-xs text-slate-400 font-medium mb-1 block">Phone</label>
                  <input
                    type="text"
                    value={profile.basics.phone || ''}
                    onChange={(e) =>
                      setProfile({
                        ...profile,
                        basics: { ...profile.basics, phone: e.target.value },
                      })
                    }
                    placeholder="e.g. +1 555-0199"
                    className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-sm text-slate-100 focus:outline-none focus:border-sky-500"
                  />
                </div>

                <div>
                  <label className="text-xs text-slate-400 font-medium mb-1 block">Location</label>
                  <input
                    type="text"
                    value={profile.basics.location || ''}
                    onChange={(e) =>
                      setProfile({
                        ...profile,
                        basics: { ...profile.basics, location: e.target.value },
                      })
                    }
                    placeholder="e.g. San Francisco, CA"
                    className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-sm text-slate-100 focus:outline-none focus:border-sky-500"
                  />
                </div>

                <div>
                  <label className="text-xs text-slate-400 font-medium mb-1 block">LinkedIn URL</label>
                  <input
                    type="text"
                    value={profile.basics.linkedin || ''}
                    onChange={(e) =>
                      setProfile({
                        ...profile,
                        basics: { ...profile.basics, linkedin: e.target.value },
                      })
                    }
                    placeholder="https://linkedin.com/in/..."
                    className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-sm text-slate-100 focus:outline-none focus:border-sky-500"
                  />
                </div>

                <div>
                  <label className="text-xs text-slate-400 font-medium mb-1 block">GitHub URL</label>
                  <input
                    type="text"
                    value={profile.basics.github || ''}
                    onChange={(e) =>
                      setProfile({
                        ...profile,
                        basics: { ...profile.basics, github: e.target.value },
                      })
                    }
                    placeholder="https://github.com/..."
                    className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-sm text-slate-100 focus:outline-none focus:border-sky-500"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs text-slate-400 font-medium mb-1 block">Professional Summary</label>
                <textarea
                  rows={3}
                  value={profile.basics.summary || ''}
                  onChange={(e) =>
                    setProfile({
                      ...profile,
                      basics: { ...profile.basics, summary: e.target.value },
                    })
                  }
                  placeholder="Summary extracted from resume..."
                  className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-sm text-slate-100 focus:outline-none focus:border-sky-500"
                />
              </div>
            </div>

            {/* Section 2: Skills */}
            <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6 space-y-4">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <h3 className="text-base font-semibold text-slate-200 flex items-center gap-2">
                  <Tag className="w-4 h-4 text-emerald-400" />
                  Skills ({profile.skills.length})
                </h3>
              </div>

              {/* Add Skill Input */}
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={newSkill}
                  onChange={(e) => setNewSkill(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleAddSkill()}
                  placeholder="Add a skill (e.g. TypeScript, Docker, PostgreSQL)..."
                  className="flex-1 px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-sm text-slate-100 focus:outline-none focus:border-emerald-500"
                />
                <button
                  type="button"
                  onClick={handleAddSkill}
                  className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold flex items-center gap-1.5 transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Add
                </button>
              </div>

              {/* Skills Badges */}
              <div className="flex flex-wrap gap-2 pt-2">
                {profile.skills.length === 0 ? (
                  <p className="text-xs text-slate-500 italic">No skills listed yet.</p>
                ) : (
                  profile.skills.map((skill) => (
                    <span
                      key={skill}
                      className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-950 border border-slate-800 text-slate-200 text-xs font-medium group hover:border-slate-700"
                    >
                      {skill}
                      <button
                        type="button"
                        onClick={() => handleRemoveSkill(skill)}
                        className="text-slate-500 hover:text-rose-400 transition-colors"
                      >
                        ×
                      </button>
                    </span>
                  ))
                )}
              </div>
            </div>

            {/* Section 3: Experience */}
            <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6 space-y-4">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <h3 className="text-base font-semibold text-slate-200 flex items-center gap-2">
                  <Briefcase className="w-4 h-4 text-sky-400" />
                  Professional Experience ({profile.experience.length})
                </h3>
                <button
                  type="button"
                  onClick={handleAddExperience}
                  className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-200 border border-slate-700 flex items-center gap-1 transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Add Position
                </button>
              </div>

              {profile.experience.length === 0 ? (
                <p className="text-xs text-slate-500 italic py-2">No work experience listed.</p>
              ) : (
                <div className="space-y-4">
                  {profile.experience.map((exp, idx) => (
                    <div
                      key={idx}
                      className="p-4 rounded-xl bg-slate-950/70 border border-slate-800/80 space-y-3"
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 flex-1">
                          <input
                            type="text"
                            value={exp.company}
                            onChange={(e) => handleUpdateExperience(idx, { company: e.target.value })}
                            placeholder="Company Name"
                            className="px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-sm font-semibold text-slate-200 focus:outline-none focus:border-sky-500"
                          />
                          <input
                            type="text"
                            value={exp.title}
                            onChange={(e) => handleUpdateExperience(idx, { title: e.target.value })}
                            placeholder="Role / Title"
                            className="px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-sm text-slate-300 focus:outline-none focus:border-sky-500"
                          />
                          <input
                            type="text"
                            value={exp.startDate || ''}
                            onChange={(e) => handleUpdateExperience(idx, { startDate: e.target.value })}
                            placeholder="Start Date (e.g. Jan 2022)"
                            className="px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-xs text-slate-400 focus:outline-none focus:border-sky-500"
                          />
                          <input
                            type="text"
                            value={exp.endDate || ''}
                            onChange={(e) => handleUpdateExperience(idx, { endDate: e.target.value })}
                            placeholder="End Date (e.g. Present)"
                            className="px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-xs text-slate-400 focus:outline-none focus:border-sky-500"
                          />
                        </div>

                        <button
                          type="button"
                          onClick={() => handleRemoveExperience(idx)}
                          className="p-1.5 text-slate-500 hover:text-rose-400 transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>

                      {/* Description Bullets */}
                      <div>
                        <label className="text-xs text-slate-400 block mb-1">
                          Key Achievements / Description
                        </label>
                        <textarea
                          rows={2}
                          value={(exp.description || []).join('\n')}
                          onChange={(e) =>
                            handleUpdateExperience(idx, {
                              description: e.target.value.split('\n'),
                            })
                          }
                          placeholder="One accomplishment per line..."
                          className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-800 text-xs text-slate-300 focus:outline-none focus:border-sky-500"
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Section 4: Education */}
            <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6 space-y-4">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <h3 className="text-base font-semibold text-slate-200 flex items-center gap-2">
                  <GraduationCap className="w-4 h-4 text-indigo-400" />
                  Education ({profile.education.length})
                </h3>
                <button
                  type="button"
                  onClick={handleAddEducation}
                  className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-200 border border-slate-700 flex items-center gap-1 transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Add Education
                </button>
              </div>

              {profile.education.length === 0 ? (
                <p className="text-xs text-slate-500 italic py-2">No education listed.</p>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {profile.education.map((edu, idx) => (
                    <div
                      key={idx}
                      className="p-4 rounded-xl bg-slate-950/70 border border-slate-800/80 space-y-2 relative group"
                    >
                      <button
                        type="button"
                        onClick={() => handleRemoveEducation(idx)}
                        className="absolute top-3 right-3 text-slate-500 hover:text-rose-400 transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>

                      <input
                        type="text"
                        value={edu.institution}
                        onChange={(e) => {
                          const updated = [...profile.education];
                          updated[idx].institution = e.target.value;
                          setProfile({ ...profile, education: updated });
                        }}
                        placeholder="Institution"
                        className="w-11/12 px-2.5 py-1 rounded bg-slate-900 border border-slate-800 text-sm font-semibold text-slate-200 focus:outline-none focus:border-indigo-500"
                      />

                      <input
                        type="text"
                        value={edu.degree || ''}
                        onChange={(e) => {
                          const updated = [...profile.education];
                          updated[idx].degree = e.target.value;
                          setProfile({ ...profile, education: updated });
                        }}
                        placeholder="Degree / Major"
                        className="w-full px-2.5 py-1 rounded bg-slate-900 border border-slate-800 text-xs text-slate-300 focus:outline-none focus:border-indigo-500"
                      />

                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={edu.startDate || ''}
                          onChange={(e) => {
                            const updated = [...profile.education];
                            updated[idx].startDate = e.target.value;
                            setProfile({ ...profile, education: updated });
                          }}
                          placeholder="Start"
                          className="w-1/2 px-2.5 py-1 rounded bg-slate-900 border border-slate-800 text-[11px] text-slate-400 focus:outline-none focus:border-indigo-500"
                        />
                        <input
                          type="text"
                          value={edu.endDate || ''}
                          onChange={(e) => {
                            const updated = [...profile.education];
                            updated[idx].endDate = e.target.value;
                            setProfile({ ...profile, education: updated });
                          }}
                          placeholder="Graduation"
                          className="w-1/2 px-2.5 py-1 rounded bg-slate-900 border border-slate-800 text-[11px] text-slate-400 focus:outline-none focus:border-indigo-500"
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Section 5: Projects */}
            <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6 space-y-4">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <h3 className="text-base font-semibold text-slate-200 flex items-center gap-2">
                  <FolderGit2 className="w-4 h-4 text-teal-400" />
                  Key Projects ({profile.projects.length})
                </h3>
                <button
                  type="button"
                  onClick={handleAddProject}
                  className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-200 border border-slate-700 flex items-center gap-1 transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Add Project
                </button>
              </div>

              {profile.projects.length === 0 ? (
                <p className="text-xs text-slate-500 italic py-2">No projects listed.</p>
              ) : (
                <div className="space-y-3">
                  {profile.projects.map((proj, idx) => (
                    <div
                      key={idx}
                      className="p-4 rounded-xl bg-slate-950/70 border border-slate-800/80 space-y-2 relative"
                    >
                      <button
                        type="button"
                        onClick={() => handleRemoveProject(idx)}
                        className="absolute top-3 right-3 text-slate-500 hover:text-rose-400 transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 w-11/12">
                        <input
                          type="text"
                          value={proj.name}
                          onChange={(e) => {
                            const updated = [...profile.projects];
                            updated[idx].name = e.target.value;
                            setProfile({ ...profile, projects: updated });
                          }}
                          placeholder="Project Name"
                          className="px-2.5 py-1.5 rounded bg-slate-900 border border-slate-800 text-sm font-semibold text-slate-200 focus:outline-none focus:border-teal-500"
                        />
                        <input
                          type="text"
                          value={proj.url || ''}
                          onChange={(e) => {
                            const updated = [...profile.projects];
                            updated[idx].url = e.target.value;
                            setProfile({ ...profile, projects: updated });
                          }}
                          placeholder="Project Link (URL)"
                          className="px-2.5 py-1.5 rounded bg-slate-900 border border-slate-800 text-xs text-slate-300 focus:outline-none focus:border-teal-500"
                        />
                      </div>

                      <textarea
                        rows={2}
                        value={proj.description}
                        onChange={(e) => {
                          const updated = [...profile.projects];
                          updated[idx].description = e.target.value;
                          setProfile({ ...profile, projects: updated });
                        }}
                        placeholder="Project description and architecture..."
                        className="w-full px-3 py-1.5 rounded bg-slate-900 border border-slate-800 text-xs text-slate-300 focus:outline-none focus:border-teal-500"
                      />
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Section 6: Certifications */}
            <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6 space-y-4">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <h3 className="text-base font-semibold text-slate-200 flex items-center gap-2">
                  <Award className="w-4 h-4 text-amber-400" />
                  Certifications ({profile.certifications.length})
                </h3>
                <button
                  type="button"
                  onClick={handleAddCert}
                  className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-200 border border-slate-700 flex items-center gap-1 transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Add Certification
                </button>
              </div>

              {profile.certifications.length === 0 ? (
                <p className="text-xs text-slate-500 italic py-2">No certifications listed.</p>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {profile.certifications.map((cert, idx) => (
                    <div
                      key={idx}
                      className="p-3.5 rounded-xl bg-slate-950/70 border border-slate-800/80 space-y-2 relative"
                    >
                      <button
                        type="button"
                        onClick={() => handleRemoveCert(idx)}
                        className="absolute top-2.5 right-2.5 text-slate-500 hover:text-rose-400 transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                      <input
                        type="text"
                        value={cert.name}
                        onChange={(e) => {
                          const updated = [...profile.certifications];
                          updated[idx].name = e.target.value;
                          setProfile({ ...profile, certifications: updated });
                        }}
                        placeholder="Certification Name"
                        className="w-10/12 px-2.5 py-1 rounded bg-slate-900 border border-slate-800 text-xs font-semibold text-slate-200 focus:outline-none focus:border-amber-500"
                      />
                      <input
                        type="text"
                        value={cert.issuer || ''}
                        onChange={(e) => {
                          const updated = [...profile.certifications];
                          updated[idx].issuer = e.target.value;
                          setProfile({ ...profile, certifications: updated });
                        }}
                        placeholder="Issuer (e.g. AWS, Coursera)"
                        className="w-full px-2.5 py-1 rounded bg-slate-900 border border-slate-800 text-xs text-slate-400 focus:outline-none focus:border-amber-500"
                      />
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Tab 2: Preferences */}
        {activeTab === 'preferences' && (
          <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6 space-y-6">
            <div className="border-b border-slate-800 pb-3">
              <h3 className="text-base font-semibold text-slate-200 flex items-center gap-2">
                <Sliders className="w-4 h-4 text-sky-400" />
                Candidate Job Preferences
              </h3>
              <p className="text-xs text-slate-400 mt-1">
                Configure your target roles, work styles, and compensation preferences.
              </p>
            </div>

            <div className="space-y-5">
              {/* Preferred Roles */}
              <div>
                <label className="text-xs font-medium text-slate-300 block mb-1">
                  Preferred Roles
                </label>
                <div className="flex gap-2 mb-2">
                  <input
                    type="text"
                    value={newPrefRole}
                    onChange={(e) => setNewPrefRole(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && newPrefRole.trim()) {
                        setProfile({
                          ...profile,
                          preferences: {
                            ...profile.preferences,
                            preferredRoles: [
                              ...profile.preferences.preferredRoles,
                              newPrefRole.trim(),
                            ],
                          },
                        });
                        setNewPrefRole('');
                      }
                    }}
                    placeholder="e.g. Full Stack Developer, Backend Engineer"
                    className="flex-1 px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-xs text-slate-100 focus:outline-none focus:border-sky-500"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      if (newPrefRole.trim()) {
                        setProfile({
                          ...profile,
                          preferences: {
                            ...profile.preferences,
                            preferredRoles: [
                              ...profile.preferences.preferredRoles,
                              newPrefRole.trim(),
                            ],
                          },
                        });
                        setNewPrefRole('');
                      }
                    }}
                    className="px-3 py-2 rounded-lg bg-slate-800 text-xs font-medium text-slate-200 hover:bg-slate-700"
                  >
                    Add Role
                  </button>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {profile.preferences.preferredRoles.map((r, i) => (
                    <span
                      key={i}
                      className="px-2.5 py-0.5 rounded-full bg-slate-950 border border-slate-800 text-xs text-slate-300 flex items-center gap-1"
                    >
                      {r}
                      <button
                        onClick={() =>
                          setProfile({
                            ...profile,
                            preferences: {
                              ...profile.preferences,
                              preferredRoles: profile.preferences.preferredRoles.filter((_, idx) => idx !== i),
                            },
                          })
                        }
                        className="text-slate-500 hover:text-rose-400"
                      >
                        ×
                      </button>
                    </span>
                  ))}
                </div>
              </div>

              {/* Remote Preference */}
              <div>
                <label className="text-xs font-medium text-slate-300 block mb-2">
                  Work Style Preference
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {(['remote', 'hybrid', 'onsite', 'any'] as const).map((pref) => (
                    <button
                      key={pref}
                      type="button"
                      onClick={() =>
                        setProfile({
                          ...profile,
                          preferences: { ...profile.preferences, remotePreference: pref },
                        })
                      }
                      className={`py-2 px-3 rounded-xl border text-xs font-medium capitalize transition-all ${
                        profile.preferences.remotePreference === pref
                          ? 'bg-sky-500/10 border-sky-500/40 text-sky-400 shadow-sm'
                          : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700'
                      }`}
                    >
                      {pref}
                    </button>
                  ))}
                </div>
              </div>

              {/* Salary Expectations & Notice Period */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="text-xs font-medium text-slate-300 block mb-1">
                    Minimum Salary (USD/yr)
                  </label>
                  <input
                    type="number"
                    value={profile.preferences.minimumSalary || ''}
                    onChange={(e) =>
                      setProfile({
                        ...profile,
                        preferences: {
                          ...profile.preferences,
                          minimumSalary: e.target.value ? Number(e.target.value) : null,
                        },
                      })
                    }
                    placeholder="e.g. 120000"
                    className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-xs text-slate-100 focus:outline-none focus:border-sky-500"
                  />
                </div>

                <div>
                  <label className="text-xs font-medium text-slate-300 block mb-1">
                    Maximum Salary (USD/yr)
                  </label>
                  <input
                    type="number"
                    value={profile.preferences.maximumSalary || ''}
                    onChange={(e) =>
                      setProfile({
                        ...profile,
                        preferences: {
                          ...profile.preferences,
                          maximumSalary: e.target.value ? Number(e.target.value) : null,
                        },
                      })
                    }
                    placeholder="e.g. 160000"
                    className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-xs text-slate-100 focus:outline-none focus:border-sky-500"
                  />
                </div>

                <div>
                  <label className="text-xs font-medium text-slate-300 block mb-1">
                    Notice Period
                  </label>
                  <input
                    type="text"
                    value={profile.preferences.noticePeriod || ''}
                    onChange={(e) =>
                      setProfile({
                        ...profile,
                        preferences: {
                          ...profile.preferences,
                          noticePeriod: e.target.value,
                        },
                      })
                    }
                    placeholder="e.g. 2 weeks, Immediate"
                    className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-xs text-slate-100 focus:outline-none focus:border-sky-500"
                  />
                </div>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
