# Polyboard

Private Polymarket research dashboard built with TanStack Start and a separate ingest worker.

## Local setup

1. `cp .env.example .env`
2. `pnpm install`
3. `pnpm db:up`
4. `pnpm --filter @polyboard/db db:push`
5. `pnpm dev`

If Polymarket is reachable, the worker bootstraps live data automatically.

If Polymarket is unavailable and the dashboard does not already have usable data,
the worker seeds fallback data automatically.

Use `pnpm seed:dev` only when you want to reseed fallback data manually.

Install Playwright only if you want to run browser automation locally:

`pnpm --filter @polyboard/web exec playwright install`

## Services

- `apps/web`: TanStack Start dashboard on `http://127.0.0.1:3000`
- `apps/worker`: background discovery, WebSocket ingest, backfill, analytics
- `postgres`: local database on `localhost:5432`

## Key flows

- live market leaderboard
- market detail with score breakdown, holders, and recent trade flow
- wallet leaderboard and wallet detail
- settings and watchlists

## Health

- web: `GET /api/health`
- worker: `buildWorkerHealth()` in `apps/worker/src/health.ts`
- web health exposes individual freshness rows, including `worker:bootstrap`
