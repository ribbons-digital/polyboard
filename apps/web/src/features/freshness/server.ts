import { createServerFn } from '@tanstack/react-start'
import { getFreshnessSummary } from './service'

export const getDashboardFreshness = createServerFn({ method: 'GET' }).handler(
  () => getFreshnessSummary(),
)
