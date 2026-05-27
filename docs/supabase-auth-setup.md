# Supabase Auth Setup

This project uses Supabase in two distinct ways:

- browser auth: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- server-side profile persistence and username availability: `SUPABASE_SERVICE_ROLE_KEY`

## Required environment variables

Put these in the repo-root `.env.local`:

```env
NEXT_PUBLIC_APP_URL=http://localhost:3000
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
DATABASE_URL=...
```

## Where to get them

In Supabase:

1. Open your project.
2. Go to `Project Settings` -> `API`.
3. Copy:
   - `Project URL` -> `NEXT_PUBLIC_SUPABASE_URL`
   - `anon` key -> `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `service_role` key -> `SUPABASE_SERVICE_ROLE_KEY`
4. Go to `Project Settings` -> `Database` to get `DATABASE_URL`.

## Run the schema

Run the SQL in:

- `data/sql/001_core_schema.sql`
- `data/sql/002_fastf1_pipeline.sql`
- `data/sql/003_race_week_schema.sql`
- `data/sql/004_strategy_lab_schema.sql`
- `data/sql/005_backend_hardening.sql`
- `supabase/migrations/202605270001_explicit_data_api_grants.sql`

This:

- creates the canonical F1 data tables
- creates `user_profiles`
- enables RLS on all public tables
- adds user-specific policies for profile rows
- explicitly grants Data API access to intended public read-only tables

## Enable auth providers

### Email

1. Go to `Authentication` -> `Providers` -> `Email`
2. Enable email/password sign-in

### Google

1. Go to `Authentication` -> `Providers` -> `Google`
2. Add your Google OAuth client ID and secret
3. In Google Cloud, add the Supabase callback URL shown in the provider screen
4. In Supabase, set the site URL to your app URL
5. Add every production/preview callback URL to Supabase additional redirect URLs

For local development, include:

- `http://localhost:3000`
- `http://localhost:3000/auth/callback`

For production, verify:

- Supabase `Site URL` is the production app URL
- Supabase `Additional Redirect URLs` includes `https://<production-domain>/auth/callback`
- Google Cloud authorized redirect URI matches the Supabase Google callback URL exactly
- Google OAuth consent screen is published or in a test state that includes the expected users
- the Google provider is enabled and not suspended
- email/password remains enabled as the fallback sign-in path

## Verify the setup

1. Restart the app after editing env vars.
2. Open `/account`.
3. Confirm:
   - sign-in is enabled
   - Google sign-in is enabled when auth vars are present
   - sign-up is enabled when service-role-backed profile persistence is configured
4. Create an account and confirm a `user_profiles` row is created.
5. Call `/api/health/supabase` and confirm it returns `{ "ok": true, "source": "supabase" }`.
6. In GitHub repository variables, set `F1_INSIGHTX_HEARTBEAT_URL=https://<production-domain>/api/health/supabase`.

## Security model

- public F1 reference/product tables have RLS enabled, explicit read-only policies, and explicit `SELECT` grants
- private profile rows are protected by authenticated-only grants plus RLS ownership checks
- server-side data access uses the service role key
- the service role key must never be exposed to browser code
- `user_profiles` is protected with row-level policies tied to `auth.uid()`
- `anon` must not have any `user_profiles` privileges
- `.env.local` must never be committed to git

## Data API grants

Supabase requires explicit table grants for newly created public-schema tables. For new tables:

- public read-only F1/product table: add `GRANT SELECT ... TO anon, authenticated` and a matching SELECT RLS policy
- authenticated user-owned table: grant only the needed authenticated operations and enforce row ownership with RLS
- server/admin table: do not grant anon/authenticated access
- never grant public write access unless there is a reviewed product requirement and matching RLS policy

## Abuse and cost notes

- app-level rate limits are documented in `docs/abuse-protection.md`
- email/password sign-in and sign-up happen directly against Supabase Auth, so keep only the providers you actually use enabled
- Google OAuth initiation is provider-managed; the app rate-limits the callback and follow-up profile endpoints, but provider enablement and redirect safety still depend on Supabase and Google dashboard setup
