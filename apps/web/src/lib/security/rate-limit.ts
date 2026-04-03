import { createHash } from "node:crypto";

type RateLimitBucket = {
  hits: number[];
  windowMs: number;
};

type RateLimitStore = Map<string, RateLimitBucket>;

export type RateLimitPolicy = {
  name: string;
  limit: number;
  windowMs: number;
};

export type RateLimitResult = {
  ok: boolean;
  limit: number;
  remaining: number;
  resetAt: number;
  retryAfterSeconds: number;
  headers: Record<string, string>;
};

declare global {
  var __f1InsightxRateLimitStore: RateLimitStore | undefined;
  var __f1InsightxRateLimitLastSweepAt: number | undefined;
}

function getStore() {
  if (!globalThis.__f1InsightxRateLimitStore) {
    globalThis.__f1InsightxRateLimitStore = new Map<string, RateLimitBucket>();
  }

  return globalThis.__f1InsightxRateLimitStore;
}

function pruneStore(store: RateLimitStore, now: number, windowMs: number) {
  const lastSweep = globalThis.__f1InsightxRateLimitLastSweepAt ?? 0;
  if (now - lastSweep < Math.max(30_000, windowMs)) {
    return;
  }

  for (const [key, bucket] of store.entries()) {
    bucket.hits = bucket.hits.filter((hit) => now - hit < bucket.windowMs);
    if (bucket.hits.length === 0) {
      store.delete(key);
    }
  }

  globalThis.__f1InsightxRateLimitLastSweepAt = now;
}

function readClientAddress(request: Request) {
  const forwardedFor = request.headers.get("x-forwarded-for");
  if (forwardedFor) {
    const firstForwarded = forwardedFor.split(",")[0]?.trim();
    if (firstForwarded) {
      return firstForwarded;
    }
  }

  const candidates = [
    request.headers.get("x-real-ip"),
    request.headers.get("cf-connecting-ip"),
    request.headers.get("x-vercel-forwarded-for"),
  ];

  for (const candidate of candidates) {
    if (candidate?.trim()) {
      return candidate.trim();
    }
  }

  return "unknown";
}

function hashIdentifier(value: string) {
  return createHash("sha256").update(value).digest("hex").slice(0, 24);
}

export function getRateLimitIdentifier(request: Request, subject?: string) {
  const rawIdentifier = subject?.trim() || readClientAddress(request);
  return hashIdentifier(rawIdentifier);
}

export const RATE_LIMIT_POLICIES = {
  authCallback: { name: "auth-callback", limit: 24, windowMs: 10 * 60_000 },
  signOut: { name: "sign-out", limit: 20, windowMs: 5 * 60_000 },
  usernameCheck: { name: "username-check", limit: 24, windowMs: 60_000 },
  usernameSuggest: { name: "username-suggest", limit: 12, windowMs: 60_000 },
  profileRead: { name: "profile-read", limit: 60, windowMs: 60_000 },
  profileWrite: { name: "profile-write", limit: 10, windowMs: 10 * 60_000 },
  fantasyRecommend: { name: "fantasy-recommend", limit: 12, windowMs: 5 * 60_000 },
  fantasyDataset: { name: "fantasy-dataset", limit: 60, windowMs: 60_000 },
  fantasyValidate: { name: "fantasy-validate", limit: 60, windowMs: 60_000 },
  raceScenarioSimulate: { name: "race-simulate", limit: 12, windowMs: 5 * 60_000 },
  raceScenarioValidate: { name: "race-validate", limit: 60, windowMs: 60_000 },
  publicRead: { name: "public-read", limit: 120, windowMs: 60_000 },
  health: { name: "health", limit: 30, windowMs: 60_000 },
} as const satisfies Record<string, RateLimitPolicy>;

export function checkRateLimit(request: Request, policy: RateLimitPolicy, subject?: string): RateLimitResult {
  const now = Date.now();
  const store = getStore();
  pruneStore(store, now, policy.windowMs);

  const key = `${policy.name}:${getRateLimitIdentifier(request, subject)}`;
  const bucket = store.get(key) ?? { hits: [], windowMs: policy.windowMs };
  bucket.windowMs = policy.windowMs;
  bucket.hits = bucket.hits.filter((hit) => now - hit < policy.windowMs);

  const oldestHit = bucket.hits[0] ?? now;
  const resetAt = oldestHit + policy.windowMs;

  if (bucket.hits.length >= policy.limit) {
    const retryAfterSeconds = Math.max(1, Math.ceil((resetAt - now) / 1000));
    return {
      ok: false,
      limit: policy.limit,
      remaining: 0,
      resetAt,
      retryAfterSeconds,
      headers: {
        "X-RateLimit-Limit": String(policy.limit),
        "X-RateLimit-Remaining": "0",
        "X-RateLimit-Reset": String(Math.ceil(resetAt / 1000)),
        "Retry-After": String(retryAfterSeconds),
      },
    };
  }

  bucket.hits.push(now);
  store.set(key, bucket);

  const remaining = Math.max(0, policy.limit - bucket.hits.length);
  const nextResetAt = bucket.hits[0] + policy.windowMs;

  return {
    ok: true,
    limit: policy.limit,
    remaining,
    resetAt: nextResetAt,
    retryAfterSeconds: Math.max(1, Math.ceil((nextResetAt - now) / 1000)),
    headers: {
      "X-RateLimit-Limit": String(policy.limit),
      "X-RateLimit-Remaining": String(remaining),
      "X-RateLimit-Reset": String(Math.ceil(nextResetAt / 1000)),
    },
  };
}
