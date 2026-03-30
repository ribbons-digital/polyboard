import {
  createDb,
  insertMarketSnapshot,
  listTrackedTokens,
  replaceTags,
  updateFreshness,
  upsertMarkets,
} from '@polyboard/db'
import { GammaClient, MarketSocket } from '@polyboard/polymarket'
import pino from 'pino'
import { parseWorkerEnv } from './config'

export function createRuntime(env: Record<string, string | undefined> = process.env) {
  const parsedEnv = parseWorkerEnv(env)
  const db = createDb(env)
  const logger = pino({ name: 'polyboard-worker' })
  const gammaClient = new GammaClient(parsedEnv.gammaUrl)
  const marketSocket = new MarketSocket(parsedEnv.wsUrl)

  return {
    db,
    env: parsedEnv,
    gammaClient,
    logger,
    marketSocket,
    repos: {
      freshnessRepo: {
        updateFreshness: (sourceKey: string, status: string) =>
          updateFreshness(db, sourceKey, status),
      },
      marketRepo: {
        insertSnapshot: (
          input: Parameters<typeof insertMarketSnapshot>[1],
        ) => insertMarketSnapshot(db, input),
        listTrackedTokens: () => listTrackedTokens(db),
        replaceTags: (
          marketId: string,
          tags: Parameters<typeof replaceTags>[2],
        ) => replaceTags(db, marketId, tags),
        upsertMarkets: (rows: Parameters<typeof upsertMarkets>[1]) =>
          upsertMarkets(db, rows),
      },
    },
  }
}
