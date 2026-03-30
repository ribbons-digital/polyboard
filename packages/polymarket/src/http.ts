import Bottleneck from 'bottleneck'

const limiter = new Bottleneck({
  minTime: 50,
  maxConcurrent: 4,
})

export async function fetchJson<T>(
  url: string | URL,
  init?: RequestInit,
): Promise<T> {
  return limiter.schedule(async () => {
    const response = await fetch(url, init)

    if (!response.ok) {
      throw new Error(
        `Polymarket request failed: ${response.status} ${response.statusText}`,
      )
    }

    return (await response.json()) as T
  })
}
