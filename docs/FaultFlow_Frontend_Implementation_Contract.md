**FRONTEND IMPLEMENTATION CONTRACT**

FaultFlow UI: Real-Time Observability, DLQ Management & Chaos Control Sandbox

| **Framework & Language** | Next.js 14+ (App Router) with TypeScript & React 18/19 |
| --- | --- |
| **State Management Stack** | TanStack Query v5 (Server State) + Zustand v4 (Client Global / SSE Ring Buffer) |
| **Styling & Component System** | TailwindCSS + Radix UI Primitives + Lucide React |
| **Specification Owner** | Lead Frontend & Interface Architect |

**1. State Management Architecture**

To prevent re-render thrashing during high-throughput ingestions (hundreds of events per second), client-side state is strictly separated between Server Cache and Ephemeral Stream State:

**1.1 Server State: TanStack Query v5**

Handles asynchronous REST endpoints (GET /api/v1/events, GET /api/v1/events/:id). Configured with a 30-second staleTime and structural sharing to eliminate unnecessary re-renders of the data table when paginating or filtering.

Automatic query invalidation is tied to specific mutation actions (e.g., successful DLQ replay invalidates ['events', 'list'] and ['dlq', 'stats']).

**1.2 Client & Streaming State: Zustand Store with Fixed-Size Ring Buffer**

Live telemetry updates coming over Server-Sent Events (SSE) bypass React's standard context tree entirely to protect DOM performance.

Zustand holds an in-memory sliding ring-buffer (maximum 50 active events) for the live log stream, alongside aggregate counters (throughput RPS, p95 latency, rescued count).

Components subscribe selectively using fine-grained atomic selectors (e.g., useTelemetryStore(s => s.throughputRps)), preventing unrelated chart widgets or tables from re-rendering on stream ticks.

**2. Async State Handling: Long-Running Tasks & SSE**

Because webhook dispatching involves exponential retries lasting up to 15+ minutes, HTTP polling is strictly rejected due to connection overhead and quota limits.

**2.1 Server-Sent Events (SSE) Architecture**

The client initiates a persistent unidirectional stream via EventSource on mount: GET /api/v1/telemetry/stream?token=org_live_...

Reconnection Resiliency: Implements exponential client reconnection logic (1s, 2s, 5s, 10s) with heartbeat ping monitoring. If connection drops, a visual toast ('Reconnecting telemetry stream...') warns the user without unmounting UI state.

Event Demultiplexing: Incoming SSE messages are dispatched by event type:

**•** telemetry_update: Flushes aggregate RPS and latency metrics into the top metric bar.

**•** job_state_delta: Updates individual row status badges (QUEUED -> RETRYING -> DELIVERED / DEAD_LETTERED) in the live table.

**•** dlq_alert: Triggers notification badge on the DLQ replay navigation tab.

**2.2 Dynamic Status Badges & Visual Progress**

**•** QUEUED: Pulse animation (Amber) indicating in-memory Redis presence.

**•** RETRYING (Attempt N/5): Indigo badge with an active SVG circular countdown timer calculating time until next backoff execution.

**•** DELIVERED: Solid Emerald badge displaying round-trip response duration (e.g., 184ms).

**•** DEAD_LETTERED: Crimson badge with 1-click quick-action 'Replay' trigger.

**3. Component Hierarchy Breakdown**

A modular, atomic layout architecture engineered for density, scannability, and high-velocity inspection:

**RootLayout (/app/layout.tsx):** Global TanStack Query provider, Zustand store hydration, Toast notification container, Top-level Navigation.

**├── TopMetricBar:** Live telemetry counters: Ingestion RPS, Rescued Payloads, Idempotency Deduplications, Latency percentiles.

**├── ChaosControlPanel:** Interactive sandbox controls: Blast Traffic slider (10-500 events), Endpoint Health toggle (200 OK vs 500 Drop), Latency Injector.

**├── EventStreamTable:** Virtualized, high-performance table rendering the 50 most recent events with live status badges and latency gauges.

**│   ├── TableFilters:** Filter by status (QUEUED, DELIVERED, DEAD_LETTERED), event_type, and text search query.

**│   ├── TablePagination:** Server-driven limit/offset pagination with prefetching on hover.

**│   └── ActionRow:** Individual row action triggers: View Trace Drawer, Direct Single-Event Replay.

**├── EventTraceDrawer:** Slide-over drawer detailing raw payload JSON, HMAC cryptographic signatures, and attempt-by-attempt failure timelines.

**└── DLQReplayModal:** Action dialog for bulk DLQ recovery: Mode toggle (SELECTIVE vs BATCH_ALL), concurrency throttle indicator (50 rps limit).

**4. Error Boundaries & Optimistic UI**

**4.1 Tiered React Error Boundaries**

Global App Boundary: Catches unhandled runtime crashes, displaying an enterprise recovery screen ('System state preserved') with a 1-click state reset.

Isolated Widget Boundaries: The Chaos Control Panel and Event Stream Table are wrapped in independent Error Boundaries. If the real-time chart fails to parse a malformed metric frame, only the chart displays a localized fallback banner; the rest of the dashboard remains fully interactive.

**4.2 Optimistic UI Updates**

DLQ Replay Execution: When an Admin clicks 'Replay All (42 Jobs)', the UI immediately switches their status badge from DEAD_LETTERED to QUEUED (with an optimistic 202 status) and increments the 'Active Queue' gauge before backend REST confirmation. If the request fails (e.g., 403 Forbidden or 500), the mutation rolls back state using TanStack Query's onMutate/onError context snapshot and fires an error toast.

Chaos Switch Toggle: Toggling destination health immediately flips the UI status pill to 'Simulated Outage (500)', preventing lag while the server updates the mock sink configuration.

**5. Client-Side Form Validation & Schemas**

Forms are managed via React Hook Form integrated with Zod resolvers, executing identical client-side validation to eliminate wasteful 400 Bad Request API roundtrips:

// client/schemas/eventIngressSchema.tsimport { z } from 'zod';export const eventIngressSchema = z.object({  target_url: z    .string()    .min(10, 'URL must be at least 10 characters')    .max(2048, 'URL exceeds max limit of 2048 characters')    .url('Target must be a valid HTTP or HTTPS URL'),    event_type: z    .string()    .min(3, 'Event type must be at least 3 characters')    .max(64, 'Event type cannot exceed 64 characters')    .regex(/^[a-z0-9_.-]+$/, 'Only lowercase letters, numbers, dots, and hyphens allowed'),  payload: z    .string()    .refine((val) => {      try { JSON.parse(val); return true; } catch { return false; }    }, 'Payload must be valid, well-formed JSON')    .refine((val) => new Blob([val]).size <= 1024 * 1024, 'Payload exceeds 1MB limit'),  max_retries: z    .number()    .int()    .min(1, 'Minimum 1 retry required')    .max(10, 'Maximum retries capped at 10')    .default(5),  timeout_ms: z    .number()    .int()    .min(1000, 'Minimum timeout is 1000ms')    .max(15000, 'Maximum timeout cannot exceed 15000ms')    .default(5000),});export type EventIngressFormValues = z.infer<typeof eventIngressSchema>;
