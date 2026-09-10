'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence, type Variants } from 'framer-motion';
import { EventTraceDetails } from '../types';
import { api } from '../lib/api';
import { useTelemetryStore } from '../stores/useTelemetryStore';
import {
  X,
  Copy,
  Check,
  Shield,
  Clock,
  AlertCircle,
  CheckCircle,
  RotateCw,
  Lock,
} from 'lucide-react';

interface EventTraceDrawerProps {
  eventId: string | null;
  onClose: () => void;
  onReplay?: (eventId: string) => void;
}

/** Status badge — sharp 4px rect with transition-colors crossfade */
function DrawerStatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    QUEUED:        'badge badge-queued',
    PROCESSING:    'badge badge-processing',
    RETRYING:      'badge badge-retrying',
    DELIVERED:     'badge badge-delivered',
    DEAD_LETTERED: 'badge badge-dead',
    CIRCUIT_HOLD:  'badge badge-circuit',
  };
  return (
    <span className={`${map[status] ?? 'badge bg-zinc-800 border-zinc-700 text-zinc-400'} transition-colors duration-150`}>
      {status}
    </span>
  );
}

/** Tab button */
function DrawerTab({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`px-4 py-2 text-[11px] font-mono uppercase tracking-wider border-b-2 transition-colors ${
        active
          ? 'border-zinc-400 text-zinc-100'
          : 'border-transparent text-zinc-500 hover:text-zinc-300'
      }`}
    >
      {children}
    </button>
  );
}

/* ── Drawer spring physics ────────────────────────────────────────────────── */
const drawerVariants: Variants = {
  hidden:  { x: '100%', opacity: 0 },
  visible: {
    x: 0,
    opacity: 1,
    transition: { type: 'spring' as const, stiffness: 500, damping: 35 },
  },
  exit: {
    x: '100%',
    opacity: 0,
    transition: { type: 'spring' as const, stiffness: 500, damping: 35 },
  },
};

const backdropVariants: Variants = {
  hidden:  { opacity: 0 },
  visible: { opacity: 1, transition: { duration: 0.15 } },
  exit:    { opacity: 0, transition: { duration: 0.15 } },
};

/* ── Component ────────────────────────────────────────────────────────────── */
export const EventTraceDrawer: React.FC<EventTraceDrawerProps> = ({
  eventId,
  onClose,
  onReplay,
}) => {
  const [details, setDetails]   = useState<EventTraceDetails | null>(null);
  const [loading, setLoading]   = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<'timeline' | 'payload' | 'headers'>('timeline');
  const [copied, setCopied]     = useState<boolean>(false);
  const [replaying, setReplaying] = useState<boolean>(false);

  const { audienceMode, optimisticReplay, addToast } = useTelemetryStore();
  const isBusiness = audienceMode === 'business';

  useEffect(() => {
    if (!eventId) { setDetails(null); return; }
    setLoading(true);
    setActiveTab('timeline');
    api.getEventTrace(eventId)
      .then((res) => { if (res?.data) setDetails(res.data); })
      .catch((err) => { console.error('Failed to fetch trace:', err); })
      .finally(() => setLoading(false));
  }, [eventId]);

  const handleCopyJson = () => {
    if (!details?.payload) return;
    navigator.clipboard.writeText(JSON.stringify(details.payload, null, 2));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDrawerReplay = async () => {
    if (!eventId) return;
    setReplaying(true);
    optimisticReplay([eventId]);
    addToast({
      type: 'info',
      title: isBusiness ? 'Safely Resending Order' : 'DLQ Replay Initiated',
      message: isBusiness
        ? `Order #${eventId.slice(0, 8)} re-queued. Duplicate protection active.`
        : `Selective replay dispatched for ${eventId}.`,
    });
    try {
      await api.replayDlq('SELECTIVE', [eventId]);
      addToast({
        type: 'success',
        title: isBusiness ? 'Order Re-enqueued' : 'Replay Scheduled',
        message: 'Submitted for immediate delivery attempt.',
      });
      if (onReplay) onReplay(eventId);
    } catch (err: any) {
      addToast({ type: 'error', title: 'Replay Failed', message: err.message || 'Unable to schedule replay.' });
    } finally {
      setReplaying(false);
    }
  };

  const isDeadLettered = details?.status === 'DEAD_LETTERED';
  const isDelivered    = details?.status === 'DELIVERED';

  return (
    <AnimatePresence>
      {eventId && (
        <>
          {/* Backdrop */}
          <motion.div
            key="backdrop"
            variants={backdropVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            className="fixed inset-0 z-50 bg-black/55"
            onClick={onClose}
          />

          {/* Drawer panel */}
          <motion.div
            key="drawer"
            variants={drawerVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            className="fixed right-0 top-0 bottom-0 z-50 w-[480px] max-w-full bg-zinc-900 border-l border-zinc-800 shadow-2xl flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            {/* ── Drawer Header ─────────────────────────────────────── */}
            <div className="h-12 px-4 border-b border-zinc-800 flex items-center justify-between bg-zinc-950 flex-shrink-0">
              <div className="flex items-center gap-3 min-w-0">
                <span className="text-[11px] font-mono uppercase tracking-wider text-zinc-500 flex-shrink-0">
                  {isBusiness ? 'Transaction Inspector' : 'Trace Inspector'}
                </span>
                {details && <DrawerStatusBadge status={details.status} />}
              </div>
              <motion.button
                whileTap={{ scale: 0.97 }}
                onClick={onClose}
                className="p-1.5 rounded text-zinc-500 hover:text-zinc-200 hover:bg-zinc-800 transition-colors flex-shrink-0"
              >
                <X className="w-4 h-4" />
              </motion.button>
            </div>

            {/* Event ID */}
            <div className="px-4 py-2 border-b border-zinc-800 bg-zinc-950/50 flex-shrink-0">
              <span className="text-[11px] font-mono text-zinc-300 break-all select-all">
                {eventId}
              </span>
            </div>

            {/* ── Tabs ──────────────────────────────────────────────── */}
            <div className="flex border-b border-zinc-800 bg-zinc-900 flex-shrink-0">
              <DrawerTab active={activeTab === 'timeline'} onClick={() => setActiveTab('timeline')}>
                <Clock className="w-3 h-3 inline mr-1" />
                Timeline
                {details && (
                  <span className="ml-1 text-[10px] font-mono px-1 bg-zinc-800 rounded tabular-nums">
                    {details.attempts_timeline?.length ?? 0}
                  </span>
                )}
              </DrawerTab>
              <DrawerTab active={activeTab === 'payload'} onClick={() => setActiveTab('payload')}>
                Payload
              </DrawerTab>
              <DrawerTab active={activeTab === 'headers'} onClick={() => setActiveTab('headers')}>
                <Shield className="w-3 h-3 inline mr-1" />
                Headers
              </DrawerTab>
            </div>

            {/* ── Drawer Body ────────────────────────────────────────── */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {loading ? (
                <div className="flex items-center justify-center h-32 text-zinc-600 text-[13px] font-mono">
                  <motion.div
                    animate={{ opacity: [0.5, 1, 0.5] }}
                    transition={{ repeat: Infinity, duration: 2 }}
                  >
                    Loading trace…
                  </motion.div>
                </div>
              ) : !details ? (
                <div className="text-zinc-600 text-[13px] font-mono">No trace data found.</div>
              ) : (
                <>
                  {/* ── Tab: Timeline ─────────────────────────────── */}
                  {activeTab === 'timeline' && (
                    <div className="space-y-3">
                      {/* Target URL */}
                      <div>
                        <span className="text-[10px] font-mono uppercase tracking-wider text-zinc-600 block mb-1">
                          Destination Target
                        </span>
                        <code className="text-[11px] font-mono text-zinc-300 bg-zinc-950 border border-zinc-800 rounded block px-2 py-1.5 break-all">
                          {details.target_url}
                        </code>
                      </div>

                      {/* DLQ Replay CTA */}
                      {isDeadLettered && (
                        <div className="flex items-center gap-3 p-2 rounded bg-rose-950/40 border border-rose-800/50">
                          <motion.button
                            whileTap={{ scale: 0.97 }}
                            onClick={handleDrawerReplay}
                            disabled={replaying}
                            className="inline-flex items-center gap-1.5 px-3 py-1 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-[11px] font-mono border border-zinc-700 transition-colors disabled:opacity-50"
                          >
                            <RotateCw className={`w-3 h-3 ${replaying ? 'animate-spin' : ''}`} />
                            {replaying ? 'Replaying…' : isBusiness ? 'Safely Resend' : 'Replay'}
                          </motion.button>
                          <span className="text-[10px] font-mono text-zinc-500">
                            {isBusiness ? 'No double-billing risk' : 'Idempotency-guarded'}
                          </span>
                        </div>
                      )}

                      {/* Attempt timeline list */}
                      {details.attempts_timeline?.length === 0 ? (
                        <div className="px-3 py-4 rounded bg-zinc-950 border border-zinc-800 text-[11px] font-mono text-zinc-600 italic">
                          Job enqueued. Awaiting worker dispatch…
                        </div>
                      ) : (
                        <div className="timeline-track space-y-3">
                          {details.attempts_timeline?.map((att, idx) => {
                            const isOk = att.response_status != null && att.response_status >= 200 && att.response_status < 300;
                            return (
                              <div key={idx} className="relative">
                                {/* Timeline dot */}
                                <div
                                  className={`timeline-node border ${
                                    isOk
                                      ? 'bg-emerald-950 border-emerald-700'
                                      : 'bg-rose-950 border-rose-700'
                                  }`}
                                >
                                  {isOk
                                    ? <CheckCircle className="w-2 h-2 text-emerald-400" />
                                    : <AlertCircle className="w-2 h-2 text-rose-400" />}
                                </div>

                                <div className="pl-2 p-2.5 rounded bg-zinc-950 border border-zinc-800">
                                  {/* Attempt header row */}
                                  <div className="flex items-center justify-between text-[11px] font-mono mb-1">
                                    <span className="text-zinc-300 font-medium">
                                      Attempt #{att.attempt_number}
                                    </span>
                                    <span className="text-zinc-600 tabular-nums">
                                      {new Date(att.timestamp).toLocaleTimeString()}
                                    </span>
                                  </div>

                                  {/* Status codes row */}
                                  <div className="flex items-center gap-2 text-[11px] font-mono">
                                    <span
                                      className={`px-1.5 py-0.5 rounded border text-[10px] font-mono tabular-nums ${
                                        isOk
                                          ? 'bg-emerald-950/50 border-emerald-800/50 text-emerald-400'
                                          : 'bg-rose-950/50 border-rose-800/50 text-rose-400'
                                      }`}
                                    >
                                      {isOk ? 'HTTP 200 OK' : `HTTP ${att.response_status ?? 'TIMEOUT'}`}
                                    </span>
                                    {att.latency_ms != null && (
                                      <span className="text-zinc-500 tabular-nums">
                                        {att.latency_ms}ms
                                      </span>
                                    )}
                                  </div>

                                  {/* Error message */}
                                  {att.error_message && (
                                    <div className="mt-1.5 px-2 py-1 rounded bg-rose-950/30 border border-rose-900/40 text-[10px] font-mono text-rose-400 break-words">
                                      {att.error_message}
                                    </div>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  )}

                  {/* ── Tab: Payload ──────────────────────────────── */}
                  {activeTab === 'payload' && (
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-[10px] font-mono uppercase tracking-wider text-zinc-600">
                          {isBusiness ? 'Order Data' : 'Event Payload Body'}
                        </span>
                        <motion.button
                          whileTap={{ scale: 0.97 }}
                          onClick={handleCopyJson}
                          className="inline-flex items-center gap-1 text-[11px] font-mono text-zinc-500 hover:text-zinc-300 transition-colors"
                        >
                          {copied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                          {copied ? 'Copied' : 'Copy'}
                        </motion.button>
                      </div>
                      <pre className="p-3 rounded bg-zinc-950 border border-zinc-800 font-mono text-[11px] text-emerald-300/90 overflow-x-auto max-h-[520px] leading-relaxed">
                        {JSON.stringify(details.payload, null, 2)}
                      </pre>
                    </div>
                  )}

                  {/* ── Tab: Headers ──────────────────────────────── */}
                  {activeTab === 'headers' && (
                    <div className="space-y-4">
                      {/* HMAC Signature */}
                      <div className="p-3 rounded bg-zinc-950 border border-zinc-800">
                        <div className="flex items-center gap-1.5 text-[11px] font-mono uppercase tracking-wider text-zinc-400 mb-2">
                          <Lock className="w-3 h-3" />
                          HMAC-SHA256 Signature
                        </div>
                        <code className="font-mono text-[11px] text-zinc-300 break-all select-all block bg-zinc-900 border border-zinc-800 rounded px-2 py-1.5">
                          {details.hmac_signature}
                        </code>
                        <p className="text-[10px] text-zinc-600 mt-2 font-mono leading-relaxed">
                          {isBusiness
                            ? 'Cryptographic seal verifying payload integrity in transit.'
                            : 'Generated via HMAC-SHA256 using tenant secret. Guarantees payload immutability.'}
                        </p>
                      </div>

                      {/* Idempotency Key */}
                      <div className="p-3 rounded bg-zinc-950 border border-zinc-800">
                        <div className="flex items-center gap-1.5 text-[11px] font-mono uppercase tracking-wider text-zinc-400 mb-2">
                          <Shield className="w-3 h-3" />
                          Idempotency Key
                        </div>
                        <code className="font-mono text-[11px] text-zinc-300 break-all select-all block bg-zinc-900 border border-zinc-800 rounded px-2 py-1.5">
                          {details.idempotency_key}
                        </code>
                        <p className="text-[10px] text-zinc-600 mt-2 font-mono leading-relaxed">
                          {isBusiness
                            ? 'Unique fingerprint guaranteeing no customer is charged twice.'
                            : 'Deduplication guard via Redis atomic SETNX. 24h TTL.'}
                        </p>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};
