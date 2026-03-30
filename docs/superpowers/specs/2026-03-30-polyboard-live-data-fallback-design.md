# Polyboard Live Data Bootstrap And Fallback Design

## Goal

Make the dashboard use live Polymarket-backed data by default while keeping seeded data as an automatic fallback only when live bootstrap is unavailable.

## Current Problem

- The web app is already DB-first.
- Dashboard, market leaderboard, and wallet leaderboard pages read Postgres tables such as `market_scores`, `wallet_scores`, `market_snapshots`, and related wallet tables.
- The worker currently runs only:
  - one-time Gamma market discovery
  - ongoing websocket snapshot ingest
- The worker does not currently run wallet backfill or market score recomputation from its main entrypoint.
- As a result, the score tables that the UI needs stay seed-backed unless they are manually populated.

## Desired Outcome

- `pnpm dev` should attempt a live bootstrap automatically.
- If Polymarket APIs are reachable, the dashboard should show live-derived data without requiring `pnpm seed:dev`.
- If live bootstrap fails and the required dashboard tables are missing or unusable, the worker should populate fallback seed data automatically.
- When live APIs recover later, live refresh jobs should overwrite fallback-backed rows and restore a live status.

## Architecture

### Source Of Truth

- Keep the web app DB-first.
- Do not add direct Polymarket requests to browser routes or components.
- The worker remains the only process responsible for collecting external market and wallet data and materializing it into dashboard tables.

### Live Bootstrap

Add a coordinated worker bootstrap phase before steady-state streaming begins.

Bootstrap order:

1. Discover live markets from Gamma.
2. Backfill wallet leaderboard, wallet positions, trades, event stats, and market holders from the Polymarket data API.
3. Recompute market scores from current DB signal inputs and settings.
4. Mark freshness sources as live and healthy.
5. Start websocket snapshot ingest.

This ordering ensures the dashboard has the rows required by the DB-backed pages before the UI loads.

### Steady-State Refresh

After bootstrap, the worker runs recurring in-process refresh jobs:

- Market discovery refresh on a shorter interval to track new and retired markets plus tag changes.
- Wallet backfill refresh on a slower interval because it is the heaviest live job.
- Market score recomputation after discovery and backfill, plus on its own periodic interval.
- Websocket snapshot ingest remains always-on for near-real-time market prices.

Job failures should update status and retry on the next interval without crashing the whole worker.

## Fallback Design

### When Fallback Is Allowed

Fallback seeding is allowed only when all of the following are true:

- live bootstrap fails
- required dashboard tables do not already contain usable data
- freshness is missing or outside an explicit staleness threshold

Fallback seeding must not run if usable live-backed data already exists.

For this change, "usable data" means:

- at least one market row with a matching `market_scores` row
- at least one wallet row with a matching `wallet_scores` row
- freshness records present for the live bootstrap sources, even if marked `degraded`

### What Fallback Seeds

Fallback populates the same DB tables the dashboard depends on:

- markets and tags
- market scores
- market snapshots
- wallet profiles
- wallet scores
- wallet positions and trades
- market holders
- settings rows needed for score computation

Fallback is not a separate UI mode. It is simply a lower-confidence DB population path used to keep local development and manual testing functional.

### Recovery From Fallback

- If the worker starts in fallback mode, subsequent successful live discovery, backfill, and score recomputation runs should overwrite fallback-backed rows automatically.
- Freshness should move from `fallback` or `degraded` back to `live`.
- No manual reseed step should be required to recover.

## Freshness And Status Model

Continue using `data_freshness` and expand its meaning for operator visibility.

Tracked source keys:

- `gamma:markets`
- `data:wallets`
- `scores:markets`
- `ws:markets`

Tracked statuses:

- `live`
- `degraded`
- `fallback`

Each source should record:

- status
- completeness
- as-of timestamp

The UI will use these rows to show whether the dashboard is currently live-backed, degraded, or fallback-backed.

## Worker Changes

### Runtime

Extend the worker runtime to include:

- `DataClient` for wallet backfill and holders
- app settings access for score weights
- repositories for wallet upserts, holder replacement, score upserts, and freshness updates

### Entry Point

Replace the current startup sequence with a bootstrap coordinator that:

- attempts live bootstrap
- falls back to seed bootstrap only when the fallback criteria are met
- starts recurring jobs
- starts the websocket loop after bootstrap completes

### Scheduling

Scheduling stays in-process for now.

Expected intervals:

- discovery: short
- market score recompute: short-to-medium
- wallet backfill: medium

Exact durations can remain environment-backed constants and do not need a UI control yet.

## Web App Changes

### Data Access

- Keep current DB-backed services.
- Add a small freshness/status service for the dashboard and leaderboard pages.
- Render status indicators sourced from `data_freshness`.

### UX Expectations

- The dashboard homepage should visibly indicate whether it is showing live, degraded, or fallback data.
- Market and wallet leaderboard pages should use the same status model.
- No browser-side Polymarket API fetches should be introduced.

## Local Development Behavior

Normal local flow becomes:

1. start Postgres
2. start web and worker
3. worker attempts live bootstrap automatically
4. if live bootstrap fails and data is unusable, fallback seed bootstrap runs automatically

`pnpm seed:dev` remains available as a manual utility, but it is no longer part of the normal startup instructions.

## Testing

Add automated coverage for:

- live bootstrap success path
- fallback seed path when live clients fail
- fallback skipped when usable live data already exists
- later live refresh replacing fallback-backed rows
- freshness/status rendering in the web app
- worker recurring job error isolation

Verification should include:

- web tests
- worker tests
- local build
- manual confirmation that dashboard status changes when live APIs are unavailable versus reachable

## Non-Goals

- No browser-direct Polymarket queries.
- No external scheduler or queue system in this change.
- No redesign of score formulas beyond making live recomputation actually run.
