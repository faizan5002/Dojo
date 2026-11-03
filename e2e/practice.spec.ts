import { test, expect } from '@playwright/test'
import { buildDashboard } from '../src/features/dashboard/dashboard-model'
import {
	DEV_ASSESSMENTS,
	DEV_UPLOADS,
	devAssessment,
	devUploadView
} from '../src/features/dev-frontend/fixtures'

// Runs only against a dev server started with DOJO_DEV_FRONTEND_MODE=true, where the
// dashboard shows fixture data. The drill itself needs no database: it scores in the tab.
const FRONTEND_MODE = process.env.DOJO_DEV_FRONTEND_MODE === 'true'

const views = DEV_UPLOADS.flatMap((upload) => {
	const view = devUploadView(upload.id)
	return view == null ? [] : [view]
})
const valid = devAssessment(DEV_ASSESSMENTS[0]?.id)
const expected = buildDashboard({
	uploads: DEV_UPLOADS,
	assessments: DEV_ASSESSMENTS,
	newest: valid,
	valid,
	previous: devAssessment(DEV_ASSESSMENTS[1]?.id),
	validUploadView: devUploadView(valid?.uploadId ?? ''),
	recentUploadViews: views
})
const focus = expected.focus?.kind === 'ready' ? expected.focus : null

test.describe('practice drill with fixture data', () => {
	test.skip(!FRONTEND_MODE, 'set DOJO_DEV_FRONTEND_MODE=true for the dev server to run these')

	test('the focus leads to a drill on the same habit, with its own quote', async ({ page }) => {
		expect(focus).not.toBeNull()
		await page.goto('/dashboard')
		await page
			.getByRole('region', { name: 'Focus next' })
			.getByRole('link', { name: 'Try a rewrite drill' })
			.click()
		await expect(page).toHaveURL(/\/practice\?assessment=/)
		await expect(page.getByRole('heading', { level: 1 })).toHaveText(/rewrite one prompt/i)
		await expect(page.locator('blockquote').first()).toContainText(focus?.quote.excerpt ?? '')
		await expect(page.getByText('A rule-based check, not AI.', { exact: false })).toBeVisible()
	})

	test('a rewrite is checked with the assessment rules and nothing is saved', async ({ page }) => {
		test.skip(focus?.skill !== 'scopeControl', 'these rewrites are written for the scope drill')
		await page.goto(`/practice?assessment=${valid?.id}`)
		const box = page.getByRole('textbox', { name: 'Your rewrite' })
		const check = page.getByRole('button', { name: 'Check my rewrite' })
		await expect(check).toBeDisabled()

		await box.fill('Build the whole app with everything from scratch.')
		await check.click()
		const result = page.getByTestId('drill-result')
		await expect(result).toHaveAttribute('data-verdict', 'weaknessRemains')

		await box.fill(
			"In src/features/dashboard/ui/focus-next.tsx, add a link under the action. Don't change anything else."
		)
		await expect(result).toHaveCount(0)
		await check.click()
		await expect(result).toHaveAttribute('data-verdict', 'improved')
		await expect(page.getByTestId('drill-before')).toHaveText(String(focus?.score))
		await expect(page.getByTestId('drill-after')).toHaveText(/^\d+$/)
		await expect(result).toContainText('not saved')
		await expect(result).toContainText('One prompt is not a skill level')
	})

	test('says plainly when the text cannot be scored, instead of a result', async ({ page }) => {
		await page.goto(`/practice?assessment=${valid?.id}`)
		await page.getByRole('textbox', { name: 'Your rewrite' }).fill('ok')
		await page.getByRole('button', { name: 'Check my rewrite' }).click()
		const result = page.getByTestId('drill-result')
		await expect(result).toHaveAttribute('data-verdict', 'notEvaluable')
		await expect(page.getByTestId('drill-after')).toHaveCount(0)
	})

	test('has no horizontal overflow on a phone', async ({ page }) => {
		await page.setViewportSize({ width: 390, height: 844 })
		await page.goto(`/practice?assessment=${valid?.id}`)
		await page
			.getByRole('textbox', { name: 'Your rewrite' })
			.fill('Rename the helper in src/lib/format.ts. Only that file.')
		await page.getByRole('button', { name: 'Check my rewrite' }).click()
		await expect(page.getByTestId('drill-result')).toBeVisible()
		const overflow = await page.evaluate(
			() => document.documentElement.scrollWidth - window.innerWidth
		)
		expect(overflow).toBeLessThanOrEqual(0)
	})
})
