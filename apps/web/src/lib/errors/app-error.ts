import type { ApiErrorCode } from "@/lib/api/errors";

export type AppErrorKind =
  | "validation"
  | "auth"
  | "authorization"
  | "config"
  | "not_found"
  | "external"
  | "rate_limited"
  | "internal";

type AppErrorOptions = {
  kind: AppErrorKind;
  code: ApiErrorCode;
  status: number;
  message: string;
  userMessage: string;
  details?: unknown;
  exposeDetails?: boolean;
  cause?: unknown;
};

export class AppError extends Error {
  readonly kind: AppErrorKind;
  readonly code: ApiErrorCode;
  readonly status: number;
  readonly userMessage: string;
  readonly details: unknown;
  readonly exposeDetails: boolean;
  override readonly cause?: unknown;

  constructor(options: AppErrorOptions) {
    super(options.message);
    this.name = "AppError";
    this.kind = options.kind;
    this.code = options.code;
    this.status = options.status;
    this.userMessage = options.userMessage;
    this.details = options.details;
    this.exposeDetails = options.exposeDetails ?? false;
    this.cause = options.cause;
  }
}

export function createAppError(options: AppErrorOptions) {
  return new AppError(options);
}

export function isAppError(error: unknown): error is AppError {
  return error instanceof AppError;
}

export function getPublicErrorPayload(error: unknown, fallbackMessage: string) {
  if (isAppError(error)) {
    return {
      status: error.status,
      code: error.code,
      message: error.userMessage,
      details: error.exposeDetails ? error.details : null,
    };
  }

  return {
    status: 500,
    code: "internal_error" as const,
    message: fallbackMessage,
    details: null,
  };
}
