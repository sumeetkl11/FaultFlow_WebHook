import { create } from 'zustand';
import { EventItem, TelemetryMetrics } from '../types';

export type AudienceMode = 'business' | 'engineering';

export interface ToastMessage {
  id: string;
  type: 'success' | 'error' | 'info' | 'warning';
  title: string;
  message: string;
}

interface TelemetryState {
  // Real-time metric counters
  throughputRps: number;
  p50Ms: number;
  p95Ms: number;
  p99Ms: number;
  activeQueue: number;
  delayedQueue: number;
  dlqCount: number;
  rescuedPayloads: number;
  deduplications: number;
  sseConnected: boolean;

  // Dual Audience Mode ('business' | 'engineering')
  audienceMode: AudienceMode;
  bannerCollapsed: boolean;

  // Sliding ring-buffer for live events (max 50)
  events: EventItem[];

  // Chaos logs feed
  chaosLogs: string[];

  // Toast notifications
  toasts: ToastMessage[];

  // Actions
  setAudienceMode: (mode: AudienceMode) => void;
  toggleBanner: () => void;
  setSseConnected: (connected: boolean) => void;
  updateTelemetry: (metrics: Partial<TelemetryMetrics>) => void;
  applyJobDelta: (delta: Partial<EventItem> & { event_id: string }) => void;
  setEvents: (events: EventItem[]) => void;
  prependEvent: (event: EventItem) => void;
  addChaosLog: (log: string) => void;
  addToast: (toast: Omit<ToastMessage, 'id'>) => void;
  removeToast: (id: string) => void;
  optimisticReplay: (eventIds: string[]) => void;
  rollbackEvents: (prevEvents: EventItem[], prevActiveQueue?: number, prevDlqCount?: number) => void;
}

const MAX_RING_BUFFER_SIZE = 50;

// Helper to read initial audience mode from localStorage if available
const getInitialAudienceMode = (): AudienceMode => {
  if (typeof window !== 'undefined') {
    const saved = localStorage.getItem('faultflow_audience_mode');
    if (saved === 'engineering' || saved === 'business') {
      return saved;
    }
  }
  return 'business';
};

export const useTelemetryStore = create<TelemetryState>((set) => ({
  throughputRps: 0,
  p50Ms: 0,
  p95Ms: 0,
  p99Ms: 0,
  activeQueue: 0,
  delayedQueue: 0,
  dlqCount: 0,
  rescuedPayloads: 0,
  deduplications: 0,
  sseConnected: false,

  audienceMode: getInitialAudienceMode(),
  bannerCollapsed: false,
  events: [],
  chaosLogs: [],
  toasts: [],

  setAudienceMode: (mode) => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('faultflow_audience_mode', mode);
    }
    set({ audienceMode: mode });
  },

  toggleBanner: () => set((state) => ({ bannerCollapsed: !state.bannerCollapsed })),

  setSseConnected: (connected) => set({ sseConnected: connected }),

  updateTelemetry: (metrics) =>
    set((state) => ({
      throughputRps: metrics.throughput_rps ?? state.throughputRps,
      p50Ms: metrics.latency_percentiles?.p50_ms ?? state.p50Ms,
      p95Ms: metrics.latency_percentiles?.p95_ms ?? state.p95Ms,
      p99Ms: metrics.latency_percentiles?.p99_ms ?? state.p99Ms,
      activeQueue: metrics.queue_depth?.active ?? state.activeQueue,
      delayedQueue: metrics.queue_depth?.delayed ?? state.delayedQueue,
      dlqCount: metrics.queue_depth?.failed_dlq ?? state.dlqCount,
      rescuedPayloads: metrics.rescued_payloads ?? state.rescuedPayloads,
      deduplications: metrics.deduplications ?? state.deduplications,
    })),

  applyJobDelta: (delta) =>
    set((state) => {
      const index = state.events.findIndex((e) => e.event_id === delta.event_id);
      if (index === -1) {
        // If not found in buffer, prepend it
        const newEvent: EventItem = {
          event_id: delta.event_id,
          target_url: delta.target_url || 'https://unknown',
          event_type: delta.event_type || 'unknown',
          status: (delta.status as any) || 'QUEUED',
          attempts: delta.attempts || 0,
          latency_ms: delta.latency_ms ?? null,
          last_http_status: delta.last_http_status ?? null,
          created_at: new Date().toISOString(),
          next_retry_in_ms: delta.next_retry_in_ms,
        };
        const updated = [newEvent, ...state.events.slice(0, MAX_RING_BUFFER_SIZE - 1)];
        return { events: updated };
      }

      const updated = [...state.events];
      updated[index] = {
        ...updated[index],
        ...delta,
        status: (delta.status || updated[index].status) as any,
      };
      return { events: updated };
    }),

  setEvents: (events) => set({ events: events.slice(0, MAX_RING_BUFFER_SIZE) }),

  prependEvent: (event) =>
    set((state) => {
      const filtered = state.events.filter((e) => e.event_id !== event.event_id);
      return { events: [event, ...filtered.slice(0, MAX_RING_BUFFER_SIZE - 1)] };
    }),

  addChaosLog: (log) =>
    set((state) => ({
      chaosLogs: [log, ...state.chaosLogs.slice(0, 30)],
    })),

  addToast: (toast) => {
    const id = `toast_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    set((state) => ({
      toasts: [...state.toasts, { ...toast, id }],
    }));

    // Auto-dismiss after 4.5 seconds
    setTimeout(() => {
      set((state) => ({
        toasts: state.toasts.filter((t) => t.id !== id),
      }));
    }, 4500);
  },

  removeToast: (id) =>
    set((state) => ({
      toasts: state.toasts.filter((t) => t.id !== id),
    })),

  optimisticReplay: (eventIds) =>
    set((state) => {
      const count = eventIds.length;
      const updatedEvents = state.events.map((e) => {
        if (eventIds.includes(e.event_id)) {
          return {
            ...e,
            status: 'QUEUED' as const,
            next_retry_in_ms: undefined,
          };
        }
        return e;
      });

      return {
        events: updatedEvents,
        activeQueue: state.activeQueue + count,
        dlqCount: Math.max(0, state.dlqCount - count),
      };
    }),

  rollbackEvents: (prevEvents, prevActiveQueue, prevDlqCount) =>
    set((state) => ({
      events: prevEvents,
      activeQueue: prevActiveQueue !== undefined ? prevActiveQueue : state.activeQueue,
      dlqCount: prevDlqCount !== undefined ? prevDlqCount : state.dlqCount,
    })),
}));
