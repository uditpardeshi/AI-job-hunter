'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { 
  Activity, 
  CheckCircle2, 
  XCircle, 
  RefreshCw, 
  Server, 
  Database, 
  Zap, 
  Bot, 
  Globe,
  Radio
} from 'lucide-react';

interface ServiceCheck {
  name: string;
  key: 'api' | 'db' | 'redis' | 'ai';
  endpoint: string;
  icon: React.ReactNode;
  status: 'checking' | 'connected' | 'error';
  latency?: number;
  message?: string;
  detail?: string;
}

export default function Home() {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [lastChecked, setLastChecked] = useState<string | null>(null);

  const [services, setServices] = useState<Record<string, ServiceCheck>>({
    api: {
      name: 'Express Backend API',
      key: 'api',
      endpoint: '/health',
      icon: <Server className="w-5 h-5 text-sky-400" />,
      status: 'checking',
    },
    db: {
      name: 'PostgreSQL Database',
      key: 'db',
      endpoint: '/health/db',
      icon: <Database className="w-5 h-5 text-indigo-400" />,
      status: 'checking',
    },
    redis: {
      name: 'Redis In-Memory Cache',
      key: 'redis',
      endpoint: '/health/redis',
      icon: <Zap className="w-5 h-5 text-rose-400" />,
      status: 'checking',
    },
    ai: {
      name: 'FastAPI AI Microservice',
      key: 'ai',
      endpoint: '/health/ai',
      icon: <Bot className="w-5 h-5 text-emerald-400" />,
      status: 'checking',
    },
  });

  const checkHealth = useCallback(async () => {
    setIsRefreshing(true);

    // Reset all to checking
    setServices((prev) => {
      const updated = { ...prev };
      for (const k in updated) {
        updated[k] = { ...updated[k], status: 'checking', message: undefined };
      }
      return updated;
    });

    const checkService = async (key: 'api' | 'db' | 'redis' | 'ai', endpoint: string) => {
      const start = Date.now();
      try {
        const res = await fetch(`${apiUrl}${endpoint}`, { cache: 'no-store' });
        const latency = Date.now() - start;
        if (res.ok) {
          const data = await res.json();
          setServices((prev) => ({
            ...prev,
            [key]: {
              ...prev[key],
              status: 'connected',
              latency: data.latencyMs ?? latency,
              message: 'Operational',
            },
          }));
        } else {
          setServices((prev) => ({
            ...prev,
            [key]: {
              ...prev[key],
              status: 'error',
              message: `HTTP ${res.status}`,
            },
          }));
        }
      } catch (err: unknown) {
        const errorMsg = err instanceof Error ? err.message : 'Connection failed';
        setServices((prev) => ({
          ...prev,
          [key]: {
            ...prev[key],
            status: 'error',
            message: errorMsg,
          },
        }));
      }
    };

    await Promise.all([
      checkService('api', '/health'),
      checkService('db', '/health/db'),
      checkService('redis', '/health/redis'),
      checkService('ai', '/health/ai'),
    ]);

    setLastChecked(new Date().toLocaleTimeString());
    setIsRefreshing(false);
  }, [apiUrl]);

  useEffect(() => {
    checkHealth();
  }, [checkHealth]);

  const allConnected = Object.values(services).every((s) => s.status === 'connected');
  const hasErrors = Object.values(services).some((s) => s.status === 'error');

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100 flex flex-col items-center justify-center p-6 md:p-12 relative overflow-hidden">
      {/* Subtle background glow */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-sky-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 left-1/3 -translate-x-1/2 w-80 h-80 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />

      <div className="w-full max-w-4xl relative z-10 space-y-8">
        {/* Header */}
        <div className="text-center space-y-3">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-slate-900 border border-slate-800 text-xs font-medium text-slate-400">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
            Step 1: Foundation Architecture
          </div>
          <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight bg-gradient-to-r from-white via-slate-200 to-slate-400 bg-clip-text text-transparent">
            AI Job Hunter
          </h1>
          <p className="text-slate-400 text-base max-w-lg mx-auto">
            System status and inter-service communication hub for local microservices stack.
          </p>
        </div>

        {/* Global Status Banner */}
        <div className="bg-slate-900/80 border border-slate-800 backdrop-blur-sm rounded-2xl p-6 shadow-xl flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className={`p-3 rounded-xl ${allConnected ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : hasErrors ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20' : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'}`}>
              <Activity className="w-7 h-7" />
            </div>
            <div>
              <div className="text-sm font-medium text-slate-400">Stack Status</div>
              <div className="text-xl font-bold text-slate-100 flex items-center gap-2">
                {allConnected ? (
                  <>
                    <span className="text-emerald-400">All Systems Operational</span>
                  </>
                ) : hasErrors ? (
                  <span className="text-rose-400">Degraded Services Detected</span>
                ) : (
                  <span className="text-amber-400">Connecting to Services...</span>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {lastChecked && (
              <span className="text-xs text-slate-500 hidden sm:inline">
                Checked: {lastChecked}
              </span>
            )}
            <a
              href="/resume"
              className="inline-flex items-center gap-2 px-3.5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-medium text-xs border border-slate-700 transition-colors"
            >
              Resume Profile
            </a>
            <a
              href="/jobs"
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-sky-600 hover:bg-sky-500 text-white font-medium text-xs transition-colors shadow-lg shadow-sky-600/20"
            >
              Explore Jobs →
            </a>
            <button
              id="refresh-health-btn"
              onClick={checkHealth}
              disabled={isRefreshing}
              className="inline-flex items-center gap-2 px-3.5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-medium text-xs transition-colors border border-slate-700 disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin text-sky-400' : ''}`} />
              {isRefreshing ? 'Checking...' : 'Check Health'}
            </button>
          </div>
        </div>

        {/* Services Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Frontend Card */}
          <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-5 flex items-center justify-between transition-all hover:border-slate-700">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-lg bg-sky-500/10 border border-sky-500/20 text-sky-400">
                <Globe className="w-5 h-5" />
              </div>
              <div>
                <div className="font-semibold text-slate-200">Frontend (Next.js)</div>
                <div className="text-xs text-slate-400">Port 3000 • Client App</div>
              </div>
            </div>
            <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-semibold">
              <CheckCircle2 className="w-3.5 h-3.5" />
              Online
            </div>
          </div>

          {/* Dynamic Services Cards */}
          {Object.values(services).map((srv) => (
            <div
              key={srv.key}
              className="bg-slate-900/60 border border-slate-800 rounded-xl p-5 flex items-center justify-between transition-all hover:border-slate-700"
            >
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-lg bg-slate-800 border border-slate-700">
                  {srv.icon}
                </div>
                <div>
                  <div className="font-semibold text-slate-200">{srv.name}</div>
                  <div className="text-xs text-slate-400">
                    {srv.endpoint}
                    {srv.latency !== undefined && ` • ${srv.latency}ms`}
                  </div>
                </div>
              </div>

              <div>
                {srv.status === 'connected' ? (
                  <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-semibold">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    Connected
                  </div>
                ) : srv.status === 'error' ? (
                  <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs font-semibold">
                    <XCircle className="w-3.5 h-3.5" />
                    Offline
                  </div>
                ) : (
                  <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-400 text-xs font-semibold">
                    <Radio className="w-3.5 h-3.5 animate-spin" />
                    Testing
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Ollama Standby Card */}
        <div className="bg-slate-900/40 border border-slate-800/80 rounded-xl p-4 flex items-center justify-between text-xs text-slate-400">
          <div className="flex items-center gap-2.5">
            <span className="w-2 h-2 rounded-full bg-sky-400"></span>
            <span>Ollama AI Base URL: <code className="text-slate-300 font-mono">http://ollama:11434</code></span>
          </div>
          <div className="text-slate-500 font-mono">Backend Target: {apiUrl}</div>
        </div>
      </div>
    </main>
  );
}
