import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'
import { getWalletDetail, listWalletLeaderboard } from './service'

export const getWalletLeaderboard = createServerFn({ method: 'GET' }).handler(
  () => listWalletLeaderboard(),
)

export const getWalletById = createServerFn({ method: 'GET' })
  .inputValidator((input: unknown) =>
    z.object({ address: z.string() }).parse(input),
  )
  .handler(({ data }) => getWalletDetail(data.address))
