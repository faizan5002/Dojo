import { test, expect, type Page } from '@playwright/test'
import messages from '../messages/en.json'
import { focusOf } from '../src/features/dashboard/dashboard-model'
import { loadSample } from '../src/features/sample/sample-session'
import {
	canUseAuth,
	createTestUser,
	deleteTestUser,
	signIn,
	visit,
	type TestUser
} from './workspace-helpers'

// The public sample journey: no account, no upload, no database. Runs with or without
// the dev frontend mode; the signed-out redirect check skips when the mode is on.
const FRONTEND_MODE = process.env.DOJO_DEV_FRONTEND_MODE === 'true'

const skillName = (id: string) =>
	(messages.Assessment.skills as Record<string, { name: string }>)[id]?.name ?? id

const region = (page: Page, name: string) => page.getByRole('region', { name })

// Every request a server action or write would make is a POST; the sample journey makes none.
function watchWrites(page: Page): string[] {
	const writes: string[] = []
	page.on('request', (request) => {
		if (request.method() !== 'GET' && request.method() !== 'HEAD') {
			writes.push(`${request.method()} ${request.url()}`)
		}
	})
	return writes
}

test.describe('sample session, signed out', () => {
	test('the sign-in and sign-up pages offer it, and it opens from the keyboard', async ({
		page
	}) => {
		for (const path of ['/sign-in', '/sign-up']) {
			await page.goto(path)
			await expect(page.getByRole('link', { name: 'Try a sample session' })).toBeVisible()
		}
		await visit(page, '/sign-in')
		await page.getByRole('link', { name: 'Try a sample session' }).focus()
		await page.keyboard.press('Enter')
		await expect(page).toHaveURL(/\/sample$/)
	})

	test('loads without an upload, and says it is demonstration data', async ({ page }) => {
		const writes = watchWrites(page)
		const sample = await loadSample()
		await page.goto('/sample')
		await expect(page.getByTestId('sample-banner')).toContainText('Demonstration data')
		await expect(page.locator('input[type="file"]')).toHaveCount(0)
		const prompts = sample.sessions.flatMap((session) =>
			session.turns.flatMap((turn) => (turn.prompt == null ? [] : [turn.prompt.text]))
		)
		await expect(page.getByTestId('sample-prompts').locator('li')).toHaveCount(prompts.length)
		await expect(page.getByTestId('sample-prompts')).toContainText(prompts[0] ?? '')
		await expect(page.getByRole('link', { name: 'Use my own logs instead' })).toBeVisible()
		expect(writes).toEqual([])
	})

	test('the whole journey: assess, understand, evidence, Focus next, drill, result', async ({
		page
	}) => {
		const writes = watchWrites(page)
		const { stored } = await loadSample()
		const focus = focusOf(stored, null)
		expect(focus.kind).toBe('ready')
		if (focus.kind !== 'ready') return

		await visit(page, '/sample')
		await page.getByRole('link', { name: 'Run the assessment' }).click()
		await expect(page).toHaveURL(/\/sample\/assessment$/)
		await expect(page.getByTestId('sample-banner')).toContainText('Demonstration data')

		// The five skills, with the scores the real rules produced.
		for (const skill of stored.assessment.skills) {
			const row = page.locator(`#skill-${skill.skill}`)
			await expect(row).toContainText(skillName(skill.skill))
			await expect(row).toContainText(String(skill.score))
		}
		expect(stored.assessment.skills).toHaveLength(5)

		// Focus next: the weakest skill, with its own quote.
		const block = region(page, 'Focus next')
		await expect(block).toContainText(skillName(focus.skill))
		await expect(block.getByTestId('focus-score')).toHaveText(String(focus.score))
		await expect(block.locator('blockquote')).toContainText(focus.quote.excerpt)
		expect(stored.assessment.overall.weakest).toBe(focus.skill)

		// Evidence: the link lands on that skill's evidence in the same assessment.
		await block.getByRole('link', { name: 'See evidence' }).click()
		await expect(page).toHaveURL(new RegExp(`/sample/assessment#skill-${focus.skill}$`))
		await expect(page.locator(`#skill-${focus.skill}`)).toContainText(focus.quote.excerpt)

		// Focus next to the drill on the same habit.
		await block.getByRole('link', { name: 'Try a rewrite drill' }).click()
		await expect(page).toHaveURL(/\/sample\/practice$/)
		await expect(page.getByTestId('sample-banner')).toContainText('Demonstration data')
		await expect(page.locator('blockquote').first()).toContainText(focus.quote.excerpt)
		await expect(page.getByText('A rule-based check, not AI.', { exact: false })).toBeVisible()

		const box = page.getByRole('textbox', { name: 'Your rewrite' })
		const check = page.getByRole('button', { name: 'Check my rewrite' })
		const result = page.getByTestId('drill-result')

		// Text the rules cannot read is said so, not scored.
		await box.fill('ok')
		await check.click()
		await expect(result).toHaveAttribute('data-verdict', 'notEvaluable')
		await expect(page.getByTestId('drill-after')).toHaveCount(0)

		// A specific follow-up is scored by the same rules, beside the assessment's own score.
		await box.fill('Still failing: expected the total to be 12 but got 10, in src/cart.ts.')
		await check.click()
		await expect(result).toHaveAttribute('data-verdict', 'improved')
		await expect(page.getByTestId('drill-before')).toHaveText(String(focus.score))
		await expect(page.getByTestId('drill-after')).toHaveText(/^\d+$/)
		await expect(result).toContainText('One prompt is not a skill level')
		await expect(result).toContainText('not saved')

		// Nothing in the journey wrote anything.
		expect(writes).toEqual([])
	})

	test('every sample page fits a phone', async ({ page }) => {
		await page.setViewportSize({ width: 390, height: 844 })
		for (const path of ['/sample', '/sample/assessment', '/sample/practice']) {
			await page.goto(path)
			await expect(page.getByTestId('sample-banner')).toBeVisible()
			const overflow = await page.evaluate(
				() => document.documentElement.scrollWidth - window.innerWidth
			)
			expect(overflow, path).toBeLessThanOrEqual(0)
		}
	})

	test('the protected pages still send a signed-out visitor to sign in', async ({ page }) => {
		test.skip(FRONTEND_MODE, 'frontend dev mode is on')
		for (const path of ['/dashboard', '/sessions', '/assessment', '/practice', '/account']) {
			await page.goto(path)
			await expect(page).toHaveURL(/\/sign-in$/)
		}
		await page.goto('/sample')
		await expect(page).toHaveURL(/\/sample$/)
	})
})

test.describe('sample session, signed in', () => {
	test.skip(!canUseAuth || FRONTEND_MODE, 'needs real Supabase and the dev frontend mode off')
	let user: TestUser

	test.beforeAll(async () => {
		user = await createTestUser()
	})
	test.afterAll(async () => {
		await deleteTestUser(user)
	})

	test('using the sample creates nothing in a real account', async ({ page }) => {
		const writes = watchWrites(page)
		await signIn(page, user)
		await page.goto('/sample/assessment')
		await expect(page.getByTestId('sample-banner')).toContainText('Demonstration data')
		await page.getByRole('link', { name: 'Try a rewrite drill' }).click()
		await page.getByRole('textbox', { name: 'Your rewrite' }).fill('ok')
		await page.getByRole('button', { name: 'Check my rewrite' }).click()
		await expect(page.getByTestId('drill-result')).toBeVisible()

		// The account is still brand new: no upload, no assessment, no coaching.
		await page.goto('/dashboard')
		await expect(page.getByRole('heading', { level: 1 })).toHaveText('Welcome to Dojo')
		await expect(region(page, 'Focus next')).toHaveCount(0)
		await page.goto('/assessment')
		await expect(page.getByText('No sessions to assess yet', { exact: false })).toBeVisible()
		expect(writes.filter((write) => write.includes('/sample'))).toEqual([])
	})
})
