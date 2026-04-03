type ErrorPayload =
  | { error?: { message?: string | null } | string | null; [key: string]: unknown }
  | null
  | undefined;

export function readClientErrorMessage(payload: ErrorPayload, fallbackMessage: string) {
  if (!payload) {
    return fallbackMessage;
  }

  if (typeof payload.error === "string" && payload.error.trim()) {
    return payload.error;
  }

  if (
    typeof payload.error === "object" &&
    payload.error !== null &&
    typeof payload.error.message === "string" &&
    payload.error.message.trim()
  ) {
    return payload.error.message;
  }

  return fallbackMessage;
}

export function getNetworkErrorMessage(action: string) {
  return `${action} could not be completed because the connection dropped or the service did not respond in time.`;
}
