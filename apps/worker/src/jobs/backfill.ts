import {
  deriveWalletTags,
  summarizeWalletMetrics,
} from '@polyboard/analytics'

type RawRow = Record<string, unknown>

export interface BackfillDeps {
  dataClient: {
    getLeaderboard: () => Promise<RawRow[]>
    getPositions: (user: string) => Promise<RawRow[]>
    getClosedPositions: (user: string) => Promise<RawRow[]>
    getTrades: (
      query?: Record<string, string | number | boolean | undefined>,
    ) => Promise<RawRow[]>
    getHolders: (market: string) => Promise<RawRow[]>
    getValue: (user: string) => Promise<RawRow[]>
  }
  walletRepo: {
    upsertWalletProfiles: (
      rows: Array<{
        address: string
        displayName?: string | null
        pseudonym?: string | null
        verified?: boolean
        profileImage?: string | null
        metadata?: Record<string, unknown>
      }>,
    ) => Promise<void>
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
    replaceOpenPositions: (
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
    ) => Promise<void>
    replaceClosedPositions: (
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
    ) => Promise<void>
    replaceTrades: (
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
    ) => Promise<void>
    replaceWalletEventStats: (
      walletAddress: string,
      rows: Array<{
        eventSlug: string
        tradeCount: number
        realizedPnl: number
        totalVolume: number
      }>,
    ) => Promise<void>
  }
  marketRepo: {
    listMarketIdsByConditionIds: (
      conditionIds: string[],
    ) => Promise<Map<string, string>>
    replaceMarketHolders: (
      marketId: string,
      rows: Array<{
        tokenId: string
        walletAddress: string
        size: number
        currentValue?: number
      }>,
    ) => Promise<void>
  }
}

export async function runBackfillOnce(deps: BackfillDeps) {
  const leaderboard = await deps.dataClient.getLeaderboard()
  const walletProfiles = leaderboard.flatMap((row) => {
    const address = getAddress(row)

    if (address === null) {
      return []
    }

    return [
      {
        address,
        displayName: getOptionalString(row.name),
        metadata: row,
        profileImage: getOptionalString(row.profileImage),
        pseudonym: getOptionalString(row.pseudonym),
        verified: getBoolean(row.verified),
      },
    ]
  })

  await deps.walletRepo.upsertWalletProfiles(walletProfiles)

  for (const wallet of walletProfiles.slice(0, 50)) {
    const [openRows, closedRows, tradeRows, valueRows] = await Promise.all([
      deps.dataClient.getPositions(wallet.address),
      deps.dataClient.getClosedPositions(wallet.address),
      deps.dataClient.getTrades({ user: wallet.address }),
      deps.dataClient.getValue(wallet.address),
    ])
    const marketIdLookup = await deps.marketRepo.listMarketIdsByConditionIds(
      collectConditionIds(openRows, closedRows, tradeRows),
    )
    const mappedOpenPositions = mapOpenPositions(openRows, marketIdLookup)
    const mappedClosedPositions = mapClosedPositions(closedRows, marketIdLookup)
    const closedPositionMetrics = mapClosedPositionMetrics(
      closedRows,
      marketIdLookup,
    )
    const mappedTrades = mapTrades(tradeRows, marketIdLookup)
    const unrealizedPnl = getNumericValue(valueRows[0]?.value)

    await deps.walletRepo.replaceOpenPositions(
      wallet.address,
      mappedOpenPositions,
    )
    await deps.walletRepo.replaceClosedPositions(
      wallet.address,
      mappedClosedPositions,
    )
    await deps.walletRepo.replaceTrades(wallet.address, mappedTrades)
    await deps.walletRepo.replaceWalletEventStats(
      wallet.address,
      buildEventStats(tradeRows),
    )

    const metrics = summarizeWalletMetrics({
      closedPositions: closedPositionMetrics,
      realizedPnl: closedPositionMetrics.reduce(
        (sum, row) => sum + row.realizedPnl,
        0,
      ),
      unrealizedPnl,
    })

    await deps.walletRepo.upsertWalletScore({
      averagePositionSize: metrics.averagePositionSize,
      completeness: 'provisional',
      realizedPnl: metrics.realizedPnl,
      tags: deriveWalletTags(metrics),
      totalPnl: metrics.totalPnl,
      unrealizedPnl: metrics.unrealizedPnl,
      walletAddress: wallet.address,
      winRate: metrics.winRate,
    })

    for (const conditionId of new Set(
      tradeRows
        .map((row) => getConditionId(row))
        .filter((value): value is string => value !== null),
    )) {
      const marketId = marketIdLookup.get(conditionId)

      if (marketId === undefined) {
        continue
      }

      const holders = await deps.dataClient.getHolders(conditionId)

      await deps.marketRepo.replaceMarketHolders(
        marketId,
        normalizeHolderRows(holders),
      )
    }
  }
}

function collectConditionIds(...rowSets: RawRow[][]) {
  return [...new Set(rowSets.flatMap((rows) =>
    rows
      .map((row) => getConditionId(row))
      .filter((value): value is string => value !== null),
  ))]
}

function mapOpenPositions(
  rows: RawRow[],
  marketIdLookup: Map<string, string>,
) {
  return rows.flatMap((row) => {
    const mapped = mapMarketRow(row, marketIdLookup)

    if (mapped === null) {
      return []
    }

    return [
      {
        averagePrice: getNumericValue(row.avgPrice),
        currentValue: getNumericValue(row.currentValue),
        marketId: mapped.marketId,
        outcome: getOptionalString(row.outcome) ?? 'Unknown',
        realizedPnl: getNumericValue(row.realizedPnl),
        size: getNumericValue(row.size),
        tokenId: mapped.tokenId,
        totalPnl: getNumericValue(row.totalPnl),
      },
    ]
  })
}

function mapClosedPositions(
  rows: RawRow[],
  marketIdLookup: Map<string, string>,
) {
  return rows.flatMap((row) => {
    const mapped = mapMarketRow(row, marketIdLookup)
    const closedAt = getDateValue(row.timestamp)

    if (mapped === null || closedAt === null) {
      return []
    }

    return [
      {
        averagePrice: getNumericValue(row.avgPrice),
        closedAt,
        marketId: mapped.marketId,
        outcome: getOptionalString(row.outcome) ?? 'Unknown',
        realizedPnl: getNumericValue(row.realizedPnl),
        tokenId: mapped.tokenId,
        totalBought: getNumericValue(row.totalBought),
      },
    ]
  })
}

function mapTrades(rows: RawRow[], marketIdLookup: Map<string, string>) {
  return rows.flatMap((row) => {
    const mapped = mapMarketRow(row, marketIdLookup)
    const tradedAt = getDateValue(row.timestamp)
    const transactionHash =
      getOptionalString(row.transactionHash) ?? getOptionalString(row.hash)

    if (mapped === null || tradedAt === null || transactionHash === null) {
      return []
    }

    return [
      {
        marketId: mapped.marketId,
        price: getNumericValue(row.price),
        side: getOptionalString(row.side) ?? 'UNKNOWN',
        size: getNumericValue(row.size),
        tokenId: mapped.tokenId,
        tradedAt,
        transactionHash,
      },
    ]
  })
}

function mapClosedPositionMetrics(
  rows: RawRow[],
  marketIdLookup: Map<string, string>,
) {
  return rows.flatMap((row) => {
    const mapped = mapMarketRow(row, marketIdLookup)
    const closedAt = getDateValue(row.timestamp)

    if (mapped === null || closedAt === null) {
      return []
    }

    return [
      {
        category: getOptionalString(row.category),
        holdHours: 24,
        realizedPnl: getNumericValue(row.realizedPnl),
        size: getNumericValue(row.totalBought),
        won: getNumericValue(row.realizedPnl) > 0,
      },
    ]
  })
}

function normalizeHolderRows(rows: RawRow[]) {
  return rows.flatMap((row) => {
    if (Array.isArray(row.holders)) {
      const fallbackTokenId = getOptionalString(row.token)

      return row.holders.flatMap((holder) =>
        normalizeHolderRow(
          holder as Record<string, unknown>,
          fallbackTokenId,
        ),
      )
    }

    return normalizeHolderRow(row, getOptionalString(row.token))
  })
}

function normalizeHolderRow(
  row: RawRow,
  fallbackTokenId: string | null,
) {
  const walletAddress = getAddress(row)
  const tokenId = getOptionalString(row.asset) ?? fallbackTokenId

  if (walletAddress === null || tokenId === null) {
    return []
  }

  return [
    {
      currentValue: getOptionalNumber(row.currentValue) ?? undefined,
      size: getOptionalNumber(row.amount) ?? getNumericValue(row.size),
      tokenId,
      walletAddress,
    },
  ]
}

function buildEventStats(trades: RawRow[]) {
  const byEvent = new Map<
    string,
    { tradeCount: number; realizedPnl: number; totalVolume: number }
  >()

  for (const trade of trades) {
    const eventSlug = getOptionalString(trade.eventSlug) ?? 'unknown'
    const current = byEvent.get(eventSlug) ?? {
      realizedPnl: 0,
      totalVolume: 0,
      tradeCount: 0,
    }

    current.tradeCount += 1
    current.totalVolume += getNumericValue(trade.size)
    current.realizedPnl += getNumericValue(trade.realizedPnl)
    byEvent.set(eventSlug, current)
  }

  return [...byEvent.entries()].map(([eventSlug, values]) => ({
    eventSlug,
    ...values,
  }))
}

function mapMarketRow(row: RawRow, marketIdLookup: Map<string, string>) {
  const conditionId = getConditionId(row)
  const tokenId = getOptionalString(row.asset)

  if (conditionId === null || tokenId === null) {
    return null
  }

  const marketId = marketIdLookup.get(conditionId)

  if (marketId === undefined) {
    return null
  }

  return {
    marketId,
    tokenId,
  }
}

function getAddress(row: RawRow) {
  return (
    getOptionalString(row.proxyWallet) ?? getOptionalString(row.address)
  )
}

function getConditionId(row: RawRow) {
  return getOptionalString(row.conditionId)
}

function getOptionalString(value: unknown) {
  return typeof value === 'string' && value.length > 0 ? value : null
}

function getBoolean(value: unknown) {
  return value === true
}

function getOptionalNumber(value: unknown) {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : null
  }

  if (typeof value === 'string' && value.length > 0) {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : null
  }

  return null
}

function getNumericValue(value: unknown) {
  return getOptionalNumber(value) ?? 0
}

function getDateValue(value: unknown) {
  if (value instanceof Date) {
    return value
  }

  if (typeof value === 'number') {
    const date = new Date(value < 1_000_000_000_000 ? value * 1000 : value)
    return Number.isNaN(date.getTime()) ? null : date
  }

  if (typeof value === 'string' && value.length > 0) {
    const parsedNumber = Number(value)

    if (Number.isFinite(parsedNumber)) {
      const date = new Date(
        parsedNumber < 1_000_000_000_000
          ? parsedNumber * 1000
          : parsedNumber,
      )
      return Number.isNaN(date.getTime()) ? null : date
    }

    const parsedDate = Date.parse(value)
    return Number.isNaN(parsedDate) ? null : new Date(parsedDate)
  }

  return null
}
