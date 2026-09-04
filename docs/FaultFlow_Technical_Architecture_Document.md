**TECHNICAL ARCHITECTURE DOCUMENT (TAD)**

FaultFlow Engine: High-Throughput Webhook Orchestration, Ingestion Pipeline & Telemetry Gateway

| **Architecture Classification** | Distributed Asynchronous Event Broker & Telemetry Gateway |
| --- | --- |
| **Core Technology Stack** | Node.js (TypeScript), Express.js, Next.js, Redis 7 (BullMQ), PostgreSQL 16 |
| **Execution Model** | Containerized Multi-Node Service with Docker Compose & Linux VPS Deployment |
| **Author & Status** | Principal Cloud & Backend Systems Architect \| Production Baseline |

**1. System Components Breakdown**

The FaultFlow architecture strictly decouples low-latency HTTP ingress from asynchronous background execution, ensuring incoming network calls are acknowledged in sub-25ms regardless of downstream target responsiveness.

**1.1 Ingress Web Server (API Gateway)**

Runtime: Node.js 20+ LTS with TypeScript using Express.js / Fastify behind a reverse-proxy (Nginx / Cloudflare).

Responsibilities: Tenant authentication via hashed API keys, payload schema enforcement (Zod), cryptographic validation, and atomic idempotency gating via Redis.

Concurrency Model: Non-blocking single-threaded event loop scaled horizontally via Node.js cluster mode across available vCPU cores.

**1.2 Worker Cluster (Background Delivery Nodes)**

Runtime: Dedicated TypeScript background worker daemon consuming from BullMQ queues.

Responsibilities: Outbound HTTP dispatch, HMAC-SHA256 signature calculation, circuit-breaker evaluation, timeout enforcement (AbortController @ 5000ms), and Dead-Letter Queue (DLQ) state transitions.

Scalability: Workers scale independently of web servers based on Redis queue depth (Lag-based auto-scaling).

**1.3 In-Memory Broker & Cache Layer (Redis 7.x)**

Role: Transient state engine handling message brokering (BullMQ), atomic distributed locking (Redlock), sliding-window rate limiting, and 24-hour TTL idempotency caches.

Memory Management: Volatile LRU eviction policy enabled; hybrid storage design ensures payloads > 4KB are immediately offloaded to PostgreSQL, keeping Redis memory footprint strictly under 150MB.

**1.4 Durable Relational Store (PostgreSQL 16)**

Role: Source of truth for tenant configurations, append-only administrative audit logs, offloaded large payloads (> 4KB), and aggregated delivery telemetry.

Schema Optimization: Compound B-tree indices on (tenant_id, created_at) and (status, destination_url). Automated partitioned tables for historical event logs.

**1.5 Real-Time Telemetry & Observability Hub**

Engine: In-memory sliding ring-buffer with automated 2-second micro-batch flush to PostgreSQL.

Client Transport: Native Server-Sent Events (SSE) broadcasting real-time RPS, p50/p95/p99 latencies, and worker retry state deltas to the Next.js frontend.

**2. End-to-End Data Flow**

The lifecycle of an event follows an asynchronous pipeline optimized for reliability, deduplication, and zero payload drop:

**Step 1:** Client Dispatch: Tenant client executes POST /api/v1/events with JSON body, Idempotency-Key header, and X-API-Key.

**Step 2:** Ingress Authentication & Deduplication: API Gateway checks API key against in-memory tenant cache. It runs atomic SETNX in Redis for Idempotency-Key. If hit, returns cached 200 OK immediately; if new, reserves key with 24h TTL.

**Step 3:** Schema Validation & Hybrid Storage: Body validated via Zod. If size <= 4KB, payload is prepared for direct queue injection. If > 4KB, payload is written to PostgreSQL payload_blobs and replaced with payload_ref_id.

**Step 4:** Queue Ingestion & Client ACK: Event pushed to BullMQ active queue in Redis. API Gateway returns HTTP 202 Accepted with event_id in < 25ms.

**Step 5:** Worker Dispatch & Outbound Delivery: Worker node claims job from Redis, acquires distributed lock, generates HMAC-SHA256 signature header, and fires HTTP POST to destination endpoint with a 5000ms timeout.

**Step 6:** Resolution / Retry Routing: If destination responds 2xx, job completes, latency is buffered for micro-batch telemetry flush, and DB status marks DELIVERED. If 5xx/timeout/429, backoff calculator reschedules job into delayed queue. If 5 attempts fail, job moves to DLQ.

**3. Infrastructure & Deployment Architecture**

| **Layer** | **Recommended Technology** | **Configuration & Operational Strategy** |
| --- | --- | --- |
| Hosting Target | Single Linux VPS (2-4 vCPU, 4GB RAM) or Docker Swarm | Isolated container network. Eliminates multi-cloud free-tier cold starts, rate limits, and latency spikes. |
| Containerization | Docker & Docker Compose | Multi-stage Dockerfiles compiling TypeScript to lean production Alpine images (<120MB per container). |
| CI/CD Pipeline | GitHub Actions | Automated linting, Jest unit/integration tests, Docker container build, and automated SSH deployment on release merge. |
| Secrets Management | Environment (.env) & Docker Secrets | Secrets injected via environment variables; cryptographic keys and master DB strings never committed to Git. |

**4. Logging, Tracing & Observability Strategy**

Structured JSON Logging (Winston / Pino): Every log entry includes timestamp, tenant_id, event_id, worker_id, and trace_id. Formatted as NDJSON for fast parsing and zero console-formatting overhead.

Distributed Tracing & Error Tracking (Sentry): Sentry SDK integrated on both API and Worker processes. Unhandled exceptions or dead-letter transitions automatically capture request payloads, active queue length, and downstream response headers.

Performance Health Probes: /health/liveness checks basic container responsive loop; /health/readiness verifies active connection pools to Redis and PostgreSQL.

Telemetry Micro-Batcher: Worker attempts push execution metrics (duration_ms, http_status) to an internal ring buffer. A dedicated background interval executes single multi-row SQL INSERT every 2 seconds, reducing database I/O by 95%.

**5. Mermaid C4-Style Component Diagram**

The diagram below illustrates the exact architectural boundaries, network boundaries, and service relationships:

flowchart TB    classDef client fill:#1E3A8A,stroke:#0F172A,stroke-width:2px,color:#FFFFFF;    classDef gateway fill:#0F766E,stroke:#0F172A,stroke-width:2px,color:#FFFFFF;    classDef worker fill:#4338CA,stroke:#0F172A,stroke-width:2px,color:#FFFFFF;    classDef store fill:#D97706,stroke:#0F172A,stroke-width:2px,color:#FFFFFF;    classDef external fill:#475569,stroke:#0F172A,stroke-width:2px,color:#FFFFFF;    subgraph ExternalClients ["External Clients & Consumers"]        TenantApp[Tenant Application / Client API]:::client        DashboardUser[Admin / Developer Dashboard]:::client    end    subgraph IngressTier ["Edge & Ingress Tier (Reverse Proxy & API)"]        ReverseProxy[Nginx / Cloudflare Edge Gateway]:::gateway        API_Node[FaultFlow Express API Server]:::gateway        SSE_Server[Server-Sent Events Telemetry Broadcaster]:::gateway    end    subgraph StateAndQueue ["Broker & Storage Tier"]        RedisStore[(Redis 7.x Cluster / BullMQ Broker)]:::store        PostgresDB[(PostgreSQL 16 Durable Database)]:::store    end    subgraph ExecutionTier ["Asynchronous Execution Tier"]        WorkerPool[BullMQ Background Worker Cluster]:::worker        CircuitBreaker[In-Memory Circuit Breaker Registry]:::worker        DLQ_Replayer[DLQ Throttled Batch Replay Engine]:::worker    end    subgraph DownstreamSinks ["External Destination Webhooks"]        CustomerWebhook[Customer HTTP Webhook Receiver]:::external        MockChaosReceiver[Internal Chaos Testing Sandbox Receiver]:::external    end    %% Ingress Connections    TenantApp -->|POST /api/v1/events| ReverseProxy    DashboardUser -->|Manage & View Metrics| ReverseProxy    ReverseProxy -->|Proxy Pass| API_Node    ReverseProxy -->|SSE Stream /telemetry| SSE_Server    %% Ingress to Storage & Queues    API_Node -->|Atomic SETNX Check & Add Job| RedisStore    API_Node -->|Write Payloads > 4KB| PostgresDB    SSE_Server -->|Read Telemetry Deltas| RedisStore    %% Workers Execution    WorkerPool -->|Consume Jobs & Acquire Lock| RedisStore    WorkerPool -->|Resolve Large Payload Ref| PostgresDB    WorkerPool -->|Query / Update Target Status| CircuitBreaker    WorkerPool -->|Flush Micro-Batched Metrics| PostgresDB    %% Delivery Egress    WorkerPool -->|HTTP POST with HMAC Signature| CustomerWebhook    WorkerPool -->|Simulated HTTP Delivery| MockChaosReceiver    %% Failure & DLQ Actions    WorkerPool -->|Retries Exhausted: Evict to DLQ| RedisStore    WorkerPool -->|Write Failure Stack Trace| PostgresDB    DashboardUser -.->|Trigger DLQ Replay| DLQ_Replayer    DLQ_Replayer -->|Rate-Limited Ingestion <= 50 rps| RedisStore
