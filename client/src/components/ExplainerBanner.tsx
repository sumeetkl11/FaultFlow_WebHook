'use client';

import React from 'react';
import { useTelemetryStore } from '../stores/useTelemetryStore';
import { Zap, X, ShieldCheck } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export const ExplainerBanner: React.FC = () => {
  const { audienceMode, bannerCollapsed, toggleBanner } = useTelemetryStore();
  const isBusiness = audienceMode === 'business';

  if (bannerCollapsed) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: -4 }}
        animate={{ opacity: 1, y: 0, transition: { duration: 0.15 } }}
        exit={{ opacity: 0, y: -4, transition: { duration: 0.1 } }}
        className="w-full bg-zinc-900 border border-zinc-800 rounded px-3 py-1.5 flex items-center justify-between gap-3 text-[11px] font-mono text-zinc-300"
      >
        <div className="flex items-center gap-2 min-w-0">
          <span className="flex items-center gap-1 text-emerald-400 font-semibold flex-shrink-0">
            <ShieldCheck className="w-3.5 h-3.5" />
            ZERO-LOSS
          </span>
          <span className="text-zinc-500">|</span>
          <span className="truncate text-zinc-400">
            {isBusiness
              ? 'Incoming orders buffer in memory during downtime. Re-delivered automatically upon recovery.'
              : 'Ingress buffered via atomic Redis SETNX idempotency + BullMQ backoff jitter. Zero drop guarantee.'}
          </span>
        </div>

        <div className="flex items-center gap-3 flex-shrink-0">
          <button
            onClick={() => {
              const el = document.getElementById('btn-simulate-traffic');
              if (el) {
                el.scrollIntoView({ behavior: 'smooth' });
                el.classList.add('ring-1', 'ring-amber-400');
                setTimeout(() => el.classList.remove('ring-1', 'ring-amber-400'), 1200);
              }
            }}
            className="text-amber-400 hover:text-amber-300 flex items-center gap-1 font-semibold transition-colors"
          >
            <Zap className="w-3 h-3" />
            <span>Test Chaos Blast ↓</span>
          </button>
          <button
            onClick={toggleBanner}
            className="text-zinc-500 hover:text-zinc-300 p-0.5 rounded hover:bg-zinc-800 transition-colors"
            title="Dismiss banner"
          >
            <X className="w-3 h-3" />
          </button>
        </div>
      </motion.div>
    </AnimatePresence>
  );
};
