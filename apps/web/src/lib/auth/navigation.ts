export function sanitizeInternalRedirectPath(value: string | null | undefined, fallback = "/account") {
  if (!value) {
    return fallback;
  }

  if (!value.startsWith("/") || value.startsWith("//")) {
    return fallback;
  }

  return value;
}

export function mapAuthErrorCode(code: string) {
  switch (code) {
    case "supabase-auth-not-configured":
      return "Authentication is unavailable right now.";
    case "google-provider-unavailable":
      return "Google sign-in is currently unavailable. Use email sign-in or try again later.";
    case "oauth-access-denied":
      return "Google sign-in was cancelled. Email sign-in is still available.";
    case "oauth-callback-error":
      return "Google sign-in could not be completed. Use email sign-in or try again later.";
    case "missing-auth-code":
      return "The sign-in request could not be completed. Try again.";
    case "auth-callback-failed":
      return "The authentication callback could not complete. Try signing in again.";
    case "too-many-auth-attempts":
      return "Too many authentication attempts from this client. Wait a minute and try again.";
    case "profile-bootstrap-failed":
      return "You are signed in, but your profile is not ready yet. Try again shortly.";
    default:
      return code;
  }
}

export function mapProviderCallbackError(error: string | null, description?: string | null) {
  const normalizedError = error?.toLowerCase().trim() ?? "";
  const normalizedDescription = description?.toLowerCase().trim() ?? "";
  const combined = `${normalizedError} ${normalizedDescription}`;

  if (!normalizedError) {
    return null;
  }

  if (combined.includes("access_denied") || combined.includes("access denied")) {
    return "oauth-access-denied";
  }

  if (
    combined.includes("provider") ||
    combined.includes("disabled") ||
    combined.includes("not enabled") ||
    combined.includes("suspended") ||
    combined.includes("oauth")
  ) {
    return "google-provider-unavailable";
  }

  return "oauth-callback-error";
}
