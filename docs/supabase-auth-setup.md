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

This:

- creates the canonical F1 data tables
- creates `user_profiles`
- enables RLS on all public tables
- adds user-specific policies for profile rows

## Enable auth providers

### Email

1. Go to `Authentication` -> `Providers` -> `Email`
2. Enable email/password sign-in

### Google

1. Go to `Authentication` -> `Providers` -> `Google`
2. Add your Google OAuth client ID and secret
3. In Google Cloud, add the Supabase callback URL shown in the provider screen
4. In Supabase, set the site URL to your app URL

For local development, include:

- `http://localhost:3000`
- `http://localhost:3000/auth/callback`

## Verify the setup

1. Restart the app after editing env vars.
2. Open `/account`.
3. Confirm:
   - sign-in is enabled
   - Google sign-in is enabled when auth vars are present
   - sign-up is enabled when service-role-backed profile persistence is configured
4. Create an account and confirm a `user_profiles` row is created.

## Security model

- public data tables have RLS enabled and no broad public read policies by default
- server-side data access uses the service role key
- the service role key must never be exposed to browser code
- `user_profiles` is protected with row-level policies tied to `auth.uid()`
- `.env.local` must never be committed to git

## Abuse and cost notes

- app-level rate limits are documented in `docs/abuse-protection.md`
- email/password sign-in and sign-up happen directly against Supabase Auth, so keep only the providers you actually use enabled
- Google OAuth initiation is provider-managed; the app rate-limits the callback and follow-up profile endpoints, but provider enablement and redirect safety still depend on Supabase and Google dashboard setup
