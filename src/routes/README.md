# Product Routes

This directory is the active customer-facing F1 InsightX product surface. Treat every route as production UI, not portfolio scaffolding. Route changes should improve a real workflow: race-week reading, post-race analysis, driver comparison, picks, account management, or product trust.

TanStack Start uses **file-based routing**. Every `.tsx` file in this directory defines a route. Do **not** create `src/pages/`, `src/routes/_app/index.tsx`, or `app/layout.tsx`; those are Next.js / Remix conventions. The only root layout is `src/routes/__root.tsx`.

The legacy `apps/web` Next.js app is not part of the active root build. Do not add new product routes, API handlers, security headers, or data loaders there unless you are intentionally working on the archived Next app.

## Product Rules

- Prefer dense, usable race-intelligence screens over landing-page filler.
- Keep data-derived claims close to the server function or source view that supports them.
- Label proxies and partial data honestly in UI copy.
- Account-gated flows must fail closed and route users to `/account`.
- Avoid route-local data hacks when `src/lib/f1.server.ts` or Supabase views already provide the contract.
- Keep `routeTree.gen.ts` generated; do not edit it by hand.

## Conventions

| File | URL |
| --- | --- |
| `index.tsx` | `/` |
| `about.tsx` | `/about` |
| `users/index.tsx` | `/users` |
| `users/$id.tsx` | `/users/:id` |
| `posts/{-$category}.tsx` | `/posts/:category?` |
| `files/$.tsx` | `/files/*` |
| `_layout.tsx` | layout route with `<Outlet />` |
| `__root.tsx` | app shell wrapping every page |

## Shipping Checklist

- run `npm.cmd run lint`
- run `npm.cmd run build`
- load changed local routes in the browser
- confirm mobile text does not overlap or clip
- confirm unauthenticated and authenticated account states still work where relevant
