export const NO_STORE_HEADERS = {
  "Cache-Control": "no-store",
};

export function createPublicCacheHeaders({
  browserMaxAgeSeconds = 60,
  edgeMaxAgeSeconds = 300,
  staleWhileRevalidateSeconds = 600,
}: {
  browserMaxAgeSeconds?: number;
  edgeMaxAgeSeconds?: number;
  staleWhileRevalidateSeconds?: number;
} = {}) {
  return {
    "Cache-Control": `public, max-age=${browserMaxAgeSeconds}, s-maxage=${edgeMaxAgeSeconds}, stale-while-revalidate=${staleWhileRevalidateSeconds}`,
  };
}

export function mergeHeaders(...headerSets: Array<Record<string, string> | undefined>) {
  return Object.assign({}, ...headerSets);
}
