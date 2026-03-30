# Polymarket Monitoring Dashboard Design

Date: 2026-03-30
Status: Draft approved in conversation, written for review

## Summary

Build a private research dashboard that monitors live Polymarket markets, filters for high-volume and high-edge opportunities, and ranks wallets by historical and current trading performance. The application should use TanStack Start for the web app and API layer, with a separate worker process for long-running WebSocket ingestion and historical backfill.

The system should prioritize immediate usefulness in v1:

- show live market opportunities quickly
- seed wallet intelligence from official public leaderboard/profile data
- improve wallet and market analytics over time through background backfill

## Goals

- Monitor Polymarket markets in near real time
- Rank markets by a composite edge score
- Maintain robust wallet leaderboards with historical PnL, win rate, position sizing, and specialized tags
- Provide individual wallet dashboards with open positions, closed-position history, and event analytics
- Support both local development and self-hosted deployment from the same codebase
- Use official public Polymarket APIs and WebSocket feeds wherever possible

## Non-Goals

- Trade execution
- User accounts or multi-tenant access control
- Notifications or alerting in v1
- Social or collaboration features
- General-purpose quant research tooling beyond the defined market and wallet workflows

## Product Scope

V1 is a private research console for a single operator. The design assumes one trusted user, no public signup flow, and no requirement to isolate data by tenant.

The product has two core surfaces:

1. A market intelligence surface that detects and ranks attractive markets.
2. A wallet intelligence surface that tracks strong traders and explains their behavior.

Wallet discovery should come from both:

- public leaderboard and profile data exposed by Polymarket
- wallets discovered from holders and trade activity in tracked markets

Historical analytics should use a hybrid model:

- official aggregate endpoints for immediate UI
- an internal ledger and snapshot model built gradually by background backfill

## Recommended Approach

Use a hybrid ingest and analytics architecture:

- TanStack Start for the UI, SSR, server functions, and API routes
- a separate worker process for long-running ingestion and backfill
- Postgres as the primary system of record for normalized entities and derived analytics

This approach is preferred over a thinner direct-to-API dashboard because it creates a stable internal data model, supports historical analytics, reduces API coupling in the UI, and allows the ranking logic to evolve without rewriting the client.

## Architecture

## Monorepo layout

- `apps/web`: TanStack Start app
- `apps/worker`: ingestion and backfill worker
- `packages/db`: schema, migrations, and shared query layer
- `packages/polymarket`: Polymarket REST and WebSocket clients plus normalization
- `packages/analytics`: scoring, wallet tagging, and derived metric logic

## Runtime boundaries

### `apps/web`

Responsibilities:

- file-based routes and server-rendered dashboard pages
- server functions for typed data access
- API routes for query surfaces that are awkward as server functions
- operator settings, watchlists, and score tuning

### `apps/worker`

Responsibilities:

- market discovery polling
- live market WebSocket subscriptions
- historical wallet and market backfill
- derived table refreshes and analytics recomputation

This worker should remain separate from the TanStack Start runtime. TanStack Start officially supports full-stack application concerns such as routing, SSR, server functions, API routes, and Node deployment, but it does not present long-running ingest jobs as a first-class runtime model. The safer design is a dedicated worker process in the same repo.

## Storage

Use Postgres as the main database.

Planned table groups:

- `markets`, `events`, `market_tags`, `tokens`
- `wallets`, `wallet_profiles`, `wallet_watchlists`
- `market_snapshots`, `price_history`, `orderbook_snapshots`
- `wallet_positions_open`, `wallet_positions_closed`, `wallet_activity`, `wallet_trades`
- `market_holders`, `market_open_interest`
- `wallet_daily_stats`, `wallet_event_stats`, `wallet_category_stats`
- `market_scores`, `wallet_scores`, `wallet_tags_derived`
- `ingest_cursors`, `job_runs`, `data_freshness`

Redis is optional and should not be required for v1. Add it later only if WebSocket fan-out or hot caching becomes necessary.

## External Data Sources

Use three official Polymarket surfaces.

## 1. Gamma API

Purpose: market and event discovery plus metadata.

Base URL:

- `https://gamma-api.polymarket.com`

Primary endpoints:

- `GET /markets`
- `GET /events`
- `GET /markets/{id}/tags`
- `GET /public-profile`

Primary uses:

- discover active and recent markets
- sync event and category metadata
- fetch tags for filtering and analytics
- resolve public profile information where available

## 2. Data API

Purpose: wallet, holder, trade, and summary analytics.

Base URL:

- `https://data-api.polymarket.com`

Primary endpoints:

- `GET /v1/leaderboard`
- `GET /positions`
- `GET /closed-positions`
- `GET /activity`
- `GET /trades`
- `GET /holders`
- `GET /v1/market-positions`
- `GET /value`
- `GET /oi`

Primary uses:

- seed strong wallets from public leaderboard data
- populate open and closed wallet positions
- reconstruct wallet activity histories
- discover wallets active in tracked markets
- measure holder concentration and open interest
- provide immediate aggregate values while internal analytics backfill catches up

## 3. CLOB API and WebSocket

Purpose: live market microstructure and historical pricing.

Base URLs:

- `https://clob.polymarket.com`
- `wss://ws-subscriptions-clob.polymarket.com/ws/market`

Primary endpoints and channels:

- `GET /prices-history`
- public read endpoints for book, spread, and best-bid-ask data when required for live liquidity and spread signals
- market WebSocket subscriptions for real-time updates

Primary uses:

- live market monitoring
- recent price displacement and momentum calculations
- spread and liquidity signals
- token-level historical price series

## API Access Model

Based on current official documentation:

- Gamma API is public and does not require authentication
- Data API is public and does not require authentication
- CLOB read endpoints are public and do not require authentication
- CLOB trading endpoints require authenticated headers, but they are not needed for this dashboard

The official docs document rate limits, but no official paid data tier was identified for these public read surfaces. V1 should therefore assume a free public API model with throttling constraints and build around rate-limit-aware ingestion.

## Ingestion Design

## Market discovery loop

The worker should poll Gamma regularly to:

- fetch active and newly created markets
- fetch events and categories
- attach tags
- decide whether a market enters the tracked universe

Tracked universe rules should be configurable. Initial rules should include:

- active markets only
- minimum volume threshold
- optional category/tag filters
- optional event end-date window

## Live ingest loop

The worker should subscribe only to tracked token IDs on the market WebSocket.

Maintain rolling live metrics:

- last trade price
- price velocity
- spread
- best bid and ask
- live volume estimates when available
- freshness timestamps

The live loop should update lightweight snapshot tables used by the dashboard and scoring jobs.

## Historical backfill loop

The worker should backfill in the background:

- leaderboard-seeded wallets first
- watchlisted wallets second
- newly discovered wallets from holders and trade activity third
- top-ranked markets by current score on a recurring loop

Backfill should be resumable and cursor-based. The UI should never wait on complete history before rendering.

## Derived analytics loop

A separate scheduled job inside the worker should recompute:

- market composite scores
- wallet performance windows
- event and category specialization summaries
- derived wallet tags
- freshness and completeness markers

## Scoring Model

Use a tunable composite score:

`edge_score = w1 * market_structure_score + w2 * smart_money_score + w3 * timing_score`

The weights should be operator-configurable in v1.

## `market_structure_score`

Signals:

- recent volume
- liquidity and open interest
- magnitude of recent price displacement
- spread and microstructure behavior
- holder concentration

Purpose:

- identify markets that are active enough to matter
- capture unusual structure even before specific wallets are detected

## `smart_money_score`

Signals:

- number of tracked strong wallets in the market
- weighted conviction based on position size and historical wallet quality
- recent accumulation or rotation by strong wallets
- concentration of high-quality traders among holders or recent trade participants

Purpose:

- measure whether skilled wallets are present
- distinguish raw activity from potentially informed activity

## `timing_score`

Signals:

- signal freshness
- acceleration in activity
- recent change in market score components
- whether participation is increasing now rather than just historically large

Purpose:

- emphasize opportunities that are active now
- reduce stale high-score markets that are no longer moving

## Wallet Analytics

Each wallet should have both immediate metrics and progressively refined metrics.

Immediate metrics:

- public leaderboard rank or score when available
- current value
- open positions
- recent activity

Derived metrics:

- realized PnL
- unrealized PnL
- total PnL
- win rate
- average position size
- average hold time
- concentration by category and event
- early-entry versus late-entry tendencies where reconstructable

The UI should distinguish:

- `provisional` metrics based on partial history or public aggregates
- `backfilled` metrics based on internally reconstructed records

## Wallet Tags

Wallet tagging should combine public identity hints with internal derived labels.

Public hints:

- verified flag
- name or pseudonym
- profile image
- public profile metadata

Derived tags:

- `high-conviction`
- `fast-flipper`
- `event-specialist`
- `election-heavy`
- `late-chaser`
- `top-1pct-pnl`
- `high-winrate-low-size`

Tags should be deterministic and rule-based in v1. A later version can add learned or statistical tagging if needed.

## User Experience

## Primary screens

### Markets

Core behavior:

- sortable leaderboard of tracked markets
- composite score and score breakdown
- live freshness indicator
- filters for volume, liquidity, spread, price move, smart-money participation, category, tag, and freshness window

### Market detail

Core behavior:

- price and history chart
- event and market metadata
- score explanation
- top holders and notable wallets
- recent trade and activity summaries

### Wallet leaderboard

Core behavior:

- sortable list of wallets
- ranking by realized PnL, unrealized PnL, total PnL, win rate, average size, conviction, specialization, and tags
- quick filtering by watchlist status, verification status, specialization, and backfill completeness

### Wallet detail

Core behavior:

- open positions
- closed-position ledger
- event and category analytics
- participation timeline
- historical summary cards
- tags and explanation of why they were assigned

### Watchlists and settings

Core behavior:

- manual wallet watchlist management
- excluded wallet list
- score weight tuning
- tracked universe thresholds
- staleness and backfill preferences

## Data Freshness And Completeness UX

Every major metric should carry:

- `as_of` timestamp
- `fresh`, `stale`, or `degraded` status
- completeness marker such as `provisional` or `backfilled`

The product should explain degraded states instead of hiding them.

## Failure Handling

The system should degrade gracefully under public API constraints.

Rules:

- if WebSocket disconnects, reconnect with exponential backoff and mark live fields stale
- if rate limits throttle polling, serve cached snapshots and continue background retry
- if endpoint data is temporarily inconsistent, avoid destructive rewrites and keep last known good snapshots
- if a wallet is only partially reconstructed, expose partial results explicitly
- if derived jobs fall behind, retain prior score snapshots and mark them stale rather than zeroing them out

Operational visibility should include:

- per-source freshness
- per-job run status
- backlog depth for wallet and market backfill
- last successful WebSocket connection time

## Testing Strategy

## Unit tests

- scoring components
- wallet tag rules
- normalization logic
- threshold and filter behavior

## Integration tests

- Polymarket REST clients with recorded fixtures
- WebSocket message normalization
- database writes for ingest jobs
- derived query correctness

## End-to-end tests

- market leaderboard flow
- market detail flow
- wallet leaderboard flow
- wallet detail flow
- settings and watchlist flow

## Replay tests

Maintain a deterministic event replay harness for live WebSocket sequences so ranking behavior can be tested against known streams.

## Deployment Model

The codebase should support both:

- local development on one machine
- self-hosted deployment using the same services

Expected deployment shape:

- one TanStack Start web service
- one worker service
- one Postgres database

Local development should run both app and worker together against one local Postgres instance.

## V1 Scope Boundary

Include in v1:

- live market ranking
- market detail pages
- wallet leaderboard
- wallet detail pages
- composite scoring with adjustable weights
- manual watchlists
- rule-based wallet tags
- background backfill
- source freshness and completeness indicators

Exclude from v1:

- trade execution
- user accounts or multi-user tenancy
- alerting and notifications
- mobile app
- social features
- machine-learned ranking models

## Open Design Decisions Resolved

- Product type: private research console
- Wallet discovery: combine official leaderboard seeding with market-derived discovery
- Edge definition: composite score blending market structure and smart-money signals
- Historical analytics: hybrid immediate aggregates plus background reconstruction
- Deployment model: one codebase supporting local and self-hosted use
- Framework choice: TanStack Start where appropriate, with a separate worker process for long-running jobs

## Implementation Guardrails

- Keep Polymarket integration isolated in a shared package so endpoint changes are localized
- Keep UI code dependent on internal APIs and database views, not raw external endpoints
- Keep score components individually testable and inspectable
- Avoid adding infrastructure beyond Postgres until a concrete bottleneck appears
- Treat backfill completeness as a first-class product concept, not an internal detail

## Official References Used For This Design

- Polymarket Gamma API docs: `GET /markets`, `GET /events`, market tags, public profile
- Polymarket Data API docs: leaderboard, positions, closed positions, activity, trades, holders, market positions, total value, open interest
- Polymarket CLOB docs: public read access model, price history, market WebSocket
- Polymarket rate limit docs
- TanStack Start docs: SSR, server functions, API routes, Node hosting
