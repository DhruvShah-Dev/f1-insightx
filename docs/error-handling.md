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

- `apps/web/src/lib/errors/app-error.ts`
  - defines application error categories and safe public payload mapping
- `apps/web/src/lib/errors/logger.ts`
  - structured server-side logging and safe fallback helpers
- `apps/web/src/lib/errors/client.ts`
  - client-side helpers for safe message extraction and network copy
- `apps/web/src/lib/api/errors.ts`
  - standard API response helpers, including `apiErrorFrom`

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

1. validate input
2. return expected user-safe errors directly
3. catch unexpected failures once
4. map them through `apiErrorFrom`

## Recommended pattern for pages

- use `withServerFallback` for non-critical data
- log failures with route/page context
- render `StatePanel` for recoverable page-level failures

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
- auth callback
- race strategy simulator
- fantasy optimizer
- homepage and race detail server loading

## What still needs future work

- richer field-level validation UX across more controls
- end-to-end tests for error states
- optional production telemetry sink beyond console logging
