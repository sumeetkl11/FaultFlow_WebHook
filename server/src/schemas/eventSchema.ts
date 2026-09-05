import { z } from 'zod';

export const IngestEventSchema = z.object({
  target_url: z
    .string()
    .min(10, 'Target URL must be at least 10 characters')
    .max(2048, 'Target URL cannot exceed 2048 characters')
    .url('Target URL must be a valid HTTP or HTTPS URL'),
  event_type: z
    .string()
    .min(3, 'Event type must be at least 3 characters')
    .max(64, 'Event type cannot exceed 64 characters')
    .regex(/^[a-z0-9_.-]+$/, 'Event type can only contain lowercase letters, numbers, dots, and hyphens'),
  payload: z
    .record(z.any())
    .refine(
      (data) => {
        try {
          const str = JSON.stringify(data);
          return Buffer.byteLength(str, 'utf8') <= 1024 * 1024; // 1MB
        } catch {
          return false;
        }
      },
      { message: 'Payload exceeds 1MB limit' }
    ),
  max_retries: z.number().int().min(1).max(10).default(5),
  timeout_ms: z.number().int().min(1000).max(15000).default(5000),
});

export type IngestEventInput = z.infer<typeof IngestEventSchema>;

export const DlqReplaySchema = z.object({
  mode: z.enum(['SELECTIVE', 'BATCH_ALL']),
  event_ids: z.array(z.string().min(5).max(64)).max(250).optional(),
}).refine(
  (data) => {
    if (data.mode === 'SELECTIVE') {
      return Array.isArray(data.event_ids) && data.event_ids.length > 0;
    }
    return true;
  },
  {
    message: "event_ids array is required when mode is 'SELECTIVE'",
    path: ['event_ids'],
  }
);

export type DlqReplayInput = z.infer<typeof DlqReplaySchema>;

export const ChaosConfigSchema = z.object({
  simulated_status: z.union([
    z.literal(200),
    z.literal(429),
    z.literal(500),
    z.literal(503),
    z.literal(504),
  ]),
  artificial_delay_ms: z.number().int().min(0).max(6000),
  failure_rate_percent: z.number().int().min(0).max(100),
});

export type ChaosConfigInput = z.infer<typeof ChaosConfigSchema>;
