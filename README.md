# FaultFlow: Resilient Multi-Tenant Webhook Orchestration & Telemetry Gateway

> A high-throughput, fault-tolerant webhook delivery broker and real-time observability platform. Features sub-25ms API ingress, atomic Redis `SETNX` idempotency, BullMQ worker clusters with cryptographic HMAC-SHA256 signing, exponential backoff with randomized jitter, Dead-Letter Queue (DLQ) remediation with 50 req/sec rate-throttling, Server-Sent Events (SSE) telemetry, and an interactive Chaos Testing Sandbox.

---

## 📸 Dashboard Overview & Screenshots

### 1. Operations Command Center (Main View)
Features real-time telemetry KPI cards, live event stream with animated status pills, and interactive failure injection sandbox.
![Dashboard Overview](docs/images/dashboard_overview.png)

### 2. Ingress Test Dispatcher Modal
Allows instant dispatch of test webhooks directly into FaultFlow with customizable target endpoints, event types, retries, and payloads.
![Dispatch Modal](docs/images/dispatch_modal.png)

### 3. Trace Inspector Drawer (Attempt Timeline & Payload Inspection)
Slide-over drawer providing granular delivery attempt timelines, formatted JSON payload viewer, and HMAC-SHA256 header validation.
![Trace Drawer Timeline](docs/images/drawer_timeline.png)
![Trace Drawer Payload](docs/images/drawer_payload.png)
![Trace Drawer Cryptographic Headers](docs/images/drawer_headers.png)

---

## 📖 Architecture & Specification Index

- **Product Requirements Document (PRD):** [`docs/Webhook_Telemetry_Platform_PRD.md`](docs/Webhook_Telemetry_Platform_PRD.md)
- **Technical Architecture Document (TAD):** [`docs/FaultFlow_Technical_Architecture_Document.md`](docs/FaultFlow_Technical_Architecture_Document.md)
- **User Flow & State Machine Specification:** [`docs/FaultFlow_UserFlow_StateMachine_Spec.md`](docs/FaultFlow_UserFlow_StateMachine_Spec.md)
- **RESTful API Specification:** [`docs/FaultFlow_API_Specification.md`](docs/FaultFlow_API_Specification.md)
- **Frontend Implementation Contract:** [`docs/FaultFlow_Frontend_Implementation_Contract.md`](docs/FaultFlow_Frontend_Implementation_Contract.md)
- **Master Implementation Plan:** [`docs/FaultFlow_Master_Implementation_Plan.md`](docs/FaultFlow_Master_Implementation_Plan.md)

---

## 🚀 Core Engine Architecture Highlights

1. **Sub-25ms Ingress Gateway:** Express + Zod payload validation with atomic Redis `SETNX` idempotency check (24h TTL). Duplicate requests return instant `200 OK` without re-queuing duplicate jobs.
2. **Hybrid Storage Engine:** Payloads <= 4KB stored inline; payloads > 4KB offloaded to PostgreSQL `event_blobs` and enqueued as lightweight pointers in Redis BullMQ (<150MB memory footprint).
3. **Fault-Tolerant Delivery Workers:** Concurrency = 20 workers. Computes HMAC-SHA256 signature headers (`X-Signature: sha256=...`, `X-Timestamp`). Enforces 5000ms `AbortController` timeouts.
4. **Circuit Breaker & Exponential Backoff:** Trips host endpoints logging >= 10 failures in 30s for 5 minutes. Appears backoff delays with +/- 15% randomized jitter (5s, 30s, 2m, 15m).
5. **Dead-Letter Queue (DLQ) Remediation:** 5 exhausted attempt eviction to DLQ with error stack traces. Token-bucket rate limiter caps batch replays at **50 req/sec**.
6. **Real-Time Telemetry & Chaos Sandbox:** In-memory ring buffer with 2-second micro-batch SQL flush. Server-Sent Events (SSE) stream emits `telemetry_update`, `job_state_delta`, and `dlq_alert`. Interactive Chaos sandbox simulates HTTP 500, 429, 504, and artificial delay.

---

## 🛠️ Tech Stack

- **Backend:** Node.js (v24), TypeScript 5, Express.js, PostgreSQL 16+, Redis 8 (BullMQ), ioredis, pg, Zod, Pino.
- **Frontend:** Next.js 14+ (App Router), TypeScript, TailwindCSS, TanStack Query v5, Zustand v4, Lucide React, EventSource (SSE).
- **Orchestration:** Docker & Docker Compose (`docker-compose.yml`).

---

## ⚡ Quickstart & Local Setup

### 1. Prerequisites
- Node.js `v20+` & npm `10+`
- PostgreSQL 16+ (or Neon PostgreSQL)
- Redis 7+ (or Redis 8)

### 2. Installation
```bash
# Clone repository
git clone https://github.com/sumeetkl11/FaultFlow_WebHook.git
cd FaultFlow_WebHook

# Install backend dependencies
cd server
npm install

# Install frontend dependencies
cd ../client
npm install
```

### 3. Environment Configuration (`server/.env`)
```ini
PORT=4000
NODE_ENV=development
LOG_LEVEL=info

# Database & Broker
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/faultflow_db"
REDIS_URL=redis://localhost:6380

# Security Credentials & Default Tenant
DEFAULT_TENANT_ID=org_live_faultflow_demo
DEFAULT_API_KEY=org_live_sk_faultflow_test_key_2026
DEFAULT_SIGNING_SECRET=whsec_faultflow_super_secret_signing_key_99
```

### 4. Database Migration
```bash
cd server
npm run migrate
```

### 5. Running the Application

**Start Backend Server (`http://localhost:4000`):**
```bash
cd server
npm run dev
```

**Start Frontend Operations Dashboard (`http://localhost:3000`):**
```bash
cd client
npm run dev
```

---

## 🧪 Testing & Verification

### Automated Integration Test Suite
Executes end-to-end tests for health probes, atomic SETNX idempotency, chaos injection, DLQ transitions, and rate-throttled replays:
```bash
cd server
npm test
```

Expected Output:
```
--- Starting FaultFlow Automated Integration Tests ---
Test 1: Health Readiness Probe
✓ Health Readiness passed.
Test 2: Ingress & Atomic Idempotency Dedup
✓ Ingress & Idempotency passed.
Test 3: Chaos Injection & DLQ Route
✓ Chaos failure & DLQ transition passed.
Test 4: DLQ Replay Recovery
✓ DLQ replay and delivery recovery passed.

All FaultFlow Integration Tests PASSED successfully!
```

---

## 📡 API Reference Summary

| Method | Endpoint | Description | Auth Required |
| --- | --- | --- | --- |
| `GET` | `/health/readiness` | Connection pool readiness check (DB & Redis) | No |
| `POST` | `/api/v1/events` | Ingest webhook event (<25ms, atomic dedup) | `X-API-Key` |
| `GET` | `/api/v1/events` | List historical paginated event logs | `X-API-Key` |
| `GET` | `/api/v1/events/:id` | Event trace details, timeline & HMAC signature | `X-API-Key` |
| `POST` | `/api/v1/dlq/replay` | Throttled batch/selective DLQ replay (50 rps) | `X-API-Key` |
| `POST` | `/api/v1/chaos/config` | Update sandbox failure mode (200/500/429/delay) | `X-API-Key` |
| `ALL` | `/api/v1/chaos/sink` | Internal mock destination sink executing chaos | No |
| `GET` | `/api/v1/telemetry/stream` | Persistent Server-Sent Events (SSE) stream | `X-API-Key` |
