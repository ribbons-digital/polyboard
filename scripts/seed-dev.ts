import {
  appSettings,
  createDb,
  dataFreshness,
  marketHolders,
  marketScores,
  marketSnapshots,
  marketTags,
  markets,
  tokens,
  walletEventStats,
  walletPositionsClosed,
  walletPositionsOpen,
  walletScores,
  walletTrades,
  walletWatchlists,
  wallets,
} from '@polyboard/db'
import { eq, inArray } from 'drizzle-orm'
import { pathToFileURL } from 'node:url'

export async function seedDevelopmentData() {
  const db = createDb()
  const now = new Date('2026-03-30T12:00:00Z')
  try {
    await db.delete(marketSnapshots).where(eq(marketSnapshots.marketId, 'm1'))
    await db.delete(marketHolders).where(eq(marketHolders.marketId, 'm1'))
    await db.delete(walletTrades).where(eq(walletTrades.marketId, 'm1'))
    await db
      .delete(walletPositionsOpen)
      .where(eq(walletPositionsOpen.walletAddress, '0xabc'))
    await db
      .delete(walletPositionsClosed)
      .where(eq(walletPositionsClosed.walletAddress, '0xabc'))
    await db
      .delete(walletEventStats)
      .where(eq(walletEventStats.walletAddress, '0xabc'))
    await db
      .delete(dataFreshness)
      .where(
        inArray(dataFreshness.sourceKey, ['gamma:markets', 'clob:market_socket']),
      )

    await db
      .insert(appSettings)
      .values({
        id: 1,
        minMarketVolume: 50000,
        scoreWeights: { marketStructure: 0.4, smartMoney: 0.4, timing: 0.2 },
        trackedCategories: ['Crypto', 'Politics'],
        updatedAt: now,
      })
      .onConflictDoNothing()

    await db
      .insert(markets)
      .values({
        active: true,
        category: 'Crypto',
        closed: false,
        conditionId: '0xseed',
        endDate: new Date('2026-03-31T16:00:00Z'),
        eventId: null,
        id: 'm1',
        liquidity: '42000',
        metadata: {},
        question: 'Will BTC close above $100k on Friday?',
        slug: 'btc-above-100k-friday',
        updatedAt: now,
        volume: '125000',
      })
      .onConflictDoNothing()

  await db
    .insert(tokens)
    .values([
      {
        active: true,
        id: 't1',
        marketId: 'm1',
        outcome: 'Yes',
        outcomeIndex: 0,
      },
      {
        active: true,
        id: 't2',
        marketId: 'm1',
        outcome: 'No',
        outcomeIndex: 1,
      },
    ])
    .onConflictDoNothing()

  await db
    .insert(marketTags)
    .values([
      { label: 'Momentum', marketId: 'm1', tagSlug: 'momentum' },
      { label: 'Macro', marketId: 'm1', tagSlug: 'macro' },
    ])
    .onConflictDoNothing()

  await db
    .insert(marketScores)
    .values({
      calculatedAt: now,
      edgeScore: '0.72',
      marketId: 'm1',
      marketStructureScore: '0.80',
      reasons: [
        { label: 'market-structure', value: 0.8 },
        { label: 'smart-money', value: 0.65 },
        { label: 'timing', value: 0.71 },
      ],
      smartMoneyScore: '0.65',
      timingScore: '0.71',
    })
    .onConflictDoNothing()

  await db
    .insert(wallets)
    .values([
      {
        address: '0xabc',
        displayName: 'Macro Whale',
        metadata: { tags: ['high-conviction', 'event-specialist'] },
        profileImage: null,
        pseudonym: 'Macro Whale',
        updatedAt: now,
        verified: true,
      },
      {
        address: '0xdef',
        displayName: 'Tape Reader',
        metadata: {},
        profileImage: null,
        pseudonym: 'Tape Reader',
        updatedAt: now,
        verified: false,
      },
    ])
    .onConflictDoNothing()

  await db
    .insert(walletScores)
    .values({
      averagePositionSize: '18000',
      calculatedAt: now,
      completeness: 'backfilled',
      realizedPnl: '120000',
      tags: ['high-conviction', 'event-specialist'],
      totalPnl: '184000',
      unrealizedPnl: '64000',
      walletAddress: '0xabc',
      winRate: '0.71',
    })
    .onConflictDoNothing()

  await db
    .insert(walletWatchlists)
    .values({
      address: '0xabc',
      createdAt: now,
      isExcluded: false,
      note: 'Seeded focus wallet',
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: walletWatchlists.address,
      set: {
        isExcluded: false,
        note: 'Seeded focus wallet',
        updatedAt: now,
      },
    })

  await db
    .insert(walletPositionsOpen)
    .values({
      averagePrice: '0.57',
      currentValue: '11400',
      marketId: 'm1',
      outcome: 'Yes',
      realizedPnl: '2400',
      size: '20000',
      tokenId: 't1',
      totalPnl: '3400',
      updatedAt: now,
      walletAddress: '0xabc',
    })
    .onConflictDoNothing()

  await db
    .insert(walletPositionsClosed)
    .values({
      averagePrice: '0.42',
      closedAt: now,
      marketId: 'm1',
      outcome: 'No',
      realizedPnl: '6200',
      tokenId: 't2',
      totalBought: '9000',
      walletAddress: '0xabc',
    })
    .onConflictDoNothing()

  await db
    .insert(walletTrades)
    .values([
      {
        marketId: 'm1',
        price: '0.54',
        side: 'buy',
        size: '12000',
        tokenId: 't1',
        tradedAt: new Date('2026-03-30T09:00:00Z'),
        transactionHash: '0xseed-buy',
        walletAddress: '0xabc',
      },
      {
        marketId: 'm1',
        price: '0.58',
        side: 'buy',
        size: '8000',
        tokenId: 't1',
        tradedAt: new Date('2026-03-30T11:30:00Z'),
        transactionHash: '0xseed-add',
        walletAddress: '0xabc',
      },
    ])
    .onConflictDoNothing()

  await db
    .insert(walletEventStats)
    .values({
      eventSlug: 'btc-above-100k-friday',
      realizedPnl: '6200',
      totalVolume: '20000',
      tradeCount: 2,
      updatedAt: now,
      walletAddress: '0xabc',
    })
    .onConflictDoNothing()

  await db
    .insert(marketSnapshots)
    .values([
      {
        bestAsk: '0.56',
        bestBid: '0.52',
        capturedAt: new Date('2026-03-30T08:00:00Z'),
        lastPrice: '0.53',
        marketId: 'm1',
        spreadBps: '40',
        tokenId: 't1',
      },
      {
        bestAsk: '0.59',
        bestBid: '0.55',
        capturedAt: new Date('2026-03-30T10:00:00Z'),
        lastPrice: '0.57',
        marketId: 'm1',
        spreadBps: '35',
        tokenId: 't1',
      },
      {
        bestAsk: '0.61',
        bestBid: '0.57',
        capturedAt: new Date('2026-03-30T12:00:00Z'),
        lastPrice: '0.59',
        marketId: 'm1',
        spreadBps: '30',
        tokenId: 't1',
      },
    ])
    .onConflictDoNothing()

  await db
    .insert(marketHolders)
    .values([
      {
        currentValue: '11800',
        marketId: 'm1',
        size: '20000',
        tokenId: 't1',
        updatedAt: now,
        walletAddress: '0xabc',
      },
      {
        currentValue: '6400',
        marketId: 'm1',
        size: '11000',
        tokenId: 't1',
        updatedAt: now,
        walletAddress: '0xdef',
      },
    ])
    .onConflictDoNothing()

    await db
      .insert(dataFreshness)
      .values([
        {
          asOf: now,
          completeness: 'backfilled',
          sourceKey: 'gamma:markets',
          status: 'fresh',
        },
        {
          asOf: now,
          completeness: 'live',
          sourceKey: 'clob:market_socket',
          status: 'fresh',
        },
      ])
      .onConflictDoNothing()
  } finally {
    await db.$client.end()
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  seedDevelopmentData().catch((error) => {
    console.error(error)
    process.exit(1)
  })
}
