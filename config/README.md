# Config Notes

Configuration is intentionally thin. Runtime behavior is controlled by root environment variables, per-app framework config, and data-pipeline path settings rather than checked-in secret files.

## Conventions

- Shared environment examples live in [`.env.example`](../.env.example).
- Local secrets belong in `.env.local`; they are ignored and must not be committed.
- App-specific runtime config stays inside `apps/web`.
- Data source base URLs remain configurable for testing and local overrides.
- Generated data paths are controlled by the data settings modules and should stay outside browser runtime code.

## Important Environment Groups

| Area | Variables |
| --- | --- |
| Public app config | `NEXT_PUBLIC_APP_URL`, `NEXT_PUBLIC_PRIVACY_CONTACT_EMAIL` |
| Supabase browser auth | `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` |
| Supabase server/admin | `SUPABASE_SERVICE_ROLE_KEY` |
| Rate limiting | `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN` |
| Strategy Lab access | `STRATEGY_LAB_ACCESS_TOKEN`, `STRATEGY_LAB_ALLOWED_EMAILS`, `STRATEGY_LAB_ALLOWED_USER_IDS` |
| Data sources | `JOLPICA_BASE_URL`, `OPENF1_BASE_URL`, `DATABASE_URL` |

Keep service-role keys, database URLs, OAuth secrets, and Upstash tokens server-side only.
