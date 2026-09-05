import React from 'react';
import { useTelemetryStore } from '../stores/useTelemetryStore';
import { Activity, ShieldCheck, CopyCheck, AlertOctagon, RotateCw } from 'lucide-react';

interface TopMetricBarProps {
  onOpenDlqModal: () => void;
}

export const TopMetricBar: React.FC<TopMetricBarProps> = ({ onOpenDlqModal }) => {
  const {
    throughputRps,
    p95Ms,
    p50Ms,
    rescuedPayloads,
    deduplications,
    dlqCount,
    activeQueue,
  } = useTelemetryStore();

  const estimatedSavedRevenue = (rescuedPayloads * 25).toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  });

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 w-full">
      {/* 1. Ingress Throughput & Latency */}
      <div className="glass-card rounded-xl p-5 border border-slate-800/80 shadow-lg relative overflow-hidden group hover:border-slate-700 transition">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
            Ingress Throughput
          </span>
          <div className="p-2 rounded-lg bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
            <Activity className="w-4 h-4" />
          </div>
        </div>
        <div className="mt-3 flex items-baseline gap-2">
          <span className="text-3xl font-bold tracking-tight text-white font-mono">
            {throughputRps}
          </span>
          <span className="text-xs text-slate-400">req/s</span>
        </div>
        <div className="mt-2 flex items-center gap-3 text-xs text-slate-400 border-t border-slate-800/60 pt-2">
          <span>p50: <strong className="text-slate-200 font-mono">{p50Ms}ms</strong></span>
          <span>•</span>
          <span>p95: <strong className="text-indigo-300 font-mono">{p95Ms}ms</strong></span>
          <span>•</span>
          <span>Queue: <strong className="text-slate-200 font-mono">{activeQueue}</strong></span>
        </div>
      </div>

      {/* 2. Rescued Payloads */}
      <div className="glass-card rounded-xl p-5 border border-slate-800/80 shadow-lg relative overflow-hidden group hover:border-slate-700 transition">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
            Rescued Payloads
          </span>
          <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            <ShieldCheck className="w-4 h-4" />
          </div>
        </div>
        <div className="mt-3 flex items-baseline gap-2">
          <span className="text-3xl font-bold tracking-tight text-white font-mono">
            {rescuedPayloads.toLocaleString()}
          </span>
          <span className="text-xs text-emerald-400 font-medium">delivered</span>
        </div>
        <div className="mt-2 text-xs text-slate-400 border-t border-slate-800/60 pt-2 flex items-center justify-between">
          <span>Protected Volume</span>
          <strong className="text-emerald-400 font-mono">{estimatedSavedRevenue}</strong>
        </div>
      </div>

      {/* 3. Deduplications */}
      <div className="glass-card rounded-xl p-5 border border-slate-800/80 shadow-lg relative overflow-hidden group hover:border-slate-700 transition">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
            Deduplications
          </span>
          <div className="p-2 rounded-lg bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
            <CopyCheck className="w-4 h-4" />
          </div>
        </div>
        <div className="mt-3 flex items-baseline gap-2">
          <span className="text-3xl font-bold tracking-tight text-white font-mono">
            {deduplications.toLocaleString()}
          </span>
          <span className="text-xs text-cyan-400 font-medium">SETNX filtered</span>
        </div>
        <div className="mt-2 text-xs text-slate-400 border-t border-slate-800/60 pt-2 flex items-center justify-between">
          <span>Double Execution Guard</span>
          <span className="text-cyan-300 font-medium">100% Atomic</span>
        </div>
      </div>

      {/* 4. DLQ Backlog */}
      <div className="glass-card rounded-xl p-5 border border-slate-800/80 shadow-lg relative overflow-hidden group hover:border-slate-700 transition">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
            DLQ Backlog
          </span>
          <div className="p-2 rounded-lg bg-rose-500/10 text-rose-400 border border-rose-500/20">
            <AlertOctagon className="w-4 h-4" />
          </div>
        </div>
        <div className="mt-3 flex items-baseline gap-2">
          <span className="text-3xl font-bold tracking-tight text-white font-mono">
            {dlqCount}
          </span>
          <span className="text-xs text-rose-400">jobs exhausted</span>
        </div>
        <div className="mt-2 border-t border-slate-800/60 pt-2 flex items-center justify-between">
          <span className="text-xs text-slate-400">50 rps rate throttled</span>
          <button
            onClick={onOpenDlqModal}
            className="inline-flex items-center gap-1 text-xs font-semibold text-indigo-400 hover:text-indigo-300 transition"
          >
            <RotateCw className="w-3 h-3" />
            Batch Replay
          </button>
        </div>
      </div>
    </div>
  );
};
