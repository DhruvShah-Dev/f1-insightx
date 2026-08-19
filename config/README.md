# Configuration

Configuration is intentionally thin because F1 InsightX should behave like a production startup product: deployable from clean code, configurable per environment, and free of checked-in secrets.

Runtime behavior is controlled by root environment variables, framework config, Supabase project settings, and data-pipeline path settings.

## Operating Principles

- Secrets never live in git.
- Browser-visible variables must be safe to expose.
- Server/admin credentials stay server-side only.
- Production config changes should be documented with the feature or migration that requires them.
- Local overrides belong in ignored files such as `.env.local`.

## Conventions

- Shared environment examples live in [`.env.example`](../.env.example).
- Local secrets belong in `.env.local`; they are ignored and must not be committed.
- Active app runtime config belongs to the root TanStack Start app.
- The archived `apps/web` config should not be extended for new product work.
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

## Release Checks

Before shipping a config-dependent change:

- verify fallback behavior when Supabase env vars are absent
- confirm OAuth redirect URLs match the deployed domain
- confirm no service-role key is imported by browser code
- document any new variable in `.env.example`
