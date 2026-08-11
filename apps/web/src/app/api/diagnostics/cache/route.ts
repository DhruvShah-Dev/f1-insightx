import { apiOk } from "@/lib/api/errors";
import { NO_STORE_HEADERS, mergeHeaders } from "@/lib/http/headers";
import { checkRateLimitAsync, RATE_LIMIT_POLICIES } from "@/lib/security/rate-limit";
import { absoluteUrl } from "@/lib/seo";

export const dynamic = "force-dynamic";

// Public analytics pages are meant to be served from the CDN with a 15-minute
// stale window. A single dynamic API call, a stray cookie read, or a
// searchParams access silently flips a route back to `no-store` and reintroduces
// multi-second uncached renders. This endpoint probes the routes that must stay
// cacheable so the regression is visible without digging through response
// headers by hand.
const PROBED_ROUTES = [
  { path: "/", expect: "cacheable" as const },
  { path: "/predictions", expect: "cacheable" as const },
  { path: "/race-analysis", expect: "cacheable" as const },
  { path: "/championship", expect: "cacheable" as const },
  { path: "/versus", expect: "cacheable" as const },
  { path: "/lab", expect: "cacheable" as const },
  { path: "/fantasy", expect: "cacheable" as const },
  { path: "/predictions/fp2", expect: "cacheable" as const },
  // /picks is user-scoped (entries, scores), so it must stay out of the CDN.
  { path: "/picks", expect: "private" as const },
  { path: "/account", expect: "private" as const },
];

const PROBE_TIMEOUT_MS = 6_000;

type RouteProbe = {
  path: string;
  expect: "cacheable" | "private";
  status: number | null;
  cacheControl: string | null;
  cdnCache: string | null;
  age: string | null;
  ttfbMs: number | null;
  ok: boolean;
  detail: string;
};

function classify(cacheControl: string | null) {
  if (!cacheControl) return "unknown";
  const value = cacheControl.toLowerCase();
  if (value.includes("no-store")) return "no-store";
  if (/s-maxage=\d+/.test(value) || /max-age=[1-9]/.test(value)) return "cacheable";
  return "unknown";
}

async function probe(route: (typeof PROBED_ROUTES)[number], origin: string): Promise<RouteProbe> {
  const startedAt = Date.now();
  try {
    const response = await fetch(new URL(route.path, origin), {
      method: "GET",
      redirect: "manual",
      cache: "no-store",
      headers: { "user-agent": "f1-insightx-cache-diagnostics" },
      signal: AbortSignal.timeout(PROBE_TIMEOUT_MS),
    });
    // Drain the body so the connection is released promptly.
    await response.arrayBuffer().catch(() => undefined);

    const cacheControl = response.headers.get("cache-control");
    const kind = classify(cacheControl);
    const expectedOk = route.expect === "cacheable" ? kind === "cacheable" : kind === "no-store";

    return {
      path: route.path,
      expect: route.expect,
      status: response.status,
      cacheControl,
      cdnCache: response.headers.get("x-vercel-cache") ?? response.headers.get("cf-cache-status"),
      age: response.headers.get("age"),
      ttfbMs: Date.now() - startedAt,
      ok: expectedOk,
      detail: expectedOk
        ? `Serving as ${kind}.`
        : route.expect === "cacheable"
          ? `Expected a CDN-cacheable response but got "${cacheControl ?? "no cache-control header"}". A dynamic API (cookies, headers, searchParams) has most likely been reintroduced on this route.`
          : `Expected a private, uncached response but got "${cacheControl ?? "no cache-control header"}".`,
    };
  } catch (error) {
    return {
      path: route.path,
      expect: route.expect,
      status: null,
      cacheControl: null,
      cdnCache: null,
      age: null,
      ttfbMs: Date.now() - startedAt,
      ok: false,
      detail: `Probe failed: ${error instanceof Error ? error.message : "unknown error"}.`,
    };
  }
}

export async function GET(request: Request) {
  const rateLimit = await checkRateLimitAsync(request, RATE_LIMIT_POLICIES.health);
  if (!rateLimit.ok) {
    return Response.json(
      { ok: false, error: { code: "rate_limited", message: "Too many diagnostics requests.", details: null } },
      { status: 429, headers: mergeHeaders(NO_STORE_HEADERS, rateLimit.headers) },
    );
  }

  const origin = new URL(request.url).origin || absoluteUrl("/");
  const routes = await Promise.all(PROBED_ROUTES.map((route) => probe(route, origin)));
  const failing = routes.filter((route) => !route.ok);

  return apiOk(
    {
      origin,
      checkedAt: new Date().toISOString(),
      status: failing.length === 0 ? "ok" : "degraded",
      summary: {
        probed: routes.length,
        failing: failing.length,
        cdnHits: routes.filter((route) => (route.cdnCache ?? "").toUpperCase() === "HIT").length,
        slowestTtfbMs: routes.reduce((max, route) => Math.max(max, route.ttfbMs ?? 0), 0),
      },
      routes,
    },
    { headers: mergeHeaders(NO_STORE_HEADERS, rateLimit.headers) },
  );
}
