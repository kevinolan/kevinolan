import { z } from 'zod';

/**
 * Shared domain types + validation schemas for the FluentPath platform.
 *
 * These are the contract between the Node backend, the Next.js admin, and the
 * React Native mobile client. Keep this package dependency-free (zod only) so it
 * can be consumed by any tier without pulling a framework.
 */

// ── Metrics ingestion ────────────────────────────────────────────────────────
// Mirrors the metrics the mobile/desktop app already collects on-device
// (src/lib/metricsStore.ts) so the backend can store + sync them.

export const RecordingMetricSchema = z.object({
  id: z.string().min(1),
  recordedAt: z.string().datetime(), // ISO 8601
  durationSec: z.number().int().nonnegative(),
  /** P(stutter) in [0,1] from the on-device ONNX model, or null if it didn't run. */
  pStutter: z.number().min(0).max(1).nullable(),
  heuristic: z.object({
    repetitions: z.number().int().nonnegative(),
    prolongations: z.number().int().nonnegative(),
    blocks: z.number().int().nonnegative(),
    wordCount: z.number().int().nonnegative(),
    ratePerMin: z.number().nonnegative(),
    disfluencies: z.number().int().nonnegative(),
  }),
});
export type RecordingMetric = z.infer<typeof RecordingMetricSchema>;

/** Payload the client POSTs to /api/metrics (upsert of a batch of recordings). */
export const IngestMetricsSchema = z.object({
  userId: z.string().min(1),
  deviceId: z.string().min(1),
  metrics: z.array(RecordingMetricSchema).min(1).max(200),
});
export type IngestMetrics = z.infer<typeof IngestMetricsSchema>;

// ── User / auth ──────────────────────────────────────────────────────────────

export const UserSchema = z.object({
  id: z.string().min(1),
  email: z.string().email(),
  displayName: z.string().min(1).max(80),
  role: z.enum(['client', 'clinician']),
  createdAt: z.string().datetime(),
});
export type User = z.infer<typeof UserSchema>;

export const CreateUserSchema = z.object({
  email: z.string().email(),
  displayName: z.string().min(1).max(80),
  role: z.enum(['client', 'clinician']).default('client'),
});
export type CreateUser = z.infer<typeof CreateUserSchema>;

// ── API envelopes ───────────────────────────────────────────────────────────

export const ErrorSchema = z.object({
  error: z.string(),
  detail: z.string().optional(),
});
export type ApiError = z.infer<typeof ErrorSchema>;

/** Server → client "no content" style ack. */
export interface IngestAck {
  accepted: number;
  rejected: number;
  serverTime: string;
}
