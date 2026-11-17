# Supabase audit — 2026-11-17

## Scope and result

Read-only catalog inspection covered the live `public` schema, RLS policies,
table and view grants, functions, indexes, and 2026 product coverage. Changes
were tested in a rolled-back transaction, then applied as migrations
`202611170001` through `202611170003`. No race, account, or Picks rows were deleted.

| Check | Live result after changes |
| --- | --- |
| Public tables | 87; RLS enabled on all 87 |
| `anon` table INSERT grants | 0 |
| `authenticated` table INSERT grants | 2: `user_profiles`, `user_race_picks` |
| `anon` readable tables | 59 with explicit public SELECT policies |
| Publicly readable views | 2 active telemetry views; both use invoker permissions |
| Race-analysis SELECT policies | 14, down from 28 duplicate policies |
| 2026 product coverage | 20 race reports, 82 analytics sessions; matches local product CSVs |
| Storage | 1 private pipeline bucket, no public object policies |
| Auth/profile contract | 14 Auth users; profile table currently empty; active avatar choices now accepted |

## Changes

- Revoked legacy broad Data API grants and regranted public reads only where
  matching SELECT policies exist. Profile and Picks writes remain scoped to
  authenticated users with ownership policies.
- Added read policies for `sessions` and `session_laps`, which Compare uses for
  sector bests. Added a `(session_id, driver_id)` index for that query.
- Made unused public view aliases security-invoker and removed their API grants.
  The private scoring views remain service-role only.
- Removed three redundant indexes and 14 duplicate SELECT policies.
- Removed direct API execution grants from trigger/scoring helpers; the profile
  mutation trigger now runs as invoker with an empty search path.
- Restricted future `postgres`-owned public tables, functions, and sequences
  by default. The data loader reapplies the 2026-11-17 migrations after its
  base SQL so a refresh does not restore old grants or policies.
- Updated the profile avatar constraint for the active account UI and normalized
  generated usernames to match the database rule. An authenticated profile
  insert was verified in a rolled-back transaction.

## Remaining checks

- `supabase_admin` owns a separate set of broad default privileges. The
  project `postgres` login cannot alter another role's defaults, so each new
  migration must explicitly revoke public grants and enable RLS before adding
  data. Check this in Supabase's Security Advisor after migrations.
- The Lovable database connector requires reauthentication. Direct PostgreSQL
  access through the configured `DATABASE_URL` was used for this audit.
- The live migration ledger includes a `20260814` migration absent from this
  checkout, while several older local SQL files are absent from the ledger.
  Reconcile that history before using an automated migration push against the
  connected project; the three new migrations are recorded in the live ledger.
- `data_pipeline_releases` is empty. Do not backfill a release record until the
  deployed tables are checked against a specific generated manifest; current
  race-report and analytics-session counts alone do not prove a full release.
- Existing Auth users have no profile rows. The account page creates a profile
  when a signed-in user visits it. No synthetic profiles were inserted.

See [Supabase setup](supabase-auth-setup.md) for deployment configuration.
