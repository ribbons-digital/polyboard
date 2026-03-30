import { describe, expect, it } from 'vitest'
import { parseMarketSocketMessages } from './market-socket'

describe('parseMarketSocketMessages', () => {
  it('fans out top-level price_change frames into normalized messages', () => {
    expect(
      parseMarketSocketMessages({
        event_type: 'price_change',
        timestamp: '1710000000000',
        price_changes: [
          { asset_id: 'token_yes', price: '0.61', best_bid: '0.6' },
          { asset_id: 'token_no', price: '0.39', best_ask: '0.4' },
        ],
      }),
    ).toEqual([
      {
        assetId: 'token_yes',
        bestBid: 0.6,
        bestAsk: undefined,
        price: 0.61,
        side: undefined,
        timestamp: 1710000000000,
      },
      {
        assetId: 'token_no',
        bestBid: undefined,
        bestAsk: 0.4,
        price: 0.39,
        side: undefined,
        timestamp: 1710000000000,
      },
    ])
  })

  it('ignores pong and non-quote frames', () => {
    expect(parseMarketSocketMessages('PONG')).toEqual([])
    expect(
      parseMarketSocketMessages({
        event_type: 'best_bid_ask',
        market: 'ignored',
      }),
    ).toEqual([])
  })
})
