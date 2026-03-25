# Config Notes

Configuration lives primarily in root environment variables and per-app framework config files.

## Early conventions

- shared environment examples live in [`.env.example`](../.env.example)
- app-specific runtime config stays inside `apps/web`
- data source base URLs should remain configurable for testing and local overrides
