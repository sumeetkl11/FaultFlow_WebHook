'use client';

import React, { useState, useEffect } from 'react';
import { DLQItem } from '../types';
import { api } from '../lib/api';
import { useTelemetryStore } from '../stores/useTelemetryStore';
import { X, RotateCw, AlertOctagon, CheckCircle2, ShieldAlert, CheckSquare, Square, Sparkles } from 'lucide-react';

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

  const {
    events,
    activeQueue,
    dlqCount,
    optimisticReplay,
    rollbackEvents,
    addChaosLog,
    addToast,
    audienceMode,
  } = useTelemetryStore();
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

    // Save snapshot for rollback if needed
    const prevEvents = [...events];
    const prevActive = activeQueue;
    const prevDlq = dlqCount;

    // 1. Optimistic Status Update (Section 4.2 of Contract)
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
        `Successfully scheduled ${count} jobs for replay (rate throttled <= ${res.data?.throttle_rate_per_sec || 50} req/s).`
      );

      addChaosLog(`[DLQ REPLAY] Initiated replay of ${count} dead-lettered events`);
      addToast({
        type: 'success',
        title: isBusiness ? 'Orders Recovering' : 'DLQ Remediation Active',
        message: `Dispatched ${count} events through token-bucket rate limiter.`,
      });

      onReplaySuccess();

      setTimeout(() => {
        onClose();
      }, 1400);
    } catch (err: any) {
      // Rollback on failure
      rollbackEvents(prevEvents, prevActive, prevDlq);
      setReplayResult(`Error: ${err.message}`);
      addToast({
        type: 'error',
        title: 'Replay Failed (Rolled Back)',
        message: err.message || 'Network error encountered. Previous state restored.',
      });
    } finally {
      setReplaying(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/75 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div
        className="w-full max-w-2xl bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-5 border-b border-slate-800 bg-slate-950/70 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-rose-500/10 text-rose-400 border border-rose-500/20">
              <AlertOctagon className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white tracking-tight">
                {isBusiness ? 'Failed Orders Recovery (DLQ)' : 'Dead-Letter Queue (DLQ) Remediation'}
              </h3>
              <p className="text-xs text-slate-400">
                {isBusiness
                  ? 'Safely recover and re-deliver transactions that failed all previous attempts'
                  : 'Throttled mass re-enqueueing with thundering herd prevention (50 req/s)'}
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
              <ShieldAlert className="w-4 h-4 text-indigo-400 flex-shrink-0" />
              <span>{isBusiness ? 'Server Protection Safeguard:' : 'Token-Bucket Ingestion Ceiling:'}</span>
            </span>
            <strong className="font-mono bg-indigo-900/60 px-2.5 py-0.5 rounded-lg border border-indigo-700/60 text-[11px]">
              {isBusiness ? 'Smooth Delivery (50 req/s)' : '50 req/sec MAX'}
            </strong>
          </div>

          {/* Mode Selector */}
          <div>
            <label className="text-xs font-semibold text-slate-300 uppercase tracking-wider block mb-2">
              {isBusiness ? 'Select Recovery Scope' : 'Replay Execution Mode'}
            </label>
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => setMode('BATCH_ALL')}
                className={`py-2.5 px-4 rounded-xl text-xs font-semibold border transition text-center ${
                  mode === 'BATCH_ALL'
                    ? 'bg-indigo-600/30 border-indigo-500 text-white shadow-lg shadow-indigo-950/50'
                    : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:bg-slate-850'
                }`}
              >
                {isBusiness ? `Recover All (${items.length} Orders)` : `Replay All (${items.length} Jobs)`}
              </button>
              <button
                onClick={() => setMode('SELECTIVE')}
                className={`py-2.5 px-4 rounded-xl text-xs font-semibold border transition text-center ${
                  mode === 'SELECTIVE'
                    ? 'bg-indigo-600/30 border-indigo-500 text-white shadow-lg shadow-indigo-950/50'
                    : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:bg-slate-850'
                }`}
              >
                {isBusiness ? `Selected Only (${selectedIds.length})` : `Selective Replay (${selectedIds.length})`}
              </button>
            </div>
          </div>

          {/* Items List */}
          <div>
            <div className="flex items-center justify-between text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
              <span>{isBusiness ? 'Failed Transactions' : 'Failed Jobs Backlog'}</span>
              {mode === 'SELECTIVE' && items.length > 0 && (
                <button
                  onClick={handleSelectAll}
                  className="text-indigo-400 hover:text-indigo-300 text-[11px] lowercase flex items-center gap-1 font-sans"
                >
                  {selectedIds.length === items.length ? 'Deselect all' : 'Select all'}
                </button>
              )}
            </div>

            <div className="border border-slate-800 rounded-xl overflow-hidden max-h-56 overflow-y-auto bg-slate-950/80 divide-y divide-slate-850">
              {loading ? (
                <div className="p-6 text-center text-xs text-slate-500">
                  Loading dead-letter backlog...
                </div>
              ) : items.length === 0 ? (
                <div className="p-6 text-center text-xs text-slate-400">
                  Dead-Letter Queue is empty. All webhook deliveries are healthy!
                </div>
              ) : (
                items.map((item) => {
                  const isChecked = selectedIds.includes(item.event_id);
                  return (
                    <div
                      key={item.dlq_id}
                      onClick={() => mode === 'SELECTIVE' && handleToggleSelect(item.event_id)}
                      className={`p-3 flex items-center justify-between text-xs transition ${
                        mode === 'SELECTIVE' ? 'cursor-pointer hover:bg-slate-900/60' : ''
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        {mode === 'SELECTIVE' && (
                          <div className="text-indigo-400">
                            {isChecked ? <CheckSquare className="w-4 h-4" /> : <Square className="w-4 h-4 text-slate-600" />}
                          </div>
                        )}
                        <div>
                          <div className="font-mono text-slate-200 font-semibold text-xs">
                            {item.event_id.slice(0, 16)}...
                          </div>
                          <div className="text-[11px] text-slate-400 mt-0.5">
                            {item.event_type} • Retried {item.retry_count} times
                          </div>
                        </div>
                      </div>

                      <div className="text-right">
                        <span className="text-[10px] text-rose-400 bg-rose-950/80 px-2 py-0.5 rounded border border-rose-900/60 font-mono">
                          {item.error_message?.slice(0, 30) || 'Delivery Timeout'}
                        </span>
                        <div className="text-[10px] text-slate-500 mt-0.5">
                          {new Date(item.dead_lettered_at).toLocaleTimeString()}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Feedback Result message */}
          {replayResult && (
            <div className="p-3.5 rounded-xl bg-emerald-950/60 border border-emerald-800/80 text-xs text-emerald-300 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
              <span>{replayResult}</span>
            </div>
          )}

          {/* Modal Action Buttons */}
          <div className="pt-2 flex justify-between items-center">
            <span className="text-[11px] text-slate-400">
              {isBusiness
                ? 'Zero Double-Billing: Duplicate protection active'
                : 'SETNX Idempotency active for all re-enqueued jobs'}
            </span>

            <div className="flex gap-2.5">
              <button
                onClick={onClose}
                className="px-4 py-2 rounded-xl text-xs font-medium text-slate-400 hover:text-white hover:bg-slate-800 transition"
              >
                Cancel
              </button>
              <button
                onClick={handleExecuteReplay}
                disabled={replaying || items.length === 0 || (mode === 'SELECTIVE' && selectedIds.length === 0)}
                className="px-4 py-2 rounded-xl bg-gradient-to-r from-rose-600 to-indigo-600 hover:from-rose-500 hover:to-indigo-500 text-white font-semibold text-xs flex items-center gap-2 shadow-lg shadow-rose-950/50 disabled:opacity-40 disabled:cursor-not-allowed transition"
              >
                <RotateCw className={`w-3.5 h-3.5 ${replaying ? 'animate-spin' : ''}`} />
                <span>
                  {replaying
                    ? 'Replaying with Rate Throttle...'
                    : isBusiness
                    ? 'Confirm & Recover Orders'
                    : 'Execute Throttled Replay'}
                </span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
