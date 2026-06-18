import assert from "node:assert/strict";
import test from "node:test";
import {
  checkRateLimitAsync,
  RATE_LIMIT_POLICIES,
  resetRateLimitFallbackWarningsForTests,
} from "./rate-limit";

const mutableEnv = process.env as Record<string, string | undefined>;

test("production rate limiting warns once when durable Upstash config is missing", async () => {
  const originalNodeEnv = process.env.NODE_ENV;
  const originalUrl = process.env.UPSTASH_REDIS_REST_URL;
  const originalToken = process.env.UPSTASH_REDIS_REST_TOKEN;
  const originalWarn = console.warn;
  const warnings: string[] = [];

  try {
    mutableEnv.NODE_ENV = "production";
    delete process.env.UPSTASH_REDIS_REST_URL;
    delete process.env.UPSTASH_REDIS_REST_TOKEN;
    resetRateLimitFallbackWarningsForTests();
    console.warn = (message?: unknown) => {
      warnings.push(String(message));
    };

    await checkRateLimitAsync(new Request("https://f1-insightx.test/api/health"), RATE_LIMIT_POLICIES.health, "rate-limit-test");
    await checkRateLimitAsync(new Request("https://f1-insightx.test/api/health"), RATE_LIMIT_POLICIES.health, "rate-limit-test");

    assert.equal(warnings.length, 1);
    assert.match(warnings[0], /missing-upstash-config/);
    assert.match(warnings[0], /in-memory rate limiting/);
  } finally {
    console.warn = originalWarn;
    resetRateLimitFallbackWarningsForTests();
    if (originalNodeEnv === undefined) {
      delete mutableEnv.NODE_ENV;
    } else {
      mutableEnv.NODE_ENV = originalNodeEnv;
    }
    if (originalUrl === undefined) {
      delete process.env.UPSTASH_REDIS_REST_URL;
    } else {
      process.env.UPSTASH_REDIS_REST_URL = originalUrl;
    }
    if (originalToken === undefined) {
      delete process.env.UPSTASH_REDIS_REST_TOKEN;
    } else {
      process.env.UPSTASH_REDIS_REST_TOKEN = originalToken;
    }
  }
});
