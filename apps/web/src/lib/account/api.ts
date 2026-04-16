export const ACCOUNT_API_ROUTES = {
  profile: "/api/account/profile",
  export: "/api/account/export",
  usernameCheck: "/api/account/username/check",
  usernameSuggest: "/api/account/username/suggest",
} as const;

export function buildUsernameCheckUrl(username: string) {
  const params = new URLSearchParams({
    username,
  });
  return `${ACCOUNT_API_ROUTES.usernameCheck}?${params.toString()}`;
}

export function buildUsernameSuggestUrl(input: {
  constructorId?: string | null;
  driverId?: string | null;
}) {
  const params = new URLSearchParams();
  if (input.constructorId) {
    params.set("constructorId", input.constructorId);
  }
  if (input.driverId) {
    params.set("driverId", input.driverId);
  }

  const query = params.toString();
  return query ? `${ACCOUNT_API_ROUTES.usernameSuggest}?${query}` : ACCOUNT_API_ROUTES.usernameSuggest;
}

export type AccountApiSuccess<T> = {
  ok: true;
  data: T;
};

export function readAccountApiData<T>(payload: unknown): T | null {
  if (!payload || typeof payload !== "object") {
    return null;
  }

  const record = payload as Record<string, unknown>;
  if (record.ok === true && "data" in record) {
    return record.data as T;
  }

  return null;
}
