import React, { useState, useEffect } from 'react';
import { DLQItem } from '../types';
import { api } from '../lib/api';
import { useTelemetryStore } from '../stores/useTelemetryStore';
import { X, RotateCw, AlertOctagon, CheckCircle2, ShieldAlert } from 'lucide-react';

interface DLQReplayModalProps {
  isOpen: boolean;
  onClose: () => void;
  onReplaySuccess: () => void;
}

export const DLQReplayModal: React.FC<DLQReplayModalProps> = ({
  isOpen,
  onClose,
  onReplaySuccess,
}) => {
  const [items, setItems] = useState<DLQItem[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [replaying, setReplaying] = useState<boolean>(false);
  const [mode, setMode] = useState<'BATCH_ALL' | 'SELECTIVE'>('BATCH_ALL');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [replayResult, setReplayResult] = useState<string | null>(null);
  const { addChaosLog } = useTelemetryStore();

  useEffect(() => {
    if (isOpen) {
      setLoading(true);
      setReplayResult(null);
      api.getDlqEvents(50)
        .then((res) => {
          if (res?.data) {
            setItems(res.data);
            setSelectedIds(res.data.map((i) => i.event_id));
          }
        })
        .catch((err) => console.error('Failed to load DLQ items:', err))
        .finally(() => setLoading(false));
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleToggleSelect = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  };

  const handleExecuteReplay = async () => {
    setReplaying(true);
    setReplayResult(null);
    try {
      const res = await api.replayDlq(
        mode,
        mode === 'SELECTIVE' ? selectedIds : undefined
      );

      setReplayResult(
        `Successfully scheduled ${res.data.replayed_count} jobs for replay (rate throttled <= ${res.data.throttle_rate_per_sec} req/s).`
      );
      addChaosLog(`[DLQ REPLAY] Initiated replay of ${res.data.replayed_count} dead-lettered events`);
      onReplaySuccess();

      setTimeout(() => {
        onClose();
      }, 1500);
    } catch (err: any) {
      setReplayResult(`Error: ${err.message}`);
    } finally {
      setReplaying(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div
        className="w-full max-w-2xl bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-5 border-b border-slate-800 bg-slate-950/60 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-rose-500/10 text-rose-400 border border-rose-500/20">
              <AlertOctagon className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-white">
                Dead-Letter Queue (DLQ) Remediation
              </h3>
              <p className="text-xs text-slate-400">
                Throttled mass re-enqueueing with thundering herd prevention
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-5">
          {/* Rate Throttle Banner */}
          <div className="p-3.5 rounded-xl bg-indigo-950/40 border border-indigo-800/40 flex items-center justify-between text-xs text-indigo-300">
            <span className="flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 text-indigo-400" />
              Token-Bucket Ingestion Ceiling:
            </span>
            <strong className="font-mono bg-indigo-900/60 px-2 py-0.5 rounded border border-indigo-700/60">
              50 req/sec MAX
            </strong>
          </div>

          {/* Mode Selector */}
          <div>
            <label className="text-xs font-semibold text-slate-300 uppercase tracking-wider block mb-2">
              Replay Execution Mode
            </label>
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => setMode('BATCH_ALL')}
                className={`py-2.5 px-4 rounded-xl text-xs font-semibold border transition text-center ${
                  mode === 'BATCH_ALL'
                    ? 'bg-indigo-600/20 border-indigo-500 text-white shadow-lg'
                    : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:bg-slate-850'
                }`}
              >
                Replay All ({items.length} Jobs)
              </button>
              <button
                onClick={() => setMode('SELECTIVE')}
                className={`py-2.5 px-4 rounded-xl text-xs font-semibold border transition text-center ${
                  mode === 'SELECTIVE'
                    ? 'bg-indigo-600/20 border-indigo-500 text-white shadow-lg'
                    : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:bg-slate-850'
                }`}
              >
                Selective Replay ({selectedIds.length} Selected)
              </button>
            </div>
          </div>

          {/* Items List */}
          <div>
            <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
              Failed Jobs Backlog
            </div>
            <div className="border border-slate-800 rounded-xl overflow-hidden max-h-56 overflow-y-auto bg-slate-950/80 divide-y divide-slate-850">
              {loading ? (
                <div className="p-6 text-center text-xs text-slate-500">
                  Loading dead-letter backlog...
                </div>
              ) : items.length === 0 ? (
                <div className="p-6 text-center text-xs text-slate-500">
                  Dead-Letter Queue is empty. No failed jobs require remediation.
                </div>
              ) : (
                items.map((item) => (
                  <div
                    key={item.dlq_id}
                    onClick={() => mode === 'SELECTIVE' && handleToggleSelect(item.event_id)}
                    className={`p-3 text-xs flex items-center justify-between gap-3 ${
                      mode === 'SELECTIVE' ? 'cursor-pointer hover:bg-slate-900/60' : ''
                    }`}
                  >
                    <div className="flex items-center gap-2.5 truncate">
                      {mode === 'SELECTIVE' && (
                        <input
                          type="checkbox"
                          checked={selectedIds.includes(item.event_id)}
                          onChange={() => handleToggleSelect(item.event_id)}
                          className="accent-indigo-500 rounded"
                        />
                      )}
                      <div>
                        <div className="font-mono text-slate-200 font-medium">
                          {item.event_id}
                        </div>
                        <div className="text-[11px] text-slate-500 truncate max-w-sm">
                          {item.target_url} • {item.error_message || 'Exhausted retries'}
                        </div>
                      </div>
                    </div>
                    <span className="px-2 py-0.5 rounded bg-rose-950/70 text-rose-300 border border-rose-800/60 text-[11px] font-mono shrink-0">
                      {item.retry_count} retries
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>

          {replayResult && (
            <div className="p-3 rounded-xl bg-emerald-950/60 border border-emerald-800 text-xs text-emerald-300 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
              <span>{replayResult}</span>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-800 bg-slate-950/60 flex items-center justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg text-xs font-semibold text-slate-400 hover:text-white transition"
          >
            Cancel
          </button>
          <button
            onClick={handleExecuteReplay}
            disabled={replaying || items.length === 0 || (mode === 'SELECTIVE' && selectedIds.length === 0)}
            className="px-5 py-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold flex items-center gap-2 shadow-lg shadow-indigo-900/30 disabled:opacity-50 disabled:cursor-not-allowed transition"
          >
            <RotateCw className={`w-3.5 h-3.5 ${replaying ? 'animate-spin' : ''}`} />
            {replaying ? 'Replaying...' : 'Execute Throttled Replay'}
          </button>
        </div>
      </div>
    </div>
  );
};
