# Polyboard Live Data Fallback Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the dashboard load live Polymarket-derived data by default, with automatic seed fallback only when worker bootstrap cannot reach the live APIs and no usable dashboard data exists.

**Architecture:** Keep the web app DB-first and move the missing live behavior into the worker. The worker will gain a bootstrap coordinator that runs live discovery, wallet backfill, market score recomputation, and then starts recurring refresh loops plus websocket ingest; when bootstrap fails and the DB is unusable, it will seed fallback rows automatically and mark freshness accordingly. The web app will keep reading Postgres and add freshness-driven status UI instead of calling Polymarket directly.

**Tech Stack:** TanStack Start, TypeScript, Vitest, Drizzle ORM, Postgres, existing `@polyboard/polymarket` Gamma/Data/WebSocket clients

---

## File Structure

**Create:**

- `apps/worker/src/bootstrap.ts` — bootstrap coordinator, fallback decision helper, live bootstrap runner
- `apps/worker/src/bootstrap.test.ts` — bootstrap success/fallback/recovery unit tests
- `apps/worker/src/scheduler.ts` — recurring discovery/backfill/recompute job loops
- `apps/worker/src/scheduler.test.ts` — scheduler isolation and retry tests
- `apps/web/src/features/freshness/service.ts` — aggregate freshness rows into a UI-ready dashboard status model
- `apps/web/src/features/freshness/server.ts` — TanStack server functions for freshness status
- `apps/web/src/components/status/data-status.tsx` — shared live/degraded/fallback badge/banner
- `apps/web/src/components/status/data-status.test.tsx` — component rendering coverage

**Modify:**

- `apps/worker/src/index.ts` — replace one-shot startup with bootstrap + scheduler + socket startup ordering
- `apps/worker/src/runtime.ts` — wire `DataClient`, settings access, score repos, fallback seed function
- `apps/worker/src/config.ts` — parse `POLYBOARD_DATA_URL` and any refresh interval env vars
- `apps/worker/src/jobs/analytics.ts` — keep current scoring logic but exercise it through runtime repos
- `packages/db/src/queries/freshness.ts` — add freshness readers and usable-data checks
- `packages/db/src/queries/markets.ts` — add `listSignalInputs` and `upsertMarketScore`
- `packages/db/src/queries/wallets.ts` — reuse existing wallet score writers and, if needed, add count helpers for usability checks
- `packages/db/src/index.ts` — export any new query helpers
- `scripts/seed-dev.ts` — extract reusable `seedDevelopmentData()` function so the worker can call it directly
- `apps/web/src/routes/index.tsx` — load freshness alongside dashboard rows
- `apps/web/src/routes/markets/index.tsx` — load freshness alongside leaderboard rows
- `apps/web/src/routes/wallets/index.tsx` — load freshness alongside leaderboard rows
- `apps/web/src/features/home/home-page.tsx` — render status banner on the dashboard
- `apps/web/src/styles.css` — badge/banner styling for data status
- `README.md` — remove seed from the normal startup path and explain automatic fallback

**Existing tests to update or keep green:**

- `apps/worker/src/jobs/backfill.test.ts`
- `apps/worker/src/jobs/discovery.test.ts`
- `apps/web/src/features/home/home-page.test.tsx`
- `apps/web/src/features/markets/service.test.ts`

---

### Task 1: Extract Bootstrap Decision Logic And Reusable Seed Fallback

**Files:**
- Create: `apps/worker/src/bootstrap.ts`
- Create: `apps/worker/src/bootstrap.test.ts`
- Modify: `scripts/seed-dev.ts`
- Test: `apps/worker/src/bootstrap.test.ts`

- [ ] **Step 1: Write the failing bootstrap decision tests**

```ts
import { describe, expect, it, vi } from 'vitest'
import {
  bootstrapWorkerData,
  shouldRunFallbackSeed,
} from './bootstrap'

describe('shouldRunFallbackSeed', () => {
  it('returns true when bootstrap failed and the dashboard tables are unusable', () => {
    expect(
      shouldRunFallbackSeed({
        bootstrapFailed: true,
        hasFreshnessRows: false,
        hasMarketScores: false,
        hasWalletScores: false,
      }),
    ).toBe(true)
  })

  it('returns false when usable dashboard data already exists', () => {
    expect(
      shouldRunFallbackSeed({
        bootstrapFailed: true,
        hasFreshnessRows: true,
        hasMarketScores: true,
        hasWalletScores: true,
      }),
    ).toBe(false)
  })
})

describe('bootstrapWorkerData', () => {
  it('runs the fallback seed when live bootstrap fails and data is unusable', async () => {
    const seedFallback = vi.fn(async () => undefined)

    await bootstrapWorkerData({
      checkUsableData: async () => ({
        hasFreshnessRows: false,
        hasMarketScores: false,
        hasWalletScores: false,
      }),
      markFreshness: vi.fn(async () => undefined),
      runFallbackSeed: seedFallback,
      runLiveBootstrap: vi.fn(async () => {
        throw new Error('gamma unavailable')
      }),
    })

    expect(seedFallback).toHaveBeenCalledTimes(1)
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm --filter @polyboard/worker test -- --run src/bootstrap.test.ts`

Expected: FAIL with missing exports for `shouldRunFallbackSeed` and `bootstrapWorkerData`

- [ ] **Step 3: Extract a reusable seed function and implement minimal bootstrap helpers**

```ts
// scripts/seed-dev.ts
export async function seedDevelopmentData() {
  const db = createDb()
  // existing seed body stays here
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  seedDevelopmentData().catch((error) => {
    console.error(error)
    process.exit(1)
  })
}
```

```ts
// apps/worker/src/bootstrap.ts
export function shouldRunFallbackSeed(input: {
  bootstrapFailed: boolean
  hasFreshnessRows: boolean
  hasMarketScores: boolean
  hasWalletScores: boolean
}) {
  return (
    input.bootstrapFailed &&
    (!input.hasFreshnessRows || !input.hasMarketScores || !input.hasWalletScores)
  )
}

export async function bootstrapWorkerData(deps: {
  runLiveBootstrap: () => Promise<void>
  checkUsableData: () => Promise<{
    hasFreshnessRows: boolean
    hasMarketScores: boolean
    hasWalletScores: boolean
  }>
  runFallbackSeed: () => Promise<void>
  markFreshness: (status: 'live' | 'fallback' | 'degraded') => Promise<void>
}) {
  try {
    await deps.runLiveBootstrap()
    await deps.markFreshness('live')
    return 'live'
  } catch {
    const state = await deps.checkUsableData()

    if (shouldRunFallbackSeed({ bootstrapFailed: true, ...state })) {
      await deps.runFallbackSeed()
      await deps.markFreshness('fallback')
      return 'fallback'
    }

    await deps.markFreshness('degraded')
    return 'degraded'
  }
}
```

- [ ] **Step 4: Run the targeted test to verify it passes**

Run: `pnpm --filter @polyboard/worker test -- --run src/bootstrap.test.ts`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/worker/src/bootstrap.ts apps/worker/src/bootstrap.test.ts scripts/seed-dev.ts
git commit -m "feat: add worker bootstrap fallback coordinator"
```

### Task 2: Extend DB Queries And Worker Runtime For Live Bootstrap

**Files:**
- Modify: `packages/db/src/queries/freshness.ts`
- Modify: `packages/db/src/queries/markets.ts`
- Modify: `packages/db/src/queries/wallets.ts`
- Modify: `packages/db/src/index.ts`
- Modify: `apps/worker/src/runtime.ts`
- Modify: `apps/worker/src/config.ts`
- Test: `apps/worker/src/bootstrap.test.ts`

- [ ] **Step 1: Write failing runtime/bootstrap repo tests**

```ts
it('uses runtime helpers to decide whether dashboard data is usable', async () => {
  const runtime = createRuntime({
    DATABASE_URL: 'postgres://polyboard:polyboard@localhost:5432/polyboard',
    POLYBOARD_DATA_URL: 'https://data-api.polymarket.com',
  })

  expect(runtime.dataClient).toBeDefined()
  expect(runtime.repos.marketRepo.listSignalInputs).toBeTypeOf('function')
  expect(runtime.repos.marketRepo.upsertScore).toBeTypeOf('function')
  expect(runtime.repos.freshnessRepo.getDashboardUsability).toBeTypeOf('function')
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm --filter @polyboard/worker test -- --run src/bootstrap.test.ts`

Expected: FAIL because `dataClient`, `listSignalInputs`, `upsertScore`, and `getDashboardUsability` do not exist on the runtime

- [ ] **Step 3: Add DB and runtime helpers**

```ts
// packages/db/src/queries/freshness.ts
export async function getDashboardUsability(db: DbClient) {
  const freshness = await db.select().from(dataFreshness)
  const [marketScore] = await db.select({ marketId: marketScores.marketId }).from(marketScores).limit(1)
  const [walletScore] = await db.select({ walletAddress: walletScores.walletAddress }).from(walletScores).limit(1)

  return {
    hasFreshnessRows: freshness.length > 0,
    hasMarketScores: marketScore !== undefined,
    hasWalletScores: walletScore !== undefined,
  }
}
```

```ts
// packages/db/src/queries/markets.ts
export async function listSignalInputs(db: DbClient) {
  return db
    .select({
      marketId: markets.id,
      marketStructureScore: sql<number>`coalesce(avg(${marketSnapshots.lastPrice})::float, 0.5)`,
      smartMoneyScore: sql<number>`coalesce(sum(${marketHolders.currentValue})::float / nullif(${markets.volume}::float, 0), 0)`,
      timingScore: sql<number>`coalesce(avg(${marketSnapshots.spreadBps})::float, 0)`,
    })
    .from(markets)
    .leftJoin(marketSnapshots, eq(marketSnapshots.marketId, markets.id))
    .leftJoin(marketHolders, eq(marketHolders.marketId, markets.id))
    .groupBy(markets.id, markets.volume)
}

export async function upsertMarketScore(db: DbClient, input: {
  marketId: string
  marketStructureScore: number
  smartMoneyScore: number
  timingScore: number
  edgeScore: number
  reasons: Array<{ label: string; value: number }>
}) {
  await db.insert(marketScores).values({
    ...input,
    marketStructureScore: String(input.marketStructureScore),
    smartMoneyScore: String(input.smartMoneyScore),
    timingScore: String(input.timingScore),
    edgeScore: String(input.edgeScore),
    calculatedAt: new Date(),
  }).onConflictDoUpdate({
    target: marketScores.marketId,
    set: {
      marketStructureScore: String(input.marketStructureScore),
      smartMoneyScore: String(input.smartMoneyScore),
      timingScore: String(input.timingScore),
      edgeScore: String(input.edgeScore),
      reasons: input.reasons,
      calculatedAt: new Date(),
    },
  })
}
```

```ts
// apps/worker/src/runtime.ts
const dataClient = new DataClient(parsedEnv.dataUrl)

repos: {
  freshnessRepo: {
    getDashboardUsability: () => getDashboardUsability(db),
    updateFreshness: (sourceKey, status, completeness) =>
      updateFreshness(db, sourceKey, status, completeness),
  },
  marketRepo: {
    listSignalInputs: () => listSignalInputs(db),
    upsertScore: (input) => upsertMarketScore(db, input),
  },
  walletRepo: {
    upsertWalletProfiles: (rows) => upsertWalletProfiles(db, rows),
    upsertWalletScore: (input) => upsertWalletScore(db, input),
    replaceOpenPositions: (address, rows) => replaceOpenPositions(db, address, rows),
    replaceClosedPositions: (address, rows) => replaceClosedPositions(db, address, rows),
    replaceTrades: (address, rows) => replaceTrades(db, address, rows),
    replaceWalletEventStats: (address, rows) => replaceWalletEventStats(db, address, rows),
  },
}
```

- [ ] **Step 4: Run the targeted test to verify it passes**

Run: `pnpm --filter @polyboard/worker test -- --run src/bootstrap.test.ts`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add packages/db/src/queries/freshness.ts packages/db/src/queries/markets.ts packages/db/src/queries/wallets.ts packages/db/src/index.ts apps/worker/src/runtime.ts apps/worker/src/config.ts
git commit -m "feat: wire runtime repos for live bootstrap"
```

### Task 3: Run Live Discovery, Backfill, Recompute, And Recurring Refresh Loops

**Files:**
- Create: `apps/worker/src/scheduler.ts`
- Create: `apps/worker/src/scheduler.test.ts`
- Modify: `apps/worker/src/index.ts`
- Modify: `apps/worker/src/jobs/analytics.ts`
- Test: `apps/worker/src/scheduler.test.ts`
- Test: `apps/worker/src/bootstrap.test.ts`

- [ ] **Step 1: Write failing scheduler and bootstrap orchestration tests**

```ts
import { describe, expect, it, vi } from 'vitest'
import { startRefreshScheduler } from './scheduler'

describe('startRefreshScheduler', () => {
  it('keeps retrying failed jobs without stopping sibling jobs', async () => {
    vi.useFakeTimers()
    const discovery = vi.fn(async () => undefined)
    const backfill = vi
      .fn()
      .mockRejectedValueOnce(new Error('data api down'))
      .mockResolvedValue(undefined)
    const recompute = vi.fn(async () => undefined)

    const scheduler = startRefreshScheduler({
      runDiscovery: discovery,
      runWalletBackfill: backfill,
      runScoreRefresh: recompute,
      discoveryIntervalMs: 1_000,
      walletIntervalMs: 2_000,
      scoreIntervalMs: 1_500,
      logger: { error: vi.fn(), info: vi.fn(), warn: vi.fn() },
    })

    await vi.advanceTimersByTimeAsync(2_500)

    expect(discovery).toHaveBeenCalled()
    expect(backfill).toHaveBeenCalledTimes(2)
    expect(recompute).toHaveBeenCalled()

    scheduler.stop()
  })
})
```

```ts
it('runs live bootstrap before starting the websocket loop', async () => {
  const startSocket = vi.fn(async () => undefined)
  const runLiveBootstrap = vi.fn(async () => undefined)

  await startWorker({
    createSocketLoop: () => ({ start: startSocket, stop: vi.fn() }),
    runLiveBootstrap,
  })

  expect(runLiveBootstrap).toHaveBeenCalledBefore(startSocket)
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm --filter @polyboard/worker test -- --run src/scheduler.test.ts src/bootstrap.test.ts`

Expected: FAIL because `startRefreshScheduler` and the new startup ordering are not implemented

- [ ] **Step 3: Implement bootstrap orchestration and recurring refresh**

```ts
// apps/worker/src/scheduler.ts
export function startRefreshScheduler(deps: {
  runDiscovery: () => Promise<void>
  runWalletBackfill: () => Promise<void>
  runScoreRefresh: () => Promise<void>
  discoveryIntervalMs: number
  walletIntervalMs: number
  scoreIntervalMs: number
  logger: { error: (...args: unknown[]) => void }
}) {
  const timers = [
    setInterval(() => void deps.runDiscovery().catch((error) => deps.logger.error({ err: error }, 'discovery refresh failed')), deps.discoveryIntervalMs),
    setInterval(() => void deps.runWalletBackfill().catch((error) => deps.logger.error({ err: error }, 'wallet backfill failed')), deps.walletIntervalMs),
    setInterval(() => void deps.runScoreRefresh().catch((error) => deps.logger.error({ err: error }, 'score refresh failed')), deps.scoreIntervalMs),
  ]

  return {
    stop: () => timers.forEach((timer) => clearInterval(timer)),
  }
}
```

```ts
// apps/worker/src/index.ts
async function main() {
  const runtime = createRuntime()

  const runLiveBootstrap = async () => {
    await runDiscoveryOnce({
      minVolume: runtime.env.minMarketVolume,
      gammaClient: runtime.gammaClient,
      marketRepo: runtime.repos.marketRepo,
      freshnessRepo: runtime.repos.freshnessRepo,
    })

    await runBackfillOnce({
      dataClient: runtime.dataClient,
      marketRepo: runtime.repos.marketRepo,
      walletRepo: runtime.repos.walletRepo,
    })

    await recomputeMarketScores({
      marketRepo: runtime.repos.marketRepo,
      settings: await runtime.settingsRepo.getSettings(),
    })
  }

  await bootstrapWorkerData({
    checkUsableData: runtime.repos.freshnessRepo.getDashboardUsability,
    markFreshness: (status) => runtime.repos.freshnessRepo.updateFreshness('worker:bootstrap', status, status === 'live' ? 'live' : 'fallback'),
    runFallbackSeed: runtime.seedFallback,
    runLiveBootstrap,
  })

  startRefreshScheduler({
    discoveryIntervalMs: runtime.env.discoveryIntervalMs,
    logger: runtime.logger,
    runDiscovery: runLiveBootstrap,
    runScoreRefresh: async () =>
      recomputeMarketScores({
        marketRepo: runtime.repos.marketRepo,
        settings: await runtime.settingsRepo.getSettings(),
      }),
    runWalletBackfill: async () =>
      runBackfillOnce({
        dataClient: runtime.dataClient,
        marketRepo: runtime.repos.marketRepo,
        walletRepo: runtime.repos.walletRepo,
      }),
    scoreIntervalMs: runtime.env.scoreRefreshIntervalMs,
    walletIntervalMs: runtime.env.walletRefreshIntervalMs,
  })

  await createMarketSocketLoop({
    logger: runtime.logger,
    marketRepo: runtime.repos.marketRepo,
    marketSocket: runtime.marketSocket,
  }).start()
}
```

- [ ] **Step 4: Run the worker tests to verify they pass**

Run: `pnpm --filter @polyboard/worker test -- --run src/bootstrap.test.ts src/scheduler.test.ts src/jobs/backfill.test.ts src/jobs/discovery.test.ts`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/worker/src/index.ts apps/worker/src/scheduler.ts apps/worker/src/scheduler.test.ts apps/worker/src/jobs/analytics.ts apps/worker/src/bootstrap.ts apps/worker/src/bootstrap.test.ts
git commit -m "feat: run live bootstrap and recurring refresh jobs"
```

### Task 4: Add Freshness Aggregation For The Web App

**Files:**
- Create: `apps/web/src/features/freshness/service.ts`
- Create: `apps/web/src/features/freshness/server.ts`
- Create: `apps/web/src/components/status/data-status.tsx`
- Create: `apps/web/src/components/status/data-status.test.tsx`
- Modify: `apps/web/src/features/home/home-page.test.tsx`
- Test: `apps/web/src/components/status/data-status.test.tsx`

- [ ] **Step 1: Write the failing freshness UI tests**

```tsx
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { DataStatus } from './data-status'

describe('DataStatus', () => {
  it('renders fallback copy when the worker seeded local data', () => {
    render(
      <DataStatus
        summary={{
          label: 'fallback',
          message: 'Using fallback seed data because live bootstrap failed.',
        }}
      />,
    )

    expect(screen.getByText(/using fallback seed data/i)).toBeInTheDocument()
  })
})
```

```ts
import { describe, expect, it } from 'vitest'
import { summarizeFreshness } from './service'

describe('summarizeFreshness', () => {
  it('marks the dashboard live only when all core sources are live', () => {
    expect(
      summarizeFreshness([
        { sourceKey: 'gamma:markets', status: 'live' },
        { sourceKey: 'data:wallets', status: 'live' },
        { sourceKey: 'scores:markets', status: 'live' },
      ] as never),
    ).toMatchObject({ label: 'live' })
  })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm --filter @polyboard/web test -- --run src/components/status/data-status.test.tsx`

Expected: FAIL because the status component and freshness service do not exist

- [ ] **Step 3: Implement the aggregation service and status component**

```ts
// apps/web/src/features/freshness/service.ts
export function summarizeFreshness(rows: Array<{ sourceKey: string; status: string; asOf?: Date | string | null }>) {
  const statusBySource = new Map(rows.map((row) => [row.sourceKey, row.status]))
  const statuses = [
    statusBySource.get('gamma:markets'),
    statusBySource.get('data:wallets'),
    statusBySource.get('scores:markets'),
  ]

  if (statuses.every((status) => status === 'live')) {
    return { label: 'live', message: 'Live Polymarket data is flowing through the worker.' } as const
  }

  if (statuses.some((status) => status === 'fallback')) {
    return { label: 'fallback', message: 'Using fallback seed data because live bootstrap failed.' } as const
  }

  return { label: 'degraded', message: 'Some live sources are stale or unavailable.' } as const
}
```

```tsx
// apps/web/src/components/status/data-status.tsx
export function DataStatus({ summary }: {
  summary: { label: 'live' | 'degraded' | 'fallback'; message: string }
}) {
  return (
    <div className={`data-status data-status--${summary.label}`}>
      <span className="data-status__label">{summary.label}</span>
      <p>{summary.message}</p>
    </div>
  )
}
```

- [ ] **Step 4: Run the targeted web tests to verify they pass**

Run: `pnpm --filter @polyboard/web test -- --run src/components/status/data-status.test.tsx`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/features/freshness/service.ts apps/web/src/features/freshness/server.ts apps/web/src/components/status/data-status.tsx apps/web/src/components/status/data-status.test.tsx
git commit -m "feat: add dashboard freshness status model"
```

### Task 5: Surface Live/Fallback Status On Dashboard And Leaderboards

**Files:**
- Modify: `apps/web/src/routes/index.tsx`
- Modify: `apps/web/src/routes/markets/index.tsx`
- Modify: `apps/web/src/routes/wallets/index.tsx`
- Modify: `apps/web/src/features/home/home-page.tsx`
- Modify: `apps/web/src/features/home/home-page.test.tsx`
- Modify: `apps/web/src/styles.css`
- Test: `apps/web/src/features/home/home-page.test.tsx`

- [ ] **Step 1: Write the failing route/homepage status tests**

```tsx
it('shows the fallback banner on the dashboard when freshness is fallback', () => {
  render(
    <HomePage
      markets={[]}
      wallets={[]}
      status={{
        label: 'fallback',
        message: 'Using fallback seed data because live bootstrap failed.',
      }}
    />,
  )

  expect(screen.getByText(/using fallback seed data/i)).toBeInTheDocument()
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm --filter @polyboard/web test -- --run src/features/home/home-page.test.tsx`

Expected: FAIL because `HomePage` does not yet accept a `status` prop

- [ ] **Step 3: Load and render freshness status**

```ts
// apps/web/src/routes/index.tsx
const [markets, wallets, freshness] = await Promise.all([
  getMarketLeaderboard({ data: { minEdge: 0.2 } }),
  getWalletLeaderboard(),
  getDashboardFreshness(),
])

return {
  markets: markets.map((row) => ({ ...row, freshness: 'fresh' as const })),
  wallets,
  status: freshness,
}
```

```tsx
// apps/web/src/features/home/home-page.tsx
export function HomePage({ markets = [], wallets = [], status }: HomePageProps) {
  return (
    <section className="stack">
      {status ? <DataStatus summary={status} /> : null}
      {/* existing dashboard content */}
    </section>
  )
}
```

```css
/* apps/web/src/styles.css */
.data-status {
  display: grid;
  gap: 8px;
  padding: 16px 18px;
  border-radius: 16px;
  border: 1px solid var(--border);
}

.data-status--live {
  background: rgba(100, 215, 180, 0.12);
}

.data-status--degraded {
  background: rgba(255, 197, 92, 0.12);
}

.data-status--fallback {
  background: rgba(255, 125, 93, 0.12);
}
```

- [ ] **Step 4: Run the web tests and build to verify the UI**

Run: `pnpm --filter @polyboard/web test -- --run src/features/home/home-page.test.tsx`

Expected: PASS

Run: `pnpm --filter @polyboard/web build`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/routes/index.tsx apps/web/src/routes/markets/index.tsx apps/web/src/routes/wallets/index.tsx apps/web/src/features/home/home-page.tsx apps/web/src/features/home/home-page.test.tsx apps/web/src/styles.css
git commit -m "feat: surface live and fallback dashboard status"
```

### Task 6: Update Local Workflow Docs And Run End-To-End Verification

**Files:**
- Modify: `README.md`
- Modify: `apps/web/src/routes/api/health.tsx`
- Test: `apps/worker/src/bootstrap.test.ts`
- Test: `apps/worker/src/scheduler.test.ts`
- Test: `apps/web/src/components/status/data-status.test.tsx`
- Test: `apps/web/src/features/home/home-page.test.tsx`

- [ ] **Step 1: Write the failing documentation/health assertions**

```ts
it('returns freshness rows that include fallback or live worker bootstrap state', async () => {
  const response = await GET()
  const payload = await response.json()

  expect(payload.sources.some((row: { sourceKey: string }) => row.sourceKey === 'worker:bootstrap')).toBe(true)
})
```

- [ ] **Step 2: Run the health test to verify it fails**

Run: `pnpm --filter @polyboard/web test -- --run src/components/status/data-status.test.tsx`

Expected: FAIL if the health route or tests do not include the worker bootstrap source yet

- [ ] **Step 3: Update docs and final health surface**

```md
## Local setup

1. `cp .env.example .env`
2. `pnpm install`
3. `pnpm db:up`
4. `pnpm --filter @polyboard/db db:push`
5. `pnpm dev`

If Polymarket is reachable, the worker bootstraps live data automatically.
If Polymarket is unavailable and dashboard tables are unusable, the worker seeds fallback data automatically.
Use `pnpm seed:dev` only for manual reseeding.
```

```ts
// apps/web/src/routes/api/health.tsx
return Response.json({
  checkedAt: new Date().toISOString(),
  ok: freshness.every((row) => row.status !== 'degraded'),
  sources: freshness,
})
```

- [ ] **Step 4: Run the complete verification suite**

Run: `pnpm --filter @polyboard/worker test`

Expected: PASS

Run: `pnpm --filter @polyboard/web test`

Expected: PASS

Run: `pnpm --filter @polyboard/web build`

Expected: PASS

Run: `pnpm --filter @polyboard/worker build`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add README.md apps/web/src/routes/api/health.tsx
git commit -m "docs: document live bootstrap and fallback flow"
```

---

## Self-Review

### Spec Coverage

- Live bootstrap coordinator: Tasks 1, 2, 3
- Automatic fallback seeding only when bootstrap fails and data is unusable: Tasks 1, 2, 3
- Recurring discovery/backfill/recompute refresh: Task 3
- DB-first web app with freshness UI: Tasks 4, 5
- Local setup and verification updates: Task 6

### Placeholder Scan

- No `TODO`, `TBD`, or “similar to above” placeholders remain.
- Every task includes explicit file paths, commands, and commit messages.

### Type Consistency

- Runtime additions use `dataClient`, `seedFallback`, `getDashboardUsability`, `listSignalInputs`, and `upsertScore` consistently across tasks.
- UI status model uses the same union everywhere: `live | degraded | fallback`.
