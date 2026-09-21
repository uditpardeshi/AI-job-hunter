'use client';

import React, { useState, useEffect, useCallback, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import {
  Mail,
  CheckCircle2,
  XCircle,
  RefreshCw,
  ExternalLink,
  ShieldCheck,
  AlertCircle,
  Zap,
  Lock,
  Layers,
  ChevronRight,
  LogOut,
} from 'lucide-react';
import Navbar from '@/components/Navbar';
import { GmailConnection } from '@ai-job-hunter/shared';

function IntegrationsContent() {
  const searchParams = useSearchParams();
  const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

  const [connection, setConnection] = useState<GmailConnection | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [isConnecting, setIsConnecting] = useState<boolean>(false);
  const [isDisconnecting, setIsDisconnecting] = useState<boolean>(false);
  const [notification, setNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const fetchConnection = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await fetch(`${apiUrl}/api/integrations/gmail`, { cache: 'no-store' });
      if (res.ok) {
        const json = await res.json();
        setConnection(json.data);
      }
    } catch (err: any) {
      console.error('Failed to fetch Gmail connection:', err);
    } finally {
      setIsLoading(false);
    }
  }, [apiUrl]);

  useEffect(() => {
    fetchConnection();
    if (searchParams.get('connected') === 'true') {
      setNotification({ type: 'success', message: 'Gmail account successfully connected!' });
    }
  }, [fetchConnection, searchParams]);

  const handleConnectGmail = async () => {
    setIsConnecting(true);
    setNotification(null);
    try {
      const res = await fetch(`${apiUrl}/api/integrations/gmail/connect`, { cache: 'no-store' });
      const json = await res.json();
      if (json.data && json.data.authUrl) {
        // If mock mode, navigate or fetch callback
        if (json.data.isMock) {
          window.location.href = json.data.authUrl;
        } else {
          window.location.href = json.data.authUrl;
        }
      } else {
        throw new Error('Failed to obtain Google authorization URL');
      }
    } catch (err: any) {
      setNotification({ type: 'error', message: err.message || 'Connection initiation failed' });
      setIsConnecting(false);
    }
  };

  const handleDisconnectGmail = async () => {
    if (!confirm('Are you sure you want to disconnect Gmail? Stored credentials will be deleted.')) {
      return;
    }
    setIsDisconnecting(true);
    setNotification(null);
    try {
      const res = await fetch(`${apiUrl}/api/integrations/gmail/disconnect`, { method: 'POST' });
      if (res.ok) {
        setConnection(null);
        setNotification({ type: 'success', message: 'Gmail disconnected successfully' });
      } else {
        throw new Error('Disconnect failed');
      }
    } catch (err: any) {
      setNotification({ type: 'error', message: err.message });
    } finally {
      setIsDisconnecting(false);
    }
  };

  const handleSyncEmails = async () => {
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
        message: `Sync complete: ${json.data.syncedCount} relevant emails checked (${json.data.newCount} new)`,
      });
      fetchConnection();
    } catch (err: any) {
      setNotification({ type: 'error', message: err.message });
    } finally {
      setIsSyncing(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
      <Navbar />

      <main className="flex-1 max-w-5xl mx-auto px-4 sm:px-6 py-8 w-full space-y-6">
        {/* Page Header */}
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-100 tracking-tight">
            Settings & Integrations
          </h1>
          <p className="text-xs sm:text-sm text-slate-400 mt-1">
            Connect your email account to discover recruiter messages, track status updates, and send assisted responses.
          </p>
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

        {/* Gmail Integration Card */}
        <div className="bg-slate-900/60 border border-slate-800 rounded-3xl p-6 sm:p-8 space-y-6 shadow-xl">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-800">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-rose-500/20 to-amber-500/20 border border-rose-500/30 flex items-center justify-center text-rose-400">
                <Mail className="w-6 h-6" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-base sm:text-lg font-bold text-slate-100">Gmail Integration</h2>
                  {connection ? (
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                      <CheckCircle2 className="w-3 h-3" />
                      Connected
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-slate-800 text-slate-400 border border-slate-700">
                      <XCircle className="w-3 h-3" />
                      Not Connected
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-400 mt-0.5">
                  Synchronize job applications, recruiter invitations, and send approved responses via Google OAuth 2.0.
                </p>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center gap-2.5">
              {connection ? (
                <>
                  <button
                    onClick={handleSyncEmails}
                    disabled={isSyncing}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs shadow-lg shadow-indigo-600/20 transition-all disabled:opacity-50"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
                    <span>{isSyncing ? 'Syncing...' : 'Sync Gmail'}</span>
                  </button>

                  <button
                    onClick={handleDisconnectGmail}
                    disabled={isDisconnecting}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-rose-950/40 text-slate-300 hover:text-rose-300 border border-slate-700 hover:border-rose-500/40 text-xs font-semibold transition-all disabled:opacity-50"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    <span>Disconnect</span>
                  </button>
                </>
              ) : (
                <button
                  onClick={handleConnectGmail}
                  disabled={isConnecting}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-rose-600 to-indigo-600 hover:from-rose-500 hover:to-indigo-500 text-white font-bold text-xs shadow-lg shadow-rose-600/20 transition-all disabled:opacity-50"
                >
                  <Mail className="w-4 h-4" />
                  <span>{isConnecting ? 'Connecting...' : 'Connect Gmail'}</span>
                </button>
              )}
            </div>
          </div>

          {/* Connected Details or Connect Explanation */}
          {connection ? (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
              <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800">
                <span className="text-[11px] font-medium text-slate-400 block">Connected Account</span>
                <span className="text-xs font-bold text-slate-200 mt-1 block font-mono">{connection.emailAddress}</span>
              </div>

              <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800">
                <span className="text-[11px] font-medium text-slate-400 block">Last Synchronized</span>
                <span className="text-xs font-bold text-slate-200 mt-1 block font-mono">
                  {connection.lastSyncedAt ? new Date(connection.lastSyncedAt).toLocaleString() : 'Never'}
                </span>
              </div>

              <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800">
                <span className="text-[11px] font-medium text-slate-400 block">Active Scopes</span>
                <div className="flex flex-wrap gap-1 mt-1.5">
                  <span className="px-2 py-0.5 rounded-md bg-slate-900 border border-slate-800 text-[10px] text-slate-400 font-mono">
                    gmail.readonly
                  </span>
                  <span className="px-2 py-0.5 rounded-md bg-slate-900 border border-slate-800 text-[10px] text-slate-400 font-mono">
                    gmail.send
                  </span>
                </div>
              </div>
            </div>
          ) : (
            <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 text-slate-400 text-xs leading-relaxed space-y-2">
              <p className="text-slate-300 font-semibold">How Gmail integration works:</p>
              <ul className="list-disc list-inside space-y-1 text-slate-400">
                <li>We request minimum read & send scopes via Google OAuth 2.0. We never ask for your password.</li>
                <li>Your tokens are encrypted at rest using AES-256-GCM.</li>
                <li>The system scans only job application, recruiter, and interview emails.</li>
                <li><strong className="text-slate-200">The assistant will NEVER send an email without your explicit review and confirmation.</strong></li>
              </ul>
            </div>
          )}
        </div>

        {/* Security & Anti-Automation Banner */}
        <div className="p-6 rounded-3xl bg-slate-900/40 border border-slate-800/80 flex items-start gap-4">
          <div className="p-2.5 rounded-xl bg-sky-500/10 border border-sky-500/20 text-sky-400 shrink-0">
            <Lock className="w-5 h-5" />
          </div>
          <div className="space-y-1 text-xs">
            <h3 className="font-bold text-slate-200">Privacy & Controlled Automation Guarantee</h3>
            <p className="text-slate-400 leading-relaxed">
              AI Job Hunter is designed with strict human-in-the-loop controls. Automated mass emailing, silent status changes, and autonomous submissions are strictly prohibited by architecture. You maintain full ownership of every sent communication and application transition.
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}

export default function IntegrationsPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-slate-950 text-slate-400 flex items-center justify-center font-sans">
          <div className="flex items-center gap-2 text-xs">
            <div className="w-4 h-4 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin" />
            <span>Loading Integrations Settings...</span>
          </div>
        </div>
      }
    >
      <IntegrationsContent />
    </Suspense>
  );
}
