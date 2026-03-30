import {
  recomputeMarketScores,
  type RecomputeMarketScoresDeps,
} from './jobs/analytics'
import { runBackfillOnce, type BackfillDeps } from './jobs/backfill'
import { runDiscoveryOnce, type DiscoveryDeps } from './jobs/discovery'

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
  const runJob = (job: () => Promise<void>, message: string) => {
    void job().catch((error) => {
      deps.logger.error({ err: error }, message)
    })
  }

  const timers = [
    setInterval(() => {
      runJob(deps.runDiscovery, 'discovery refresh failed')
    }, deps.discoveryIntervalMs),
    setInterval(() => {
      runJob(deps.runWalletBackfill, 'wallet backfill failed')
    }, deps.walletIntervalMs),
    setInterval(() => {
      runJob(deps.runScoreRefresh, 'score refresh failed')
    }, deps.scoreIntervalMs),
  ]

  return {
    stop: () => {
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

  return startRefreshScheduler({
    discoveryIntervalMs: runtime.env.discoveryIntervalMs,
    logger: runtime.logger,
    runDiscovery: async () => {
      await discovery({
        freshnessRepo: runtime.repos.freshnessRepo,
        gammaClient: runtime.gammaClient,
        marketRepo: runtime.repos.marketRepo,
        minVolume: runtime.env.minMarketVolume,
      })
    },
    runScoreRefresh: async () =>
      recompute({
        marketRepo: runtime.repos.marketRepo,
        settings: await runtime.settingsRepo.getSettings(),
      }),
    runWalletBackfill: async () =>
      backfill({
        dataClient: runtime.dataClient,
        marketRepo: runtime.repos.marketRepo,
        walletRepo: runtime.repos.walletRepo,
      }),
    scoreIntervalMs: runtime.env.scoreRefreshIntervalMs,
    walletIntervalMs: runtime.env.walletRefreshIntervalMs,
  })
}
