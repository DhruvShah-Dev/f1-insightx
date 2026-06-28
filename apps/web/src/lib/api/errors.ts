import { NextResponse } from "next/server";
import { getPublicErrorPayload } from "@/lib/errors/app-error";
import { logServerError } from "@/lib/errors/logger";

export type ApiErrorCode =
  | "bad_request"
  | "invalid_query"
  | "invalid_payload"
  | "validation_error"
  | "unauthorized"
  | "forbidden"
  | "not_found"
  | "config_error"
  | "auth_error"
  | "service_unavailable"
  | "upstream_error"
  | "rate_limited"
  | "internal_error";

type ApiErrorOptions = {
  status: number;
  code: ApiErrorCode;
  message: string;
  details?: unknown;
  headers?: HeadersInit;
};

export function apiError({ status, code, message, details, headers }: ApiErrorOptions) {
  return NextResponse.json(
    {
      ok: false,
      error: {
        code,
        message,
        details: details ?? null,
      },
    },
    { status, headers },
  );
}

export function apiOk<T>(data: T, init?: { headers?: HeadersInit; status?: number }) {
  return NextResponse.json({
    ok: true,
    data,
  }, init);
}

export function apiErrorFrom(
  error: unknown,
  options: {
    fallbackMessage: string;
    headers?: HeadersInit;
    logContext: string;
    logMetadata?: Record<string, unknown>;
  },
) {
  logServerError(options.logContext, error, options.logMetadata);
  const payload = getPublicErrorPayload(error, options.fallbackMessage);

  return apiError({
    status: payload.status,
    code: payload.code,
    message: payload.message,
    details: payload.details,
    headers: options.headers,
  });
}
