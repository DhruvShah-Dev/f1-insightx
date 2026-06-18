import { z } from "zod";

const manifestSessionSchema = z.object({
  file: z.string().min(1),
  season: z.number(),
  round: z.number(),
  event: z.string(),
  session: z.string(),
  counts: z.record(z.string(), z.number()).optional(),
});

const traceManifestSessionSchema = z.object({
  file: z.string().min(1),
  season: z.number(),
  round: z.number(),
  event: z.string(),
  session: z.string(),
  drivers: z.number(),
  tracePointCount: z.number(),
  quality: z.number(),
  bytes: z.number(),
});

const indexedManifestSchema = z.object({
  version: z.number(),
  row_cap: z.number(),
  sessions: z.record(z.string(), manifestSessionSchema),
});

const traceManifestSchema = z.object({
  version: z.number(),
  buildVersion: z.string(),
  generatedAt: z.string(),
  tracePointCount: z.number(),
  source: z.literal("offline_fastf1_telemetry_parquet"),
  sessions: z.record(z.string(), traceManifestSessionSchema),
});

export type AnalyticsIndexedManifest = z.infer<typeof indexedManifestSchema>;
export type AnalyticsTraceManifest = z.infer<typeof traceManifestSchema>;

export function parseAnalyticsIndexedManifest(value: unknown): AnalyticsIndexedManifest {
  return indexedManifestSchema.parse(value);
}

export function parseAnalyticsTraceManifest(value: unknown): AnalyticsTraceManifest {
  return traceManifestSchema.parse(value);
}
