# Backend Surface Map

The active backend surface is a TanStack Start server-function layer in the
repository root. The archived `apps/web` REST API map is retained only in git
history and should not guide new product work.

## Active Server Functions

| Product Area    | Route(s)          | Server Function(s)                                    | Auth Required             | Data Source                                    |
| --------------- | ----------------- | ----------------------------------------------------- | ------------------------- | ---------------------------------------------- |
| Race Control    | `/`               | `getSeasonTelemetry`, `getRaceWeek`, `getRaceReports` | No                        | Bundled snapshot by default; optional Supabase |
| Race Week       | `/raceweek`       | `getRaceWeek`                                         | No                        | Bundled snapshot by default; optional Supabase |
| Championship    | `/championship`   | `getChampionship`                                     | No                        | Bundled snapshot by default; optional Supabase |
| Analysis Index  | `/analysis`       | `getRaceReports`                                      | No                        | Bundled snapshot by default; optional Supabase |
| Analysis Detail | `/analysis/$slug` | `getRaceReport`, `getLapTrace`                        | No                        | Bundled snapshot by default; optional Supabase |
| Compare         | `/vs`             | `getWeekendIndex`, `getHeadToHead`, `getLapTrace`     | No                        | Bundled snapshot by default; optional Supabase |
| Picks           | `/picks`          | `getPicksBoard`                                       | No                        | Bundled snapshot by default; optional Supabase |
| Account         | `/account`        | account/profile helpers                               | Yes for profile mutations | Supabase Auth and `user_profiles`              |
| Methodology     | `/method`         | none                                                  | No                        | Static route content                           |

## Data Source Switch

Public F1 product functions use local generated fallback data unless
`F1_INSIGHTX_PUBLIC_DATA_SOURCE=supabase` is set. This prevents stale Supabase
public product tables from overriding a freshly generated release snapshot.

## Retired Surfaces

The following old URLs are not active in the root UI and should not be added to
new docs or navigation:

- `/analytics`
- `/race-analysis`
- `/lab`
- `/predictions`
- `/api/analytics/*`
- `/api/platform/race-week`
- `/api/predictions/upcoming`
