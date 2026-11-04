import { test, expect } from '@playwright/test'
import { logFile } from './workspace-helpers'

// Runs only against a dev server started with DOJO_DEV_FRONTEND_MODE=true, which
// shows fixture data for a mock user. The real sign-in specs run without it.
// (workspace-helpers loads .env.local, the same file the dev server reads.)
const FRONTEND_MODE = process.env.DOJO_DEV_FRONTEND_MODE === 'true'

test.describe('development frontend mode', () => {
	test.skip(!FRONTEND_MODE, 'set DOJO_DEV_FRONTEND_MODE=true for the dev server to run these')

	test('opens the workspace with a labelled mock user and no sign-in', async ({ page }) => {
		await page.goto('/sessions')
		await expect(page).toHaveURL(/\/sessions$/)
		await expect(page.getByTestId('dev-frontend-banner')).toContainText('Frontend dev mode')
		await expect(page.getByRole('link', { name: 'Assessment' })).toBeVisible()
	})

	test('keeps the real sign-in and sign-up pages reachable', async ({ page }) => {
		for (const path of ['/sign-in', '/sign-up']) {
			await page.goto(path)
			await expect(page).toHaveURL(new RegExp(`${path}$`))
			await expect(page.getByLabel('Email')).toBeVisible()
			await expect(page.getByLabel('Password')).toBeVisible()
		}
	})

	test('shows fixture assessments, and the history searches, filters and sorts', async ({
		page
	}) => {
		await page.goto('/assessment')
		await expect(page.getByTestId('overall-score')).toHaveText(/^\d{1,3}$/)
		await expect(page.locator('li[id^="skill-"]')).toHaveCount(5)

		const history = page.getByRole('region', { name: 'Past assessments' })
		const rows = history.getByRole('listitem')
		await expect(rows).toHaveCount(3)
		await expect(history.getByRole('status')).toHaveText('Showing 3 of 3')

		const scores = async () =>
			(await rows.allTextContents()).map((text) => Number(/(\d+) out of 100/.exec(text)?.[1]))
		await history.getByLabel('Sort').selectOption('lowest')
		const ascending = await scores()
		expect(ascending).toEqual([...ascending].sort((a, b) => a - b))
		await history.getByLabel('Sort').selectOption('highest')
		const descending = await scores()
		expect(descending).toEqual([...descending].sort((a, b) => b - a))

		const top = descending[0]
		await history.getByLabel('Search').fill(String(top))
		await expect(rows.first()).toContainText(`${top} out of 100`)
		await history.getByLabel('Search').fill('no such assessment')
		await expect(history.getByText('No assessments match.')).toBeVisible()
		await history.getByRole('button', { name: 'Clear search and filter' }).click()
		await expect(rows).toHaveCount(3)

		await history.getByLabel('Level').selectOption('unscored')
		await expect(history.getByText('No assessments match.')).toBeVisible()
	})

	test('opens an older fixture assessment from the history', async ({ page }) => {
		await page.goto('/assessment')
		const history = page.getByRole('region', { name: 'Past assessments' })
		await history.getByRole('link', { name: 'Open' }).first().click()
		await expect(page).toHaveURL(/\/assessment\?id=/)
		await expect(page.getByTestId('overall-score')).toHaveText(/^\d{1,3}$/)
	})

	test('downloads the PDF report of a fixture assessment', async ({ page }) => {
		await page.goto('/assessment')
		const download = page.waitForEvent('download')
		await page.getByRole('button', { name: 'Download PDF report' }).click()
		const file = await download
		expect(file.suggestedFilename()).toMatch(/^dojo-assessment-\d{4}-\d{2}-\d{2}-[0-9a-f]{8}\.pdf$/)
		const path = test.info().outputPath(file.suggestedFilename())
		await file.saveAs(path)
		const { statSync, readFileSync } = await import('node:fs')
		expect(statSync(path).size).toBeGreaterThan(10_000)
		expect(readFileSync(path).subarray(0, 5).toString()).toBe('%PDF-')
	})

	test('says plainly that saving needs a real account instead of pretending', async ({ page }) => {
		await page.goto('/sessions')
		await page
			.getByLabel('Choose log files')
			.setInputFiles([logFile({ name: 'x.md', sessionId: 'x', prompts: ['Fix the bug in a.ts.'] })])
		await expect(page.getByText(/Frontend dev mode shows sample data only/)).toBeVisible()
		await expect(page).not.toHaveURL(/upload=/)
	})

	test('account deletion says there is no real account instead of failing', async ({ page }) => {
		await page.goto('/account')
		await page.getByLabel('Confirm with your email').fill('frontend-dev@dojo.invalid')
		await page.getByRole('button', { name: 'Delete my account and data' }).click()
		await expect(page.getByText(/Frontend dev mode shows sample data only/)).toBeVisible()
		await expect(page).toHaveURL(/\/account$/)
	})

	for (const [name, width, height] of [
		['phone', 390, 844],
		['tablet', 768, 1024]
	] as const) {
		test(`the assessment and sessions pages fit a ${name} screen`, async ({ page }) => {
			await page.setViewportSize({ width, height })
			for (const path of ['/assessment', '/sessions']) {
				await page.goto(path)
				await expect(page.getByTestId('dev-frontend-banner')).toBeVisible()
				const overflow = await page.evaluate(
					() => document.documentElement.scrollWidth - document.documentElement.clientWidth
				)
				expect(overflow, `${path} overflows horizontally at ${width}px`).toBeLessThanOrEqual(0)
			}
		})
	}
})
