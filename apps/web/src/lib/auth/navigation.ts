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
