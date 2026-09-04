**TECHNICAL SPECIFICATION & LIFECYCLE STATE MACHINE**

FaultFlow Engine: User Flow, Backend Job Lifecycle & Mermaid Diagrams

| **Document Type** | Systems Architecture Specification (Client & Backend Lifecycle) |
| --- | --- |
| **Target Platform** | FaultFlow Engine (Distributed Webhook & Telemetry Gateway) |
| **Target Audience** | Senior Engineers, Systems Architects, and Technical Interviewers |
| **Document Version** | v1.2.0-STABLE |

**1. Client-Side Journey**

The complete journey describes how external callers, tenant applications, and UI dashboard operators interact with the platform from dispatch through final delivery confirmation.

1. Authentication & Session Bootstrap: The tenant client application or dashboard frontend initializes with a cryptographic API token (X-API-Key: org_live_...) and pre-shared HMAC secret.

2. Payload Dispatch & Idempotency: The client issues an asynchronous POST /api/v1/events with a JSON body, destination URL, and a unique Idempotency-Key UUID header.

3. Ingress Acknowledgment: The API Gateway returns an immediate HTTP 202 Accepted response containing an event_id and processing receipt in < 25ms, avoiding blocking client network threads.

4. Streaming Telemetry Subscription: The web dashboard connects to the persistent Server-Sent Events (SSE) stream (/api/v1/telemetry/stream) to subscribe to real-time status deltas.

5. Real-Time Status Propagation: As background workers transition the task, the frontend updates delivery attempt gauges, latency graphs, and state indicators without HTTP polling.

6. Final Status & Remediation: Upon success, the event marks as DELIVERED with delivery duration. In the event of 5 exhausted retries, the event enters the Dead-Letter Queue (DLQ), enabling 1-click batch replays.

**2. Backend Job Lifecycle & Execution States**

Every event dispatched through FaultFlow passes through a deterministic state machine managed between Redis (BullMQ in-memory cache) and durable PostgreSQL storage.

**1. RECEIVED:** API Gateway validates API key authentication, parses the body with Zod schema validation, and checks Redis SETNX for idempotency deduplication.

**2. ENQUEUED:** If payload < 4KB, it is stored directly in the active Redis queue. If >= 4KB, the body is offloaded to PostgreSQL and a reference pointer (payload_ref_id) is enqueued.

**3. PROCESSING:** A background worker acquires a distributed lock, signs the outgoing payload with HMAC-SHA256 headers, and initiates an HTTP POST request with a 5000ms AbortController timeout.

**4. RETRYING:** If downstream servers return 5xx errors or network drops occur, the job enters a delayed queue governed by exponential backoff with randomized jitter.

**5. CIRCUIT_TRIPPED:** If an endpoint logs >= 10 consecutive failures within a 30-second sliding window, all subsequent traffic to that host is paused for 5 minutes.

**6. COMPLETED:** Upon receiving a 2xx HTTP response from the destination server, telemetry metrics are recorded, memory locks are freed, and state updates to DELIVERED.

**7. DEAD-LETTERED (DLQ):** If all 5 delivery attempts are exhausted without resolution, the job transitions into the Dead-Letter Queue with full stack traces, awaiting administrative replay.

**3. Failure, Rate Limiting & Retry Logic**

Production systems encounter intermittent network failures, cascading downfalls, and downstream rate throttling. The system handles each failure mode systematically:

**3.1 Exponential Backoff & Full Jitter Strategy**

To prevent thundering herds from overwhelming reviving servers, delays follow an exponential curve augmented with randomized jitter (+/- 15%):

Attempt 1: Wait 5 seconds (+/- 15% jitter)

Attempt 2: Wait 30 seconds (+/- 15% jitter)

Attempt 3: Wait 2 minutes (+/- 15% jitter)

Attempt 4: Wait 15 minutes (+/- 15% jitter)

Attempt 5: Final retry before automatic Dead-Letter Queue (DLQ) eviction

**3.2 Adaptive HTTP 429 Rate-Limit Handling**

When destination endpoints return HTTP 429 (Too Many Requests) with a Retry-After header, the worker overrides standard exponential curves. The job delay is dynamically rescheduled to the exact epoch delta specified by the destination.

**3.3 DLQ Avalanche Protection**

When replaying batches of hundreds or thousands of dead-lettered events, a token-bucket rate limiter throttles re-insertion to an ingress ceiling of 50 jobs/sec, preventing worker memory starvation and database lock contention.

**4. Mermaid Diagram 1: User & System Flowchart**

Copy and paste the Mermaid code block below into any Mermaid live editor, GitHub Markdown file, or documentation viewer:

flowchart TD    classDef client fill:#1E3A8A,stroke:#0F172A,stroke-width:2px,color:#FFFFFF;    classDef api fill:#0F766E,stroke:#0F172A,stroke-width:2px,color:#FFFFFF;    classDef queue fill:#D97706,stroke:#0F172A,stroke-width:2px,color:#FFFFFF;    classDef worker fill:#4338CA,stroke:#0F172A,stroke-width:2px,color:#FFFFFF;    classDef db fill:#334155,stroke:#0F172A,stroke-width:2px,color:#FFFFFF;    subgraph ClientLayer ["Client & Dashboard"]        A[Client Ingests Event]:::client -->|POST /api/v1/events| B[Ingress API Gateway]:::api        UI[Observability UI]:::client <-->|SSE Stream /telemetry| SSE[SSE Telemetry Broadcaster]:::api    end    subgraph IngressValidation ["Gateway Validation & Guardrails"]        B --> C{Verify API Key & RLS}:::api        C -->|Invalid| C1[Return 401/403 Unauthorized]:::api        C -->|Valid| D{Check Idempotency-Key in Redis}:::api        D -->|Key Exists| D1[Return Cached 200 OK]:::api        D -->|New Key| E[Validate Payload Schema via Zod]:::api        E -->|Invalid| E1[Return 422 Unprocessable]:::api        E -->|Valid| F[Issue 202 Accepted + Event ID]:::api    end    subgraph QueuePersistence ["Queuing & Storage"]        F --> G{Payload Size > 4KB?}:::queue        G -->|Yes| H[Save Payload to Postgres DB]:::db        H --> I[Push Ref Pointer to Redis]:::queue        G -->|No| I        I --> J[(BullMQ Active Queue)]:::queue    end    subgraph WorkerLayer ["Distributed Worker Cluster"]        J --> K[Worker Consumes Job]:::worker        K --> L[Generate HMAC-SHA256 Signature]:::worker        L --> M{Check Circuit Breaker}:::worker        M -->|Tripped / Paused| N[Delay Execution 5 min]:::worker        M -->|Closed / Healthy| O[Dispatch HTTP POST to Target]:::worker    end    subgraph DownstreamResolution ["Destination & Recovery"]        O -->|HTTP 2xx Success| P[Log Telemetry Metric]:::api        P --> DB[(PostgreSQL Events & Audit Log)]:::db        P --> SSE        O -->|HTTP 5xx / Timeout / 429| Q{Attempt Count < 5?}:::worker        Q -->|Yes| R[Calculate Exponential Backoff + Jitter]:::worker        R --> S[(BullMQ Delayed Queue)]:::queue        S -->|Timer Expires| J        Q -->|No: Attempts Exhausted| T[Move to Dead-Letter Queue - DLQ]:::queue        T --> DB        T --> SSE                UI -.->|Manual Replay Trigger| U[DLQ Throttled Replay Engine]:::worker        U -->|Max 50 req/sec| J    end

**5. Mermaid Diagram 2: Record State Machine**

The state diagram below models the strict state transitions of each record in PostgreSQL and Redis:

stateDiagram-v2    [*] --> PENDING_INGRESS: POST Received    PENDING_INGRESS --> REJECTED: Schema Error (422) / Auth Failure (401)    REJECTED --> [*]    PENDING_INGRESS --> DEDUPLICATED: Idempotency Key Hit (Redis SETNX false)    DEDUPLICATED --> [*]    PENDING_INGRESS --> ENQUEUED: Validated & Pushed to Redis    state ENQUEUED {        [*] --> WAITING_WORKER        WAITING_WORKER --> HYBRID_FETCH: If Payload Offloaded        HYBRID_FETCH --> ACTIVE_DELIVERY: Pointer Resolved        WAITING_WORKER --> ACTIVE_DELIVERY: Inline In-Memory    }    ENQUEUED --> CIRCUIT_HOLD: Destination Error Rate > Threshold    CIRCUIT_HOLD --> ENQUEUED: Circuit Reset Timer Expires (5m)    ENQUEUED --> IN_FLIGHT: Worker Locks Job & Signs HMAC    state IN_FLIGHT {        [*] --> HTTP_DISPATCH        HTTP_DISPATCH --> DESTINATION_ACK: Target Responds 2xx        HTTP_DISPATCH --> TRANSIENT_FAILURE: 5xx / Timeout / Connection Reset        HTTP_DISPATCH --> RATE_LIMITED: HTTP 429 Received    }    IN_FLIGHT --> DELIVERED: DESTINATION_ACK    DELIVERED --> TELEMETRY_FLUSHED: Metrics Micro-Batched to Postgres    TELEMETRY_FLUSHED --> [*]    IN_FLIGHT --> DELAYED_RETRY: TRANSIENT_FAILURE (Attempts < 5)    IN_FLIGHT --> DELAYED_RETRY: RATE_LIMITED (Retry-After Header Set)    DELAYED_RETRY --> ENQUEUED: Backoff Duration Elapsed    IN_FLIGHT --> DEAD_LETTERED: Retries Exhausted (Attempt == 5)    state DEAD_LETTERED {        [*] --> RETAINED_FOR_AUDIT        RETAINED_FOR_AUDIT --> MANUAL_REPLAY_QUEUED: Admin / User Clicks Replay    }    DEAD_LETTERED --> ENQUEUED: Throttled Batch Injection (<= 50 rps)
