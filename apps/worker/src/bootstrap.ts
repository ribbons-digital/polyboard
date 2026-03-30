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
