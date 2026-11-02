import { test, expect } from '@playwright/test'
import { PrismaClient } from '@prisma/client'
import { STRONG_PROMPTS, WEAK_PROMPTS } from '../src/features/assessment/session-fixtures'
import {
	canUseAuth,
	createTestUser,
	deleteTestUser,
	logFile,
	signIn,
	type TestUser
} from './workspace-helpers'

const PHONE = { width: 390, height: 844 }

test.describe('assessment', () => {
	test.skip(!canUseAuth, 'Supabase is not configured for this server')
	test.describe.configure({ mode: 'serial' })
	let owner: TestUser
	let stranger: TestUser

	test.beforeAll(async () => {
		owner = await createTestUser()
		stranger = await createTestUser()
	})
	test.afterAll(async () => {
		await deleteTestUser(owner)
		await deleteTestUser(stranger)
	})

	test('with no uploads, the assessment points to Sessions', async ({ page }) => {
		await signIn(page, stranger)
		await page.goto('/assessment')
		await expect(page.getByRole('heading', { name: 'No sessions to assess yet' })).toBeVisible()
	})

	test('an assessment is saved, survives a reload, and joins the history', async ({ page }) => {
		await signIn(page, owner)
		await page
			.getByLabel('Choose log files')
			.setInputFiles([
				logFile({ name: 'strong.md', sessionId: 'strong-session', prompts: STRONG_PROMPTS }),
				logFile({ name: 'weak.md', sessionId: 'weak-session', prompts: WEAK_PROMPTS })
			])
		await expect(page).toHaveURL(/\/sessions\?upload=/)

		await page.getByRole('link', { name: 'Score my workflow' }).click()
		await page.getByRole('button', { name: 'Analyze my workflow' }).click()
		await expect(page).toHaveURL(/\/assessment\?id=/)
		const score = page.getByTestId('overall-score')
		await expect(score).toHaveText(/^\d{1,3}$/)
		const firstScore = await score.textContent()
		await expect(page.locator('li[id^="skill-"]')).toHaveCount(5)

		const clarity = page.locator('#skill-promptClarity')
		await clarity.getByText(/^Evidence \(\d+\)$/).click()
		const written = [...STRONG_PROMPTS, ...WEAK_PROMPTS]
		for (const quote of await clarity.locator('blockquote').allTextContents()) {
			const exact = quote.replace(/^… /, '').replace(/ …$/, '')
			expect(
				written.some((text) => text.includes(exact)),
				`not from the logs: ${exact}`
			).toBe(true)
		}

		await page.reload()
		await expect(score).toHaveText(firstScore ?? '')

		await page.getByRole('link', { name: 'Score again' }).click()
		await page.getByRole('button', { name: 'Analyze my workflow' }).click()
		await expect(page).toHaveURL(/\/assessment\?id=/)
		const history = page.getByRole('region', { name: 'Past assessments' }).getByRole('listitem')
		await expect(history).toHaveCount(2)
	})

	test("another account's assessment is not found, not shown", async ({ page }) => {
		const db = new PrismaClient()
		const owned = await db.assessment.findFirst({
			where: { userId: owner.id },
			select: { id: true }
		})
		await db.$disconnect()
		expect(owned, 'the previous test saved an assessment').not.toBeNull()

		await signIn(page, stranger)
		const response = await page.goto(`/assessment?id=${owned?.id}`)
		expect(response?.status()).toBe(404)
	})

	test('the assessment fits a phone screen', async ({ page }) => {
		await signIn(page, owner)
		await page.setViewportSize(PHONE)
		await page.goto('/assessment')
		await expect(page.getByTestId('overall-score')).toBeVisible()
		const overflow = await page.evaluate(
			() => document.documentElement.scrollWidth - window.innerWidth
		)
		expect(overflow).toBe(0)
	})
})
