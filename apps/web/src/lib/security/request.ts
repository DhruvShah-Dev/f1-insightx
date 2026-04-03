export function isTrustedOrigin(request: Request, appUrl?: string | null) {
  const origin = request.headers.get("origin");
  if (!origin) {
    return true;
  }

  const requestUrl = new URL(request.url);
  const expectedOrigin = appUrl ? new URL(appUrl).origin : requestUrl.origin;
  return origin === expectedOrigin;
}
