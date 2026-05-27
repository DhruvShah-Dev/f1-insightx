# F1 InsightX Backend API Map

| Route Path | HTTP Method(s) | Auth Required | Rate Limit Policy | Supabase Access Mode | Data Source |
| :--- | :---: | :---: | :--- | :---: | :---: |
| `/api/account/export` | POST | **Yes** | `profileWrite` | Server client (authenticated user) | Supabase |
| `/api/account/profile` | GET | **Yes** | `profileRead` | Server client (authenticated user) | Supabase |
| `/api/account/profile` | PATCH | **Yes** | `profileWrite` | Server client (authenticated user) + Admin client (username checks) | Supabase |
| `/api/account/username/check` | GET | No | `usernameCheck` | Admin client (privileged) | Supabase |
| `/api/account/username/suggest` | GET | **Yes** | `usernameSuggest` | Server client (authenticated user) + Admin client (username suggestion generation) | Supabase |
| `/api/analytics/compare` | GET | No | `analyticsCompare` | Server client (public) | Supabase / CSV Fallback |
| `/api/analytics/session/[sessionId]/drivers` | GET | No | `publicRead` | Server client (public) | Supabase / CSV Fallback |
| `/api/analytics/sessions` | GET | No | `publicRead` | Server client (public) | Supabase / CSV Fallback |
| `/api/fantasy-builder/dataset` | GET | No | `fantasyDataset` | Server client (public) | Supabase / CSV Fallback |
| `/api/fantasy-builder/recommend` | POST | **Yes** | `fantasyRecommend` | Server client (authenticated user) | Supabase / CSV Fallback |
| `/api/fantasy-builder/validate` | POST | No | `fantasyValidate` | Server client (public) | Supabase / CSV Fallback |
| `/api/health` | GET | No | `health` | None | None |
| `/api/health/supabase` | GET | No | `health` | Server client (public) | Supabase |
| `/api/platform/race-week` | GET | No | `publicRead` | Server client (public) | Supabase / CSV Fallback |
| `/api/predictions/upcoming` | GET | No | `publicRead` | Server client (public) | Supabase / CSV Fallback |
| `/api/race-scenarios/simulate` | POST | **Yes** | `raceScenarioSimulate` | Server client (authenticated user) | Supabase / CSV Fallback |
| `/api/race-scenarios/validate` | POST | No | `raceScenarioValidate` | Server client (public) | Supabase / CSV Fallback |
| `/api/reference/circuits` | GET | No | `publicRead` | Server client (public) | Supabase / CSV Fallback |
| `/api/reference/constructors` | GET | No | `publicRead` | Server client (public) | Supabase / CSV Fallback |
| `/api/reference/drivers` | GET | No | `publicRead` | Server client (public) | Supabase / CSV Fallback |
| `/api/reference/races` | GET | No | `publicRead` | Server client (public) | Supabase / CSV Fallback |
| `/api/reference/races/[raceId]/context` | GET | No | `publicRead` | Server client (public) | Supabase / CSV Fallback |
| `/api/strategy-lab/races/[raceId]` | GET | No | `publicRead` | Server client (public) | Supabase / CSV Fallback |
| `/auth/callback` | GET | No | `authCallback` | Server client (public/anonymous session exchanges) | Supabase |
| `/auth/sign-out` | POST | No | `signOut` | Server client (authenticated user) | Supabase |
