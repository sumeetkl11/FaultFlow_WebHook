'use client';

import React, { useState } from 'react';
import { api } from '../lib/api';
import { useTelemetryStore } from '../stores/useTelemetryStore';
import { ingressPayloadSchema } from '../schemas/ingressSchema';
import { X, Send, Sparkles, AlertCircle, CheckCircle2, ShieldCheck, FileJson } from 'lucide-react';

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

    // Client-side Zod verification as per Section 5 contract
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
          ? `Dispatched! Event ID: ${res.data.event_id} (Status: ${res.data.status})`
          : res.message || 'Event processed successfully',
      });

      addChaosLog(`[INGRESS] Dispatched event ${eventType} -> ${targetUrl}`);
      addToast({
        type: 'success',
        title: isBusiness ? 'Transaction Dispatched' : 'Webhook Ingested',
        message: `Event ${eventType} enqueued (<25ms ingress). Duplicate protection active.`,
      });

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
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/75 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div
        className="w-full max-w-xl bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-5 border-b border-slate-800 bg-slate-950/70 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
              <Send className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white tracking-tight">
                {isBusiness ? 'Dispatch Test Transaction' : 'Ingress Webhook Dispatcher'}
              </h3>
              <p className="text-xs text-slate-400">
                {isBusiness
                  ? 'Send a simulated transaction to test zero-loss delivery'
                  : 'Sub-25ms entry point with Zod schema verification & atomic SETNX'}
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

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {/* Quick Presets for Easy Demo */}
          <div>
            <label className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block mb-1.5 flex items-center gap-1">
              <Sparkles className="w-3 h-3 text-indigo-400" />
              <span>Quick Demo Templates</span>
            </label>
            <div className="flex flex-wrap gap-2">
              {PRESETS.map((preset) => (
                <button
                  type="button"
                  key={preset.name}
                  onClick={() => handleApplyPreset(preset)}
                  className="px-2.5 py-1 rounded-lg text-xs bg-slate-950 hover:bg-slate-800 border border-slate-800 text-slate-300 transition"
                >
                  {preset.name}
                </button>
              ))}
            </div>
          </div>

          {/* Target Endpoint URL */}
          <div>
            <label className="text-xs font-semibold text-slate-300 block mb-1">
              {isBusiness ? 'Destination App Endpoint' : 'Target URL Endpoint'}
            </label>
            <input
              type="text"
              value={targetUrl}
              onChange={(e) => setTargetUrl(e.target.value)}
              placeholder="https://your-store.com/webhooks/ingress"
              className={`w-full px-3 py-2 bg-slate-950 border rounded-xl text-xs text-white placeholder-slate-500 font-mono focus:outline-none transition ${
                fieldErrors.target_url ? 'border-rose-500 focus:border-rose-500' : 'border-slate-800 focus:border-indigo-500'
              }`}
            />
            {fieldErrors.target_url && (
              <p className="text-[11px] text-rose-400 mt-1 flex items-center gap-1">
                <AlertCircle className="w-3 h-3" />
                {fieldErrors.target_url}
              </p>
            )}
          </div>

          {/* Event Type */}
          <div>
            <label className="text-xs font-semibold text-slate-300 block mb-1">
              {isBusiness ? 'Event Category' : 'Event Type (a-z, dots, hyphens)'}
            </label>
            <input
              type="text"
              value={eventType}
              onChange={(e) => setEventType(e.target.value)}
              placeholder="e.g. order.created, invoice.paid"
              className={`w-full px-3 py-2 bg-slate-950 border rounded-xl text-xs text-white placeholder-slate-500 font-mono focus:outline-none transition ${
                fieldErrors.event_type ? 'border-rose-500 focus:border-rose-500' : 'border-slate-800 focus:border-indigo-500'
              }`}
            />
            {fieldErrors.event_type && (
              <p className="text-[11px] text-rose-400 mt-1 flex items-center gap-1">
                <AlertCircle className="w-3 h-3" />
                {fieldErrors.event_type}
              </p>
            )}
          </div>

          {/* Payload JSON */}
          <div>
            <div className="flex justify-between items-center mb-1">
              <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                <FileJson className="w-3.5 h-3.5 text-indigo-400" />
                <span>{isBusiness ? 'Transaction Payload Data (JSON)' : 'Payload Body (JSON, max 1MB)'}</span>
              </label>
              <span className="text-[11px] text-slate-500 font-mono">Zod Verified</span>
            </div>
            <textarea
              rows={5}
              value={payloadJson}
              onChange={(e) => setPayloadJson(e.target.value)}
              className={`w-full px-3 py-2 bg-slate-950 border rounded-xl text-xs text-emerald-300 placeholder-slate-500 font-mono focus:outline-none transition ${
                fieldErrors.payload ? 'border-rose-500 focus:border-rose-500' : 'border-slate-800 focus:border-indigo-500'
              }`}
            />
            {fieldErrors.payload && (
              <p className="text-[11px] text-rose-400 mt-1 flex items-center gap-1">
                <AlertCircle className="w-3 h-3" />
                {fieldErrors.payload}
              </p>
            )}
          </div>

          {/* Max Retries & Timeout */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-slate-300 block mb-1">
                Max Retries
              </label>
              <input
                type="number"
                min={1}
                max={10}
                value={maxRetries}
                onChange={(e) => setMaxRetries(parseInt(e.target.value, 10))}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white font-mono focus:outline-none focus:border-indigo-500"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-300 block mb-1">
                Timeout (ms)
              </label>
              <input
                type="number"
                min={1000}
                max={15000}
                step={500}
                value={timeoutMs}
                onChange={(e) => setTimeoutMs(parseInt(e.target.value, 10))}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white font-mono focus:outline-none focus:border-indigo-500"
              />
            </div>
          </div>

          {/* Result Alert */}
          {result && (
            <div
              className={`p-3 rounded-xl border text-xs flex items-center gap-2 ${
                result.success
                  ? 'bg-emerald-950/60 border-emerald-800/80 text-emerald-300'
                  : 'bg-rose-950/60 border-rose-800/80 text-rose-300'
              }`}
            >
              {result.success ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
              ) : (
                <AlertCircle className="w-4 h-4 text-rose-400 flex-shrink-0" />
              )}
              <span>{result.message}</span>
            </div>
          )}

          {/* Submit Action */}
          <div className="pt-2 flex justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-medium text-slate-400 hover:text-white hover:bg-slate-800 transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs flex items-center gap-1.5 shadow-md shadow-indigo-950/50 disabled:opacity-50 transition"
            >
              <Send className="w-3.5 h-3.5" />
              <span>{submitting ? 'Dispatching...' : 'Dispatch Webhook'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
