**MASTER IMPLEMENTATION PLAN & WORKFLOW BLUEPRINT**

FaultFlow Engine: Backend-First Build, Automated Wireframing & Google Stitch MCP UI Pipeline

| **Implementation Methodology** | Backend-First Test-Driven Integration -> Automated Wireframing -> Google Stitch MCP UI -> Full-Stack Link |
| --- | --- |
| **Backend Core Stack** | Node.js (TypeScript), Express.js, Redis 7 (BullMQ), PostgreSQL 16, Docker Compose |
| **Design & Wireframing Workflow** | Deterministic UI Wireframing (Mermaid C4/Wireframe DSL) + Google Stitch MCP Context Generation |
| **Frontend Implementation Stack** | Next.js 14+ (App Router), TypeScript, TailwindCSS, TanStack Query v5, Zustand v4, SSE |

**1. Master Phasing Roadmap**

To ensure high engineering leverage and zero wasted UI effort, implementation strictly follows a backend-first progression. The frontend is not touched until the entire asynchronous worker pipeline, database schemas, and chaos test sinks are verified via automated integration tests.

**Phase 1: Local Docker Infrastructure:** Orchestrate isolated PostgreSQL and Redis containers with persistent volume mapping and health checks.

**Phase 2: Database Schema & Ingress Gateway:** Initialize Express TypeScript API, configure PostgreSQL migration scripts, Zod payload validation, and atomic Redis SETNX idempotency.

**Phase 3: BullMQ Worker Cluster & DLQ Engine:** Implement background worker, HMAC-SHA256 signature generator, exponential backoff with jitter, and dead-letter queue routing.

**Phase 4: Telemetry Ring-Buffer & Chaos Sink:** Build 2-second in-memory micro-batch flush, Server-Sent Events (SSE) telemetry stream, and mock server failure toggle.

**Phase 5: Automated Wireframing & Design Spec:** Generate deterministic visual component wireframes from the API & Frontend contracts prior to frontend coding.

**Phase 6: Google Stitch MCP UI Generation:** Feed structural wireframes and API specifications into Google Stitch MCP to generate clean, production-ready Tailwind/React UI components.

**Phase 7: Full-Stack Integration & Verification:** Wire Next.js frontend to Express SSE streams, connect Zustand ring buffers, test live failure injection, and benchmark locally.

**2. Step-by-Step Backend Construction**

**Step 2.1: Local Docker Container Orchestration**

Create the root project repository structure and define docker-compose.yml to run PostgreSQL 16 and Redis 7 without cloud quotas or sleep latency.

version: '3.8'services:  postgres:    image: postgres:16-alpine    container_name: faultflow-postgres    restart: always    environment:      POSTGRES_USER: faultflow_admin      POSTGRES_PASSWORD: local_secret_password      POSTGRES_DB: faultflow_db    ports:      - "5432:5432"    volumes:      - postgres_data:/var/lib/postgresql/data  redis:    image: redis:7-alpine    container_name: faultflow-redis    restart: always    ports:      - "6379:6379"    volumes:      - redis_data:/datavolumes:  postgres_data:  redis_data:

**Step 2.2: Database Migration & Schema Creation**

Run initialization SQL script against PostgreSQL to create relational schema with compound indexing for tenants, event logs, offloaded large payloads, and audit trails.

-- server/src/db/init.sqlCREATE TABLE IF NOT EXISTS tenants (    id VARCHAR(64) PRIMARY KEY,    name VARCHAR(255) NOT NULL,    api_key_hash VARCHAR(128) NOT NULL,    signing_secret VARCHAR(128) NOT NULL,    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP);CREATE TABLE IF NOT EXISTS events (    id VARCHAR(64) PRIMARY KEY,    tenant_id VARCHAR(64) REFERENCES tenants(id),    idempotency_key UUID NOT NULL,    target_url TEXT NOT NULL,    event_type VARCHAR(64) NOT NULL,    status VARCHAR(32) NOT NULL,    attempts INT DEFAULT 0,    latency_ms INT DEFAULT NULL,    last_http_status INT DEFAULT NULL,    payload_ref_id UUID DEFAULT NULL,    inline_payload JSONB DEFAULT NULL,    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,    delivered_at TIMESTAMP WITH TIME ZONE DEFAULT NULL);CREATE TABLE IF NOT EXISTS dead_letter_queue (    id VARCHAR(64) PRIMARY KEY,    event_id VARCHAR(64) REFERENCES events(id),    tenant_id VARCHAR(64) REFERENCES tenants(id),    error_message TEXT,    last_response_body TEXT,    retry_count INT NOT NULL,    dead_lettered_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP);CREATE INDEX idx_events_tenant_created ON events (tenant_id, created_at DESC);CREATE INDEX idx_events_status ON events (status);

**Step 2.3: Ingress API Gateway & Atomic Idempotency Gate**

Build Express.js route POST /api/v1/events with Zod validation. Ensure payload offloading: payloads > 4KB saved to DB, pointer enqueued in Redis BullMQ.

// server/src/routes/events.tsimport { Router } from 'express';import { z } from 'zod';import { redisClient } from '../redis';import { eventQueue } from '../queues/eventQueue';import { db } from '../db';export const eventsRouter = Router();const IngestSchema = z.object({  target_url: z.string().url().min(10).max(2048),  event_type: z.string().regex(/^[a-z0-9_.-]+$/).min(3).max(64),  payload: z.record(z.any()),  max_retries: z.number().int().min(1).max(10).default(5),  timeout_ms: z.number().int().min(1000).max(15000).default(5000)});eventsRouter.post('/events', async (req, res) => {  const idempotencyKey = req.header('Idempotency-Key');  if (!idempotencyKey) {    return res.status(400).json({ error: { code: 'MISSING_IDEMPOTENCY_KEY', status: 400 } });  }  // Atomic Redis SETNX check (24h TTL)  const isUnique = await redisClient.set(`idemp:${idempotencyKey}`, 'LOCKED', 'EX', 86400, 'NX');  if (!isUnique) {    return res.status(200).json({ success: true, status: 200, message: 'Deduplicated: payload already received' });  }  const parsed = IngestSchema.safeParse(req.body);  if (!parsed.success) {    return res.status(400).json({ error: { code: 'VALIDATION_FAILED', status: 400, details: parsed.error.issues } });  }  const eventId = `evt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;  const payloadStr = JSON.stringify(parsed.data.payload);  const isLarge = Buffer.byteLength(payloadStr, 'utf8') > 4096;  let payloadRefId = null;  if (isLarge) {    // Offload to Postgres    await db.query('INSERT INTO event_blobs (id, body) VALUES ($1, $2)', [eventId, payloadStr]);    payloadRefId = eventId;  }  // Push to BullMQ Active Queue (< 25ms total response)  await eventQueue.add('deliver_webhook', {    eventId,    targetUrl: parsed.data.target_url,    eventType: parsed.data.event_type,    payload: isLarge ? null : parsed.data.payload,    payloadRefId,    timeoutMs: parsed.data.timeout_ms  }, {    attempts: parsed.data.max_retries,    backoff: { type: 'exponential', delay: 5000 }  });  return res.status(202).json({    success: true,    status: 202,    data: { event_id: eventId, status: 'QUEUED', idempotency_cached: false }  });});

**Step 2.4: BullMQ Worker Engine & Exponential Retries**

Configure the BullMQ Worker to compute HMAC-SHA256 signatures, handle 5000ms timeouts via AbortController, and write to DLQ on attempt exhaustion.

// server/src/workers/deliveryWorker.tsimport { Worker } from 'bullmq';import crypto from 'crypto';import { redisConnection } from '../redis';import { db } from '../db';import { telemetryBuffer } from '../telemetry/buffer';export const deliveryWorker = new Worker('eventQueue', async (job) => {  const { eventId, targetUrl, payload, payloadRefId, timeoutMs } = job.data;  const startTime = Date.now();  let resolvedPayload = payload;  if (!resolvedPayload && payloadRefId) {    const res = await db.query('SELECT body FROM event_blobs WHERE id = $1', [payloadRefId]);    resolvedPayload = JSON.parse(res.rows[0].body);  }  // Cryptographic Signature  const secret = 'tenant_signing_secret_dev';  const bodyString = JSON.stringify(resolvedPayload);  const signature = crypto.createHmac('sha256', secret).update(bodyString).digest('hex');  const controller = new AbortController();  const timeoutId = setTimeout(() => controller.abort(), timeoutMs || 5000);  try {    const response = await fetch(targetUrl, {      method: 'POST',      headers: {        'Content-Type': 'application/json',        'X-Signature': `sha256=${signature}`,        'X-Timestamp': String(Date.now())      },      body: bodyString,      signal: controller.signal    });    clearTimeout(timeoutId);    const latencyMs = Date.now() - startTime;    telemetryBuffer.recordAttempt({ latencyMs, status: response.status });    if (!response.ok) {      throw new Error(`Target responded with HTTP ${response.status}`);    }    await db.query('UPDATE events SET status = $1, latency_ms = $2, delivered_at = NOW() WHERE id = $3', ['DELIVERED', latencyMs, eventId]);  } catch (err: any) {    clearTimeout(timeoutId);    if (job.attemptsMade >= (job.opts.attempts || 5)) {      // Transition to Dead-Letter Queue (DLQ)      await db.query('INSERT INTO dead_letter_queue (id, event_id, error_message, retry_count) VALUES ($1, $2, $3, $4)',        [`dlq_${eventId}`, eventId, err.message, job.attemptsMade]);      await db.query('UPDATE events SET status = $1 WHERE id = $2', ['DEAD_LETTERED', eventId]);    }    throw err; // Trigger BullMQ exponential retry  }}, { connection: redisConnection, concurrency: 20 });

**3. Automated Wireframing Pipeline (Pre-Frontend Verification)**

To prevent guessing visual layout and component hierarchy before touching Next.js code, use an automated wireframe generator. This bridges our API & Frontend Contract into visual diagrams without manual Figma drawing.

**Step 3.1: Deterministic Mermaid Wireframe Architecture**

This visual wireframe represents the exact screen density, component positioning, and telemetry dashboard layout:

graph TB    subgraph Viewport ["FaultFlow Desktop Dashboard (1440px Canvas)"]        subgraph TopBar ["1. Header & Navigation (h: 64px)"]            Logo["FaultFlow Engine [Logo]"]            NavTabs["[Events] [Dead-Letter Queue] [Chaos Sandbox] [API Keys]"]            StatusPill["Cluster: HEALTHY | SSE: CONNECTED"]        end        subgraph MetricBar ["2. Real-Time Telemetry Bar (4-Col Grid)"]            M1["Throughput: 342 req/s[p95: 94ms]"]            M2["Rescued Payloads: 1,420[$7,100 Revenue Saved]"]            M3["Deduplications: 89[Double Charges Prevented]"]            M4["DLQ Backlog: 3 Jobs[1-Click Batch Replay]"]        end        subgraph MainSplit ["3. Interactive Workspace (Split View)"]            subgraph LeftCol ["Live Event Stream & Filters (w: 65%)"]                Controls["Filter by Event Type | Status Dropdown | Search Box"]                Table["[Event ID]   [Type]         [Target Endpoint]       [Attempts]   [Status Badge]   [Action]evt_98a72   invoice.paid   https://api.shop.com/wh   2/5          RETRYING (25s)   [Inspect]evt_98a71   order.created  https://api.crm.com/wh    1/5          DELIVERED        [Inspect]"]                Pagination["Showing 1-20 of 1,420 | [< Prev] [1] [2] [3] [Next >]"]            end            subgraph RightCol ["Chaos Sandbox & Failure Injector (w: 35%)"]                ChaosTitle["Interactive Failure Simulation"]                TrafficSlider["Simulate Traffic Ingress: [ 100 req ] [FIRE BLAST]"]                HealthToggle["Destination Endpoint Status:[ (o) 200 OK | ( ) 500 ERROR | ( ) 429 RATE LIMIT ]"]                LatencySlider["Artificial Latency: 2500ms"]                LiveOutput["Chaos Output Log:[14:02:11] Target set to HTTP 500[14:02:13] 45 webhooks entering backoff queue"]            end        end        subgraph DrawerArea ["4. Sliding Trace Drawer (Overlay On-Demand)"]            DrawerTitle["Event Trace: evt_98a72 | Status: RETRYING"]            DrawerTabs["[Payload JSON] [Cryptographic Headers] [Attempt Timeline]"]            DrawerTimeline["Timeline:- 14:01:00 Dispatched -> ETIMEDOUT (5000ms)- 14:01:05 Attempt 2 -> HTTP 500 (Retrying in 25s)"]        end    end

**Step 3.2: Automated Wireframe CLI Generation Workflow**

Run Mermaid CLI locally to render this wireframe into a visual PNG/SVG artifact automatically before touching frontend code:

# Install Mermaid CLI globallynpm install -g @mermaid-js/mermaid-cli# Save wireframe DSL to wireframe.mmd and render to PNGmmdc -i wireframe.mmd -o docs/architecture/dashboard_wireframe.png -w 1440 -H 900 -b transparent

**4. Google Stitch MCP UI Generation Workflow**

Google Stitch operates via Model Context Protocol (MCP) to ingest architectural contracts, database schemas, and visual wireframes, outputting pristine, pixel-perfect Tailwind/React code without manual CSS fiddling.

**Step 4.1: Google Stitch MCP Context Prompt**

Feed this exact prompt into your IDE or MCP workflow running Google Stitch:

[MCP CONTEXT: FaultFlow Observability Dashboard]Act as an Elite Frontend Systems Architect using Google Stitch.I am building the frontend for FaultFlow Engine based on our Frontend Implementation Contract and API Specification.Design and generate production-grade React components using Next.js 14 App Router and TailwindCSS.Key Structural Components to generate:1. TopMetricBar:   - 4-card responsive KPI grid (Ingress RPS, Rescued Payloads, Deduplications, Active DLQ Count).   - Card styling: Slate-900 surface, Slate-800 borders, Emerald accents for success, Indigo for in-flight tasks.2. EventStreamTable:   - Dense table displaying Event ID, Event Type, Target URL, Attempt Badges, Status Pills, and Action buttons.   - Status Pills: QUEUED (pulse amber), RETRYING (circular countdown timer SVG with seconds remaining), DELIVERED (emerald), DEAD_LETTERED (crimson with 1-click replay).3. ChaosControlPanel:   - Interactive control card: Traffic blast slider (10-500), Destination Health toggle (200 OK / 500 Error / 429 Rate Limit), Latency injection slider.   - Distinct visual state indicating when chaos simulation is actively dropping packets.4. EventTraceDrawer:   - Slide-over sheet displaying formatted JSON payload, HMAC-SHA256 headers, and vertical step-by-step retry timeline.Constraints:- Use Lucide-React icons.- Consume Zustand store selectors for real-time streaming counters.- Zero mock CSS classes: pure modern Tailwind utility classes.

**5. Full-Stack Verification & Stress-Testing Checklist**

Run these three verification benchmarks to ensure your system meets the strict quantitative requirements defined in the PRD:

**Idempotency Verification:** Execute curl -X POST with identical Idempotency-Key twice within 100ms. Verify response 1 is 202 Accepted and response 2 is 200 OK with zero duplicate BullMQ jobs created.

**Chaos Resilience Test:** Toggle Chaos Sandbox to HTTP 500 via dashboard. Blast 100 events. Verify all 100 events transition to RETRYING with exponential delay (5s, 30s). Toggle back to 200 OK and observe auto-recovery to DELIVERED.

**Local Ingress Throughput Benchmark:** Run autocannon -c 100 -d 10 -p 10 -m POST http://localhost:4000/api/v1/events with dummy payload. Verify sustained throughput >= 2,000 req/sec with p95 latency < 25ms.
