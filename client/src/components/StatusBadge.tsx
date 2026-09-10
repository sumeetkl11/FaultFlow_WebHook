'use client';

import React, { useEffect, useState } from 'react';
import { useTelemetryStore } from '../stores/useTelemetryStore';
import { RotateCw } from 'lucide-react';
import { motion } from 'framer-motion';

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
  const audienceMode = useTelemetryStore(s => s.audienceMode);
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
        <span className="inline-flex items-center gap-1.5 px-1.5 py-0.5 rounded text-[11px] font-mono font-medium bg-amber-950/40 text-amber-400 border border-amber-800/50 transition-colors duration-300 ease-in-out">
          <motion.span
            animate={{ opacity: [0.5, 1, 0.5] }}
            transition={{ repeat: Infinity, duration: 2 }}
            className="w-1.5 h-1.5 rounded-full bg-amber-400"
          />
          {isBusiness ? 'Queued' : 'QUEUED'}
        </span>
      );

    case 'PROCESSING':
      return (
        <span className="inline-flex items-center gap-1.5 px-1.5 py-0.5 rounded text-[11px] font-mono font-medium bg-zinc-800/80 text-zinc-300 border border-zinc-700/60 transition-colors duration-300 ease-in-out">
          <motion.span
            animate={{ opacity: [0.5, 1, 0.5] }}
            transition={{ repeat: Infinity, duration: 1.5 }}
            className="w-1.5 h-1.5 rounded-full bg-zinc-300"
          />
          {isBusiness ? 'Sending…' : 'PROCESSING'}
        </span>
      );

    case 'RETRYING':
      return (
        <span className="inline-flex items-center gap-1.5 px-1.5 py-0.5 rounded text-[11px] font-mono font-medium bg-amber-950/40 text-amber-400 border border-amber-800/50 transition-colors duration-300 ease-in-out">
          <motion.span
            animate={{ opacity: [0.5, 1, 0.5] }}
            transition={{ repeat: Infinity, duration: 2 }}
            className="w-1.5 h-1.5 rounded-full bg-amber-400"
          />
          {isBusiness ? (
            <span>Retry in {secondsRemaining}s</span>
          ) : (
            <span>RETRY {attempts}/{maxRetries} ({secondsRemaining}s)</span>
          )}
        </span>
      );

    case 'DELIVERED':
      return (
        <span className="inline-flex items-center gap-1.5 px-1.5 py-0.5 rounded text-[11px] font-mono font-medium bg-emerald-950/40 text-emerald-400 border border-emerald-800/50 transition-colors duration-300 ease-in-out">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
          <span>{isBusiness ? 'Delivered' : 'DELIVERED'}</span>
          {!isBusiness && latencyMs !== null && latencyMs !== undefined && (
            <span className="text-[10px] text-emerald-500 tabular-nums">
              · {latencyMs}ms
            </span>
          )}
        </span>
      );

    case 'DEAD_LETTERED':
      return (
        <span className="inline-flex items-center gap-1.5 px-1.5 py-0.5 rounded text-[11px] font-mono font-medium bg-rose-950/40 text-rose-400 border border-rose-800/50 transition-colors duration-300 ease-in-out">
          <span className="w-1.5 h-1.5 rounded-full bg-rose-400" />
          <span>{isBusiness ? 'Action Needed' : 'DLQ'}</span>
          {onReplay && (
            <motion.button
              whileTap={{ scale: 0.97 }}
              onClick={(e) => {
                e.stopPropagation();
                onReplay();
              }}
              className="ml-1 px-1 py-0.5 bg-rose-900/80 hover:bg-rose-800 text-rose-200 rounded text-[10px] font-mono border border-rose-700/60 transition-colors"
              title="Replay transaction"
            >
              <RotateCw className="w-2.5 h-2.5" />
            </motion.button>
          )}
        </span>
      );

    case 'CIRCUIT_HOLD':
      return (
        <span className="inline-flex items-center gap-1.5 px-1.5 py-0.5 rounded text-[11px] font-mono font-medium bg-amber-950/40 text-amber-400 border border-amber-800/50 transition-colors duration-300 ease-in-out">
          <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
          {isBusiness ? 'Paused' : 'CIRCUIT_HOLD'}
        </span>
      );

    default:
      return (
        <span className="inline-flex items-center gap-1.5 px-1.5 py-0.5 rounded text-[11px] font-mono font-medium bg-zinc-900 text-zinc-400 border border-zinc-800 transition-colors duration-300 ease-in-out">
          {status}
        </span>
      );
  }
};
