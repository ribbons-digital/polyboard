import { useState } from 'react'

export function WatchlistForm({
  onSubmit,
}: {
  onSubmit: (input: {
    address: string
    note?: string
    isExcluded: boolean
  }) => Promise<void>
}) {
  const [address, setAddress] = useState('')
  const [note, setNote] = useState('')
  const [isExcluded, setIsExcluded] = useState(false)

  return (
    <form
      className="surface stack"
      onSubmit={async (event) => {
        event.preventDefault()
        await onSubmit({
          address,
          isExcluded,
          note: note || undefined,
        })
        setAddress('')
        setNote('')
        setIsExcluded(false)
      }}
    >
      <div>
        <p className="eyebrow">Watchlist</p>
        <h3>Add Wallet</h3>
      </div>
      <label className="field">
        <span>Address</span>
        <input
          onChange={(event) => setAddress(event.target.value)}
          placeholder="0x..."
          value={address}
        />
      </label>
      <label className="field">
        <span>Note</span>
        <input
          onChange={(event) => setNote(event.target.value)}
          placeholder="Why this wallet matters"
          value={note}
        />
      </label>
      <label className="checkbox-row">
        <input
          checked={isExcluded}
          onChange={(event) => setIsExcluded(event.target.checked)}
          type="checkbox"
        />
        <span>Exclude this wallet from leaderboards</span>
      </label>
      <div>
        <button className="action-button" type="submit">
          Save Watchlist Entry
        </button>
      </div>
    </form>
  )
}
