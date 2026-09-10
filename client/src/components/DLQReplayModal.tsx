'use client';

import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { DLQItem } from '../types';
import { api } from '../lib/api';
import { useTelemetryStore } from '../stores/useTelemetryStore';
import { X, RotateCw, AlertOctagon, CheckCircle2, ShieldAlert, CheckSquare, Square } from 'lucide-react';

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

  const events = useTelemetryStore(s => s.events);
  const activeQueue = useTelemetryStore(s => s.activeQueue);
  const dlqCount = useTelemetryStore(s => s.dlqCount);
  const optimisticReplay = useTelemetryStore(s => s.optimisticReplay);
  const rollbackEvents = useTelemetryStore(s => s.rollbackEvents);
  const addChaosLog = useTelemetryStore(s => s.addChaosLog);
  const addToast = useTelemetryStore(s => s.addToast);
  const audienceMode = useTelemetryStore(s => s.audienceMode);
  const isBusiness = audienceMode === 'business';

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
        .catch(() => {}) // DLQ load failures are non-fatal; show empty state
        .finally(() => setLoading(false));
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleToggleSelect = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  };

  const handleSelectAll = () => {
    if (selectedIds.length === items.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(items.map((i) => i.event_id));
    }
  };

  const handleExecuteReplay = async () => {
    setReplaying(true);
    setReplayResult(null);

    const targetIds = mode === 'SELECTIVE' ? selectedIds : items.map((i) => i.event_id);
    if (targetIds.length === 0) {
      setReplaying(false);
      return;
    }

    const prevEvents = [...events];
    const prevActive = activeQueue;
    const prevDlq = dlqCount;

    optimisticReplay(targetIds);

    addToast({
      type: 'info',
      title: isBusiness ? 'Safe Re-delivery Queued' : 'Optimistic DLQ Replay',
      message: isBusiness
        ? `${targetIds.length} failed orders have been queued for immediate re-attempt.`
        : `${targetIds.length} events marked as QUEUED; active queue incremented.`,
    });

    try {
      const res = await api.replayDlq(
        mode,
        mode === 'SELECTIVE' ? selectedIds : undefined
      );

      const count = res.data?.replayed_count ?? targetIds.length;
      setReplayResult(
        `Scheduled ${count} jobs for replay (<= ${res.data?.throttle_rate_per_sec || 50} req/s).`
      );

      addChaosLog(`[DLQ REPLAY] Initiated replay of ${count} dead-lettered events`);
      addToast({
        type: 'success',
        title: isBusiness ? 'Orders Recovering' : 'DLQ Remediation Active',
        message: `Dispatched ${count} events through rate limiter.`,
      });

      onReplaySuccess();

      setTimeout(() => {
        onClose();
      }, 1200);
    } catch (err: unknown) {
      rollbackEvents(prevEvents, prevActive, prevDlq);
      const errMsg = err instanceof Error ? err.message : String(err);
      setReplayResult(`Error: ${errMsg}`);
      addToast({
        type: 'error',
        title: 'Replay Failed (Rolled Back)',
        message: errMsg || 'Previous state restored.',
      });
    } finally {
      setReplaying(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/60 flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.98 }}
        animate={{ opacity: 1, scale: 1, transition: { duration: 0.15 } }}
        exit={{ opacity: 0, scale: 0.98, transition: { duration: 0.1 } }}
        className="w-full max-w-xl bg-zinc-900 border border-zinc-800 rounded-md shadow-2xl overflow-hidden font-mono"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="h-11 px-4 border-b border-zinc-800 bg-zinc-950 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertOctagon className="w-4 h-4 text-rose-400" />
            <span className="text-xs font-semibold text-zinc-100 uppercase tracking-wider">
              {isBusiness ? 'Failed Orders Recovery (DLQ)' : 'DLQ Remediation'}
            </span>
          </div>
          <motion.button
            whileTap={{ scale: 0.97 }}
            onClick={onClose}
            className="p-1 rounded text-zinc-500 hover:text-zinc-200 hover:bg-zinc-800 transition-colors"
          >
            <X className="w-3.5 h-3.5" />
          </motion.button>
        </div>

        {/* Content */}
        <div className="p-4 space-y-4 text-xs">
          {/* Rate Throttle Banner */}
          <div className="p-2 rounded bg-zinc-950 border border-zinc-800 flex items-center justify-between text-[11px] text-zinc-400">
            <span className="flex items-center gap-1.5">
              <ShieldAlert className="w-3.5 h-3.5 text-zinc-400 flex-shrink-0" />
              <span>Token-Bucket Throttling:</span>
            </span>
            <span className="font-mono text-zinc-200 tabular-nums">
              50 req/sec MAX
            </span>
          </div>

          {/* Mode Selector */}
          <div>
            <label className="text-[11px] uppercase tracking-wider text-zinc-500 block mb-1.5">
              Replay Execution Scope
            </label>
            <div className="grid grid-cols-2 gap-2">
              <motion.button
                whileTap={{ scale: 0.98 }}
                onClick={() => setMode('BATCH_ALL')}
                className={`py-1.5 px-3 rounded text-[11px] border transition-colors text-center ${
                  mode === 'BATCH_ALL'
                    ? 'bg-zinc-800 border-zinc-600 text-zinc-100 font-semibold'
                    : 'bg-zinc-950 border-zinc-800 text-zinc-400 hover:border-zinc-700'
                }`}
              >
                Replay All ({items.length})
              </motion.button>
              <motion.button
                whileTap={{ scale: 0.98 }}
                onClick={() => setMode('SELECTIVE')}
                className={`py-1.5 px-3 rounded text-[11px] border transition-colors text-center ${
                  mode === 'SELECTIVE'
                    ? 'bg-zinc-800 border-zinc-600 text-zinc-100 font-semibold'
                    : 'bg-zinc-950 border-zinc-800 text-zinc-400 hover:border-zinc-700'
                }`}
              >
                Selective ({selectedIds.length})
              </motion.button>
            </div>
          </div>

          {/* Items List */}
          <div>
            <div className="flex items-center justify-between text-[11px] text-zinc-500 uppercase tracking-wider mb-1.5">
              <span>DLQ Backlog</span>
              {mode === 'SELECTIVE' && items.length > 0 && (
                <button
                  onClick={handleSelectAll}
                  className="text-zinc-400 hover:text-zinc-200 text-[10px] transition-colors"
                >
                  {selectedIds.length === items.length ? 'Deselect all' : 'Select all'}
                </button>
              )}
            </div>

            <div className="border border-zinc-800 rounded max-h-52 overflow-y-auto bg-zinc-950 divide-y divide-zinc-850">
              {loading ? (
                <div className="p-4 text-center text-zinc-600 text-[11px]">
                  Loading dead-letter backlog…
                </div>
              ) : items.length === 0 ? (
                <div className="p-4 text-center text-zinc-500 text-[11px]">
                  Dead-Letter Queue is empty. All deliveries healthy.
                </div>
              ) : (
                items.map((item) => {
                  const isChecked = selectedIds.includes(item.event_id);
                  return (
                    <div
                      key={item.dlq_id}
                      onClick={() => mode === 'SELECTIVE' && handleToggleSelect(item.event_id)}
                      className={`p-2.5 flex items-center justify-between text-[11px] transition-colors ${
                        mode === 'SELECTIVE' ? 'cursor-pointer hover:bg-zinc-900' : ''
                      }`}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        {mode === 'SELECTIVE' && (
                          <div className="text-zinc-400 flex-shrink-0">
                            {isChecked ? <CheckSquare className="w-3.5 h-3.5 text-zinc-200" /> : <Square className="w-3.5 h-3.5 text-zinc-600" />}
                          </div>
                        )}
                        <div className="truncate">
                          <div className="text-zinc-200 font-semibold tabular-nums">
                            {item.event_id.slice(0, 14)}…
                          </div>
                          <div className="text-zinc-500 text-[10px]">
                            {item.event_type} · {item.retry_count} retries
                          </div>
                        </div>
                      </div>

                      <div className="text-right flex-shrink-0 ml-2">
                        <span className="text-[10px] text-rose-400 bg-rose-950/60 px-1.5 py-0.5 rounded border border-rose-800/60 font-mono">
                          {item.error_message?.slice(0, 24) || 'Timeout'}
                        </span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Feedback Result message */}
          {replayResult && (
            <div className="p-2 rounded bg-emerald-950/60 border border-emerald-800/80 text-[11px] text-emerald-300 flex items-center gap-2">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />
              <span>{replayResult}</span>
            </div>
          )}

          {/* Modal Action Buttons */}
          <div className="pt-2 border-t border-zinc-800 flex justify-between items-center">
            <span className="text-[10px] text-zinc-500">
              SETNX Idempotency Active
            </span>

            <div className="flex gap-2">
              <motion.button
                whileTap={{ scale: 0.97 }}
                onClick={onClose}
                className="px-3 py-1 rounded border border-zinc-700 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-[11px] transition-colors"
              >
                Cancel
              </motion.button>
              <motion.button
                whileTap={{ scale: 0.97 }}
                onClick={handleExecuteReplay}
                disabled={replaying || items.length === 0 || (mode === 'SELECTIVE' && selectedIds.length === 0)}
                className="px-3 py-1 rounded bg-rose-600 hover:bg-rose-500 text-white font-semibold text-[11px] flex items-center gap-1.5 border border-rose-500 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                <RotateCw className={`w-3 h-3 ${replaying ? 'animate-spin' : ''}`} />
                 <span>
                   {replaying
                     ? 'Replaying…'
                     : isBusiness ? 'Recover Orders' : 'Execute Replay'}
                 </span>
              </motion.button>
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
};
