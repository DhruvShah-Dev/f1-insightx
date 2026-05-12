import type { RuntimeSourceMetadata } from "@/lib/server/runtime-source";

export function classifyStrategyLabUnavailable(meta: RuntimeSourceMetadata) {
  const looksLikeMissingRace = meta.reason?.includes("returned no data") ?? false;

  return {
    status: looksLikeMissingRace ? 404 : 503,
    code: looksLikeMissingRace ? ("not_found" as const) : ("service_unavailable" as const),
    message: looksLikeMissingRace
      ? "Strategy Lab data is not ready for this race."
      : "Strategy Lab product data is unavailable right now.",
  };
}
