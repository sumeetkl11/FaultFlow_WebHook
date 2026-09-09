'use client';

import React from 'react';
import { useTelemetryStore } from '../stores/useTelemetryStore';
import {
  Activity,
  ShieldCheck,
  CopyCheck,
  AlertOctagon,
  RotateCw,
  Zap,
  Lock,
  CheckCircle,
  Clock,
  ArrowUpRight,
} from 'lucide-react';

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
    audienceMode,
  } = useTelemetryStore();

  const isBusiness = audienceMode === 'business';

  const estimatedSavedRevenue = (rescuedPayloads * 25).toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  });

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 w-full">
      {/* Card 1: Ingress / Processed Events */}
      <div className="glass-card rounded-2xl p-5 border border-slate-800/80 shadow-lg relative overflow-hidden group hover:border-indigo-500/50 transition">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
            {isBusiness ? 'Processed Transactions' : 'Ingress Throughput'}
          </span>
          <div className="p-2 rounded-xl bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 group-hover:bg-indigo-500/20 transition">
            {isBusiness ? <Zap className="w-4 h-4" /> : <Activity className="w-4 h-4" />}
          </div>
        </div>

        <div className="mt-3 flex items-baseline gap-2">
          <span className="text-3xl font-bold tracking-tight text-white font-mono">
            {isBusiness ? (throughputRps > 0 ? throughputRps * 60 : 248) : throughputRps}
          </span>
          <span className="text-xs text-slate-400 font-medium">
            {isBusiness ? 'events / min' : 'req/s'}
          </span>
        </div>

        <div className="mt-3 flex items-center gap-3 text-xs text-slate-400 border-t border-slate-800/60 pt-2.5">
          {isBusiness ? (
            <div className="flex items-center gap-1.5 text-emerald-400 font-medium">
              <CheckCircle className="w-3.5 h-3.5" />
              <span>99.99% Guaranteed Delivery</span>
            </div>
          ) : (
            <div className="flex items-center gap-2 font-mono text-[11px]">
              <span>p50: <strong className="text-slate-200">{p50Ms}ms</strong></span>
              <span>•</span>
              <span>p95: <strong className="text-indigo-300">{p95Ms}ms</strong></span>
              <span>•</span>
              <span>Q: <strong className="text-slate-200">{activeQueue}</strong></span>
            </div>
          )}
        </div>
      </div>

      {/* Card 2: Rescued Payloads [Auto-Recovered Data] */}
      <div className="glass-card rounded-2xl p-5 border border-slate-800/80 shadow-lg relative overflow-hidden group hover:border-emerald-500/50 transition">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
            {isBusiness ? 'Rescued Transactions' : 'Rescued Payloads'}
          </span>
          <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 group-hover:bg-emerald-500/20 transition">
            <ShieldCheck className="w-4 h-4" />
          </div>
        </div>

        <div className="mt-3 flex items-baseline gap-2">
          <span className="text-3xl font-bold tracking-tight text-white font-mono">
            {rescuedPayloads.toLocaleString()}
          </span>
          <span className="text-xs text-emerald-400 font-medium">
            {isBusiness ? 'orders saved' : 'delivered'}
          </span>
        </div>

        <div className="mt-3 text-xs text-slate-400 border-t border-slate-800/60 pt-2.5 flex items-center justify-between">
          <span>{isBusiness ? 'Saved Business Volume' : 'Protected Volume'}</span>
          <strong className="text-emerald-400 font-mono font-semibold">{estimatedSavedRevenue}</strong>
        </div>
      </div>

      {/* Card 3: Duplicate Requests Blocked [Prevented Double Action] */}
      <div className="glass-card rounded-2xl p-5 border border-slate-800/80 shadow-lg relative overflow-hidden group hover:border-cyan-500/50 transition">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
            {isBusiness ? 'Double Charges Blocked' : 'Deduplications'}
          </span>
          <div className="p-2 rounded-xl bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 group-hover:bg-cyan-500/20 transition">
            <CopyCheck className="w-4 h-4" />
          </div>
        </div>

        <div className="mt-3 flex items-baseline gap-2">
          <span className="text-3xl font-bold tracking-tight text-white font-mono">
            {deduplications.toLocaleString()}
          </span>
          <span className="text-xs text-cyan-400 font-medium">
            {isBusiness ? 'duplicates stopped' : 'SETNX filtered'}
          </span>
        </div>

        <div className="mt-3 text-xs text-slate-400 border-t border-slate-800/60 pt-2.5 flex items-center justify-between">
          <span>{isBusiness ? 'Double Action Guard' : 'Double Execution Guard'}</span>
          <span className="text-cyan-300 font-medium font-mono text-[11px]">
            {isBusiness ? '100% Protected' : 'Atomic (24h TTL)'}
          </span>
        </div>
      </div>

      {/* Card 4: DLQ Safe Backlog */}
      <div className="glass-card rounded-2xl p-5 border border-slate-800/80 shadow-lg relative overflow-hidden group hover:border-rose-500/50 transition">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
            {isBusiness ? 'Orders Needing Attention' : 'DLQ Safe Backlog'}
          </span>
          <div className="p-2 rounded-xl bg-rose-500/10 text-rose-400 border border-rose-500/20 group-hover:bg-rose-500/20 transition">
            <AlertOctagon className="w-4 h-4" />
          </div>
        </div>

        <div className="mt-3 flex items-baseline justify-between gap-2">
          <div className="flex items-baseline gap-2">
            <span
              className={`text-3xl font-bold tracking-tight font-mono ${
                dlqCount > 0 ? 'text-rose-400' : 'text-slate-400'
              }`}
            >
              {dlqCount.toLocaleString()}
            </span>
            <span className="text-xs text-slate-400 font-medium">
              {isBusiness ? 'failed orders' : 'jobs exhausted'}
            </span>
          </div>

          {dlqCount > 0 && (
            <button
              onClick={onOpenDlqModal}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold shadow-md shadow-rose-950/50 transition animate-pulse"
            >
              <RotateCw className="w-3 h-3" />
              <span>{isBusiness ? 'Recover All' : 'Batch Replay'}</span>
            </button>
          )}
        </div>

        <div className="mt-3 text-xs text-slate-400 border-t border-slate-800/60 pt-2.5 flex items-center justify-between">
          <span>{isBusiness ? 'Safety Status' : 'Remediation Engine'}</span>
          <span
            className={`font-semibold ${
              dlqCount > 0 ? 'text-rose-400' : 'text-emerald-400'
            }`}
          >
            {dlqCount > 0
              ? isBusiness
                ? 'Action Recommended'
                : 'Throttled (50 req/s)'
              : isBusiness
              ? 'All Clear'
              : 'Zero Dead-Letters'}
          </span>
        </div>
      </div>
    </div>
  );
};
