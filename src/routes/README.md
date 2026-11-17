# Product Routes

This directory is the active customer-facing F1 InsightX product surface. Treat every route as production UI, not portfolio scaffolding. Route changes should improve a real workflow: race-week reading, post-race analysis, driver comparison, picks, account management, or product trust.

TanStack Start uses **file-based routing**. Every `.tsx` file in this directory defines a route. Do **not** create `src/pages/`, `src/routes/_app/index.tsx`, or `app/layout.tsx`; those are Next.js / Remix conventions. The only root layout is `src/routes/__root.tsx`.

The legacy `apps/web` Next.js app is not part of the active root build. Do not add new product routes, API handlers, security headers, or data loaders there unless you are intentionally working on the archived Next app.

## Current Race Workflows

- `raceweek.tsx` (`/raceweek`) shows the next weekend's circuit profile, schedule, weather, and qualifying and race projections.
- `analysis.index.tsx` (`/analysis`) shows the 2026 season index, a selectable featured race, search, completed/all/upcoming filters, and links to completed reports.
- `analysis.$slug.tsx` (`/analysis/:slug`) shows the selected race's result table, qualifying-to-grid Stakes scene, opening position story, and deeper pace, pit, timeline, and circuit views when data supports them. Qualifying and sprint sessions appear when available.
- `vs.tsx` (`/vs`) compares two drivers across sessions, including sector and telemetry views when the selected session has data.
- `championship.tsx` (`/championship`) shows driver and constructor standings and sortable season metrics.
- `picks.tsx` (`/picks`) loads the picks board and renders `src/components/picks-experience.tsx` inside `src/components/picks-shell.tsx`. Signed-in users can select drivers until the round locks. Cards are stored per user in browser local storage; completed-round points are calculated from stored results in that browser.
- `account.tsx` (`/account`) handles Google sign-in, profile details, and account controls.

The shared responsive navigation and footer live in `src/components/site-chrome.tsx` and `src/components/site-chrome.css`. Race Week, Compare, Championship, and Account use their matching route CSS files. The analysis pages use `src/analysis.css` and `src/analysis-report.css`; Picks styles live in `src/styles.css`.

## Product Rules

- Prefer dense, usable race-intelligence screens over landing-page filler.
- Keep data-derived claims close to the server function or source view that supports them.
- Label proxies and partial data honestly in UI copy.
- Account-gated flows must fail closed and route users to `/account`.
- Avoid route-local data hacks when `src/lib/f1.server.ts` or Supabase views already provide the contract.
- Keep `routeTree.gen.ts` generated; do not edit it by hand.

## Route conventions

`analysis.index.tsx` maps to `/analysis`, `analysis.$slug.tsx` maps to
`/analysis/:slug`, and `__root.tsx` wraps every route. Keep page-specific CSS
beside the route when it is not shared across the product.

## Shipping Checklist

- run `npm.cmd run lint`
- run `npm.cmd run build`
- load changed local routes in the browser
- confirm mobile text does not overlap or clip
- confirm unauthenticated and authenticated account states still work where relevant
