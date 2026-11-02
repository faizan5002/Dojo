import { randomUUID } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { join, sep } from 'node:path'
import { test, expect, type Page } from '@playwright/test'
import { PrismaClient } from '@prisma/client'
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs'
import { STRONG_PROMPTS, WEAK_PROMPTS } from '../src/features/assessment/session-fixtures'
import {
	canUseAuth,
	createTestUser,
	deleteTestUser,
	logFile,
	signIn,
	type TestUser
} from './workspace-helpers'

const STANDARD_FONTS = `${join(process.cwd(), 'node_modules', 'pdfjs-dist', 'standard_fonts').replaceAll(sep, '/')}/`
const SLOW_RESPONSE_MS = 1_500

async function pdfText(path: string): Promise<{ pages: number; text: string }> {
	const document = await getDocument({
		data: new Uint8Array(await readFile(path)),
		standardFontDataUrl: STANDARD_FONTS
	}).promise
	const parts: string[] = []
	for (let number = 1; number <= document.numPages; number++) {
		const page = await document.getPage(number)
		for (const item of (await page.getTextContent()).items) if ('str' in item) parts.push(item.str)
	}
	return { pages: document.numPages, text: parts.join(' ').replace(/\s+/g, ' ') }
}

async function uploadAndScore(page: Page, prompts: readonly string[], sessionId: string) {
	await page.goto('/sessions')
	await page
		.getByLabel('Choose log files')
		.setInputFiles([logFile({ name: `${sessionId}.md`, sessionId, prompts })])
	await expect(page).toHaveURL(/\/sessions\?upload=/)
	await page.getByRole('link', { name: 'Score my workflow' }).click()
	await page.getByRole('button', { name: 'Analyze my workflow' }).click()
	await expect(page).toHaveURL(/\/assessment\?id=/)
	return new URL(page.url()).searchParams.get('id') ?? ''
}

async function downloadReport(page: Page) {
	const download = page.waitForEvent('download')
	await page.getByRole('button', { name: 'Download PDF report' }).click()
	const file = await download
	const path = test.info().outputPath(file.suggestedFilename())
	await file.saveAs(path)
	return { filename: file.suggestedFilename(), ...(await pdfText(path)) }
}

test('a signed-out request for a report is refused', async ({ request }) => {
	const response = await request.get(`/api/assessments/${randomUUID()}/pdf`)
	expect(response.status()).toBe(401)
})

test.describe('assessment PDF report', () => {
	test.skip(!canUseAuth, 'Supabase is not configured for this server')
	test.describe.configure({ mode: 'serial' })
	let owner: TestUser
	let stranger: TestUser
	let olderId = ''
	let olderScore = ''

	test.beforeAll(async () => {
		owner = await createTestUser()
		stranger = await createTestUser()
	})
	test.afterAll(async () => {
		await deleteTestUser(owner)
		await deleteTestUser(stranger)
	})

	test('the report of the open assessment downloads with its exact score', async ({ page }) => {
		await signIn(page, owner)
		olderId = await uploadAndScore(page, WEAK_PROMPTS, 'weak-session')
		olderScore = (await page.getByTestId('overall-score').textContent()) ?? ''
		const report = await downloadReport(page)
		expect(report.filename).toMatch(
			new RegExp(`^dojo-assessment-\\d{4}-\\d{2}-\\d{2}-${olderId.slice(0, 8)}\\.pdf$`)
		)
		expect(report.pages).toBeGreaterThan(1)
		expect(olderScore).toMatch(/^\d{1,3}$/)
		expect(report.text).toMatch(new RegExp(`(^| )${olderScore}( |$)`))
		expect(report.text).toContain(`Page 1 of ${report.pages}`)
		expect(report.text).toContain(olderId)
		for (const skill of ['Prompt clarity', 'Planning before coding', 'Scope control']) {
			expect(report.text).toContain(skill)
		}
	})

	test('an older assessment downloads its own report, not the latest', async ({ page }) => {
		await signIn(page, owner)
		const newerId = await uploadAndScore(page, STRONG_PROMPTS, 'strong-session')
		const newerScore = (await page.getByTestId('overall-score').textContent()) ?? ''
		expect(newerScore).not.toBe(olderScore)

		await page.goto(`/assessment?id=${olderId}`)
		await expect(page.getByTestId('overall-score')).toHaveText(olderScore)
		const report = await downloadReport(page)
		expect(report.text).toContain(olderId)
		expect(report.text).not.toContain(newerId)
		expect(report.filename).toContain(olderId.slice(0, 8))
	})

	test("another account's report is not found", async ({ page }) => {
		const db = new PrismaClient()
		const count = await db.assessment.count({ where: { userId: owner.id } })
		await db.$disconnect()
		expect(count).toBeGreaterThan(0)

		await signIn(page, stranger)
		const response = await page.request.get(`/api/assessments/${olderId}/pdf`)
		expect(response.status()).toBe(404)
		expect(response.headers()['content-type']).not.toContain('pdf')
	})

	test('the button shows its progress, blocks a second click, and reports a failure', async ({
		page
	}) => {
		await signIn(page, owner)
		await page.goto(`/assessment?id=${olderId}`)

		await page.route('**/api/assessments/*/pdf', async (route) => {
			await new Promise((resolve) => setTimeout(resolve, SLOW_RESPONSE_MS))
			await route.continue()
		})
		const download = page.waitForEvent('download')
		await page.getByRole('button', { name: 'Download PDF report' }).click()
		const busy = page.getByRole('button', { name: 'Preparing your report…' })
		await expect(busy).toBeDisabled()
		await download
		await expect(page.getByRole('button', { name: 'Download PDF report' })).toBeEnabled()

		await page.unroute('**/api/assessments/*/pdf')
		await page.route('**/api/assessments/*/pdf', (route) =>
			route.fulfill({ status: 500, body: '{}' })
		)
		await page.getByRole('button', { name: 'Download PDF report' }).click()
		await expect(page.getByText("The report couldn't be prepared. Try again.")).toBeVisible()
		await expect(page.getByTestId('overall-score')).toHaveText(olderScore)
	})
})
