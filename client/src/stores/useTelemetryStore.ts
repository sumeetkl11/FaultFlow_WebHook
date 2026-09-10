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

  // Sliding ring-buffer for live events (max 50) and O(1) index lookup map
  events: EventItem[];
  eventIndexMap: Record<string, number>;

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

function buildIndexMap(items: EventItem[]): Record<string, number> {
  const map: Record<string, number> = {};
  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    map[item.event_id] = i;
  }
  return map;
}

// Removed getInitialAudienceMode

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

  audienceMode: typeof window !== 'undefined' && localStorage.getItem('faultflow_audience_mode') === 'engineering' ? 'engineering' : 'business',
  bannerCollapsed: false,
  events: [],
  eventIndexMap: {},
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

  // 4.3 Atomic Telemetry Updates: synchronizes all metric streams into an atomic state snapshot
  updateTelemetry: (metrics) =>
    set((state) => {
      const nextThroughput = metrics.throughput_rps ?? state.throughputRps;
      const nextP50 = metrics.latency_percentiles?.p50_ms ?? state.p50Ms;
      const nextP95 = metrics.latency_percentiles?.p95_ms ?? state.p95Ms;
      const nextP99 = metrics.latency_percentiles?.p99_ms ?? state.p99Ms;
      const nextActive = metrics.queue_depth?.active ?? state.activeQueue;
      const nextDelayed = metrics.queue_depth?.delayed ?? state.delayedQueue;
      const nextDlq = metrics.queue_depth?.failed_dlq ?? state.dlqCount;
      const nextRescued = metrics.rescued_payloads ?? state.rescuedPayloads;
      const nextDedup = metrics.deduplications ?? state.deduplications;

      return {
        throughputRps: nextThroughput,
        p50Ms: nextP50,
        p95Ms: nextP95,
        p99Ms: nextP99,
        activeQueue: nextActive,
        delayedQueue: nextDelayed,
        dlqCount: nextDlq,
        rescuedPayloads: nextRescued,
        deduplications: nextDedup,
      };
    }),

  // 2.3 O(1) Zustand Lookup: direct map index resolution instead of O(N) array findIndex scan
  applyJobDelta: (delta) =>
    set((state) => {
      const existingIdx = state.eventIndexMap[delta.event_id];
      if (existingIdx !== undefined && state.events[existingIdx]?.event_id === delta.event_id) {
        const updatedEvents = [...state.events];
        updatedEvents[existingIdx] = {
          ...updatedEvents[existingIdx],
          ...delta,
          status: (delta.status ?? updatedEvents[existingIdx].status) as EventItem['status'],
        };
        return { events: updatedEvents };
      }

      // If not present in buffer, prepend new event
      const newEvent: EventItem = {
        event_id: delta.event_id,
        target_url: delta.target_url || 'https://unknown',
        event_type: delta.event_type || 'unknown',
        status: (delta.status as EventItem['status']) ?? 'QUEUED',
        attempts: delta.attempts || 0,
        latency_ms: delta.latency_ms ?? null,
        last_http_status: delta.last_http_status ?? null,
        created_at: new Date().toISOString(),
        next_retry_in_ms: delta.next_retry_in_ms,
      };

      const updated = [newEvent, ...state.events.slice(0, MAX_RING_BUFFER_SIZE - 1)];
      return {
        events: updated,
        eventIndexMap: buildIndexMap(updated),
      };
    }),

  setEvents: (events) => {
    const trimmed = events.slice(0, MAX_RING_BUFFER_SIZE);
    set({
      events: trimmed,
      eventIndexMap: buildIndexMap(trimmed),
    });
  },

  prependEvent: (event) =>
    set((state) => {
      const filtered = state.events.filter((e) => e.event_id !== event.event_id);
      const updated = [event, ...filtered.slice(0, MAX_RING_BUFFER_SIZE - 1)];
      return {
        events: updated,
        eventIndexMap: buildIndexMap(updated),
      };
    }),

  addChaosLog: (log) =>
    set((state) => ({
      chaosLogs: [log, ...state.chaosLogs.slice(0, 30)],
    })),

  addToast: (toast) => {
    const id = crypto.randomUUID();
    set((state) => ({
      toasts: [...state.toasts, { ...toast, id }],
    }));

    // Auto-dismiss after 4.5 seconds
    function autoDismiss() {
      set((state) => ({
        toasts: state.toasts.filter((t) => t.id !== id),
      }));
    }
    setTimeout(autoDismiss, 4500);
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
      eventIndexMap: buildIndexMap(prevEvents),
      activeQueue: prevActiveQueue !== undefined ? prevActiveQueue : state.activeQueue,
      dlqCount: prevDlqCount !== undefined ? prevDlqCount : state.dlqCount,
    })),
}));
