import { useEffect, useRef } from 'react';
import { useTelemetryStore } from '../stores/useTelemetryStore';
import { DEFAULT_API_KEY } from '../lib/api';

export function useSSEStream() {
  const eventSourceRef = useRef<EventSource | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectDelayRef = useRef(1000);

  useEffect(() => {
    let isMounted = true;

    function connect() {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }

      const streamUrl = `/api/v1/telemetry/stream?token=${DEFAULT_API_KEY}`;
      const es = new EventSource(streamUrl);
      eventSourceRef.current = es;

      es.onopen = () => {
        if (!isMounted) return;
        useTelemetryStore.getState().setSseConnected(true);
        reconnectDelayRef.current = 1000;
      };

      es.addEventListener('telemetry_update', (e: MessageEvent) => {
        if (!isMounted) return;
        try {
          useTelemetryStore.getState().updateTelemetry(JSON.parse(e.data));
        } catch {}
      });

      es.addEventListener('job_state_delta', (e: MessageEvent) => {
        if (!isMounted) return;
        try {
          useTelemetryStore.getState().applyJobDelta(JSON.parse(e.data));
        } catch {}
      });

      es.addEventListener('dlq_alert', (e: MessageEvent) => {
        if (!isMounted) return;
        try {
          const data = JSON.parse(e.data);
          useTelemetryStore.getState().addChaosLog(`[ALERT] Job ${data.event_id} dead-lettered after ${data.attempts} attempts`);
        } catch {}
      });

      es.onerror = () => {
        if (!isMounted) return;
        useTelemetryStore.getState().setSseConnected(false);
        es.close();

        // Exponential reconnect (1s, 2s, 4s, 8s, 10s max)
        const nextDelay = Math.min(reconnectDelayRef.current * 2, 10000);
        reconnectDelayRef.current = nextDelay;

        reconnectTimeoutRef.current = setTimeout(() => {
          if (isMounted) connect();
        }, nextDelay);
      };
    }

    connect();

    return () => {
      isMounted = false;
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
    };
  }, []);
}
