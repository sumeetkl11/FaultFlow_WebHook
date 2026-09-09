'use client';

import React, { useState, useEffect } from 'react';
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
  HelpCircle,
  RotateCw,
  Lock,
  ArrowRight,
  ExternalLink,
  Sparkles,
} from 'lucide-react';

interface EventTraceDrawerProps {
  eventId: string | null;
  onClose: () => void;
  onReplay?: (eventId: string) => void;
}

export const EventTraceDrawer: React.FC<EventTraceDrawerProps> = ({ eventId, onClose, onReplay }) => {
  const [details, setDetails] = useState<EventTraceDetails | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<'timeline' | 'payload' | 'headers'>('timeline');
  const [copied, setCopied] = useState<boolean>(false);
  const [replaying, setReplaying] = useState<boolean>(false);

  const { audienceMode, optimisticReplay, addToast } = useTelemetryStore();
  const isBusiness = audienceMode === 'business';

  useEffect(() => {
    if (!eventId) {
      setDetails(null);
      return;
    }

    setLoading(true);
    api.getEventTrace(eventId)
      .then((res) => {
        if (res?.data) {
          setDetails(res.data);
        }
      })
      .catch((err) => {
        console.error('Failed to fetch trace details:', err);
      })
      .finally(() => setLoading(false));
  }, [eventId]);

  if (!eventId) return null;

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
        ? `Order #${eventId.slice(0, 8)} re-queued. Duplicate protection prevents double charges.`
        : `Selective DLQ replay dispatched for ${eventId}.`,
    });

    try {
      await api.replayDlq('SELECTIVE', [eventId]);
      addToast({
        type: 'success',
        title: isBusiness ? 'Order Re-enqueued' : 'Replay Scheduled',
        message: 'The transaction has been submitted for immediate delivery attempt.',
      });
      if (onReplay) onReplay(eventId);
    } catch (err: any) {
      addToast({
        type: 'error',
        title: 'Replay Failed',
        message: err.message || 'Unable to schedule replay.',
      });
    } finally {
      setReplaying(false);
    }
  };

  const isDeadLettered = details?.status === 'DEAD_LETTERED';
  const isDelivered = details?.status === 'DELIVERED';

  return (
    <div className="fixed inset-0 z-50 overflow-hidden bg-black/60 backdrop-blur-sm flex justify-end animate-in fade-in duration-200">
      <div
        className="w-full max-w-xl bg-slate-900 border-l border-slate-800 shadow-2xl h-full flex flex-col animate-in slide-in-from-right duration-300"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Drawer Header */}
        <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/70">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-indigo-400">
                {isBusiness ? 'Transaction Inspector' : 'Trace Inspector'}
              </span>
              <span
                className={`text-[10px] px-2 py-0.5 rounded font-bold uppercase tracking-wider ${
                  isDelivered
                    ? 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                    : isDeadLettered
                    ? 'bg-rose-950 text-rose-300 border border-rose-800'
                    : 'bg-indigo-950 text-indigo-300 border border-indigo-800'
                }`}
              >
                {details?.status || 'LOADING'}
              </span>
            </div>
            <h3 className="text-sm font-mono text-white mt-1 font-bold truncate max-w-md">
              {eventId}
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Selection */}
        <div className="flex border-b border-slate-800 bg-slate-950/40 text-xs font-medium text-slate-400">
          <button
            onClick={() => setActiveTab('timeline')}
            className={`flex-1 py-2.5 px-4 text-center border-b-2 transition flex items-center justify-center gap-1.5 ${
              activeTab === 'timeline'
                ? 'border-indigo-500 text-white bg-slate-800/40'
                : 'border-transparent hover:text-slate-200'
            }`}
          >
            <Clock className="w-3.5 h-3.5" />
            <span>{isBusiness ? 'Delivery Journey' : 'Attempt Timeline'}</span>
            <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-slate-800">
              {details?.attempts_timeline?.length || 0}
            </span>
          </button>
          <button
            onClick={() => setActiveTab('payload')}
            className={`flex-1 py-2.5 px-4 text-center border-b-2 transition flex items-center justify-center gap-1.5 ${
              activeTab === 'payload'
                ? 'border-indigo-500 text-white bg-slate-800/40'
                : 'border-transparent hover:text-slate-200'
            }`}
          >
            <span>{isBusiness ? 'Order Data' : 'Payload JSON'}</span>
          </button>
          <button
            onClick={() => setActiveTab('headers')}
            className={`flex-1 py-2.5 px-4 text-center border-b-2 transition flex items-center justify-center gap-1.5 ${
              activeTab === 'headers'
                ? 'border-indigo-500 text-white bg-slate-800/40'
                : 'border-transparent hover:text-slate-200'
            }`}
          >
            <Shield className="w-3.5 h-3.5" />
            <span>{isBusiness ? 'Security & Proof' : 'Cryptographic Headers'}</span>
          </button>
        </div>

        {/* Drawer Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {loading ? (
            <div className="h-48 flex items-center justify-center text-slate-500 text-sm">
              Loading telemetry trace...
            </div>
          ) : !details ? (
            <div className="text-slate-500 text-sm">No trace telemetry found.</div>
          ) : (
            <>
              {/* Tab 1: Timeline & Explainer */}
              {activeTab === 'timeline' && (
                <div className="space-y-4">
                  {/* Business Explainer Card */}
                  {isBusiness && (
                    <div className="p-4 rounded-xl border border-indigo-500/30 bg-indigo-950/20 space-y-3">
                      <div className="flex items-center gap-2">
                        <Sparkles className="w-4 h-4 text-indigo-400" />
                        <h4 className="text-xs font-bold text-white uppercase tracking-wider">
                          Transaction Diagnosis
                        </h4>
                      </div>

                      <div className="space-y-2 text-xs">
                        <div>
                          <strong className="text-slate-300 block">1. What Happened?</strong>
                          <p className="text-slate-400 text-[11px] mt-0.5">
                            {isDelivered
                              ? 'This transaction was successfully accepted and confirmed by the destination app.'
                              : isDeadLettered
                              ? 'The destination app (Shopify/Stripe/API) was unresponsive after multiple automatic retry attempts.'
                              : 'FaultFlow is currently queuing and delivering this transaction with automated backoff protection.'}
                          </p>
                        </div>

                        <div>
                          <strong className="text-slate-300 block">2. What Is FaultFlow Doing?</strong>
                          <p className="text-slate-400 text-[11px] mt-0.5">
                            {isDelivered
                              ? 'Data is archived with cryptographic verification signature.'
                              : 'Protecting transaction payload from loss. Duplicate prevention is 100% active.'}
                          </p>
                        </div>

                        {isDeadLettered && (
                          <div className="pt-2 border-t border-indigo-900/50">
                            <strong className="text-rose-300 block">3. Recommended Action:</strong>
                            <div className="mt-1.5 flex items-center gap-2">
                              <button
                                onClick={handleDrawerReplay}
                                disabled={replaying}
                                className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold flex items-center gap-1.5 shadow-md transition disabled:opacity-50"
                              >
                                <RotateCw className={`w-3.5 h-3.5 ${replaying ? 'animate-spin' : ''}`} />
                                <span>Safely Resend Now</span>
                              </button>
                              <span className="text-[10px] text-slate-400">
                                (Safe: Customer will not be double billed)
                              </span>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Destination Information */}
                  <div className="text-xs text-slate-400">
                    <span className="font-semibold uppercase tracking-wider block text-[10px] text-slate-500 mb-1">
                      Destination Target
                    </span>
                    <strong className="text-slate-200 font-mono break-all bg-slate-950 p-2 rounded-lg border border-slate-800 block">
                      {details.target_url}
                    </strong>
                  </div>

                  {/* Attempt Timeline */}
                  {details.attempts_timeline.length === 0 ? (
                    <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-500 italic">
                      Job enqueued. Awaiting worker execution dispatch...
                    </div>
                  ) : (
                    <div className="relative pl-6 space-y-4 before:absolute before:left-2 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-800">
                      {details.attempts_timeline.map((att, idx) => {
                        const isSuccess = att.response_status && att.response_status >= 200 && att.response_status < 300;
                        return (
                          <div key={idx} className="relative">
                            <div
                              className={`absolute -left-6 top-1 w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                                isSuccess
                                  ? 'bg-emerald-950 border-emerald-500 text-emerald-400'
                                  : 'bg-rose-950 border-rose-500 text-rose-400'
                              }`}
                            >
                              {isSuccess ? <CheckCircle className="w-2.5 h-2.5" /> : <AlertCircle className="w-2.5 h-2.5" />}
                            </div>

                            <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800/80 shadow-md">
                              <div className="flex items-center justify-between text-xs mb-1">
                                <span className="font-semibold text-white">
                                  {isBusiness ? `Delivery Attempt #${att.attempt_number}` : `Attempt #${att.attempt_number}`}
                                </span>
                                <span className="text-slate-500 font-mono text-[11px]">
                                  {new Date(att.timestamp).toLocaleTimeString()}
                                </span>
                              </div>

                              <div className="flex items-center gap-2 text-xs font-mono mt-1">
                                <span
                                  className={`px-2 py-0.5 rounded font-bold ${
                                    isSuccess
                                      ? 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                                      : 'bg-rose-950 text-rose-300 border border-rose-800'
                                  }`}
                                >
                                  {isSuccess ? 'HTTP 200 OK' : `HTTP ${att.response_status || 'TIMEOUT'}`}
                                </span>
                                {att.latency_ms != null && (
                                  <span className="text-slate-400 text-[11px]">
                                    Duration: <strong className="text-slate-200">{att.latency_ms}ms</strong>
                                  </span>
                                )}
                              </div>

                              {att.error_message && (
                                <div className="mt-2 p-2 rounded-lg bg-rose-950/30 border border-rose-900/50 text-[11px] font-mono text-rose-300 break-words">
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

              {/* Tab 2: Payload JSON */}
              {activeTab === 'payload' && (
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs text-slate-400 font-semibold uppercase tracking-wider">
                      {isBusiness ? 'Customer & Order Data' : 'Event Payload Body'}
                    </span>
                    <button
                      onClick={handleCopyJson}
                      className="inline-flex items-center gap-1 text-xs text-indigo-400 hover:text-indigo-300 transition font-medium"
                    >
                      {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                      <span>{copied ? 'Copied' : 'Copy JSON'}</span>
                    </button>
                  </div>
                  <pre className="p-4 rounded-xl bg-slate-950 border border-slate-800 font-mono text-xs text-emerald-300 overflow-x-auto max-h-[500px]">
                    {JSON.stringify(details.payload, null, 2)}
                  </pre>
                </div>
              )}

              {/* Tab 3: Security & Cryptographic Headers */}
              {activeTab === 'headers' && (
                <div className="space-y-4">
                  <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800">
                    <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1">
                      <Lock className="w-3.5 h-3.5 text-indigo-400" />
                      <span>HMAC-SHA256 Signature (X-Signature)</span>
                    </div>
                    <div className="font-mono text-xs text-indigo-300 break-all select-all p-2 rounded-lg bg-slate-900 border border-slate-800 mt-2">
                      {details.hmac_signature}
                    </div>
                    <p className="text-[11px] text-slate-400 mt-2 leading-relaxed">
                      {isBusiness
                        ? 'Cryptographic verification seal ensuring this payload was never tampered with in transit.'
                        : 'Generated at dispatch using tenant secret via HMAC-SHA256 to guarantee payload immutability.'}
                    </p>
                  </div>

                  <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800">
                    <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1">
                      <Shield className="w-3.5 h-3.5 text-cyan-400" />
                      <span>Idempotency Key (Idempotency-Key)</span>
                    </div>
                    <div className="font-mono text-xs text-cyan-300 break-all select-all p-2 rounded-lg bg-slate-900 border border-slate-800 mt-2">
                      {details.idempotency_key}
                    </div>
                    <p className="text-[11px] text-slate-400 mt-2 leading-relaxed">
                      {isBusiness
                        ? 'Unique transaction fingerprint that guarantees customers are never charged or credited twice.'
                        : 'Guarantees deduplication across 24 hours via Redis atomic SETNX gating.'}
                    </p>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};
