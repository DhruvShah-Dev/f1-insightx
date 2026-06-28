import { apiError, apiOk, type ApiErrorCode } from "@/lib/api/errors";
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
  return apiOk(payload, {
    status: options.status,
    headers: accountHeaders(options.rateLimit, options.headers),
  });
}

function accountErrorCode(status?: number): ApiErrorCode {
  if (status === 400) return "bad_request";
  if (status === 401) return "unauthorized";
  if (status === 403) return "forbidden";
  if (status === 429) return "rate_limited";
  if (status === 503) return "service_unavailable";
  return "internal_error";
}

export function accountError(message: string, options: AccountJsonOptions = {}) {
  return apiError({
    status: options.status ?? 500,
    code: accountErrorCode(options.status),
    message,
    headers: accountHeaders(options.rateLimit, options.headers),
  });
}
