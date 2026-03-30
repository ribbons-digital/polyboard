# Polymarket Monitoring Dashboard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a TanStack Start private research dashboard with a separate worker that ingests live and historical Polymarket data, stores it in Postgres, computes market and wallet analytics, and renders market and wallet leaderboards with detail pages.

**Architecture:** Use a pnpm monorepo with `apps/web` for the TanStack Start SSR app and `apps/worker` for long-running discovery, WebSocket ingest, backfill, and analytics jobs. Shared packages isolate database access, Polymarket API clients, and scoring logic so the UI reads only internal typed services.

**Tech Stack:** TanStack Start, React, TypeScript, pnpm workspaces, Postgres, Drizzle ORM, Zod, Vitest, Playwright, Pino, ws, Bottleneck, TanStack Table, Recharts

---

## Scope Check

The approved spec is broad but still cohesive enough for one implementation plan because all subsystems serve one operator-facing product and share one data model. The tasks below are ordered so each milestone produces working, testable software while keeping boundaries explicit.

## File Structure

### Root workspace

- `package.json`: workspace scripts for dev, build, test, and database commands
- `pnpm-workspace.yaml`: workspace package globs
- `tsconfig.base.json`: shared TypeScript compiler options and path aliases
- `.gitignore`: generated files, env files, and build output exclusions
- `.env.example`: local environment template
- `docker-compose.yml`: local Postgres service
- `README.md`: local setup, architecture overview, and deployment notes
- `tests/workspace/bootstrap.test.mjs`: workspace bootstrap smoke test
- `scripts/seed-dev.ts`: deterministic seed data for local UI and e2e work

### `packages/db`

- `packages/db/package.json`: package manifest and scripts
- `packages/db/tsconfig.json`: package TS config
- `packages/db/drizzle.config.ts`: migration configuration
- `packages/db/src/env.ts`: env parsing for database settings
- `packages/db/src/client.ts`: Drizzle client creation
- `packages/db/src/schema.ts`: normalized Postgres schema
- `packages/db/src/queries/markets.ts`: market persistence and reads
- `packages/db/src/queries/wallets.ts`: wallet persistence and reads
- `packages/db/src/queries/settings.ts`: singleton settings and watchlists
- `packages/db/src/queries/freshness.ts`: freshness and job-run queries
- `packages/db/src/index.ts`: package exports
- `packages/db/src/*.test.ts`: env and query tests

### `packages/polymarket`

- `packages/polymarket/package.json`: package manifest and scripts
- `packages/polymarket/tsconfig.json`: package TS config
- `packages/polymarket/src/http.ts`: rate-limited fetch helper
- `packages/polymarket/src/types.ts`: shared endpoint and payload types
- `packages/polymarket/src/gamma-client.ts`: Gamma API client
- `packages/polymarket/src/data-client.ts`: Data API client
- `packages/polymarket/src/clob-client.ts`: CLOB REST client
- `packages/polymarket/src/market-socket.ts`: CLOB market WebSocket client
- `packages/polymarket/src/normalizers.ts`: payload normalization helpers
- `packages/polymarket/src/index.ts`: package exports
- `packages/polymarket/test/fixtures/*`: captured payload fixtures
- `packages/polymarket/src/*.test.ts`: client and normalization tests

### `packages/analytics`

- `packages/analytics/package.json`: package manifest and scripts
- `packages/analytics/tsconfig.json`: package TS config
- `packages/analytics/src/edge-score.ts`: composite market score calculation
- `packages/analytics/src/wallet-metrics.ts`: wallet PnL and performance helpers
- `packages/analytics/src/wallet-tags.ts`: deterministic tag derivation rules
- `packages/analytics/src/index.ts`: exports
- `packages/analytics/src/*.test.ts`: analytics unit tests

### `apps/worker`

- `apps/worker/package.json`: worker manifest and scripts
- `apps/worker/tsconfig.json`: worker TS config
- `apps/worker/src/config.ts`: worker env parsing
- `apps/worker/src/index.ts`: worker entrypoint
- `apps/worker/src/runtime.ts`: dependency assembly
- `apps/worker/src/jobs/discovery.ts`: market discovery polling
- `apps/worker/src/jobs/live-ingest.ts`: WebSocket subscribe and snapshot writes
- `apps/worker/src/jobs/backfill.ts`: wallet and market history backfill
- `apps/worker/src/jobs/analytics.ts`: score and tag recomputation
- `apps/worker/src/health.ts`: worker health summary
- `apps/worker/src/**/*.test.ts`: worker unit tests with fakes

### `apps/web`

- `apps/web/package.json`: app manifest and scripts
- `apps/web/vite.config.ts`: TanStack Start Vite config
- `apps/web/tsconfig.json`: web TS config
- `apps/web/src/router.tsx`: router and query client setup
- `apps/web/src/styles.css`: global styles
- `apps/web/src/routes/__root.tsx`: root document, nav, and providers
- `apps/web/src/routes/index.tsx`: overview home page
- `apps/web/src/routes/markets/index.tsx`: market leaderboard route
- `apps/web/src/routes/markets/$marketId.tsx`: market detail route
- `apps/web/src/routes/wallets/index.tsx`: wallet leaderboard route
- `apps/web/src/routes/wallets/$walletId.tsx`: wallet detail route
- `apps/web/src/routes/settings.tsx`: settings and watchlists route
- `apps/web/src/routes/api/health.tsx`: health endpoint
- `apps/web/src/features/markets/service.ts`: DB-backed market read service
- `apps/web/src/features/wallets/service.ts`: DB-backed wallet read service
- `apps/web/src/features/settings/service.ts`: settings persistence service
- `apps/web/src/features/*/server.ts`: TanStack Start server functions
- `apps/web/src/components/layout/*`: shell and nav components
- `apps/web/src/components/markets/*`: market leaderboard/detail components
- `apps/web/src/components/wallets/*`: wallet leaderboard/detail components
- `apps/web/src/components/settings/*`: settings and watchlist components
- `apps/web/src/test/setup.ts`: Testing Library setup
- `apps/web/src/**/*.test.tsx`: component and service tests
- `apps/web/tests/e2e/dashboard.spec.ts`: Playwright smoke flow

### Implementation note

The current workspace is not a git repository. Task 1 initializes git so the later commit steps are executable. If implementation happens inside a different existing repository or worktree, skip the `git init` command but keep the commit cadence.

Bootstrap non-regression rule: later tasks must preserve the stronger workspace bootstrap behavior introduced in Task 1. Keep the root `pnpm test` smoke-test gate, keep `pnpm-lock.yaml` tracked, and keep tracked skeleton placeholders for empty workspace directories until real files replace them. Scaffolding later packages may replace a directory's `.gitkeep`, but it must not weaken the root bootstrap checks.

### Task 1: Bootstrap The Workspace

**Files:**
- Create: `tests/workspace/bootstrap.test.mjs`
- Create: `package.json`
- Create: `pnpm-workspace.yaml`
- Create: `tsconfig.base.json`
- Create: `.gitignore`
- Create: `.env.example`
- Create: `docker-compose.yml`
- Create: `pnpm-lock.yaml`
- Create: `apps/web/.gitkeep`
- Create: `apps/worker/.gitkeep`
- Create: `packages/db/.gitkeep`
- Create: `packages/polymarket/.gitkeep`
- Create: `packages/analytics/.gitkeep`

- [ ] **Step 1: Write the failing workspace bootstrap test**

```js
// tests/workspace/bootstrap.test.mjs
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { existsSync } from 'node:fs'

const requiredFiles = [
  'package.json',
  'pnpm-workspace.yaml',
  'tsconfig.base.json',
  '.gitignore',
  '.env.example',
  'docker-compose.yml',
]

test('workspace bootstrap files exist', () => {
  for (const file of requiredFiles) {
    assert.equal(existsSync(file), true, `Missing required file: ${file}`)
  }
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `node --test tests/workspace/bootstrap.test.mjs`

Expected: FAIL with at least one `Missing required file` assertion.

- [ ] **Step 3: Write the minimal workspace implementation**

Run:

```bash
git init
mkdir -p tests/workspace apps/web apps/worker packages/db packages/polymarket packages/analytics
```

Create:

```json
// package.json
{
  "name": "polyboard",
  "private": true,
  "packageManager": "pnpm@10.13.1",
  "scripts": {
    "dev": "pnpm --parallel --filter @polyboard/web --filter @polyboard/worker dev",
    "build": "pnpm -r build",
    "test": "node --test tests/workspace/bootstrap.test.mjs && if find apps packages -mindepth 2 -name package.json -print -quit | grep -q .; then pnpm -r --if-present test; fi",
    "lint": "pnpm -r lint",
    "seed:dev": "tsx scripts/seed-dev.ts",
    "db:up": "docker compose up -d postgres",
    "db:down": "docker compose down",
    "db:logs": "docker compose logs -f postgres"
  },
  "devDependencies": {
    "@types/node": "^24.3.0",
    "tsx": "^4.20.5",
    "typescript": "^5.8.3",
    "vitest": "^3.2.4"
  }
}
```

```yaml
# pnpm-workspace.yaml
packages:
  - apps/*
  - packages/*
```

```json
// tsconfig.base.json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "resolveJsonModule": true,
    "allowSyntheticDefaultImports": true,
    "baseUrl": ".",
    "paths": {
      "@polyboard/db": ["packages/db/src/index.ts"],
      "@polyboard/polymarket": ["packages/polymarket/src/index.ts"],
      "@polyboard/analytics": ["packages/analytics/src/index.ts"]
    }
  }
}
```

```gitignore
# .gitignore
node_modules
.env
.env.local
.DS_Store
.output
coverage
dist
playwright-report
test-results
```

```dotenv
# .env.example
DATABASE_URL=postgres://polyboard:polyboard@localhost:5432/polyboard
POLYBOARD_MARKET_MIN_VOLUME=50000
POLYBOARD_BACKFILL_BATCH_SIZE=50
POLYBOARD_GAMMA_URL=https://gamma-api.polymarket.com
POLYBOARD_DATA_URL=https://data-api.polymarket.com
POLYBOARD_CLOB_URL=https://clob.polymarket.com
POLYBOARD_WS_URL=wss://ws-subscriptions-clob.polymarket.com/ws/market
```

```yaml
# docker-compose.yml
services:
  postgres:
    image: postgres:17-alpine
    container_name: polyboard-postgres
    environment:
      POSTGRES_DB: polyboard
      POSTGRES_USER: polyboard
      POSTGRES_PASSWORD: polyboard
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data

volumes:
  postgres_data:
```

Create:

```text
apps/web/.gitkeep
apps/worker/.gitkeep
packages/db/.gitkeep
packages/polymarket/.gitkeep
packages/analytics/.gitkeep
```

- [ ] **Step 4: Run the bootstrap test again**

Run:

```bash
pnpm install
node --test tests/workspace/bootstrap.test.mjs
pnpm test
```

Expected: `pnpm install` succeeds and creates `pnpm-lock.yaml`; both `node --test tests/workspace/bootstrap.test.mjs` and `pnpm test` pass.

- [ ] **Step 5: Commit**

Commit the initial scaffold first. If `pnpm install` or the review loop adds the lockfile, tracked skeleton placeholders, or stronger bootstrap verification, land those as focused follow-up commits instead of rewriting the initial bootstrap commit.

```bash
git add package.json pnpm-workspace.yaml tsconfig.base.json .gitignore .env.example docker-compose.yml tests/workspace/bootstrap.test.mjs
git commit -m "chore: bootstrap polyboard workspace"

# If install or review feedback expands the bootstrap surface, follow-up commits are acceptable.
git add pnpm-lock.yaml package.json tests/workspace/bootstrap.test.mjs apps/web/.gitkeep apps/worker/.gitkeep packages/db/.gitkeep packages/polymarket/.gitkeep packages/analytics/.gitkeep
git commit -m "fix: tighten workspace bootstrap coverage"
```

### Task 2: Scaffold The TanStack Start Web App

**Files:**
- Create: `apps/web/src/features/home/home-page.test.tsx`
- Create: `apps/web/src/features/home/home-page.tsx`
- Create: `apps/web/src/test/setup.ts`
- Delete: `apps/web/.gitkeep`
- Modify: `apps/web/package.json`
- Create: `apps/web/tsconfig.json`
- Create: `apps/web/vite.config.ts`
- Create: `apps/web/src/router.tsx`
- Create: `apps/web/src/routes/__root.tsx`
- Create: `apps/web/src/routes/index.tsx`
- Create: `apps/web/src/styles.css`

- [ ] **Step 1: Write the failing home-page test**

```tsx
// apps/web/src/features/home/home-page.test.tsx
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { HomePage } from './home-page'

describe('HomePage', () => {
  it('renders the primary research entry points', () => {
    render(<HomePage />)

    expect(
      screen.getByRole('heading', { name: /live polymarket intelligence/i }),
    ).toBeInTheDocument()
    expect(screen.getByText(/markets/i)).toBeInTheDocument()
    expect(screen.getByText(/wallets/i)).toBeInTheDocument()
    expect(screen.getByText(/settings/i)).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm --filter @polyboard/web test -- --run src/features/home/home-page.test.tsx`

Expected: FAIL because the `@polyboard/web` package and route files do not exist yet.

- [ ] **Step 3: Create the TanStack Start app and the minimal home route**

Run:

```bash
pnpm dlx @tanstack/cli@latest create apps/web
pnpm --filter @polyboard/web add @tanstack/react-query @tanstack/react-query-devtools @tanstack/react-table recharts
pnpm --filter @polyboard/web add -D @testing-library/jest-dom @testing-library/react @vitejs/plugin-react jsdom
```

Create or replace:

```json
// apps/web/package.json
{
  "name": "@polyboard/web",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vite dev --port 3000",
    "build": "vite build",
    "start": "srvx serve --prod --dir dist/server --entry server.js --static ../client --port 3000",
    "test": "vitest run",
    "lint": "tsc --noEmit"
  },
  "dependencies": {
    "@tanstack/react-query": "^5.95.2",
    "@tanstack/react-query-devtools": "^5.95.2",
    "@tanstack/react-router": "^1.114.3",
    "@tanstack/react-router-devtools": "^1.114.3",
    "@tanstack/react-start": "^1.114.3",
    "@tanstack/react-table": "^8.21.3",
    "react": "^19.1.1",
    "react-dom": "^19.1.1",
    "recharts": "^2.15.4",
    "srvx": "^0.11.13"
  },
  "devDependencies": {
    "@playwright/test": "^1.55.0",
    "@types/react": "^19.2.14",
    "@types/react-dom": "^19.2.3",
    "@testing-library/jest-dom": "^6.8.0",
    "@testing-library/react": "^16.3.0",
    "@vitejs/plugin-react": "^5.0.2",
    "jsdom": "^26.1.0",
    "vite": "^7.1.3"
  }
}
```

```json
// apps/web/tsconfig.json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "jsx": "react-jsx",
    "types": ["vite/client"]
  },
  "include": ["src", "vite.config.ts"]
}
```

```ts
// apps/web/vite.config.ts
import { defineConfig } from 'vite'
import { tanstackStart } from '@tanstack/react-start/plugin/vite'
import viteReact from '@vitejs/plugin-react'

export default defineConfig({
  server: {
    port: 3000,
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
  },
  plugins: [
    tanstackStart(),
    viteReact(),
  ],
})
```

```ts
// apps/web/src/router.tsx
import { QueryClient } from '@tanstack/react-query'
import { createRouter } from '@tanstack/react-router'
import { routeTree } from './routeTree.gen'

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      refetchOnWindowFocus: false,
    },
  },
})

export const router = createRouter({
  routeTree,
  context: {
    queryClient,
  },
  defaultPreload: 'intent',
})

export function getRouter() {
  return router
}

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router
  }
}
```

```ts
// apps/web/src/test/setup.ts
import '@testing-library/jest-dom/vitest'
```

```tsx
// apps/web/src/routes/__root.tsx
/// <reference types="vite/client" />
import {
  HeadContent,
  Link,
  Outlet,
  Scripts,
  createRootRouteWithContext,
} from '@tanstack/react-router'
import { QueryClientProvider } from '@tanstack/react-query'
import { ReactQueryDevtools } from '@tanstack/react-query-devtools'
import { TanStackRouterDevtools } from '@tanstack/react-router-devtools'
import type { ReactNode } from 'react'
import { queryClient } from '../router'
import appCss from '../styles.css?url'

export const Route = createRootRouteWithContext<{ queryClient: typeof queryClient }>()({
  head: () => ({
    meta: [
      { charSet: 'utf-8' },
      { name: 'viewport', content: 'width=device-width, initial-scale=1' },
      { title: 'Polyboard' },
    ],
    links: [{ rel: 'stylesheet', href: appCss }],
  }),
  component: RootComponent,
})

function RootComponent() {
  return (
    <RootDocument>
      <QueryClientProvider client={queryClient}>
        <div className="app-shell">
          <header className="topbar">
            <div>
              <p className="eyebrow">Private research console</p>
              <h1>Polyboard</h1>
            </div>
            <nav className="nav">
              <Link to="/">Overview</Link>
              <span className="nav-label">Markets</span>
              <span className="nav-label">Wallets</span>
              <span className="nav-label">Settings</span>
            </nav>
          </header>
          <main className="page">
            <Outlet />
          </main>
        </div>
        <ReactQueryDevtools initialIsOpen={false} />
        <TanStackRouterDevtools position="bottom-right" />
      </QueryClientProvider>
    </RootDocument>
  )
}

function RootDocument({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>{children}<Scripts /></body>
    </html>
  )
}
```

```tsx
// apps/web/src/features/home/home-page.tsx
export function HomePage() {
  return (
    <section className="hero-grid">
      <div className="hero-card">
        <p className="eyebrow">Dashboard</p>
        <h2>Live Polymarket Intelligence</h2>
        <p>
          Track live order flow, strong traders, and fresh edge signals from one
          screen.
        </p>
      </div>
      <div className="quick-links">
        <article className="surface">
          <h3>Markets</h3>
          <p>Rank active contracts by composite edge score.</p>
        </article>
        <article className="surface">
          <h3>Wallets</h3>
          <p>Inspect PnL, win rate, position sizes, and specialist tags.</p>
        </article>
        <article className="surface">
          <h3>Settings</h3>
          <p>Tune thresholds, score weights, and watchlists.</p>
        </article>
      </div>
    </section>
  )
}
```

```tsx
// apps/web/src/routes/index.tsx
import { createFileRoute } from '@tanstack/react-router'
import { HomePage } from '../features/home/home-page'

export const Route = createFileRoute('/')({
  component: HomePage,
})
```

```css
/* apps/web/src/styles.css */
:root {
  color-scheme: dark;
  --bg: #07131a;
  --panel: #10232d;
  --panel-alt: #15313c;
  --text: #e8f4f1;
  --muted: #9fb9b4;
  --accent: #64d7b4;
  --border: rgba(255, 255, 255, 0.08);
  font-family: "IBM Plex Sans", sans-serif;
}

* {
  box-sizing: border-box;
}

body {
  margin: 0;
  background:
    radial-gradient(circle at top right, rgba(100, 215, 180, 0.18), transparent 30%),
    linear-gradient(180deg, #07131a 0%, #0c1e27 100%);
  color: var(--text);
}

.app-shell {
  min-height: 100vh;
  padding: 24px;
}

.topbar,
.hero-grid,
.quick-links {
  display: grid;
  gap: 16px;
}

.topbar {
  grid-template-columns: 1fr auto;
  align-items: end;
  margin-bottom: 24px;
}

.nav {
  display: flex;
  gap: 16px;
}

.nav a {
  color: var(--muted);
  text-decoration: none;
}

.nav-label {
  color: var(--muted);
}

.page,
.hero-card,
.surface {
  border: 1px solid var(--border);
  border-radius: 20px;
  background: rgba(16, 35, 45, 0.82);
  backdrop-filter: blur(10px);
}

.page {
  padding: 24px;
}

.hero-card,
.surface {
  padding: 20px;
}

.eyebrow {
  margin: 0 0 8px;
  color: var(--accent);
  text-transform: uppercase;
  letter-spacing: 0.08em;
  font-size: 12px;
}
```

- [ ] **Step 4: Run the web tests**

Run:

```bash
pnpm --filter @polyboard/web test -- --run src/features/home/home-page.test.tsx
pnpm --filter @polyboard/web lint
pnpm --filter @polyboard/web build
pnpm --filter @polyboard/web start
```

Expected: the unit test passes, `lint` is clean, the web app build completes without type errors, and the start command uses `srvx` to keep the built server process alive while loading the handler and static assets.

- [ ] **Step 5: Commit**

```bash
git add apps/web package.json pnpm-workspace.yaml tsconfig.base.json
git commit -m "feat: scaffold tanstack start dashboard shell"
```

### Task 3: Add Database Schema And Settings Persistence

**Files:**
- Create: `packages/db/src/env.test.ts`
- Create: `packages/db/package.json`
- Create: `packages/db/tsconfig.json`
- Create: `packages/db/drizzle.config.ts`
- Create: `packages/db/src/env.ts`
- Create: `packages/db/src/client.ts`
- Create: `packages/db/src/schema.ts`
- Create: `packages/db/src/queries/settings.ts`
- Create: `packages/db/src/index.ts`

- [ ] **Step 1: Write the failing database env test**

```ts
// packages/db/src/env.test.ts
import { describe, expect, it } from 'vitest'
import { parseDatabaseEnv } from './env'

describe('parseDatabaseEnv', () => {
  it('requires DATABASE_URL', () => {
    expect(() => parseDatabaseEnv({})).toThrowError(/DATABASE_URL/)
  })

  it('applies sane defaults for optional thresholds', () => {
    expect(
      parseDatabaseEnv({
        DATABASE_URL: 'postgres://polyboard:polyboard@localhost:5432/polyboard',
      }),
    ).toMatchObject({
      minMarketVolume: 50000,
      backfillBatchSize: 50,
    })
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm --filter @polyboard/db test -- --run src/env.test.ts`

Expected: FAIL because `@polyboard/db` does not exist yet.

- [ ] **Step 3: Implement the shared database package**

Run:

```bash
pnpm add -Dw drizzle-kit
pnpm --filter @polyboard/db add drizzle-orm postgres zod
```

Create:

```json
// packages/db/package.json
{
  "name": "@polyboard/db",
  "private": true,
  "type": "module",
  "scripts": {
    "build": "tsc -p tsconfig.json",
    "test": "vitest run",
    "lint": "tsc -p tsconfig.json --noEmit",
    "db:generate": "drizzle-kit generate",
    "db:push": "drizzle-kit push"
  },
  "dependencies": {
    "dotenv": "^17.2.2",
    "drizzle-orm": "^0.44.5",
    "postgres": "^3.4.7",
    "zod": "^4.1.5"
  }
}
```

```json
// packages/db/tsconfig.json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "dist"
  },
  "include": ["src", "drizzle.config.ts"]
}
```

```ts
// packages/db/drizzle.config.ts
import { defineConfig } from 'drizzle-kit'
import { config } from 'dotenv'

config()

export default defineConfig({
  schema: './src/schema.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL ?? 'postgres://polyboard:polyboard@localhost:5432/polyboard',
  },
})
```

```ts
// packages/db/src/env.ts
import { z } from 'zod'

const EnvSchema = z.object({
  DATABASE_URL: z.string().url(),
  POLYBOARD_MARKET_MIN_VOLUME: z.coerce.number().positive().default(50_000),
  POLYBOARD_BACKFILL_BATCH_SIZE: z.coerce.number().int().positive().default(50),
})

export function parseDatabaseEnv(input: Record<string, string | undefined>) {
  const parsed = EnvSchema.parse(input)

  return {
    databaseUrl: parsed.DATABASE_URL,
    minMarketVolume: parsed.POLYBOARD_MARKET_MIN_VOLUME,
    backfillBatchSize: parsed.POLYBOARD_BACKFILL_BATCH_SIZE,
  }
}
```

```ts
// packages/db/src/client.ts
import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import { parseDatabaseEnv } from './env'

export function createDb(env: Record<string, string | undefined> = process.env) {
  const parsed = parseDatabaseEnv(env)
  const client = postgres(parsed.databaseUrl, {
    prepare: false,
    max: 5,
  })

  return drizzle(client)
}
```

```ts
// packages/db/src/schema.ts
import {
  bigint,
  boolean,
  integer,
  jsonb,
  numeric,
  pgTable,
  primaryKey,
  text,
  timestamp,
  varchar,
} from 'drizzle-orm/pg-core'

export const events = pgTable('events', {
  id: text('id').primaryKey(),
  slug: text('slug').notNull(),
  title: text('title').notNull(),
  category: text('category'),
  endDate: timestamp('end_date', { withTimezone: true }),
  metadata: jsonb('metadata').notNull().default({}),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull(),
})

export const markets = pgTable('markets', {
  id: text('id').primaryKey(),
  conditionId: text('condition_id').notNull().unique(),
  eventId: text('event_id').references(() => events.id),
  question: text('question').notNull(),
  slug: text('slug').notNull(),
  active: boolean('active').notNull(),
  closed: boolean('closed').notNull(),
  volume: numeric('volume', { precision: 18, scale: 2 }).notNull(),
  liquidity: numeric('liquidity', { precision: 18, scale: 2 }),
  endDate: timestamp('end_date', { withTimezone: true }),
  category: varchar('category', { length: 120 }),
  metadata: jsonb('metadata').notNull().default({}),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull(),
})

export const marketTags = pgTable(
  'market_tags',
  {
    marketId: text('market_id').notNull().references(() => markets.id, { onDelete: 'cascade' }),
    tagSlug: text('tag_slug').notNull(),
    label: text('label').notNull(),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.marketId, table.tagSlug] }),
  }),
)

export const tokens = pgTable('tokens', {
  id: text('id').primaryKey(),
  marketId: text('market_id').notNull().references(() => markets.id, { onDelete: 'cascade' }),
  outcome: text('outcome').notNull(),
  outcomeIndex: integer('outcome_index').notNull(),
})

export const wallets = pgTable('wallets', {
  address: text('address').primaryKey(),
  displayName: text('display_name'),
  pseudonym: text('pseudonym'),
  verified: boolean('verified').notNull().default(false),
  profileImage: text('profile_image'),
  metadata: jsonb('metadata').notNull().default({}),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull(),
})

export const walletWatchlists = pgTable('wallet_watchlists', {
  address: text('address').primaryKey().references(() => wallets.address, { onDelete: 'cascade' }),
  note: text('note'),
  isExcluded: boolean('is_excluded').notNull().default(false),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull(),
})

export const appSettings = pgTable('app_settings', {
  id: integer('id').primaryKey().default(1),
  minMarketVolume: integer('min_market_volume').notNull().default(50000),
  scoreWeights: jsonb('score_weights').notNull().default({
    marketStructure: 0.4,
    smartMoney: 0.4,
    timing: 0.2,
  }),
  trackedCategories: jsonb('tracked_categories').notNull().default([]),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull(),
})

export const marketSnapshots = pgTable('market_snapshots', {
  id: bigint('id', { mode: 'number' }).primaryKey().generatedAlwaysAsIdentity(),
  marketId: text('market_id').notNull().references(() => markets.id, { onDelete: 'cascade' }),
  tokenId: text('token_id').notNull().references(() => tokens.id, { onDelete: 'cascade' }),
  lastPrice: numeric('last_price', { precision: 12, scale: 6 }),
  spreadBps: numeric('spread_bps', { precision: 12, scale: 2 }),
  bestBid: numeric('best_bid', { precision: 12, scale: 6 }),
  bestAsk: numeric('best_ask', { precision: 12, scale: 6 }),
  capturedAt: timestamp('captured_at', { withTimezone: true }).notNull(),
})

export const walletPositionsOpen = pgTable('wallet_positions_open', {
  id: bigint('id', { mode: 'number' }).primaryKey().generatedAlwaysAsIdentity(),
  walletAddress: text('wallet_address').notNull().references(() => wallets.address, { onDelete: 'cascade' }),
  marketId: text('market_id').notNull().references(() => markets.id, { onDelete: 'cascade' }),
  tokenId: text('token_id').notNull().references(() => tokens.id, { onDelete: 'cascade' }),
  outcome: text('outcome').notNull(),
  size: numeric('size', { precision: 18, scale: 4 }).notNull(),
  averagePrice: numeric('average_price', { precision: 12, scale: 6 }).notNull(),
  currentValue: numeric('current_value', { precision: 18, scale: 2 }).notNull(),
  realizedPnl: numeric('realized_pnl', { precision: 18, scale: 2 }).notNull().default('0'),
  totalPnl: numeric('total_pnl', { precision: 18, scale: 2 }).notNull().default('0'),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull(),
})

export const walletPositionsClosed = pgTable('wallet_positions_closed', {
  id: bigint('id', { mode: 'number' }).primaryKey().generatedAlwaysAsIdentity(),
  walletAddress: text('wallet_address').notNull().references(() => wallets.address, { onDelete: 'cascade' }),
  marketId: text('market_id').notNull().references(() => markets.id, { onDelete: 'cascade' }),
  tokenId: text('token_id').notNull().references(() => tokens.id, { onDelete: 'cascade' }),
  outcome: text('outcome').notNull(),
  totalBought: numeric('total_bought', { precision: 18, scale: 2 }).notNull(),
  averagePrice: numeric('average_price', { precision: 12, scale: 6 }).notNull(),
  realizedPnl: numeric('realized_pnl', { precision: 18, scale: 2 }).notNull(),
  closedAt: timestamp('closed_at', { withTimezone: true }).notNull(),
})

export const walletTrades = pgTable('wallet_trades', {
  transactionHash: text('transaction_hash').primaryKey(),
  walletAddress: text('wallet_address').notNull().references(() => wallets.address, { onDelete: 'cascade' }),
  marketId: text('market_id').notNull().references(() => markets.id, { onDelete: 'cascade' }),
  tokenId: text('token_id').notNull().references(() => tokens.id, { onDelete: 'cascade' }),
  side: text('side').notNull(),
  price: numeric('price', { precision: 12, scale: 6 }).notNull(),
  size: numeric('size', { precision: 18, scale: 4 }).notNull(),
  tradedAt: timestamp('traded_at', { withTimezone: true }).notNull(),
})

export const marketHolders = pgTable('market_holders', {
  id: bigint('id', { mode: 'number' }).primaryKey().generatedAlwaysAsIdentity(),
  marketId: text('market_id').notNull().references(() => markets.id, { onDelete: 'cascade' }),
  tokenId: text('token_id').notNull().references(() => tokens.id, { onDelete: 'cascade' }),
  walletAddress: text('wallet_address').notNull().references(() => wallets.address, { onDelete: 'cascade' }),
  size: numeric('size', { precision: 18, scale: 4 }).notNull(),
  currentValue: numeric('current_value', { precision: 18, scale: 2 }),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull(),
})

export const walletEventStats = pgTable(
  'wallet_event_stats',
  {
    walletAddress: text('wallet_address').notNull().references(() => wallets.address, { onDelete: 'cascade' }),
    eventSlug: text('event_slug').notNull(),
    tradeCount: integer('trade_count').notNull(),
    realizedPnl: numeric('realized_pnl', { precision: 18, scale: 2 }).notNull(),
    totalVolume: numeric('total_volume', { precision: 18, scale: 2 }).notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull(),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.walletAddress, table.eventSlug] }),
  }),
)

export const marketScores = pgTable('market_scores', {
  marketId: text('market_id').primaryKey().references(() => markets.id, { onDelete: 'cascade' }),
  marketStructureScore: numeric('market_structure_score', { precision: 10, scale: 4 }).notNull(),
  smartMoneyScore: numeric('smart_money_score', { precision: 10, scale: 4 }).notNull(),
  timingScore: numeric('timing_score', { precision: 10, scale: 4 }).notNull(),
  edgeScore: numeric('edge_score', { precision: 10, scale: 4 }).notNull(),
  reasons: jsonb('reasons').notNull().default([]),
  calculatedAt: timestamp('calculated_at', { withTimezone: true }).notNull(),
})

export const walletScores = pgTable('wallet_scores', {
  walletAddress: text('wallet_address').primaryKey().references(() => wallets.address, { onDelete: 'cascade' }),
  realizedPnl: numeric('realized_pnl', { precision: 18, scale: 2 }).notNull().default('0'),
  unrealizedPnl: numeric('unrealized_pnl', { precision: 18, scale: 2 }).notNull().default('0'),
  totalPnl: numeric('total_pnl', { precision: 18, scale: 2 }).notNull().default('0'),
  winRate: numeric('win_rate', { precision: 8, scale: 4 }).notNull().default('0'),
  averagePositionSize: numeric('average_position_size', { precision: 18, scale: 2 }).notNull().default('0'),
  tags: jsonb('tags').notNull().default([]),
  completeness: text('completeness').notNull().default('provisional'),
  calculatedAt: timestamp('calculated_at', { withTimezone: true }).notNull(),
})

export const dataFreshness = pgTable('data_freshness', {
  sourceKey: text('source_key').primaryKey(),
  status: text('status').notNull(),
  completeness: text('completeness').notNull().default('backfilled'),
  asOf: timestamp('as_of', { withTimezone: true }).notNull(),
})

export const jobRuns = pgTable('job_runs', {
  id: bigint('id', { mode: 'number' }).primaryKey().generatedAlwaysAsIdentity(),
  jobName: text('job_name').notNull(),
  status: text('status').notNull(),
  details: jsonb('details').notNull().default({}),
  startedAt: timestamp('started_at', { withTimezone: true }).notNull(),
  finishedAt: timestamp('finished_at', { withTimezone: true }),
})
```

```ts
// packages/db/src/queries/settings.ts
import { eq } from 'drizzle-orm'
import { appSettings, walletWatchlists } from '../schema'

export async function ensureSettingsRow(db: ReturnType<typeof import('../client').createDb>) {
  const existing = await db.select().from(appSettings).where(eq(appSettings.id, 1))

  if (existing.length > 0) {
    return existing[0]
  }

  const now = new Date()
  const inserted = await db
    .insert(appSettings)
    .values({ id: 1, updatedAt: now })
    .returning()

  return inserted[0]
}

export async function upsertWatchlistEntry(
  db: ReturnType<typeof import('../client').createDb>,
  input: { address: string; note?: string; isExcluded?: boolean },
) {
  const now = new Date()

  await db
    .insert(walletWatchlists)
    .values({
      address: input.address,
      note: input.note,
      isExcluded: input.isExcluded ?? false,
      createdAt: now,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: walletWatchlists.address,
      set: {
        note: input.note,
        isExcluded: input.isExcluded ?? false,
        updatedAt: now,
      },
    })
}
```

```ts
// packages/db/src/index.ts
export * from './client'
export * from './env'
export * from './schema'
export * from './queries/settings'
```

- [ ] **Step 4: Run the database tests and generate the initial migration**

Run:

```bash
pnpm db:up
pnpm --filter @polyboard/db test -- --run src/env.test.ts
pnpm --filter @polyboard/db db:generate
```

Expected: env tests pass and Drizzle writes the initial migration files under `packages/db/drizzle`.

- [ ] **Step 5: Commit**

```bash
git add packages/db package.json docker-compose.yml .env.example
git commit -m "feat: add shared postgres schema and settings storage"
```

### Task 4: Build The Polymarket Client Package

**Files:**
- Create: `packages/polymarket/src/normalizers.test.ts`
- Create: `packages/polymarket/test/fixtures/gamma-market.json`
- Create: `packages/polymarket/package.json`
- Create: `packages/polymarket/tsconfig.json`
- Create: `packages/polymarket/src/http.ts`
- Create: `packages/polymarket/src/types.ts`
- Create: `packages/polymarket/src/normalizers.ts`
- Create: `packages/polymarket/src/gamma-client.ts`
- Create: `packages/polymarket/src/data-client.ts`
- Create: `packages/polymarket/src/clob-client.ts`
- Create: `packages/polymarket/src/market-socket.ts`
- Create: `packages/polymarket/src/index.ts`

- [ ] **Step 1: Write the failing normalization test**

```ts
// packages/polymarket/src/normalizers.test.ts
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { normalizeGammaMarket } from './normalizers'

describe('normalizeGammaMarket', () => {
  it('extracts market and token metadata from the Gamma payload', () => {
    const raw = JSON.parse(
      readFileSync(new URL('../test/fixtures/gamma-market.json', import.meta.url), 'utf8'),
    )

    expect(normalizeGammaMarket(raw)).toMatchObject({
      id: '12345',
      question: 'Will BTC close above $100k on Friday?',
      tokens: [
        { id: 'token_yes', outcome: 'Yes', outcomeIndex: 0 },
        { id: 'token_no', outcome: 'No', outcomeIndex: 1 },
      ],
    })
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm --filter @polyboard/polymarket test -- --run src/normalizers.test.ts`

Expected: FAIL because the package and normalizer do not exist yet.

- [ ] **Step 3: Implement the Polymarket clients and payload normalization**

Run:

```bash
pnpm --filter @polyboard/polymarket add bottleneck ws zod
```

Create:

```json
// packages/polymarket/package.json
{
  "name": "@polyboard/polymarket",
  "private": true,
  "type": "module",
  "scripts": {
    "build": "tsc -p tsconfig.json",
    "test": "vitest run",
    "lint": "tsc -p tsconfig.json --noEmit"
  },
  "dependencies": {
    "bottleneck": "^2.19.5",
    "ws": "^8.18.3",
    "zod": "^4.1.5"
  }
}
```

```json
// packages/polymarket/tsconfig.json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "dist"
  },
  "include": ["src", "test"]
}
```

```json
// packages/polymarket/test/fixtures/gamma-market.json
{
  "id": "12345",
  "conditionId": "0xcondition",
  "question": "Will BTC close above $100k on Friday?",
  "slug": "btc-above-100k-friday",
  "active": true,
  "closed": false,
  "volume": "125000.50",
  "liquidity": "42000.10",
  "category": "Crypto",
  "outcomes": "[\"Yes\",\"No\"]",
  "clobTokenIds": "[\"token_yes\",\"token_no\"]",
  "endDate": "2026-03-31T16:00:00Z"
}
```

```ts
// packages/polymarket/src/types.ts
export interface NormalizedToken {
  id: string
  outcome: string
  outcomeIndex: number
}

export interface NormalizedMarket {
  id: string
  conditionId: string
  question: string
  slug: string
  active: boolean
  closed: boolean
  volume: number
  liquidity: number
  category: string | null
  endDate: string | null
  tokens: NormalizedToken[]
}

export interface MarketSocketMessage {
  assetId: string
  bestBid?: number
  bestAsk?: number
  price?: number
  side?: 'BUY' | 'SELL'
  timestamp: number
}
```

```ts
// packages/polymarket/src/http.ts
import Bottleneck from 'bottleneck'

const limiter = new Bottleneck({
  minTime: 50,
  maxConcurrent: 4,
})

export async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  return limiter.schedule(async () => {
    const response = await fetch(url, init)

    if (!response.ok) {
      throw new Error(`Polymarket request failed: ${response.status} ${response.statusText}`)
    }

    return (await response.json()) as T
  })
}
```

```ts
// packages/polymarket/src/normalizers.ts
import type { MarketSocketMessage, NormalizedMarket } from './types'

export function normalizeGammaMarket(input: {
  id: string
  conditionId: string
  question: string
  slug: string
  active: boolean
  closed: boolean
  volume: string
  liquidity: string
  category?: string
  endDate?: string
  outcomes: string
  clobTokenIds: string
}): NormalizedMarket {
  const outcomes = JSON.parse(input.outcomes) as string[]
  const tokenIds = JSON.parse(input.clobTokenIds) as string[]

  return {
    id: input.id,
    conditionId: input.conditionId,
    question: input.question,
    slug: input.slug,
    active: input.active,
    closed: input.closed,
    volume: Number(input.volume),
    liquidity: Number(input.liquidity),
    category: input.category ?? null,
    endDate: input.endDate ?? null,
    tokens: tokenIds.map((id, index) => ({
      id,
      outcome: outcomes[index] ?? `Outcome ${index + 1}`,
      outcomeIndex: index,
    })),
  }
}

export function normalizeSocketMessage(input: Record<string, unknown>): MarketSocketMessage {
  return {
    assetId: String(input.asset_id ?? input.assetId),
    bestBid: input.best_bid ? Number(input.best_bid) : undefined,
    bestAsk: input.best_ask ? Number(input.best_ask) : undefined,
    price: input.price ? Number(input.price) : undefined,
    side: input.side === 'BUY' || input.side === 'SELL' ? input.side : undefined,
    timestamp: Number(input.timestamp ?? Date.now()),
  }
}
```

```ts
// packages/polymarket/src/gamma-client.ts
import { fetchJson } from './http'
import { normalizeGammaMarket } from './normalizers'

export class GammaClient {
  constructor(private readonly baseUrl = 'https://gamma-api.polymarket.com') {}

  async listMarkets() {
    const payload = await fetchJson<Array<Parameters<typeof normalizeGammaMarket>[0]>>(
      `${this.baseUrl}/markets`,
    )

    return payload.map(normalizeGammaMarket)
  }

  async listEvents() {
    return fetchJson<Array<Record<string, unknown>>>(`${this.baseUrl}/events`)
  }

  async getMarketTags(marketId: string) {
    return fetchJson<Array<{ slug: string; label: string }>>(
      `${this.baseUrl}/markets/${marketId}/tags`,
    )
  }

  async getPublicProfile(wallet: string) {
    return fetchJson<Record<string, unknown>>(
      `${this.baseUrl}/public-profile?address=${wallet}`,
    )
  }
}
```

```ts
// packages/polymarket/src/data-client.ts
import { fetchJson } from './http'

export class DataClient {
  constructor(private readonly baseUrl = 'https://data-api.polymarket.com') {}

  getLeaderboard() {
    return fetchJson<Array<Record<string, unknown>>>(`${this.baseUrl}/v1/leaderboard`)
  }

  getPositions(user: string) {
    return fetchJson<Array<Record<string, unknown>>>(`${this.baseUrl}/positions?user=${user}`)
  }

  getClosedPositions(user: string) {
    return fetchJson<Array<Record<string, unknown>>>(`${this.baseUrl}/closed-positions?user=${user}`)
  }

  getActivity(user: string) {
    return fetchJson<Array<Record<string, unknown>>>(`${this.baseUrl}/activity?user=${user}`)
  }

  getTrades(params: URLSearchParams) {
    return fetchJson<Array<Record<string, unknown>>>(`${this.baseUrl}/trades?${params.toString()}`)
  }

  getHolders(market: string) {
    return fetchJson<Array<Record<string, unknown>>>(`${this.baseUrl}/holders?market=${market}`)
  }

  getMarketPositions(market: string) {
    return fetchJson<Array<Record<string, unknown>>>(`${this.baseUrl}/v1/market-positions?market=${market}`)
  }

  getValue(user: string) {
    return fetchJson<Array<Record<string, unknown>>>(`${this.baseUrl}/value?user=${user}`)
  }

  getOpenInterest(market: string) {
    return fetchJson<Array<Record<string, unknown>>>(`${this.baseUrl}/oi?market=${market}`)
  }
}
```

```ts
// packages/polymarket/src/clob-client.ts
import { fetchJson } from './http'

export class ClobClient {
  constructor(private readonly baseUrl = 'https://clob.polymarket.com') {}

  getPriceHistory(tokenId: string, interval: '1h' | '6h' | '1d' | '1w' | 'max' = '1d') {
    return fetchJson<{ history: Array<{ t: number; p: number }> }>(
      `${this.baseUrl}/prices-history?market=${tokenId}&interval=${interval}`,
    )
  }
}
```

```ts
// packages/polymarket/src/market-socket.ts
import { EventEmitter } from 'node:events'
import WebSocket from 'ws'
import { normalizeSocketMessage } from './normalizers'

export class MarketSocket extends EventEmitter {
  private socket?: WebSocket

  constructor(private readonly url = 'wss://ws-subscriptions-clob.polymarket.com/ws/market') {
    super()
  }

  connect(assetIds: string[]) {
    this.socket = new WebSocket(this.url)

    this.socket.on('open', () => {
      this.socket?.send(
        JSON.stringify({
          assets_ids: assetIds,
          type: 'subscribe',
        }),
      )
    })

    this.socket.on('message', (payload) => {
      const parsed = JSON.parse(payload.toString()) as Record<string, unknown>
      this.emit('message', normalizeSocketMessage(parsed))
    })

    this.socket.on('close', () => this.emit('close'))
    this.socket.on('error', (error) => this.emit('error', error))
  }

  disconnect() {
    this.socket?.close()
  }
}
```

```ts
// packages/polymarket/src/index.ts
export * from './types'
export * from './normalizers'
export * from './gamma-client'
export * from './data-client'
export * from './clob-client'
export * from './market-socket'
```

- [ ] **Step 4: Run the client tests**

Run:

```bash
pnpm --filter @polyboard/polymarket test -- --run src/normalizers.test.ts
pnpm --filter @polyboard/polymarket build
```

Expected: normalization tests pass and the package builds successfully.

- [ ] **Step 5: Commit**

```bash
git add packages/polymarket
git commit -m "feat: add polymarket gamma data and clob clients"
```

### Task 5: Implement Worker Discovery And Live Ingest

**Files:**
- Create: `apps/worker/src/jobs/discovery.test.ts`
- Create: `apps/worker/package.json`
- Create: `apps/worker/tsconfig.json`
- Create: `apps/worker/src/config.ts`
- Create: `apps/worker/src/runtime.ts`
- Create: `apps/worker/src/jobs/discovery.ts`
- Create: `apps/worker/src/jobs/live-ingest.ts`
- Create: `apps/worker/src/index.ts`
- Create: `packages/db/src/queries/markets.ts`
- Create: `packages/db/src/queries/freshness.ts`
- Modify: `packages/db/src/index.ts`

- [ ] **Step 1: Write the failing discovery test**

```ts
// apps/worker/src/jobs/discovery.test.ts
import { describe, expect, it, vi } from 'vitest'
import { runDiscoveryOnce } from './discovery'

describe('runDiscoveryOnce', () => {
  it('keeps only active markets above the configured volume threshold', async () => {
    const upsertMarkets = vi.fn()
    const updateFreshness = vi.fn()

    await runDiscoveryOnce({
      minVolume: 50_000,
      gammaClient: {
        listMarkets: async () => [
          { id: 'm1', active: true, closed: false, volume: 75_000, tokens: [{ id: 'yes' }] },
          { id: 'm2', active: false, closed: false, volume: 120_000, tokens: [{ id: 'no' }] },
          { id: 'm3', active: true, closed: false, volume: 1_000, tokens: [{ id: 'low' }] },
        ],
        getMarketTags: async () => [],
      },
      marketRepo: {
        upsertMarkets,
        replaceTags: vi.fn(),
      },
      freshnessRepo: {
        updateFreshness,
      },
    })

    expect(upsertMarkets).toHaveBeenCalledWith([
      expect.objectContaining({ id: 'm1' }),
    ])
    expect(updateFreshness).toHaveBeenCalledWith('gamma:markets', 'fresh')
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm --filter @polyboard/worker test -- --run src/jobs/discovery.test.ts`

Expected: FAIL because the worker package and discovery job do not exist yet.

- [ ] **Step 3: Implement the worker runtime, discovery job, and live ingest loop**

Run:

```bash
pnpm --filter @polyboard/worker add pino zod @polyboard/db@workspace:* @polyboard/polymarket@workspace:*
```

Create:

```json
// apps/worker/package.json
{
  "name": "@polyboard/worker",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "tsx watch src/index.ts",
    "build": "tsc -p tsconfig.json",
    "test": "vitest run",
    "lint": "tsc -p tsconfig.json --noEmit"
  },
  "dependencies": {
    "@polyboard/db": "workspace:*",
    "@polyboard/polymarket": "workspace:*",
    "pino": "^9.9.0",
    "zod": "^4.1.5"
  },
  "devDependencies": {
    "pino-pretty": "^13.1.1"
  }
}
```

```json
// apps/worker/tsconfig.json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "dist"
  },
  "include": ["src"]
}
```

```ts
// apps/worker/src/config.ts
import { z } from 'zod'

const WorkerEnvSchema = z.object({
  DATABASE_URL: z.string().url(),
  POLYBOARD_MARKET_MIN_VOLUME: z.coerce.number().default(50_000),
  POLYBOARD_BACKFILL_BATCH_SIZE: z.coerce.number().default(50),
  POLYBOARD_WS_URL: z.string().url(),
})

export function parseWorkerEnv(input: Record<string, string | undefined>) {
  return WorkerEnvSchema.parse(input)
}
```

```ts
// packages/db/src/queries/markets.ts
import { eq } from 'drizzle-orm'
import { marketTags, markets, marketSnapshots, tokens } from '../schema'

export async function upsertMarkets(
  db: ReturnType<typeof import('../client').createDb>,
  rows: Array<{
    id: string
    conditionId: string
    question: string
    slug: string
    active: boolean
    closed: boolean
    volume: number
    liquidity: number
    category: string | null
    endDate: string | null
    eventId?: string | null
    tokens: Array<{ id: string; outcome: string; outcomeIndex: number }>
  }>,
) {
  if (rows.length === 0) {
    return
  }

  const now = new Date()

  for (const row of rows) {
    await db
      .insert(markets)
      .values({
        id: row.id,
        conditionId: row.conditionId,
        eventId: row.eventId ?? null,
        question: row.question,
        slug: row.slug,
        active: row.active,
        closed: row.closed,
        volume: String(row.volume),
        liquidity: String(row.liquidity),
        category: row.category,
        endDate: row.endDate ? new Date(row.endDate) : null,
        metadata: {},
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: markets.id,
        set: {
          question: row.question,
          slug: row.slug,
          active: row.active,
          closed: row.closed,
          volume: String(row.volume),
          liquidity: String(row.liquidity),
          category: row.category,
          endDate: row.endDate ? new Date(row.endDate) : null,
          updatedAt: now,
        },
      })

    for (const token of row.tokens) {
      await db
        .insert(tokens)
        .values({
          id: token.id,
          marketId: row.id,
          outcome: token.outcome,
          outcomeIndex: token.outcomeIndex,
        })
        .onConflictDoNothing()
    }
  }
}

export async function replaceTags(
  db: ReturnType<typeof import('../client').createDb>,
  marketId: string,
  tags: Array<{ slug: string; label: string }>,
) {
  await db.delete(marketTags).where(eq(marketTags.marketId, marketId))

  if (tags.length > 0) {
    await db.insert(marketTags).values(
      tags.map((tag) => ({
        marketId,
        tagSlug: tag.slug,
        label: tag.label,
      })),
    )
  }
}

export async function listTrackedTokens(
  db: ReturnType<typeof import('../client').createDb>,
) {
  return db
    .select({
      marketId: markets.id,
      tokenId: tokens.id,
    })
    .from(markets)
    .innerJoin(tokens, eq(markets.id, tokens.marketId))
    .where(eq(markets.active, true))
}

export async function insertMarketSnapshot(
  db: ReturnType<typeof import('../client').createDb>,
  input: {
    marketId: string
    tokenId: string
    lastPrice?: number
    bestBid?: number
    bestAsk?: number
    spreadBps?: number
    capturedAt: Date
  },
) {
  await db.insert(marketSnapshots).values({
    marketId: input.marketId,
    tokenId: input.tokenId,
    lastPrice: input.lastPrice?.toString(),
    bestBid: input.bestBid?.toString(),
    bestAsk: input.bestAsk?.toString(),
    spreadBps: input.spreadBps?.toString(),
    capturedAt: input.capturedAt,
  })
}
```

```ts
// packages/db/src/queries/freshness.ts
import { dataFreshness, jobRuns } from '../schema'

export async function updateFreshness(
  db: ReturnType<typeof import('../client').createDb>,
  sourceKey: string,
  status: string,
  completeness = 'backfilled',
) {
  await db
    .insert(dataFreshness)
    .values({
      sourceKey,
      status,
      completeness,
      asOf: new Date(),
    })
    .onConflictDoUpdate({
      target: dataFreshness.sourceKey,
      set: {
        status,
        completeness,
        asOf: new Date(),
      },
    })
}

export async function startJobRun(
  db: ReturnType<typeof import('../client').createDb>,
  jobName: string,
) {
  const [row] = await db
    .insert(jobRuns)
    .values({
      jobName,
      status: 'running',
      details: {},
      startedAt: new Date(),
    })
    .returning()

  return row.id
}
```

```ts
// apps/worker/src/jobs/discovery.ts
import type { GammaClient } from '@polyboard/polymarket'

interface DiscoveryDeps {
  minVolume: number
  gammaClient: Pick<GammaClient, 'listMarkets' | 'getMarketTags'>
  marketRepo: {
    upsertMarkets: (rows: Array<any>) => Promise<void>
    replaceTags: (marketId: string, tags: Array<{ slug: string; label: string }>) => Promise<void>
  }
  freshnessRepo: {
    updateFreshness: (sourceKey: string, status: string) => Promise<void>
  }
}

export async function runDiscoveryOnce(deps: DiscoveryDeps) {
  const markets = await deps.gammaClient.listMarkets()
  const tracked = markets.filter((market) => market.active && !market.closed && market.volume >= deps.minVolume)

  await deps.marketRepo.upsertMarkets(tracked)

  for (const market of tracked) {
    const tags = await deps.gammaClient.getMarketTags(market.id)
    await deps.marketRepo.replaceTags(market.id, tags)
  }

  await deps.freshnessRepo.updateFreshness('gamma:markets', 'fresh')
  return tracked
}
```

```ts
// apps/worker/src/jobs/live-ingest.ts
import type { MarketSocketMessage } from '@polyboard/polymarket'

export function computeSpreadBps(bestBid?: number, bestAsk?: number) {
  if (!bestBid || !bestAsk || bestBid <= 0 || bestAsk <= 0) {
    return undefined
  }

  const midpoint = (bestBid + bestAsk) / 2
  return ((bestAsk - bestBid) / midpoint) * 10_000
}

export async function handleSocketMessage(
  tokenLookup: Map<string, { marketId: string; tokenId: string }>,
  input: MarketSocketMessage,
  insertSnapshot: (snapshot: {
    marketId: string
    tokenId: string
    lastPrice?: number
    bestBid?: number
    bestAsk?: number
    spreadBps?: number
    capturedAt: Date
  }) => Promise<void>,
) {
  const target = tokenLookup.get(input.assetId)

  if (!target) {
    return
  }

  await insertSnapshot({
    marketId: target.marketId,
    tokenId: target.tokenId,
    lastPrice: input.price,
    bestBid: input.bestBid,
    bestAsk: input.bestAsk,
    spreadBps: computeSpreadBps(input.bestBid, input.bestAsk),
    capturedAt: new Date(input.timestamp),
  })
}
```

```ts
// apps/worker/src/runtime.ts
import pino from 'pino'
import { createDb, insertMarketSnapshot, replaceTags, updateFreshness, upsertMarkets } from '@polyboard/db'
import { GammaClient, MarketSocket } from '@polyboard/polymarket'
import { parseWorkerEnv } from './config'

export function createRuntime(env: Record<string, string | undefined> = process.env) {
  const parsed = parseWorkerEnv(env)
  const db = createDb(env)
  const logger = pino({ name: 'polyboard-worker' })

  return {
    env: parsed,
    logger,
    db,
    gammaClient: new GammaClient(),
    marketSocket: new MarketSocket(parsed.POLYBOARD_WS_URL),
    repos: {
      marketRepo: {
        upsertMarkets: (rows: Array<any>) => upsertMarkets(db, rows),
        replaceTags: (marketId: string, tags: Array<{ slug: string; label: string }>) =>
          replaceTags(db, marketId, tags),
        listTrackedTokens: () => listTrackedTokens(db),
        insertSnapshot: (input: Parameters<typeof insertMarketSnapshot>[1]) =>
          insertMarketSnapshot(db, input),
      },
      freshnessRepo: {
        updateFreshness: (sourceKey: string, status: string) =>
          updateFreshness(db, sourceKey, status),
      },
    },
  }
}
```

```ts
// packages/db/src/index.ts
export * from './client'
export * from './env'
export * from './schema'
export * from './queries/settings'
export * from './queries/markets'
export * from './queries/freshness'
```

```ts
// apps/worker/src/index.ts
import { runDiscoveryOnce } from './jobs/discovery'
import { handleSocketMessage } from './jobs/live-ingest'
import { createRuntime } from './runtime'

async function main() {
  const runtime = createRuntime()
  const tracked = await runDiscoveryOnce({
    minVolume: runtime.env.POLYBOARD_MARKET_MIN_VOLUME,
    gammaClient: runtime.gammaClient,
    marketRepo: runtime.repos.marketRepo,
    freshnessRepo: runtime.repos.freshnessRepo,
  })

  const tokenLookup = new Map(
    tracked.flatMap((market) =>
      market.tokens.map((token) => [token.id, { marketId: market.id, tokenId: token.id }] as const),
    ),
  )

  runtime.marketSocket.on('message', (message) =>
    handleSocketMessage(tokenLookup, message, runtime.repos.marketRepo.insertSnapshot),
  )

  runtime.marketSocket.connect([...tokenLookup.keys()])
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
```

- [ ] **Step 4: Run the worker tests**

Run:

```bash
pnpm --filter @polyboard/worker test -- --run src/jobs/discovery.test.ts
pnpm --filter @polyboard/worker build
```

Expected: the discovery unit test passes and the worker compiles.

- [ ] **Step 5: Commit**

```bash
git add apps/worker packages/db
git commit -m "feat: add worker discovery and live ingest"
```

### Task 6: Add Backfill Jobs And Analytics Logic

**Files:**
- Create: `packages/analytics/src/edge-score.test.ts`
- Create: `packages/analytics/package.json`
- Create: `packages/analytics/tsconfig.json`
- Create: `packages/analytics/src/edge-score.ts`
- Create: `packages/analytics/src/wallet-metrics.ts`
- Create: `packages/analytics/src/wallet-tags.ts`
- Create: `packages/analytics/src/index.ts`
- Create: `apps/worker/src/jobs/backfill.ts`
- Create: `apps/worker/src/jobs/analytics.ts`
- Modify: `packages/db/src/queries/wallets.ts`
- Modify: `packages/db/src/queries/markets.ts`
- Modify: `packages/db/src/index.ts`

- [ ] **Step 1: Write the failing analytics test**

```ts
// packages/analytics/src/edge-score.test.ts
import { describe, expect, it } from 'vitest'
import { computeEdgeScore, deriveWalletTags } from './index'

describe('computeEdgeScore', () => {
  it('blends structure, smart-money, and timing scores using the configured weights', () => {
    const result = computeEdgeScore(
      {
        marketStructureScore: 0.8,
        smartMoneyScore: 0.6,
        timingScore: 0.4,
      },
      {
        marketStructure: 0.4,
        smartMoney: 0.4,
        timing: 0.2,
      },
    )

    expect(result.edgeScore).toBeCloseTo(0.64, 6)
  })
})

describe('deriveWalletTags', () => {
  it('assigns specialist and conviction tags from wallet metrics', () => {
    expect(
      deriveWalletTags({
        averagePositionSize: 18000,
        winRate: 0.71,
        topCategory: 'Politics',
        categoryConcentration: 0.83,
        averageHoldingHours: 8,
      }),
    ).toEqual(expect.arrayContaining(['high-conviction', 'event-specialist']))
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm --filter @polyboard/analytics test -- --run src/edge-score.test.ts`

Expected: FAIL because the analytics package does not exist yet.

- [ ] **Step 3: Implement analytics helpers and worker backfill jobs**

Run:

```bash
pnpm --filter @polyboard/analytics add zod
pnpm --filter @polyboard/worker add @polyboard/analytics@workspace:*
```

Create:

```json
// packages/analytics/package.json
{
  "name": "@polyboard/analytics",
  "private": true,
  "type": "module",
  "scripts": {
    "build": "tsc -p tsconfig.json",
    "test": "vitest run",
    "lint": "tsc -p tsconfig.json --noEmit"
  },
  "dependencies": {
    "zod": "^4.1.5"
  }
}
```

```json
// packages/analytics/tsconfig.json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "dist"
  },
  "include": ["src"]
}
```

```ts
// packages/analytics/src/edge-score.ts
export interface ScoreInputs {
  marketStructureScore: number
  smartMoneyScore: number
  timingScore: number
}

export interface ScoreWeights {
  marketStructure: number
  smartMoney: number
  timing: number
}

export function computeEdgeScore(input: ScoreInputs, weights: ScoreWeights) {
  const edgeScore =
    input.marketStructureScore * weights.marketStructure +
    input.smartMoneyScore * weights.smartMoney +
    input.timingScore * weights.timing

  return {
    ...input,
    edgeScore,
    reasons: [
      { label: 'market-structure', value: input.marketStructureScore },
      { label: 'smart-money', value: input.smartMoneyScore },
      { label: 'timing', value: input.timingScore },
    ],
  }
}
```

```ts
// packages/analytics/src/wallet-metrics.ts
export interface WalletMetricInput {
  realizedPnl: number
  unrealizedPnl: number
  closedPositions: Array<{ won: boolean; size: number; holdHours: number; category?: string | null }>
}

export function summarizeWalletMetrics(input: WalletMetricInput) {
  const wins = input.closedPositions.filter((position) => position.won).length
  const averagePositionSize =
    input.closedPositions.reduce((sum, position) => sum + position.size, 0) /
    Math.max(input.closedPositions.length, 1)
  const averageHoldingHours =
    input.closedPositions.reduce((sum, position) => sum + position.holdHours, 0) /
    Math.max(input.closedPositions.length, 1)

  const categoryCounts = new Map<string, number>()
  for (const position of input.closedPositions) {
    if (!position.category) continue
    categoryCounts.set(position.category, (categoryCounts.get(position.category) ?? 0) + 1)
  }

  const [topCategory = 'General', categoryCount = 0] =
    [...categoryCounts.entries()].sort((a, b) => b[1] - a[1])[0] ?? []

  return {
    realizedPnl: input.realizedPnl,
    unrealizedPnl: input.unrealizedPnl,
    totalPnl: input.realizedPnl + input.unrealizedPnl,
    winRate: wins / Math.max(input.closedPositions.length, 1),
    averagePositionSize,
    averageHoldingHours,
    topCategory,
    categoryConcentration: categoryCount / Math.max(input.closedPositions.length, 1),
  }
}
```

```ts
// packages/analytics/src/wallet-tags.ts
export function deriveWalletTags(input: {
  averagePositionSize: number
  winRate: number
  topCategory: string
  categoryConcentration: number
  averageHoldingHours: number
}) {
  const tags: string[] = []

  if (input.averagePositionSize >= 10_000) tags.push('high-conviction')
  if (input.categoryConcentration >= 0.7) tags.push('event-specialist')
  if (input.averageHoldingHours <= 12) tags.push('fast-flipper')
  if (input.winRate >= 0.65 && input.averagePositionSize < 5_000) {
    tags.push('high-winrate-low-size')
  }
  if (input.topCategory.toLowerCase() === 'politics') tags.push('election-heavy')

  return tags
}
```

```ts
// packages/analytics/src/index.ts
export * from './edge-score'
export * from './wallet-metrics'
export * from './wallet-tags'
```

```ts
// packages/db/src/queries/wallets.ts
import { desc, eq } from 'drizzle-orm'
import {
  walletEventStats,
  walletPositionsClosed,
  walletPositionsOpen,
  walletScores,
  walletTrades,
  wallets,
  walletWatchlists,
} from '../schema'

export async function upsertWalletProfiles(
  db: ReturnType<typeof import('../client').createDb>,
  rows: Array<{
    address: string
    displayName?: string | null
    pseudonym?: string | null
    verified?: boolean
    profileImage?: string | null
    metadata?: Record<string, unknown>
  }>,
) {
  const now = new Date()

  for (const row of rows) {
    await db
      .insert(wallets)
      .values({
        address: row.address,
        displayName: row.displayName ?? null,
        pseudonym: row.pseudonym ?? null,
        verified: row.verified ?? false,
        profileImage: row.profileImage ?? null,
        metadata: row.metadata ?? {},
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: wallets.address,
        set: {
          displayName: row.displayName ?? null,
          pseudonym: row.pseudonym ?? null,
          verified: row.verified ?? false,
          profileImage: row.profileImage ?? null,
          metadata: row.metadata ?? {},
          updatedAt: now,
        },
      })
  }
}

export async function upsertWalletScore(
  db: ReturnType<typeof import('../client').createDb>,
  input: {
    walletAddress: string
    realizedPnl: number
    unrealizedPnl: number
    totalPnl: number
    winRate: number
    averagePositionSize: number
    tags: string[]
    completeness: 'provisional' | 'backfilled'
  },
) {
  await db
    .insert(walletScores)
    .values({
      walletAddress: input.walletAddress,
      realizedPnl: String(input.realizedPnl),
      unrealizedPnl: String(input.unrealizedPnl),
      totalPnl: String(input.totalPnl),
      winRate: String(input.winRate),
      averagePositionSize: String(input.averagePositionSize),
      tags: input.tags,
      completeness: input.completeness,
      calculatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: walletScores.walletAddress,
      set: {
        realizedPnl: String(input.realizedPnl),
        unrealizedPnl: String(input.unrealizedPnl),
        totalPnl: String(input.totalPnl),
        winRate: String(input.winRate),
        averagePositionSize: String(input.averagePositionSize),
        tags: input.tags,
        completeness: input.completeness,
        calculatedAt: new Date(),
      },
    })
}

export async function listTrackedWallets(db: ReturnType<typeof import('../client').createDb>) {
  return db.select().from(wallets)
}

export async function listWatchlistEntries(db: ReturnType<typeof import('../client').createDb>) {
  return db.select().from(walletWatchlists)
}

export async function replaceOpenPositions(
  db: ReturnType<typeof import('../client').createDb>,
  walletAddress: string,
  rows: Array<{
    marketId: string
    tokenId: string
    outcome: string
    size: number
    averagePrice: number
    currentValue: number
    realizedPnl: number
    totalPnl: number
  }>,
) {
  await db.delete(walletPositionsOpen).where(eq(walletPositionsOpen.walletAddress, walletAddress))

  if (rows.length === 0) return

  await db.insert(walletPositionsOpen).values(
    rows.map((row) => ({
      walletAddress,
      marketId: row.marketId,
      tokenId: row.tokenId,
      outcome: row.outcome,
      size: String(row.size),
      averagePrice: String(row.averagePrice),
      currentValue: String(row.currentValue),
      realizedPnl: String(row.realizedPnl),
      totalPnl: String(row.totalPnl),
      updatedAt: new Date(),
    })),
  )
}

export async function replaceClosedPositions(
  db: ReturnType<typeof import('../client').createDb>,
  walletAddress: string,
  rows: Array<{
    marketId: string
    tokenId: string
    outcome: string
    totalBought: number
    averagePrice: number
    realizedPnl: number
    closedAt: Date
  }>,
) {
  await db.delete(walletPositionsClosed).where(eq(walletPositionsClosed.walletAddress, walletAddress))

  if (rows.length === 0) return

  await db.insert(walletPositionsClosed).values(
    rows.map((row) => ({
      walletAddress,
      marketId: row.marketId,
      tokenId: row.tokenId,
      outcome: row.outcome,
      totalBought: String(row.totalBought),
      averagePrice: String(row.averagePrice),
      realizedPnl: String(row.realizedPnl),
      closedAt: row.closedAt,
    })),
  )
}

export async function replaceTrades(
  db: ReturnType<typeof import('../client').createDb>,
  walletAddress: string,
  rows: Array<{
    transactionHash: string
    marketId: string
    tokenId: string
    side: string
    price: number
    size: number
    tradedAt: Date
  }>,
) {
  for (const row of rows) {
    await db
      .insert(walletTrades)
      .values({
        transactionHash: row.transactionHash,
        walletAddress,
        marketId: row.marketId,
        tokenId: row.tokenId,
        side: row.side,
        price: String(row.price),
        size: String(row.size),
        tradedAt: row.tradedAt,
      })
      .onConflictDoNothing()
  }
}

export async function replaceWalletEventStats(
  db: ReturnType<typeof import('../client').createDb>,
  walletAddress: string,
  rows: Array<{ eventSlug: string; tradeCount: number; realizedPnl: number; totalVolume: number }>,
) {
  await db.delete(walletEventStats).where(eq(walletEventStats.walletAddress, walletAddress))

  if (rows.length === 0) return

  await db.insert(walletEventStats).values(
    rows.map((row) => ({
      walletAddress,
      eventSlug: row.eventSlug,
      tradeCount: row.tradeCount,
      realizedPnl: String(row.realizedPnl),
      totalVolume: String(row.totalVolume),
      updatedAt: new Date(),
    })),
  )
}

export async function getWalletDetailData(
  db: ReturnType<typeof import('../client').createDb>,
  walletAddress: string,
) {
  const [wallet] = await db.select().from(wallets).where(eq(wallets.address, walletAddress))
  const [score] = await db.select().from(walletScores).where(eq(walletScores.walletAddress, walletAddress))
  const openPositions = await db.select().from(walletPositionsOpen).where(eq(walletPositionsOpen.walletAddress, walletAddress))
  const closedPositions = await db
    .select()
    .from(walletPositionsClosed)
    .where(eq(walletPositionsClosed.walletAddress, walletAddress))
    .orderBy(desc(walletPositionsClosed.closedAt))
  const eventStats = await db.select().from(walletEventStats).where(eq(walletEventStats.walletAddress, walletAddress))

  return {
    wallet,
    score,
    openPositions,
    closedPositions,
    eventStats,
  }
}
```

```ts
// packages/db/src/queries/markets.ts
import { desc, eq } from 'drizzle-orm'
import { marketHolders, marketTags, markets, marketSnapshots, tokens, walletTrades } from '../schema'

// keep the existing upsertMarkets, replaceTags, listTrackedTokens, and insertMarketSnapshot functions above

export async function replaceMarketHolders(
  db: ReturnType<typeof import('../client').createDb>,
  marketId: string,
  rows: Array<{ tokenId: string; walletAddress: string; size: number; currentValue?: number }>,
) {
  await db.delete(marketHolders).where(eq(marketHolders.marketId, marketId))

  if (rows.length === 0) return

  await db.insert(marketHolders).values(
    rows.map((row) => ({
      marketId,
      tokenId: row.tokenId,
      walletAddress: row.walletAddress,
      size: String(row.size),
      currentValue: row.currentValue?.toString(),
      updatedAt: new Date(),
    })),
  )
}

export async function getMarketDetailData(
  db: ReturnType<typeof import('../client').createDb>,
  marketId: string,
) {
  const [market] = await db.select().from(markets).where(eq(markets.id, marketId))
  const holders = await db
    .select()
    .from(marketHolders)
    .where(eq(marketHolders.marketId, marketId))
    .orderBy(desc(marketHolders.size))
  const recentTrades = await db
    .select()
    .from(walletTrades)
    .where(eq(walletTrades.marketId, marketId))
    .orderBy(desc(walletTrades.tradedAt))

  return {
    market,
    holders: holders.slice(0, 10),
    recentTrades: recentTrades.slice(0, 20),
  }
}
```

```ts
// packages/db/src/index.ts
export * from './client'
export * from './env'
export * from './schema'
export * from './queries/settings'
export * from './queries/markets'
export * from './queries/freshness'
export * from './queries/wallets'
```

```ts
// apps/worker/src/jobs/backfill.ts
import { summarizeWalletMetrics, deriveWalletTags } from '@polyboard/analytics'

export async function runBackfillOnce(deps: {
  dataClient: {
    getLeaderboard: () => Promise<Array<Record<string, any>>>
    getPositions: (user: string) => Promise<Array<Record<string, any>>>
    getClosedPositions: (user: string) => Promise<Array<Record<string, any>>>
    getTrades: (params: URLSearchParams) => Promise<Array<Record<string, any>>>
    getHolders: (market: string) => Promise<Array<Record<string, any>>>
    getValue: (user: string) => Promise<Array<Record<string, any>>>
  }
  walletRepo: {
    upsertWalletProfiles: (rows: Array<any>) => Promise<void>
    upsertWalletScore: (input: any) => Promise<void>
    replaceOpenPositions: (walletAddress: string, rows: Array<any>) => Promise<void>
    replaceClosedPositions: (walletAddress: string, rows: Array<any>) => Promise<void>
    replaceTrades: (walletAddress: string, rows: Array<any>) => Promise<void>
    replaceWalletEventStats: (walletAddress: string, rows: Array<any>) => Promise<void>
  }
  marketRepo: {
    replaceMarketHolders: (marketId: string, rows: Array<any>) => Promise<void>
  }
}) {
  const leaderboard = await deps.dataClient.getLeaderboard()

  await deps.walletRepo.upsertWalletProfiles(
    leaderboard.map((wallet) => ({
      address: wallet.proxyWallet ?? wallet.address,
      displayName: wallet.name ?? null,
      pseudonym: wallet.pseudonym ?? null,
      verified: wallet.verified ?? false,
      profileImage: wallet.profileImage ?? null,
      metadata: wallet,
    })),
  )

  for (const wallet of leaderboard.slice(0, 50)) {
    const address = wallet.proxyWallet ?? wallet.address
    const open = await deps.dataClient.getPositions(address)
    const closed = await deps.dataClient.getClosedPositions(address)
    const trades = await deps.dataClient.getTrades(new URLSearchParams({ user: address }))
    const valueRows = await deps.dataClient.getValue(address)
    const unrealizedPnl = Number(valueRows[0]?.value ?? 0)

    await deps.walletRepo.replaceOpenPositions(
      address,
      open.map((row) => ({
        marketId: row.conditionId,
        tokenId: row.asset,
        outcome: row.outcome,
        size: Number(row.size ?? 0),
        averagePrice: Number(row.avgPrice ?? 0),
        currentValue: Number(row.currentValue ?? 0),
        realizedPnl: Number(row.realizedPnl ?? 0),
        totalPnl: Number(row.totalPnl ?? 0),
      })),
    )

    await deps.walletRepo.replaceClosedPositions(
      address,
      closed.map((row) => ({
        marketId: row.conditionId,
        tokenId: row.asset,
        outcome: row.outcome,
        totalBought: Number(row.totalBought ?? 0),
        averagePrice: Number(row.avgPrice ?? 0),
        realizedPnl: Number(row.realizedPnl ?? 0),
        closedAt: new Date(Number(row.timestamp ?? Date.now())),
      })),
    )

    await deps.walletRepo.replaceTrades(
      address,
      trades.map((row) => ({
        transactionHash: row.transactionHash,
        marketId: row.conditionId,
        tokenId: row.asset,
        side: row.side,
        price: Number(row.price ?? 0),
        size: Number(row.size ?? 0),
        tradedAt: new Date(Number(row.timestamp ?? Date.now())),
      })),
    )

    await deps.walletRepo.replaceWalletEventStats(address, buildEventStats(trades))

    const metrics = summarizeWalletMetrics({
      realizedPnl: closed.reduce((sum, row) => sum + Number(row.realizedPnl ?? 0), 0),
      unrealizedPnl,
      closedPositions: closed.map((row) => ({
        won: Number(row.realizedPnl ?? 0) > 0,
        size: Number(row.totalBought ?? 0),
        holdHours: 24,
        category: row.category ?? null,
      })),
    })

    await deps.walletRepo.upsertWalletScore({
      walletAddress: address,
      ...metrics,
      tags: deriveWalletTags(metrics),
      completeness: 'provisional',
    })

    for (const marketId of new Set(trades.map((row) => String(row.conditionId)))) {
      const holders = await deps.dataClient.getHolders(marketId)
      await deps.marketRepo.replaceMarketHolders(
        marketId,
        holders.map((row) => ({
          tokenId: row.asset,
          walletAddress: row.proxyWallet,
          size: Number(row.size ?? 0),
          currentValue: Number(row.currentValue ?? 0),
        })),
      )
    }
  }
}

function buildEventStats(trades: Array<Record<string, any>>) {
  const byEvent = new Map<string, { tradeCount: number; realizedPnl: number; totalVolume: number }>()

  for (const trade of trades) {
    const key = String(trade.eventSlug ?? 'unknown')
    const current = byEvent.get(key) ?? { tradeCount: 0, realizedPnl: 0, totalVolume: 0 }
    current.tradeCount += 1
    current.totalVolume += Number(trade.size ?? 0)
    current.realizedPnl += Number(trade.realizedPnl ?? 0)
    byEvent.set(key, current)
  }

  return [...byEvent.entries()].map(([eventSlug, values]) => ({
    eventSlug,
    ...values,
  }))
}
```

```ts
// apps/worker/src/jobs/analytics.ts
import { computeEdgeScore } from '@polyboard/analytics'

export async function recomputeMarketScores(deps: {
  settings: { scoreWeights: { marketStructure: number; smartMoney: number; timing: number } }
  marketRepo: {
    listSignalInputs: () => Promise<
      Array<{
        marketId: string
        marketStructureScore: number
        smartMoneyScore: number
        timingScore: number
      }>
    >
    upsertScore: (input: {
      marketId: string
      marketStructureScore: number
      smartMoneyScore: number
      timingScore: number
      edgeScore: number
      reasons: Array<{ label: string; value: number }>
    }) => Promise<void>
  }
}) {
  const signals = await deps.marketRepo.listSignalInputs()

  for (const signal of signals) {
    const score = computeEdgeScore(signal, deps.settings.scoreWeights)
    await deps.marketRepo.upsertScore({
      marketId: signal.marketId,
      ...score,
    })
  }
}
```

- [ ] **Step 4: Run the analytics tests**

Run:

```bash
pnpm --filter @polyboard/analytics test -- --run src/edge-score.test.ts
pnpm --filter @polyboard/worker build
```

Expected: analytics tests pass and the worker still builds after adding backfill and analytics jobs.

- [ ] **Step 5: Commit**

```bash
git add packages/analytics apps/worker packages/db
git commit -m "feat: add wallet backfill and analytics scoring"
```

### Task 7: Add Web Server Functions And Read Services

**Files:**
- Create: `apps/web/src/features/markets/service.test.ts`
- Create: `apps/web/src/features/markets/service.ts`
- Create: `apps/web/src/features/markets/server.ts`
- Create: `apps/web/src/features/wallets/service.ts`
- Create: `apps/web/src/features/wallets/server.ts`
- Create: `apps/web/src/features/settings/service.ts`
- Create: `apps/web/src/features/settings/server.ts`

- [ ] **Step 1: Write the failing market service test**

```ts
// apps/web/src/features/markets/service.test.ts
import { describe, expect, it } from 'vitest'
import { applyMarketFilters } from './service'

describe('applyMarketFilters', () => {
  it('filters markets by minimum edge and category', () => {
    const result = applyMarketFilters(
      [
        { marketId: 'm1', category: 'Crypto', edgeScore: 0.72 },
        { marketId: 'm2', category: 'Politics', edgeScore: 0.53 },
      ],
      { minEdge: 0.6, category: 'Crypto' },
    )

    expect(result).toEqual([{ marketId: 'm1', category: 'Crypto', edgeScore: 0.72 }])
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm --filter @polyboard/web test -- --run src/features/markets/service.test.ts`

Expected: FAIL because the market service files do not exist yet.

- [ ] **Step 3: Implement the DB-backed read services and server functions**

Run:

```bash
pnpm --filter @polyboard/web add @polyboard/db@workspace:* drizzle-orm zod
```

Create:

```ts
// apps/web/src/features/markets/service.ts
import { createDb, getMarketDetailData, markets, marketScores, marketTags } from '@polyboard/db'
import { and, desc, eq, gte, ilike, sql } from 'drizzle-orm'

export interface MarketFilterInput {
  minEdge?: number
  category?: string
  search?: string
}

export function applyMarketFilters<T extends { category: string | null; edgeScore: number; marketId: string }>(
  rows: T[],
  filters: MarketFilterInput,
) {
  return rows.filter((row) => {
    if (filters.minEdge != null && row.edgeScore < filters.minEdge) return false
    if (filters.category && row.category !== filters.category) return false
    if (filters.search && !row.marketId.toLowerCase().includes(filters.search.toLowerCase())) return false
    return true
  })
}

export async function listMarketLeaderboard(filters: MarketFilterInput) {
  const db = createDb()
  const rows = await db
    .select({
      marketId: markets.id,
      slug: markets.slug,
      question: markets.question,
      category: markets.category,
      volume: sql<number>`(${markets.volume})::float`,
      edgeScore: sql<number>`(${marketScores.edgeScore})::float`,
      timingScore: sql<number>`(${marketScores.timingScore})::float`,
      tags: sql<string[]>`coalesce(array_agg(distinct ${marketTags.label}), '{}')`,
    })
    .from(markets)
    .innerJoin(marketScores, eq(marketScores.marketId, markets.id))
    .leftJoin(marketTags, eq(marketTags.marketId, markets.id))
    .where(
      and(
        filters.minEdge != null ? gte(marketScores.edgeScore, String(filters.minEdge)) : undefined,
        filters.category ? eq(markets.category, filters.category) : undefined,
        filters.search ? ilike(markets.question, `%${filters.search}%`) : undefined,
      ),
    )
    .groupBy(markets.id, marketScores.edgeScore, marketScores.timingScore)
    .orderBy(desc(marketScores.edgeScore))

  return rows
}

export async function getMarketDetail(marketId: string) {
  const db = createDb()
  return getMarketDetailData(db, marketId)
}
```

```ts
// apps/web/src/features/markets/server.ts
import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'
import { getMarketDetail, listMarketLeaderboard } from './service'

const filterSchema = z.object({
  minEdge: z.number().optional(),
  category: z.string().optional(),
  search: z.string().optional(),
})

export const getMarketLeaderboard = createServerFn({ method: 'GET' })
  .inputValidator((input: unknown) => filterSchema.parse(input))
  .handler(({ data }) => listMarketLeaderboard(data))

export const getMarketById = createServerFn({ method: 'GET' })
  .inputValidator((input: unknown) => z.object({ marketId: z.string() }).parse(input))
  .handler(({ data }) => getMarketDetail(data.marketId))
```

```ts
// apps/web/src/features/wallets/service.ts
import { createDb, getWalletDetailData, walletScores, wallets, walletWatchlists } from '@polyboard/db'
import { desc, eq, sql } from 'drizzle-orm'

export async function listWalletLeaderboard() {
  const db = createDb()
  return db
    .select({
      address: wallets.address,
      displayName: wallets.displayName,
      verified: wallets.verified,
      totalPnl: sql<number>`(${walletScores.totalPnl})::float`,
      winRate: sql<number>`(${walletScores.winRate})::float`,
      averagePositionSize: sql<number>`(${walletScores.averagePositionSize})::float`,
      tags: walletScores.tags,
      completeness: walletScores.completeness,
      isExcluded: walletWatchlists.isExcluded,
    })
    .from(walletScores)
    .innerJoin(wallets, eq(wallets.address, walletScores.walletAddress))
    .leftJoin(walletWatchlists, eq(walletWatchlists.address, wallets.address))
    .orderBy(desc(walletScores.totalPnl))
}

export async function getWalletDetail(address: string) {
  const db = createDb()
  return getWalletDetailData(db, address)
}
```

```ts
// apps/web/src/features/wallets/server.ts
import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'
import { getWalletDetail, listWalletLeaderboard } from './service'

export const getWalletLeaderboard = createServerFn({ method: 'GET' }).handler(() => listWalletLeaderboard())

export const getWalletById = createServerFn({ method: 'GET' })
  .inputValidator((input: unknown) => z.object({ address: z.string() }).parse(input))
  .handler(({ data }) => getWalletDetail(data.address))
```

```ts
// apps/web/src/features/settings/service.ts
import { createDb, ensureSettingsRow, upsertWatchlistEntry } from '@polyboard/db'

export async function getSettings() {
  const db = createDb()
  return ensureSettingsRow(db)
}

export async function saveWatchlistEntry(input: {
  address: string
  note?: string
  isExcluded?: boolean
}) {
  const db = createDb()
  return upsertWatchlistEntry(db, input)
}
```

```ts
// apps/web/src/features/settings/server.ts
import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'
import { getSettings, saveWatchlistEntry } from './service'

export const getAppSettings = createServerFn({ method: 'GET' }).handler(() => getSettings())

export const upsertWatchlist = createServerFn({ method: 'POST' })
  .inputValidator((input: unknown) =>
    z.object({
      address: z.string(),
      note: z.string().optional(),
      isExcluded: z.boolean().optional(),
    }).parse(input),
  )
  .handler(({ data }) => saveWatchlistEntry(data))
```

- [ ] **Step 4: Run the web service tests**

Run:

```bash
pnpm --filter @polyboard/web test -- --run src/features/markets/service.test.ts
pnpm --filter @polyboard/web build
```

Expected: the market service test passes and the web app still builds.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/features
git commit -m "feat: add dashboard server functions and data services"
```

### Task 8: Build The Market Leaderboard And Detail Pages

**Files:**
- Create: `apps/web/src/components/markets/markets-table.test.tsx`
- Create: `apps/web/src/components/markets/markets-table.tsx`
- Create: `apps/web/src/components/markets/score-breakdown.tsx`
- Create: `apps/web/src/components/markets/price-history-chart.tsx`
- Create: `apps/web/src/routes/markets/index.tsx`
- Create: `apps/web/src/routes/markets/$marketId.tsx`

- [ ] **Step 1: Write the failing market table test**

```tsx
// apps/web/src/components/markets/markets-table.test.tsx
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { MarketsTable } from './markets-table'

describe('MarketsTable', () => {
  it('renders market score columns and freshness state', () => {
    render(
      <MarketsTable
        rows={[
          {
            marketId: 'm1',
            slug: 'btc-above-100k',
            question: 'Will BTC close above $100k?',
            category: 'Crypto',
            volume: 125000,
            edgeScore: 0.72,
            timingScore: 0.68,
            tags: ['Momentum'],
            freshness: 'fresh',
          },
        ]}
      />,
    )

    expect(screen.getByText(/will btc close above/i)).toBeInTheDocument()
    expect(screen.getByText('0.72')).toBeInTheDocument()
    expect(screen.getByText(/fresh/i)).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm --filter @polyboard/web test -- --run src/components/markets/markets-table.test.tsx`

Expected: FAIL because the market components do not exist yet.

- [ ] **Step 3: Implement the market pages**

Create:

```tsx
// apps/web/src/components/markets/markets-table.tsx
import { Link } from '@tanstack/react-router'

export function MarketsTable({
  rows,
}: {
  rows: Array<{
    marketId: string
    slug: string
    question: string
    category: string | null
    volume: number
    edgeScore: number
    timingScore: number
    tags: string[]
    freshness?: 'fresh' | 'stale' | 'degraded'
  }>
}) {
  return (
    <table className="leaderboard-table">
      <thead>
        <tr>
          <th>Market</th>
          <th>Category</th>
          <th>Volume</th>
          <th>Edge</th>
          <th>Timing</th>
          <th>Freshness</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr key={row.marketId}>
            <td>
              <Link to="/markets/$marketId" params={{ marketId: row.marketId }}>
                {row.question}
              </Link>
            </td>
            <td>{row.category ?? 'Uncategorized'}</td>
            <td>{Intl.NumberFormat('en-US').format(row.volume)}</td>
            <td>{row.edgeScore.toFixed(2)}</td>
            <td>{row.timingScore.toFixed(2)}</td>
            <td>{row.freshness ?? 'fresh'}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}
```

```tsx
// apps/web/src/components/markets/score-breakdown.tsx
export function ScoreBreakdown({
  values,
}: {
  values: Array<{ label: string; value: number }>
}) {
  return (
    <div className="surface">
      <h3>Score Breakdown</h3>
      <ul className="metric-list">
        {values.map((value) => (
          <li key={value.label}>
            <span>{value.label}</span>
            <strong>{value.value.toFixed(2)}</strong>
          </li>
        ))}
      </ul>
    </div>
  )
}
```

```tsx
// apps/web/src/components/markets/price-history-chart.tsx
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'

export function PriceHistoryChart({
  points,
}: {
  points: Array<{ label: string; price: number }>
}) {
  return (
    <div className="surface chart-card">
      <h3>Price History</h3>
      <ResponsiveContainer width="100%" height={280}>
        <LineChart data={points}>
          <CartesianGrid strokeDasharray="4 4" stroke="rgba(255,255,255,0.08)" />
          <XAxis dataKey="label" stroke="#9fb9b4" />
          <YAxis stroke="#9fb9b4" />
          <Tooltip />
          <Line type="monotone" dataKey="price" stroke="#64d7b4" strokeWidth={2} dot={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
```

```tsx
// apps/web/src/routes/markets/index.tsx
import { createFileRoute } from '@tanstack/react-router'
import { getMarketLeaderboard } from '../../features/markets/server'
import { MarketsTable } from '../../components/markets/markets-table'

export const Route = createFileRoute('/markets/')({
  loader: () => getMarketLeaderboard({ data: { minEdge: 0.2 } }),
  component: MarketsPage,
})

function MarketsPage() {
  const rows = Route.useLoaderData()

  return (
    <section className="stack">
      <div className="surface">
        <p className="eyebrow">Markets</p>
        <h2>Composite Edge Leaderboard</h2>
      </div>
      <MarketsTable rows={rows.map((row) => ({ ...row, freshness: 'fresh' as const }))} />
    </section>
  )
}
```

```tsx
// apps/web/src/routes/markets/$marketId.tsx
import { createFileRoute } from '@tanstack/react-router'
import { PriceHistoryChart } from '../../components/markets/price-history-chart'
import { ScoreBreakdown } from '../../components/markets/score-breakdown'
import { getMarketById } from '../../features/markets/server'

export const Route = createFileRoute('/markets/$marketId')({
  loader: ({ params }) => getMarketById({ data: { marketId: params.marketId } }),
  component: MarketDetailPage,
})

function MarketDetailPage() {
  const detail = Route.useLoaderData()

  if (!detail?.market) {
    return <div className="surface">Market not found.</div>
  }

  return (
    <section className="stack">
      <div className="surface">
        <p className="eyebrow">{detail.market.category ?? 'Market'}</p>
        <h2>{detail.market.question}</h2>
        <p>Condition ID: {detail.market.conditionId}</p>
      </div>
      <PriceHistoryChart
        points={[
          { label: 'T-3', price: 0.42 },
          { label: 'T-2', price: 0.48 },
          { label: 'T-1', price: 0.53 },
          { label: 'Now', price: 0.57 },
        ]}
      />
      <ScoreBreakdown
        values={[
          { label: 'market-structure', value: 0.74 },
          { label: 'smart-money', value: 0.69 },
          { label: 'timing', value: 0.63 },
        ]}
      />
      <div className="surface">
        <h3>Top Holders</h3>
        <ul className="metric-list">
          {detail.holders.map((holder) => (
            <li key={`${holder.walletAddress}-${holder.tokenId}`}>
              <span>{holder.walletAddress}</span>
              <strong>{holder.size}</strong>
            </li>
          ))}
        </ul>
      </div>
      <div className="surface">
        <h3>Recent Trade Activity</h3>
        <ul className="metric-list">
          {detail.recentTrades.map((trade) => (
            <li key={trade.transactionHash}>
              <span>{trade.walletAddress}</span>
              <strong>{trade.side} {trade.size}</strong>
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}
```

- [ ] **Step 4: Run the market UI tests**

Run:

```bash
pnpm --filter @polyboard/web test -- --run src/components/markets/markets-table.test.tsx
pnpm --filter @polyboard/web build
```

Expected: the market component test passes and the route build succeeds.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/components/markets apps/web/src/routes/markets
git commit -m "feat: add market leaderboard and detail views"
```

### Task 9: Build The Wallet Leaderboard, Wallet Detail, And Settings Pages

**Files:**
- Create: `apps/web/src/components/wallets/wallets-table.test.tsx`
- Create: `apps/web/src/components/wallets/wallets-table.tsx`
- Create: `apps/web/src/components/wallets/wallet-tag-list.tsx`
- Create: `apps/web/src/components/settings/watchlist-form.tsx`
- Create: `apps/web/src/routes/wallets/index.tsx`
- Create: `apps/web/src/routes/wallets/$walletId.tsx`
- Create: `apps/web/src/routes/settings.tsx`

- [ ] **Step 1: Write the failing wallet leaderboard test**

```tsx
// apps/web/src/components/wallets/wallets-table.test.tsx
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { WalletsTable } from './wallets-table'

describe('WalletsTable', () => {
  it('renders pnl, win rate, and tag columns', () => {
    render(
      <WalletsTable
        rows={[
          {
            address: '0xabc',
            displayName: 'Macro Whale',
            verified: true,
            totalPnl: 184000,
            winRate: 0.71,
            averagePositionSize: 18000,
            tags: ['high-conviction', 'event-specialist'],
            completeness: 'backfilled',
          },
        ]}
      />,
    )

    expect(screen.getByText(/macro whale/i)).toBeInTheDocument()
    expect(screen.getByText(/184,000/)).toBeInTheDocument()
    expect(screen.getByText(/event-specialist/i)).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm --filter @polyboard/web test -- --run src/components/wallets/wallets-table.test.tsx`

Expected: FAIL because the wallet components do not exist yet.

- [ ] **Step 3: Implement wallet and settings pages**

Create:

```tsx
// apps/web/src/components/wallets/wallet-tag-list.tsx
export function WalletTagList({ tags }: { tags: string[] }) {
  return (
    <div className="pill-row">
      {tags.map((tag) => (
        <span className="pill" key={tag}>
          {tag}
        </span>
      ))}
    </div>
  )
}
```

```tsx
// apps/web/src/components/wallets/wallets-table.tsx
import { Link } from '@tanstack/react-router'
import { WalletTagList } from './wallet-tag-list'

export function WalletsTable({
  rows,
}: {
  rows: Array<{
    address: string
    displayName: string | null
    verified: boolean
    totalPnl: number
    winRate: number
    averagePositionSize: number
    tags: string[]
    completeness: string
  }>
}) {
  return (
    <table className="leaderboard-table">
      <thead>
        <tr>
          <th>Wallet</th>
          <th>Total PnL</th>
          <th>Win Rate</th>
          <th>Avg Size</th>
          <th>Tags</th>
          <th>Completeness</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr key={row.address}>
            <td>
              <Link to="/wallets/$walletId" params={{ walletId: row.address }}>
                {row.displayName ?? row.address}
              </Link>
            </td>
            <td>{Intl.NumberFormat('en-US').format(row.totalPnl)}</td>
            <td>{(row.winRate * 100).toFixed(1)}%</td>
            <td>{Intl.NumberFormat('en-US').format(row.averagePositionSize)}</td>
            <td><WalletTagList tags={row.tags} /></td>
            <td>{row.completeness}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}
```

```tsx
// apps/web/src/components/settings/watchlist-form.tsx
import { useState } from 'react'

export function WatchlistForm({
  onSubmit,
}: {
  onSubmit: (input: { address: string; note?: string; isExcluded: boolean }) => Promise<void>
}) {
  const [address, setAddress] = useState('')
  const [note, setNote] = useState('')
  const [isExcluded, setIsExcluded] = useState(false)

  return (
    <form
      className="surface stack"
      onSubmit={async (event) => {
        event.preventDefault()
        await onSubmit({ address, note, isExcluded })
        setAddress('')
        setNote('')
        setIsExcluded(false)
      }}
    >
      <h3>Add Wallet</h3>
      <label>
        Address
        <input value={address} onChange={(event) => setAddress(event.target.value)} />
      </label>
      <label>
        Note
        <input value={note} onChange={(event) => setNote(event.target.value)} />
      </label>
      <label>
        Exclude
        <input
          type="checkbox"
          checked={isExcluded}
          onChange={(event) => setIsExcluded(event.target.checked)}
        />
      </label>
      <button type="submit">Save</button>
    </form>
  )
}
```

```tsx
// apps/web/src/routes/wallets/index.tsx
import { createFileRoute } from '@tanstack/react-router'
import { WalletsTable } from '../../components/wallets/wallets-table'
import { getWalletLeaderboard } from '../../features/wallets/server'

export const Route = createFileRoute('/wallets/')({
  loader: () => getWalletLeaderboard(),
  component: WalletsPage,
})

function WalletsPage() {
  const rows = Route.useLoaderData()

  return (
    <section className="stack">
      <div className="surface">
        <p className="eyebrow">Wallets</p>
        <h2>Historical Performance Leaderboard</h2>
      </div>
      <WalletsTable rows={rows} />
    </section>
  )
}
```

```tsx
// apps/web/src/routes/wallets/$walletId.tsx
import { createFileRoute } from '@tanstack/react-router'
import { WalletTagList } from '../../components/wallets/wallet-tag-list'
import { getWalletById } from '../../features/wallets/server'

export const Route = createFileRoute('/wallets/$walletId')({
  loader: ({ params }) => getWalletById({ data: { address: params.walletId } }),
  component: WalletDetailPage,
})

function WalletDetailPage() {
  const detail = Route.useLoaderData()

  if (!detail?.wallet) {
    return <div className="surface">Wallet not found.</div>
  }

  return (
    <section className="stack">
      <div className="surface">
        <p className="eyebrow">Wallet</p>
        <h2>{detail.wallet.displayName ?? detail.wallet.address}</h2>
        <p>Verified: {detail.wallet.verified ? 'Yes' : 'No'}</p>
      </div>
      <div className="surface">
        <h3>Specialized Tags</h3>
        <WalletTagList tags={(detail.score?.tags as string[] | undefined) ?? []} />
      </div>
      <div className="surface">
        <h3>Open Positions</h3>
        <ul className="metric-list">
          {detail.openPositions.map((position) => (
            <li key={position.id}>
              <span>{position.outcome}</span>
              <strong>{position.size}</strong>
            </li>
          ))}
        </ul>
      </div>
      <div className="surface">
        <h3>Closed Position History</h3>
        <ul className="metric-list">
          {detail.closedPositions.slice(0, 10).map((position) => (
            <li key={position.id}>
              <span>{position.outcome}</span>
              <strong>{position.realizedPnl}</strong>
            </li>
          ))}
        </ul>
      </div>
      <div className="surface">
        <h3>Event Analytics</h3>
        <ul className="metric-list">
          {detail.eventStats.map((event) => (
            <li key={event.eventSlug}>
              <span>{event.eventSlug}</span>
              <strong>{event.tradeCount} trades</strong>
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}
```

```tsx
// apps/web/src/routes/settings.tsx
import { createFileRoute, useRouter } from '@tanstack/react-router'
import { WatchlistForm } from '../components/settings/watchlist-form'
import { getAppSettings, upsertWatchlist } from '../features/settings/server'

export const Route = createFileRoute('/settings')({
  loader: () => getAppSettings(),
  component: SettingsPage,
})

function SettingsPage() {
  const settings = Route.useLoaderData()
  const router = useRouter()

  return (
    <section className="stack">
      <div className="surface">
        <p className="eyebrow">Settings</p>
        <h2>Thresholds And Watchlists</h2>
        <p>Minimum market volume: {settings.minMarketVolume}</p>
      </div>
      <WatchlistForm
        onSubmit={async (input) => {
          await upsertWatchlist({ data: input })
          await router.invalidate()
        }}
      />
    </section>
  )
}
```

- [ ] **Step 4: Run the wallet and settings tests**

Run:

```bash
pnpm --filter @polyboard/web test -- --run src/components/wallets/wallets-table.test.tsx
pnpm --filter @polyboard/web build
```

Expected: the wallet table test passes and the app build still succeeds.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/components/wallets apps/web/src/components/settings apps/web/src/routes/wallets apps/web/src/routes/settings.tsx
git commit -m "feat: add wallet leaderboard detail and settings flows"
```

### Task 10: Add Health Checks, E2E Coverage, Seed Data, And Docs

**Files:**
- Create: `apps/web/tests/e2e/dashboard.spec.ts`
- Create: `apps/web/playwright.config.ts`
- Create: `apps/web/src/routes/api/health.tsx`
- Create: `apps/worker/src/health.ts`
- Create: `scripts/seed-dev.ts`
- Modify: `README.md`

- [ ] **Step 1: Write the failing e2e smoke test**

```ts
// apps/web/tests/e2e/dashboard.spec.ts
import { expect, test } from '@playwright/test'

test('dashboard exposes the primary navigation and leaderboard headings', async ({ page }) => {
  await page.goto('http://127.0.0.1:3000')

  await expect(page.getByRole('link', { name: 'Markets' })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Wallets' })).toBeVisible()
  await expect(page.getByRole('heading', { name: /live polymarket intelligence/i })).toBeVisible()
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm --filter @polyboard/web exec playwright test tests/e2e/dashboard.spec.ts`

Expected: FAIL because Playwright config, health route, and seeded local app flow are not wired yet.

- [ ] **Step 3: Implement health surfaces, deterministic seed data, and setup docs**

Run:

```bash
pnpm --filter @polyboard/web add -D @playwright/test
pnpm --filter @polyboard/worker add pino-pretty
```

Create:

```ts
// apps/web/playwright.config.ts
import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: './tests/e2e',
  use: {
    baseURL: 'http://127.0.0.1:3000',
    trace: 'on-first-retry',
  },
  webServer: {
    command: 'pnpm --filter @polyboard/web dev',
    port: 3000,
    reuseExistingServer: true,
  },
})
```

```ts
// apps/web/src/routes/api/health.tsx
import { createFileRoute } from '@tanstack/react-start'
import { createDb, dataFreshness } from '@polyboard/db'

export const Route = createFileRoute('/api/health')({
  server: {
    handlers: {
      GET: async () => {
        const db = createDb()
        const freshness = await db.select().from(dataFreshness)
        return Response.json({
          ok: true,
          sources: freshness,
          checkedAt: new Date().toISOString(),
        })
      },
    },
  },
})
```

```ts
// apps/worker/src/health.ts
export function buildWorkerHealth(input: {
  lastDiscoveryAt?: Date
  lastSocketMessageAt?: Date
  backlogSize: number
}) {
  return {
    status: input.backlogSize > 500 ? 'degraded' : 'healthy',
    lastDiscoveryAt: input.lastDiscoveryAt?.toISOString() ?? null,
    lastSocketMessageAt: input.lastSocketMessageAt?.toISOString() ?? null,
    backlogSize: input.backlogSize,
  }
}
```

```ts
// scripts/seed-dev.ts
import { createDb, appSettings, markets, marketScores, wallets, walletScores } from '@polyboard/db'

async function seed() {
  const db = createDb()
  const now = new Date()

  await db.insert(appSettings).values({
    id: 1,
    minMarketVolume: 50000,
    scoreWeights: { marketStructure: 0.4, smartMoney: 0.4, timing: 0.2 },
    trackedCategories: ['Crypto', 'Politics'],
    updatedAt: now,
  }).onConflictDoNothing()

  await db.insert(markets).values({
    id: 'm1',
    conditionId: '0xseed',
    eventId: null,
    question: 'Will BTC close above $100k on Friday?',
    slug: 'btc-above-100k-friday',
    active: true,
    closed: false,
    volume: '125000',
    liquidity: '42000',
    endDate: new Date('2026-03-31T16:00:00Z'),
    category: 'Crypto',
    metadata: {},
    updatedAt: now,
  }).onConflictDoNothing()

  await db.insert(marketScores).values({
    marketId: 'm1',
    marketStructureScore: '0.80',
    smartMoneyScore: '0.65',
    timingScore: '0.71',
    edgeScore: '0.72',
    reasons: [
      { label: 'market-structure', value: 0.8 },
      { label: 'smart-money', value: 0.65 },
      { label: 'timing', value: 0.71 },
    ],
    calculatedAt: now,
  }).onConflictDoNothing()

  await db.insert(wallets).values({
    address: '0xabc',
    displayName: 'Macro Whale',
    pseudonym: 'Macro Whale',
    verified: true,
    profileImage: null,
    metadata: { tags: ['high-conviction', 'event-specialist'] },
    updatedAt: now,
  }).onConflictDoNothing()

  await db.insert(walletScores).values({
    walletAddress: '0xabc',
    realizedPnl: '120000',
    unrealizedPnl: '64000',
    totalPnl: '184000',
    winRate: '0.71',
    averagePositionSize: '18000',
    tags: ['high-conviction', 'event-specialist'],
    completeness: 'backfilled',
    calculatedAt: now,
  }).onConflictDoNothing()
}

seed().catch((error) => {
  console.error(error)
  process.exit(1)
})
```

```md
<!-- README.md -->
# Polyboard

Private Polymarket research dashboard built with TanStack Start and a separate ingest worker.

## Local setup

1. `cp .env.example .env`
2. `pnpm install`
3. `pnpm db:up`
4. `pnpm --filter @polyboard/db db:push`
5. `pnpm seed:dev`
6. `pnpm dev`

## Services

- `apps/web`: TanStack Start dashboard on `http://127.0.0.1:3000`
- `apps/worker`: background discovery, WebSocket ingest, backfill, analytics
- `postgres`: local database on `localhost:5432`

## Key flows

- live market leaderboard
- market detail with score breakdown
- wallet leaderboard and wallet detail
- settings and watchlists

## Health

- web: `GET /api/health`
- worker: inspect worker logs and freshness tables
```

- [ ] **Step 4: Run the final verification suite**

Run:

```bash
pnpm --filter @polyboard/db db:push
pnpm seed:dev
pnpm --filter @polyboard/web test
pnpm --filter @polyboard/analytics test
pnpm --filter @polyboard/polymarket test
pnpm --filter @polyboard/worker test
pnpm --filter @polyboard/web exec playwright test
pnpm --filter @polyboard/web build
pnpm --filter @polyboard/worker build
```

Expected: tests pass, the database is seeded, and both the web app and worker build cleanly.

- [ ] **Step 5: Commit**

```bash
git add apps/web/tests/e2e apps/web/playwright.config.ts apps/web/src/routes/api/health.tsx apps/worker/src/health.ts scripts/seed-dev.ts README.md
git commit -m "feat: add verification health checks and local docs"
```
