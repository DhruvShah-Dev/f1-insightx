# Circuit Segment Metadata Plan

Last audited: 2026-05-10

## Current Status

F1 InsightX currently uses approximate telemetry segments. These segment IDs are generated from distance-binned fastest-lap telemetry traces, not from verified circuit corner metadata.

Examples:

- `miami-grand-prix_corner_01`
- `miami-grand-prix_straight_04`
- `japanese-grand-prix_corner_20`

Current segment consumers:

- Analytics segment comparison views.
- Analytics braking, throttle, straight, and energy deployment proxy tabs.
- Strategy Lab telemetry-derived signals and track archetype weighting.
- Race Analysis traffic/position context indirectly through product views.

Current circuit metadata:

- `data/curated/circuits.csv` has stable `circuit_id`, name, location, and coordinates.
- `data/curated/races.csv` links race IDs to `circuit_id`.
- `data/race_week/circuit_track_paths.json` has FastF1-position-based SVG path data for a small set of circuits, including Miami and Bahrain.
- `apps/web/src/lib/ui/asset-manifest.ts` contains display/asset metadata for circuits.

Current limitations:

- Segment IDs are approximate and distance-bin based.
- Segment counts can vary by session because bins are classified from selected telemetry traces.
- Segment IDs use event names, not canonical `circuit_id`, so they need a mapping layer.
- No local verified corner-name table exists.
- No current UI should show exact named corners from these approximate IDs.

## Priority Circuits

The first circuits to prepare for named metadata are:

| Priority | Circuit ID | Circuit | Status | Difficulty | Notes |
| ---: | --- | --- | --- | --- | --- |
| 1 | `miami` | Miami International Autodrome | Track path exists locally | Medium | Latest completed race, strong product relevance |
| 2 | `villeneuve` | Circuit Gilles Villeneuve | Schedule/circuit metadata exists | Medium | Next race context; track path may need generation |
| 3 | `monaco` | Circuit de Monaco | Schedule/circuit metadata exists | High | Many named sections, tight layout, high product value |
| 4 | `monza` | Autodromo Nazionale di Monza | Schedule/circuit metadata exists | Medium | Clear straights/chicanes, useful for power/braking analysis |
| 5 | `marina_bay` | Marina Bay Street Circuit | Schedule/circuit metadata exists | High | Street circuit, many slow corners, evolving layouts |
| 6 | `bahrain` | Bahrain International Circuit | Track path exists locally | Medium | Good Strategy Lab degradation benchmark |
| 7 | `suzuka` | Suzuka Circuit | Schedule/circuit metadata exists | High | Complex linked corners; needs careful manual review |

## Metadata Schema

Future canonical file:

`data/curated/circuit_segments.csv`

Template:

`data/curated/circuit_segments_template.csv`

Fields:

| Field | Meaning |
| --- | --- |
| `circuit_id` | Canonical ID from `data/curated/circuits.csv` |
| `circuit_name` | Human-readable circuit name |
| `segment_id` | Stable approximate or verified segment ID |
| `segment_kind` | `corner`, `straight`, `chicane`, `braking_zone`, `sector`, or `transition` |
| `display_name` | Public name, only for verified/supported rows |
| `short_name` | Compact label |
| `start_distance_m` | Segment start distance along lap |
| `end_distance_m` | Segment end distance along lap |
| `apex_distance_m` | Apex or key reference distance where applicable |
| `sector` | FIA/FastF1 sector if known |
| `direction` | `left`, `right`, `straight`, `complex`, or `unknown` |
| `confidence` | 0-1 confidence score |
| `source` | `manual`, `inferred`, `official_map`, or `fastf1_circuit_info` |
| `notes` | Short audit note |
| `verified` | Boolean gate for UI naming |

Companion file:

`data/curated/circuit_segment_aliases.csv`

Template:

`data/curated/circuit_segment_aliases_template.csv`

Fields:

| Field | Meaning |
| --- | --- |
| `circuit_id` | Canonical circuit ID |
| `segment_id` | Segment ID from the main metadata table |
| `alias` | Alternative name or spelling |
| `language` | Alias language or context |
| `source` | Alias source |
| `confidence` | 0-1 confidence score |

## Confidence Model

| Level | Score | Definition | UI Permission |
| --- | ---: | --- | --- |
| Verified/manual | 0.90-1.00 | Manually reviewed against reliable circuit map and telemetry distance | Can show named corner |
| FastF1-supported | 0.75-0.89 | Supported by FastF1 circuit info and consistent distance alignment | Can show name with subtle confidence |
| Inferred | 0.50-0.74 | Inferred from speed, braking, throttle, or distance shape | Keep approximate segment wording |
| Approximate fallback | 0.25-0.49 | Generated from current distance-bin fallback | Never show exact name |
| Unknown | 0.00-0.24 | Not enough evidence | Hide name; show unavailable/approximate |

Rules:

- `verified=false` means the UI must not present `display_name` as an exact corner name.
- Inferred rows can support internal modelling but not public exact naming.
- Approximate fallback rows remain compatible with current Analytics segment IDs.
- Confidence is not a probability; it is an editorial/data-quality gate.

## Mapping Strategy

1. Keep current approximate segment IDs stable for Analytics compatibility.
2. Introduce a mapping layer from `segment_id` to canonical `circuit_id`.
3. Add distance ranges using representative telemetry once Tier B telemetry selection exists.
4. Align candidate segments against FastF1 circuit info where available.
5. Manually review and set `verified=true` only after distance and visual checks pass.
6. Version metadata changes with notes; never silently rename existing segment IDs.

Distance matching should use:

- `Distance` from telemetry traces.
- Segment start/end/apex distances from speed minima, braking zones, and throttle pickup points.
- Circuit path orientation for sanity checks.
- Manual override when automatic inference disagrees with circuit layout.

## Validation Plan

Future validator should enforce:

- Required headers.
- `confidence` values between 0 and 1.
- `segment_kind`, `direction`, and `source` from allowed enums.
- `start_distance_m <= apex_distance_m <= end_distance_m` when all are present.
- No overlapping distance ranges for the same `circuit_id` unless `segment_kind=sector` or explicitly allowed.
- Verified rows require `display_name`, `source`, `notes`, and `confidence >= 0.9`.
- Unverified rows must not be exposed by UI as exact names.
- Segment IDs must be traceable to Analytics feature IDs or explicitly marked future/manual.
- Missing priority circuits should warn, not fail.

## Product Honesty Rules

- Keep current UI wording as `Approximate segment`.
- Do not show named corners until metadata rows are verified.
- Do not infer exact corner names from speed shape alone.
- Do not replace current segment IDs; map onto them.
- Do not claim exact layout support for circuits with only fallback telemetry bins.

## Next Implementation Step

Create a validator and then populate Miami with a small manually reviewed pilot set. Until that pilot is verified, Analytics and Race Analysis should keep approximate segment language.
