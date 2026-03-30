import { runDiscoveryOnce } from './jobs/discovery'
import { createRuntime } from './runtime'
import { createMarketSocketLoop } from './socket-loop'

async function main() {
  const runtime = createRuntime()

  await runDiscoveryOnce({
    minVolume: runtime.env.minMarketVolume,
    gammaClient: runtime.gammaClient,
    marketRepo: runtime.repos.marketRepo,
    freshnessRepo: runtime.repos.freshnessRepo,
  })

  const marketSocketLoop = createMarketSocketLoop({
    logger: runtime.logger,
    marketRepo: runtime.repos.marketRepo,
    marketSocket: runtime.marketSocket,
  })

  await marketSocketLoop.start()
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
