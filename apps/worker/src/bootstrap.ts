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

function toError(error: unknown) {
  return error instanceof Error ? error : new Error(String(error))
}

async function handleLiveBootstrapFailure(
  deps: {
    checkUsableData: () => Promise<{
      hasFreshnessRows: boolean
      hasMarketScores: boolean
      hasWalletScores: boolean
    }>
    runFallbackSeed: () => Promise<void>
    markFreshness: (status: 'live' | 'fallback' | 'degraded') => Promise<void>
  },
  bootstrapError: unknown,
) {
  const state = await deps.checkUsableData()

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
