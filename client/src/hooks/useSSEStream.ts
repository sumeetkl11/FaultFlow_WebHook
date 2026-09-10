import { useEffect, useRef } from 'react';
import { useTelemetryStore } from '../stores/useTelemetryStore';
import { DEFAULT_API_KEY } from '../lib/api';

export function useSSEStream() {
  const { updateTelemetry, applyJobDelta, setSseConnected, addChaosLog } = useTelemetryStore();
  const eventSourceRef = useRef<EventSource | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectDelayRef = useRef(1000);

  // Keep latest actions in a ref to eliminate stale closures without triggering reconnect cycles
  const actionsRef = useRef({ updateTelemetry, applyJobDelta, setSseConnected, addChaosLog });
  useEffect(() => {
    actionsRef.current = { updateTelemetry, applyJobDelta, setSseConnected, addChaosLog };
  }, [updateTelemetry, applyJobDelta, setSseConnected, addChaosLog]);

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
        actionsRef.current.setSseConnected(true);
        reconnectDelayRef.current = 1000;
      };

      es.addEventListener('telemetry_update', (e: MessageEvent) => {
        if (!isMounted) return;
        try {
          const data = JSON.parse(e.data);
          actionsRef.current.updateTelemetry(data);
        } catch {
          // Ignore malformed message
        }
      });

      es.addEventListener('job_state_delta', (e: MessageEvent) => {
        if (!isMounted) return;
        try {
          const data = JSON.parse(e.data);
          actionsRef.current.applyJobDelta(data);
        } catch {
          // Ignore malformed message
        }
      });

      es.addEventListener('dlq_alert', (e: MessageEvent) => {
        if (!isMounted) return;
        try {
          const data = JSON.parse(e.data);
          actionsRef.current.addChaosLog(`[ALERT] Job ${data.event_id} dead-lettered after ${data.attempts} attempts`);
        } catch {
          // Ignore
        }
      });

      es.onerror = () => {
        if (!isMounted) return;
        actionsRef.current.setSseConnected(false);
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
