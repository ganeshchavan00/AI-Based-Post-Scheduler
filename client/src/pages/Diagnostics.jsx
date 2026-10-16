import React, { useState, useEffect } from 'react';
import { 
  Server, 
  Database, 
  CheckCircle2, 
  AlertCircle, 
  RefreshCw, 
  Activity
} from 'lucide-react';
import api from '../services/api';

export default function Diagnostics() {
  const [serverHealth, setServerHealth] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lastChecked, setLastChecked] = useState(null);

  const checkHealth = async () => {
    setLoading(true);
    setError(null);
    try {
      const startTime = performance.now();
      const response = await api.get('/health');
      const latency = Math.round(performance.now() - startTime);
      setServerHealth({ ...response.data, latency });
      setLastChecked(new Date().toLocaleTimeString());
    } catch (err) {
      setError(err.message || 'Cannot connect to backend server at http://localhost:5000/api');
      setServerHealth(null);
      setLastChecked(new Date().toLocaleTimeString());
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    checkHealth();
  }, []);

  const dbConnected = serverHealth?.database?.isConnected;

  return (
    <div className="max-w-6xl mx-auto p-4 sm:p-6 md:p-8 space-y-6">
      
      {/* Title */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <Activity className="w-5 h-5 text-emerald-600" />
            System & Database Diagnostics
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Real-time status probe of React Frontend, Express API, MongoDB connection, and Background Scheduler.
          </p>
        </div>
        <button
          onClick={checkHealth}
          disabled={loading}
          className="self-start sm:self-auto flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-white hover:bg-slate-50 text-slate-700 text-xs font-medium border border-slate-200 transition-colors disabled:opacity-50 cursor-pointer shadow-xs"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-blue-600' : ''}`} />
          <span>Refresh Probe</span>
        </button>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        
        {/* Frontend */}
        <div className="p-5 rounded-xl bg-white border border-slate-200 shadow-xs flex flex-col justify-between">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-[11px] uppercase tracking-wider text-slate-500 font-semibold">Client Engine</p>
              <h2 className="text-lg font-bold text-slate-900 mt-1">React 19 + Vite</h2>
            </div>
            <div className="p-2 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-700">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-4 pt-3 border-t border-slate-100 space-y-1.5 text-xs text-slate-600">
            <div className="flex justify-between">
              <span className="text-slate-400">Origin:</span>
              <span className="font-mono text-emerald-700 font-medium">http://localhost:5173</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Design System:</span>
              <span className="text-slate-700 font-medium">Tailwind CSS v4 (SaaS Light)</span>
            </div>
          </div>
        </div>

        {/* Backend API */}
        <div className="p-5 rounded-xl bg-white border border-slate-200 shadow-xs flex flex-col justify-between">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-[11px] uppercase tracking-wider text-slate-500 font-semibold">Backend API</p>
              <h2 className="text-lg font-bold text-slate-900 mt-1">Express & JWT</h2>
            </div>
            <div className={`p-2 rounded-lg border ${serverHealth ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : 'bg-rose-50 border-rose-200 text-rose-700'}`}>
              {serverHealth ? <CheckCircle2 className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
            </div>
          </div>
          <div className="mt-4 pt-3 border-t border-slate-100 space-y-1.5 text-xs text-slate-600">
            <div className="flex justify-between">
              <span className="text-slate-400">Endpoint:</span>
              <span className="font-mono text-blue-700 font-medium">http://localhost:5000</span>
            </div>
            {serverHealth && (
              <div className="flex justify-between">
                <span className="text-slate-400">Latency:</span>
                <span className="font-mono text-emerald-700 font-medium">{serverHealth.latency} ms</span>
              </div>
            )}
          </div>
        </div>

        {/* Database */}
        <div className="p-5 rounded-xl bg-white border border-slate-200 shadow-xs flex flex-col justify-between">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-[11px] uppercase tracking-wider text-slate-500 font-semibold">Database Driver</p>
              <h2 className="text-lg font-bold text-slate-900 mt-1">MongoDB</h2>
            </div>
            <div className={`p-2 rounded-lg border ${dbConnected ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : 'bg-amber-50 border-amber-200 text-amber-700'}`}>
              <Database className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-4 pt-3 border-t border-slate-100 space-y-1.5 text-xs text-slate-600">
            <div className="flex justify-between">
              <span className="text-slate-400">Database:</span>
              <span className="font-mono text-slate-800 font-medium">{serverHealth?.database?.name || 'ai_social_scheduler'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Status:</span>
              <span className={`font-semibold ${dbConnected ? 'text-emerald-700' : 'text-amber-700'}`}>
                {dbConnected ? 'Connected & Healthy' : 'Disconnected'}
              </span>
            </div>
          </div>
        </div>

      </div>

      {/* Live Probe Output */}
      <div className="p-6 rounded-xl bg-white border border-slate-200 shadow-xs space-y-3">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2">
            <Server className="w-4 h-4 text-blue-600" />
            <h3 className="font-bold text-slate-900 text-xs">Live HTTP Probe Output</h3>
          </div>
          <span className="text-xs font-mono text-slate-400">GET /api/health</span>
        </div>

        {loading ? (
          <div className="p-4 rounded-lg bg-slate-50 text-xs text-slate-500 flex items-center gap-2">
            <RefreshCw className="w-3.5 h-3.5 animate-spin text-blue-600" />
            <span>Probing backend...</span>
          </div>
        ) : serverHealth ? (
          <div className="p-4 rounded-lg bg-slate-50 border border-slate-200 text-xs font-mono text-slate-800 overflow-x-auto">
            <pre>{JSON.stringify(serverHealth, null, 2)}</pre>
          </div>
        ) : (
          <div className="p-4 rounded-lg bg-rose-50 border border-rose-200 text-xs text-rose-700">
            {error}
          </div>
        )}
      </div>

    </div>
  );
}
