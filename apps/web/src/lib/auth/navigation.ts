export function sanitizeInternalRedirectPath(value: string | null | undefined, fallback = "/profile") {
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
      return "Supabase Auth is not configured yet.";
    case "missing-auth-code":
      return "The authentication callback was missing its auth code.";
    case "auth-callback-failed":
      return "The authentication callback could not complete. Try signing in again.";
    case "too-many-auth-attempts":
      return "Too many authentication attempts from this client. Wait a minute and try again.";
    case "profile-bootstrap-failed":
      return "You are signed in, but your profile could not be prepared yet.";
    default:
      return code;
  }
}
