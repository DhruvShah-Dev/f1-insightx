# API Contracts

## Runtime mode

The M2 API layer can run in two modes:

- `supabase`: uses `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, and `SUPABASE_SERVICE_ROLE_KEY` on the server
- `local-curated-csv`: reads from `data/curated/*.csv` when Supabase is not configured

This keeps local development unblocked after M1 while preserving the production path.

## Reference endpoints

### `GET /api/health`

Returns a minimal public health payload with service status only.

### `GET /api/reference/drivers?search=&limit=`

Returns driver reference rows.

### `GET /api/reference/constructors?search=&limit=`

Returns constructor reference rows.

### `GET /api/reference/circuits?search=&limit=`

Returns circuit reference rows.

### `GET /api/reference/races?season=&limit=`

Returns race reference rows and available seasons.

### `GET /api/reference/races/:raceId/context`

Returns the race metadata plus entrant baselines used by the simulator:

- qualifying position
- constructor
- rolling form proxy
- overtake score
- reliability score

## Validation endpoints

### `POST /api/race-scenarios/validate`

Validates the contract for the upcoming race simulator. It does not predict anything yet.

### `POST /api/race-scenarios/simulate`

Runs the M4 heuristic race simulator and returns:

- projected finishing order
- projected points
- podium probability
- undercut impact
- confidence labels
- explanation lines per driver

### `POST /api/fantasy-builder/validate`

Validates fantasy lineup constraints for the upcoming optimization engine. It does not recommend a lineup yet.

### `GET /api/fantasy-builder/dataset?season=&round=`

Returns the fantasy candidate pool used by the optimizer:

- derived driver prices
- derived constructor prices
- projected scores
- value and volatility features
- pricing source metadata

### `POST /api/fantasy-builder/recommend`

Runs the M5 lineup optimizer and returns:

- primary lineup for the requested risk profile
- captain choice
- expected score
- total budget used
- conservative and aggressive alternative lineups
- rationale lines explaining the build

## Scope notes

- These endpoints are the M2 contract layer, not the final simulation or optimization logic.
- Validation warnings are advisory and intended to support transparent UX later in M4 and M5.
- The M4 simulator is deliberately heuristic and should be presented as a scenario engine, not as a guaranteed prediction model.
- The M5 fantasy optimizer currently uses derived historical pricing rather than official live fantasy prices. That limitation should remain visible in the UI.
