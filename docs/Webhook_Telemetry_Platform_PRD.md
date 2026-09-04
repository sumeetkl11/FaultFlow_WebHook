**PRODUCT REQUIREMENTS DOCUMENT (PRD)**

System Specification: Resilient Multi-Tenant Webhook Orchestration & Telemetry Gateway (FaultFlow Engine)

| **Document Version** | 1.0.0-PROD (Sprint Zero Baseline) |
| --- | --- |
| **Target Architecture** | Unified 3-in-1 Gateway: Multi-Tenant Ingress, Distributed BullMQ Worker, Ingestion Telemetry |
| **Primary Target Runtime** | Node.js / TypeScript, Redis, PostgreSQL (Isolated Dockerized Service) |
| **Document Owner** | Lead Technical Product Manager & System Architect |

**1. Executive Summary & Core Value**

Modern web architectures and payment ecosystems (e.g., Stripe, Shopify, GitHub, custom ERPs) rely heavily on asynchronous event notifications via HTTP Webhooks. However, standard backend implementations treat webhooks as synchronous 'happy-path' fire-and-forget HTTP calls, creating severe operational liabilities:

**• Target Unreliability:** Destination Downtime: Downstream client servers experience crashes, cold starts, and network partitions, causing outright payload drops.

**• Cascading Exhaustion:** Traffic Spikes: Flash traffic floods recipient databases with concurrent database writes, triggering complete downstream collapse.

**• Missing Idempotency:** Duplicate Executions: Network dropouts cause retries that double-bill accounts or execute identical side-effects multiple times.

**• Data Sovereignty & Cost:** SaaS Cost Traps: Commercial solutions (Svix, Inngest) enforce expensive per-event meter pricing while exposing sensitive user payload data to third parties.

**System Objective:** Core Solution Value:

This platform (FaultFlow Engine) is an open-source, container-orchestrated, resilient multi-tenant webhook delivery and real-time observability gateway. It combines three mission-critical domains into one lightweight system: (1) An isolated Multi-Tenant API Ingress with cryptographic signature signing; (2) A fault-tolerant Redis-backed Task Queue supporting deterministic exponential backoff and Dead-Letter Queues (DLQ); and (3) An integrated streaming telemetry visualizer and local Chaos Testing Sandbox. It delivers enterprise-grade reliability with zero cloud runtime costs and complete tenant isolation.

**2. User Personas & Access Roles**

The system enforces strict Role-Based Access Control (RBAC) and tenant partitioning across all management endpoints and the UI.

| **Role** | **Access Scope & Permissions** | **Enforcement Boundary** |
| --- | --- | --- |
| Admin (DevOps/Lead) | Full tenant provisioning, API key revocation, circuit-breaker threshold configuration, manual mass-replay of Dead-Letter Queues, audit log exports. | Global / Multi-Tenant scoped |
| User (Developer) | Register endpoints, view tenant-scoped event logs, inspect delivery latencies, trigger single-job replays, execute Chaos Sandbox stress tests. | Strict tenant_id partition |
| System (Machine/Worker) | Automated ingestion authentication via X-API-Key, internal worker queue consumption, micro-batch telemetry flush, DLQ routing. | Worker daemon service account |
| Guest (Observer/Auditor) | Read-only access to anonymized dashboard metrics, aggregated latency graphs, and endpoint health status. Cannot view decrypted raw payloads. | Tenant read-only policy |

**3. Functional Requirements**

**3.1 Ingestion & Gateway Layer**

**• Ingestion Endpoint:** Expose authenticated REST endpoint (POST /api/v1/events) parsing incoming payloads with strict Zod schema validation.

**• Idempotency Gate:** Support client-supplied Idempotency-Key header. Check key existence in Redis via atomic SETNX with 24-hour TTL; return immediate 200 OK without re-enqueueing duplicate tasks.

**• Cryptographic Signing:** Sign all outbound payloads using HMAC-SHA256 headers (X-Signature, X-Timestamp) derived from tenant endpoint secrets to guarantee payload integrity.

**• Tenant Scoping:** Verify hashed API keys (argon2id or sha256 with tenant salt) within memory cache before allowing event ingress.

**3.2 Queue Execution & Fault Tolerance Engine**

**• Asynchronous Pipeline:** Utilize Redis-backed BullMQ priority queues with separate lanes for standard delivery, delayed retry, and Dead-Letter Queue (DLQ).

**• Exponential Backoff:** Configurable retry strategy: Attempt 1 at +5s, Attempt 2 at +30s, Attempt 3 at +2m, Attempt 4 at +15m with randomized jitter (+/- 15%) to prevent thundering herds.

**• Dead-Letter Queue (DLQ):** Jobs failing after max attempts (default: 5) are transitioned to the Dead-Letter Queue with full stack trace, last status code, and payload preservation.

**• Replay Capability:** Provide one-click batch replay and selective single-event re-queueing from the DLQ directly back into the active BullMQ pipeline.

**• Circuit Breaker:** If a destination endpoint returns consecutive 5xx errors exceeding threshold (e.g., 10 failures in 30s), trip circuit breaker to pause deliveries to that endpoint for 5 minutes.

**3.3 Real-Time Telemetry & Observability Dashboard**

**• In-Memory Micro-Batching:** Buffer event delivery metrics in memory and flush to PostgreSQL in micro-batches every 2 seconds or 250 events to eliminate database write lockups.

**• Streaming Event Channel:** Push real-time job state transitions, throughput (RPS), and latency percentiles (p50, p95, p99) to frontend via Server-Sent Events (SSE).

**• Chaos Testing Controls:** Include a dedicated UI toggle switch to inject artificial failure modes (simulate 500 Internal Error, 504 Gateway Timeout, or 3000ms latency) on internal mock endpoints.

**• Append-Only Audit Trail:** Immutable append-only database table logging all administrative actions (DLQ replays, endpoint mutations, API key rotations) with timestamp, actor ID, and IP address.

**4. Non-Functional Requirements**

| **Category** | **Strict Quantitative Metric** | **Implementation Strategy** |
| --- | --- | --- |
| Ingress Latency | p95 < 25ms, p99 < 50ms | Immediate 202 Accepted response; push payload to Redis queue without awaiting worker execution. |
| Throughput & Scale | 2,000 requests/second sustained | Node.js clustering / Docker multi-worker scaling, PostgreSQL connection pooling via PgBouncer/Neon. |
| Memory Footprint | < 512MB RAM on minimal VPS | Hybrid payload offloading: payloads > 4KB stored directly in DB/disk; Redis only holds lightweight ID pointers. |
| Security & Isolation | Zero cross-tenant data leaks; AES-256 | Tenant Row-Level Security (RLS) on PostgreSQL; tenant secrets and API keys encrypted at rest; HMAC payload signatures. |

**5. External Dependencies & Technical Stack**

**• Core Gateway Engine:** TypeScript 5.x / Node.js runtime using Express.js or Fastify for high-speed routing.

**• Message Broker:** Redis 7.x (Local Docker container or Redis Stack) serving as the BullMQ broker and atomic lock manager.

**• Persistent Database:** PostgreSQL 16 (Local Docker container with TimescaleDB extension optional) for durable audit trails and metadata.

**• Frontend Dashboard:** React / Next.js with TailwindCSS and Lucide-React, consuming native Server-Sent Events (SSE).

**• Third-Party SaaS:** Zero external paid SaaS dependencies (no Twilio, no paid Auth0, no paid Datadog). Entire platform runs self-contained inside a single docker-compose.yml configuration.

**6. Edge Cases & Error Handling**

**• Target Endpoint Timeouts:** Outbound HTTP worker requests enforce a hard 5000ms timeout via AbortController. Unresponsive endpoints trigger an immediate ETIMEDOUT error, increment attempt count, and schedule backoff.

**• Malformed Payloads:** Ingress rejects non-JSON or invalid schemas with 422 Unprocessable Entity, returning structured Zod error details before the payload reaches the queue.

**• Redis Broker Partition:** If Redis restarts or becomes unreachable, the ingestion gateway enters a safe degradation mode: writes payloads directly to a temporary SQLite/Postgres Write-Ahead Log (WAL) until Redis reconnects.

**• Target Rate Limiting (429):** When destination endpoints return HTTP 429 Too Many Requests with a Retry-After header, the worker overrides standard exponential curves and schedules next attempt exactly at the requested timestamp.

**• DLQ Avalanche Replay:** During massive failure cascades where thousands of jobs enter DLQ simultaneously, the mass-replay action throttles re-insertion to a maximum of 50 jobs/sec to prevent crashing the worker cluster.

**7. Out of Scope (Sprint Phase 1)**

**• Multi-Protocol Egress:** Phase 1 focuses on standard HTTP/HTTPS POST webhook delivery. gRPC, Apache Kafka connectors, and MQTT bridges are deferred to Phase 2.

**• In-Flight Payload Transformations:** No dynamic JavaScript/Lua code execution sandboxes for transforming webhook payloads in-flight. Payloads are delivered byte-for-byte as ingested.

**• Enterprise SSO Integration:** Authentication is governed by cryptographic API keys and pre-shared tenant secrets; OAuth2 OpenID Connect / SAML enterprise SSO is excluded from MVP.

**• Multi-Region Geo-Replication:** Multi-region active-active database replication is out of scope. The architecture assumes a single primary containerized node with automated data volume persistence.
