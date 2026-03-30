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
    marketId: text('market_id')
      .notNull()
      .references(() => markets.id, { onDelete: 'cascade' }),
    tagSlug: text('tag_slug').notNull(),
    label: text('label').notNull(),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.marketId, table.tagSlug] }),
  }),
)

export const tokens = pgTable('tokens', {
  id: text('id').primaryKey(),
  marketId: text('market_id')
    .notNull()
    .references(() => markets.id, { onDelete: 'cascade' }),
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
  address: text('address')
    .primaryKey()
    .references(() => wallets.address, { onDelete: 'cascade' }),
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
  marketId: text('market_id')
    .notNull()
    .references(() => markets.id, { onDelete: 'cascade' }),
  tokenId: text('token_id')
    .notNull()
    .references(() => tokens.id, { onDelete: 'cascade' }),
  lastPrice: numeric('last_price', { precision: 12, scale: 6 }),
  spreadBps: numeric('spread_bps', { precision: 12, scale: 2 }),
  bestBid: numeric('best_bid', { precision: 12, scale: 6 }),
  bestAsk: numeric('best_ask', { precision: 12, scale: 6 }),
  capturedAt: timestamp('captured_at', { withTimezone: true }).notNull(),
})

export const walletPositionsOpen = pgTable('wallet_positions_open', {
  id: bigint('id', { mode: 'number' }).primaryKey().generatedAlwaysAsIdentity(),
  walletAddress: text('wallet_address')
    .notNull()
    .references(() => wallets.address, { onDelete: 'cascade' }),
  marketId: text('market_id')
    .notNull()
    .references(() => markets.id, { onDelete: 'cascade' }),
  tokenId: text('token_id')
    .notNull()
    .references(() => tokens.id, { onDelete: 'cascade' }),
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
  walletAddress: text('wallet_address')
    .notNull()
    .references(() => wallets.address, { onDelete: 'cascade' }),
  marketId: text('market_id')
    .notNull()
    .references(() => markets.id, { onDelete: 'cascade' }),
  tokenId: text('token_id')
    .notNull()
    .references(() => tokens.id, { onDelete: 'cascade' }),
  outcome: text('outcome').notNull(),
  totalBought: numeric('total_bought', { precision: 18, scale: 2 }).notNull(),
  averagePrice: numeric('average_price', { precision: 12, scale: 6 }).notNull(),
  realizedPnl: numeric('realized_pnl', { precision: 18, scale: 2 }).notNull(),
  closedAt: timestamp('closed_at', { withTimezone: true }).notNull(),
})

export const walletTrades = pgTable('wallet_trades', {
  transactionHash: text('transaction_hash').primaryKey(),
  walletAddress: text('wallet_address')
    .notNull()
    .references(() => wallets.address, { onDelete: 'cascade' }),
  marketId: text('market_id')
    .notNull()
    .references(() => markets.id, { onDelete: 'cascade' }),
  tokenId: text('token_id')
    .notNull()
    .references(() => tokens.id, { onDelete: 'cascade' }),
  side: text('side').notNull(),
  price: numeric('price', { precision: 12, scale: 6 }).notNull(),
  size: numeric('size', { precision: 18, scale: 4 }).notNull(),
  tradedAt: timestamp('traded_at', { withTimezone: true }).notNull(),
})

export const marketHolders = pgTable('market_holders', {
  id: bigint('id', { mode: 'number' }).primaryKey().generatedAlwaysAsIdentity(),
  marketId: text('market_id')
    .notNull()
    .references(() => markets.id, { onDelete: 'cascade' }),
  tokenId: text('token_id')
    .notNull()
    .references(() => tokens.id, { onDelete: 'cascade' }),
  walletAddress: text('wallet_address')
    .notNull()
    .references(() => wallets.address, { onDelete: 'cascade' }),
  size: numeric('size', { precision: 18, scale: 4 }).notNull(),
  currentValue: numeric('current_value', { precision: 18, scale: 2 }),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull(),
})

export const walletEventStats = pgTable(
  'wallet_event_stats',
  {
    walletAddress: text('wallet_address')
      .notNull()
      .references(() => wallets.address, { onDelete: 'cascade' }),
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
  marketId: text('market_id')
    .primaryKey()
    .references(() => markets.id, { onDelete: 'cascade' }),
  marketStructureScore: numeric('market_structure_score', { precision: 10, scale: 4 }).notNull(),
  smartMoneyScore: numeric('smart_money_score', { precision: 10, scale: 4 }).notNull(),
  timingScore: numeric('timing_score', { precision: 10, scale: 4 }).notNull(),
  edgeScore: numeric('edge_score', { precision: 10, scale: 4 }).notNull(),
  reasons: jsonb('reasons').notNull().default([]),
  calculatedAt: timestamp('calculated_at', { withTimezone: true }).notNull(),
})

export const walletScores = pgTable('wallet_scores', {
  walletAddress: text('wallet_address')
    .primaryKey()
    .references(() => wallets.address, { onDelete: 'cascade' }),
  realizedPnl: numeric('realized_pnl', { precision: 18, scale: 2 }).notNull().default('0'),
  unrealizedPnl: numeric('unrealized_pnl', { precision: 18, scale: 2 }).notNull().default('0'),
  totalPnl: numeric('total_pnl', { precision: 18, scale: 2 }).notNull().default('0'),
  winRate: numeric('win_rate', { precision: 8, scale: 4 }).notNull().default('0'),
  averagePositionSize: numeric('average_position_size', { precision: 18, scale: 2 })
    .notNull()
    .default('0'),
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
