import { NextResponse } from "next/server";

export type ApiErrorCode =
  | "bad_request"
  | "invalid_query"
  | "invalid_payload"
  | "not_found"
  | "config_error"
  | "upstream_error";

type ApiErrorOptions = {
  status: number;
  code: ApiErrorCode;
  message: string;
  details?: unknown;
};

export function apiError({ status, code, message, details }: ApiErrorOptions) {
  return NextResponse.json(
    {
      ok: false,
      error: {
        code,
        message,
        details: details ?? null,
      },
    },
    { status },
  );
}

export function apiOk<T>(data: T) {
  return NextResponse.json({
    ok: true,
    data,
  });
}
