import { create } from 'zustand';
import { EventItem, TelemetryMetrics } from '../types';

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

  // Sliding ring-buffer for live events (max 50)
  events: EventItem[];

  // Chaos logs feed
  chaosLogs: string[];

  // Actions
  setSseConnected: (connected: boolean) => void;
  updateTelemetry: (metrics: Partial<TelemetryMetrics>) => void;
  applyJobDelta: (delta: Partial<EventItem> & { event_id: string }) => void;
  setEvents: (events: EventItem[]) => void;
  prependEvent: (event: EventItem) => void;
  addChaosLog: (log: string) => void;
}

const MAX_RING_BUFFER_SIZE = 50;

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
  events: [],
  chaosLogs: [],

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
          status: delta.status as any || 'QUEUED',
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
      // Avoid duplicate by event_id
      const filtered = state.events.filter((e) => e.event_id !== event.event_id);
      return { events: [event, ...filtered.slice(0, MAX_RING_BUFFER_SIZE - 1)] };
    }),

  addChaosLog: (log) =>
    set((state) => ({
      chaosLogs: [log, ...state.chaosLogs.slice(0, 30)],
    })),
}));
