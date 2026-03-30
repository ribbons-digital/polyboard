import {
  createDb,
  getDashboardUsability,
  insertMarketSnapshot,
  listSignalInputs,
  listTrackedTokens,
  replaceClosedPositions,
  replaceOpenPositions,
  replaceTrades,
  replaceWalletEventStats,
  replaceTags,
  updateFreshness,
  upsertMarketScore,
  upsertMarkets,
  upsertWalletProfiles,
  upsertWalletScore,
} from '@polyboard/db'
import {
  DataClient,
  GammaClient,
  MarketSocket,
} from '../../../packages/polymarket/src/index'
import pino from 'pino'
import { parseWorkerEnv } from './config'

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
    repos: {
      freshnessRepo: {
        getDashboardUsability: () => getDashboardUsability(db),
        updateFreshness: (
          sourceKey: string,
          status: string,
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
        replaceClosedPositions: (
          walletAddress: string,
          rows: Parameters<typeof replaceClosedPositions>[2],
        ) => replaceClosedPositions(db, walletAddress, rows),
        replaceOpenPositions: (
          walletAddress: string,
          rows: Parameters<typeof replaceOpenPositions>[2],
        ) => replaceOpenPositions(db, walletAddress, rows),
        replaceTrades: (
          walletAddress: string,
          rows: Parameters<typeof replaceTrades>[2],
        ) => replaceTrades(db, walletAddress, rows),
        replaceWalletEventStats: (
          walletAddress: string,
          rows: Parameters<typeof replaceWalletEventStats>[2],
        ) => replaceWalletEventStats(db, walletAddress, rows),
        upsertWalletProfiles: (
          rows: Parameters<typeof upsertWalletProfiles>[1],
        ) => upsertWalletProfiles(db, rows),
        upsertWalletScore: (input: Parameters<typeof upsertWalletScore>[1]) =>
          upsertWalletScore(db, input),
      },
    },
  }
}
