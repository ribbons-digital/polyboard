import {
  recomputeMarketScores,
  type RecomputeMarketScoresDeps,
} from './jobs/analytics'
import { runBackfillOnce, type BackfillDeps } from './jobs/backfill'
import { runDiscoveryOnce, type DiscoveryDeps } from './jobs/discovery'
import { freshnessCoreSourceKeys } from '@polyboard/db'

const [
  gammaMarketsSourceKey,
  dataWalletsSourceKey,
  scoresMarketsSourceKey,
] = freshnessCoreSourceKeys

interface LoggerLike {
  error: (...args: unknown[]) => void
  info?: (...args: unknown[]) => void
  warn?: (...args: unknown[]) => void
}

interface RuntimeRefreshScheduler {
  dataClient: BackfillDeps['dataClient']
  env: {
    discoveryIntervalMs: number
    minMarketVolume: number
    scoreRefreshIntervalMs: number
    walletRefreshIntervalMs: number
  }
  gammaClient: DiscoveryDeps['gammaClient']
  logger: LoggerLike
  repos: {
    freshnessRepo: DiscoveryDeps['freshnessRepo']
    marketRepo: DiscoveryDeps['marketRepo'] &
      BackfillDeps['marketRepo'] &
      RecomputeMarketScoresDeps['marketRepo']
    walletRepo: BackfillDeps['walletRepo']
  }
  settingsRepo: {
    getSettings: () => Promise<RecomputeMarketScoresDeps['settings']>
  }
}

interface RefreshJobDeps {
  recomputeMarketScores?: typeof recomputeMarketScores
  runBackfillOnce?: typeof runBackfillOnce
  runDiscoveryOnce?: typeof runDiscoveryOnce
  refreshSocketSubscriptions?: () => Promise<void> | void
}

export function startRefreshScheduler(deps: {
  runDiscovery: () => Promise<void>
  runWalletBackfill: () => Promise<void>
  runScoreRefresh: () => Promise<void>
  discoveryIntervalMs: number
  walletIntervalMs: number
  scoreIntervalMs: number
  logger: LoggerLike
}) {
  let stopped = false

  const createSerializedJobRunner = (
    job: () => Promise<void>,
    message: string,
  ) => {
    let running = false
    let rerunRequested = false

    const run = () => {
      if (running) {
        rerunRequested = true
        return
      }

      if (stopped) {
        return
      }

      running = true

      void (async () => {
        try {
          do {
            rerunRequested = false

            try {
              await job()
            } catch (error) {
              deps.logger.error({ err: error }, message)
            }
          } while (rerunRequested && !stopped)
        } finally {
          running = false
        }
      })()
    }

    return run
  }

  const runDiscovery = createSerializedJobRunner(
    deps.runDiscovery,
    'discovery refresh failed',
  )
  const runWalletBackfill = createSerializedJobRunner(
    deps.runWalletBackfill,
    'wallet backfill failed',
  )
  const runScoreRefresh = createSerializedJobRunner(
    deps.runScoreRefresh,
    'score refresh failed',
  )

  const timers = [
    setInterval(runDiscovery, deps.discoveryIntervalMs),
    setInterval(runWalletBackfill, deps.walletIntervalMs),
    setInterval(runScoreRefresh, deps.scoreIntervalMs),
  ]

  return {
    stop: () => {
      stopped = true

      for (const timer of timers) {
        clearInterval(timer)
      }
    },
  }
}

export function startRuntimeRefreshScheduler(
  runtime: RuntimeRefreshScheduler,
  deps: RefreshJobDeps = {},
) {
  const discovery = deps.runDiscoveryOnce ?? runDiscoveryOnce
  const backfill = deps.runBackfillOnce ?? runBackfillOnce
  const recompute = deps.recomputeMarketScores ?? recomputeMarketScores
  const markFreshnessFailed = async (
    sourceKey: (typeof freshnessCoreSourceKeys)[number],
  ) => {
    await runtime.repos.freshnessRepo.updateFreshness(
      sourceKey,
      'degraded',
      'degraded',
    )
  }

  return startRefreshScheduler({
    discoveryIntervalMs: runtime.env.discoveryIntervalMs,
    logger: runtime.logger,
    runDiscovery: async () => {
      try {
        await discovery({
          freshnessRepo: runtime.repos.freshnessRepo,
          gammaClient: runtime.gammaClient,
          marketRepo: runtime.repos.marketRepo,
          minVolume: runtime.env.minMarketVolume,
        })
      } catch (error) {
        await markFreshnessFailed(gammaMarketsSourceKey)
        throw error
      }

      await deps.refreshSocketSubscriptions?.()
    },
    runScoreRefresh: async () => {
      try {
        await recompute({
          freshnessRepo: runtime.repos.freshnessRepo,
          marketRepo: runtime.repos.marketRepo,
          settings: await runtime.settingsRepo.getSettings(),
        })
      } catch (error) {
        await markFreshnessFailed(scoresMarketsSourceKey)
        throw error
      }
    },
    runWalletBackfill: async () => {
      try {
        await backfill({
          dataClient: runtime.dataClient,
          freshnessRepo: runtime.repos.freshnessRepo,
          marketRepo: runtime.repos.marketRepo,
          walletRepo: runtime.repos.walletRepo,
        })
      } catch (error) {
        await markFreshnessFailed(dataWalletsSourceKey)
        throw error
      }
    },
    scoreIntervalMs: runtime.env.scoreRefreshIntervalMs,
    walletIntervalMs: runtime.env.walletRefreshIntervalMs,
  })
}
