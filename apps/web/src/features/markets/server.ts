import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'
import { getMarketDetail, listMarketLeaderboard } from './service'

const filterSchema = z.object({
  category: z.string().optional(),
  minEdge: z.number().optional(),
  search: z.string().optional(),
})

export const getMarketLeaderboard = createServerFn({ method: 'GET' })
  .inputValidator((input: unknown) => filterSchema.parse(input))
  .handler(({ data }) => listMarketLeaderboard(data))

export const getMarketById = createServerFn({ method: 'GET' })
  .inputValidator((input: unknown) =>
    z.object({ marketId: z.string() }).parse(input),
  )
  .handler(({ data }) => getMarketDetail(data.marketId))
