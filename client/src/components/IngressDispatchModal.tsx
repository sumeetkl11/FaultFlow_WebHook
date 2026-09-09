'use client';

import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { api } from '../lib/api';
import { useTelemetryStore } from '../stores/useTelemetryStore';
import { ingressPayloadSchema } from '../schemas/ingressSchema';
import { X, Send, CheckCircle2, ShieldCheck, FileJson } from 'lucide-react';

interface IngressDispatchModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

const PRESETS = [
  {
    name: 'Shopify Order Checkout',
    event_type: 'order.checkout',
    payload: {
      order_id: 'ord_98241',
      total_amount: 129.5,
      currency: 'USD',
      customer: {
        id: 'cust_441',
        name: 'Sarah Connor',
        email: 'sarah@skynet.com',
      },
      items: [{ sku: 'BOOTS-01', quantity: 1, price: 129.5 }],
    },
  },
  {
    name: 'Stripe Invoice Settled',
    event_type: 'invoice.paid',
    payload: {
      invoice_id: 'inv_1092',
      amount_paid: 24900,
      currency: 'USD',
      customer_email: 'finance@enterprise.co',
      billing_reason: 'subscription_cycle',
    },
  },
  {
    name: 'Payment Refund Issued',
    event_type: 'charge.refunded',
    payload: {
      refund_id: 'ref_3301',
      original_charge_id: 'ch_8819',
      refund_amount: 45.0,
      reason: 'customer_return',
    },
  },
];

export const IngressDispatchModal: React.FC<IngressDispatchModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
}) => {
  const [targetUrl, setTargetUrl] = useState('http://localhost:4000/api/v1/chaos/sink');
  const [eventType, setEventType] = useState('invoice.paid');
  const [payloadJson, setPayloadJson] = useState(
    JSON.stringify(PRESETS[0].payload, null, 2)
  );
  const [maxRetries, setMaxRetries] = useState(5);
  const [timeoutMs, setTimeoutMs] = useState(5000);
  const [idempotencyKey, setIdempotencyKey] = useState(
    `idemp_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`
  );
  const [submitting, setSubmitting] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [result, setResult] = useState<{ success: boolean; message: string } | null>(null);

  const { addChaosLog, addToast, audienceMode } = useTelemetryStore();
  const isBusiness = audienceMode === 'business';

  if (!isOpen) return null;

  const handleApplyPreset = (preset: (typeof PRESETS)[0]) => {
    setEventType(preset.event_type);
    setPayloadJson(JSON.stringify(preset.payload, null, 2));
    setFieldErrors({});
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setResult(null);
    setFieldErrors({});

    const validation = ingressPayloadSchema.safeParse({
      target_url: targetUrl,
      event_type: eventType,
      payload: payloadJson,
      max_retries: maxRetries,
      timeout_ms: timeoutMs,
    });

    if (!validation.success) {
      const errors: Record<string, string> = {};
      validation.error.issues.forEach((err: any) => {
        if (err.path[0]) {
          errors[err.path[0].toString()] = err.message;
        }
      });
      setFieldErrors(errors);
      setSubmitting(false);
      return;
    }

    let parsedPayload: any;
    try {
      parsedPayload = JSON.parse(payloadJson);
    } catch {
      setFieldErrors({ payload: 'Payload must be valid, well-formed JSON' });
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
          ? `Dispatched ID: ${res.data.event_id} (Status: ${res.data.status})`
          : res.message || 'Event processed successfully',
      });

      addChaosLog(`[INGRESS] Dispatched event ${eventType} -> ${targetUrl}`);
      addToast({
        type: 'success',
        title: isBusiness ? 'Transaction Dispatched' : 'Webhook Ingested',
        message: `Event ${eventType} enqueued (<25ms). Idempotency active.`,
      });

      onSuccess();

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
            <Send className="w-4 h-4 text-zinc-300" />
            <span className="text-xs font-semibold text-zinc-100 uppercase tracking-wider">
              {isBusiness ? 'Dispatch Test Transaction' : 'Ingress Webhook Dispatcher'}
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

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-4 space-y-3.5 text-xs">
          {/* Presets */}
          <div>
            <span className="text-[11px] uppercase tracking-wider text-zinc-500 block mb-1.5">
              Quick Test Presets
            </span>
            <div className="grid grid-cols-3 gap-1.5">
              {PRESETS.map((p, idx) => (
                <motion.button
                  key={idx}
                  type="button"
                  whileTap={{ scale: 0.98 }}
                  onClick={() => handleApplyPreset(p)}
                  className="py-1 px-2 rounded bg-zinc-950 border border-zinc-800 text-zinc-300 hover:border-zinc-600 hover:text-zinc-100 text-[10px] text-left truncate transition-colors"
                >
                  {p.name}
                </motion.button>
              ))}
            </div>
          </div>

          {/* Target URL */}
          <div>
            <label className="text-[11px] uppercase tracking-wider text-zinc-500 block mb-1">
              Destination Target URL
            </label>
            <input
              type="text"
              value={targetUrl}
              onChange={(e) => setTargetUrl(e.target.value)}
              className="w-full px-2.5 py-1.5 rounded bg-zinc-950 border border-zinc-800 text-zinc-200 text-xs focus:outline-none focus:border-zinc-600 transition-colors"
            />
            {fieldErrors.target_url && (
              <p className="text-[10px] text-rose-400 mt-1">{fieldErrors.target_url}</p>
            )}
          </div>

          {/* Event Type & Idempotency Key */}
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[11px] uppercase tracking-wider text-zinc-500 block mb-1">
                Event Type
              </label>
              <input
                type="text"
                value={eventType}
                onChange={(e) => setEventType(e.target.value)}
                className="w-full px-2.5 py-1.5 rounded bg-zinc-950 border border-zinc-800 text-zinc-200 text-xs focus:outline-none focus:border-zinc-600 transition-colors"
              />
              {fieldErrors.event_type && (
                <p className="text-[10px] text-rose-400 mt-1">{fieldErrors.event_type}</p>
              )}
            </div>

            <div>
              <label className="text-[11px] uppercase tracking-wider text-zinc-500 block mb-1">
                Idempotency Key
              </label>
              <input
                type="text"
                value={idempotencyKey}
                onChange={(e) => setIdempotencyKey(e.target.value)}
                className="w-full px-2.5 py-1.5 rounded bg-zinc-950 border border-zinc-800 text-zinc-400 text-xs focus:outline-none focus:border-zinc-600 transition-colors"
              />
            </div>
          </div>

          {/* Retries & Timeout */}
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[11px] uppercase tracking-wider text-zinc-500 block mb-1">
                Max Retries
              </label>
              <input
                type="number"
                min={0}
                max={10}
                value={maxRetries}
                onChange={(e) => setMaxRetries(parseInt(e.target.value, 10))}
                className="w-full px-2.5 py-1.5 rounded bg-zinc-950 border border-zinc-800 text-zinc-200 text-xs focus:outline-none focus:border-zinc-600 transition-colors"
              />
            </div>

            <div>
              <label className="text-[11px] uppercase tracking-wider text-zinc-500 block mb-1">
                Timeout (ms)
              </label>
              <input
                type="number"
                min={500}
                max={30000}
                step={500}
                value={timeoutMs}
                onChange={(e) => setTimeoutMs(parseInt(e.target.value, 10))}
                className="w-full px-2.5 py-1.5 rounded bg-zinc-950 border border-zinc-800 text-zinc-200 text-xs focus:outline-none focus:border-zinc-600 transition-colors"
              />
            </div>
          </div>

          {/* JSON Payload editor */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-[11px] uppercase tracking-wider text-zinc-500 flex items-center gap-1">
                <FileJson className="w-3 h-3" />
                Payload (JSON)
              </label>
            </div>
            <textarea
              rows={5}
              value={payloadJson}
              onChange={(e) => setPayloadJson(e.target.value)}
              className="w-full p-2 rounded bg-zinc-950 border border-zinc-800 text-zinc-200 font-mono text-[11px] focus:outline-none focus:border-zinc-600 transition-colors"
            />
            {fieldErrors.payload && (
              <p className="text-[10px] text-rose-400 mt-1">{fieldErrors.payload}</p>
            )}
          </div>

          {/* Result Alert */}
          {result && (
            <div
              className={`p-2 rounded text-[11px] flex items-center gap-2 border ${
                result.success
                  ? 'bg-emerald-950/60 border-emerald-800/80 text-emerald-300'
                  : 'bg-rose-950/60 border-rose-800/80 text-rose-300'
              }`}
            >
              {result.success ? (
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />
              ) : (
                <X className="w-3.5 h-3.5 text-rose-400 flex-shrink-0" />
              )}
              <span className="truncate">{result.message}</span>
            </div>
          )}

          {/* Actions */}
          <div className="pt-2 border-t border-zinc-800 flex justify-between items-center">
            <span className="text-[10px] text-zinc-500 flex items-center gap-1">
              <ShieldCheck className="w-3 h-3 text-zinc-500" />
              HMAC-SHA256 Signed
            </span>

            <div className="flex gap-2">
              <motion.button
                type="button"
                whileTap={{ scale: 0.97 }}
                onClick={onClose}
                className="px-3 py-1 rounded border border-zinc-700 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-[11px] transition-colors"
              >
                Cancel
              </motion.button>
              <motion.button
                type="submit"
                disabled={submitting}
                whileTap={{ scale: 0.97 }}
                className="px-3 py-1 rounded bg-zinc-100 hover:bg-white text-zinc-950 font-semibold text-[11px] flex items-center gap-1.5 border border-zinc-200 disabled:opacity-40 transition-colors"
              >
                <Send className="w-3 h-3" />
                <span>{submitting ? 'Dispatching…' : 'Send Webhook'}</span>
              </motion.button>
            </div>
          </div>
        </form>
      </motion.div>
    </div>
  );
};
