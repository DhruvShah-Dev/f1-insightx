# Driver Headshots

This directory belongs to the archived `apps/web` UI. It is retained for
historical asset provenance and should not receive active product work unless
the archived app is intentionally revived.

Dedicated square driver headshot crops belong here. These assets support real product identity across Picks, profile views, comparison surfaces, and compact driver selectors.

In the archived app, `getDriverImagePath(driver, "headshot")` fell back to the
body/cutout source in `../body`.

## Asset Rules

- Use WebP for real driver imagery.
- Match driver file names to the IDs used by the current active-app asset manifest before reusing these assets.
- Keep crops square and centered for compact UI surfaces such as Picks fields and profile/avatar previews.
- Preserve the fallback SVG in `../fallback/driver-placeholder.svg`.
- Run the current asset audit command after adding or replacing driver assets.

## Product Standard

Do not add placeholder celebrity, stock, or AI-generated driver faces. If an official or properly licensed crop is not available, use the product fallback rather than reducing user trust with inaccurate imagery.
