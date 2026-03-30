import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { normalizeGammaMarket, normalizeSocketMessage } from './normalizers'

describe('normalizeGammaMarket', () => {
  it('extracts market and token metadata from the Gamma payload', () => {
    const raw = JSON.parse(
      readFileSync(
        new URL('../test/fixtures/gamma-market.json', import.meta.url),
        'utf8',
      ),
    )

    expect(normalizeGammaMarket(raw)).toMatchObject({
      id: '12345',
      question: 'Will BTC close above $100k on Friday?',
      volume: 125000.5,
      liquidity: 42000.1,
      tokens: [
        { id: 'token_yes', outcome: 'Yes', outcomeIndex: 0 },
        { id: 'token_no', outcome: 'No', outcomeIndex: 1 },
      ],
    })
  })
})

describe('normalizeSocketMessage', () => {
  it('converts numeric socket fields into typed values', () => {
    expect(
      normalizeSocketMessage({
        asset_id: 'token_yes',
        best_bid: '0.42',
        best_ask: '0.44',
        price: '0.43',
        side: 'BUY',
        timestamp: '1710000000000',
      }),
    ).toEqual({
      assetId: 'token_yes',
      bestBid: 0.42,
      bestAsk: 0.44,
      price: 0.43,
      side: 'BUY',
      timestamp: 1710000000000,
    })
  })
})
