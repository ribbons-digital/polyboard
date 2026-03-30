import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'
import { getSettings, saveWatchlistEntry } from './service'

export const getAppSettings = createServerFn({ method: 'GET' }).handler(() =>
  getSettings(),
)

export const upsertWatchlist = createServerFn({ method: 'POST' })
  .inputValidator((input: unknown) =>
    z
      .object({
        address: z.string(),
        isExcluded: z.boolean().optional(),
        note: z.string().optional(),
      })
      .parse(input),
  )
  .handler(({ data }) => saveWatchlistEntry(data))
