# Abuse Protection And Cost Controls

This project uses low-cost, app-level abuse protection to keep Supabase and auth usage predictable on free-tier infrastructure.

## Approach

- in-memory request rate limiting in `apps/web/src/lib/security/rate-limit.ts`
- stricter limits on auth-adjacent and mutation routes
- short caching for public F1 data endpoints
- no-store headers on account, auth, and write-heavy routes
- conservative error messages to avoid easy probing

This is intentionally zero-cost friendly. It does **not** depend on paid WAFs, Redis, or third-party rate-limit services.

## Important limitation

The built-in rate limiter is process-local memory.

That means:

- it works well in local development
- it provides useful protection in low-traffic production
- it is not globally coordinated across multiple server instances

For a free-tier hobby deployment, this is still a worthwhile first layer. If traffic grows, move the limiter to a shared store.

## Default route limits

These defaults live in `apps/web/src/lib/security/rate-limit.ts`.

- `/auth/callback`
  - `24` requests / `10 minutes`
- `/auth/sign-out`
  - `20` requests / `5 minutes`
- `/api/account/username/check`
  - `24` requests / `1 minute`
- `/api/account/username/suggest`
  - `12` requests / `1 minute`
- `/api/account/profile` `GET`
  - `60` requests / `1 minute`
- `/api/account/profile` `PATCH`
  - `10` requests / `10 minutes`
- `/api/fantasy-builder/recommend`
  - `12` requests / `5 minutes`
- `/api/race-scenarios/simulate`
  - `12` requests / `5 minutes`
- `/api/fantasy-builder/validate`
  - `60` requests / `1 minute`
- `/api/race-scenarios/validate`
  - `60` requests / `1 minute`
- public read APIs like race week, predictions, and reference data
  - `120` requests / `1 minute`
- `/api/fantasy-builder/dataset`
  - `60` requests / `1 minute`
- `/api/health`
  - `30` requests / `1 minute`

## Cached endpoints

To reduce repeated Supabase and server compute usage, these read-heavy routes send cache headers:

- `/api/platform/race-week`
- `/api/predictions/upcoming`
- `/api/fantasy-builder/dataset`
- `/api/reference/drivers`
- `/api/reference/constructors`
- `/api/reference/circuits`
- `/api/reference/races`
- `/api/reference/races/[raceId]/context`

Private/account routes intentionally use `Cache-Control: no-store`.

## What is protected in code

- username probing endpoints are rate-limited
- profile read/write endpoints are rate-limited
- expensive recommendation and simulation routes are rate-limited
- auth callback is rate-limited
- sign-out is rate-limited
- public data routes are cached and rate-limited
- the profile UI reduces unnecessary username-availability requests while typing

## What still depends on Supabase / Google setup

These protections are outside the app and still matter:

- enable only the auth providers you intend to use
- set correct site URL and callback URLs in Supabase
- configure Google OAuth redirect URIs correctly
- keep `SUPABASE_SERVICE_ROLE_KEY` server-only
- rotate keys if they are ever exposed

## Tuning guidance

If you need to adjust limits:

1. edit `apps/web/src/lib/security/rate-limit.ts`
2. keep auth and mutation limits stricter than read-only routes
3. prefer raising limits slowly after observing legitimate traffic
4. keep public read routes cached before increasing their raw limit

## Recommended next hardening steps

- add shared-store rate limiting if traffic grows beyond one instance
- add lightweight bot protection on account creation if abuse appears
- add auth and API smoke tests so rate-limit regressions are caught before deploy
