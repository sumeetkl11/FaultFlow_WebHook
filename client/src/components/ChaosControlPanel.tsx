'use client';

import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { ChaosConfig } from '../types';
import { api } from '../lib/api';
import { useTelemetryStore } from '../stores/useTelemetryStore';
import { Play, Server, CheckCircle2, Zap, Terminal } from 'lucide-react';

/* ── Inline toolbar button ─────────────────────────────────────────────── */
function ToolbarButton({
  id,
  onClick,
  disabled,
  variant = 'default',
  active = false,
  children,
  title,
}: {
  id?: string;
  onClick: () => void;
  disabled?: boolean;
  variant?: 'default' | 'danger' | 'success' | 'warning';
  active?: boolean;
  children: React.ReactNode;
  title?: string;
}) {
  const baseClass =
    'inline-flex items-center gap-1.5 px-2.5 py-1 rounded text-[11px] font-mono font-medium border transition-colors disabled:opacity-40 disabled:cursor-not-allowed';

  const variantClasses: Record<'default' | 'danger' | 'success' | 'warning', string> = {
    default: active
      ? 'bg-zinc-700 border-zinc-600 text-zinc-100'
      : 'bg-zinc-900 border-zinc-700 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200 hover:border-zinc-600',
    danger: active
      ? 'bg-rose-950/80 border-rose-700 text-rose-300'
      : 'bg-zinc-900 border-zinc-700 text-rose-400/70 hover:bg-rose-950/60 hover:border-rose-800 hover:text-rose-300',
    success: active
      ? 'bg-emerald-950/80 border-emerald-700 text-emerald-300'
      : 'bg-zinc-900 border-zinc-700 text-emerald-400/70 hover:bg-emerald-950/60 hover:border-emerald-800 hover:text-emerald-300',
    warning: active
      ? 'bg-amber-950/80 border-amber-700 text-amber-300'
      : 'bg-zinc-900 border-zinc-700 text-amber-400/70 hover:bg-amber-950/60 hover:border-amber-800 hover:text-amber-300',
  };
  const variantClass = variantClasses[variant];

  return (
    <motion.button
      id={id}
      whileTap={{ scale: 0.97 }}
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={`${baseClass} ${variantClass}`}
    >
      {children}
    </motion.button>
  );
}

export const ChaosControlPanel: React.FC = () => {
  const [config, setConfig] = useState<ChaosConfig>({
    simulated_status: 200,
    artificial_delay_ms: 0,
    failure_rate_percent: 0,
  });
  const [blastCount, setBlastCount] = useState<number>(25);
  const [isBlasting, setIsBlasting] = useState<boolean>(false);
  const chaosLogs = useTelemetryStore(s => s.chaosLogs);
  const addChaosLog = useTelemetryStore(s => s.addChaosLog);
  const addToast = useTelemetryStore(s => s.addToast);
  const audienceMode = useTelemetryStore(s => s.audienceMode);
  const isBusiness = audienceMode === 'business';

  useEffect(() => {
    api.getChaosConfig()
      .then((res) => { if (res?.data) setConfig(res.data); })
      .catch(() => {});
  }, []);

  const handleUpdateConfig = async (newConfig: Partial<ChaosConfig>) => {
    const updated = { ...config, ...newConfig };
    setConfig(updated);
    try {
      await api.updateChaosConfig(updated);
      const isDown = updated.simulated_status !== 200;
      addChaosLog(`[CONFIG] HTTP ${updated.simulated_status} · delay ${updated.artificial_delay_ms}ms`);
      addToast({
        type: isDown ? 'warning' : 'success',
        title: isDown ? `Destination → HTTP ${updated.simulated_status}` : 'Destination Restored (200 OK)',
        message: isDown
          ? 'Incoming events will queue and retry automatically.'
          : 'Downstream server healthy. Events will deliver directly.',
      });
    } catch (err: unknown) {
      addChaosLog(`[ERROR] Config update failed: ${err instanceof Error ? err.message : String(err)}`);
    }
  };

  const handleFireBlast = async (count = blastCount) => {
    setIsBlasting(true);
    addChaosLog(`[BLAST] Firing ${count} webhooks…`);
    addToast({
      type: 'info',
      title: `Traffic Blast: ${count} events`,
      message: 'Injecting into ingress pipeline.',
    });

    let sent = 0;
    const promises: Promise<unknown>[] = [];
    for (let i = 0; i < count; i++) {
      promises.push(
        api.ingestEvent({
          target_url: 'http://localhost:4000/api/v1/chaos/sink',
          event_type: i % 2 === 0 ? 'order.checkout' : 'invoice.settled',
          payload: {
            blast_batch_id: `burst_${Date.now()}`,
            sequence: i + 1,
            customer: { email: `user_${i + 1}@store-demo.com`, name: `Demo Customer ${i + 1}` },
            amount: 2500 + i * 150,
            currency: 'USD',
            timestamp: new Date().toISOString(),
          },
          max_retries: 3,
          timeout_ms: 4000,
        })
          .then(() => { sent++; })
          .catch((err) => { addChaosLog(`[WARN] Dropped: ${err.message}`); })
      );
    }
    await Promise.allSettled(promises);
    setIsBlasting(false);
    addChaosLog(`[BLAST] Completed: ${sent}/${count} enqueued.`);
  };

  const isDown = config.simulated_status !== 200;

  return (
    <div id="live-sandbox-panel" className="bg-zinc-900 border border-zinc-800 rounded-md overflow-hidden flex flex-col h-full">

      {/* ── Panel header ──────────────────────────────────────────────── */}
      <div className="h-9 px-3 border-b border-zinc-800 flex items-center justify-between flex-shrink-0">
        <span className="text-[11px] font-mono uppercase tracking-wider text-zinc-400 flex items-center gap-1.5">
          <Server className="w-3.5 h-3.5" />
          Chaos Sandbox
        </span>
        {isDown && (
          <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-rose-950/70 border border-rose-800/60 text-rose-400 tabular-nums">
            HTTP {config.simulated_status} ACTIVE
          </span>
        )}
      </div>

      {/* ── Inline primary action toolbar ─────────────────────────────── */}
      <div className="px-3 py-2 border-b border-zinc-800/60 flex flex-wrap items-center gap-1.5 flex-shrink-0">
        {/* Blast button */}
        <motion.button
          whileTap={{ scale: 0.97 }}
          id="btn-simulate-traffic"
          onClick={() => handleFireBlast(blastCount)}
          disabled={isBlasting}
          title="Fire burst of events into ingress pipeline"
          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-amber-600 hover:bg-amber-500 text-white text-[11px] font-mono font-semibold border border-amber-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Play className={`w-3 h-3 fill-current ${isBlasting ? 'animate-pulse' : ''}`} />
          {isBlasting ? 'Blasting…' : `Blast ${blastCount}`}
        </motion.button>

        {/* Blast count selector */}
        <div className="flex items-center gap-1">
          {[10, 25, 50].map((n) => (
            <ToolbarButton
              key={n}
              onClick={() => setBlastCount(n)}
              active={blastCount === n}
              variant="warning"
            >
              {n}
            </ToolbarButton>
          ))}
        </div>

        {/* Server status toggles */}
        <div className="w-px h-4 bg-zinc-700 mx-0.5" />

        <ToolbarButton
          onClick={() => handleUpdateConfig({ simulated_status: 200, failure_rate_percent: 0 })}
          active={config.simulated_status === 200}
          variant="success"
          title="Restore destination server"
        >
          <CheckCircle2 className="w-3 h-3" />
          200
        </ToolbarButton>

        <ToolbarButton
          id="btn-crash-target-server"
          onClick={() => handleUpdateConfig({ simulated_status: 500, failure_rate_percent: 100 })}
          active={config.simulated_status === 500}
          variant="danger"
          title="Simulate 500 Internal Server Error"
        >
          500
        </ToolbarButton>

        <ToolbarButton
          onClick={() => handleUpdateConfig({ simulated_status: 429, failure_rate_percent: 100 })}
          active={config.simulated_status === 429}
          variant="warning"
          title="Simulate 429 Rate Limited"
        >
          429
        </ToolbarButton>

        <ToolbarButton
          onClick={() => handleUpdateConfig({ simulated_status: 504, failure_rate_percent: 100 })}
          active={config.simulated_status === 504}
          variant="danger"
          title="Simulate 504 Gateway Timeout"
        >
          504
        </ToolbarButton>
      </div>

      {/* ── Body ─────────────────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto p-3 space-y-4">

        {/* Latency slider */}
        <div>
          <div className="flex justify-between items-center mb-1.5">
            <label className="text-[11px] font-mono uppercase tracking-wider text-zinc-500">
              Artificial Latency
            </label>
            <span className="text-[11px] font-mono tabular-nums text-zinc-300">
              {config.artificial_delay_ms}ms
            </span>
          </div>
          <input
            type="range"
            min={0}
            max={3000}
            step={250}
            value={config.artificial_delay_ms}
            onChange={(e) => handleUpdateConfig({ artificial_delay_ms: parseInt(e.target.value, 10) })}
            className="w-full h-1.5 bg-zinc-800 rounded cursor-pointer accent-amber-500"
          />
          <div className="flex justify-between text-[10px] text-zinc-600 mt-1 font-mono">
            <span>0ms</span>
            <span>1500ms</span>
            <span>3000ms</span>
          </div>
        </div>

        {/* Current config status row */}
        <div className="flex items-center gap-2 p-2 rounded bg-zinc-950 border border-zinc-800">
          <Zap className="w-3.5 h-3.5 text-zinc-500 flex-shrink-0" />
          <div className="text-[11px] font-mono text-zinc-400 space-x-2">
            <span>Status: <strong className={isDown ? 'text-rose-400' : 'text-emerald-400'}>HTTP {config.simulated_status}</strong></span>
            <span>·</span>
            <span>Delay: <strong className="text-zinc-200">{config.artificial_delay_ms}ms</strong></span>
            <span>·</span>
            <span>Fail: <strong className="text-zinc-200">{config.failure_rate_percent}%</strong></span>
          </div>
        </div>

        {/* Live Output Feed */}
        <div className="border-t border-zinc-800/60 pt-3">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[11px] font-mono uppercase tracking-wider text-zinc-500 flex items-center gap-1.5">
              <Terminal className="w-3 h-3" />
              {isBusiness ? 'Simulation Feed' : 'Output Feed'}
            </span>
            <span className="flex items-center gap-1 text-[10px] font-mono text-zinc-600">
              <span className="w-1.5 h-1.5 rounded-full bg-zinc-600 sse-dot" />
              live
            </span>
          </div>
          <div className="bg-zinc-950 border border-zinc-800 rounded p-2 h-40 overflow-y-auto space-y-0.5">
            {chaosLogs.length === 0 ? (
              <div className="text-zinc-600 italic text-[11px] font-mono">
                Awaiting activity…
              </div>
            ) : (
              chaosLogs.map((log, idx) => (
                <div key={idx} className="text-[11px] font-mono text-zinc-400 leading-tight">
                  <span className="text-zinc-600">›</span> {log}
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
