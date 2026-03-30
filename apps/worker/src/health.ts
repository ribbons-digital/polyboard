export function buildWorkerHealth(input: {
  lastDiscoveryAt?: Date
  lastSocketMessageAt?: Date
  backlogSize: number
}) {
  return {
    backlogSize: input.backlogSize,
    lastDiscoveryAt: input.lastDiscoveryAt?.toISOString() ?? null,
    lastSocketMessageAt: input.lastSocketMessageAt?.toISOString() ?? null,
    status: input.backlogSize > 500 ? 'degraded' : 'healthy',
  }
}
