import { isAppError } from "@/lib/errors/app-error";

type LogMetadata = Record<string, unknown> | undefined;

function safeSerializeMetadata(metadata: LogMetadata) {
  if (!metadata) {
    return undefined;
  }

  return Object.fromEntries(
    Object.entries(metadata).filter(([, value]) => {
      if (value === undefined) {
        return false;
      }

      return typeof value !== "string" || value.length < 500;
    }),
  );
}

export function logServerError(context: string, error: unknown, metadata?: LogMetadata) {
  if (error instanceof Error && (error.message === "NEXT_REDIRECT" || error.message === "NEXT_NOT_FOUND")) {
    return;
  }

  const base = {
    context,
    metadata: safeSerializeMetadata(metadata),
  };

  if (isAppError(error)) {
    console.error({
      level: "error",
      ...base,
      name: error.name,
      kind: error.kind,
      code: error.code,
      status: error.status,
      message: error.message,
      details: error.details ?? null,
      cause:
        error.cause instanceof Error
          ? {
              name: error.cause.name,
              message: error.cause.message,
            }
          : null,
      stack: process.env.NODE_ENV === "production" ? undefined : error.stack,
    });
    return;
  }

  if (error instanceof Error) {
    console.error({
      level: "error",
      ...base,
      name: error.name,
      message: error.message,
      stack: process.env.NODE_ENV === "production" ? undefined : error.stack,
    });
    return;
  }

  console.error({
    level: "error",
    ...base,
    message: "Unknown error",
    value: process.env.NODE_ENV === "production" ? undefined : error,
  });
}

export async function withServerFallback<T>(
  loader: () => Promise<T>,
  fallback: T,
  context: string,
  metadata?: LogMetadata,
) {
  try {
    return await loader();
  } catch (error) {
    logServerError(context, error, metadata);
    return fallback;
  }
}
