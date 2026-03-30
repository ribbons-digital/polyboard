import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const styles = readFileSync(resolve(process.cwd(), 'src/styles.css'), 'utf8')

function getCssBlock(selector: string) {
  const start = styles.indexOf(selector)

  if (start === -1) {
    throw new Error(`Missing selector: ${selector}`)
  }

  const nextBlock = styles.indexOf('\n.', start + selector.length)
  return styles.slice(start, nextBlock === -1 ? styles.length : nextBlock)
}

describe('status banner palette', () => {
  it('keeps fallback red and degraded amber', () => {
    const fallbackBlock = getCssBlock('.data-status--fallback')
    const fallbackLabelBlock = getCssBlock(
      '.data-status--fallback .data-status__label',
    )
    const degradedBlock = getCssBlock('.data-status--degraded')
    const degradedLabelBlock = getCssBlock(
      '.data-status--degraded .data-status__label',
    )

    expect(fallbackBlock).toContain('rgba(255, 125, 93, 0.12)')
    expect(fallbackLabelBlock).toContain('#ff9d83')
    expect(degradedBlock).toContain('rgba(255, 197, 92, 0.12)')
    expect(degradedLabelBlock).toContain('#ffd277')
  })

  it('collapses the overview grid to one column on narrow screens', () => {
    const mobileBlock = getCssBlock('@media (max-width: 720px)')

    expect(mobileBlock).toContain('.overview-grid')
    expect(mobileBlock).toContain('grid-template-columns: 1fr;')
  })
})
