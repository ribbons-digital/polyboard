import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'
import { getWalletDetail, listWalletLeaderboard } from './service'

export const getWalletLeaderboard = createServerFn({ method: 'GET' })
  .inputValidator((input: unknown) =>
    z
      .object({
        limit: z.number().int().positive().max(100).optional(),
      })
      .optional()
      .parse(input),
  )
  .handler(({ data }) => listWalletLeaderboard(data))

export const getWalletById = createServerFn({ method: 'GET' })
  .inputValidator((input: unknown) =>
    z.object({ address: z.string() }).parse(input),
  )
  .handler(({ data }) => getWalletDetail(data.address))
