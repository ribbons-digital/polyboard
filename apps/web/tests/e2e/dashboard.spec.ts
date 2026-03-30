import { expect, test } from '@playwright/test'

test('dashboard exposes the primary navigation and leaderboard headings', async ({
  page,
}) => {
  await page.goto('/')

  await expect(page.getByRole('link', { name: 'Markets' })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Wallets' })).toBeVisible()
  await expect(
    page.getByRole('heading', { name: /live polymarket intelligence/i }),
  ).toBeVisible()
})
