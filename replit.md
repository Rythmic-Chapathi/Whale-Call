# Whale Call

A tropical island rideshare and emergency response app for the fictional Whale Call island chain.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 5000)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required env: `DATABASE_URL` — Postgres connection string

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- API: Express 5
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)

## Where things live

- `artifacts/island-boat-rideshare/src/App.tsx` — wouter routes, Clerk shell, booking, fictional island map, fleet, trip, emergency, and profile screens.
- `artifacts/island-boat-rideshare/src/index.css` — Voyage/Response visual tokens and responsive UI styles.
- `artifacts/api-server/src/routes/` — Express route handlers for islands, fleet, trips, and emergencies.
- `artifacts/api-server/src/lib/fleet.ts` — fleet seed and API mapping helpers; database rows are the canonical fleet source.
- `lib/db/src/schema/` — Drizzle tables for islands, drivers, boats, trips, and emergencies.
- `lib/api-spec/openapi.yaml` — source of truth for API contracts and generated hooks.

## Architecture decisions

- Fleet data lives in PostgreSQL and is seeded once on API startup; screens do not own mock fleet arrays.
- Standard rides reserve an available boat immediately, while rescue dispatch selects the nearest available emergency-equipped boat.
- Client auth uses Replit-managed Clerk with browser session cookies; no bearer-token plumbing is used for the web app.
- The app keeps a public landing page and uses a warm Voyage presentation for travel with a high-contrast Response presentation for emergencies.

## Product

Travellers can explore seven fictional island docks, browse a 72-boat live fleet, request a standard crossing with class-based pricing, track and complete a trip, and dispatch/resolve a rescue incident. Clerk sign-in and sign-up are themed to match Whale Call.

## Project Analytics

Whale Call records three privacy-safe custom events through Replit-hosted analytics. Their payloads contain no names, receipt numbers, trip IDs, or exact passenger counts. The rider tracking and receipt screen uses the identifier-free `/trip` route so its pageview and custom-event URLs do not expose a booking identifier.

| Event name | Description | Dimensions |
| --- | --- | --- |
| `booking_created` | A standard crossing was successfully created | `boat_class`, `passenger_count_band` |
| `crossing_completed` | A rider successfully marked the crossing complete | `boat_class`, `passenger_count_band` |
| `receipt_printed` | A rider selected Print receipt on a completed crossing | `boat_class`, `passenger_count_band` |

To enable reporting, go to **Publishing settings**, enable analytics, then publish or republish the app. The tracker is injected only for the published website; analytics calls are optional and safely ignored during development or if the tracker is unavailable.

## User preferences

_Populate as you build — explicit user instructions worth remembering across sessions._

## Gotchas

- Run `pnpm --filter @workspace/api-spec run codegen` after changing `lib/api-spec/openapi.yaml`.
- Use the API server through `/api` and the artifact workflow rather than direct service ports.
- Rescue boats are intentionally excluded from standard class selection and are only returned by emergency dispatch.

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
