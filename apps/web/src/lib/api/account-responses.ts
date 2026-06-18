import { NextResponse } from "next/server";
import { NO_STORE_HEADERS, mergeHeaders } from "@/lib/http/headers";
import type { RateLimitResult } from "@/lib/security/rate-limit";

type AccountJsonOptions = {
  status?: number;
  rateLimit?: RateLimitResult;
  headers?: Record<string, string>;
};

export function accountHeaders(rateLimit?: RateLimitResult, headers?: Record<string, string>) {
  return mergeHeaders(mergeHeaders(NO_STORE_HEADERS, rateLimit?.headers), headers);
}

export function accountJson<T>(payload: T, options: AccountJsonOptions = {}) {
  return NextResponse.json(payload, {
    status: options.status,
    headers: accountHeaders(options.rateLimit, options.headers),
  });
}

export function accountError(message: string, options: AccountJsonOptions = {}) {
  return accountJson({ error: message }, options);
}
