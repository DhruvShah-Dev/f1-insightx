# Supabase Heartbeat

F1 InsightX uses a lightweight GitHub Actions heartbeat to keep the Supabase free-tier project active when app traffic is low.

## What It Pings

The workflow calls:

```text
/api/health/supabase
```

That route performs one read-only anon-key query against `public.races`:

```text
select id from races limit 1
```

It does not use the service-role key, does not call Analytics, Strategy Lab, Race Analysis, or raw telemetry routes, and returns only a small health payload.

## Workflow

File:

```text
.github/workflows/supabase-heartbeat.yml
```

Schedule:

- Sunday 09:17 UTC
- Wednesday 09:17 UTC
- manual `workflow_dispatch`

## Required GitHub Variable

Set a repository variable, not a secret:

```text
F1_INSIGHTX_HEARTBEAT_URL=https://<production-domain>/api/health/supabase
```

The endpoint is public and contains no credential material. Keeping it as a variable avoids hardcoding the deployment domain.

## Manual Run

1. Open GitHub Actions.
2. Select `Supabase Heartbeat`.
3. Run workflow.
4. Confirm the log says `Supabase heartbeat OK`.

## Disable

Disable the workflow in GitHub Actions or remove the `F1_INSIGHTX_HEARTBEAT_URL` repository variable. Removing the variable makes the workflow fail visibly instead of silently pinging the wrong target.

## If Supabase Pauses Or Auth Fails

Check in Supabase:

- project pause or billing/inactivity notices
- database availability
- Google provider enabled state
- Google OAuth client ID/secret validity
- OAuth consent screen status
- Supabase site URL and redirect URLs
- email/password provider state

Important: ordinary site visits may not create database activity if the page is served from cache or CSV product views. This heartbeat intentionally performs a tiny database read.
