import React, { useState } from 'react';
import { api } from '../lib/api';
import { useTelemetryStore } from '../stores/useTelemetryStore';
import { X, Send, Sparkles, AlertCircle, CheckCircle2 } from 'lucide-react';

interface IngressDispatchModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export const IngressDispatchModal: React.FC<IngressDispatchModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
}) => {
  const [targetUrl, setTargetUrl] = useState('http://localhost:4000/api/v1/chaos/sink');
  const [eventType, setEventType] = useState('invoice.paid');
  const [payloadJson, setPayloadJson] = useState(
    JSON.stringify(
      {
        invoice_id: `inv_${Math.floor(1000 + Math.random() * 9000)}`,
        amount: 14900,
        currency: 'USD',
        customer: {
          id: 'cust_8821',
          email: 'alex@company.com',
        },
      },
      null,
      2
    )
  );
  const [maxRetries, setMaxRetries] = useState(5);
  const [timeoutMs, setTimeoutMs] = useState(5000);
  const [idempotencyKey, setIdempotencyKey] = useState(
    `idemp_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`
  );
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<{ success: boolean; message: string } | null>(null);
  const { addChaosLog } = useTelemetryStore();

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setResult(null);

    let parsedPayload: any;
    try {
      parsedPayload = JSON.parse(payloadJson);
    } catch {
      setResult({ success: false, message: 'Payload must be valid, well-formed JSON.' });
      setSubmitting(false);
      return;
    }

    try {
      const res = await api.ingestEvent({
        target_url: targetUrl,
        event_type: eventType,
        payload: parsedPayload,
        max_retries: maxRetries,
        timeout_ms: timeoutMs,
        idempotency_key: idempotencyKey,
      });

      setResult({
        success: true,
        message: res.data
          ? `Event enqueued! Event ID: ${res.data.event_id} (Status: ${res.data.status})`
          : res.message || 'Event processed',
      });
      addChaosLog(`[INGRESS] Dispatched event ${eventType} -> ${targetUrl}`);
      onSuccess();

      // Reset idempotency key for next dispatch
      setTimeout(() => {
        setIdempotencyKey(`idemp_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`);
      }, 1000);
    } catch (err: any) {
      setResult({ success: false, message: err.message || 'Failed to dispatch event' });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div
        className="w-full max-w-xl bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-5 border-b border-slate-800 bg-slate-950/60 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
              <Send className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-white">
                Dispatch Test Webhook Event
              </h3>
              <p className="text-xs text-slate-400">
                Low-latency API ingress with cryptographic signing & atomic deduplication
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

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Target URL */}
          <div>
            <label className="text-xs font-semibold text-slate-300 uppercase tracking-wider block mb-1.5">
              Target Destination Endpoint URL
            </label>
            <input
              type="url"
              required
              value={targetUrl}
              onChange={(e) => setTargetUrl(e.target.value)}
              className="w-full px-3.5 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs font-mono text-white focus:outline-none focus:border-indigo-500 transition"
            />
          </div>

          {/* Event Type & Idempotency Key */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-slate-300 uppercase tracking-wider block mb-1.5">
                Event Type
              </label>
              <input
                type="text"
                required
                value={eventType}
                onChange={(e) => setEventType(e.target.value)}
                className="w-full px-3.5 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-white focus:outline-none focus:border-indigo-500 transition"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-300 uppercase tracking-wider block mb-1.5">
                Idempotency-Key
              </label>
              <input
                type="text"
                required
                value={idempotencyKey}
                onChange={(e) => setIdempotencyKey(e.target.value)}
                className="w-full px-3.5 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs font-mono text-slate-300 focus:outline-none focus:border-indigo-500 transition"
              />
            </div>
          </div>

          {/* Retries & Timeout */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-slate-300 uppercase tracking-wider block mb-1.5">
                Max Retries
              </label>
              <input
                type="number"
                min={1}
                max={10}
                value={maxRetries}
                onChange={(e) => setMaxRetries(parseInt(e.target.value, 10))}
                className="w-full px-3.5 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-white focus:outline-none focus:border-indigo-500 transition"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-300 uppercase tracking-wider block mb-1.5">
                Timeout (ms)
              </label>
              <input
                type="number"
                min={1000}
                max={15000}
                step={500}
                value={timeoutMs}
                onChange={(e) => setTimeoutMs(parseInt(e.target.value, 10))}
                className="w-full px-3.5 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-white focus:outline-none focus:border-indigo-500 transition"
              />
            </div>
          </div>

          {/* JSON Payload */}
          <div>
            <label className="text-xs font-semibold text-slate-300 uppercase tracking-wider block mb-1.5">
              Payload (JSON)
            </label>
            <textarea
              rows={6}
              required
              value={payloadJson}
              onChange={(e) => setPayloadJson(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-lg text-xs font-mono text-emerald-300 focus:outline-none focus:border-indigo-500 transition"
            />
          </div>

          {result && (
            <div
              className={`p-3 rounded-xl border text-xs flex items-center gap-2 ${
                result.success
                  ? 'bg-emerald-950/60 border-emerald-800 text-emerald-300'
                  : 'bg-rose-950/60 border-rose-800 text-rose-300'
              }`}
            >
              {result.success ? (
                <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
              ) : (
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
              )}
              <span>{result.message}</span>
            </div>
          )}

          <div className="pt-2 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg text-xs font-semibold text-slate-400 hover:text-white transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-5 py-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold flex items-center gap-2 shadow-lg shadow-indigo-900/30 disabled:opacity-50 transition"
            >
              <Send className={`w-3.5 h-3.5 ${submitting ? 'animate-spin' : ''}`} />
              {submitting ? 'Dispatching...' : 'Dispatch Event (POST /events)'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
