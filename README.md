# Whale Call

Whale Call is a Caribbean boat-rideshare app for passenger crossings, island
supplies, and emergency rescue dispatch. It includes island and dock selection,
live fleet tracking, captain and boat details, trip receipts, and completed-trip
history.

## Project structure

- `artifacts/island-boat-rideshare` — React + Vite web application
- `artifacts/api-server` — Express API server
- `lib/api-spec` — OpenAPI contract
- `lib/api-client-react` — generated React API client
- `lib/api-zod` — generated API validation schemas
- `lib/db` — Drizzle database schema and access layer

## Requirements

- Node.js 20+
- pnpm 10+
- PostgreSQL for durable trip and fleet data

## Development

Install dependencies:

```bash
pnpm install
```

Start the API server:

```bash
PORT=8080 pnpm --filter @workspace/api-server run dev
```

Start the web app:

```bash
PORT=24528 BASE_PATH=/ pnpm --filter @workspace/island-boat-rideshare run dev
```

The web app expects the API to be available under `/api`. Configure the
database and authentication environment variables in the environment where
the services run. The browser can optionally use `VITE_MAPBOX_ACCESS_TOKEN`;
Leaflet remains the fallback map renderer.

## Validation

```bash
pnpm typecheck
pnpm build
```

## License

MIT