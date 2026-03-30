import { createFileRoute } from '@tanstack/react-router'
import { HomePage } from '../features/home/home-page'
import { loadDashboardRouteData } from '../features/route-loaders'

export const Route = createFileRoute('/')({
  loader: () => loadDashboardRouteData(),
  component: HomeRoute,
})

function HomeRoute() {
  const data = Route.useLoaderData()

  return (
    <HomePage
      markets={data.markets}
      summary={data.freshness}
      wallets={data.wallets}
    />
  )
}
