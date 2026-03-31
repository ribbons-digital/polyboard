import type { FreshnessStatus } from '@polyboard/db'

type RawRow = Record<string, unknown>

export interface BackfillDeps {
  maxWallets?: number
  logger?: {
    warn?: (...args: unknown[]) => void
    info?: (...args: unknown[]) => void
  }
  dataClient: {
    getLeaderboard: (
      query?: Record<string, string | number | boolean | undefined>,
    ) => Promise<RawRow[]>
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
  }
  freshnessRepo?: {
    updateFreshness(
      sourceKey: string,
      status: FreshnessStatus,
      completeness?: string,
    ): Promise<void>
  }
}

export async function runBackfillOnce(deps: BackfillDeps) {
  deps.logger?.info?.('starting wallet backfill')

  const leaderboard = await deps.dataClient.getLeaderboard({ limit: deps.maxWallets ?? 20 })
  deps.logger?.info?.({ leaderboardSize: leaderboard.length }, 'fetched leaderboard')

  const walletProfiles = leaderboard.flatMap((row) => {
    const address = getAddress(row)

    if (address === null) {
      return []
    }

    return [
      {
        address,
        displayName:
          getOptionalString(row.userName) ?? getOptionalString(row.name),
        metadata: row,
        profileImage: getOptionalString(row.profileImage),
        pseudonym: getOptionalString(row.pseudonym),
        verified: getBoolean(row.verifiedBadge) || getBoolean(row.verified),
      },
    ]
  })

  if (walletProfiles.length === 0) {
    deps.logger?.warn?.('no wallet profiles found in leaderboard')
    return
  }

  await deps.walletRepo.upsertWalletProfiles(walletProfiles)
  deps.logger?.info?.({ walletCount: walletProfiles.length }, 'upserted wallet profiles')

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
        deps.logger?.info?.(
          { processed: processedCount, total: walletProfiles.length },
          'wallet backfill progress'
        )
      }
    } catch (error) {
      if (!isRateLimitedError(error)) {
        deps.logger?.error?.({ err: error, walletAddress: wallet.address }, 'wallet backfill failed')
        throw error
      }

      deps.logger?.warn?.(
        {
          err: error,
          walletAddress: wallet.address,
        },
        'wallet backfill rate-limited; skipping wallet this cycle',
      )
    }
  }

  deps.logger?.info?.(
    { processed: processedCount, total: walletProfiles.length },
    'completed wallet backfill'
  )

  if (walletProfiles.length > 0 && processedCount === 0) {
    throw new Error('Wallet backfill was rate-limited for all selected wallets')
  }

  await deps.freshnessRepo?.updateFreshness('data:wallets', 'live')
}

function isRateLimitedError(error: unknown) {
  if (!(error instanceof Error)) {
    return false
  }

  return error.message.includes('429 Too Many Requests')
}

function getAddress(row: RawRow): string | null {
  const address = getOptionalString(row.address ?? row.userAddress ?? row.proxyWallet)

  if (address === null) {
    return null
  }

  return address.toLowerCase()
}

function getOptionalString(value: unknown): string | null {
  if (typeof value === 'string' && value.length > 0) {
    return value
  }

  return null
}

function getBoolean(value: unknown): boolean {
  if (typeof value === 'boolean') {
    return value
  }

  if (typeof value === 'string') {
    return value.toLowerCase() === 'true'
  }

  if (typeof value === 'number') {
    return value !== 0
  }

  return false
}

function getNumericValue(value: unknown): number {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value
  }

  if (typeof value === 'string') {
    const parsed = Number.parseFloat(value)
    return Number.isFinite(parsed) ? parsed : 0
  }

  return 0
}

interface WalletSummary {
  realizedPnl: number
  unrealizedPnl: number
  totalPnl: number
  winRate: number
  averagePositionSize: number
}

function extractWalletSummary(valueData: RawRow[], walletAddress: string): WalletSummary {
  const firstRow = valueData[0] ?? {}

  return {
    realizedPnl: getNumericValue(firstRow.realizedPnl ?? firstRow.realized_profit),
    unrealizedPnl: getNumericValue(firstRow.unrealizedPnl ?? firstRow.unrealized_profit),
    totalPnl: getNumericValue(firstRow.totalPnl ?? firstRow.total_profit),
    winRate: getNumericValue(firstRow.winRate ?? firstRow.win_rate) / 100,
    averagePositionSize: getNumericValue(firstRow.averagePositionSize ?? firstRow.avg_position_size),
  }
}

function deriveWalletTags(summary: WalletSummary): string[] {
  const tags: string[] = []

  if (summary.totalPnl > 10000) {
    tags.push('high-performer')
  }

  if (summary.winRate > 0.6) {
    tags.push('consistent')
  }

  if (summary.averagePositionSize > 1000) {
    tags.push('high-conviction')
  }

  return tags
}
