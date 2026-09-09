'use client';

import React, { useEffect, useCallback } from 'react';
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

const phases: {
  id: number;
  status: 'done' | 'future';
  label: string;
  title: string;
  subtitle: string;
  Icon: React.FC<{ className?: string }>;
  color: 'emerald' | 'indigo' | 'purple';
  items: string[];
}[] = [
  {
    id: 1,
    status: 'done' as const,
    label: 'Phase 1',
    title: 'Core Engine & Observability',
    subtitle: 'Fully shipped — running live in this dashboard',
    Icon: Zap as React.FC<{ className?: string }>,
    color: 'emerald' as const,
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
    Icon: ShoppingBag as React.FC<{ className?: string }>,
    color: 'indigo' as const,
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
    Icon: Landmark as React.FC<{ className?: string }>,
    color: 'purple' as const,
    items: [
      'Direct bank / payment processor proxy mode',
      'TypeScript & Python client SDKs',
      'Multi-region active-active failover',
      'SLA guarantee dashboard (99.99% uptime)',
      'Compliance audit log export (SOC2 ready)',
    ],
  },
];

const colorMap = {
  emerald: {
    icon: 'text-emerald-400',
    iconBg: 'bg-emerald-500/10 border-emerald-500/20',
    badge: 'bg-emerald-950/70 text-emerald-300 border-emerald-700/50',
    dot: 'bg-emerald-400',
    line: 'bg-emerald-800/40',
    bullet: 'text-emerald-400',
  },
  indigo: {
    icon: 'text-indigo-400',
    iconBg: 'bg-indigo-500/10 border-indigo-500/20',
    badge: 'bg-indigo-950/70 text-indigo-300 border-indigo-700/50',
    dot: 'bg-indigo-400',
    line: 'bg-indigo-800/40',
    bullet: 'text-indigo-400',
  },
  purple: {
    icon: 'text-purple-400',
    iconBg: 'bg-purple-500/10 border-purple-500/20',
    badge: 'bg-purple-950/70 text-purple-300 border-purple-700/50',
    dot: 'bg-purple-400',
    line: 'bg-purple-800/40',
    bullet: 'text-purple-400',
  },
};

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
      document.addEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'hidden';
    }
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = '';
    };
  }, [isOpen, handleKeyDown]);

  if (!isOpen) return null;

  return (
    <div
      className="modal-backdrop"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Production Roadmap"
    >
      <div
        className="modal-panel w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl border border-slate-700/60 bg-gradient-to-b from-slate-900 to-[#080c14] shadow-2xl shadow-black/60"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="flex items-start justify-between p-6 border-b border-slate-800/80">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-[11px] font-semibold tracking-widest text-slate-500 uppercase">
                FaultFlow
              </span>
              <ArrowRight className="w-3 h-3 text-slate-600" />
              <span className="text-[11px] font-semibold tracking-widest text-slate-500 uppercase">
                Production Roadmap
              </span>
            </div>
            <h2 className="text-xl font-bold text-white leading-tight">
              From Prototype → Production
            </h2>
            <p className="text-sm text-slate-400 mt-1 max-w-md leading-relaxed">
              Phase 1 is fully operational and live in this dashboard. Phases 2 & 3
              outline how this becomes a production-grade product with a team.
            </p>
          </div>
          <button
            onClick={onClose}
            id="roadmap-modal-close"
            className="mt-1 p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition flex-shrink-0"
            aria-label="Close roadmap"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Timeline */}
        <div className="p-6 space-y-0">
          {phases.map((phase, idx) => {
            const colors = colorMap[phase.color as keyof typeof colorMap];
            const isLast = idx === phases.length - 1;
            const PhaseIcon = phase.Icon;

            return (
              <div key={phase.id} className="relative flex gap-4">
                {/* Left — Icon + vertical line */}
                <div className="flex flex-col items-center flex-shrink-0">
                  <div
                    className={`w-10 h-10 rounded-xl border flex items-center justify-center ${colors.iconBg} z-10`}
                  >
                    <PhaseIcon className={`w-5 h-5 ${colors.icon}`} />
                  </div>
                  {!isLast && (
                    <div className={`timeline-line w-0.5 flex-1 mt-1 mb-1 min-h-[24px] ${colors.line}`} />
                  )}
                </div>

                {/* Right — Content */}
                <div className={`pb-8 flex-1 ${isLast ? 'pb-0' : ''}`}>
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <span
                      className={`text-[11px] font-bold tracking-wider px-2 py-0.5 rounded-full border ${colors.badge}`}
                    >
                      {phase.label}
                    </span>
                    {phase.status === 'done' ? (
                      <span className="flex items-center gap-1 text-[11px] text-emerald-400 font-semibold">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        Completed
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 text-[11px] text-slate-500 font-semibold">
                        <Circle className="w-3.5 h-3.5" />
                        Future Scope
                      </span>
                    )}
                  </div>

                  <h3
                    className={`text-base font-bold mb-0.5 ${
                      phase.status === 'done' ? 'text-white' : 'text-slate-400'
                    }`}
                  >
                    {phase.title}
                  </h3>
                  <p className="text-xs text-slate-500 mb-3">{phase.subtitle}</p>

                  <ul className="space-y-1.5">
                    {phase.items.map((item, i) => (
                      <li key={i} className="flex items-start gap-2 text-xs text-slate-400">
                        <span className={`mt-0.5 flex-shrink-0 ${colors.bullet}`}>›</span>
                        <span
                          className={
                            phase.status === 'done' ? 'text-slate-300' : 'text-slate-500'
                          }
                        >
                          {item}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-800/80 bg-slate-950/40 rounded-b-2xl flex items-center justify-between gap-4">
          <p className="text-xs text-slate-500 leading-relaxed max-w-sm">
            Built as a solo proof-of-concept. Phase 2 & 3 require a small product team
            and Shopify partner credentials.
          </p>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold transition flex-shrink-0"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
