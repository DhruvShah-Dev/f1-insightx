type TrustedOriginOptions = {
  allowMissingHeaders?: boolean;
};

export function isTrustedOrigin(request: Request, appUrl?: string | null, options?: TrustedOriginOptions) {
  const origin = request.headers.get("origin");
  const requestUrl = new URL(request.url);
  const expectedOrigin = appUrl ? new URL(appUrl).origin : requestUrl.origin;
  const referer = request.headers.get("referer");

  if (origin) {
    return origin === expectedOrigin;
  }

  if (referer) {
    try {
      return new URL(referer).origin === expectedOrigin;
    } catch {
      return false;
    }
  }

  return options?.allowMissingHeaders ?? true;
}
