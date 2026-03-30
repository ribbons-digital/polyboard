export function WalletTagList({ tags }: { tags: string[] }) {
  if (tags.length === 0) {
    return <span className="table-summary">No tags yet.</span>
  }

  return (
    <div className="pill-row">
      {tags.map((tag) => (
        <span className="tag-pill" key={tag}>
          {tag}
        </span>
      ))}
    </div>
  )
}
