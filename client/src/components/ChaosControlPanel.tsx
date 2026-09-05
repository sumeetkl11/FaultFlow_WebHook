import React, { useState, useEffect } from 'react';
import { ChaosConfig } from '../types';
import { api } from '../lib/api';
import { useTelemetryStore } from '../stores/useTelemetryStore';
import { Flame, Zap, ShieldAlert, Sliders, Play, Terminal } from 'lucide-react';

export const ChaosControlPanel: React.FC = () => {
  const [config, setConfig] = useState<ChaosConfig>({
    simulated_status: 200,
    artificial_delay_ms: 0,
    failure_rate_percent: 0,
  });
  const [trafficBlastCount, setTrafficBlastCount] = useState<number>(50);
  const [isBlasting, setIsBlasting] = useState<boolean>(false);
  const { chaosLogs, addChaosLog } = useTelemetryStore();

  useEffect(() => {
    api.getChaosConfig().then((res) => {
      if (res?.data) {
        setConfig(res.data);
      }
    }).catch(() => {});
  }, []);

  const handleUpdateConfig = async (newConfig: Partial<ChaosConfig>) => {
    const updated = { ...config, ...newConfig };
    setConfig(updated);
    try {
      await api.updateChaosConfig(updated);
      addChaosLog(`[CONFIG] Destination set to HTTP ${updated.simulated_status}, delay: ${updated.artificial_delay_ms}ms, failure: ${updated.failure_rate_percent}%`);
    } catch (err: any) {
      addChaosLog(`[ERROR] Failed to update chaos config: ${err.message}`);
    }
  };

  const handleFireBlast = async () => {
    setIsBlasting(true);
    addChaosLog(`[BLAST] Initiating traffic burst of ${trafficBlastCount} webhooks...`);

    let sent = 0;
    const promises: Promise<any>[] = [];

    for (let i = 0; i < trafficBlastCount; i++) {
      promises.push(
        api.ingestEvent({
          target_url: 'http://localhost:4000/api/v1/chaos/sink',
          event_type: i % 2 === 0 ? 'order.checkout' : 'invoice.settled',
          payload: {
            blast_batch_id: `burst_${Date.now()}`,
            sequence: i + 1,
            timestamp: new Date().toISOString(),
          },
          max_retries: 3,
          timeout_ms: 4000,
        }).then(() => {
          sent++;
        }).catch((err) => {
          addChaosLog(`[WARN] Ingress dispatch dropped: ${err.message}`);
        })
      );
    }

    await Promise.allSettled(promises);
    setIsBlasting(false);
    addChaosLog(`[BLAST] Completed traffic burst: ${sent}/${trafficBlastCount} events enqueued.`);
  };

  const isChaosActive = config.simulated_status !== 200 || config.failure_rate_percent > 0 || config.artificial_delay_ms > 0;

  return (
    <div className="glass-card rounded-xl border border-slate-800/80 shadow-xl overflow-hidden flex flex-col h-full">
      {/* Header */}
      <div className="p-4 border-b border-slate-800/80 bg-slate-900/40 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className={`p-1.5 rounded-lg ${isChaosActive ? 'bg-rose-500/20 text-rose-400' : 'bg-slate-800 text-slate-400'}`}>
            <Flame className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-base font-semibold text-white">Chaos Testing Sandbox</h2>
            <p className="text-xs text-slate-400">Simulate downstream failures & traffic spikes</p>
          </div>
        </div>

        {isChaosActive && (
          <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-rose-950/80 text-rose-300 border border-rose-800 animate-pulse">
            Active Failure
          </span>
        )}
      </div>

      <div className="p-4 space-y-5 flex-1 overflow-y-auto">
        {/* 1. Destination Health Toggle */}
        <div>
          <label className="text-xs font-semibold text-slate-300 uppercase tracking-wider block mb-2">
            Destination Endpoint Health
          </label>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {[
              { status: 200, label: '200 OK', color: 'hover:border-emerald-500 text-emerald-400' },
              { status: 500, label: '500 Server Err', color: 'hover:border-rose-500 text-rose-400' },
              { status: 429, label: '429 Rate Limit', color: 'hover:border-amber-500 text-amber-400' },
              { status: 504, label: '504 Timeout', color: 'hover:border-purple-500 text-purple-400' },
            ].map((btn) => {
              const active = config.simulated_status === btn.status && (btn.status === 200 || config.failure_rate_percent > 0);
              return (
                <button
                  key={btn.status}
                  onClick={() =>
                    handleUpdateConfig({
                      simulated_status: btn.status as any,
                      failure_rate_percent: btn.status === 200 ? 0 : 100,
                    })
                  }
                  className={`px-3 py-2 rounded-lg text-xs font-semibold border transition text-center ${
                    active
                      ? 'bg-slate-800 border-indigo-500 text-white shadow-md'
                      : 'bg-slate-950/60 border-slate-800/80 text-slate-400 hover:bg-slate-900'
                  } ${btn.color}`}
                >
                  {btn.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* 2. Artificial Latency Slider */}
        <div>
          <div className="flex justify-between items-center mb-1.5">
            <label className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
              Artificial Latency Injection
            </label>
            <span className="text-xs font-mono text-indigo-300 font-bold">
              {config.artificial_delay_ms}ms
            </span>
          </div>
          <input
            type="range"
            min={0}
            max={5000}
            step={250}
            value={config.artificial_delay_ms}
            onChange={(e) => handleUpdateConfig({ artificial_delay_ms: parseInt(e.target.value, 10) })}
            className="w-full accent-indigo-500 bg-slate-800 rounded-lg h-1.5 cursor-pointer"
          />
          <div className="flex justify-between text-[10px] text-slate-500 mt-1 font-mono">
            <span>0ms</span>
            <span>2500ms</span>
            <span>5000ms</span>
          </div>
        </div>

        {/* 3. Traffic Blast Generator */}
        <div className="border-t border-slate-800/80 pt-4">
          <div className="flex justify-between items-center mb-1.5">
            <label className="text-xs font-semibold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
              <Zap className="w-3.5 h-3.5 text-amber-400" />
              Traffic Blast Ingress
            </label>
            <span className="text-xs font-mono text-amber-400 font-bold">
              {trafficBlastCount} webhooks
            </span>
          </div>
          <input
            type="range"
            min={10}
            max={250}
            step={10}
            value={trafficBlastCount}
            onChange={(e) => setTrafficBlastCount(parseInt(e.target.value, 10))}
            className="w-full accent-amber-500 bg-slate-800 rounded-lg h-1.5 cursor-pointer"
          />
          <div className="flex justify-between text-[10px] text-slate-500 mt-1 font-mono">
            <span>10 req</span>
            <span>125 req</span>
            <span>250 req</span>
          </div>

          <button
            onClick={handleFireBlast}
            disabled={isBlasting}
            className="mt-3 w-full py-2.5 px-4 rounded-lg bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500 text-white font-semibold text-xs flex items-center justify-center gap-2 shadow-lg shadow-amber-900/30 disabled:opacity-50 disabled:cursor-not-allowed transition"
          >
            <Play className={`w-3.5 h-3.5 fill-current ${isBlasting ? 'animate-spin' : ''}`} />
            {isBlasting ? 'BLASTING TRAFFIC...' : `FIRE BLAST (${trafficBlastCount} EVENTS)`}
          </button>
        </div>

        {/* 4. Live Chaos Output Console */}
        <div className="border-t border-slate-800/80 pt-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
              <Terminal className="w-3.5 h-3.5 text-slate-500" />
              Live Output Feed
            </span>
            <span className="text-[10px] text-slate-500 font-mono">Streaming</span>
          </div>
          <div className="bg-slate-950 border border-slate-900 rounded-lg p-3 h-36 overflow-y-auto text-[11px] font-mono text-slate-400 space-y-1">
            {chaosLogs.length === 0 ? (
              <div className="text-slate-600 italic">No output events logged yet. Adjust settings or fire a blast.</div>
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
