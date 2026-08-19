# Driver Headshots

Dedicated square driver headshot crops belong here. These assets support real product identity across Picks, profile views, comparison surfaces, and compact driver selectors.

Until a driver-specific headshot is added, `getDriverImagePath(driver, "headshot")` falls back to the current body/cutout source in `../body`.

## Asset Rules

- Use WebP for real driver imagery.
- Match driver file names to the IDs used in `src/lib/ui/driver-asset-manifest.ts`.
- Keep crops square and centered for compact UI surfaces such as Picks fields and profile/avatar previews.
- Preserve the fallback SVG in `../fallback/driver-placeholder.svg`.
- Run `npm run assets:audit` after adding or replacing driver assets.

## Product Standard

Do not add placeholder celebrity, stock, or AI-generated driver faces. If an official or properly licensed crop is not available, use the product fallback rather than reducing user trust with inaccurate imagery.
