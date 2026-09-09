'use client';

import React, { useEffect, useState } from 'react';
import { useTelemetryStore } from '../stores/useTelemetryStore';
import { RefreshCw, CheckCircle2, AlertTriangle, XCircle, Clock, PauseCircle, RotateCw, ShieldCheck } from 'lucide-react';

interface StatusBadgeProps {
  status: 'QUEUED' | 'PROCESSING' | 'RETRYING' | 'DELIVERED' | 'DEAD_LETTERED' | 'CIRCUIT_HOLD' | string;
  attempts?: number;
  maxRetries?: number;
  latencyMs?: number | null;
  nextRetryInMs?: number;
  onReplay?: () => void;
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({
  status,
  attempts = 0,
  maxRetries = 5,
  latencyMs,
  nextRetryInMs = 5000,
  onReplay,
}) => {
  const { audienceMode } = useTelemetryStore();
  const isBusiness = audienceMode === 'business';

  const [secondsRemaining, setSecondsRemaining] = useState<number>(
    Math.max(1, Math.round(nextRetryInMs / 1000))
  );

  useEffect(() => {
    if (status !== 'RETRYING') return;
    setSecondsRemaining(Math.max(1, Math.round(nextRetryInMs / 1000)));

    const timer = setInterval(() => {
      setSecondsRemaining((prev) => (prev > 1 ? prev - 1 : 1));
    }, 1000);

    return () => clearInterval(timer);
  }, [status, nextRetryInMs]);

  switch (status) {
    case 'QUEUED':
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-amber-950/60 text-amber-300 border border-amber-800/60 animate-pulse">
          <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
          {isBusiness ? 'Queued Safely' : 'QUEUED'}
        </span>
      );

    case 'PROCESSING':
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-blue-950/60 text-blue-300 border border-blue-800/60">
          <RefreshCw className="w-3 h-3 animate-spin text-blue-400" />
          {isBusiness ? 'Sending to App...' : 'PROCESSING'}
        </span>
      );

    case 'RETRYING':
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-indigo-950/80 text-indigo-300 border border-indigo-700/60">
          <svg className="w-3.5 h-3.5 text-indigo-400 animate-spin" viewBox="0 0 24 24">
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
              fill="none"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8v8H4z"
            />
          </svg>
          {isBusiness ? (
            <span>Auto-Retrying in {secondsRemaining}s</span>
          ) : (
            <span>RETRYING ({attempts}/{maxRetries}) in {secondsRemaining}s</span>
          )}
        </span>
      );

    case 'DELIVERED':
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-950/70 text-emerald-300 border border-emerald-800/60">
          <CheckCircle2 className="w-3 h-3 text-emerald-400" />
          <span>{isBusiness ? 'Delivered Safely' : 'DELIVERED'}</span>
          {!isBusiness && latencyMs != null && (
            <span className="text-[10px] text-emerald-400/80 font-mono">
              {latencyMs}ms
            </span>
          )}
        </span>
      );

    case 'DEAD_LETTERED':
      return (
        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium bg-rose-950/80 text-rose-300 border border-rose-800/70">
          <XCircle className="w-3 h-3 text-rose-400" />
          <span>{isBusiness ? 'Action Needed' : 'DEAD-LETTERED'}</span>
          {onReplay && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onReplay();
              }}
              className="ml-1 inline-flex items-center gap-1 px-2 py-0.5 bg-rose-900/90 hover:bg-rose-800 text-white rounded text-[10px] font-semibold transition"
              title="Safely resend this transaction"
            >
              <RotateCw className="w-2.5 h-2.5" />
              <span>{isBusiness ? 'Resend' : 'Replay'}</span>
            </button>
          )}
        </span>
      );

    case 'CIRCUIT_HOLD':
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-purple-950/70 text-purple-300 border border-purple-800/60">
          <PauseCircle className="w-3 h-3 text-purple-400" />
          {isBusiness ? 'Paused for Protection' : 'CIRCUIT HOLD (5m)'}
        </span>
      );

    default:
      return (
        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium bg-slate-800 text-slate-300 border border-slate-700">
          <Clock className="w-3 h-3 text-slate-400" />
          {status}
        </span>
      );
  }
};
