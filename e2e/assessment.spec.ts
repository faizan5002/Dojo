import { test, expect, type Request } from '@playwright/test'
import { STRONG_PROMPTS, WEAK_PROMPTS } from '../src/features/assessment/session-fixtures'
import { buildLog, prompt, response } from '../src/features/sessions/log-fixture'

const ANALYTICS_SCRIPT_ORIGIN = 'https://va.vercel-scripts.com'
const PHONE = { width: 390, height: 844 }

function logFile(name: string, sessionId: string, prompts: readonly string[]) {
	const at = (minute: number) => new Date(Date.UTC(2026, 10, 1, 10, minute)).toISOString()
	const text = buildLog({
		sessionId,
		entries: prompts.flatMap((text, index) => [
			prompt(at(index * 2), text),
			response(at(index * 2 + 1), 'Done.')
		])
	})
	return { name, mimeType: 'text/markdown', buffer: Buffer.from(text) }
}

test('the assessment asks for logs when none are loaded', async ({ page }) => {
	await page.goto('/assessment')
	await expect(page.getByRole('heading', { name: 'No sessions to assess yet' })).toBeVisible()
	await page.getByRole('link', { name: 'Go to sessions' }).click()
	await expect(page).toHaveURL(/\/sessions$/)
})

test('logs chosen on Sessions are scored on Assessment, with evidence quoted from them', async ({
	page,
	baseURL
}) => {
	const requests: Request[] = []
	page.on('request', (request) => requests.push(request))

	await page.goto('/sessions')
	await expect(page.getByRole('heading', { level: 1, name: 'Your sessions' })).toBeVisible()
	await page
		.getByLabel('Choose log files')
		.setInputFiles([
			logFile('strong.md', 'strong-session', STRONG_PROMPTS),
			logFile('weak.md', 'weak-session', WEAK_PROMPTS)
		])
	await expect(page.getByRole('table')).toBeVisible()

	await page.getByRole('link', { name: 'Score my workflow' }).click()
	await expect(page).toHaveURL(/\/assessment$/)
	await expect(
		page.getByRole('heading', { name: 'Your sessions are ready to score' })
	).toBeVisible()
	await page.getByRole('button', { name: 'Analyze my workflow' }).click()

	const score = page.getByTestId('overall-score')
	await expect(score).toHaveText(/^\d{1,3}$/)
	await expect(page.locator('li[id^="skill-"]')).toHaveCount(5)
	await expect(page.getByText(/rubric rules-1\.0/)).toBeVisible()

	const clarity = page.locator('#skill-promptClarity')
	await clarity.getByText(/^Evidence \(\d+\)$/).click()
	const quotes = (await clarity.locator('blockquote').allTextContents()).map((quote) =>
		// A clipped quote is marked with an ellipsis that is not part of the prompt.
		quote.replace(/^… /, '').replace(/ …$/, '')
	)
	expect(quotes.length).toBeGreaterThan(0)
	const written = [...STRONG_PROMPTS, ...WEAK_PROMPTS]
	for (const quote of quotes) {
		expect(
			written.some((text) => text.includes(quote)),
			`not from the logs: ${quote}`
		).toBe(true)
	}

	await page.getByRole('button', { name: /^Iteration quality/ }).click()
	await expect(page.getByRole('button', { name: /^Iteration quality/ })).toHaveAttribute(
		'aria-pressed',
		'true'
	)
	await expect(page.getByRole('heading', { name: 'What to practise next' })).toBeVisible()

	const origin = new URL(baseURL ?? '').origin
	for (const request of requests) {
		expect([origin, ANALYTICS_SCRIPT_ORIGIN]).toContain(new URL(request.url()).origin)
		for (const text of written) expect(request.postData() ?? '').not.toContain(text)
	}

	await page.getByRole('link', { name: 'Sessions', exact: true }).click()
	await expect(page.getByRole('table')).toBeVisible()
	await page.getByRole('button', { name: 'Clear' }).click()
	await page.getByRole('link', { name: 'Assessment', exact: true }).click()
	await expect(page.getByRole('heading', { name: 'No sessions to assess yet' })).toBeVisible()
})

test('the assessment fits a phone screen', async ({ page }) => {
	await page.setViewportSize(PHONE)
	await page.goto('/sessions')
	await page
		.getByLabel('Choose log files')
		.setInputFiles([logFile('strong.md', 'strong-session', STRONG_PROMPTS)])
	await page.getByRole('link', { name: 'Score my workflow' }).click()
	await page.getByRole('button', { name: 'Analyze my workflow' }).click()
	await expect(page.getByTestId('overall-score')).toBeVisible()
	const overflow = await page.evaluate(
		() => document.documentElement.scrollWidth - window.innerWidth
	)
	expect(overflow).toBe(0)
})
