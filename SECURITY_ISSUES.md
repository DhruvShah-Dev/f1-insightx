# Security Issues

Generated: 2026-06-18

Scope reviewed:
- `npm audit --omit=dev`
- Web security helpers and API-adjacent code under `apps/web/src`
- Next.js headers/configuration
- GitHub Actions workflow configuration
- Python data pipeline dependency and subprocess surfaces

## Open Issues

No local-remediable security issues are currently tracked in this file. Manual follow-up items that require upstream releases, deployed environment access, or production credentials are tracked in `docs/manual-audit-tasks.md`.

## Positive Findings

- No tracked `.env.local` secrets were found during this pass.
- No `dangerouslySetInnerHTML`, direct `innerHTML`, `eval`, or `new Function` usage was found under `apps/web/src`.
- Sensitive account/profile routes already use authentication, same-origin checks, and rate limiting.
- Supabase profile access is backed by RLS-oriented SQL migrations.
- The Python subprocess calls found use argument arrays and do not use `shell=True`.
