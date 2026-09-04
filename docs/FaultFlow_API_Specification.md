**RESTFUL API SPECIFICATION (OPENAPI 3.1 COMPATIBLE)**

FaultFlow Engine: Production Ingestion, Telemetry Streaming & DLQ Control Plane

| **Base Ingress URL** | https://api.faultflow.local/api/v1 |
| --- | --- |
| **Authentication Standard** | API Key Header (X-API-Key) & Cryptographic Signature (X-Signature) |
| **Data Format & Encoding** | application/json; charset=utf-8 |
| **Target Service Tier** | Multi-Tenant Webhook Broker, Telemetry Pipeline & Chaos Sandbox |

**1. Standard Global Error Envelope**

All 4xx and 5xx responses strictly adhere to the standardized RFC 7807 problem details JSON format:

{  "error": {    "code": "VALIDATION_FAILED",    "message": "The provided request payload failed schema validation.",    "status": 400,    "timestamp": "2026-09-04T09:47:00.000Z",    "request_id": "req_8f1b2c3d4e",    "details": [      {        "field": "target_url",        "issue": "Invalid URL format. Must begin with http:// or https://"      }    ]  }}

**2. Comprehensive API Endpoints Specification**

**2.1 Ingest Event Payload**

**Route Definition:** POST /api/v1/events

**Purpose:** Ingests incoming client event payload into BullMQ asynchronous worker pipeline. Performs atomic Redis SETNX idempotency validation and schema check in < 25ms.

**Auth & Roles:** X-API-Key: org_live_... (Required). Roles Allowed: System, Admin, User.

**Required Headers:** Idempotency-Key: <UUIDv4> (Required, length 36), Content-Type: application/json (Required).

**Request Schema:** Request Payload Structure & Zod Validation Rules:

**•** target_url (string, required): RFC-3986 valid URL format, length 10-2048 chars.

**•** event_type (string, required): RegEx ^[a-z0-9_.-]+$, length 3-64 chars (e.g., payment.succeeded).

**•** payload (object, required): Valid JSON object, max size 1MB (payloads > 4KB offload to PostgreSQL).

**•** max_retries (integer, optional): Min 1, Max 10. Default: 5.

**•** timeout_ms (integer, optional): Min 1000, Max 15000. Default: 5000.

// POST /api/v1/events{  "target_url": "https://api.merchant.com/webhooks",  "event_type": "invoice.paid",  "payload": {    "invoice_id": "inv_99812",    "amount": 4900,    "currency": "USD"  },  "max_retries": 5,  "timeout_ms": 5000}

**Response Payload:** Successful Response (HTTP 202 Accepted):

{  "success": true,  "status": 202,  "data": {    "event_id": "evt_01J6X8QZ9N00K4A8B9C1",    "status": "QUEUED",    "idempotency_cached": false,    "enqueued_at": "2026-09-04T09:47:01.120Z"  }}

**Error Codes:** Standard Response Errors:

**•** HTTP 400 Bad Request: Malformed JSON or Zod validation errors on fields.

**•** HTTP 401 Unauthorized: Missing or invalid X-API-Key.

**•** HTTP 403 Forbidden: Tenant account suspended or API key lacks ingestion scope.

**•** HTTP 429 Too Many Requests: Ingestion rate limit exceeded (sliding-window limit: 2,000 req/min).

**•** HTTP 500 Internal Server Error: Redis broker connection failure (triggers WAL fallback).

**2.2 List Event Logs & Statuses**

**Route Definition:** GET /api/v1/events

**Purpose:** Retrieves paginated historical logs and execution statuses for the authenticated tenant.

**Auth & Roles:** X-API-Key: org_live_... (Required). Roles Allowed: Admin, User, Guest.

**Request Filters:** Query Parameters & Pagination:

**•** limit (integer, optional): Default: 20, Min: 1, Max: 100.

**•** offset (integer, optional): Default: 0, Min: 0.

**•** status (string, optional): Filter by QUEUED, DELIVERING, DELIVERED, RETRYING, DEAD_LETTERED.

**•** event_type (string, optional): Filter by exact event type string.

**•** start_time / end_time (ISO 8601 string, optional): Date range filter.

**Response Payload:** Successful Response (HTTP 200 OK):

{  "success": true,  "status": 200,  "meta": {    "total_count": 1420,    "limit": 20,    "offset": 0  },  "data": [    {      "event_id": "evt_01J6X8QZ9N00K4A8B9C1",      "target_url": "https://api.merchant.com/webhooks",      "event_type": "invoice.paid",      "status": "DELIVERED",      "attempts": 2,      "latency_ms": 184,      "last_http_status": 200,      "created_at": "2026-09-04T09:47:01.120Z",      "delivered_at": "2026-09-04T09:47:06.304Z"    }  ]}

**2.3 Retrieve Event Lifecycle & Trace Details**

**Route Definition:** GET /api/v1/events/:id

**Purpose:** Fetches granular delivery timelines, request/response headers, HMAC signature hashes, and error stack traces for a specific event.

**Auth & Roles:** X-API-Key: org_live_... (Required). Roles Allowed: Admin, User, Guest.

**Path Validation:** URL Parameter :id must match RegEx ^evt_[a-zA-Z0-9]+$ (length 24). Returns 400 if malformed.

**Response Payload:** Successful Response (HTTP 200 OK):

{  "success": true,  "status": 200,  "data": {    "event_id": "evt_01J6X8QZ9N00K4A8B9C1",    "tenant_id": "org_98a72b",    "status": "DELIVERED",    "idempotency_key": "9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d",    "hmac_signature": "sha256=d58d929b3c3e8ecb97453006d9d435cb74",    "attempts_timeline": [      {        "attempt": 1,        "timestamp": "2026-09-04T09:47:01.200Z",        "response_status": 504,        "latency_ms": 5002,        "error_message": "ETIMEDOUT: Target did not respond within 5000ms"      },      {        "attempt": 2,        "timestamp": "2026-09-04T09:47:06.120Z",        "response_status": 200,        "latency_ms": 184,        "error_message": null      }    ]  }}

**• Error Code:** HTTP 404 Not Found: Returns 404 when the event_id does not exist or belongs to another tenant.

**2.4 Replay Dead-Letter Queue (DLQ) Events**

**Route Definition:** POST /api/v1/dlq/replay

**Purpose:** Re-enqueues exhausted jobs from the Dead-Letter Queue back into the active delivery pipeline using token-bucket rate throttling (max 50 events/sec).

**Auth & Roles:** X-API-Key: org_live_... (Required). Roles Allowed: Admin exclusively (User / Guest get 403 Forbidden).

**Request Schema:** Request Payload Structure & Rules:

**•** mode (string, required): Either 'SELECTIVE' or 'BATCH_ALL'.

**•** event_ids (array of strings, optional): Required if mode == 'SELECTIVE', max 250 UUID strings.

// POST /api/v1/dlq/replay{  "mode": "SELECTIVE",  "event_ids": [    "evt_01J6X8QZ9N00K4A8B9C1",    "evt_01J6X8QZ9N00K4A8B9C2"  ]}

**Response Payload:** Successful Response (HTTP 200 OK):

{  "success": true,  "status": 200,  "data": {    "replayed_count": 2,    "throttle_rate_per_sec": 50,    "queued_at": "2026-09-04T09:48:00.000Z"  }}

**• Error Code:** HTTP 403 Forbidden: Returned if requested by a non-Admin user.

**2.5 Chaos Testing Sandbox & Failure Injector**

**Route Definition:** POST /api/v1/chaos/config

**Purpose:** Configures dynamic failure modes on the internal mock endpoint (/api/v1/chaos/sink) to simulate downstream dropouts during live recruiter/demo sessions.

**Auth & Roles:** X-API-Key: org_live_... (Required). Roles Allowed: Admin, User.

**Request Schema:** Request Payload Structure & Rules:

**•** simulated_status (integer, required): Enum [200, 429, 500, 503, 504].

**•** artificial_delay_ms (integer, required): Min: 0, Max: 6000.

**•** failure_rate_percent (integer, required): Min: 0, Max: 100 (e.g., 50 for 50% random failure).

// POST /api/v1/chaos/config{  "simulated_status": 500,  "artificial_delay_ms": 2500,  "failure_rate_percent": 100}

**Response Payload:** Successful Response (HTTP 200 OK):

{  "success": true,  "status": 200,  "data": {    "simulated_status": 500,    "artificial_delay_ms": 2500,    "failure_rate_percent": 100,    "updated_at": "2026-09-04T09:48:15.000Z"  }}

**2.6 Real-Time Telemetry Event Stream**

**Route Definition:** GET /api/v1/telemetry/stream

**Purpose:** Persistent Server-Sent Events (SSE) stream providing real-time engine throughput, p50/p95 latencies, and attempt state deltas.

**Auth & Roles:** X-API-Key: org_live_... (Passed via query param ?token= or Authorization header). Roles Allowed: Admin, User, Guest.

**Headers:** Accept: text/event-stream (Required). Content-Type returned: text/event-stream; charset=utf-8.

**Stream Frame Payload:** Streamed SSE Event Payload Example:

event: telemetry_updatedata: {  "timestamp": "2026-09-04T09:48:30.000Z",  "throughput_rps": 342,  "latency_percentiles": {    "p50_ms": 28,    "p95_ms": 94,    "p99_ms": 142  },  "queue_depth": {    "active": 45,    "delayed": 12,    "failed_dlq": 3  }}
