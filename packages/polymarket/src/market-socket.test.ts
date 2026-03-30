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

  it('derives top-of-book prices from book snapshots', () => {
    expect(
      parseMarketSocketMessages({
        event_type: 'book',
        asset_id: 'token_yes',
        timestamp: '1710000000000',
        bids: [
          { price: '0.59', size: '120' },
          { price: '0.58', size: '80' },
        ],
        asks: [
          { price: '0.61', size: '100' },
          { price: '0.62', size: '70' },
        ],
      }),
    ).toEqual([
      {
        assetId: 'token_yes',
        bestBid: 0.59,
        bestAsk: 0.61,
        price: undefined,
        side: undefined,
        timestamp: 1710000000000,
      },
    ])
  })
})
