import { pathToFileURL } from 'node:url'
import { runWorkerBootstrap } from './bootstrap'
import { createRuntime } from './runtime'
import { startRuntimeRefreshScheduler } from './scheduler'
import { createMarketSocketLoop } from './socket-loop'

type Runtime = ReturnType<typeof createRuntime>
type RefreshScheduler = ReturnType<typeof startRuntimeRefreshScheduler>
type RefreshSchedulerDeps = Parameters<typeof startRuntimeRefreshScheduler>[1]

export async function startWorker(
  deps: {
    createRuntime?: () => Runtime
    createSocketLoop?: typeof createMarketSocketLoop
    runLiveBootstrap?: () => Promise<void>
    startRefreshScheduler?: (
      runtime: Runtime,
      deps?: RefreshSchedulerDeps,
    ) => RefreshScheduler
  } = {},
) {
  const runtime = deps.createRuntime?.() ?? createRuntime()

  const bootstrapStatus = await runWorkerBootstrap(runtime, {
    runLiveBootstrap: deps.runLiveBootstrap,
  })

  const marketSocketLoop = (deps.createSocketLoop ?? createMarketSocketLoop)({
    logger: runtime.logger,
    marketRepo: runtime.repos.marketRepo,
    marketSocket: runtime.marketSocket,
  })

  const refreshScheduler =
    deps.startRefreshScheduler?.(runtime, {
      refreshSocketSubscriptions: marketSocketLoop.refreshSubscriptions,
    }) ??
    startRuntimeRefreshScheduler(runtime, {
      refreshSocketSubscriptions: marketSocketLoop.refreshSubscriptions,
    })

  await marketSocketLoop.start()

  return {
    bootstrapStatus,
    marketSocketLoop,
    refreshScheduler,
  }
}

if (
  process.argv[1] !== undefined &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  startWorker().catch((error) => {
    console.error(error)
    process.exit(1)
  })
}
