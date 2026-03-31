# Hybrid Architecture Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Eliminate OOM crashes by reducing memory footprint 20× through hybrid DB+Live API architecture

**Architecture:** Store only computed aggregates in PostgreSQL; fetch live data on-demand from Polymarket API for detail views. Reduces wallet backfill from 50→20 and stops storing raw positions/trades.

**Tech Stack:** TypeScript, Drizzle ORM, PostgreSQL, TanStack React Start, Vitest

---

## Prerequisites

- Worktree: `.worktrees/hybrid-architecture`
- Branch: `feat/hybrid-architecture`
- Design doc: `docs/plans/2025-04-01-hybrid-architecture-design.md`

---

## Phase 1: Immediate Relief - Reduce Batch Size

### Task 1: Update Default Backfill Batch Size

**Files:**
- Modify: `packages/db/src/env.ts:61`

**Step 1: Change default from 50 to 20**

```typescript
// Change this line:
POLYBOARD_BACKFILL_BATCH_SIZE: z.coerce.number().int().positive().default(50),
// To:
POLYBOARD_BACKFILL_BATCH_SIZE: z.coerce.number().int().positive().default(20),
```

**Step 2: Update test expectation**

```typescript
// In packages/db/src/env.test.ts:16
backfillBatchSize: 20,  // Change from 50
```

**Step 3: Run tests**

```bash
pnpm --filter @polyboard/db test
```
Expected: 17 passed, 1 failed (pre-existing env test failure)

**Step 4: Commit**

```bash
git add packages/db/src/env.ts packages/db/src/env.test.ts
git commit -m "feat: reduce backfill batch size from 50 to 20 wallets"
```

---

## Phase 2: Schema Migration - Drop Large Tables

### Task 2: Create Database Migration

**Files:**
- Create: `packages/db/src/migrations/0004_drop_raw_data_tables.sql`

**Step 1: Write migration**

```sql
-- Migration: 0004_drop_raw_data_tables
-- Purpose: Remove tables storing large raw data to reduce memory/DB size

-- Drop large raw data tables
DROP TABLE IF EXISTS wallet_positions_open CASCADE;
DROP TABLE IF EXISTS wallet_positions_closed CASCADE;
DROP TABLE IF EXISTS wallet_trades CASCADE;
DROP TABLE IF EXISTS market_holders CASCADE;
DROP TABLE IF EXISTS wallet_event_stats CASCADE;

-- Clean up old snapshot data (keep last 24 hours)
DELETE FROM market_snapshots 
WHERE captured_at < NOW() - INTERVAL '24 hours';

-- Add index for efficient future cleanup
CREATE INDEX IF NOT EXISTS idx_market_snapshots_captured_at 
ON market_snapshots(captured_at);
```

**Step 2: Update schema.ts - Remove table definitions**

```typescript
// In packages/db/src/schema.ts
// DELETE lines 119-155 (walletPositionsOpen, walletPositionsClosed)
// DELETE lines 157-173 (walletTrades)
// DELETE lines 175-189 (marketHolders)
// DELETE lines 191-206 (walletEventStats)
```

**Step 3: Remove exports from index**

```typescript
// In packages/db/src/index.ts
// Remove any exports related to deleted tables
```

**Step 4: Commit**

```bash
git add packages/db/src/migrations/0004_drop_raw_data_tables.sql packages/db/src/schema.ts
git commit -m "feat(db): drop large raw data tables to reduce memory footprint"
```

---

## Phase 3: Refactor Backfill Job

### Task 3: Update Backfill Job to Fetch Summaries Only

**Files:**
- Modify: `apps/worker/src/jobs/backfill.ts`

**Step 1: Simplify BackfillDeps interface**

```typescript
// Remove these from BackfillDeps:
// - replaceOpenPositions
// - replaceClosedPositions
// - replaceTrades
// - replaceWalletEventStats

// Keep only:
export interface BackfillDeps {
  maxWallets?: number
  logger?: {
    warn?: (...args: unknown[]) => void
    info?: (...args: unknown[]) => void
  }
  dataClient: {
    getLeaderboard: (query?: Record<string, unknown>) => Promise<RawRow[]>
    getValue: (user: string) => Promise<RawRow[]>
  }
  walletRepo: {
    upsertWalletProfiles: (rows: Array<{
      address: string
      displayName?: string | null
      pseudonym?: string | null
      verified?: boolean
      profileImage?: string | null
      metadata?: Record<string, unknown>
    }>) => Promise<void>
    upsertWalletScore: (input: {
      walletAddress: string
      realizedPnl: number
      unrealizedPnl: number
      totalPnl: number
      winRate: number
      averagePositionSize: number
      tags: string[]
      completeness: 'provisional' | 'backfilled'
    }) => Promise<void>
  }
  freshnessRepo?: {
    updateFreshness: (sourceKey: string, status: string, completeness?: string) => Promise<void>
  }
  marketRepo?: {
    upsertMarkets?: (rows: unknown[]) => Promise<void>
  }
}
```

**Step 2: Rewrite runBackfillOnce function**

```typescript
export async function runBackfillOnce(deps: BackfillDeps) {
  deps.logger?.info?.('starting wallet backfill')

  const leaderboard = await deps.dataClient.getLeaderboard({ limit: deps.maxWallets ?? 20 })
  deps.logger?.info?.({ leaderboardSize: leaderboard.length }, 'fetched leaderboard')

  const walletProfiles = leaderboard.flatMap((row) => {
    const normalized = normalizeLeaderboardRow(row)
    return normalized === null ? [] : [normalized]
  })

  if (walletProfiles.length === 0) {
    deps.logger?.warn?.('no wallet profiles found in leaderboard')
    return
  }

  // Upsert wallet profiles
  await deps.walletRepo.upsertWalletProfiles(walletProfiles)
  deps.logger?.info?.({ walletCount: walletProfiles.length }, 'upserted wallet profiles')

  // Fetch summary data for each wallet (not full positions/trades)
  let processedCount = 0
  for (const wallet of walletProfiles) {
    try {
      const valueData = await deps.dataClient.getValue(wallet.address)
      const summary = extractWalletSummary(valueData, wallet.address)

      await deps.walletRepo.upsertWalletScore({
        walletAddress: wallet.address,
        realizedPnl: summary.realizedPnl,
        unrealizedPnl: summary.unrealizedPnl,
        totalPnl: summary.totalPnl,
        winRate: summary.winRate,
        averagePositionSize: summary.averagePositionSize,
        tags: deriveWalletTags(summary),
        completeness: 'backfilled',
      })

      processedCount++
      if (processedCount % 5 === 0) {
        deps.logger?.info?.({ processed: processedCount, total: walletProfiles.length }, 'backfill progress')
      }
    } catch (error) {
      deps.logger?.warn?.({ err: error, walletAddress: wallet.address }, 'failed to backfill wallet')
      // Continue with other wallets
    }
  }

  deps.logger?.info?.({ processed: processedCount, total: walletProfiles.length }, 'completed wallet backfill')
  await deps.freshnessRepo?.updateFreshness('data:wallets', 'live')
}
```

**Step 3: Remove helper functions for raw data**

```typescript
// DELETE these functions:
// - fetchPagedRows
// - normalizePositionRow
// - normalizeClosedPositionRow
// - normalizeTradeRow
// - normalizeHoldersRow
// - computeWalletMetrics (keep simpler version)
```

**Step 4: Run tests**

```bash
pnpm --filter @polyboard/worker test
```
Expected: All tests pass (44 tests)

**Step 5: Commit**

```bash
git add apps/worker/src/jobs/backfill.ts
# Also update any test files that reference removed functions
git commit -m "feat(worker): refactor backfill to fetch summaries only, remove raw data storage"
```

---

## Phase 4: Update Runtime and Repositories

### Task 4: Remove Repository Methods for Deleted Tables

**Files:**
- Modify: `apps/worker/src/runtime.ts`

**Step 1: Update walletRepo to remove methods**

```typescript
// In apps/worker/src/runtime.ts
// Remove from walletRepo:
// - replaceClosedPositions
// - replaceOpenPositions
// - replaceTrades
// - replaceWalletEventStats

// Keep only:
walletRepo: {
  upsertWalletProfiles: (rows: Parameters<typeof upsertWalletProfiles>[1]) =>
    upsertWalletProfiles(db, rows),
  upsertWalletScore: (input: Parameters<typeof upsertWalletScore>[1]) =>
    upsertWalletScore(db, input),
}
```

**Step 2: Remove unused imports**

```typescript
// Remove from imports:
// - replaceClosedPositions
// - replaceOpenPositions
// - replaceTrades
// - replaceWalletEventStats
```

**Step 3: Update scheduler.ts to remove unused repo references**

```typescript
// In apps/worker/src/scheduler.ts
// Update RuntimeRefreshScheduler interface to remove unused repo methods
```

**Step 4: Run tests**

```bash
pnpm --filter @polyboard/worker test
```

**Step 5: Commit**

```bash
git add apps/worker/src/runtime.ts apps/worker/src/scheduler.ts
git commit -m "refactor(worker): remove repository methods for deleted tables"
```

---

## Phase 5: Add Live API Endpoints for Web

### Task 5: Create Live Data Server Functions

**Files:**
- Create: `apps/web/src/features/wallets/live-api.ts`
- Modify: `apps/web/src/features/wallets/server.ts`

**Step 1: Create live data fetcher**

```typescript
// apps/web/src/features/wallets/live-api.ts
import { DataClient } from '@polyboard/polymarket'

const dataClient = new DataClient()

// Cache for 5 minutes
const cache = new Map<string, { data: unknown; expiresAt: number }>()

function getCached<T>(key: string): T | undefined {
  const entry = cache.get(key)
  if (entry && entry.expiresAt > Date.now()) {
    return entry.data as T
  }
  cache.delete(key)
  return undefined
}

function setCached<T>(key: string, data: T, ttlMs = 5 * 60 * 1000): void {
  cache.set(key, { data, expiresAt: Date.now() + ttlMs })
}

export async function fetchWalletPositions(walletAddress: string) {
  const cacheKey = `positions:${walletAddress}`
  const cached = getCached(cacheKey)
  if (cached) return cached

  const positions = await dataClient.getPositions({ user: walletAddress, limit: 100 })
  setCached(cacheKey, positions)
  return positions
}

export async function fetchWalletTrades(walletAddress: string) {
  const cacheKey = `trades:${walletAddress}`
  const cached = getCached(cacheKey)
  if (cached) return cached

  const trades = await dataClient.getTrades({ user: walletAddress, limit: 100 })
  setCached(cacheKey, trades)
  return trades
}

export async function fetchWalletSummary(walletAddress: string) {
  const cacheKey = `summary:${walletAddress}`
  const cached = getCached(cacheKey)
  if (cached) return cached

  const summary = await dataClient.getValue(walletAddress)
  setCached(cacheKey, summary)
  return summary
}
```

**Step 2: Update server.ts to use live API**

```typescript
// apps/web/src/features/wallets/server.ts
import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'
import { getWalletScores, listWalletLeaderboard } from './service'
import { fetchWalletPositions, fetchWalletTrades, fetchWalletSummary } from './live-api'

export const getWalletLeaderboard = createServerFn({ method: 'GET' })
  .handler(() => listWalletLeaderboard())

export const getWalletDetail = createServerFn({ method: 'GET' })
  .inputValidator(z.object({ address: z.string() }))
  .handler(async ({ data }) => {
    const [positions, trades, summary, scores] = await Promise.all([
      fetchWalletPositions(data.address),
      fetchWalletTrades(data.address),
      fetchWalletSummary(data.address),
      getWalletScores(data.address),
    ])

    return {
      address: data.address,
      positions: positions.slice(0, 50), // Limit to 50
      recentTrades: trades.slice(0, 20), // Limit to 20
      summary: summary[0] ?? null,
      scores,
    }
  })
```

**Step 3: Run tests**

```bash
pnpm --filter @polyboard/web test 2>&1 || echo "No tests or tests failed"
```

**Step 4: Commit**

```bash
git add apps/web/src/features/wallets/live-api.ts apps/web/src/features/wallets/server.ts
git commit -m "feat(web): add live API endpoints for wallet detail views"
```

---

## Phase 6: Update Web UI Components

### Task 6: Update Wallet Detail Page

**Files:**
- Find and modify: `apps/web/src/routes/wallets/$address.tsx` (or similar)

**Step 1: Update component to use live data**

```typescript
// Update wallet detail route to use getWalletDetail server function
// Show loading states for live data
// Display positions, trades, summary from live API
// Display scores from DB
```

**Step 2: Add error handling for API failures**

```typescript
// Show cached aggregates when live API fails
// Display "Live data unavailable" message
```

**Step 3: Test manually**

```bash
pnpm dev
# Navigate to wallet detail page
# Verify positions load from live API
# Verify trades load from live API
```

**Step 4: Commit**

```bash
git add apps/web/src/routes/wallets/
git commit -m "feat(web): update wallet detail page to use live API data"
```

---

## Phase 7: Cleanup and Documentation

### Task 7: Remove Unused Code

**Files:**
- Search for unused imports and functions

**Step 1: Find unused code**

```bash
grep -r "replaceOpenPositions\|replaceClosedPositions\|replaceTrades" apps/ packages/ || echo "No references found"
```

**Step 2: Remove any remaining references**

**Step 3: Update documentation**

```markdown
// Update README.md with new architecture notes
// Update architecture diagram if exists
```

**Step 4: Run full test suite**

```bash
pnpm test
```

**Step 5: Commit**

```bash
git add -A
git commit -m "chore: cleanup unused code and update documentation"
```

---

## Verification Checklist

- [ ] Worker runs for 24 hours without OOM
- [ ] Database size stabilizes (not growing)
- [ ] Dashboard loads in <200ms
- [ ] Wallet detail loads in <1000ms
- [ ] All tests pass (except pre-existing env test)
- [ ] No TypeScript errors
- [ ] No ESLint errors

## Rollback Plan

If issues arise:

1. **Immediate:** Set `POLYBOARD_BACKFILL_BATCH_SIZE=10` in .env
2. **Short-term:** Revert to previous commit
3. **Full:** Restore database from backup (tables were dropped)

---

**Plan complete! Ready for execution with superpowers:executing-plans skill.**
