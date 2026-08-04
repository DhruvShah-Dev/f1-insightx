# Maintainability Roadmap

This roadmap captures targeted refactors that keep F1 InsightX premium as the data platform grows. These items are intentionally separate from data refreshes and release fixes so they can be reviewed with clear ownership and regression coverage.

## Frontend Styling

Target: `apps/web/src/app/globals.css`

Current state:
- The global stylesheet carries app-wide tokens, layout primitives, page sections, and component-specific rules in one file.
- This keeps deployment simple, but it makes visual changes harder to review and increases the risk of unrelated style regressions.

Planned fix:
- Extract stable design tokens, resets, and shared primitives into a compact global layer.
- Move route-specific rules into feature stylesheets or component-local modules where the ownership boundary is obvious.
- Keep high-value shared utilities documented and avoid one-off utility drift.
- Validate with `npm run lint --workspace web`, `npm run typecheck`, `npm run build --workspace web`, and viewport screenshots for the core product surfaces.

## Race Week Pipeline

Target: `data/build_race_week_layers.py`

Current state:
- The race-week builder owns ingestion joins, feature shaping, confidence scoring, board generation, and storyline output in a single script.
- The script is deterministic and validated, but the file size makes focused review and future data-source changes harder than necessary.

Planned fix:
- Split pure feature builders from orchestration and file I/O.
- Move shared scoring and formatting helpers into small modules under `data/f1_insightx_data/`.
- Preserve the current CSV contracts and add fixture-backed tests before changing output shape.
- Validate with `python -m pytest`, `python validate_product_manifest.py`, `python validate_season_state.py`, and the race-week data refresh gate.
