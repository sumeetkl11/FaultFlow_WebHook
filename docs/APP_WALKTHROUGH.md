# FaultFlow: A-to-Z Visual & Technical Architecture Walkthrough

Welcome to the definitive, component-by-component operational guide and engineering breakdown for **FaultFlow** — a high-throughput, fault-tolerant webhook delivery broker and real-time observability platform.

This walkthrough covers every visual view, clickable control, state transition, and backend mechanic so that you can navigate, demonstrate, and discuss the platform with complete technical authority.

---

## 1. Visual Feature Breakdown (A to Z)

### A. Operations Command Center (Main Dashboard View)
![Operations Command Center](./docs/images/dashboard_overview.png)

* **What it does in simple terms:**  
  This is the primary flight control deck of the platform. It provides an immediate, high-level pulse of your webhook infrastructure. Across the top, four real-time metric cards display live traffic volume, delivery latency, duplicate requests intercepted, and failed jobs. The split-screen below displays the live webhook stream on the left (65% width) and the interactive chaos testing laboratory on the right (35% width). All counters and tables update automatically in real time without refreshing the page.

---

### B. Real-Time Telemetry KPI Bar
![Telemetry KPI Bar](./docs/images/dashboard_overview.png)

* **What it does in simple terms:**  
  Positioned directly beneath the navigation bar, this grid of 4 cards continuously tracks the system's operational health:
  1. **Ingress Throughput:** Measures live webhooks arriving per second (`req/s`), along with median (`p50`) and 95th percentile (`p95`) delivery latency, plus current active queue depth.
  2. **Rescued Payloads:** Displays how many customer webhook payloads have been successfully delivered to external endpoints, alongside an estimated financial volume protected.
  3. **Deduplications:** Shows how many identical, repeated webhook requests were caught and neutralized at the front door before they could trigger double-billing or duplicate actions.
  4. **DLQ Backlog:** Tracks permanently failed webhooks sitting in the Dead-Letter Queue waiting for operator review or manual replay.

---

### C. Live Webhook Event Stream
![Live Webhook Event Stream](./docs/images/dashboard_overview.png)

* **What it does in simple terms:**  
  A mission-control feed of every webhook moving through the pipeline. Each row shows the event ID, event type (e.g., `invoice.paid`, `order.checkout`), destination URL, attempt count against maximum retries (e.g., `1/5`), and an animated status pill. When an event fails and undergoes exponential backoff, a live countdown timer displays directly inside the status pill (e.g., `RETRYING (2/5) in 4s`). Users can search by keyword, filter by delivery state, inspect full execution logs, or trigger individual replays.

---

### D. Chaos Testing Sandbox & Failure Injector
![Chaos Control Sandbox](./docs/images/dashboard_overview.png)

* **What it does in simple terms:**  
  An interactive testing suite that lets developers simulate real-world downstream failures safely. Instead of waiting for a third-party server to crash in production, you can force the mock destination sink to simulate HTTP 500 server crashes, HTTP 429 rate limits, or HTTP 504 gateway timeouts. You can also inject artificial latency up to 5 seconds and unleash traffic bursts of up to 250 concurrent webhooks at the press of a button, observing how the retry workers, circuit breakers, and dead-letter queues react.

---

### E. Ingress Webhook Test Dispatcher Modal
![Ingress Test Dispatcher Modal](./docs/images/dispatch_modal.png)

* **What it does in simple terms:**  
  A clean test laboratory modal where developers and QA engineers can construct and send custom webhook payloads directly into FaultFlow. It provides form fields for the target URL, event type, idempotency key, retry limits, delivery timeout, and an editable JSON payload editor. Submitting this form tests the sub-25ms ingress gateway and immediately enqueues the job into the BullMQ pipeline.

---

### F. Trace Inspector Drawer (Lifecycle, Payloads & Security)
![Trace Drawer Timeline](./docs/images/drawer_timeline.png)
![Trace Drawer Payload](./docs/images/drawer_payload.png)
![Trace Drawer Cryptographic Headers](./docs/images/drawer_headers.png)

* **What it does in simple terms:**  
  Clicking any row or "Inspect" button in the event stream opens a slide-over panel on the right side of the screen. This drawer contains three deep-dive tabs:
  1. **Attempt Timeline:** A chronological timeline of every single HTTP attempt made for that webhook, showing exact timestamps, latency in milliseconds, HTTP response codes, and network error messages.
  2. **Payload JSON:** The exact JSON data delivered to the customer, complete with a one-click "Copy JSON" button.
  3. **Cryptographic Headers:** Shows the exact `HMAC-SHA256` signature (`X-Signature: sha256=...`) and `Idempotency-Key` headers computed for the payload, ensuring downstream receivers can verify message integrity and authenticity.

---

### G. Dead-Letter Queue (DLQ) Remediation Modal
![DLQ Remediation Modal](./docs/images/dashboard_overview.png)

* **What it does in simple terms:**  
  A dedicated recovery station for webhooks that have exhausted all retry attempts (e.g., 5 failures in a row). It lists all dead-lettered jobs along with their fatal error traces. Operators can choose between "Replay All" or "Selective Replay" (via checkboxes). When triggered, FaultFlow meters the replay through a token-bucket rate limiter capped at 50 requests per second, ensuring recovered traffic never overwhelms recovering customer servers.

---

## 2. Button-by-Button Mapping

Here is the exact visual-to-backend mapping for every interactive element across the user interface:

### Navigation & Global Header
* **[Dead-Letter Queue Navigation Tab]:**  
  * *What it does visually:* Opens the DLQ Remediation modal window with the list of exhausted jobs.  
  * *Which backend API route it calls:* `GET /api/v1/dlq?limit=50&offset=0`  
  * *What changes in database/Redis:* No write changes; executes a `SELECT` query against PostgreSQL `dead_letter_queue` joined with `events`.

* **[DLQ Replay Header Button]:**  
  * *What it does visually:* Highlights the DLQ modal to allow instant bulk re-queueing of failed jobs.  
  * *Which backend API route it calls:* `GET /api/v1/dlq?limit=50&offset=0` (upon modal load).  
  * *What changes in database/Redis:* Reads pending DLQ items from PostgreSQL.

* **[Send Webhook Header Button]:**  
  * *What it does visually:* Opens the Ingress Webhook Test Dispatcher modal with pre-filled sample JSON.  
  * *Which backend API route it calls:* None immediately (client-side modal open).  
  * *What changes in database/Redis:* None until the dispatch form is submitted.

---

### Top Metric Bar
* **[Batch Replay Link (DLQ Backlog Card)]:**  
  * *What it does visually:* Directly opens the Dead-Letter Queue Remediation modal.  
  * *Which backend API route it calls:* `GET /api/v1/dlq?limit=50`  
  * *What changes in database/Redis:* Reads rows from PostgreSQL `dead_letter_queue`.

---

### Live Event Stream Table
* **[Search Input Field (`Search ID, type, endpoint...`)]:**  
  * *What it does visually:* Filters the currently displayed events in real time by Event ID, Event Type, or Target URL.  
  * *Which backend API route it calls:* `GET /api/v1/events?event_type={query}` (via React Query debounced fetch).  
  * *What changes in database/Redis:* No writes; performs a parameterized filtered `SELECT` query on PostgreSQL `events`.

* **[Status Filter Dropdown (`All Statuses`, `QUEUED`, `PROCESSING`, `RETRYING`, etc.)]:**  
  * *What it does visually:* Filters the table rows to only display events matching the chosen status.  
  * *Which backend API route it calls:* `GET /api/v1/events?status={status}`  
  * *What changes in database/Redis:* No writes; executes an indexed `SELECT` query on PostgreSQL `events.status`.

* **[Table Row Click]:**  
  * *What it does visually:* Opens the sliding Trace Inspector Drawer from the right edge of the screen for the clicked event.  
  * *Which backend API route it calls:* `GET /api/v1/events/:id`  
  * *What changes in database/Redis:* Reads event metadata, payload blobs from `event_blobs`, and chronological attempt logs from `event_attempts`.

* **[Inspect Button (Table Row Action)]:**  
  * *What it does visually:* Same as row click; opens the Trace Inspector Drawer with deep diagnostic information for that specific event.  
  * *Which backend API route it calls:* `GET /api/v1/events/:id`  
  * *What changes in database/Redis:* Fetches event history from `events`, `event_attempts`, and `event_blobs`.

* **[Single Replay Pill Button (StatusBadge on `DEAD_LETTERED` events)]:**  
  * *What it does visually:* Turns the status badge into an active re-enqueue state, removes the item from the DLQ list, and logs the action into the live chaos console.  
  * *Which backend API route it calls:* `POST /api/v1/dlq/replay` with `{ mode: 'SELECTIVE', event_ids: [eventId] }`  
  * *What changes in database/Redis:*  
    1. Removes the event row from PostgreSQL `dead_letter_queue`.  
    2. Updates PostgreSQL `events` row: sets `status = 'QUEUED'`, `attempts = 0`, `last_http_status = NULL`.  
    3. Adds a new job to Redis BullMQ queue `faultflow_events`.  
    4. Emits a `job_state_delta` event across the Server-Sent Events (SSE) broadcaster to all connected browsers.

* **[Pagination Left Arrow (`<`)]:**  
  * *What it does visually:* Navigates to the previous page of historical events.  
  * *Which backend API route it calls:* `GET /api/v1/events?limit=20&offset={(page - 2) * 20}`  
  * *What changes in database/Redis:* Executes paginated `SELECT` on PostgreSQL.

* **[Pagination Right Arrow (`>`)]:**  
  * *What it does visually:* Navigates to the next page of historical events.  
  * *Which backend API route it calls:* `GET /api/v1/events?limit=20&offset={page * 20}`  
  * *What changes in database/Redis:* Executes paginated `SELECT` on PostgreSQL.

---

### Chaos Testing Sandbox
* **[200 OK Destination Button]:**  
  * *What it does visually:* Highlights the button in emerald green; removes the "Active Failure" badge; logs the configuration change to the console.  
  * *Which backend API route it calls:* `POST /api/v1/chaos/config` with `{ simulated_status: 200, failure_rate_percent: 0 }`  
  * *What changes in database/Redis:* Updates the in-memory `currentChaosConfig` on the server. Subsequent requests to `/api/v1/chaos/sink` will return immediate HTTP 200 success.

* **[500 Server Err Destination Button]:**  
  * *What it does visually:* Highlights the button in rose red; displays the pulsing "Active Failure" indicator.  
  * *Which backend API route it calls:* `POST /api/v1/chaos/config` with `{ simulated_status: 500, failure_rate_percent: 100 }`  
  * *What changes in database/Redis:* Updates server in-memory chaos state. Any webhook sent to `/api/v1/chaos/sink` will now receive HTTP 500 responses, forcing worker retries and eventual DLQ eviction.

* **[429 Rate Limit Destination Button]:**  
  * *What it does visually:* Highlights the button in amber; activates the failure indicator.  
  * *Which backend API route it calls:* `POST /api/v1/chaos/config` with `{ simulated_status: 429, failure_rate_percent: 100 }`  
  * *What changes in database/Redis:* Updates server in-memory chaos state. Requests to the sink return HTTP 429 with a `Retry-After: 5` header.

* **[504 Timeout Destination Button]:**  
  * *What it does visually:* Highlights the button in purple; activates the failure indicator.  
  * *Which backend API route it calls:* `POST /api/v1/chaos/config` with `{ simulated_status: 504, failure_rate_percent: 100 }`  
  * *What changes in database/Redis:* Updates server in-memory chaos state. Requests to the sink return HTTP 504 Gateway Timeout.

* **[Artificial Latency Injection Slider (0ms to 5000ms)]:**  
  * *What it does visually:* Dynamically updates the displayed millisecond value in real time as the user drags the slider.  
  * *Which backend API route it calls:* `POST /api/v1/chaos/config` with `{ artificial_delay_ms: value }`  
  * *What changes in database/Redis:* Updates server in-memory chaos state. The mock destination will sleep for the specified duration before returning its response. If set higher than an event's `timeout_ms`, it triggers an `AbortController` timeout error.

* **[Traffic Blast Ingress Slider (10 to 250 requests)]:**  
  * *What it does visually:* Adjusts the planned traffic burst counter displayed on the button.  
  * *Which backend API route it calls:* None directly (updates local client state).  
  * *What changes in database/Redis:* None until the "Fire Blast" button is clicked.

* **[FIRE BLAST Button]:**  
  * *What it does visually:* Disables the button, animates a spinning play icon, displays "BLASTING TRAFFIC...", streams live progress into the chaos console, and triggers a visual avalanche of incoming jobs into the Event Stream.  
  * *Which backend API route it calls:* Fires concurrent asynchronous `POST /api/v1/events` requests in parallel (using `Promise.allSettled`).  
  * *What changes in database/Redis:*  
    1. Sets atomic idempotency keys in Redis (`idemp:...`).  
    2. Writes *N* rows into PostgreSQL `events`.  
    3. Enqueues *N* jobs into Redis BullMQ queue `faultflow_events`.  
    4. Worker pool starts concurrent processing (concurrency = 20).  
    5. Emits *N* `job_state_delta` SSE packets to all connected browser sessions.

---

### Ingress Webhook Test Dispatcher Modal
* **[Target URL, Event Type, Idempotency-Key, Retries, Timeout Inputs]:**  
  * *What it does visually:* Controls the parameters of the test webhook payload to be dispatched.  
  * *Which backend API route it calls:* None on change (client state).  
  * *What changes in database/Redis:* None until submission.

* **[Dispatch Event Submit Button (POST /events)]:**  
  * *What it does visually:* Displays a loading spinner ("Dispatching..."), validates the JSON payload, presents an inline green success banner with the generated Event ID, and automatically refreshes the table.  
  * *Which backend API route it calls:* `POST /api/v1/events` with header `Idempotency-Key: {key}`  
  * *What changes in database/Redis:*  
    1. Executes Redis `SET idemp:{key} LOCKED EX 86400 NX`.  
    2. If payload > 4KB, writes full body into PostgreSQL `event_blobs`.  
    3. Writes new record into PostgreSQL `events` with status `QUEUED`.  
    4. Adds job to Redis BullMQ `faultflow_events`.  
    5. Telemetry broadcaster fires SSE `job_state_delta`.

* **[Close Modal ("X" & "Cancel")]:**  
  * *What it does visually:* Closes the modal and resets temporary form validation warnings.  
  * *Which backend API route it calls:* None.  
  * *What changes in database/Redis:* None.

---

### Dead-Letter Queue (DLQ) Remediation Modal
* **[Replay All (N Jobs) Button]:**  
  * *What it does visually:* Selects the `BATCH_ALL` mode, highlighting the card and indicating that every exhausted job will be re-queued.  
  * *Which backend API route it calls:* None on click (updates client mode).  
  * *What changes in database/Redis:* None until execution.

* **[Selective Replay (N Selected) Button]:**  
  * *What it does visually:* Switches mode to `SELECTIVE`, revealing checkboxes next to each dead-lettered job in the backlog list.  
  * *Which backend API route it calls:* None on click.  
  * *What changes in database/Redis:* None until execution.

* **[Job Selection Checkboxes]:**  
  * *What it does visually:* Toggles inclusion of specific failed events for replay.  
  * *Which backend API route it calls:* None on click.  
  * *What changes in database/Redis:* None until execution.

* **[Execute Throttled Replay Button]:**  
  * *What it does visually:* Shows a spinning icon ("Replaying..."), displays a confirmation banner detailing how many jobs were re-queued and verifying the 50 req/sec rate throttle, updates the table in the background, and closes the modal.  
  * *Which backend API route it calls:* `POST /api/v1/dlq/replay` with `{ mode: 'BATCH_ALL' | 'SELECTIVE', event_ids: [...] }`  
  * *What changes in database/Redis:*  
    1. Deletes selected records from PostgreSQL `dead_letter_queue`.  
    2. Updates PostgreSQL `events` table: sets `status = 'QUEUED'`, `attempts = 0`, and clears previous errors.  
    3. Re-enqueues jobs into BullMQ with a 20ms pacing delay between items (enforcing <= 50 req/sec to prevent thundering herds).  
    4. Writes an audit entry into PostgreSQL `audit_logs` (`action = 'DLQ_BATCH_REPLAY'`).  
    5. Broadcasts `job_state_delta` via SSE for each replayed event.

---

### Trace Inspector Drawer
* **[Attempt Timeline Tab]:**  
  * *What it does visually:* Switches the drawer view to show the chronological list of delivery attempts with status codes, latency badges, and error diagnostics.  
  * *Which backend API route it calls:* Reads from already cached event trace data.  
  * *What changes in database/Redis:* None.

* **[Payload JSON Tab]:**  
  * *What it does visually:* Switches the view to formatted, syntax-highlighted emerald green JSON payload code.  
  * *Which backend API route it calls:* None.  
  * *What changes in database/Redis:* None.

* **[Cryptographic Headers Tab]:**  
  * *What it does visually:* Displays the computed `HMAC-SHA256` digest and the exact `Idempotency-Key` sent with the request.  
  * *Which backend API route it calls:* None.  
  * *What changes in database/Redis:* None.

* **[Copy JSON Button]:**  
  * *What it does visually:* Copies the entire JSON payload to the operating system clipboard and turns the icon into a checkmark for 2 seconds ("Copied").  
  * *Which backend API route it calls:* None (browser clipboard API).  
  * *What changes in database/Redis:* None.

---

## 3. Data Flow (Simple Terms)

The complete lifecycle of a single webhook event from initial receipt to final resolution follows 4 clean stages:

```
[Client / Webhook Producer]
            │
            ▼ (1) Ingress & Atomic Deduplication (<25ms)
   [Express Gateway] ──► [Redis SETNX Check] ──► [PostgreSQL events]
            │
            ▼ (2) Queueing & Worker Pickup
     [Redis BullMQ] ──► [Delivery Worker (Concurrency=20)]
            │
            ├──► Circuit Breaker Check (Host healthy?)
            ├──► HMAC-SHA256 Cryptographic Signature Generation
            │
            ▼ (3) HTTP Dispatch & Backoff Loop
 [Target Endpoint / Sink]
       │             │
  (2xx OK)      (5xx / 429 / Timeout)
       │             │
       │             ▼ (Retry < 5)
       │       [Exponential Backoff + Jitter] ──► (Back to Queue)
       │
       ▼ (4A) Terminal Success           ▼ (4B) Retries Exhausted (Attempt >= 5)
[DELIVERED (Status 200)]           [DEAD-LETTER QUEUE (DLQ)]
 - DB: status = 'DELIVERED'        - DB: insert into dead_letter_queue
 - SSE: job_state_delta            - DB: update events status = 'DEAD_LETTERED'
 - Telemetry: Latency recorded     - SSE: dlq_alert broadcast
                                   - Awaiting Rate-Throttled Replay (<=50 rps)
```

### Step 1: Ingress & Atomic Deduplication (<25ms)
* An external caller sends an HTTP `POST /api/v1/events` containing an `Idempotency-Key` header and a JSON payload.
* The gateway performs an atomic Redis command: `SET idemp:{key} LOCKED EX 86400 NX`.
  * **If the key already exists:** FaultFlow immediately returns an HTTP `200 OK` ("Deduplicated"), increments the deduplication counter, and stops. No duplicate webhook is ever queued.
  * **If the key is new:** The schema is validated via Zod. If the payload is larger than 4KB, it is offloaded to PostgreSQL `event_blobs` and replaced with a lightweight pointer. The event is written to the PostgreSQL `events` table with status `QUEUED`, enqueued into Redis BullMQ, and acknowledged to the sender with HTTP `202 Accepted` — all within **under 25 milliseconds**.

### Step 2: Queueing & Worker Pickup
* A cluster of 20 concurrent background workers monitors the Redis BullMQ queue.
* When a worker claims the job, it:
  1. Checks the **Circuit Breaker** registry. If the destination domain has failed 10+ times in the last 30 seconds, the job is put on `CIRCUIT_HOLD` for 5 minutes instead of hammering a downed server.
  2. Resolves the payload (reading from memory or fetching the blob pointer from PostgreSQL).
  3. Computes a cryptographic `HMAC-SHA256` signature using the tenant's private signing secret:  
     `X-Signature: sha256=HMAC(timestamp + "." + body)`.
  4. Emits a `job_state_delta` (`PROCESSING`) message over Server-Sent Events (SSE) so the UI animates the badge in real time.

### Step 3: Delivery Attempt & Exponential Backoff Loop
* The worker sends an HTTP `POST` request to the target destination protected by an `AbortController` timeout (default: 5000ms).
* **Case A (Success - HTTP 2xx):**  
  The worker logs the latency, records the successful attempt in PostgreSQL `event_attempts`, marks the event as `DELIVERED` in PostgreSQL `events`, resets any circuit breaker strike count, and broadcasts the delivery update over SSE. The event's journey ends here successfully.
* **Case B (Failure - HTTP 4xx, 5xx, or Timeout):**  
  The worker catches the error and checks the attempt counter:
  * **If attempts < max_retries (e.g. attempt 1 through 4):** The worker calculates an exponential backoff delay with randomized jitter:
    * Attempt 1: ~5s
    * Attempt 2: ~30s
    * Attempt 3: ~120s (2 minutes)
    * Attempt 4: ~900s (15 minutes)
    * The randomized jitter (+/- 15%) ensures thousands of failed webhooks do not wake up at the exact same millisecond.
  * The event status is updated to `RETRYING`, and BullMQ reschedules the job in the delayed queue.

### Step 4: Dead-Letter Queue (DLQ) Remediation
* If the webhook fails all 5 attempts, the retry loop terminates to prevent infinite resource waste.
* The worker:
  1. Inserts the failed event, error message, and response body into PostgreSQL `dead_letter_queue`.
  2. Updates PostgreSQL `events.status` to `DEAD_LETTERED`.
  3. Broadcasts a high-priority `dlq_alert` over SSE, triggering an immediate notification in the operator dashboard.
* The job now rests securely in the DLQ until an operator inspects the failure and clicks **"Batch Replay"** or **"Selective Replay"**.
* When replayed, FaultFlow pulls the jobs from the DLQ and re-enqueues them through a **token-bucket rate limiter capped at 50 requests per second**, ensuring the recovering downstream service is not overwhelmed by a sudden thundering herd.

---

## 4. Top 10 Technical Interview Q&A

Here are the 10 most critical, high-probability technical questions a senior engineer, system architect, or engineering manager would ask about this exact architecture, along with confident, senior-grade answers.

---

### Q1: Why did you use Redis `SETNX` for idempotency instead of relying on a PostgreSQL unique constraint?
**Answer:**  
> "Speed and connection efficiency. In a high-throughput webhook broker, our ingress target is under 25 milliseconds. Doing a SQL `INSERT ON CONFLICT DO NOTHING` requires acquiring a database transaction, disk I/O, and connection pool overhead.  
> By using Redis `SET idemp:{key} LOCKED EX 86400 NX`, we execute an atomic, in-memory check in under 1 millisecond. If the key already exists, Redis returns `null`, and we return an immediate `200 OK` to the client without ever touching PostgreSQL or enqueuing a duplicate BullMQ job. If it succeeds, the key automatically expires after 24 hours without requiring background cron table cleanup."

---

### Q2: How does your retry strategy prevent the 'Thundering Herd' problem against downstream servers?
**Answer:**  
> "We implement two distinct defensive layers: **Exponential Backoff with Randomized Jitter** and a **Sliding-Window Circuit Breaker**.  
> If an external customer has an outage and 10,000 webhooks fail simultaneously, standard exponential backoff causes all 10,000 retries to hit their server at the exact same moment (e.g., exactly 30 seconds later), knocking them down again. We apply a +/- 15% randomized jitter factor (`0.85 to 1.15 * base_delay`), which evenly smears the retry traffic across a smooth Gaussian distribution.  
> Furthermore, if an endpoint logs 10 consecutive failures within a 30-second window, our Circuit Breaker automatically trips, placing subsequent jobs to that host into `CIRCUIT_HOLD` for 5 minutes without firing outbound HTTP requests."

---

### Q3: Why did you separate fast Redis queue storage from PostgreSQL with a 'Hybrid Storage' model?
**Answer:**  
> "Redis is an in-memory data store where RAM is expensive and limited. If customers transmit massive webhook payloads (such as large e-commerce catalogs or bulk invoice lists of 500KB each), storing 100,000 active jobs directly in Redis memory would balloon RAM consumption into gigabytes and trigger Redis eviction policies or OOM crashes.  
> In our hybrid storage architecture, payloads up to 4KB remain inline inside Redis for zero-overhead worker processing. Any payload exceeding 4KB is written to PostgreSQL's `event_blobs` table, and only a lightweight pointer (`blob_evt_123`) is stored in Redis BullMQ. This guarantees our Redis memory footprint remains strictly below 150MB regardless of traffic volume."

---

### Q4: How does your Dead-Letter Queue (DLQ) replay prevent crashing a downstream system that just came back online?
**Answer:**  
> "When an external partner fixes a server outage that caused 5,000 webhooks to dead-letter, dumping all 5,000 events back into the active queue immediately would act like an accidental DDoS attack against their recovering API.  
> To solve this, our DLQ replay engine implements a **Token-Bucket Rate Limiter capped at 50 requests per second** (one job dispatched every 20ms). Regardless of whether an operator clicks 'Replay All' on 100 or 10,000 jobs, they are metered into BullMQ progressively. This gives the client's database and cache buffers time to warm up safely."

---

### Q5: Why did you choose Server-Sent Events (SSE) instead of WebSockets or client-side polling for telemetry?
**Answer:**  
> "Webhooks are inherently unidirectional: server-to-client updates. WebSockets require bi-directional connection handshakes, protocol switching from HTTP to WS, custom ping-pong heartbeat implementations, and special reverse-proxy configuration. Client polling, on the other hand, wastes CPU cycles and floods the ingress server with redundant HTTP requests.  
> SSE operates natively over standard HTTP/1.1 or HTTP/2, traverses corporate firewalls effortlessly, supports native automatic browser reconnection, and allows our server to push lightweight `job_state_delta` and `telemetry_update` events directly to the frontend Zustand store with near-zero latency."

---

### Q6: How do you guarantee cryptographic authenticity and prevent payload tampering on webhooks delivered to third parties?
**Answer:**  
> "Every outbound webhook delivery is signed using an **HMAC-SHA256** cryptographic hash computed with the tenant's private signing secret (`signing_secret`).  
> Before dispatching the HTTP request, the worker takes the current UNIX timestamp and the serialized JSON payload string, computing:  
> `signature = HMAC_SHA256(secret, timestamp + '.' + payload)`.  
> We transmit this in the `X-Signature: sha256={digest}` and `X-Timestamp: {timestamp}` headers. The receiving server can independently hash the payload with their shared secret and compare signatures using a constant-time equality check, protecting them against both payload tampering and replay attacks."

---

### Q7: Why use BullMQ on Redis instead of a relational table queue like 'SELECT FOR UPDATE SKIP LOCKED' in PostgreSQL?
**Answer:**  
> "While PostgreSQL with `FOR UPDATE SKIP LOCKED` works well for low-volume background tasks, it does not scale well for high-throughput webhook delivery engines processing thousands of events per second. It causes severe table bloat, write amplification, frequent autovacuum cycles, and connection pool starvation.  
> Redis operates entirely in memory using single-threaded, non-blocking I/O. BullMQ leverages Redis streams, sorted sets, and atomic Lua scripts to handle delayed jobs, concurrency control, job locking, and failure retries with sub-millisecond overhead, leaving PostgreSQL free to do what it does best: long-term analytical queries and audit logging."

---

### Q8: How does your telemetry system calculate p95 and p99 percentiles without creating a database write bottleneck?
**Answer:**  
> "If we wrote every individual HTTP attempt directly to an analytical metrics table, a traffic spike of 500 requests per second would require 500 synchronous database writes per second just for telemetry.  
> Instead, we built an **in-memory sliding ring buffer**. When workers complete attempts, they push `{ latencyMs, status, timestamp }` into this buffer. Every 2 seconds, a background timer flushes the buffer as a single micro-batch: it sorts the latencies to calculate p50, p95, and p99 percentiles, aggregates active queue depths from BullMQ, writes one single row to PostgreSQL `telemetry_metrics`, and broadcasts the calculated metrics to the UI over SSE. This reduces database write load by 99.8%."

---

### Q9: What happens if the target destination takes 30 seconds to respond or hangs indefinitely?
**Answer:**  
> "Every outbound HTTP fetch in the delivery worker is bound to a Node.js `AbortController` signal with a strict timeout (configurable per event, defaulting to 5,000 milliseconds).  
> If the destination server accepts the TCP connection but fails to respond within 5 seconds, the `AbortController` terminates the socket, triggering an `AbortError`. The worker catches this, logs the attempt as an HTTP 504 Gateway Timeout in `event_attempts`, increments the failure count, updates the circuit breaker, and schedules a retry. Workers are never allowed to hang waiting on external infrastructure."

---

### Q10: How does FaultFlow maintain multi-tenant isolation across shared worker and database infrastructure?
**Answer:**  
> "Multi-tenancy is enforced at three architectural boundaries:  
> 1. **Authentication & Ingress:** Every request must provide a valid `X-API-Key`. The authentication middleware hashes the key (`SHA-256`) and resolves the specific `tenant_id` and unique `signing_secret` from PostgreSQL.  
> 2. **Data Segregation:** Every table (`events`, `dead_letter_queue`, `audit_logs`) includes a mandatory `tenant_id` foreign key with compound indices (e.g., `(tenant_id, created_at DESC)`). All REST endpoints enforce tenant-scoped `WHERE tenant_id = $1` filters.  
> 3. **Real-Time SSE Channels:** The SSE broadcaster maintains client subscriptions keyed by `tenant_id`. When a delivery worker emits a job update, only clients connected with that specific tenant's credentials receive the telemetry packet."

---

*Authored by the FaultFlow Core Engineering Team. Maintained for production operations and architectural interviews.*
