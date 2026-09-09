# Error Handling Strategy

This project treats error handling as two systems at once:

- a user-facing UX system
- a developer-facing reliability and debugging system

## Principles

- user-facing copy should be calm, specific, and safe
- expected failures should return structured errors
- unexpected failures should be logged with context
- routes should separate public error messages from developer diagnostics
- pages should degrade gracefully instead of collapsing entirely

## Shared building blocks

- `src/lib/f1.functions.ts`
  - public F1 server-function boundary and local fallback selection
- `src/lib/f1.server.ts`
  - optional Supabase-backed public product reads
- `src/lib/f1.fallback.ts`
  - generated snapshot fallback mapping for public routes
- `src/routes/*`
  - route-level error components and recoverable UI states

## Error categories

- `validation`
  - bad input, form issues, invalid payloads
- `auth`
  - session verification or sign-in related failures
- `authorization`
  - forbidden operations or invalid origin
- `config`
  - missing setup or unavailable server-side configuration
- `not_found`
  - expected missing resources
- `external`
  - Supabase or upstream service failures
- `rate_limited`
  - request throttling
- `internal`
  - unexpected runtime failures

## User-facing rules

- never show raw database, Supabase, or internal stack messages
- use actionable copy when the next step is obvious
- keep account, profile, and simulator errors inline where possible
- keep page-level failures inside stable layout panels

## Developer-facing rules

- unexpected failures should go through `logServerError`
- include route/page context and small metadata only
- do not log secrets, tokens, or raw request bodies
- keep thrown messages useful for debugging, but keep public copy separate

## Recommended pattern for routes

1. validate input with `zod` at the server-function boundary
2. return expected user-safe empty or unavailable states directly
3. catch unexpected external data failures once
4. fall back to the generated local snapshot when public F1 reads fail

## Recommended pattern for pages

- keep route-level `errorComponent` copy calm and specific
- log failures with route/page context when server helpers catch them
- render stable unavailable states for recoverable page-level failures

## Recommended pattern for client workspaces

- distinguish:
  - loading
  - empty
  - recoverable error
  - successful result
- use `readClientErrorMessage` for route payloads
- use `getNetworkErrorMessage` for fetch/network failures

## Current focus areas covered

- account and profile flows
- public F1 server functions
- homepage, race-week, championship, analysis, compare, and picks loading

## What still needs future work

- richer field-level validation UX across more controls
- end-to-end tests for error states
- optional production telemetry sink beyond console logging
