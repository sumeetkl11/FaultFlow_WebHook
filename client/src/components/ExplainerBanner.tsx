'use client';

import React from 'react';
import { useTelemetryStore } from '../stores/useTelemetryStore';
import {
  ShieldAlert,
  ShieldCheck,
  Zap,
  ArrowRight,
  ChevronUp,
  ChevronDown,
  Info,
  Sparkles,
  Server,
  Layers,
  CheckCircle2,
} from 'lucide-react';

export const ExplainerBanner: React.FC = () => {
  const { audienceMode, bannerCollapsed, toggleBanner } = useTelemetryStore();

  if (bannerCollapsed) {
    return (
      <div className="w-full bg-slate-900/60 border border-slate-800/80 rounded-xl px-4 py-2 flex items-center justify-between transition backdrop-blur-md">
        <div className="flex items-center gap-2.5 text-xs text-slate-300">
          <span className="p-1 rounded-md bg-indigo-500/20 text-indigo-400">
            <Info className="w-3.5 h-3.5" />
          </span>
          <span>
            <strong>Prototype Guide:</strong> Automated Webhook Shock-Absorber & Zero-Loss Middleware.
          </span>
        </div>
        <button
          onClick={toggleBanner}
          className="text-xs text-indigo-400 hover:text-indigo-300 flex items-center gap-1 font-medium transition"
        >
          <span>Expand Guide</span>
          <ChevronDown className="w-3.5 h-3.5" />
        </button>
      </div>
    );
  }

  return (
    <div className="w-full relative overflow-hidden rounded-2xl border border-indigo-500/30 bg-gradient-to-r from-slate-950 via-slate-900 to-indigo-950/40 p-5 shadow-xl backdrop-blur-md transition">
      {/* Background ambient glow */}
      <div className="absolute -right-16 -top-16 w-64 h-64 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -left-16 -bottom-16 w-64 h-64 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />

      {/* Header bar of the banner */}
      <div className="flex items-start justify-between gap-4 relative z-10">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-xl bg-gradient-to-br from-indigo-500/20 to-cyan-500/20 text-indigo-300 border border-indigo-500/30">
            <Sparkles className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-bold text-white tracking-tight">
                {audienceMode === 'business'
                  ? 'How FaultFlow Protects Your Business Revenue'
                  : 'Architecture Showcase: Zero-Touch Asynchronous Task & Webhook Shock-Absorber'}
              </h3>
              <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                ACTIVE PROTECTION
              </span>
            </div>
            <p className="text-xs text-slate-300 mt-0.5 max-w-2xl">
              {audienceMode === 'business'
                ? 'FaultFlow sits as invisible infrastructure between your checkout and destination servers. When external servers crash or glitch, FaultFlow catches and holds the orders so zero sales are lost.'
                : 'Sub-25ms ingress gateway backed by atomic Redis SETNX idempotency, BullMQ worker clusters with HMAC-SHA256 signatures, jittered exponential backoff, and DLQ remediation.'}
            </p>
          </div>
        </div>

        <button
          onClick={toggleBanner}
          className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800/60 transition"
          title="Collapse guide"
        >
          <ChevronUp className="w-4 h-4" />
        </button>
      </div>

      {/* Visual Context Pipeline Diagram */}
      <div className="mt-4 pt-4 border-t border-slate-800/80 grid grid-cols-1 md:grid-cols-3 gap-3 relative z-10 text-xs">
        {/* Step 1 */}
        <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800/70 flex items-start gap-2.5">
          <div className="p-1.5 rounded-lg bg-rose-500/10 text-rose-400 mt-0.5">
            <Server className="w-4 h-4" />
          </div>
          <div>
            <strong className="text-slate-100 block font-semibold">
              {audienceMode === 'business' ? '1. Server Outage' : '1. Downstream 500/Timeout'}
            </strong>
            <span className="text-slate-400 text-[11px] leading-relaxed">
              {audienceMode === 'business'
                ? 'Shopify, Stripe, or your internal API experiences temporary downtime.'
                : 'Target HTTP server throws 500, 504, or network timeout (>5000ms).'}
            </span>
          </div>
        </div>

        {/* Step 2 */}
        <div className="p-3 rounded-xl bg-indigo-950/40 border border-indigo-800/40 flex items-start gap-2.5">
          <div className="p-1.5 rounded-lg bg-indigo-500/20 text-indigo-400 mt-0.5">
            <ShieldCheck className="w-4 h-4" />
          </div>
          <div>
            <strong className="text-indigo-200 block font-semibold">
              {audienceMode === 'business' ? '2. Data Shock-Absorbed' : '2. BullMQ Jitter Backoff'}
            </strong>
            <span className="text-indigo-300/80 text-[11px] leading-relaxed">
              {audienceMode === 'business'
                ? 'Orders are safely queued in memory. Double orders are automatically blocked.'
                : 'Atomic SETNX deduplicates; exponential backoff retries (5s, 30s, 2m, 15m) with +/-15% jitter.'}
            </span>
          </div>
        </div>

        {/* Step 3 */}
        <div className="p-3 rounded-xl bg-emerald-950/40 border border-emerald-800/40 flex items-start gap-2.5">
          <div className="p-1.5 rounded-lg bg-emerald-500/20 text-emerald-400 mt-0.5">
            <CheckCircle2 className="w-4 h-4" />
          </div>
          <div>
            <strong className="text-emerald-200 block font-semibold">
              {audienceMode === 'business' ? '3. Zero Lost Transactions' : '3. Self-Healing Delivery'}
            </strong>
            <span className="text-emerald-300/80 text-[11px] leading-relaxed">
              {audienceMode === 'business'
                ? 'When your server wakes up, all transactions deliver seamlessly with 100% accuracy.'
                : 'Cryptographically signed delivery completes; fallback to rate-limited (50 rps) DLQ remediation.'}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
