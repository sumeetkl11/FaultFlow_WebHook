'use client';

import React, { useState, useEffect } from 'react';
import { ChaosConfig } from '../types';
import { api } from '../lib/api';
import { useTelemetryStore } from '../stores/useTelemetryStore';
import { Flame, Zap, ShieldAlert, Sliders, Play, Terminal, Server, Sparkles, CheckCircle2 } from 'lucide-react';

export const ChaosControlPanel: React.FC = () => {
  const [config, setConfig] = useState<ChaosConfig>({
    simulated_status: 200,
    artificial_delay_ms: 0,
    failure_rate_percent: 0,
  });
  const [trafficBlastCount, setTrafficBlastCount] = useState<number>(25);
  const [isBlasting, setIsBlasting] = useState<boolean>(false);
  const { chaosLogs, addChaosLog, addToast, audienceMode } = useTelemetryStore();
  const isBusiness = audienceMode === 'business';

  useEffect(() => {
    api.getChaosConfig()
      .then((res) => {
        if (res?.data) {
          setConfig(res.data);
        }
      })
      .catch(() => {});
  }, []);

  const handleUpdateConfig = async (newConfig: Partial<ChaosConfig>) => {
    const updated = { ...config, ...newConfig };
    setConfig(updated);
    try {
      await api.updateChaosConfig(updated);
      const isDown = updated.simulated_status !== 200;
      addChaosLog(`[CONFIG] Destination set to HTTP ${updated.simulated_status}, delay: ${updated.artificial_delay_ms}ms`);
      addToast({
        type: isDown ? 'warning' : 'success',
        title: isDown ? 'Destination Server Outage Simulated' : 'Destination Server Restored',
        message: isDown
          ? `Downstream server is now returning HTTP ${updated.simulated_status}. Incoming orders will trigger automatic shock absorption.`
          : 'Downstream server is healthy (HTTP 200 OK). Orders will deliver directly.',
      });
    } catch (err: any) {
      addChaosLog(`[ERROR] Failed to update chaos config: ${err.message}`);
    }
  };

  const handleFireBlast = async (count = trafficBlastCount) => {
    setIsBlasting(true);
    addChaosLog(`[BLAST] Initiating traffic burst of ${count} webhooks...`);
    addToast({
      type: 'info',
      title: isBusiness ? 'Simulating Sudden Spike' : 'Traffic Blast Enqueued',
      message: `Firing ${count} test transactions simultaneously into ingress pipeline...`,
    });

    let sent = 0;
    const promises: Promise<any>[] = [];

    for (let i = 0; i < count; i++) {
      promises.push(
        api.ingestEvent({
          target_url: 'http://localhost:4000/api/v1/chaos/sink',
          event_type: i % 2 === 0 ? 'order.checkout' : 'invoice.settled',
          payload: {
            blast_batch_id: `burst_${Date.now()}`,
            sequence: i + 1,
            customer: {
              email: `user_${i + 1}@store-demo.com`,
              name: `Demo Customer ${i + 1}`,
            },
            amount: 2500 + i * 150,
            currency: 'USD',
            timestamp: new Date().toISOString(),
          },
          max_retries: 3,
          timeout_ms: 4000,
        })
          .then(() => {
            sent++;
          })
          .catch((err) => {
            addChaosLog(`[WARN] Ingress dispatch dropped: ${err.message}`);
          })
      );
    }

    await Promise.allSettled(promises);
    setIsBlasting(false);
    addChaosLog(`[BLAST] Completed traffic burst: ${sent}/${count} events enqueued.`);
  };

  const isServerDown = config.simulated_status !== 200;

  return (
    <div className="glass-card rounded-2xl border border-slate-800/80 shadow-xl overflow-hidden flex flex-col h-full">
      {/* Header */}
      <div className="p-4 border-b border-slate-800/80 bg-slate-900/40 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div
            className={`p-2 rounded-xl transition ${
              isServerDown
                ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                : 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/20'
            }`}
          >
            <Flame className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-white tracking-tight flex items-center gap-2">
              Live Crash Test Sandbox
              <span className="text-[10px] px-1.5 py-0.2 rounded bg-indigo-500/10 text-indigo-300 border border-indigo-500/20 font-mono">
                The "Show, Don't Tell" Panel
              </span>
            </h2>
            <p className="text-[11px] text-slate-400">
              Break the server. Watch it recover.
            </p>
          </div>
        </div>

        {isServerDown && (
          <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-rose-950 text-rose-300 border border-rose-800 animate-pulse">
            OUTAGE ACTIVE
          </span>
        )}
      </div>

      <div className="p-4 space-y-5 flex-1 overflow-y-auto">
        {/* Onboarding hint box */}
        <div className="p-3 rounded-xl bg-slate-950/70 border border-slate-800 text-[11px] text-slate-300 leading-relaxed">
          <div className="flex items-center gap-1.5 font-semibold text-indigo-300 mb-1">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Interactive Demo:</span>
          </div>
          {isBusiness
            ? '1. Flip the switch below to "Server Down 500".\n2. Click "Send 25 Events". Watch FaultFlow catch each order, auto-retry with countdown, and preserve your data!'
            : 'Simulate downstream receiver failures to inspect exponential backoff with randomized jitter and DLQ remediation.'}
        </div>

        {/* 1. Destination Server Switch [Normal 200 OK vs Server Down 500] */}
        <div>
          <label className="text-xs font-semibold text-slate-300 uppercase tracking-wider block mb-1">
            Target Server Health
          </label>
          <p className="text-[11px] text-slate-500 mb-2">Set the target server&apos;s response. 500 = crash, 429 = overloaded.</p>

          {/* Primary Two-Way Switch */}
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() =>
                handleUpdateConfig({
                  simulated_status: 200,
                  failure_rate_percent: 0,
                })
              }
              className={`py-2 px-3 rounded-xl text-xs font-semibold border transition flex items-center justify-center gap-2 ${
                config.simulated_status === 200
                  ? 'bg-emerald-950/60 border-emerald-500 text-emerald-300 shadow-md shadow-emerald-950/50'
                  : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:bg-slate-900'
              }`}
            >
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
              <span>Normal (200 OK)</span>
            </button>

            <button
              onClick={() =>
                handleUpdateConfig({
                  simulated_status: 500,
                  failure_rate_percent: 100,
                })
              }
              className={`py-2 px-3 rounded-xl text-xs font-semibold border transition flex items-center justify-center gap-2 ${
                config.simulated_status === 500
                  ? 'bg-rose-950/70 border-rose-500 text-rose-300 shadow-md shadow-rose-950/50'
                  : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:bg-slate-900'
              }`}
            >
              <Server className="w-3.5 h-3.5 text-rose-400" />
              <span>Server Down (500)</span>
            </button>
          </div>

          {/* Additional status options */}
          <div className="grid grid-cols-2 gap-2 mt-2">
            <button
              onClick={() =>
                handleUpdateConfig({
                  simulated_status: 429,
                  failure_rate_percent: 100,
                })
              }
              className={`py-1.5 px-2.5 rounded-lg text-[11px] font-medium border transition text-center ${
                config.simulated_status === 429
                  ? 'bg-amber-950/60 border-amber-500 text-amber-300'
                  : 'bg-slate-950/40 border-slate-800/80 text-slate-400 hover:bg-slate-900'
              }`}
            >
              429 Rate Limited
            </button>
            <button
              onClick={() =>
                handleUpdateConfig({
                  simulated_status: 504,
                  failure_rate_percent: 100,
                })
              }
              className={`py-1.5 px-2.5 rounded-lg text-[11px] font-medium border transition text-center ${
                config.simulated_status === 504
                  ? 'bg-purple-950/60 border-purple-500 text-purple-300'
                  : 'bg-slate-950/40 border-slate-800/80 text-slate-400 hover:bg-slate-900'
              }`}
            >
              504 Gateway Timeout
            </button>
          </div>
        </div>

        {/* 2. Latency Slider */}
        <div className="border-t border-slate-800/80 pt-4">
          <div className="flex justify-between items-center mb-1.5">
            <label className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
              Artificial Latency Injection
            </label>
            <span className="text-xs font-mono text-indigo-300 font-bold">
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
            className="w-full accent-indigo-500 bg-slate-800 rounded-lg h-1.5 cursor-pointer"
          />
          <div className="flex justify-between text-[10px] text-slate-500 mt-1 font-mono">
            <span>Instant (0ms)</span>
            <span>1500ms</span>
            <span>Slow (3000ms)</span>
          </div>
        </div>

        {/* 3. Blast Traffic Button [Send 25 events] */}
        <div className="border-t border-slate-800/80 pt-4">
          <div className="flex justify-between items-center mb-2">
            <div>
              <label className="text-xs font-semibold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                <Zap className="w-3.5 h-3.5 text-amber-400" />
                Simulate Traffic Burst
              </label>
              <p className="text-[11px] text-slate-500 mt-0.5">Blast webhooks and watch delivery, retry &amp; DLQ stats update live.</p>
            </div>

            {/* Quick count buttons */}
            <div className="flex items-center gap-1">
              {[10, 25, 50].map((num) => (
                <button
                  key={num}
                  onClick={() => setTrafficBlastCount(num)}
                  className={`px-2 py-0.5 rounded text-[10px] font-mono font-semibold transition ${
                    trafficBlastCount === num
                      ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                      : 'bg-slate-900 text-slate-400 hover:text-white'
                  }`}
                >
                  {num}
                </button>
              ))}
            </div>
          </div>

          <button
            onClick={() => handleFireBlast(trafficBlastCount)}
            disabled={isBlasting}
            className="w-full py-2.5 px-4 rounded-xl bg-gradient-to-r from-amber-600 via-orange-600 to-amber-600 hover:from-amber-500 hover:to-orange-500 text-white font-semibold text-xs flex items-center justify-center gap-2 shadow-lg shadow-amber-950/50 disabled:opacity-50 disabled:cursor-not-allowed transition"
          >
            <Play className={`w-3.5 h-3.5 fill-current ${isBlasting ? 'animate-spin' : ''}`} />
            {isBlasting ? 'SIMULATING TRAFFIC...' : `SIMULATE TRAFFIC (${trafficBlastCount} WEBHOOKS)`}
          </button>
        </div>

        {/* 4. Live Activity Feed */}
        <div className="border-t border-slate-800/80 pt-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
              <Terminal className="w-3.5 h-3.5 text-slate-500" />
              {isBusiness ? 'Live Simulation Feed' : 'Live Output Feed'}
            </span>
            <span className="text-[10px] text-indigo-400 font-mono flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-pulse" />
              Active
            </span>
          </div>
          <div className="bg-slate-950 border border-slate-900 rounded-xl p-3 h-32 overflow-y-auto text-[11px] font-mono text-slate-400 space-y-1">
            {chaosLogs.length === 0 ? (
              <div className="text-slate-600 italic">No events logged yet. Click "Send 25 Events" above.</div>
            ) : (
              chaosLogs.map((log, idx) => (
                <div key={idx} className="leading-tight text-slate-300">
                  <span className="text-indigo-400">›</span> {log}
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
