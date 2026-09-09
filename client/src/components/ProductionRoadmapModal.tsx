'use client';

import React, { useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import {
  X,
  CheckCircle2,
  Circle,
  Zap,
  ShoppingBag,
  Landmark,
  ArrowRight,
} from 'lucide-react';

interface ProductionRoadmapModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const phases = [
  {
    id: 1,
    status: 'done' as const,
    label: 'Phase 1',
    title: 'Core Engine & Observability',
    subtitle: 'Fully shipped — running live in this dashboard',
    Icon: Zap,
    items: [
      'Sub-25ms Ingress Gateway (Express + Zod)',
      'BullMQ Worker Cluster (concurrency = 20)',
      'HMAC-SHA256 Cryptographic Signing',
      'Atomic Redis SETNX Idempotency (24h TTL)',
      'Exponential Backoff + Jitter (5s → 15m)',
      'Circuit Breaker (10 failures / 30s trip)',
      'Dead-Letter Queue + 50 rps Batch Replay',
      'Real-Time SSE Telemetry Stream',
      'Interactive Chaos Testing Sandbox',
    ],
  },
  {
    id: 2,
    status: 'future' as const,
    label: 'Phase 2',
    title: 'One-Click Shopify App Bridge',
    subtitle: 'Next milestone — production Shopify plugin',
    Icon: ShoppingBag,
    items: [
      'Shopify OAuth 2.0 install flow',
      'Automatic endpoint registration via Admin API',
      'App Bridge admin panel UI (embedded)',
      'Order / Fulfillment / Refund event mapping',
      'Shopify Webhooks v3 HMAC verification',
    ],
  },
  {
    id: 3,
    status: 'future' as const,
    label: 'Phase 3',
    title: 'Bank Webhook Proxy & SDK',
    subtitle: 'Long-term — direct payment processor integration',
    Icon: Landmark,
    items: [
      'Direct bank / payment processor proxy mode',
      'TypeScript & Python client SDKs',
      'Multi-region active-active failover',
      'SLA guarantee dashboard (99.99% uptime)',
      'Compliance audit log export (SOC2 ready)',
    ],
  },
];

export const ProductionRoadmapModal: React.FC<ProductionRoadmapModalProps> = ({
  isOpen,
  onClose,
}) => {
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    },
    [onClose]
  );

  useEffect(() => {
    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'hidden';
    }
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = '';
    };
  }, [isOpen, handleKeyDown]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/60 flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.98 }}
        animate={{ opacity: 1, scale: 1, transition: { duration: 0.15 } }}
        exit={{ opacity: 0, scale: 0.98, transition: { duration: 0.1 } }}
        className="w-full max-w-2xl max-h-[85vh] flex flex-col bg-zinc-900 border border-zinc-800 rounded-md shadow-2xl overflow-hidden font-mono"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Production Roadmap"
      >
        {/* Header */}
        <div className="h-11 px-4 border-b border-zinc-800 bg-zinc-950 flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-mono uppercase tracking-wider text-zinc-500">
              FaultFlow
            </span>
            <ArrowRight className="w-3 h-3 text-zinc-600" />
            <span className="text-xs font-semibold text-zinc-100 uppercase tracking-wider">
              Production Roadmap
            </span>
          </div>
          <motion.button
            whileTap={{ scale: 0.97 }}
            onClick={onClose}
            id="roadmap-modal-close"
            className="p-1 rounded text-zinc-500 hover:text-zinc-200 hover:bg-zinc-800 transition-colors"
          >
            <X className="w-3.5 h-3.5" />
          </motion.button>
        </div>

        {/* Body Timeline */}
        <div className="p-4 overflow-y-auto space-y-4 text-xs">
          {phases.map((phase, idx) => {
            const isDone = phase.status === 'done';
            const isLast = idx === phases.length - 1;
            const PhaseIcon = phase.Icon;

            return (
              <div key={phase.id} className="relative flex gap-3">
                {/* Left icon + line */}
                <div className="flex flex-col items-center flex-shrink-0">
                  <div
                    className={`w-7 h-7 rounded border flex items-center justify-center ${
                      isDone
                        ? 'bg-emerald-950/60 border-emerald-800/80 text-emerald-400'
                        : 'bg-zinc-950 border-zinc-800 text-zinc-500'
                    }`}
                  >
                    <PhaseIcon className="w-3.5 h-3.5" />
                  </div>
                  {!isLast && <div className="w-px flex-1 my-1 bg-zinc-800" />}
                </div>

                {/* Right content */}
                <div className={`pb-4 flex-1 ${isLast ? 'pb-0' : ''}`}>
                  <div className="flex items-center gap-2 mb-1">
                    <span
                      className={`text-[10px] font-mono px-1.5 py-0.5 rounded border ${
                        isDone
                          ? 'bg-emerald-950/60 text-emerald-300 border-emerald-800/60'
                          : 'bg-zinc-950 text-zinc-400 border-zinc-800'
                      }`}
                    >
                      {phase.label}
                    </span>
                    {isDone ? (
                      <span className="flex items-center gap-1 text-[10px] text-emerald-400">
                        <CheckCircle2 className="w-3 h-3" />
                        Shipped & Active
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 text-[10px] text-zinc-500">
                        <Circle className="w-3 h-3" />
                        Planned
                      </span>
                    )}
                  </div>

                  <h3 className={`text-xs font-semibold ${isDone ? 'text-zinc-100' : 'text-zinc-400'}`}>
                    {phase.title}
                  </h3>
                  <p className="text-[11px] text-zinc-500 mb-2">{phase.subtitle}</p>

                  <ul className="space-y-1">
                    {phase.items.map((item, i) => (
                      <li key={i} className="flex items-start gap-1.5 text-[11px] text-zinc-400">
                        <span className="text-zinc-600 font-mono">›</span>
                        <span className={isDone ? 'text-zinc-300' : 'text-zinc-500'}>{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div className="h-10 px-4 border-t border-zinc-800 bg-zinc-950 flex items-center justify-between text-[11px] text-zinc-500 flex-shrink-0">
          <span>Engine Status: Production Ready</span>
          <motion.button
            whileTap={{ scale: 0.97 }}
            onClick={onClose}
            className="px-3 py-1 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-300 transition-colors"
          >
            Close
          </motion.button>
        </div>
      </motion.div>
    </div>
  );
};
