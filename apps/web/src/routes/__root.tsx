/// <reference types="vite/client" />
import { QueryClientProvider } from '@tanstack/react-query'
import { ReactQueryDevtools } from '@tanstack/react-query-devtools'
import {
  createRootRouteWithContext,
  HeadContent,
  Link,
  Outlet,
  Scripts,
} from '@tanstack/react-router'
import { TanStackRouterDevtools } from '@tanstack/react-router-devtools'
import type { ReactNode } from 'react'
import { queryClient } from '../router'
import appCss from '../styles.css?url'

export const Route = createRootRouteWithContext<{
  queryClient: typeof queryClient
}>()({
  head: () => ({
    meta: [
      { charSet: 'utf-8' },
      { name: 'viewport', content: 'width=device-width, initial-scale=1' },
      { title: 'Polyboard' },
    ],
    links: [{ rel: 'stylesheet', href: appCss }],
  }),
  component: RootComponent,
})

function RootComponent() {
  return (
    <RootDocument>
      <QueryClientProvider client={queryClient}>
        <div className="app-shell">
          <header className="topbar">
            <div>
              <p className="eyebrow">Private research console</p>
              <h1>Polyboard</h1>
            </div>
            <nav className="nav">
              <Link to="/">Overview</Link>
              <span className="nav-label">Markets</span>
              <span className="nav-label">Wallets</span>
              <span className="nav-label">Settings</span>
            </nav>
          </header>
          <main className="page">
            <Outlet />
          </main>
        </div>
        <ReactQueryDevtools initialIsOpen={false} />
        <TanStackRouterDevtools position="bottom-right" />
      </QueryClientProvider>
    </RootDocument>
  )
}

function RootDocument({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  )
}
