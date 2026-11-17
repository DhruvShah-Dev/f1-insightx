# Documentation guide

Start with the root [README](../README.md) for the product and local setup.
The active app is at the repository root; `apps/web` is archived.

| Need | Document |
| --- | --- |
| Local development and checks | [Development](DEVELOPMENT.md) |
| Runtime and data boundaries | [Architecture](architecture.md) |
| Data pipeline and source policy | [Data platform](../data/README.md), [data sources](data-sources.md) |
| Deployment and release | [Deployment](deployment.md), [release checklist](RELEASE_CHECKLIST.md) |
| Post-race automation | [Post-race automation](POST_RACE_AUTOMATION.md) |
| Authentication and privacy | [Supabase auth](supabase-auth-setup.md), [Supabase audit](SUPABASE_AUDIT_2026-11-17.md), [privacy operations](PRIVACY_OPERATIONS.md) |
| Product data contracts | [API contracts](api-contracts.md), [backend map](backend_map.md) |

Reports with a date in their filename and screenshots record the state at the
time they were written. For current race coverage, use `data/season_state.json`
and the reports under `data/reports/` rather than an old handoff document.
