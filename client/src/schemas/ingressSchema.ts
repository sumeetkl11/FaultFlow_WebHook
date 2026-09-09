// client/src/schemas/ingressSchema.ts
import { z } from 'zod';

export const ingressPayloadSchema = z.object({
  target_url: z
    .string()
    .min(10, 'URL must be at least 10 characters')
    .max(2048, 'URL exceeds max limit of 2048 characters')
    .url('Target must be a valid HTTP or HTTPS endpoint'),

  event_type: z
    .string()
    .min(3, 'Event type must be at least 3 characters')
    .max(64, 'Event type cannot exceed 64 characters')
    .regex(/^[a-z0-9_.-]+$/, 'Only lowercase characters, dots, and hyphens permitted'),

  payload: z
    .string()
    .refine((val) => {
      try {
        JSON.parse(val);
        return true;
      } catch {
        return false;
      }
    }, 'Payload must be valid, well-formed JSON')
    .refine((val) => {
      // In browser, Blob is available; fallback for SSR safety
      const size = typeof Blob !== 'undefined' ? new Blob([val]).size : Buffer.byteLength(val, 'utf8');
      return size <= 1024 * 1024;
    }, 'Payload cannot exceed 1MB'),

  max_retries: z.number().int().min(1).max(10).default(5),
  timeout_ms: z.number().int().min(1000).max(15000).default(5000),
});

export type IngressPayloadForm = z.infer<typeof ingressPayloadSchema>;
