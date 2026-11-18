# Data Platform

This directory contains the F1 InsightX data platform: immutable source snapshots, provider-neutral cleaned sessions, canonical session tables, deterministic feature layers, product-facing views, and SQL loaders.

Treat this as the operating backbone of a real race-intelligence startup. The app should earn user trust by showing only data that is current enough, validated enough, and explainable enough for the product surface using it.

The repository includes validated release snapshots alongside code, validators, SQL, and docs. Cache files and bulk historical archives remain local; regenerate release snapshots through the pipeline before publishing a new race.

## Product Data Principles

- Raw data is evidence; product views are the contract.
- Every prediction, comparison, and race report should trace back to deterministic source tables or a documented proxy.
- Do not let post-race outcomes leak into pre-race prediction features.
- Do not present estimates as official timing, race-control, ERS, battery, or FIA data.
- Prefer compact Supabase/product views for runtime reads.
- Keep freshness visible when a feature depends on partial or delayed data.

## Current state and coverage

Read [`season_state.json`](season_state.json) for the latest validated product
release and its per-layer freshness. It is generated data; this README does not
pin a race or round that will become stale after the next refresh.

The separate local 2026 OpenF1 archive was audited on November 17, 2026:
100 completed sessions have provider data, and 10 scheduled sessions have no
provider feed. Both car telemetry and GPS are present for all 100 available
sessions. See the [telemetry coverage](reports/openf1_telemetry_2026_download.json),
[other endpoint coverage](reports/openf1_extras_2026_download.json), and
[baseline gap report](reports/openf1_missing_2026_download.json). These archive
downloads are source evidence; a product view changes only after the relevant
builders, validators, and release steps run.

## Layers

### 1. Raw source snapshots

- `data/raw/reference`: snapshotted Jolpica/reference API payloads.
- `data/raw/openf1`: snapshotted OpenF1 meetings, sessions, and selected session endpoints from 2023 onward.
- `data/raw/fastf1`: read-only legacy evidence; no new production writes.

New OpenF1 raw downloads are Git-ignored and can be restored from the pipeline
archive or fetched again. Older raw snapshots already tracked by Git remain
tracked. Raw files should not be used directly by the web app.

### 2. Staged source consolidation

- `data/staged/fastf1`: read-only legacy session extracts.
- `data/staged/openf1`: per-season meetings, sessions, endpoint snapshots, and quality reports.
- `data/staged/sessions`: deterministic provider-neutral cleaned session packages.
- `data/quarantine/openf1`: rejected rows with reason, endpoint, source path, and timestamp.

Staged outputs are reproducible feature-engineering inputs and stay out of browser runtime code.
New OpenF1 staged downloads are Git-ignored; previously tracked snapshots stay
tracked until a deliberate migration removes them from Git.

Small generated files imported by the app at build time are release artifacts,
not bulk archives. In particular, `data/reports/position_story_backfill.json`
and `data/analytics/analytics_segment_map.csv` must be included in a release
that imports them, or generated before that release's build.

### 3. Canonical sessions

- `data/canonical_sessions`: manifest-gated canonical laps, results, stints, summaries, sessions, entrants, and weather with provenance.

Canonical outputs are the validated base for telemetry features, race-week layers, race analysis, and strategy products.

### 4. Product and feature views

- `data/curated`: compact reference/runtime tables such as drivers, constructors, circuits, races, standings, results, prediction snapshots, and fantasy inputs.
- `data/features`: driver and constructor form snapshots.
- `data/model_inputs`: leakage-aware model input tables.
- `data/predictions`: deterministic prediction snapshots, strategy-modeling baselines, Picks challenges, and pit-stop result inputs.
- `data/telemetry_features`: corner, braking, throttle, straight-line, energy-proxy, and lap-summary features.
- `data/analytics`: telemetry comparison views, indexed session shards, track summaries, and trace manifests.
- `data/race_analysis`: completed-race reports and derived post-race intelligence views.
- `data/race_week`: current weekend context, circuit metadata, readiness views, storylines, weather risk, and strategy signals.
- `data/strategy_lab`: deterministic race-strategy scenario inputs and outputs.
- `data/ml`: schema templates for future ML-ready datasets.

## Pipeline

Core refresh order from the repo root:

```bash
python data/fetch_reference_data.py --start-season 2025 --end-season 2026
python data/run_openf1_pipeline.py --season 2026 --round 20 --sessions FP1 FP2 FP3 Q R --only-missing
python data/normalize_results.py
python data/build_product_views.py
python build_canonical_sessions.py --start-season 2020 --end-season 2026
python validate_canonical_sessions.py
python build_telemetry_features.py --start-season 2020 --end-season 2026
python validate_telemetry_features.py
python data/build_race_week_layers.py
python data/build_strategy_lab_layers.py
python data/build_analytics_views.py
python data/build_analytics_indexes.py
python data/build_analytics_telemetry_traces.py
python data/build_race_analysis_views.py
python data/build_race_evidence.py
python data/build_decisive_lap_evidence.py
python validate_race_evidence.py
python validate_decisive_lap_evidence.py
python data/build_opening_evidence.py
python validate_opening_evidence.py
python data/build_pit_wall_picks.py
python build_season_state.py
python build_product_manifest.py
python validate_product_manifest.py
python validate_season_state.py
python data/load_supabase.py
```

Section 00 race evidence uses the local staged OpenF1 archive without exposing
bulk telemetry to the app. Audit all 2026 session and feed coverage with
`python data/audit_openf1_2026.py`; its report is
`data/reports/openf1_2026_session_audit.json`. The compact race evidence
views provide recorded events, lap-sampled intervals, featured telemetry/GPS
traces, recorded sectors, and per-race scene readiness. Rebuild them after race analysis, run
`python data/build_decisive_lap_evidence.py` to expand two featured laps to
all available drivers, then run both race-evidence validators and publish with
`python data/load_race_evidence.py`. The targeted loader replaces the affected
races in one database transaction, preserving the previous release if a check
or copy fails. The normal full loader also includes these views.

Section 02 uses a separate bounded first-lap position view. Rebuild it with
`python data/build_opening_evidence.py`, check it with
`python validate_opening_evidence.py`, and publish with
`python data/load_opening_evidence.py`. It retains only timestamped OpenF1
position changes between the canonical first timed lap start and the leader's
lap-one completion. Sparse drivers stay sparse; race-control messages are
filtered to this same UTC window at read time. The normal full loader includes
the opening view as well.

The loader reapplies the current 2026-11-17 Supabase migrations after its
base schema SQL. This keeps public grants, view permissions, and the account
profile contract consistent when the schema is refreshed.

Run the relevant commands above in order when the full local data estate is
available. The root `package.json` does not define a `data:refresh` script.
The `--round 20` command above is an example; select the completed round you
are refreshing.

For a one-time, resumable 2026 source archive backfill, run these in order
from the repository root:

```bash
python data/fetch_missing_openf1_2026.py
python data/fetch_missing_openf1_telemetry_2026.py
python data/fetch_missing_openf1_extras_2026.py
```

These scripts write raw JSON, staged CSV, and their coverage reports. The
telemetry script stores large responses in time or driver partitions rather
than one session JSON file. Run the scripts one at a time to respect the shared
OpenF1 request limit.

## Validation

```bash
python validate_openf1_quality.py
python validate_canonical_sessions.py
python validate_telemetry_features.py
python validate_analytics_views.py
python validate_analytics_telemetry_traces.py
python validate_race_analysis_views.py
python validate_race_evidence.py
python validate_product_manifest.py
python validate_season_state.py
python check_generated_artifacts.py
```

## Integrity Rules

- Pre-race features must not include same-race outcomes or post-race explanations.
- Energy fields are proxies and must never be labelled as true ERS or battery state.
- Position movement, DRS windows, traffic, dirty-air, overtakes, and race-control causes must be labelled as derived/proxy unless exact source evidence exists.
- Public runtime code should read compact product views or Supabase views, not raw telemetry archives.
- Do not commit raw source archives, parquet telemetry, canonical CSVs, quarantine files, telemetry features, indexed analytics shards, or large generated reports without an explicit release decision.

## Release Gate

Before data reaches the app or Supabase:

- run the relevant validators listed above
- inspect row counts against the previous release
- confirm sprint sessions, qualifying, race, and weather coverage for affected rounds
- document missing fields or caveats in the product surface
- keep generated large data out of git unless explicitly approved
