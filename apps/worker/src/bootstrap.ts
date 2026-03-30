import {
  recomputeMarketScores,
  type RecomputeMarketScoresDeps,
} from './jobs/analytics'
import { runBackfillOnce, type BackfillDeps } from './jobs/backfill'
import { runDiscoveryOnce, type DiscoveryDeps } from './jobs/discovery'

type DashboardUsability = {
  hasFreshnessRows: boolean
  hasMarketScores: boolean
  hasWalletScores: boolean
}

export interface WorkerBootstrapRuntime {
  dataClient: BackfillDeps['dataClient']
  env: {
    minMarketVolume: number
  }
  gammaClient: DiscoveryDeps['gammaClient']
  repos: {
    freshnessRepo: {
      getDashboardUsability: () => Promise<DashboardUsability>
      updateFreshness: (
        sourceKey: string,
        status: string,
        completeness?: string,
      ) => Promise<void>
    }
    marketRepo: DiscoveryDeps['marketRepo'] &
      BackfillDeps['marketRepo'] &
      RecomputeMarketScoresDeps['marketRepo']
    walletRepo: BackfillDeps['walletRepo']
  }
  seedFallback: () => Promise<void>
  settingsRepo: {
    getSettings: () => Promise<RecomputeMarketScoresDeps['settings']>
  }
}

interface LiveBootstrapJobDeps {
  recomputeMarketScores?: typeof recomputeMarketScores
  runBackfillOnce?: typeof runBackfillOnce
  runDiscoveryOnce?: typeof runDiscoveryOnce
}

export function shouldRunFallbackSeed(input: {
  bootstrapFailed: boolean
  hasFreshnessRows: boolean
  hasMarketScores: boolean
  hasWalletScores: boolean
}) {
  return (
    input.bootstrapFailed &&
    (!input.hasFreshnessRows ||
      !input.hasMarketScores ||
      !input.hasWalletScores)
  )
}

export function createLiveBootstrapRunner(
  runtime: WorkerBootstrapRuntime,
  deps: LiveBootstrapJobDeps = {},
) {
  const runDiscovery = deps.runDiscoveryOnce ?? runDiscoveryOnce
  const runBackfill = deps.runBackfillOnce ?? runBackfillOnce
  const recompute = deps.recomputeMarketScores ?? recomputeMarketScores

  return async () => {
    await runDiscovery({
      freshnessRepo: runtime.repos.freshnessRepo,
      gammaClient: runtime.gammaClient,
      marketRepo: runtime.repos.marketRepo,
      minVolume: runtime.env.minMarketVolume,
    })

    await runBackfill({
      dataClient: runtime.dataClient,
      marketRepo: runtime.repos.marketRepo,
      walletRepo: runtime.repos.walletRepo,
    })

    await recompute({
      marketRepo: runtime.repos.marketRepo,
      settings: await runtime.settingsRepo.getSettings(),
    })
  }
}

function toError(error: unknown) {
  return error instanceof Error ? error : new Error(String(error))
}

async function handleLiveBootstrapFailure(
  deps: {
    checkUsableData: () => Promise<DashboardUsability>
    runFallbackSeed: () => Promise<void>
    markFreshness: (status: 'live' | 'fallback' | 'degraded') => Promise<void>
  },
  bootstrapError: unknown,
) {
  let state: DashboardUsability

  try {
    state = await deps.checkUsableData()
  } catch (decisionError) {
    throw new AggregateError(
      [toError(bootstrapError), toError(decisionError)],
      'Bootstrap fallback decision failed after live bootstrap failure',
    )
  }

  try {
    if (shouldRunFallbackSeed({ bootstrapFailed: true, ...state })) {
      await deps.runFallbackSeed()
      await deps.markFreshness('fallback')
      return 'fallback'
    }

    await deps.markFreshness('degraded')
    return 'degraded'
  } catch (decisionError) {
    throw new AggregateError(
      [toError(bootstrapError), toError(decisionError)],
      'Bootstrap fallback decision failed after live bootstrap failure',
    )
  }
}

export async function bootstrapWorkerData(deps: {
  runLiveBootstrap: () => Promise<void>
  checkUsableData: () => Promise<DashboardUsability>
  runFallbackSeed: () => Promise<void>
  markFreshness: (status: 'live' | 'fallback' | 'degraded') => Promise<void>
}) {
  try {
    await deps.runLiveBootstrap()
  } catch (error) {
    return await handleLiveBootstrapFailure(deps, error)
  }

  try {
    await deps.markFreshness('live')
    return 'live'
  } catch (error) {
    throw new Error('Failed to mark live freshness after bootstrap', {
      cause: error,
    })
  }
}

export async function runWorkerBootstrap(
  runtime: Pick<WorkerBootstrapRuntime, 'repos' | 'seedFallback'> &
    Partial<
      Pick<
        WorkerBootstrapRuntime,
        'dataClient' | 'env' | 'gammaClient' | 'settingsRepo'
      >
    >,
  deps: { runLiveBootstrap?: () => Promise<void> } & LiveBootstrapJobDeps = {},
) {
  const runLiveBootstrap =
    deps.runLiveBootstrap ??
    createLiveBootstrapRunner(runtime as WorkerBootstrapRuntime, deps)

  return bootstrapWorkerData({
    checkUsableData: runtime.repos.freshnessRepo.getDashboardUsability,
    markFreshness: (status) =>
      runtime.repos.freshnessRepo.updateFreshness(
        'worker:bootstrap',
        status,
        status === 'live' ? 'live' : 'fallback',
      ),
    runFallbackSeed: runtime.seedFallback,
    runLiveBootstrap,
  })
}
