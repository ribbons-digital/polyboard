import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const currentDir = dirname(fileURLToPath(import.meta.url))
const rootRoutePath = resolve(currentDir, 'routes/__root.tsx')

describe('app shell metadata', () => {
  it('declares the favicon asset in the root route head', () => {
    const rootRouteSource = readFileSync(rootRoutePath, 'utf8')

    expect(rootRouteSource).toContain('/favicon.svg')
  })
})
