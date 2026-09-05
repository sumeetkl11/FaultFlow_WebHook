export interface EventItem {
  event_id: string;
  target_url: string;
  event_type: string;
  status: 'QUEUED' | 'PROCESSING' | 'RETRYING' | 'DELIVERED' | 'DEAD_LETTERED' | 'CIRCUIT_HOLD';
  attempts: number;
  max_retries?: number;
  latency_ms: number | null;
  last_http_status: number | null;
  created_at: string;
  delivered_at?: string | null;
  next_retry_in_ms?: number;
}

export interface AttemptRecord {
  attempt_number: number;
  response_status: number | null;
  latency_ms: number | null;
  error_message: string | null;
  timestamp: string;
}

export interface EventTraceDetails {
  event_id: string;
  tenant_id: string;
  status: string;
  event_type: string;
  target_url: string;
  idempotency_key: string;
  hmac_signature: string;
  payload: Record<string, any>;
  attempts_timeline: AttemptRecord[];
  created_at: string;
  delivered_at: string | null;
}

export interface TelemetryMetrics {
  timestamp: string;
  throughput_rps: number;
  latency_percentiles: {
    p50_ms: number;
    p95_ms: number;
    p99_ms: number;
  };
  queue_depth: {
    active: number;
    delayed: number;
    failed_dlq: number;
  };
  rescued_payloads: number;
  deduplications: number;
}

export interface ChaosConfig {
  simulated_status: 200 | 429 | 500 | 503 | 504;
  artificial_delay_ms: number;
  failure_rate_percent: number;
  updated_at?: string;
}

export interface DLQItem {
  dlq_id: string;
  event_id: string;
  error_message: string;
  retry_count: number;
  dead_lettered_at: string;
  target_url: string;
  event_type: string;
}
