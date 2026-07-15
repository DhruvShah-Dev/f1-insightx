## Circuit Layout Assets

Stored under `public/assets/circuits`.

- `bahrain.svg`
  - Source: Wikimedia Commons
  - Original file: `Bahrain_International_Circuit--Grand_Prix_Layout_with_DRS.svg`
- `jeddah.svg`
  - Source: Wikimedia Commons
  - Original file: `Jeddah_Street_Circuit_2021.svg`
- `albert_park.svg`
  - Source: Wikimedia Commons
  - Original file: `Albert_Park_Circuit_2021.svg`
- `monaco.svg`
  - Source: Wikimedia Commons
  - Original file: `Circuit_Monaco.svg`
- `silverstone.svg`
  - Source: Wikimedia Commons
  - Original file: `Circuit_Silverstone_2011.svg`

These files are stored locally so the app does not hotlink third-party media from runtime components.

- `f1-circuits.geojson`
  - Source: `bacinger/f1-circuits`
  - URL: `https://github.com/bacinger/f1-circuits`
  - Use: fallback circuit geometry and baseline circuit metadata when a local SVG is not available

## Team Visual Placeholders

Stored under `public/assets/teams`.

- `car-placeholder.svg`
  - Local project placeholder for teams that do not yet have a consistent open-license media set
  - Intended to be replaced by repo-backed, rights-safe team photography later
- `2026/fallback/car-placeholder.svg`
  - Same local placeholder, staged in the current-season fallback folder for manifest-driven image resolution

## 2026 Team Car Assets

Stored under `public/assets/teams/2026`.
Runtime manifest paths resolve through `public/assets/teams/2026/cars`.

These files are stored locally so runtime cards do not hotlink unstable third-party media URLs.

- `mercedes.webp`
  - Source: Formula1.com 2026 Mercedes launch/gallery coverage
- `ferrari.webp`
  - Source: Formula1.com 2026 Ferrari launch/gallery coverage
- `mclaren.webp`
  - Source: Formula1.com 2026 McLaren launch/gallery coverage
- `haas.webp`
  - Source: Formula1.com 2026 Haas launch/gallery coverage
- `red-bull.webp`
  - Source: Formula1.com 2026 Red Bull Racing launch coverage
- `racing-bulls.webp`
  - Source page: `https://www.formula1.com/en/latest/article/first-look-racing-bulls-showcase-2026-livery-at-launch-event-in-detroit.ObKtbPEmmdtrnfMHw34pd`
- `alpine.webp`
  - Source: Formula1.com 2026 Alpine launch/gallery coverage
- `audi.webp`
  - Source page: `https://www.formula1.com/en/latest/article/first-look-audi-reveal-their-new-car-for-2026-f1-season.5g0jakpo0CQwnqoFDjhsAG`
- `williams.webp`
  - Source page: `https://www.formula1.com/en/latest/article/gallery-check-out-every-angle-of-williams-new-livery-for-their-2026-f1-car.5I6ZzmDjZPrMpl9UByTQAV`
- `cadillac.webp`
  - Source: Formula1.com 2026 Cadillac launch/gallery coverage
- `aston-martin.webp`
  - Source: Formula1.com 2026 Aston Martin launch/gallery coverage

## 2026 Driver Portrait Assets

Stored under `public/assets/drivers/2026`.
Runtime body/cutout paths resolve through `public/assets/drivers/2026/body`.
Dedicated headshot crops should be added under `public/assets/drivers/2026/headshots` when available; until then, UI helpers fall back to the body/cutout source.

These files are stored locally so the standings cards do not depend on runtime hotlinks.

- Source pattern: Formula1.com 2026 team-specific driver media assets
- Asset style: official 2026 right-facing driver cutouts
- Stored resolution: 2048px request variant where available
- Refresh script: `scripts/refresh_driver_portraits.py`

- `driver-placeholder.svg`
  - Local project fallback portrait used when a driver headshot is missing or intentionally disabled
- `2026/fallback/driver-placeholder.svg`
  - Same local placeholder, staged in the current-season fallback folder for manifest-driven image resolution

## Team Logo Variants

Stored under:

- `public/assets/teams/logos/dark`
- `public/assets/teams/logos/light`
- `public/assets/teams/logos/mono`

Current variant folders are populated from the existing local SVG logo set so callers can resolve a stable path for dark surfaces, light plates, and compact mono-style slots. The dark-surface variants are exported as transparent PNGs with black/dark fills lifted to high-contrast team colors for black backgrounds. Replace individual files with hand-tuned variants when brand-safe source assets are available.

Prefer SVG for team identity. Use PNG only for raster-only source logos or email/social contexts where SVG support is not acceptable.

## Product Logo Variants

Stored under `public/assets/logos/product`.

- `dark/wordmark.svg`
- `dark/wordmark.png`
- `light/minimal.svg`
- `icon/icon-light.svg`

These mirror existing local F1 InsightX marks in a context-based folder structure for future product surfaces.
