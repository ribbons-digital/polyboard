# Hybrid Architecture Design: Reducing Memory Footprint

**Date:** 2025-04-01  
**Author:** Claude (Sisyphus)  
**Branch:** feat/hybrid-architecture  
**Status:** Approved

## Problem Statement

The current Polyboard architecture stores full historical data for all tracked wallets, causing:
- **Memory exhaustion**: Worker crashes with OOM after processing 457 markets
- **Unbounded growth**: Database grows indefinitely with position/trade history
- **Slow startup**: Bootstrap takes 30+ minutes due to backfilling all data
- **Unnecessary storage**: Most historical data is never queried

## Root Cause Analysis

The backfill job (`apps/worker/src/jobs/backfill.ts`) fetches for each wallet:
- Open positions (up to 500 per page, unlimited pages)
- Closed positions (up to 50 per page, unlimited pages)
- Trades (up to 500 per page, unlimited pages)
- Market holders for each tracked market

With 50 wallets × 457 markets = 22,850 market-wallet combinations, this exhausts 4GB+ memory.

## Proposed Solution: Hybrid Architecture

### Core Principle
**Store only computed aggregates in DB; fetch live data on-demand for detail views.**

```
┌─────────────────────────────────────────────────────────────┐
│                     Data Sources                             │
├──────────────┬──────────────┬───────────────────────────────┤
│  Markets     │   Wallets    │     Live Prices               │
│  (Metadata)  │  (Top 20)    │    (WebSocket)                │
└──────┬───────┴──────┬───────┴──────────┬────────────────────┘
       │              │                  │
       ▼              ▼                  ▼
┌─────────────────────────────────────────────────────────────┐
│                    PostgreSQL (DB)                           │
│  ┌─────────────┐  ┌──────────────┐  ┌─────────────────────┐ │
│  │ markets     │  │ wallet_scores│  │ market_snapshots    │ │
│  │ tokens      │  │ market_scores│  │ (recent only)       │ │
│  │ tags        │  │              │  │                     │ │
│  └─────────────┘  └──────────────┘  └─────────────────────┘ │
└──────────────────────────┬──────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│                  Web Dashboard (TanStack)                    │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  Leaderboards: Query DB (fast, <100ms)               │   │
│  │  Detail Views: Fetch live API + cache                │   │
│  │  Real-time: WebSocket updates                        │   │
│  └──────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

### Key Changes

#### 1. Stop Storing Raw Data

**Remove from database:**
- `walletPositionsOpen` - detailed position data
- `walletPositionsClosed` - historical positions  
- `walletTrades` - individual trade records
- `marketHolders` - detailed holder information
- `walletEventStats` - event-level aggregations

**Keep in database:**
- `markets`, `tokens`, `tags` - lightweight metadata
- `walletScores` - computed aggregates only
- `marketScores` - edge scores and reasons
- `marketSnapshots` - recent price snapshots (with 24h TTL)

#### 2. Reduce Wallet Backfill Scope

| Metric | Before | After |
|--------|--------|-------|
| Wallets processed | 50 | 20 |
| Data per wallet | Full history (~5MB) | Summary only (~50KB) |
| API calls per wallet | 4+ per market | 1 summary call |
| Peak memory | ~4GB (OOM) | ~200MB |

#### 3. Live Data On-Demand

When viewing a wallet detail page:
- Fetch current positions from `/positions` API
- Fetch recent trades from `/trades` API (limit 100)
- Cache for 5 minutes in memory
- Do not persist to database

#### 4. WebSocket for Real-Time

- Market prices via existing WebSocket connection
- Store only recent snapshots (optional, with TTL)
- No historical price data in DB

## Database Schema Changes

### Migration: Drop Large Tables

```sql
-- Migration: 0004_drop_raw_data_tables.sql
-- Drop tables storing large raw data

DROP TABLE IF EXISTS wallet_positions_open CASCADE;
DROP TABLE IF EXISTS wallet_positions_closed CASCADE;
DROP TABLE IF EXISTS wallet_trades CASCADE;
DROP TABLE IF EXISTS market_holders CASCADE;
DROP TABLE IF EXISTS wallet_event_stats CASCADE;

-- Clean up large snapshot data older than 24 hours
DELETE FROM market_snapshots 
WHERE captured_at < NOW() - INTERVAL '24 hours';

-- Add index for efficient cleanup
CREATE INDEX idx_market_snapshots_captured_at 
ON market_snapshots(captured_at);
```

### Remaining Tables

```typescript
// Lightweight metadata - KEEP
markets: id, conditionId, question, slug, volume, liquidity, ...
tokens: id, marketId, outcome, outcomeIndex
tags: marketId, tagSlug, label

// Aggregated scores - KEEP  
walletScores: walletAddress, realizedPnl, unrealizedPnl, 
              totalPnl, winRate, tags, calculatedAt
marketScores: marketId, edgeScore, marketStructureScore,
              smartMoneyScore, timingScore, reasons, calculatedAt

// Recent snapshots only - KEEP with cleanup
marketSnapshots: id, marketId, tokenId, lastPrice, 
                 spreadBps, capturedAt (TTL 24h)

// Freshness tracking - KEEP
dataFreshness: sourceKey, status, asOf, completeness
jobRuns: id, jobName, status, startedAt, finishedAt, details
```

## Worker Job Changes

### Discovery Job (Unchanged)

Still fetches market metadata and tags every 5 minutes.

### Backfill Job (Refactored)

**Before:**
```typescript
// Fetched ALL positions, closed positions, trades for each wallet
for (const wallet of walletProfiles.slice(0, 50)) {
  const [openRows, closedRows, tradeRows, valueRows] = await Promise.all([
    fetchPagedRows(getPositions, { limit: 500, user: wallet.address }),
    fetchPagedRows(getClosedPositions, { limit: 50, user: wallet.address }),
    fetchPagedRows(getTrades, { limit: 500, user: wallet.address }),
    getValue(wallet.address),
  ])
  // Store all raw data to DB
}
```

**After:**
```typescript
// Fetch only summary data for top 20 wallets
const leaderboard = await dataClient.getLeaderboard({ limit: 20 })

for (const wallet of leaderboard) {
  // Single API call for summary
  const summary = await dataClient.getPortfolioSummary(wallet.address)
  
  // Store only computed scores
  await walletRepo.upsertWalletScore({
    walletAddress: wallet.address,
    realizedPnl: summary.realizedPnl,
    totalPnl: summary.totalPnl,
    winRate: summary.winRate,
    // ... aggregates only
  })
}
```

### Analytics Job (Simplified)

**Before:** Computed scores from stored position data.

**After:** Uses API-provided metrics directly or simplified calculations.

## Web Layer Changes

### Leaderboard Pages (Fast - From DB)

```typescript
// apps/web/src/features/wallets/service.ts
export async function listWalletLeaderboard() {
  // Fast query from aggregated scores table
  return db
    .select()
    .from(walletScores)
    .orderBy(desc(walletScores.totalPnl))
    .limit(20)
}
```

### Detail Pages (Live - From API)

```typescript
// apps/web/src/features/wallets/server.ts
export const getWalletDetail = createServerFn({ method: 'GET' })
  .inputValidator(z.object({ address: z.string() }))
  .handler(async ({ data }) => {
    // Fetch live data from API
    const [positions, trades, summary] = await Promise.all([
      dataClient.getPositions({ user: data.address, limit: 100 }),
      dataClient.getTrades({ user: data.address, limit: 100 }),
      dataClient.getValue(data.address),
    ])
    
    return {
      positions,
      recentTrades: trades,
      summary,
      // Aggregated scores from DB
      scores: await getWalletScores(data.address),
    }
  })
```

## Performance Impact

### Memory Usage

| Scenario | Before | After |
|----------|--------|-------|
| Peak heap | 4GB+ (OOM) | ~200MB |
| Wallets processed | 50 | 20 |
| Data per wallet | ~5MB | ~50KB |
| Safe to run | ❌ No | ✅ Yes |

### Response Times

| Operation | Before | After |
|-----------|--------|-------|
| Dashboard load | 100ms (cached) | 100ms (cached) |
| Market list | 100ms (cached) | 100ms (cached) |
| Wallet detail | 100ms (cached) | 500ms (live API) |
| Leaderboard | 50ms | 50ms |

### Data Freshness

| Data Type | Before | After |
|-----------|--------|-------|
| Market metadata | 5 min | 5 min |
| Wallet scores | 15 min | 15 min |
| Live prices | Real-time | Real-time |
| Wallet positions | 15 min (stale) | Live (on-demand) |

## Trade-offs

### Advantages

1. **Eliminates OOM crashes** - 20× memory reduction
2. **Bounded database growth** - No unbounded tables
3. **Simpler architecture** - Fewer tables, less code
4. **Live position data** - Always current, not stale
5. **Faster bootstrap** - 3× faster startup

### Disadvantages

1. **Slower detail pages** - 500ms vs 100ms for wallet details
2. **API dependency** - Detail views require live API
3. **Rate limit exposure** - More API calls on detail views
4. **No historical analysis** - Can't query old positions

### Mitigations

1. **Caching** - 5-minute cache for detail views
2. **Rate limiting** - Built-in rate limiter with retry
3. **Offline mode** - Show cached aggregates when API fails

## Implementation Phases

### Phase 1: Immediate Relief (Day 1)
- Reduce `POLYBOARD_BACKFILL_BATCH_SIZE` from 50 → 20
- Stop OOM crashes immediately
- **Risk:** None

### Phase 2: Schema Migration (Day 1-2)
- Create migration to drop large tables
- Add cleanup job for market_snapshots
- **Risk:** Data loss (intentional)

### Phase 3: Refactor Backfill (Day 2-3)
- Update backfill job to fetch summaries only
- Remove position/trade storage
- Update wallet queries
- **Risk:** Medium - core logic change

### Phase 4: Live API Integration (Day 3-4)
- Add server functions for live wallet data
- Update wallet detail page
- Implement caching layer
- **Risk:** Medium - new API integration

### Phase 5: Cleanup (Day 5)
- Remove unused code
- Update tests
- Documentation
- **Risk:** Low

## Success Criteria

- [ ] Worker runs continuously without OOM for 24 hours
- [ ] Dashboard loads in <200ms
- [ ] Wallet detail loads in <1000ms
- [ ] Database size stabilizes (not growing unbounded)
- [ ] All existing tests pass
- [ ] No 5xx errors in production

## References

- Polymarket API Best Practices (Context7)
- Current backfill implementation: `apps/worker/src/jobs/backfill.ts`
- Database schema: `packages/db/src/schema.ts`
