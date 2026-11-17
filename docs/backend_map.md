# Backend Surface Map

The active backend surface is a TanStack Start server-function layer in the
repository root. The archived `apps/web` REST API map is retained only in git
history and should not guide new product work.

## Active Server Functions

| Product Area    | Route(s)          | Server Function(s)                                    | Auth Required             | Data Source                                    |
| --------------- | ----------------- | ----------------------------------------------------- | ------------------------- | ---------------------------------------------- |
| Race Control    | `/`               | `getSeasonTelemetry`, `getRaceWeek`, `getRaceReports` | No                        | Supabase when configured; bundled fallback |
| Race Week       | `/raceweek`       | `getRaceWeek`                                         | No                        | Supabase when configured; bundled fallback |
| Championship    | `/championship`   | `getChampionship`                                     | No                        | Supabase when configured; bundled fallback |
| Analysis Index  | `/analysis`       | `getRaceReports`                                      | No                        | Supabase when configured; bundled fallback |
| Analysis Detail | `/analysis/$slug` | `getRaceReport`, `getRacePositionStory`, `getLapTrace` | No                      | Supabase when configured; bundled fallback |
| Compare         | `/vs`             | `getWeekendIndex`, `getHeadToHead`, `getLapTrace`, `getTelemetryComparison` | No | Supabase plus local product artifacts where available |
| Picks           | `/picks`          | `getPicksBoard`                                       | No                        | Supabase when configured; bundled fallback |
| Account         | `/account`        | account/profile helpers                               | Yes for profile mutations | Supabase Auth and `user_profiles`              |
| Methodology     | `/method`         | none                                                  | No                        | Static route content                           |

## Data Source Switch

Public F1 product functions use Supabase when runtime URL and publishable key
are configured, with a bundled fallback if a read fails. Set
`F1_INSIGHTX_PUBLIC_DATA_SOURCE=local` to force the bundled snapshot, or
`=supabase` to require a Supabase attempt. Check the current release manifest
before treating either source as fresh.

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
