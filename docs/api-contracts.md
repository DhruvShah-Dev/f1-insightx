# Runtime Contracts

F1 InsightX uses TanStack Start routes and server functions for the active
root UI. Legacy REST endpoint contracts from the archived Next app are no
longer active product contracts.

## Data Source Mode

Public F1 product pages use the generated bundled snapshot by default. This
keeps production and local previews current even when Supabase public tables are
behind the latest data pipeline refresh.

Set `F1_INSIGHTX_PUBLIC_DATA_SOURCE=supabase` only when the Supabase public
product tables have been refreshed and validated through the latest completed
race.

Supabase remains the required runtime service for account/auth profile flows.

## Active Routes

| Route             | Purpose                                                             | Primary server functions                              |
| ----------------- | ------------------------------------------------------------------- | ----------------------------------------------------- |
| `/`               | Race control home, next GP, championship pulse, latest report entry | `getSeasonTelemetry`, `getRaceWeek`, `getRaceReports` |
| `/raceweek`       | Current race-week command center and projections                    | `getRaceWeek`                                         |
| `/championship`   | Driver and constructor standings                                    | `getChampionship`                                     |
| `/analysis`       | Completed-race report index                                         | `getRaceReports`                                      |
| `/analysis/$slug` | Completed-race report detail                                        | `getRaceReport`, `getLapTrace`                        |
| `/vs`             | Driver-vs-driver comparison workspace                               | `getWeekendIndex`, `getHeadToHead`, `getLapTrace`     |
| `/picks`          | Race-week picks board                                               | `getPicksBoard`                                       |
| `/method`         | Methodology and product honesty notes                               | Static route content                                  |
| `/account`        | Supabase-backed account and profile surface                         | Account/auth helpers                                  |

## Public F1 Server Functions

All public F1 functions live in `src/lib/f1.functions.ts` and delegate to
`src/lib/f1.server.ts` only when Supabase public data is explicitly enabled.
Otherwise they use `src/lib/f1.fallback.ts` and the generated local snapshot.

| Function             | Input                         | Output                                                                         |
| -------------------- | ----------------------------- | ------------------------------------------------------------------------------ |
| `getSeasonTelemetry` | none                          | season, standings round, driver standings, constructor standings, race options |
| `getRaceWeek`        | none                          | next-race metadata, weather, projected order, strategy, qualifying predictions |
| `getRaceReports`     | none                          | completed-race report summaries                                                |
| `getRaceReport`      | `{ slug }`                    | report detail, stints, positions, stories, weather, lap context                |
| `getWeekendIndex`    | optional `{ season }`         | available completed weekends                                                   |
| `getWeekend`         | `{ slug }`                    | weekend detail payload                                                         |
| `getHeadToHead`      | `{ slug, a, b }`              | two-driver comparison payload                                                  |
| `getLapTrace`        | `{ raceAnalysisId, drivers }` | bounded lap trace rows for one or two drivers                                  |
| `getPicksBoard`      | optional `{ season }`         | current picks challenge and leaderboard state                                  |

## Contract Rules

- Runtime handlers must return bounded product payloads.
- Runtime code must not parse raw FastF1 telemetry, parquet files, or broad
  source directories.
- Public pages must preserve proxy wording for approximated telemetry,
  position movement, and energy deployment.
- Missing optional generated data should produce explicit unavailable states,
  not invented precision.
- Account/auth functions must keep service-role access server-side only.
