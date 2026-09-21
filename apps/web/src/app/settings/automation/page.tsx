'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  Sliders,
  ArrowLeft,
  Bot,
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  Plus,
  Trash2,
  Save,
  RefreshCw,
  Power,
  Layers,
  MapPin,
  DollarSign,
  Tag,
  Briefcase,
} from 'lucide-react';
import { AutomationSettings, JobSearchProfile } from '@ai-job-hunter/shared';

export default function AutomationSettingsPage() {
  const [settings, setSettings] = useState<AutomationSettings | null>(null);
  const [profiles, setProfiles] = useState<JobSearchProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // New Profile Form state
  const [showNewProfile, setShowNewProfile] = useState(false);
  const [newProfileName, setNewProfileName] = useState('');
  const [newRoles, setNewRoles] = useState('');
  const [newSkills, setNewSkills] = useState('');
  const [newLocations, setNewLocations] = useState('');
  const [newMinScore, setNewMinScore] = useState(80);

  const fetchData = async () => {
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
      const [settingsRes, profilesRes] = await Promise.all([
        fetch(`${apiUrl}/api/automation/settings`, { cache: 'no-store' }),
        fetch(`${apiUrl}/api/automation/profiles`, { cache: 'no-store' }),
      ]);
      const settingsJson = await settingsRes.json();
      const profilesJson = await profilesRes.json();

      if (settingsJson.success) setSettings(settingsJson.data);
      if (profilesJson.success) setProfiles(profilesJson.data || []);
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'Failed to load settings' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleSaveSettings = async () => {
    if (!settings) return;
    setSaving(true);
    setMessage(null);
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
      const res = await fetch(`${apiUrl}/api/automation/settings`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings),
      });
      const json = await res.json();
      if (json.success) {
        setSettings(json.data);
        setMessage({ type: 'success', text: 'Automation settings saved successfully!' });
      } else {
        setMessage({ type: 'error', text: json.error || 'Failed to save settings' });
      }
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message });
    } finally {
      setSaving(false);
    }
  };

  const handleCreateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProfileName) return;
    setSaving(true);
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
      const res = await fetch(`${apiUrl}/api/automation/profiles`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newProfileName,
          roles: newRoles ? newRoles.split(',').map((r) => r.trim()).filter(Boolean) : [],
          skills: newSkills ? newSkills.split(',').map((s) => s.trim()).filter(Boolean) : [],
          locations: newLocations ? newLocations.split(',').map((l) => l.trim()).filter(Boolean) : [],
          minimumMatchScore: newMinScore,
          enabled: true,
        }),
      });
      const json = await res.json();
      if (json.success) {
        setNewProfileName('');
        setNewRoles('');
        setNewSkills('');
        setNewLocations('');
        setShowNewProfile(false);
        setMessage({ type: 'success', text: 'Search profile created successfully!' });
        fetchData();
      } else {
        setMessage({ type: 'error', text: json.error || 'Failed to create profile' });
      }
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message });
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteProfile = async (id: string) => {
    if (!confirm('Are you sure you want to delete this search profile?')) return;
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
      const res = await fetch(`${apiUrl}/api/automation/profiles/${id}`, { method: 'DELETE' });
      const json = await res.json();
      if (json.success) {
        fetchData();
      }
    } catch (err: any) {
      console.error(err);
    }
  };

  const handleToggleProfile = async (profile: JobSearchProfile) => {
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
      await fetch(`${apiUrl}/api/automation/profiles/${profile.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled: !profile.enabled }),
      });
      fetchData();
    } catch (err: any) {
      console.error(err);
    }
  };

  if (loading) {
    return (
      <div className="min-h-[calc(100vh-4rem)] p-12 flex justify-center items-center">
        <RefreshCw className="w-8 h-8 text-sky-400 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-[calc(100vh-4rem)] p-4 sm:p-6 md:p-10 max-w-5xl mx-auto space-y-8">
      {/* Header */}
      <div>
        <Link
          href="/automation"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-400 hover:text-slate-200 transition-colors mb-2"
        >
          <ArrowLeft className="w-3.5 h-3.5" /> Back to Command Center
        </Link>
        <h1 className="text-2xl font-black text-slate-100 tracking-tight flex items-center gap-2.5">
          <Sliders className="w-6 h-6 text-sky-400" />
          Automation & Search Profile Settings
        </h1>
        <p className="text-xs sm:text-sm text-slate-400">
          Configure autonomous behavior, safety limits, material generation, and job targeting filters
        </p>
      </div>

      {message && (
        <div
          className={`p-4 rounded-xl border text-xs sm:text-sm flex items-center justify-between ${
            message.type === 'success'
              ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-300'
              : 'bg-red-500/10 border-red-500/20 text-red-300'
          }`}
        >
          <div className="flex items-center gap-2">
            {message.type === 'success' ? <CheckCircle2 className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
            <span>{message.text}</span>
          </div>
          <button onClick={() => setMessage(null)} className="text-xs opacity-70 hover:opacity-100">Dismiss</button>
        </div>
      )}

      {/* Global Safety & Core Controls */}
      {settings && (
        <div className="bg-slate-900/50 rounded-2xl border border-slate-800 p-6 space-y-6">
          <div className="flex items-center justify-between pb-4 border-b border-slate-800">
            <h2 className="text-base font-bold text-slate-100 flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-emerald-400" />
              Safety & Autonomous Modes
            </h2>
            <button
              onClick={handleSaveSettings}
              disabled={saving}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold bg-sky-500 hover:bg-sky-400 text-white transition-all shadow-md shadow-sky-500/20"
            >
              {saving ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
              Save Changes
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 text-xs">
            {/* Automation Enabled */}
            <div className="p-4 rounded-xl bg-slate-950/50 border border-slate-800 flex items-center justify-between">
              <div>
                <span className="font-bold text-slate-200 block text-sm">Autonomous Background Hunting</span>
                <span className="text-slate-400 text-[11px] block mt-0.5">
                  Allows the system to discover and evaluate jobs on schedule
                </span>
              </div>
              <input
                type="checkbox"
                checked={settings.automationEnabled}
                onChange={(e) => setSettings({ ...settings, automationEnabled: e.target.checked })}
                className="w-5 h-5 accent-sky-500 rounded"
              />
            </div>

            {/* Human Approval Required */}
            <div className="p-4 rounded-xl bg-slate-950/50 border border-slate-800 flex items-center justify-between">
              <div>
                <span className="font-bold text-slate-200 block text-sm">Require Human Approval</span>
                <span className="text-slate-400 text-[11px] block mt-0.5">
                  Applications require your review before submitting
                </span>
              </div>
              <input
                type="checkbox"
                checked={settings.applicationApprovalRequired}
                onChange={(e) => setSettings({ ...settings, applicationApprovalRequired: e.target.checked })}
                className="w-5 h-5 accent-sky-500 rounded"
              />
            </div>

            {/* Auto-Tailoring */}
            <div className="p-4 rounded-xl bg-slate-950/50 border border-slate-800 flex items-center justify-between">
              <div>
                <span className="font-bold text-slate-200 block text-sm">Auto-Tailor Resumes</span>
                <span className="text-slate-400 text-[11px] block mt-0.5">
                  Generate job-targeted resume adaptations with zero fabrication
                </span>
              </div>
              <input
                type="checkbox"
                checked={settings.autoTailoringEnabled}
                onChange={(e) => setSettings({ ...settings, autoTailoringEnabled: e.target.checked })}
                className="w-5 h-5 accent-sky-500 rounded"
              />
            </div>

            {/* Auto Cover Letter */}
            <div className="p-4 rounded-xl bg-slate-950/50 border border-slate-800 flex items-center justify-between">
              <div>
                <span className="font-bold text-slate-200 block text-sm">Auto-Generate Cover Letters</span>
                <span className="text-slate-400 text-[11px] block mt-0.5">
                  Craft targeted cover letters based on candidate verified facts
                </span>
              </div>
              <input
                type="checkbox"
                checked={settings.autoCoverLetterEnabled}
                onChange={(e) => setSettings({ ...settings, autoCoverLetterEnabled: e.target.checked })}
                className="w-5 h-5 accent-sky-500 rounded"
              />
            </div>

            {/* Daily Application Limit */}
            <div className="space-y-1.5">
              <label className="font-bold text-slate-300 block">Daily Application Limit</label>
              <input
                type="number"
                min="1"
                max="50"
                value={settings.dailyApplicationLimit}
                onChange={(e) => setSettings({ ...settings, dailyApplicationLimit: parseInt(e.target.value, 10) || 5 })}
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-slate-200 text-xs focus:ring-1 focus:ring-sky-500"
              />
              <span className="text-[11px] text-slate-500">Maximum applications prepared/submitted in 24 hours</span>
            </div>

            {/* Hourly Application Limit */}
            <div className="space-y-1.5">
              <label className="font-bold text-slate-300 block">Hourly Application Limit</label>
              <input
                type="number"
                min="1"
                max="10"
                value={settings.hourlyApplicationLimit}
                onChange={(e) => setSettings({ ...settings, hourlyApplicationLimit: parseInt(e.target.value, 10) || 2 })}
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-slate-200 text-xs focus:ring-1 focus:ring-sky-500"
              />
              <span className="text-[11px] text-slate-500">Pacing limit per rolling hour</span>
            </div>

            {/* Min Match Score */}
            <div className="space-y-1.5">
              <label className="font-bold text-slate-300 block">Minimum Match Score ({settings.minimumMatchScore}%)</label>
              <input
                type="range"
                min="50"
                max="95"
                step="5"
                value={settings.minimumMatchScore}
                onChange={(e) => setSettings({ ...settings, minimumMatchScore: parseInt(e.target.value, 10) })}
                className="w-full accent-sky-500"
              />
              <span className="text-[11px] text-slate-500">Jobs scoring below this threshold are not shortlisted</span>
            </div>

            {/* Sync Frequency */}
            <div className="space-y-1.5">
              <label className="font-bold text-slate-300 block">Sync Frequency</label>
              <select
                value={settings.syncFrequencyHours}
                onChange={(e) => setSettings({ ...settings, syncFrequencyHours: parseInt(e.target.value, 10) })}
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-slate-200 text-xs focus:ring-1 focus:ring-sky-500"
              >
                <option value={1}>Every 1 hour</option>
                <option value={3}>Every 3 hours</option>
                <option value={6}>Every 6 hours</option>
                <option value={12}>Every 12 hours</option>
                <option value={24}>Once daily</option>
              </select>
              <span className="text-[11px] text-slate-500">How often sources are checked for new postings</span>
            </div>
          </div>
        </div>
      )}

      {/* Job Search Profiles Management */}
      <div className="bg-slate-900/50 rounded-2xl border border-slate-800 p-6 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
          <div>
            <h2 className="text-base font-bold text-slate-100 flex items-center gap-2">
              <Layers className="w-5 h-5 text-indigo-400" />
              Target Job Search Profiles
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Specify the exact roles, skills, and criteria for auto-shortlisting
            </p>
          </div>

          <button
            onClick={() => setShowNewProfile(!showNewProfile)}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-colors"
          >
            <Plus className="w-4 h-4 text-sky-400" />
            {showNewProfile ? 'Cancel' : 'New Profile'}
          </button>
        </div>

        {/* New Profile Creation Form */}
        {showNewProfile && (
          <form onSubmit={handleCreateProfile} className="p-5 rounded-xl bg-slate-950/70 border border-slate-800 space-y-4 text-xs">
            <h3 className="font-bold text-slate-200 text-sm">Create New Search Profile</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="font-semibold text-slate-400">Profile Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Senior Backend Engineer"
                  value={newProfileName}
                  onChange={(e) => setNewProfileName(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-slate-200"
                />
              </div>

              <div className="space-y-1.5">
                <label className="font-semibold text-slate-400">Target Roles (comma-separated)</label>
                <input
                  type="text"
                  placeholder="e.g. Backend Engineer, Full Stack Engineer"
                  value={newRoles}
                  onChange={(e) => setNewRoles(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-slate-200"
                />
              </div>

              <div className="space-y-1.5">
                <label className="font-semibold text-slate-400">Target Skills (comma-separated)</label>
                <input
                  type="text"
                  placeholder="e.g. Node.js, TypeScript, PostgreSQL, Docker"
                  value={newSkills}
                  onChange={(e) => setNewSkills(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-slate-200"
                />
              </div>

              <div className="space-y-1.5">
                <label className="font-semibold text-slate-400">Locations (comma-separated)</label>
                <input
                  type="text"
                  placeholder="e.g. Remote, San Francisco, London"
                  value={newLocations}
                  onChange={(e) => setNewLocations(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-slate-200"
                />
              </div>
            </div>

            <div className="pt-2 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowNewProfile(false)}
                className="px-3 py-1.5 rounded-lg text-slate-400 hover:text-slate-200"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving}
                className="px-4 py-1.5 rounded-lg font-bold bg-sky-500 hover:bg-sky-400 text-white"
              >
                Create Profile
              </button>
            </div>
          </form>
        )}

        {/* Existing Profiles List */}
        {profiles.length === 0 ? (
          <div className="p-8 text-center text-slate-500 text-xs">
            No search profiles configured. Create one to enable targeted auto-shortlisting.
          </div>
        ) : (
          <div className="space-y-3">
            {profiles.map((p) => (
              <div
                key={p.id}
                className="p-4 rounded-xl bg-slate-950/40 border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4 text-xs"
              >
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2.5">
                    <span className="font-bold text-slate-100 text-sm">{p.name}</span>
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        p.enabled
                          ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                          : 'bg-slate-800 text-slate-500 border border-slate-700'
                      }`}
                    >
                      {p.enabled ? 'ACTIVE' : 'PAUSED'}
                    </span>
                    <span className="text-[11px] text-slate-400">Min Score: {p.minimumMatchScore}%</span>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-400">
                    {p.roles.length > 0 && <span>Roles: {p.roles.join(', ')}</span>}
                    {p.skills.length > 0 && <span>• Skills: {p.skills.slice(0, 5).join(', ')}</span>}
                    {p.locations.length > 0 && <span>• Locations: {p.locations.join(', ')}</span>}
                  </div>
                </div>

                <div className="flex items-center gap-3 shrink-0">
                  <button
                    onClick={() => handleToggleProfile(p)}
                    className="text-xs font-semibold text-slate-400 hover:text-slate-200"
                  >
                    {p.enabled ? 'Pause' : 'Activate'}
                  </button>
                  <button
                    onClick={() => handleDeleteProfile(p.id)}
                    className="p-1.5 rounded-lg text-slate-500 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
