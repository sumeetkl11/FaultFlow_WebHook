-- FaultFlow Relational Database Schema
-- Multi-Tenant Webhook Ingress, Execution & Telemetry Store

CREATE TABLE IF NOT EXISTS tenants (
    id VARCHAR(64) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    api_key_hash VARCHAR(128) NOT NULL,
    signing_secret VARCHAR(128) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS event_blobs (
    id VARCHAR(64) PRIMARY KEY,
    body TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS events (
    id VARCHAR(64) PRIMARY KEY,
    tenant_id VARCHAR(64) REFERENCES tenants(id),
    idempotency_key VARCHAR(128) NOT NULL,
    target_url TEXT NOT NULL,
    event_type VARCHAR(64) NOT NULL,
    status VARCHAR(32) NOT NULL, -- 'QUEUED', 'PROCESSING', 'RETRYING', 'DELIVERED', 'DEAD_LETTERED'
    attempts INT DEFAULT 0,
    max_retries INT DEFAULT 5,
    timeout_ms INT DEFAULT 5000,
    latency_ms INT DEFAULT NULL,
    last_http_status INT DEFAULT NULL,
    payload_ref_id VARCHAR(64) REFERENCES event_blobs(id),
    inline_payload JSONB DEFAULT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    delivered_at TIMESTAMP WITH TIME ZONE DEFAULT NULL,
    CONSTRAINT uq_events_tenant_idempotency UNIQUE (tenant_id, idempotency_key)
);

CREATE TABLE IF NOT EXISTS dead_letter_queue (
    id VARCHAR(64) PRIMARY KEY,
    event_id VARCHAR(64) REFERENCES events(id),
    tenant_id VARCHAR(64) REFERENCES tenants(id),
    error_message TEXT,
    last_response_body TEXT,
    retry_count INT NOT NULL,
    dead_lettered_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS event_attempts (
    id BIGSERIAL PRIMARY KEY,
    event_id VARCHAR(64) REFERENCES events(id),
    attempt_number INT NOT NULL,
    http_status INT,
    latency_ms INT,
    error_message TEXT,
    attempted_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS audit_logs (
    id VARCHAR(64) PRIMARY KEY,
    tenant_id VARCHAR(64) REFERENCES tenants(id),
    action VARCHAR(64) NOT NULL,
    actor_id VARCHAR(64) NOT NULL,
    ip_address VARCHAR(45),
    details JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS telemetry_metrics (
    id BIGSERIAL PRIMARY KEY,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    throughput_rps INT DEFAULT 0,
    p50_ms INT DEFAULT 0,
    p95_ms INT DEFAULT 0,
    p99_ms INT DEFAULT 0,
    active_queue INT DEFAULT 0,
    delayed_queue INT DEFAULT 0,
    dlq_count INT DEFAULT 0,
    delivered_count INT DEFAULT 0,
    failed_count INT DEFAULT 0
);

-- Compound Indices
CREATE INDEX IF NOT EXISTS idx_events_tenant_created ON events (tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_events_status ON events (status);
CREATE INDEX IF NOT EXISTS idx_events_idempotency ON events (idempotency_key);
CREATE INDEX IF NOT EXISTS idx_dlq_tenant_created ON dead_letter_queue (tenant_id, dead_lettered_at DESC);
CREATE INDEX IF NOT EXISTS idx_attempts_event_id ON event_attempts (event_id, attempted_at ASC);
CREATE INDEX IF NOT EXISTS idx_telemetry_timestamp ON telemetry_metrics (timestamp DESC);
