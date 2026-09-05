import React, { useState, useEffect } from 'react';
import { EventTraceDetails } from '../types';
import { api } from '../lib/api';
import { X, Copy, Check, Shield, Clock, AlertCircle, CheckCircle } from 'lucide-react';

interface EventTraceDrawerProps {
  eventId: string | null;
  onClose: () => void;
}

export const EventTraceDrawer: React.FC<EventTraceDrawerProps> = ({ eventId, onClose }) => {
  const [details, setDetails] = useState<EventTraceDetails | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<'payload' | 'headers' | 'timeline'>('timeline');
  const [copied, setCopied] = useState<boolean>(false);

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

  return (
    <div className="fixed inset-0 z-50 overflow-hidden bg-black/60 backdrop-blur-sm flex justify-end animate-in fade-in duration-200">
      <div
        className="w-full max-w-xl bg-slate-900 border-l border-slate-800 shadow-2xl h-full flex flex-col animate-in slide-in-from-right duration-300"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/60">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-indigo-400">
                Trace Inspector
              </span>
              <span className="text-xs px-2 py-0.5 rounded bg-slate-800 text-slate-300 font-mono">
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

        {/* Tabs */}
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
            Attempt Timeline ({details?.attempts_timeline?.length || 0})
          </button>
          <button
            onClick={() => setActiveTab('payload')}
            className={`flex-1 py-2.5 px-4 text-center border-b-2 transition flex items-center justify-center gap-1.5 ${
              activeTab === 'payload'
                ? 'border-indigo-500 text-white bg-slate-800/40'
                : 'border-transparent hover:text-slate-200'
            }`}
          >
            Payload JSON
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
            Cryptographic Headers
          </button>
        </div>

        {/* Body Content */}
        <div className="flex-1 overflow-y-auto p-5">
          {loading ? (
            <div className="h-48 flex items-center justify-center text-slate-500 text-sm">
              Loading trace telemetry...
            </div>
          ) : !details ? (
            <div className="text-slate-500 text-sm">No trace telemetry found.</div>
          ) : (
            <>
              {/* Tab 1: Timeline */}
              {activeTab === 'timeline' && (
                <div className="space-y-4">
                  <div className="text-xs text-slate-400 mb-3">
                    Destination URL:{' '}
                    <strong className="text-slate-200 font-mono break-all">{details.target_url}</strong>
                  </div>

                  {details.attempts_timeline.length === 0 ? (
                    <div className="p-4 rounded-lg bg-slate-950 border border-slate-800 text-xs text-slate-500 italic">
                      Job enqueued. Awaiting worker execution dispatch...
                    </div>
                  ) : (
                    <div className="relative pl-6 space-y-6 before:absolute before:left-2 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-800">
                      {details.attempts_timeline.map((att, idx) => {
                        const isSuccess = att.response_status && att.response_status >= 200 && att.response_status < 300;
                        return (
                          <div key={idx} className="relative">
                            {/* Dot */}
                            <div
                              className={`absolute -left-6 top-1 w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                                isSuccess
                                  ? 'bg-emerald-950 border-emerald-500 text-emerald-400'
                                  : 'bg-rose-950 border-rose-500 text-rose-400'
                              }`}
                            >
                              {isSuccess ? (
                                <CheckCircle className="w-2.5 h-2.5" />
                              ) : (
                                <AlertCircle className="w-2.5 h-2.5" />
                              )}
                            </div>

                            {/* Card */}
                            <div className="p-3.5 rounded-lg bg-slate-950 border border-slate-800/80 shadow-md">
                              <div className="flex items-center justify-between text-xs mb-1">
                                <span className="font-semibold text-white">
                                  Attempt #{att.attempt_number}
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
                                  HTTP {att.response_status || 'TIMEOUT'}
                                </span>
                                {att.latency_ms != null && (
                                  <span className="text-slate-400">
                                    Duration: <strong className="text-slate-200">{att.latency_ms}ms</strong>
                                  </span>
                                )}
                              </div>

                              {att.error_message && (
                                <div className="mt-2.5 p-2 rounded bg-rose-950/30 border border-rose-900/50 text-[11px] font-mono text-rose-300 break-words">
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

              {/* Tab 2: Payload */}
              {activeTab === 'payload' && (
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs text-slate-400 font-semibold uppercase tracking-wider">
                      Event Payload Body
                    </span>
                    <button
                      onClick={handleCopyJson}
                      className="inline-flex items-center gap-1 text-xs text-indigo-400 hover:text-indigo-300 transition"
                    >
                      {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                      {copied ? 'Copied' : 'Copy JSON'}
                    </button>
                  </div>
                  <pre className="p-4 rounded-lg bg-slate-950 border border-slate-800 font-mono text-xs text-emerald-300 overflow-x-auto max-h-[500px]">
                    {JSON.stringify(details.payload, null, 2)}
                  </pre>
                </div>
              )}

              {/* Tab 3: Headers */}
              {activeTab === 'headers' && (
                <div className="space-y-4">
                  <div className="p-3.5 rounded-lg bg-slate-950 border border-slate-800">
                    <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">
                      HMAC-SHA256 Signature (X-Signature)
                    </div>
                    <div className="font-mono text-xs text-indigo-300 break-all select-all p-2 rounded bg-slate-900 border border-slate-800">
                      {details.hmac_signature}
                    </div>
                    <p className="text-[11px] text-slate-500 mt-2">
                      Generated at dispatch using tenant secret via HMAC-SHA256 to guarantee payload immutability.
                    </p>
                  </div>

                  <div className="p-3.5 rounded-lg bg-slate-950 border border-slate-800">
                    <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">
                      Idempotency Key (Idempotency-Key)
                    </div>
                    <div className="font-mono text-xs text-slate-300 break-all select-all p-2 rounded bg-slate-900 border border-slate-800">
                      {details.idempotency_key}
                    </div>
                    <p className="text-[11px] text-slate-500 mt-2">
                      Guarantees deduplication across 24 hours via Redis atomic SETNX gating.
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
