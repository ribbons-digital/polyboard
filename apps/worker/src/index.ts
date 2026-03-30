import { runDiscoveryOnce } from './jobs/discovery'
import { handleSocketMessage } from './jobs/live-ingest'
import { createRuntime } from './runtime'

async function main() {
  const runtime = createRuntime()

  await runDiscoveryOnce({
    minVolume: runtime.env.minMarketVolume,
    gammaClient: runtime.gammaClient,
    marketRepo: runtime.repos.marketRepo,
    freshnessRepo: runtime.repos.freshnessRepo,
  })

  const trackedTokens = await runtime.repos.marketRepo.listTrackedTokens()
  const tokenLookup = new Map(
    trackedTokens.map((token) => [
      token.tokenId,
      { marketId: token.marketId, tokenId: token.tokenId },
    ]),
  )

  runtime.marketSocket.on('message', async (message) => {
    try {
      await handleSocketMessage(
        tokenLookup,
        message,
        runtime.repos.marketRepo.insertSnapshot,
      )
    } catch (error) {
      runtime.logger.error({ err: error }, 'failed to persist market snapshot')
    }
  })

  runtime.marketSocket.on('error', (error) => {
    runtime.logger.error({ err: error }, 'market socket error')
  })

  runtime.marketSocket.on('close', () => {
    runtime.logger.warn('market socket closed')
  })

  runtime.logger.info(
    {
      trackedTokenCount: tokenLookup.size,
    },
    'starting market socket',
  )

  runtime.marketSocket.connect([...tokenLookup.keys()])
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
