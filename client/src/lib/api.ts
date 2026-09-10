import { EventItem, EventTraceDetails, ChaosConfig, DLQItem } from '../types';

const API_BASE = '/api/v1';
export const DEFAULT_API_KEY = 'org_live_sk_faultflow_test_key_2026';

async function fetchWithAuth<T>(url: string, options: RequestInit = {}): Promise<T> {
  const headers = new Headers(options.headers || {});
  if (!headers.has('X-API-Key')) {
    headers.set('X-API-Key', DEFAULT_API_KEY);
  }
  if (!headers.has('Content-Type') && options.method && options.method !== 'GET') {
    headers.set('Content-Type', 'application/json');
  }

  const response = await fetch(url, {
    ...options,
    headers,
  });

  if (!response.ok) {
    let errorData: any;
    try {
      errorData = await response.json();
    } catch {
      errorData = { message: `Request failed with status ${response.status}` };
    }
    throw new Error(errorData.error?.message || errorData.message || 'Request failed');
  }

  return response.json();
}

export const api = {
  async getEvents(params: { limit?: number; offset?: number; status?: string; event_type?: string } = {}) {
    const query = new URLSearchParams(
      Object.entries(params)
        .filter(([_, v]) => v !== undefined)
        .map(([k, v]) => [k, String(v)])
    );

    return fetchWithAuth<{
      success: boolean;
      meta: { total_count: number; limit: number; offset: number };
      data: EventItem[];
    }>(`${API_BASE}/events?${query.toString()}`);
  },

  async getEventTrace(id: string) {
    return fetchWithAuth<{
      success: boolean;
      data: EventTraceDetails;
    }>(`${API_BASE}/events/${id}`);
  },

  async getDlqEvents(limit = 20, offset = 0) {
    return fetchWithAuth<{
      success: boolean;
      meta: { total_count: number; limit: number; offset: number };
      data: DLQItem[];
    }>(`${API_BASE}/dlq?limit=${limit}&offset=${offset}`);
  },

  async replayDlq(mode: 'SELECTIVE' | 'BATCH_ALL', eventIds?: string[]) {
    return fetchWithAuth<{
      success: boolean;
      data: { replayed_count: number; throttle_rate_per_sec: number; queued_at: string };
    }>(`${API_BASE}/dlq/replay`, {
      method: 'POST',
      body: JSON.stringify({ mode, event_ids: eventIds }),
    });
  },

  async getChaosConfig() {
    return fetchWithAuth<{
      success: boolean;
      data: ChaosConfig;
    }>(`${API_BASE}/chaos/config`);
  },

  async updateChaosConfig(config: ChaosConfig) {
    return fetchWithAuth<{
      success: boolean;
      data: ChaosConfig;
    }>(`${API_BASE}/chaos/config`, {
      method: 'POST',
      body: JSON.stringify(config),
    });
  },

  async getChaosLogs() {
    return fetchWithAuth<{
      success: boolean;
      data: any[];
    }>(`${API_BASE}/chaos/logs`);
  },

  async ingestEvent(data: {
    target_url: string;
    event_type: string;
    payload: Record<string, any>;
    max_retries?: number;
    timeout_ms?: number;
    idempotency_key?: string;
  }) {
    const idempotencyKey = data.idempotency_key || crypto.randomUUID();

    return fetchWithAuth<{
      success: boolean;
      data?: { event_id: string; status: string; idempotency_cached: boolean };
      message?: string;
    }>(`${API_BASE}/events`, {
      method: 'POST',
      headers: {
        'Idempotency-Key': idempotencyKey,
      },
      body: JSON.stringify({
        target_url: data.target_url,
        event_type: data.event_type,
        payload: data.payload,
        max_retries: data.max_retries || 5,
        timeout_ms: data.timeout_ms || 5000,
      }),
    });
  },
};
