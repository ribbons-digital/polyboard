import {
  createDb,
  ensureSettingsRow,
  getDashboardUsability,
  insertMarketSnapshot,
  type FreshnessStatus,
  listSignalInputs,
  listTrackedTokens,
  replaceTags,
  updateFreshness,
  upsertMarketScore,
  upsertMarkets,
  upsertWalletProfiles,
  upsertWalletScore,
} from '@polyboard/db'
import { DataClient, GammaClient, MarketSocket } from '@polyboard/polymarket'
import pino from 'pino'
import * as seedDevScript from '../../../scripts/seed-dev'
import { parseWorkerEnv } from './config'

type SeedDevScriptModule = {
  default?: {
    seedDevelopmentData?: () => Promise<void>
  }
  seedDevelopmentData?: () => Promise<void>
}

function resolveSeedFallback() {
  const module = seedDevScript as SeedDevScriptModule | undefined
  const seedFunction =
    module?.seedDevelopmentData ?? module?.default?.seedDevelopmentData

  if (typeof seedFunction === 'function') {
    return seedFunction
  }

  return async () => {
    throw new Error('scripts/seed-dev did not export seedDevelopmentData')
  }
}

export function createRuntime(env: Record<string, string | undefined> = process.env) {
  const parsedEnv = parseWorkerEnv(env)
  const db = createDb(env)
  const logger = pino({ name: 'polyboard-worker' })
  const dataClient = new DataClient(parsedEnv.dataUrl)
  const gammaClient = new GammaClient(parsedEnv.gammaUrl)
  const marketSocket = new MarketSocket(parsedEnv.wsUrl)

  return {
    db,
    dataClient,
    env: parsedEnv,
    gammaClient,
    logger,
    marketSocket,
    seedFallback: resolveSeedFallback(),
    repos: {
      freshnessRepo: {
        getDashboardUsability: () => getDashboardUsability(db),
        updateFreshness: (
          sourceKey: string,
          status: FreshnessStatus,
          completeness?: string,
        ) => updateFreshness(db, sourceKey, status, completeness),
      },
      marketRepo: {
        insertSnapshot: (
          input: Parameters<typeof insertMarketSnapshot>[1],
        ) => insertMarketSnapshot(db, input),
        listTrackedTokens: () => listTrackedTokens(db),
        listSignalInputs: () => listSignalInputs(db),
        replaceTags: (
          marketId: string,
          tags: Parameters<typeof replaceTags>[2],
        ) => replaceTags(db, marketId, tags),
        upsertScore: (input: Parameters<typeof upsertMarketScore>[1]) =>
          upsertMarketScore(db, input),
        upsertMarkets: (rows: Parameters<typeof upsertMarkets>[1]) =>
          upsertMarkets(db, rows),
      },
      walletRepo: {
        upsertWalletProfiles: (
          rows: Parameters<typeof upsertWalletProfiles>[1],
        ) => upsertWalletProfiles(db, rows),
        upsertWalletScore: (input: Parameters<typeof upsertWalletScore>[1]) =>
          upsertWalletScore(db, input),
      },
    },
    settingsRepo: {
      getSettings: () => ensureSettingsRow(db),
    },
  }
}
